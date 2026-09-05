import type { GameSettings } from '../data/settings'
import type { EventCard } from '../data/unoCards'

export interface Player {
  id: string
  name: string
  colourId: string
  colourHex: string
  token: string
  cash: number
  position: number
  inJail: boolean
  /** The rolls of the current Jail escape attempt, cleared between attempts. */
  jailRolls: number[]
  /**
   * Set when a jailed player has earned their release — either by rolling 12+
   * across three rolls or by paying the fee. They stay on the Jail space for
   * the rest of that turn and walk free at the start of their NEXT turn.
   */
  jailReleasePending: boolean
  /** Eliminated players stay in the roster but take no turns. */
  isOut: boolean
  /**
   * True on a guest device for every player except its own: the cash figure
   * has been stripped before sending, not merely hidden in the UI.
   */
  cashHidden?: boolean
  /** Seat order, fixed at setup. Turns run clockwise through this. */
  seat: number
}

/**
 * A seat in the lobby, before the game starts. Guests add their own entry over
 * the network, so this has to live in shared state rather than in a component.
 * The id carries through to `Player.id`, so a phone keeps its seat when the
 * game begins.
 */
export interface LobbyEntry {
  id: string
  name: string
  colourId: string
  /** True for the seat the host device itself plays. */
  isHost: boolean
}

/** Ownership record for one country or special asset. */
export interface Holding {
  ownerId: string | null
  mortgaged: boolean
  /** 0 = site only, 1-3 = houses, 4 = hotel. Always 0 for special assets. */
  buildings: number
}

export type TurnStage =
  /** Waiting for the current player to roll the movement dice. */
  | 'awaitingRoll'
  /** Pawn is animating across the board. */
  | 'moving'
  /** Waiting for the current player to accept or decline a purchase. */
  | 'awaitingPurchase'
  /** Landed on a country they already own — offered the chance to build. */
  | 'awaitingBuild'
  /** Free action window — build, sell, mortgage, then end turn. */
  | 'awaitingEndTurn'
  /** The current player is in Jail and must pay or attempt an escape. */
  | 'inJail'

export interface PendingMove {
  from: number
  to: number
  steps: number
  /** Direct jumps (Go to Jail, Go to Party House) skip intermediate spaces. */
  teleport: boolean
}

export interface PendingPurchase {
  propertyId: string
  price: number
}

/** An offer to build on a country the player landed on and already owns. */
export interface PendingBuild {
  propertyId: string
}

/** One outstanding payment leg. `toId: null` means the Bank. */
export interface DebtPayout {
  toId: string | null
  amount: number
}

/**
 * An unpaid charge. A player carrying a debt cannot roll or end a turn until
 * they have raised the cash by mortgaging or selling buildings. Owing money is
 * not elimination — see checkElimination.
 */
export interface Debt {
  debtorId: string
  payouts: DebtPayout[]
  reason: string
}

/** Result of attempting to charge a player. */
export type ChargeResult = 'paid' | 'deferred' | 'bankrupt'

export type LogKind =
  | 'roll'
  | 'move'
  | 'money'
  | 'property'
  | 'build'
  | 'mortgage'
  | 'event'
  | 'jail'
  | 'system'

export interface LogEntry {
  id: number
  turn: number
  kind: LogKind
  text: string
}

/** One player handing money to another. */
export interface TransferLeg {
  fromId: string
  toId: string
  amount: number
}

export type PopupBody =
  | { kind: 'transfer'; title: string; note?: string; legs: TransferLeg[] }
  | { kind: 'card'; deck: 'UNO' | 'CHANCE'; card: EventCard; total: number; delta?: number }
  | { kind: 'simple'; title: string; subtitle?: string; delta?: number; icon?: string }

export interface Popup {
  id: number
  body: PopupBody
  /**
   * Whose money or turn this card is about. Only that player's device gets an
   * actionable Continue button; everyone else just reads what happened.
   */
  affects: string | null
  /** Plain sentence: "Priya lost $500 for House Repairs." */
  summary?: string
}

export interface OrderRollEntry {
  playerId: string
  dice: number[] | null
  total: number | null
}

/**
 * Optional timed mode. `endsAt` is a wall-clock deadline while the clock is
 * running; `remainingMs` holds the frozen remainder while the game is paused.
 */
export interface GameTimer {
  durationMs: number | null
  endsAt: number | null
  remainingMs: number | null
}

export interface GameState {
  /** Short shareable code identifying this game session. */
  gameCode: string
  /** Who is in the game, while `phase` is still 'setup'. */
  lobby: LobbyEntry[]
  /**
   * Set only on a guest device: the host's ranking, since a guest cannot
   * compute it without everyone's cash.
   */
  leaderboardOrder?: string[]
  phase: 'setup' | 'orderRoll' | 'playing' | 'gameOver' | 'timeUp' | 'ended'
  settings: GameSettings

  players: Player[]
  /** Player ids in turn order. Index 0 took the first turn of the game. */
  turnOrder: string[]
  currentIndex: number
  turnNumber: number

  holdings: Record<string, Holding>

  dice: number[] | null
  /** The dice total that produced the current position — UNO/Chance reuse it. */
  lastTotal: number | null

  /** Paused at the start of a turn via "Pause on Next Turn". */
  paused: boolean
  pauseRequested: boolean

  timer: GameTimer

  stage: TurnStage
  pendingMove: PendingMove | null
  pendingPurchase: PendingPurchase | null
  pendingBuild: PendingBuild | null
  /** Outstanding debts keyed by debtor id. Usually empty. */
  debts: Record<string, Debt>

  /** Order-determining roll at the start of the game. */
  orderRolls: OrderRollEntry[]
  /** Players still rolling this round — shrinks to the tied players on a tie. */
  orderContenders: string[]
  orderRollRound: number

  log: LogEntry[]
  /**
   * Popups queue rather than replace one another, so crossing START and then
   * landing on an event space shows both cards in order.
   */
  popups: Popup[]
  winnerId: string | null

  /** Monotonic counters so ids stay stable across immutable updates. */
  nextLogId: number
  nextPopupId: number
}

export type GameAction =
  | { type: 'START_GAME' }
  /** Someone takes a seat in the lobby. The id is chosen by the host. */
  | { type: 'ADD_LOBBY_PLAYER'; id: string; name: string; colourId: string; isHost?: boolean }
  | { type: 'UPDATE_LOBBY_PLAYER'; id: string; name?: string; colourId?: string }
  | { type: 'REMOVE_LOBBY_PLAYER'; id: string }
  /** Each player rolls their own opening die, from their own device. */
  | { type: 'ROLL_FOR_ORDER'; playerId: string }
  | { type: 'CONFIRM_ORDER' }
  | { type: 'ROLL_DICE' }
  | { type: 'COMPLETE_MOVE' }
  | { type: 'BUY_PROPERTY' }
  | { type: 'DECLINE_PURCHASE' }
  | { type: 'BUILD'; propertyId: string }
  /** Turn down the build offer shown after landing on your own country. */
  | { type: 'DECLINE_BUILD' }
  | { type: 'SELL_BUILDING'; propertyId: string }
  | { type: 'MORTGAGE'; propertyId: string }
  | { type: 'UNMORTGAGE'; propertyId: string }
  | { type: 'JAIL_PAY' }
  | { type: 'JAIL_ROLL' }
  | { type: 'SETTLE_DEBT' }
  | { type: 'DECLARE_BANKRUPT' }
  | { type: 'END_TURN' }
  | { type: 'DISMISS_POPUP' }
  | { type: 'UPDATE_SETTINGS'; settings: GameSettings }
  | { type: 'REQUEST_PAUSE' }
  | { type: 'CANCEL_PAUSE' }
  | { type: 'RESUME' }
  | { type: 'SET_TIMER'; durationMs: number | null }
  | { type: 'TIME_UP' }
  /** Host ends the game immediately and the results are worked out. */
  | { type: 'END_GAME' }
  /** Host removes a player mid-game; their holdings return to the Bank. */
  | { type: 'REMOVE_PLAYER'; playerId: string }
  /** From the results screen: carry on playing with the clock switched off. */
  | { type: 'RESUME_WITHOUT_TIMER' }
  | { type: 'RESET' }
  /** Wholesale replacement of the game with the host's copy. Network only. */
  | { type: 'NET_SYNC'; state: GameState }
