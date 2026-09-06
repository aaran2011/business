import type { GameState, LogKind } from './types'

const MAX_LOG_ENTRIES = 400

export function addLog(state: GameState, kind: LogKind, text: string): void {
  state.log.unshift({ id: state.nextLogId++, turn: state.turnNumber, kind, text })
  if (state.log.length > MAX_LOG_ENTRIES) state.log.length = MAX_LOG_ENTRIES
}

/**
 * The sentence shown on every device: who, how much, and why. Deliberately
 * spelled out — "Chance -$500" tells the other players nothing useful.
 */
export function moneySentence(name: string, delta: number, reason: string): string {
  if (delta === 0) return `${name}: ${reason}.`
  const verb = delta > 0 ? 'received' : 'lost'
  return `${name} ${verb} ${money(Math.abs(delta))} — ${reason}.`
}

/**
 * Tell the other phones what just happened, in one sentence.
 *
 * Deliberately the ONLY thing they are told. They do not see the card, the
 * price, the rent table or anybody's balance — a purchase is the buyer's
 * business. `playerId` is whose action it was, so their own device can skip a
 * notice about something it just watched happen in full.
 */
export function notify(
  state: GameState,
  playerId: string,
  text: string,
  tone: 'good' | 'bad' | 'neutral' = 'neutral',
): void {
  state.notices.push({ id: state.nextNoticeId++, text, playerId, tone })
  // Only the recent ones are ever shown; the log keeps the full history.
  if (state.notices.length > 8) state.notices.shift()
}

/**
 * One line for money changing hands: who, how much, and what for.
 *
 * Deliberately the ONLY line for an event. Showing "Beauty Contest +$2,500"
 * and then "Priya received $2,500 — First Prize in Beauty Contest" is the same
 * news twice.
 */
export function notifyMoney(
  state: GameState,
  playerId: string,
  name: string,
  delta: number,
  reason: string,
): void {
  if (delta === 0) {
    notify(state, playerId, `${name} — ${reason}`, 'neutral')
    return
  }
  const verb = delta > 0 ? 'received' : 'lost'
  notify(
    state,
    playerId,
    `${name} ${verb} ${money(Math.abs(delta))} — ${reason}`,
    delta > 0 ? 'good' : 'bad',
  )
}

export function money(amount: number): string {
  const sign = amount < 0 ? '-' : ''
  return `${sign}$${Math.abs(Math.round(amount)).toLocaleString('en-US')}`
}

/** Signed form for popups: "+$2,000" / "-$3,000". */
export function signedMoney(amount: number): string {
  if (amount === 0) return '$0'
  return `${amount > 0 ? '+' : '-'}$${Math.abs(Math.round(amount)).toLocaleString('en-US')}`
}
