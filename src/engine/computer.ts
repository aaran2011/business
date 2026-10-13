/**
 * ============================================================================
 * COMPUTER PLAYERS — one steady style.
 * ============================================================================
 *
 * This invents NO rules. It only ever picks one of the actions the rules
 * already offer, exactly as a person tapping the same buttons would: the
 * engine still validates everything, and a computer player is charged rent,
 * jailed and bankrupted on the same terms as anybody else.
 *
 * Aaran chose a single style rather than difficulty levels (2026-10-09), so
 * there is one policy here and it is written to be readable rather than
 * clever:
 *
 *   * Buy what it can afford while keeping a cash reserve back.
 *   * Build when it is offered the chance, on the same reserve test.
 *   * Pay its way out of Jail when it is comfortable, otherwise roll.
 *   * Raise cash by mortgaging before it will go bankrupt.
 *   * Bid up to about the printed price — more for a country that finishes a
 *     colour group, since that is what doubles the rent.
 *
 * The decision is a pure function of the game state, so it can be replayed and
 * checked in the harness. WHEN it is asked is the caller's business: the device
 * running the game leaves a beat between moves so the table can follow along.
 */

import { COUNTRIES } from '../data/properties'
import { SPECIAL_ASSETS } from '../data/specialAssets'
import { minimumBid } from './auction'
import { canBuild } from './building'
import { orderRollTurn } from './game'
import {
  countCountriesOwnedInColour,
  debtOwedBy,
  mortgageValueOf,
  purchasePriceOf,
} from './queries'
import type { GameAction, GameState } from './types'

/**
 * Cash kept back from any purchase, build or bid.
 *
 * A player with no money cannot pay rent, and the cheapest country on the
 * board is $1,000, so a computer that spends to its last dollar is one unlucky
 * throw from mortgaging everything it owns.
 */
const RESERVE = 2500

/*
  WHAT A COMPUTER WILL PAY, as a multiple of the printed price.

  This was 1.0 — the printed price, exactly — and that single number is why
  the computers never bid at all. Pressing Buy opens the auction AT the
  printed price, so the next legal bid is already $50 over the ceiling and
  every computer folded before it had started. They only ever bid on a card
  the player had skipped, and dropped out the moment anybody answered.

  A real opponent pays over the odds for something it wants, so these go
  above 1. The spread is fixed per card per player rather than random, which
  matters twice: the same computer wants the same country by the same amount
  every time it comes up, the way a person has preferences; and the harness
  can replay a game and get the same auction.
*/
/** The least any computer will go to, over the printed price. */
const WANT_FLOOR = 1.12
/** How much further its own taste for a particular card can take it. */
const WANT_SPREAD = 0.3
/** A third card of a colour doubles the site rent on the others. */
const WANT_COMPLETES_GROUP = 0.45
/** Progress towards a group is worth something on its own. */
const WANT_SAME_COLOUR = 0.14
/** Owning both of a transport pair raises the rent on it. */
const WANT_COMPLETES_PAIR = 0.22
/** How often it pushes rather than nudging: a raise that is not the minimum. */
const PUSH_ABOVE = 0.72

/** Is this seat played by the machine? */
export function isComputerSeat(state: GameState, playerId: string): boolean {
  return state.players.some((p) => p.id === playerId && p.isComputer && !p.isOut)
}

/**
 * The next thing this computer player wants to do, or null if it is waiting on
 * somebody else.
 *
 * Safe to call for any seat at any time: it returns null for a seat that is
 * not a computer's, and null when there is nothing for that seat to answer.
 */
export function computerAction(state: GameState, playerId: string): GameAction | null {
  if (!isComputerSeat(state, playerId)) return null

  if (state.phase === 'orderRoll') {
    return orderRollTurn(state) === playerId ? { type: 'ROLL_FOR_ORDER', playerId } : null
  }
  if (state.phase !== 'playing' || state.paused) return null

  // Bidding comes first because it is the one thing a computer may answer when
  // it is NOT its turn.
  if (state.stage === 'bidding') return bidAction(state, playerId)

  const isUp = state.turnOrder[state.currentIndex] === playerId
  if (!isUp) return null

  // Money in waits for an OK like it does for anybody else — the card is
  // shown, the game holds, and the computer presses it.
  const owedOk = (state.moneyToAck ?? []).find((a) => a.playerId === playerId)
  if (owedOk) return { type: 'ACK_MONEY', id: owedOk.id }

  // A finished Jail attempt is read and acknowledged, not rolled again.
  if (state.pendingJailResult?.playerId === playerId) return { type: 'ACK_JAIL_RESULT' }

  const owed = debtOwedBy(state, playerId)
  if (owed > 0) return payOffAction(state, playerId, owed)

  const player = state.players.find((p) => p.id === playerId)
  if (!player) return null

  switch (state.stage) {
    case 'awaitingRoll':
      return { type: 'ROLL_DICE' }

    case 'inJail':
      // Pay only when the fee leaves the reserve intact; otherwise take the
      // free attempt, which costs nothing but a turn.
      return player.cash - state.settings.jail.payToEscape >= RESERVE
        ? { type: 'JAIL_PAY' }
        : { type: 'JAIL_ROLL' }

    case 'awaitingPurchase': {
      const pending = state.pendingPurchase
      if (!pending) return null
      const wants =
        player.cash - pending.price >= RESERVE ||
        // A card that finishes a colour group is worth going closer to the bone
        // for, because it doubles the site rent on the whole group.
        (completesGroup(state, playerId, pending.propertyId) && player.cash >= pending.price)
      return wants ? { type: 'BUY_PROPERTY' } : { type: 'DECLINE_PURCHASE' }
    }

    case 'awaitingBuild': {
      const offer = state.pendingBuild
      if (!offer) return null
      const check = canBuild(state, playerId, offer.propertyId)
      return check.allowed && player.cash - check.cost >= RESERVE
        ? { type: 'BUILD', propertyId: offer.propertyId }
        : { type: 'DECLINE_BUILD' }
    }

    // 'moving' and 'awaitingEndTurn' are the engine's own business: the host
    // walks the token and ends the turn by itself.
    default:
      return null
  }
}

/**
 * Bidding. It bids the least it can get away with — the minimum raise — and
 * stops at its ceiling, so two computers cannot talk each other into paying
 * three times the printed price for Malaysia.
 */
function bidAction(state: GameState, playerId: string): GameAction | null {
  const auction = state.auction
  if (!auction) return null
  if (auction.highBidderId === playerId) return null

  const player = state.players.find((p) => p.id === playerId)
  if (!player || player.isOut) return null

  const ceiling = willingToPay(state, playerId, auction.propertyId)
  const least = minimumBid(state)
  if (least > ceiling) return null

  /*
    Not always the minimum. A player who only ever adds the smallest legal
    amount reads as a machine grinding upwards; a real one sometimes puts in
    a number meant to end it. Which auctions it pushes on is settled by the
    same fixed taste, so it is consistent rather than twitchy.
  */
  const push = taste(`${auction.propertyId}:${playerId}:push`) > PUSH_ABOVE
  const raise = state.settings.bidding.minRaise
  const wanted = push ? least + raise * 4 : least
  const amount = Math.min(wanted, ceiling)

  // Never past what it holds. A group-completer may dip into the reserve —
  // the same licence the purchase decision already takes.
  const floor = completesGroup(state, playerId, auction.propertyId) ? 0 : RESERVE
  if (player.cash - amount < floor) return null

  return { type: 'PLACE_BID', playerId, amount }
}

/**
 * The most this player would go to for this card, in whole dollars.
 *
 * Capped by what they actually hold, so the number is always one they could
 * pay; `bidAction` keeps the cash reserve on top of that.
 */
function willingToPay(state: GameState, playerId: string, propertyId: string): number {
  const price = purchasePriceOf(propertyId)
  let want = WANT_FLOOR + taste(`${propertyId}:${playerId}`) * WANT_SPREAD

  const country = COUNTRIES[propertyId]
  if (country) {
    if (completesGroup(state, playerId, propertyId)) want += WANT_COMPLETES_GROUP
    else if (countCountriesOwnedInColour(state, playerId, country.colour) > 0) {
      want += WANT_SAME_COLOUR
    }
  } else {
    const asset = SPECIAL_ASSETS[propertyId]
    if (asset && state.holdings[asset.pairWith]?.ownerId === playerId) {
      want += WANT_COMPLETES_PAIR
    }
  }

  const player = state.players.find((p) => p.id === playerId)
  return Math.min(Math.round(price * want), player?.cash ?? 0)
}

/**
 * A settled 0–1 for a string — the same answer every time, on every device.
 *
 * `Math.random` would do the job for one game and ruin two other things: the
 * host asks for this decision on every render while an auction is open, so a
 * fresh number each time would make a computer change its mind mid-second;
 * and the simulation could never replay a game. FNV-1a, which is small and
 * spreads well enough for choosing a mood.
 */
function taste(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}


/**
 * Raising money to settle a debt: mortgage the cheapest thing that will do,
 * one step at a time, and only sell buildings once there is nothing left to
 * mortgage. Selling a house gets back half of what it cost, so it is the last
 * resort rather than the first.
 */
function payOffAction(state: GameState, playerId: string, owed: number): GameAction {
  const player = state.players.find((p) => p.id === playerId)
  if (player && player.cash >= owed) return { type: 'SETTLE_DEBT' }

  const mine = Object.entries(state.holdings)
    .filter(([, holding]) => holding.ownerId === playerId)
    .map(([propertyId, holding]) => ({ propertyId, holding }))

  const mortgageable = mine
    .filter((h) => !h.holding.mortgaged && h.holding.buildings === 0)
    .sort((a, b) => mortgageValueOf(a.propertyId) - mortgageValueOf(b.propertyId))
  if (mortgageable.length) return { type: 'MORTGAGE', propertyId: mortgageable[0].propertyId }

  const built = mine.filter((h) => h.holding.buildings > 0)
  if (built.length) return { type: 'SELL_BUILDING', propertyId: built[0].propertyId }

  // Nothing left to raise. SETTLE_DEBT is also how the engine recognises a
  // player who cannot pay, so this is the honest answer rather than a stall.
  return { type: 'SETTLE_DEBT' }
}

/** Would owning this card complete a colour group for this player? */
function completesGroup(state: GameState, playerId: string, propertyId: string): boolean {
  const country = COUNTRIES[propertyId]
  if (!country) return false
  const needed = state.settings.colourGroups.sizeRequired
  return countCountriesOwnedInColour(state, playerId, country.colour) === needed - 1
}

/** What a computer would pay for a card, for anything that wants to show it. */
export function computerCeilingFor(
  state: GameState,
  playerId: string,
  propertyId: string,
): number {
  return willingToPay(state, playerId, propertyId)
}
