/**
 * ============================================================================
 * BIDDING — the auction, used only when the game is played in 'bid' mode.
 * ============================================================================
 *
 * This is not a printed rule and does not pretend to be. The printed set has
 * no auction at all; `settings.mode === 'classic'` is that game, untouched,
 * and nothing in this file runs during it.
 *
 * Aaran's rules for it (2026-10-09), in his words where it matters:
 *
 *   * "If anyone else wants to buy it or bid for it, they can do it, and it is
 *     not just for Malaysia. It is for every country." — landing on ANY
 *     unowned space opens it to the whole table, whether the player who landed
 *     said buy or said skip.
 *   * Saying BUY is not a purchase in this mode: it is the opening bid, at the
 *     printed price. Saying SKIP opens the same auction with nothing bid, and
 *     the first bid may then be no lower than the printed price.
 *   * "It counts to 5 seconds. Or, for 3 seconds, you could select that in the
 *     game itself" — a clock, not turns, and every accepted bid puts it back
 *     to the top. `settings.bidding.clockSeconds`.
 *   * A bid must beat the one before it by at least
 *     `settings.bidding.minRaise` — $5 when he first asked, $50 since
 *     2026-10-11.
 *   * Nobody may bid money they do not have. A bid is capped by the bidder's
 *     cash, so winning an auction can never put a player into debt. That is
 *     the same principle as the printed game's purchase offer, not a new rule.
 *
 * Prices, rents and every other printed value are untouched. The only thing
 * bidding changes is who ends up holding a card and what they paid.
 */

import { addLog, money, notify } from './log'
import { activePlayers, biddingGame, displayNameOf, getPlayer } from './queries'
import { buyPropertyAt } from './spaces'
import type { Auction, GameState } from './types'

/** Re-exported so the auction is the one import a caller needs. */
export { biddingGame }

export function clockMs(state: GameState): number {
  return Math.max(1, state.settings.bidding.clockSeconds) * 1000
}

/**
 * Open the auction on an unowned space.
 *
 * `openingBidderId` is the player who landed when they said buy — their bid is
 * the printed price and stands as the one to beat. Null when they skipped.
 */
export function openAuction(
  state: GameState,
  propertyId: string,
  price: number,
  landedBy: string,
  openingBidderId: string | null,
  now: number,
): void {
  const auction: Auction = {
    propertyId,
    price,
    landedBy,
    openedByBuy: openingBidderId !== null,
    highBid: openingBidderId !== null ? price : null,
    highBidderId: openingBidderId,
    bids: openingBidderId !== null ? [{ playerId: openingBidderId, amount: price }] : [],
    bidSeq: 1,
    endsAt: now + clockMs(state),
    remainingMs: null,
  }
  state.auction = auction
  state.stage = 'bidding'
  state.pendingPurchase = null

  const name = displayNameOf(propertyId)
  if (openingBidderId) {
    const opener = getPlayer(state, openingBidderId)
    addLog(
      state,
      'property',
      `${opener.name} opened the bidding on ${name} at ${money(price)}. Anyone may bid.`,
    )
    notify(state, openingBidderId, `${opener.name} opened the bidding on ${name}`)
  } else {
    const lander = getPlayer(state, landedBy)
    addLog(
      state,
      'property',
      `${lander.name} passed on ${name} — it goes to the table from ${money(price)}.`,
    )
    notify(state, landedBy, `${name} is open for bids`)
  }
}

/** The lowest amount that would be accepted right now. */
export function minimumBid(state: GameState): number {
  const auction = state.auction
  if (!auction) return 0
  if (auction.highBid === null) return auction.price
  return auction.highBid + Math.max(1, state.settings.bidding.minRaise)
}

/** Why a player cannot bid a given amount, or null when they can. */
export function bidProblem(state: GameState, playerId: string, amount: number): string | null {
  const auction = state.auction
  if (state.phase !== 'playing' || state.stage !== 'bidding' || !auction) {
    return 'There is nothing up for auction.'
  }
  if (state.paused) return 'The game is paused.'

  const player = state.players.find((p) => p.id === playerId)
  if (!player || player.isOut) return 'Not in the game.'

  const least = minimumBid(state)
  if (!Number.isFinite(amount) || Math.round(amount) !== amount || amount <= 0) {
    return 'Bid a whole number.'
  }
  if (amount < least) return `The bidding is at ${money(least)}.`
  if (amount > player.cash) return `Only ${money(player.cash)} in hand.`
  // Raising your own high bid pushes the price up against yourself for no
  // reason, and resets the clock everybody is watching.
  if (auction.highBidderId === playerId) return 'You are already the high bidder.'
  return null
}

/** The most this player could bid — what the Max button offers. */
export function maxBid(state: GameState, playerId: string): number {
  const player = state.players.find((p) => p.id === playerId)
  return player ? player.cash : 0
}

/**
 * Take a bid. Returns false and changes nothing if it is not allowed.
 *
 * Every accepted bid puts the clock back to the full count, so the auction
 * ends only once nobody has raised for the whole of it.
 */
export function placeBid(
  state: GameState,
  playerId: string,
  amount: number,
  now: number,
): boolean {
  if (bidProblem(state, playerId, amount) !== null) return false
  const auction = state.auction!
  const player = getPlayer(state, playerId)

  auction.highBid = amount
  auction.highBidderId = playerId
  auction.bids.push({ playerId, amount })
  auction.bidSeq += 1
  auction.endsAt = now + clockMs(state)
  auction.remainingMs = null

  addLog(
    state,
    'property',
    `${player.name} bid ${money(amount)} for ${displayNameOf(auction.propertyId)}.`,
  )
  return true
}

/**
 * The clock has run out. The high bidder buys at their own bid; if nobody bid,
 * the card stays with the Bank exactly as it would in a classic game.
 *
 * Unlike an ordinary purchase, the winning price is announced to everyone. It
 * has to be: every player watched the bidding that set it. Nothing else about
 * cash privacy changes — balances are still nobody else's business.
 */
export function closeAuction(state: GameState): void {
  const auction = state.auction
  if (!auction) return
  const name = displayNameOf(auction.propertyId)

  state.auction = null

  const winnerId = auction.highBidderId
  const amount = auction.highBid
  // A player who left or was removed mid-auction cannot win it.
  const winnerStillIn =
    winnerId !== null && activePlayers(state).some((p) => p.id === winnerId)

  if (winnerId === null || amount === null || !winnerStillIn) {
    addLog(state, 'property', `No bids for ${name} — it stays with the Bank.`)
    notify(state, auction.landedBy, `${name} had no bidders`)
    return
  }

  const winner = getPlayer(state, winnerId)
  if (!buyPropertyAt(state, winnerId, auction.propertyId, amount)) {
    // Should not happen: the bid was checked against their cash when it was
    // made and nothing since then could have taken money off them. Say so
    // rather than silently handing the card over for nothing.
    addLog(state, 'property', `${winner.name} could not complete the purchase of ${name}.`)
    return
  }

  addLog(state, 'property', `${winner.name} won ${name} at ${money(amount)}.`)
  notify(state, winnerId, `${winner.name} won ${name} for ${money(amount)}`, 'good')
}

/**
 * Take a player's bids out of an auction, because they have left the game or
 * been removed from it.
 *
 * The card does not simply go to them-who-are-gone, and nor is the auction
 * thrown away: the highest bid from somebody still in the game stands, and the
 * clock keeps running so the rest can still raise it.
 */
export function dropBidderFromAuction(state: GameState, playerId: string): void {
  const auction = state.auction
  if (!auction) return

  auction.bids = auction.bids.filter((bid) => bid.playerId !== playerId)
  if (auction.highBidderId !== playerId) return

  const standing = auction.bids[auction.bids.length - 1] ?? null
  auction.highBid = standing ? standing.amount : null
  auction.highBidderId = standing ? standing.playerId : null
  if (!standing) auction.openedByBuy = false
  // The number on screen changed, so everybody's clock restarts with it.
  auction.bidSeq += 1
  addLog(
    state,
    'property',
    standing
      ? `Bidding on ${displayNameOf(auction.propertyId)} falls back to ${money(standing.amount)}.`
      : `${displayNameOf(auction.propertyId)} has no bids left on it.`,
  )
}

/** True once the host's own clock says the bidding is over. */
export function auctionExpired(state: GameState, now: number): boolean {
  const auction = state.auction
  if (!auction || state.paused) return false
  return auction.endsAt !== null && now >= auction.endsAt
}

/** Stop the clock, keeping whatever was left on it. */
export function freezeAuctionClock(state: GameState, now: number): void {
  const auction = state.auction
  if (!auction || auction.endsAt === null) return
  auction.remainingMs = Math.max(0, auction.endsAt - now)
  auction.endsAt = null
}

/** Start it again with the same time left. */
export function thawAuctionClock(state: GameState, now: number): void {
  const auction = state.auction
  if (!auction || auction.remainingMs === null) return
  auction.endsAt = now + auction.remainingMs
  auction.remainingMs = null
  // The devices restart their own count from this, or they would sit showing
  // the number the clock froze at.
  auction.bidSeq += 1
}
