/**
 * Building logic.
 *
 * Progression is strictly SITE -> 1 HOUSE -> 2 HOUSES -> 3 HOUSES, capped by
 * `buildings.maxLevel` (3 by default). Raising that setting to 4 adds the
 * printed HOTEL tier on top, which is the only step that uses Cost of Hotel.
 *
 * Building does NOT require a colour group. Landing on a country you already
 * own is enough. Colour groups only double unimproved site rent — see rent.ts.
 *
 * Special transport / utility assets never take buildings.
 */

/** The hotel is always level 4; every level below it is a house. */
const HOTEL_LEVEL = 4

import { BUILDING_LEVEL_LABELS, COUNTRIES } from '../data/properties'
import { addLog, money } from './log'
import { credit, transferMoney } from './payments'
import {
  buildingSellRefund,
  countCountriesOwnedInColour,
  getPlayer,
  hasCompleteColourGroup,
} from './queries'
import type { GameState } from './types'

export interface BuildCheck {
  allowed: boolean
  reason: string
  /** Cost of the next step: a house, or the hotel upgrade. */
  cost: number
  nextLabel: string
}

export function canBuild(state: GameState, playerId: string, propertyId: string): BuildCheck {
  const def = COUNTRIES[propertyId]
  const fail = (reason: string): BuildCheck => ({ allowed: false, reason, cost: 0, nextLabel: '' })

  if (!def) return fail('Only countries can be built on.')

  const holding = state.holdings[propertyId]
  if (holding.ownerId !== playerId) return fail('You do not own this property.')
  if (holding.mortgaged) return fail('Mortgaged property cannot be built on.')

  const level = holding.buildings
  const maxLevel = state.settings.buildings.maxLevel
  if (level >= maxLevel) {
    return fail(
      maxLevel >= HOTEL_LEVEL
        ? 'Already at Hotel — nothing further to build.'
        : `${def.name} already has the maximum of ${maxLevel} houses.`,
    )
  }

  // A colour group is optional for building, and off by default: owning the
  // country you are standing on is enough.
  if (state.settings.colourGroups.requiredForBuilding) {
    const required = state.settings.colourGroups.sizeRequired
    if (!hasCompleteColourGroup(state, playerId, def.colour)) {
      const owned = countCountriesOwnedInColour(state, playerId, def.colour)
      return fail(`Needs ${required} ${def.colour} cards to build — you own ${owned}.`)
    }
  }

  if (state.settings.buildings.requireEvenBuilding) {
    const group = Object.values(COUNTRIES)
      .filter((c) => c.colour === def.colour && state.holdings[c.id].ownerId === playerId)
      .map((c) => state.holdings[c.id].buildings)
    if (Math.min(...group) < level) {
      return fail('House rules require even building across the colour group.')
    }
  }

  // Only the step up to level 4 is the hotel; it alone uses Cost of Hotel.
  const isHotelStep = level + 1 === HOTEL_LEVEL
  const cost = isHotelStep ? def.hotelCost : def.houseCost
  const player = getPlayer(state, playerId)
  const nextLabel = BUILDING_LEVEL_LABELS[level + 1]

  if (player.cash < cost) {
    return { allowed: false, reason: `Needs ${money(cost)} in cash.`, cost, nextLabel }
  }
  return { allowed: true, reason: `Build ${nextLabel} for ${money(cost)}`, cost, nextLabel }
}

/** buildHouse / buildHotel — one function, since the step is implied by level. */
export function buildOneStep(state: GameState, playerId: string, propertyId: string): boolean {
  const check = canBuild(state, playerId, propertyId)
  if (!check.allowed) return false

  const def = COUNTRIES[propertyId]
  transferMoney(state, playerId, null, check.cost, `built ${check.nextLabel} on ${def.name}`)
  state.holdings[propertyId].buildings += 1

  addLog(
    state,
    'build',
    `${getPlayer(state, playerId).name} built ${check.nextLabel} on ${def.name} for ${money(check.cost)}.`,
  )
  return true
}

export const buildHouse = buildOneStep
export const buildHotel = buildOneStep

export interface SellCheck {
  allowed: boolean
  reason: string
  refund: number
  fromLabel: string
  toLabel: string
}

export function canSellBuilding(
  state: GameState,
  playerId: string,
  propertyId: string,
): SellCheck {
  const def = COUNTRIES[propertyId]
  const fail = (reason: string): SellCheck => ({
    allowed: false,
    reason,
    refund: 0,
    fromLabel: '',
    toLabel: '',
  })
  if (!def) return fail('Only countries carry buildings.')

  const holding = state.holdings[propertyId]
  if (holding.ownerId !== playerId) return fail('You do not own this property.')
  const level = holding.buildings
  if (level <= 0) return fail('Nothing built here.')

  if (state.settings.buildings.requireEvenBuilding) {
    const group = Object.values(COUNTRIES)
      .filter((c) => c.colour === def.colour && state.holdings[c.id].ownerId === playerId)
      .map((c) => state.holdings[c.id].buildings)
    if (Math.max(...group) > level) {
      return fail('House rules require selling evenly across the colour group.')
    }
  }

  return {
    allowed: true,
    reason: '',
    refund: buildingSellRefund(state, propertyId),
    fromLabel: BUILDING_LEVEL_LABELS[level],
    toLabel: BUILDING_LEVEL_LABELS[level - 1],
  }
}

/**
 * sellBuilding — steps a property down one level and refunds cash.
 * The refund ratio is a house-rule setting: the printed rules give no price.
 */
export function sellBuilding(state: GameState, playerId: string, propertyId: string): boolean {
  const check = canSellBuilding(state, playerId, propertyId)
  if (!check.allowed) return false

  state.holdings[propertyId].buildings -= 1
  credit(state, playerId, check.refund)

  addLog(
    state,
    'build',
    `${getPlayer(state, playerId).name} sold down ${COUNTRIES[propertyId].name} from ${check.fromLabel} to ${check.toLabel} for ${money(check.refund)}.`,
  )
  return true
}
