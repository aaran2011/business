/**
 * The wire format between the host device and the phones that join it.
 *
 * There is no server holding the game. One device — whoever set the game up —
 * is the host, and it is the only place the rules ever run. Phones that join
 * send what their player wants to do and render whatever the host sends back.
 * That keeps a single source of truth and means the rule engine never has to
 * know the network exists.
 */

import { leaderboard } from '../engine/queries'
import type { GameAction, GameState } from '../engine/types'

/** Namespaced so the short game code cannot collide with another app's peer. */
export const PEER_PREFIX = 'intlbusiness-'

export function peerIdForCode(code: string): string {
  return PEER_PREFIX + code.trim().toUpperCase()
}

/** Codes are typed in by hand, so accept lower case and stray spaces. */
export function normaliseCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export const CODE_LENGTH = 6

export type NetMessage =
  /** guest -> host, first thing after the channel opens */
  | { t: 'hello' }
  /** guest -> host, taking over one of the seats the host set up */
  | { t: 'claim'; playerId: string }
  /** host -> guest, confirming which seat this device now controls */
  | { t: 'claimed'; playerId: string }
  /** host -> guest, the whole game as that guest is allowed to see it */
  | { t: 'state'; state: GameState; seats: string[] }
  /** guest -> host, "my player would like to do this" */
  | { t: 'action'; action: GameAction }
  /** host -> guest, something was refused, with a reason worth showing */
  | { t: 'reject'; reason: string }

/**
 * Strip the parts of the game a given device is not entitled to see.
 *
 * Every player's cash is private to their own phone. The host device is the
 * banker and necessarily sees the whole board, but no guest ever receives
 * another player's balance — it is removed here, before it is sent, so it is
 * not merely hidden in their UI.
 */
export function redactFor(state: GameState, viewerPlayerId: string | null): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === viewerPlayerId
        ? { ...player, cashHidden: false }
        : { ...player, cash: 0, cashHidden: true },
    ),
    // Ranked here, on the host, while the real balances are still available.
    leaderboardOrder: leaderboard(state).map((row) => row.player.id),
  }
}
