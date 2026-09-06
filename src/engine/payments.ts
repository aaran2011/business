/**
 * Payment logic.
 *
 * The key rule from the printed game: running out of cash is NOT elimination.
 * A player who cannot pay in cash but still owns something that could raise
 * money keeps the debt and must mortgage or sell to clear it. Only when
 * nothing at all can be liquidated does the player go out.
 */

import { COUNTRIES } from '../data/properties'
import { addLog, money } from './log'
import {
  calculatePlayerAssets,
  displayNameOf,
  getPlayer,
  maxRaisableCash,
  ownedPropertyIds,
} from './queries'
import type { ChargeResult, DebtPayout, GameState } from './types'

/** Unconditional credit — the bank always has funds. */
export function credit(state: GameState, playerId: string, amount: number): void {
  if (amount <= 0) return
  getPlayer(state, playerId).cash += amount
}

/**
 * transferMoney — move `amount` from one player to another, or to/from the
 * Bank when an id is null. Returns how the charge resolved.
 */
export function transferMoney(
  state: GameState,
  fromId: string | null,
  toId: string | null,
  amount: number,
  reason: string,
): ChargeResult {
  if (amount <= 0) return 'paid'
  if (fromId === null) {
    if (toId) credit(state, toId, amount)
    return 'paid'
  }
  return charge(state, fromId, [{ toId, amount }], reason)
}

/**
 * charge — attempt to take money off a player, possibly split between several
 * recipients (Resort pays every other player at once).
 */
export function charge(
  state: GameState,
  debtorId: string,
  payouts: DebtPayout[],
  reason: string,
): ChargeResult {
  const total = payouts.reduce((sum, p) => sum + p.amount, 0)
  if (total <= 0) return 'paid'

  const debtor = getPlayer(state, debtorId)

  if (debtor.cash >= total) {
    settlePayouts(state, debtorId, payouts)
    return 'paid'
  }

  if (maxRaisableCash(state, debtorId) >= total) {
    const existing = state.debts[debtorId]
    state.debts[debtorId] = existing
      ? { debtorId, reason: `${existing.reason}; ${reason}`, payouts: [...existing.payouts, ...payouts] }
      : { debtorId, reason, payouts }
    addLog(
      state,
      'money',
      `${debtor.name} cannot cover ${money(total)} in cash (${reason}) and must raise funds.`,
    )
    return 'deferred'
  }

  bankrupt(state, debtorId, payouts, reason)
  return 'bankrupt'
}

/** Actually move the cash. Assumes the debtor can afford it. */
function settlePayouts(state: GameState, debtorId: string, payouts: DebtPayout[]): void {
  const debtor = getPlayer(state, debtorId)
  for (const payout of payouts) {
    if (payout.amount <= 0) continue
    debtor.cash -= payout.amount
    if (payout.toId) credit(state, payout.toId, payout.amount)
  }
}

/** Pay off a recorded debt once the player has raised enough cash. */
export function settleDebt(state: GameState, debtorId: string): boolean {
  const debt = state.debts[debtorId]
  if (!debt) return true
  const total = debt.payouts.reduce((sum, p) => sum + p.amount, 0)
  const debtor = getPlayer(state, debtorId)
  if (debtor.cash < total) return false

  settlePayouts(state, debtorId, debt.payouts)
  delete state.debts[debtorId]
  addLog(state, 'money', `${debtor.name} settled a debt of ${money(total)}.`)
  return true
}

/**
 * Bankruptcy. The debtor's remaining cash is split pro-rata among the people
 * owed, then their holdings are disposed of per settings and they go OUT.
 */
export function bankrupt(
  state: GameState,
  debtorId: string,
  payouts: DebtPayout[],
  reason: string,
): void {
  const debtor = getPlayer(state, debtorId)
  const total = payouts.reduce((sum, p) => sum + p.amount, 0)
  const available = debtor.cash

  if (total > 0 && available > 0) {
    let distributed = 0
    payouts.forEach((payout, i) => {
      const share =
        i === payouts.length - 1
          ? available - distributed
          : Math.floor((payout.amount / total) * available)
      distributed += share
      if (payout.toId && share > 0) credit(state, payout.toId, share)
    })
  }
  debtor.cash = 0

  // A single creditor can inherit the estate if the house rules say so.
  const creditorId = payouts.find((p) => p.toId)?.toId ?? null
  const inheritor =
    state.settings.elimination.assetsGoTo === 'creditor' && creditorId ? creditorId : null

  const holdings = ownedPropertyIds(state, debtorId)
  for (const id of holdings) {
    const holding = state.holdings[id]
    if (inheritor) {
      holding.ownerId = inheritor
      // Buildings and mortgage status carry over with the deed.
    } else {
      holding.ownerId = null
      holding.mortgaged = false
      holding.buildings = 0
    }
  }

  delete state.debts[debtorId]
  debtor.isOut = true

  const destination = inheritor ? getPlayer(state, inheritor).name : 'the Bank'
  addLog(
    state,
    'system',
    `${debtor.name} is BANKRUPT (${reason}). ${
      holdings.length
        ? `${holdings.length} holding${holdings.length === 1 ? '' : 's'} passed to ${destination}.`
        : 'They held no property.'
    }`,
  )
}

/**
 * Force-eliminate a player who chooses to give up, or who is left with a debt
 * they can no longer cover after their assets have been exhausted.
 */
export function declareBankrupt(state: GameState, debtorId: string): void {
  const debt = state.debts[debtorId]
  bankrupt(state, debtorId, debt?.payouts ?? [], debt?.reason ?? 'resigned')
}

/**
 * A summary of what a player could still do to raise money, used to explain
 * their options while they are in debt.
 */
export function fundraisingOptions(state: GameState, playerId: string): string[] {
  const options: string[] = []
  const assets = calculatePlayerAssets(state, playerId)
  const ids = ownedPropertyIds(state, playerId)

  const mortgageable = ids.filter((id) => !state.holdings[id].mortgaged)
  if (mortgageable.length) {
    options.push(
      `Mortgage up to ${mortgageable.length} holding${mortgageable.length === 1 ? '' : 's'}`,
    )
  }
  const withBuildings = ids.filter((id) => COUNTRIES[id] && state.holdings[id].buildings > 0)
  if (withBuildings.length) {
    options.push(`Sell buildings on ${withBuildings.map(displayNameOf).join(', ')}`)
  }
  if (!options.length) options.push('No assets left to liquidate')
  options.push(`Maximum raisable: ${money(assets.cash + assets.liquidatable)}`)
  return options
}


/**
 * Host removes a player mid-game. Their holdings go back to the Bank, free of
 * buildings and mortgages, and they take no further turns.
 */
export function removePlayerFromGame(state: GameState, playerId: string): void {
  const player = getPlayer(state, playerId)
  if (player.isOut) return

  const holdings = ownedPropertyIds(state, playerId)
  for (const id of holdings) {
    const holding = state.holdings[id]
    holding.ownerId = null
    holding.mortgaged = false
    holding.buildings = 0
  }

  delete state.debts[playerId]
  player.cash = 0
  player.isOut = true
  player.inJail = false
  player.jailReleasePending = false
  player.jailRolls = []

  addLog(
    state,
    'system',
    `${player.name} was removed from the game. ${
      holdings.length
        ? `${holdings.length} holding${holdings.length === 1 ? '' : 's'} returned to the Bank.`
        : 'They held no property.'
    }`,
  )
}
