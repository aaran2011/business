/**
 * Movement logic and the START bonus.
 *
 * $1,500 is paid whenever a player PASSES START or LANDS ON START.
 */

import { BOARD, BOARD_SIZE, crossesStart, forwardDistance } from '../data/board'
import { addLog, money, moneySentence, setPopup } from './log'
import { credit } from './payments'
import { getPlayer } from './queries'
import type { GameState } from './types'

/**
 * movePlayer — advance a player `steps` spaces clockwise, paying the START
 * bonus if START was crossed or landed on. Does NOT resolve the new space.
 */
export function movePlayer(
  state: GameState,
  playerId: string,
  steps: number,
  awardStartBonus = true,
): void {
  const player = getPlayer(state, playerId)
  const passed = crossesStart(player.position, steps)
  player.position = (player.position + steps) % BOARD_SIZE

  if (passed && awardStartBonus) awardStart(state, playerId)
}

/**
 * moveDirectlyTo — jump straight to a space (Go to Jail, Go to Party House).
 * The START bonus is only considered if `awardStartBonus` is set, and only
 * pays out when the forward path actually crosses START.
 */
export function moveDirectlyTo(
  state: GameState,
  playerId: string,
  targetIndex: number,
  awardStartBonus: boolean,
): void {
  const player = getPlayer(state, playerId)
  const steps = forwardDistance(player.position, targetIndex)
  const passed = crossesStart(player.position, steps)
  player.position = targetIndex

  if (passed && awardStartBonus) awardStart(state, playerId)
}

/**
 * Pay the round-completion bonus. Called once per crossing — landing exactly
 * on START counts, and so does passing straight over it without stopping.
 */
export function awardStart(state: GameState, playerId: string): void {
  const amount = state.settings.startBonus.amount
  const player = getPlayer(state, playerId)
  credit(state, playerId, amount)

  addLog(
    state,
    'money',
    `${player.name} completed a round and received ${money(amount)}.`,
  )
  setPopup(
    state,
    {
      kind: 'simple',
      icon: '\u{1F389}',
      title: 'ROUND COMPLETE',
      subtitle: `Congratulations, you completed a round. You have won ${money(amount)}.`,
      delta: amount,
    },
    playerId,
    moneySentence(player.name, amount, 'completing a round'),
  )
}

export function spaceAt(index: number) {
  return BOARD[index]
}
