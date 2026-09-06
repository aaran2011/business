/**
 * Jail logic.
 *
 * Being sent to Jail ends the player's movement there and then. Their turn
 * passes to the next player, and Jail is a real state they stay in until they
 * buy or roll their way out — not a label on the board.
 *
 * On a jailed player's own turn there are exactly two choices:
 *
 *   PAY $500  — hand the fee to the Bank.
 *   ROLL      — take up to three rolls of one die. The moment the running
 *               total reaches 12 they have earned their release; if three
 *               rolls fall short they stay in, and the turn ends.
 *
 * Either way the release takes effect on their NEXT turn: the current turn is
 * spent in Jail, and they roll and move as normal from the following one. A
 * dice roll on a later turn never releases anybody by itself — only these two
 * choices do.
 */

import { rollDie } from './dice'
import { addLog, money, notify } from './log'
import { transferMoney } from './payments'
import { getPlayer } from './queries'
import type { GameState } from './types'

/** Option A — pay the fee. Frees the player from their next turn. */
export function payToEscapeJail(state: GameState, playerId: string): boolean {
  const player = getPlayer(state, playerId)
  const fee = state.settings.jail.payToEscape
  if (player.cash < fee) return false

  transferMoney(state, playerId, null, fee, 'paid to leave Jail')
  earnRelease(state, playerId)

  addLog(state, 'jail', `${player.name} paid ${money(fee)} and leaves Jail next turn.`)
  notify(state, playerId, `${player.name} paid ${money(fee)} to get out of Jail.`)
  return true
}

export interface JailAttempt {
  /** Every roll taken this turn, including the one just made. */
  rolls: number[]
  total: number
  /** True when the running total reached the target and release is pending. */
  released: boolean
  /** True when this turn's attempt is over, either way. */
  finished: boolean
}

/**
 * Option B — one roll of the escape attempt.
 *
 * Called once per press, up to `escapeDieRolls` times in the same turn, so the
 * player watches the total build up rather than being handed three numbers at
 * once. Stops early the moment the target is reached — there is no reason to
 * roll a fourth time after making 12 on the second.
 */
export function attemptJailEscape(state: GameState, playerId: string): JailAttempt {
  const player = getPlayer(state, playerId)
  const { escapeDieRolls, escapeTargetTotal } = state.settings.jail

  const before = player.jailRolls.reduce((sum, r) => sum + r, 0)
  if (player.jailRolls.length >= escapeDieRolls || before >= escapeTargetTotal) {
    return { rolls: player.jailRolls, total: before, released: before >= escapeTargetTotal, finished: true }
  }

  const roll = rollDie()
  player.jailRolls = [...player.jailRolls, roll]
  // The jail die spins too, and only for a throw that actually happened.
  state.dice = [roll]
  state.rollSeq += 1
  const rolls = player.jailRolls
  const total = rolls.reduce((sum, r) => sum + r, 0)
  const released = total >= escapeTargetTotal
  const used = rolls.length
  const finished = released || used >= escapeDieRolls
  const left = escapeDieRolls - used

  addLog(
    state,
    'jail',
    `${player.name} rolled ${roll} in Jail — ${rolls.join(' + ')} = ${total} of ${escapeTargetTotal} needed.`,
  )

  if (released) {
    earnRelease(state, playerId)
    addLog(state, 'jail', `${player.name} made ${total} and leaves Jail next turn.`)
    notify(state, playerId, `${player.name} rolled ${total} and gets out of Jail.`)
  } else if (finished) {
    addLog(state, 'jail', `${player.name} fell short on ${total} and stays in Jail.`)
    notify(state, playerId, `${player.name} stayed in Jail.`)
  }

  return { rolls, total, released, finished: finished || left <= 0 }
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
 *
 * Release is only ever granted here, and only to somebody who earned it on a
 * previous turn by paying or by rolling 12. Nothing else opens the door.
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
