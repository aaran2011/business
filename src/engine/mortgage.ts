/**
 * Mortgage logic.
 *
 * Mortgaging pays the printed Bank Mortgage Value and stops the property
 * collecting rent. Unmortgaging costs the mortgage value back, plus an
 * interest rate that is 0 by default and lives in settings so a fee can be
 * added later without touching this code.
 */

import { COUNTRIES } from '../data/properties'
import { addLog, money } from './log'
import { credit, transferMoney } from './payments'
import { displayNameOf, getPlayer, mortgageValueOf } from './queries'
import type { GameState } from './types'

export function unmortgageCost(state: GameState, propertyId: string): number {
  const base = mortgageValueOf(propertyId)
  return Math.round(base * (1 + state.settings.mortgage.unmortgageInterestRate))
}

export interface MortgageCheck {
  allowed: boolean
  reason: string
  amount: number
}

export function canMortgage(
  state: GameState,
  playerId: string,
  propertyId: string,
): MortgageCheck {
  const holding = state.holdings[propertyId]
  const amount = mortgageValueOf(propertyId)
  if (!holding || holding.ownerId !== playerId) {
    return { allowed: false, reason: 'You do not own this holding.', amount }
  }
  if (holding.mortgaged) return { allowed: false, reason: 'Already mortgaged.', amount }
  if (state.settings.mortgage.requireNoBuildings && holding.buildings > 0) {
    return {
      allowed: false,
      reason: 'Sell the buildings on this property before mortgaging it.',
      amount,
    }
  }
  return { allowed: true, reason: `Raise ${money(amount)}`, amount }
}

export function mortgageProperty(state: GameState, playerId: string, propertyId: string): boolean {
  const check = canMortgage(state, playerId, propertyId)
  if (!check.allowed) return false

  state.holdings[propertyId].mortgaged = true
  credit(state, playerId, check.amount)

  addLog(
    state,
    'mortgage',
    `${getPlayer(state, playerId).name} mortgaged ${displayNameOf(propertyId)} for ${money(check.amount)}.`,
  )
  return true
}

export function canUnmortgage(
  state: GameState,
  playerId: string,
  propertyId: string,
): MortgageCheck {
  const holding = state.holdings[propertyId]
  const amount = unmortgageCost(state, propertyId)
  if (!holding || holding.ownerId !== playerId) {
    return { allowed: false, reason: 'You do not own this holding.', amount }
  }
  if (!holding.mortgaged) return { allowed: false, reason: 'Not mortgaged.', amount }
  if (getPlayer(state, playerId).cash < amount) {
    return { allowed: false, reason: `Needs ${money(amount)} in cash.`, amount }
  }
  return { allowed: true, reason: `Pay ${money(amount)} to lift the mortgage`, amount }
}

export function unmortgageProperty(
  state: GameState,
  playerId: string,
  propertyId: string,
): boolean {
  const check = canUnmortgage(state, playerId, propertyId)
  if (!check.allowed) return false

  transferMoney(state, playerId, null, check.amount, `unmortgaged ${displayNameOf(propertyId)}`)
  state.holdings[propertyId].mortgaged = false

  addLog(
    state,
    'mortgage',
    `${getPlayer(state, playerId).name} lifted the mortgage on ${displayNameOf(propertyId)} for ${money(check.amount)}.`,
  )
  return true
}

/** Every holding of a player that could still be mortgaged for cash. */
export function mortgageableHoldings(state: GameState, playerId: string): string[] {
  return Object.keys(state.holdings).filter(
    (id) => canMortgage(state, playerId, id).allowed && (COUNTRIES[id] || true),
  )
}
