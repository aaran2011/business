/**
 * What travels between the devices in a game.
 *
 * There is no peer-to-peer any more. Every device talks to a Supabase Realtime
 * channel named after the game code, and the server relays. That is what makes
 * it work across different Wi-Fi, mobile data, and networks that block direct
 * connections — no device ever has to reach another one directly.
 *
 * One device is still the host: it is the only place the rules run, so there is
 * a single copy of the truth. The others send what their player wants to do and
 * render whatever the host sends back. The rule engine never learns any of this
 * exists.
 */

import { leaderboard } from '../engine/queries'
import type { GameAction, GameState } from '../engine/types'

/** Channel names are namespaced so a code cannot collide with another app. */
export const ROOM_PREFIX = 'business-'

export function roomFor(code: string): string {
  return ROOM_PREFIX + code.trim().toUpperCase()
}

/** Codes are typed in by hand, so accept lower case and stray spaces. */
export function normaliseCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export const CODE_LENGTH = 6

/** How long a join waits before giving up and sending the player home. */
export const JOIN_TIMEOUT_MS = 5000

/** Which device is playing which seat, so a rejoin can be matched up. */
export type SeatMap = Record<string, string>

export type NetMessage =
  /** guest -> room: I am here; `deviceId` reclaims my seat if I had one. */
  | { t: 'hello'; deviceId: string }
  /** host -> room: the whole game, addressed to one device (or everyone). */
  | { t: 'state'; forDevice: string | null; state: GameState; seats: SeatMap }
  /** guest -> room: add me to the lobby with my own name and colour. */
  | { t: 'addMe'; deviceId: string; name: string; colourId: string }
  /** guest -> room: change my own name or colour. */
  | { t: 'editMe'; deviceId: string; name?: string; colourId?: string }
  /** host -> room: this device now plays this seat. */
  | { t: 'seated'; forDevice: string; playerId: string }
  /** guest -> room: my player would like to do this. */
  | { t: 'action'; deviceId: string; action: GameAction }
  /** host -> room: refused, with a reason worth showing. */
  | { t: 'reject'; forDevice: string; reason: string }

/**
 * A stable id for this browser, kept in localStorage. It is what lets someone
 * who closed the tab or lost signal come back to the same seat with their
 * money and properties intact, rather than arriving as a brand new player.
 */
export function deviceId(): string {
  const KEY = 'business.deviceId'
  try {
    const existing = localStorage.getItem(KEY)
    if (existing) return existing
    const fresh = `d${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
    localStorage.setItem(KEY, fresh)
    return fresh
  } catch {
    // Storage blocked (private browsing): a per-session id still works, it
    // just cannot survive a reload.
    return `d${Math.random().toString(36).slice(2)}`
  }
}

/**
 * Strip the balances a device is not entitled to see.
 *
 * Every player's cash is private to the device that plays that seat. This runs
 * on the host before sending, so another player's balance never reaches the
 * wire, and again on each device before rendering (`maskCashExcept`), so the
 * host does not display what it must hold in order to run the bank.
 */
export function redactFor(state: GameState, viewerPlayerId: string | null): GameState {
  return {
    ...maskCashExcept(state, (id) => id === viewerPlayerId),
    // Ranked here, while the real balances are still available.
    leaderboardOrder: leaderboard(state).map((row) => row.player.id),
  }
}

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
 * The host is the authority, so this is the one place that decides. A phone may
 * only ever touch its own seat and its own deeds, and only the host may run the
 * game itself.
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

    // Your own deeds are yours to build on, sell and mortgage — and nobody
    // else's ever are.
    case 'MORTGAGE':
    case 'UNMORTGAGE':
    case 'SELL_BUILDING':
    case 'BUILD':
      return state.holdings[action.propertyId]?.ownerId === guestPlayerId

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

    // A card is dismissed by the player it is about, who is often NOT the
    // player whose turn it is — Party House takes money off everyone.
    case 'DISMISS_POPUP': {
      const top = state.popups[0]
      if (!top) return false
      return top.affects === null || top.affects === guestPlayerId
    }

    // Everything else is a move in the game: only on your own turn.
    default:
      return state.phase === 'playing' && state.turnOrder[state.currentIndex] === guestPlayerId
  }
}
