/**
 * Space resolution — what happens when a pawn stops somewhere.
 *
 * Every handler named in the spec lives here:
 *   handlePropertyLanding, handleUno, handleChance, handlePartyHouse,
 *   handleResort, handleCustomDuty, handleTravellingDuty
 */

import { BOARD, JAIL_INDEX, PARTY_HOUSE_INDEX } from '../data/board'
import { CHANCE_CARDS } from '../data/chanceCards'
import { COUNTRIES } from '../data/properties'
import { SPECIAL_ASSETS } from '../data/specialAssets'
import { UNO_CARDS, type EventCard } from '../data/unoCards'
import { addLog, money, moneySentence, notify, setPopup } from './log'
import { moveDirectlyTo } from './movement'
import { announceTransfer, charge, credit, transferMoney } from './payments'
import {
  countCountriesOwned,
  countHotels,
  countHouses,
  displayNameOf,
  getPlayer,
  otherActivePlayers,
  purchasePriceOf,
} from './queries'
import { calculateRent } from './rent'
import type { GameState, TransferLeg } from './types'

/**
 * Resolve the space the current player has stopped on.
 * `total` is the dice total that produced this move — UNO and Chance reuse it
 * rather than rolling again.
 */
export function resolveLanding(state: GameState, playerId: string, total: number | null): void {
  const player = getPlayer(state, playerId)
  const space = BOARD[player.position]
  if (!space) return

  addLog(state, 'move', `${player.name} moved to ${space.label}.`)
  // The plain "landed on" line goes out first. Anything more interesting that
  // happens on this space — a purchase, rent, a card, Jail — replaces it, so
  // the other phones only ever see the most specific thing that occurred.
  notify(state, playerId, `${player.name} landed on ${space.label}.`)

  switch (space.kind) {
    case 'start':
      handleStartLanding(state)
      break
    case 'country':
    case 'special':
      handlePropertyLanding(state, playerId, space.propertyId!)
      break
    case 'uno':
      handleUno(state, playerId, total)
      break
    case 'chance':
      handleChance(state, playerId, total)
      break
    case 'partyHouse':
      handlePartyHouse(state, playerId)
      break
    case 'resort':
      handleResort(state, playerId)
      break
    case 'customDuty':
      handleCustomDuty(state, playerId)
      break
    case 'travellingDuty':
      handleTravellingDuty(state, playerId)
      break
    case 'jail':
      handleJailLanding(state, playerId)
      break
  }
}

// ---------------------------------------------------------------------------
// START
// ---------------------------------------------------------------------------

function handleStartLanding(state: GameState): void {
  // Nothing to do: movePlayer already paid the round bonus and queued the
  // "round complete" card, whether START was landed on or passed over.
  void state
}

// ---------------------------------------------------------------------------
// PROPERTY
// ---------------------------------------------------------------------------

export function handlePropertyLanding(
  state: GameState,
  playerId: string,
  propertyId: string,
): void {
  const holding = state.holdings[propertyId]
  const name = displayNameOf(propertyId)
  const player = getPlayer(state, playerId)

  if (!holding.ownerId) {
    // Unowned — offer it. Never auto-auction.
    state.pendingPurchase = { propertyId, price: purchasePriceOf(propertyId) }
    state.stage = 'awaitingPurchase'
    return
  }

  if (holding.ownerId === playerId) {
    // Landing on your own country is a chance to build, not a dead space.
    if (COUNTRIES[propertyId]) {
      state.pendingBuild = { propertyId }
      state.stage = 'awaitingBuild'
      addLog(state, 'property', `${player.name} landed on their own ${name}.`)
      return
    }
    // Transport and utility assets never take buildings.
    setPopup(state, {
      kind: 'simple',
      icon: SPECIAL_ASSETS[propertyId]?.icon,
      title: name,
      subtitle: 'You own this asset — no rent to pay, and it never takes buildings.',
    })
    return
  }

  const owner = getPlayer(state, holding.ownerId)

  if (holding.mortgaged) {
    addLog(state, 'property', `${name} is mortgaged — ${player.name} pays no rent.`)
    setPopup(state, {
      kind: 'simple',
      icon: '\u{1F6AB}',
      title: `${name} is mortgaged`,
      subtitle: `No rent is collected by ${owner.name}.`,
    })
    return
  }

  const rent = calculateRent(state, propertyId)
  if (rent.amount <= 0) return

  addLog(state, 'property', `${player.name} landed on ${name} (owned by ${owner.name}).`)
  const result = transferMoney(state, playerId, owner.id, rent.amount, `rent on ${name}`)
  addLog(state, 'money', `${player.name} paid ${owner.name} ${money(rent.amount)} rent.`)

  if (result === 'paid') {
    announceTransfer(
      state,
      `Rent — ${name}`,
      [{ fromId: playerId, toId: owner.id, amount: rent.amount }],
      rent.label,
      playerId,
      moneySentence(player.name, -rent.amount, `rent on ${name} to ${owner.name}`),
    )
    notify(
      state,
      playerId,
      `${player.name} paid ${owner.name} ${money(rent.amount)} rent for ${name}.`,
    )
  }
}

/** Complete a purchase the player has accepted. */
export function buyProperty(state: GameState, playerId: string, propertyId: string): boolean {
  const holding = state.holdings[propertyId]
  if (holding.ownerId) return false

  const price = purchasePriceOf(propertyId)
  const player = getPlayer(state, playerId)
  if (player.cash < price) return false

  transferMoney(state, playerId, null, price, `bought ${displayNameOf(propertyId)}`)
  holding.ownerId = playerId

  addLog(
    state,
    'property',
    `${player.name} purchased ${displayNameOf(propertyId)} for ${money(price)}.`,
  )
  // The other phones are told WHAT was bought, never for how much and never
  // the card itself. That is the buyer's business.
  notify(state, playerId, `${player.name} bought ${displayNameOf(propertyId)}.`)
  return true
}

// ---------------------------------------------------------------------------
// UNO  (EVEN = profit, ODD = loss)
// ---------------------------------------------------------------------------

export function handleUno(state: GameState, playerId: string, total: number | null): void {
  const card = total !== null ? UNO_CARDS[total] : undefined
  if (!card) return missingCard(state, playerId, 'UNO', total)
  applyCard(state, playerId, card, 'UNO', total!)
}

// ---------------------------------------------------------------------------
// CHANCE  (ODD = profit, EVEN = loss)
// ---------------------------------------------------------------------------

export function handleChance(state: GameState, playerId: string, total: number | null): void {
  const card = total !== null ? CHANCE_CARDS[total] : undefined
  if (!card) return missingCard(state, playerId, 'CHANCE', total)
  applyCard(state, playerId, card, 'CHANCE', total!)
}

/**
 * The printed decks only cover totals 2-12, because the printed game rolled
 * two dice. On a single die a total of 1 is possible and has no card. No card
 * is invented for it — the space simply has no effect and says so.
 */
function missingCard(
  state: GameState,
  playerId: string,
  deck: 'UNO' | 'CHANCE',
  total: number | null,
): void {
  const player = getPlayer(state, playerId)
  addLog(
    state,
    'event',
    `${player.name} landed on ${deck} with a total of ${total} — the printed deck has no card for that total, so nothing happens.`,
  )
  setPopup(state, {
    kind: 'simple',
    icon: deck === 'UNO' ? '\u{1F0CF}' : '\u{2753}',
    title: `${deck} — No Card`,
    subtitle: `The printed deck runs from 2 to 12, so there is no card for a total of ${total}. No effect.`,
  })
}

function applyCard(
  state: GameState,
  playerId: string,
  card: EventCard,
  deck: 'UNO' | 'CHANCE',
  total: number,
): void {
  const player = getPlayer(state, playerId)
  addLog(state, 'event', `${player.name} drew ${deck} ${total}: ${card.title}.`)

  let delta: number | undefined
  let transferLegs: TransferLeg[] = []
  let transferNote: string | undefined

  switch (card.effect.type) {
    case 'bank': {
      const amount = card.effect.amount
      if (amount >= 0) {
        credit(state, playerId, amount)
        addLog(state, 'money', `${player.name} received ${money(amount)} from the Bank.`)
      } else {
        transferMoney(state, playerId, null, -amount, `${deck} ${total}: ${card.title}`)
        addLog(state, 'money', `${player.name} paid ${money(-amount)} to the Bank.`)
      }
      delta = amount
      break
    }

    case 'collectFromEach': {
      const collected = collectFromEachPlayer(
        state,
        playerId,
        card.effect.amount,
        `${deck}: ${card.title}`,
      )
      delta = collected.total
      transferLegs = collected.legs
      transferNote = `${money(card.effect.amount)} from each player`
      break
    }

    case 'payEach': {
      const paid = payEachPlayer(state, playerId, card.effect.amount, `${deck}: ${card.title}`)
      delta = -paid.total
      transferLegs = paid.legs
      transferNote = `${money(card.effect.amount)} to each player`
      break
    }

    case 'generalRepairs': {
      const houses = countHouses(state, playerId)
      const hotels = countHotels(state, playerId)
      const { perHouse, perHotel } = state.settings.generalRepairs
      const amount = houses * perHouse + hotels * perHotel
      if (amount > 0) {
        transferMoney(state, playerId, null, amount, 'General Repairs')
        addLog(
          state,
          'money',
          `${player.name} paid ${money(amount)} for General Repairs (${houses} house${
            houses === 1 ? '' : 's'
          }, ${hotels} hotel${hotels === 1 ? '' : 's'}).`,
        )
      } else {
        addLog(state, 'money', `${player.name} owns no buildings — General Repairs cost nothing.`)
      }
      delta = -amount
      break
    }

    case 'goToPartyHouse': {
      moveDirectlyTo(
        state,
        playerId,
        PARTY_HOUSE_INDEX,
        state.settings.startBonus.awardOnForcedMoveToPartyHouse,
      )
      addLog(state, 'move', `${player.name} was sent to Party House.`)
      setPopup(state, { kind: 'card', deck, card, total })
      // Resolve Party House immediately; it replaces the popup with its own.
      handlePartyHouse(state, playerId)
      return
    }

    case 'goToJail': {
      sendToJail(state, playerId)
      setPopup(state, { kind: 'card', deck, card, total })
      return
    }

    case 'none': {
      addLog(state, 'event', `${deck} ${total} has no effect.`)
      break
    }
  }

  const sentence = moneySentence(player.name, delta ?? 0, card.title)
  setPopup(state, { kind: 'card', deck, card, total, delta }, playerId, sentence)
  notify(state, playerId, sentence)
  announceTransfer(state, card.title.toUpperCase(), transferLegs, transferNote)
}

// ---------------------------------------------------------------------------
// PARTY HOUSE  /  RESORT
// ---------------------------------------------------------------------------

/** The lander RECEIVES the amount from every other active player. */
export function handlePartyHouse(state: GameState, playerId: string): void {
  const amount = state.settings.partyHousePerPlayer
  const { total, legs } = collectFromEachPlayer(state, playerId, amount, 'Party House')
  const player = getPlayer(state, playerId)

  addLog(
    state,
    'event',
    `${player.name} landed on Party House and collected ${money(amount)} from each player (${money(total)} total).`,
  )
  setPopup(
    state,
    {
      kind: 'simple',
      icon: '\u{1F389}',
      title: 'PARTY HOUSE',
      subtitle: `Collect ${money(amount)} from every other player.`,
      delta: total,
    },
    playerId,
    moneySentence(player.name, total, `Party House — ${money(amount)} from each player`),
  )
  announceTransfer(state, 'PARTY HOUSE', legs, `${money(amount)} from each player`)
}

/** The lander PAYS the amount to every other active player. */
export function handleResort(state: GameState, playerId: string): void {
  const amount = state.settings.resortPerPlayer
  const { total, legs } = payEachPlayer(state, playerId, amount, 'Resort')
  const player = getPlayer(state, playerId)

  addLog(
    state,
    'event',
    `${player.name} landed on Resort and paid ${money(amount)} to each player (${money(total)} total).`,
  )
  setPopup(
    state,
    {
      kind: 'simple',
      icon: '\u{1F3D6}️',
      title: 'RESORT',
      subtitle: `Pay ${money(amount)} to every other player.`,
      delta: -total,
    },
    playerId,
    moneySentence(player.name, -total, `Resort — ${money(amount)} to each player`),
  )
  announceTransfer(state, 'RESORT', legs, `${money(amount)} to each player`)
}

interface Collection {
  total: number
  /** Only the payments that actually changed hands. */
  legs: TransferLeg[]
}

/** Each other player pays the receiver. Returns what really moved. */
function collectFromEachPlayer(
  state: GameState,
  receiverId: string,
  amount: number,
  reason: string,
): Collection {
  const others = otherActivePlayers(state, receiverId)
  let total = 0
  const legs: TransferLeg[] = []
  for (const other of others) {
    const before = getPlayer(state, receiverId).cash
    charge(state, other.id, [{ toId: receiverId, amount }], reason)
    const moved = getPlayer(state, receiverId).cash - before
    total += moved
    if (moved > 0) legs.push({ fromId: other.id, toId: receiverId, amount: moved })
  }
  return { total, legs }
}

/** The payer pays every other player. Returns what really moved. */
function payEachPlayer(
  state: GameState,
  payerId: string,
  amount: number,
  reason: string,
): Collection {
  const others = otherActivePlayers(state, payerId)
  const payouts = others.map((other) => ({ toId: other.id, amount }))
  const total = payouts.reduce((sum, p) => sum + p.amount, 0)
  const result = charge(state, payerId, payouts, reason)
  const legs =
    result === 'paid'
      ? others.map((other) => ({ fromId: payerId, toId: other.id, amount }))
      : []
  return { total, legs }
}

// ---------------------------------------------------------------------------
// DUTIES  — both count NORMAL COUNTRIES ONLY.
// ---------------------------------------------------------------------------

export function handleCustomDuty(state: GameState, playerId: string): void {
  const { perCountry, max } = state.settings.customDuty
  applyDuty(state, playerId, perCountry, max, 'CUSTOM DUTY', '\u{1F6C3}')
}

export function handleTravellingDuty(state: GameState, playerId: string): void {
  const { perCountry, max } = state.settings.travellingDuty
  applyDuty(state, playerId, perCountry, max, 'TRAVELLING DUTY', '\u{1F6C4}')
}

function applyDuty(
  state: GameState,
  playerId: string,
  perCountry: number,
  max: number,
  title: string,
  icon: string,
): void {
  const countries = countCountriesOwned(state, playerId)
  const raw = countries * perCountry
  const amount = Math.min(raw, max)
  const player = getPlayer(state, playerId)

  if (amount > 0) transferMoney(state, playerId, null, amount, title)

  addLog(
    state,
    'event',
    `${player.name} paid ${money(amount)} ${title.toLowerCase()} (${countries} countr${
      countries === 1 ? 'y' : 'ies'
    } x ${money(perCountry)}${raw > max ? `, capped at ${money(max)}` : ''}).`,
  )
  setPopup(
    state,
    {
      kind: 'simple',
      icon,
      title,
      subtitle: `${countries} countr${countries === 1 ? 'y' : 'ies'} owned x ${money(perCountry)}${
        raw > max ? ` — capped at ${money(max)}` : ''
      }`,
      delta: -amount,
    },
    playerId,
    moneySentence(player.name, -amount, title.toLowerCase()),
  )
}

// ---------------------------------------------------------------------------
// JAIL
// ---------------------------------------------------------------------------

/** Landing on the Jail space by dice roll. Not the same as being sent there. */
function handleJailLanding(state: GameState, playerId: string): void {
  const player = getPlayer(state, playerId)
  if (state.settings.jail.landingOnJailIsJustVisiting) {
    // Nothing happens, so nothing interrupts the turn. A card saying "no
    // penalty" is a card about nothing.
    addLog(state, 'jail', `${player.name} is just visiting Jail.`)
    return
  }
  sendToJail(state, playerId)
}

export function sendToJail(state: GameState, playerId: string): void {
  const player = getPlayer(state, playerId)
  moveDirectlyTo(state, playerId, JAIL_INDEX, state.settings.startBonus.awardOnForcedMoveToJail)
  player.inJail = true
  player.jailReleasePending = false
  player.jailRolls = []
  addLog(state, 'jail', `${player.name} was sent to Jail.`)
  notify(state, playerId, `${player.name} went to Jail.`)
}
