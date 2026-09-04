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
  /** guest -> host, adding themselves to the lobby with their own name+colour */
  | { t: 'addMe'; name: string; colourId: string }
  /** guest -> host, changing their own name or colour in the lobby */
  | { t: 'editMe'; name?: string; colourId?: string }
  /** host -> guest, confirming which seat this device now controls */
  | { t: 'claimed'; playerId: string }
  /** host -> guest, the lobby is full */
  | { t: 'full' }
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
    ...maskCashExcept(state, (id) => id === viewerPlayerId),
    // Ranked here, on the host, while the real balances are still available.
    leaderboardOrder: leaderboard(state).map((row) => row.player.id),
  }
}

/**
 * Hide every balance this device has no business seeing — including on the
 * host. The host has to hold the real numbers to run the bank, but it should
 * not be showing them on screen for players who are on their own phones.
 *
 * `isVisible` is normally the session's `controlsPlayer`, so a device sees the
 * cash of the seats it actually plays and nobody else's.
 */
export function maskCashExcept(
  state: GameState,
  isVisible: (playerId: string) => boolean,
): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      isVisible(player.id)
        ? { ...player, cashHidden: false }
        : { ...player, cash: 0, cashHidden: true },
    ),
  }
}

/**
 * What a joined phone is allowed to ask the host to do.
 *
 * The host is the authority, so this is the one place that decides. A phone
 * may only ever touch its own seat, and only the device running the game may
 * start it, end it, remove people or change the rules.
 */
export function guestMayDo(
  action: GameAction,
  guestPlayerId: string | null,
  state: GameState,
): boolean {
  if (!guestPlayerId) return false

  switch (action.type) {
    // Your own seat in the lobby is yours to edit or give up.
    case 'UPDATE_LOBBY_PLAYER':
    case 'REMOVE_LOBBY_PLAYER':
      return state.phase === 'setup' && action.id === guestPlayerId

    // Everyone takes their own opening roll, and only their own.
    case 'ROLL_FOR_ORDER':
      return state.phase === 'orderRoll' && action.playerId === guestPlayerId

    // Host-only: running the game itself.
    case 'START_GAME':
    case 'CONFIRM_ORDER':
    case 'ADD_LOBBY_PLAYER':
    case 'END_GAME':
    case 'REMOVE_PLAYER':
    case 'SET_TIMER':
    case 'TIME_UP':
    case 'REQUEST_PAUSE':
    case 'CANCEL_PAUSE':
    case 'RESUME':
    case 'RESUME_WITHOUT_TIMER':
    case 'UPDATE_SETTINGS':
    case 'RESET':
    case 'NET_SYNC':
      return false

    // Everything else is a move in the game: only on your own turn.
    default:
      return state.phase === 'playing' && state.turnOrder[state.currentIndex] === guestPlayerId
  }
}
