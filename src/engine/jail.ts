/**
 * Jail logic.
 *
 * A jailed player has exactly two options on their turn:
 *
 *   ROLL THE DICE — roll one die three times. If the three add up to 12 or
 *                   more they have earned their release.
 *   PAY $500      — hand the fee to the Bank and earn their release.
 *
 * Either way the release takes effect on their NEXT turn: the current turn is
 * spent in Jail, and they roll and move as normal from the following turn.
 * A failed attempt simply ends the turn and the same two options are offered
 * again next time — and the same applies however many times a player is sent
 * to Jail.
 */

import { rollJailDice } from './dice'
import { addLog, money, moneySentence, setPopup } from './log'
import { transferMoney } from './payments'
import { getPlayer } from './queries'
import type { GameState } from './types'

/** Option B — pay the fee. Frees the player from their next turn. */
export function payToEscapeJail(state: GameState, playerId: string): boolean {
  const player = getPlayer(state, playerId)
  const fee = state.settings.jail.payToEscape
  if (player.cash < fee) return false

  transferMoney(state, playerId, null, fee, 'paid to leave Jail')
  earnRelease(state, playerId)

  addLog(state, 'jail', `${player.name} paid ${money(fee)} and leaves Jail next turn.`)
  setPopup(
    state,
    {
      kind: 'simple',
      icon: '\u{1F513}',
      title: 'OUT NEXT TURN',
      subtitle: `Paid the Bank ${money(fee)}. ${player.name} walks free at the start of their next turn.`,
      delta: -fee,
    },
    playerId,
    moneySentence(player.name, -fee, 'paying to leave Jail'),
  )
  return true
}

export interface JailAttempt {
  rolls: number[]
  total: number
  /** True when the three rolls made the target and release is now pending. */
  released: boolean
}

/** Option A — roll one die three times and try to reach the target total. */
export function attemptJailEscape(state: GameState, playerId: string): JailAttempt {
  const player = getPlayer(state, playerId)
  const { escapeDieRolls, escapeTargetTotal, payToEscape } = state.settings.jail

  const rolls = rollJailDice(escapeDieRolls)
  const total = rolls.reduce((sum, r) => sum + r, 0)
  const released = total >= escapeTargetTotal

  player.jailRolls = rolls

  addLog(
    state,
    'jail',
    `${player.name} rolled ${rolls.join(' + ')} = ${total} in Jail (needs ${escapeTargetTotal}).`,
  )

  if (released) {
    earnRelease(state, playerId)
    addLog(state, 'jail', `${player.name} made ${total} and leaves Jail next turn.`)
    setPopup(state, {
      kind: 'simple',
      icon: '\u{1F513}',
      title: 'OUT NEXT TURN',
      subtitle: `${rolls.join(' + ')} = ${total}, and ${escapeTargetTotal} was needed. ${player.name} walks free at the start of their next turn.`,
    })
  } else {
    addLog(state, 'jail', `${player.name} fell short on ${total} and stays in Jail.`)
    setPopup(state, {
      kind: 'simple',
      icon: '\u{1F512}',
      title: 'STILL IN JAIL',
      subtitle: `${rolls.join(' + ')} = ${total}, short of ${escapeTargetTotal}. Three fresh rolls next turn, or pay ${money(
        payToEscape,
      )}.`,
    })
  }

  return { rolls, total, released }
}

/**
 * Mark the release as earned. The player stays on the Jail space for the rest
 * of this turn; `advanceToNextPlayer` lets them out when their turn comes up.
 */
function earnRelease(state: GameState, playerId: string): void {
  getPlayer(state, playerId).jailReleasePending = true
}

/**
 * Called at the start of a jailed player's turn. Returns true if they walked
 * free, in which case they roll and move as normal.
 */
export function openJailDoorIfEarned(state: GameState, playerId: string): boolean {
  const player = getPlayer(state, playerId)
  if (!player.inJail || !player.jailReleasePending) return false

  player.inJail = false
  player.jailReleasePending = false
  player.jailRolls = []
  addLog(state, 'jail', `${player.name} is released from Jail.`)
  return true
}
