import type { GameState, LogKind, PopupBody } from './types'

const MAX_LOG_ENTRIES = 400

export function addLog(state: GameState, kind: LogKind, text: string): void {
  state.log.unshift({ id: state.nextLogId++, turn: state.turnNumber, kind, text })
  if (state.log.length > MAX_LOG_ENTRIES) state.log.length = MAX_LOG_ENTRIES
}

/**
 * Queue a popup. Popups do not replace one another — crossing START and then
 * landing on Chance shows the round-complete card first, then the Chance card.
 */
export function setPopup(
  state: GameState,
  body: PopupBody,
  affects: string | null = null,
  summary?: string,
): void {
  state.popups.push({ id: state.nextPopupId++, body, affects, summary })
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
export function notify(state: GameState, playerId: string, text: string): void {
  state.notice = { id: state.nextNoticeId++, text, playerId }
}

/** The popup currently on screen, if any. */
export function currentPopup(state: GameState) {
  return state.popups[0] ?? null
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
