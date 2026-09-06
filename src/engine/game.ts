/**
 * The game reducer — the single entry point that turns an action into the next
 * state. Every rule module is called from here; none of them are called from
 * the UI directly except for read-only checks.
 */

import { BOARD, PURCHASABLE_SPACES, START_INDEX } from '../data/board'
import { PLAYER_COLOURS } from '../data/playerColours'
import { DEFAULT_SETTINGS, type GameSettings } from '../data/settings'
import { buildOneStep, sellBuilding } from './building'
import { diceTotal, rollDice } from './dice'
import { attemptJailEscape, openJailDoorIfEarned, payToEscapeJail } from './jail'
import { addLog, money, notify } from './log'
import { mortgageProperty, unmortgageProperty } from './mortgage'
import { awardStart } from './movement'
import { declareBankrupt, removePlayerFromGame, settleDebt } from './payments'
import {
  activePlayers,
  currentPlayer,
  displayNameOf,
  getPlayer,
  hasUnsettledDebt,
  leaderboard,
  maxRaisableCash,
  debtOwedBy,
} from './queries'
import { buyProperty, resolveLanding } from './spaces'
import type { GameAction, GameState, Holding } from './types'

/**
 * A short, unambiguous session code. I and O and 0 and 1 are left out so the
 * code cannot be misread when someone types it in from across the table.
 */
export function makeGameCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return code
}

export function createInitialState(settings: GameSettings = DEFAULT_SETTINGS): GameState {
  return {
    gameCode: makeGameCode(),
    lobby: [],
    phase: 'setup',
    settings,
    players: [],
    turnOrder: [],
    currentIndex: 0,
    turnNumber: 0,
    holdings: emptyHoldings(),
    dice: null,
    rollSeq: 0,
    lastTotal: null,
    paused: false,
    pauseRequested: false,
    timer: { durationMs: null, endsAt: null, remainingMs: null },
    stage: 'awaitingRoll',
    pendingMove: null,
    pendingPurchase: null,
    pendingBuild: null,
    debts: {},
    orderRolls: [],
    orderContenders: [],
    orderRollRound: 1,
    log: [],
    notices: [],
    winnerId: null,
    nextLogId: 1,
    nextNoticeId: 1,
  }
}

function emptyHoldings(): Record<string, Holding> {
  const holdings: Record<string, Holding> = {}
  for (const space of PURCHASABLE_SPACES) {
    holdings[space.propertyId!] = { ownerId: null, mortgaged: false, buildings: 0 }
  }
  return holdings
}

/** Pure reducer. Clones, mutates the clone, returns it. */
export function gameReducer(state: GameState, action: GameAction): GameState {
  // A guest device does not run the rules; it is handed the host's game whole.
  if (action.type === 'NET_SYNC') return action.state

  const next = structuredClone(state) as GameState
  apply(next, action)
  return next
}

function apply(state: GameState, action: GameAction): void {
  switch (action.type) {
    case 'START_GAME':
      return startGame(state)
    case 'ADD_LOBBY_PLAYER':
      return addLobbyPlayer(state, action.id, action.name, action.colourId, action.isHost ?? false)
    case 'UPDATE_LOBBY_PLAYER':
      return updateLobbyPlayer(state, action.id, action.name, action.colourId)
    case 'REMOVE_LOBBY_PLAYER':
      state.lobby = state.lobby.filter((e) => e.id !== action.id)
      return
    case 'ROLL_FOR_ORDER':
      return rollForOrder(state, action.playerId)
    case 'CONFIRM_ORDER':
      return confirmOrder(state)
    case 'ROLL_DICE':
      return rollMovementDice(state)
    case 'STEP_MOVE':
      return stepMove(state)
    case 'COMPLETE_MOVE':
      return completeMove(state)
    case 'BUY_PROPERTY':
      return acceptPurchase(state)
    case 'DECLINE_PURCHASE':
      return declinePurchase(state)
    case 'BUILD':
      return buildAction(state, action.propertyId)
    case 'DECLINE_BUILD':
      return declineBuild(state)
    case 'SELL_BUILDING':
      sellBuilding(state, currentPlayer(state).id, action.propertyId)
      return autoSettle(state, currentPlayer(state).id)
    case 'MORTGAGE':
      mortgageProperty(state, currentPlayer(state).id, action.propertyId)
      return autoSettle(state, currentPlayer(state).id)
    case 'UNMORTGAGE':
      unmortgageProperty(state, currentPlayer(state).id, action.propertyId)
      return autoSettle(state, currentPlayer(state).id)
    case 'JAIL_PAY':
      if (state.stage !== 'inJail') return
      if (payToEscapeJail(state, currentPlayer(state).id)) state.stage = 'awaitingEndTurn'
      return
    case 'JAIL_ROLL':
      return jailEscapeAttempt(state)
    case 'SETTLE_DEBT':
      return settleCurrentDebt(state)
    case 'DECLARE_BANKRUPT':
      declareBankrupt(state, currentPlayer(state).id)
      checkGameOver(state)
      if (state.phase === 'playing') endTurn(state)
      return
    case 'END_TURN':
      return endTurn(state)
    case 'UPDATE_SETTINGS':
      state.settings = action.settings
      addLog(state, 'system', 'House rules updated.')
      return
    case 'REQUEST_PAUSE':
      state.pauseRequested = true
      addLog(state, 'system', 'The game will pause at the start of the next turn.')
      return
    case 'CANCEL_PAUSE':
      state.pauseRequested = false
      addLog(state, 'system', 'Pause cancelled.')
      return
    case 'RESUME':
      return resume(state)
    case 'SET_TIMER':
      return setTimer(state, action.durationMs)
    case 'END_GAME':
      return endGameNow(state)
    case 'REMOVE_PLAYER':
      return removePlayer(state, action.playerId)
    case 'LEAVE_GAME':
      return leaveGame(state, action.playerId)
    case 'TIME_UP':
      return timeUp(state)
    case 'RESUME_WITHOUT_TIMER':
      if (state.phase !== 'timeUp') return
      state.phase = 'playing'
      state.timer = { durationMs: null, endsAt: null, remainingMs: null }
      addLog(state, 'system', 'Time was up — the game resumed with the clock switched off.')
      return
    case 'RESET':
      Object.assign(state, createInitialState(state.settings))
      return
    case 'NET_SYNC':
      return // handled before the clone, in gameReducer
  }
}

// ---------------------------------------------------------------------------
// PAUSE  &  TIMER
// ---------------------------------------------------------------------------

function resume(state: GameState): void {
  if (!state.paused) return
  state.paused = false
  // Restart the clock from where it stopped.
  if (state.timer.remainingMs !== null) {
    state.timer.endsAt = Date.now() + state.timer.remainingMs
    state.timer.remainingMs = null
  }
  addLog(state, 'system', 'Game resumed.')
}

function pauseNow(state: GameState): void {
  state.paused = true
  state.pauseRequested = false
  // Freeze the clock so paused time is not counted.
  if (state.timer.endsAt !== null) {
    state.timer.remainingMs = Math.max(0, state.timer.endsAt - Date.now())
    state.timer.endsAt = null
  }
  addLog(state, 'system', 'Game paused.')
}

function setTimer(state: GameState, durationMs: number | null): void {
  if (durationMs === null) {
    state.timer = { durationMs: null, endsAt: null, remainingMs: null }
    addLog(state, 'system', 'Game timer switched off.')
    return
  }
  state.timer = {
    durationMs,
    endsAt: state.paused ? null : Date.now() + durationMs,
    remainingMs: state.paused ? durationMs : null,
  }
  addLog(state, 'system', `Game timer set to ${Math.round(durationMs / 60000)} minutes.`)
}

function timeUp(state: GameState): void {
  if (state.phase !== 'playing') return
  state.phase = 'timeUp'
  state.timer.endsAt = null
  state.timer.remainingMs = 0
  state.notices = []

  // The winner on time is the player with the greatest total wealth.
  const ranked = leaderboard(state)
  state.winnerId = ranked[0]?.player.id ?? null
  addLog(
    state,
    'system',
    state.winnerId
      ? `Time is up. ${getPlayer(state, state.winnerId).name} leads on total wealth.`
      : 'Time is up.',
  )
}

/** Host ends the game on the spot; standings decide the winner. */
function endGameNow(state: GameState): void {
  if (state.phase !== 'playing') return
  state.phase = 'ended'
  state.timer.endsAt = null
  state.notices = []

  const ranked = leaderboard(state)
  state.winnerId = ranked[0]?.player.id ?? null
  addLog(
    state,
    'system',
    state.winnerId
      ? `Game ended by the host. ${getPlayer(state, state.winnerId).name} leads on total wealth.`
      : 'Game ended by the host.',
  )
}

/** Host drops a player. Play carries on without them. */
/**
 * A player leaves of their own accord.
 *
 * The same thing happens to their money and deeds as when the host removes
 * them — the rules already say where those go — and the game carries on for
 * everybody else. Announced, so nobody is left wondering where they went.
 */
function leaveGame(state: GameState, playerId: string): void {
  const target = state.players.find((p) => p.id === playerId)
  if (!target || target.isOut) return
  if (state.phase === 'setup') {
    state.lobby = state.lobby.filter((e) => e.id !== playerId)
    return
  }
  notify(state, playerId, `${target.name} left the game`)
  removePlayer(state, playerId)
}

function removePlayer(state: GameState, playerId: string): void {
  if (state.phase !== 'playing') return
  const target = state.players.find((p) => p.id === playerId)
  if (!target || target.isOut) return

  const wasTheirTurn = state.turnOrder[state.currentIndex] === playerId
  removePlayerFromGame(state, playerId)

  checkGameOver(state)
  if (state.phase === 'playing' && wasTheirTurn) advanceToNextPlayer(state)
}

// ---------------------------------------------------------------------------
// SETUP  &  TURN ORDER
// ---------------------------------------------------------------------------

/**
 * The lobby fills up before the game starts. On a multi-device game each
 * phone adds its own seat over the network, so this has to be shared state.
 */
function addLobbyPlayer(
  state: GameState,
  id: string,
  name: string,
  colourId: string,
  isHost: boolean,
): void {
  if (state.phase !== 'setup') return
  if (state.lobby.length >= state.settings.maxPlayers) return
  if (state.lobby.some((e) => e.id === id)) return

  state.lobby.push({
    id,
    name: name.trim() || `Player ${state.lobby.length + 1}`,
    colourId: freeColourId(state, colourId),
    isHost,
  })
}

function updateLobbyPlayer(
  state: GameState,
  id: string,
  name?: string,
  colourId?: string,
): void {
  if (state.phase !== 'setup') return
  const entry = state.lobby.find((e) => e.id === id)
  if (!entry) return
  if (name !== undefined) entry.name = name
  if (colourId !== undefined) entry.colourId = freeColourId(state, colourId, id)
}

/** Two players may not share a colour, so fall back to the next free one. */
function freeColourId(state: GameState, wanted: string, exceptId?: string): string {
  const taken = new Set(
    state.lobby.filter((e) => e.id !== exceptId).map((e) => e.colourId),
  )
  if (!taken.has(wanted)) return wanted
  return PLAYER_COLOURS.find((c) => !taken.has(c.id))?.id ?? wanted
}

/** True once there are enough players and every one of them has a name. */
export function lobbyReady(state: GameState): boolean {
  return (
    state.lobby.length >= state.settings.minPlayers &&
    state.lobby.length <= state.settings.maxPlayers
  )
}

function startGame(state: GameState): void {
  const { minPlayers, maxPlayers, startingCash } = state.settings
  if (state.lobby.length < minPlayers || state.lobby.length > maxPlayers) return

  state.players = state.lobby.map((entry, seat) => {
    const colour = PLAYER_COLOURS.find((c) => c.id === entry.colourId) ?? PLAYER_COLOURS[seat]
    return {
      // The lobby id carries through, so a phone keeps the seat it took.
      id: entry.id,
      name: entry.name.trim() || `Player ${seat + 1}`,
      colourId: colour.id,
      colourHex: colour.hex,
      token: colour.token,
      cash: startingCash,
      position: 0,
      inJail: false,
      jailRolls: [],
      jailReleasePending: false,
      isOut: false,
      seat,
    }
  })

  state.holdings = emptyHoldings()
  state.phase = 'orderRoll'
  state.orderContenders = state.players.map((p) => p.id)
  state.orderRolls = state.players.map((p) => ({ playerId: p.id, dice: null, total: null }))
  state.orderRollRound = 1
  state.turnNumber = 0

  addLog(
    state,
    'system',
    `Game started with ${state.players.length} players, ${money(startingCash)} each. Everyone rolls once — highest total goes first.`,
  )
}

/**
 * Whose turn it is to take the opening roll, or null when everyone still in
 * the roll-off has rolled.
 *
 * The roll-off is strictly one at a time, in seating order: Player 1, then 2,
 * then 3, and so on. Only this player is offered a Roll button, on their own
 * device, so two phones can never roll at the same moment. On a tie the tied
 * players roll again in the same order.
 */
export function orderRollTurn(state: GameState): string | null {
  if (state.phase !== 'orderRoll') return null
  const seated = [...state.players].sort((a, b) => a.seat - b.seat)
  for (const player of seated) {
    if (!state.orderContenders.includes(player.id)) continue
    const entry = state.orderRolls.find((e) => e.playerId === player.id)
    if (entry && entry.dice === null) return player.id
  }
  return null
}

/** One named player takes their own opening roll, from their own device. */
function rollForOrder(state: GameState, playerId: string): void {
  if (state.phase !== 'orderRoll') return
  // Rolling out of order is refused outright, not merely hidden in the UI.
  if (orderRollTurn(state) !== playerId) return
  const pending = state.orderRolls.find(
    (entry) =>
      entry.playerId === playerId &&
      entry.dice === null &&
      state.orderContenders.includes(entry.playerId),
  )
  if (!pending) return

  const { count, faces } = state.settings.dice
  const dice = rollDice(count, faces)
  pending.dice = dice
  pending.total = diceTotal(dice)
  state.dice = dice
  state.rollSeq += 1

  addLog(
    state,
    'roll',
    `${getPlayer(state, pending.playerId).name} rolled ${describeRoll(dice)} for turn order.`,
  )

  const allRolled = state.orderContenders.every(
    (id) => state.orderRolls.find((e) => e.playerId === id)?.dice !== null,
  )
  if (!allRolled) return

  const contenderRolls = state.orderRolls.filter((e) => state.orderContenders.includes(e.playerId))
  const best = Math.max(...contenderRolls.map((e) => e.total ?? 0))
  const tied = contenderRolls.filter((e) => e.total === best)

  if (tied.length > 1) {
    // Re-roll among the tied players only.
    state.orderContenders = tied.map((e) => e.playerId)
    state.orderRollRound += 1
    for (const entry of state.orderRolls) {
      if (state.orderContenders.includes(entry.playerId)) {
        entry.dice = null
        entry.total = null
      }
    }
    addLog(
      state,
      'system',
      `Tie on ${best} between ${tied.map((e) => getPlayer(state, e.playerId).name).join(' and ')} — they roll again.`,
    )
  }
}

/** True once a single starting player has been determined. */
export function orderRollComplete(state: GameState): boolean {
  if (state.phase !== 'orderRoll') return false
  const contenderRolls = state.orderRolls.filter((e) => state.orderContenders.includes(e.playerId))
  if (contenderRolls.some((e) => e.dice === null)) return false
  const best = Math.max(...contenderRolls.map((e) => e.total ?? 0))
  return contenderRolls.filter((e) => e.total === best).length === 1
}

function confirmOrder(state: GameState): void {
  if (!orderRollComplete(state)) return

  const contenderRolls = state.orderRolls.filter((e) => state.orderContenders.includes(e.playerId))
  const best = Math.max(...contenderRolls.map((e) => e.total ?? 0))
  const starterId = contenderRolls.find((e) => e.total === best)!.playerId

  // Turns run clockwise from the starter, keeping the seating order.
  const seats = [...state.players].sort((a, b) => a.seat - b.seat).map((p) => p.id)
  const startAt = seats.indexOf(starterId)
  state.turnOrder = [...seats.slice(startAt), ...seats.slice(0, startAt)]

  state.phase = 'playing'
  state.currentIndex = 0
  state.turnNumber = 1
  state.stage = 'awaitingRoll'
  // The opening rolls stay visible going into the first turn.

  addLog(
    state,
    'system',
    `${getPlayer(state, starterId).name} starts. Turn order: ${state.turnOrder
      .map((id) => getPlayer(state, id).name)
      .join(' → ')}.`,
  )
}

// ---------------------------------------------------------------------------
// NORMAL TURN
// ---------------------------------------------------------------------------

function rollMovementDice(state: GameState): void {
  if (state.phase !== 'playing' || state.stage !== 'awaitingRoll' || state.paused) return
  const player = currentPlayer(state)
  if (hasUnsettledDebt(state, player.id)) return

  const { count, faces } = state.settings.dice
  const dice = rollDice(count, faces)
  const total = diceTotal(dice)

  state.dice = dice
  state.rollSeq += 1
  state.lastTotal = total
  state.pendingMove = {
    from: player.position,
    to: (player.position + total) % BOARD.length,
    steps: total,
    taken: 0,
    teleport: false,
  }
  state.stage = 'moving'

  addLog(state, 'roll', `${player.name} rolled ${describeRoll(dice)}.`)
}

function describeRoll(dice: number[]): string {
  const total = diceTotal(dice)
  return dice.length === 1 ? `${total}` : `${dice.join(' + ')} = ${total}`
}

/** Called once the pawn animation has finished. */
/**
 * Walk the token exactly one space.
 *
 * Movement is part of the game state, not an animation each device invents for
 * itself. The host repeats this once per `moveStepMs` until the whole roll has
 * been walked, and every step goes out to every device, so nobody skips a
 * space, nobody teleports, and a device that reconnects mid-move picks the
 * walk up exactly where it is.
 */
function stepMove(state: GameState): void {
  if (state.phase !== 'playing' || state.stage !== 'moving' || !state.pendingMove) return
  const move = state.pendingMove
  if (move.taken >= move.steps) return completeMove(state)

  const player = currentPlayer(state)
  player.position = (player.position + 1) % BOARD.length
  move.taken += 1

  // Landing on START or passing over it pays the round bonus, once, on the
  // step that actually reaches it.
  if (player.position === START_INDEX) awardStart(state, player.id)

  if (move.taken >= move.steps) completeMove(state)
}

/**
 * Finish the move and resolve whatever the token is standing on.
 *
 * Any steps still owed are walked first. Normally there are none — the host
 * has stepped the whole way — but this makes the action safe to send at any
 * point, so a move can never end with the token short of where the dice said.
 */
function completeMove(state: GameState): void {
  if (state.stage !== 'moving' || !state.pendingMove) return
  const player = currentPlayer(state)
  const move = state.pendingMove

  while (move.taken < move.steps) {
    player.position = (player.position + 1) % BOARD.length
    move.taken += 1
    if (player.position === START_INDEX) awardStart(state, player.id)
  }

  state.pendingMove = null
  resolveLanding(state, player.id, state.lastTotal)

  // Every unowned space a player can afford is offered. One they cannot is
  // not — there is no decision to make, so the turn simply carries on.
  state.stage = state.pendingPurchase
    ? 'awaitingPurchase'
    : state.pendingBuild
      ? 'awaitingBuild'
      : 'awaitingEndTurn'

  checkGameOver(state)
}

function acceptPurchase(state: GameState): void {
  if (state.stage !== 'awaitingPurchase' || !state.pendingPurchase) return
  const player = currentPlayer(state)
  buyProperty(state, player.id, state.pendingPurchase.propertyId)
  state.pendingPurchase = null
  state.stage = 'awaitingEndTurn'
}

/**
 * Building. Called both from the offer shown on landing and from the
 * Build / Sell / Mortgage panel. Taking the offer ends the turn.
 */
function buildAction(state: GameState, propertyId: string): void {
  const playerId = currentPlayer(state).id
  const fromLandingOffer = state.pendingBuild?.propertyId === propertyId

  if (!buildOneStep(state, playerId, propertyId)) return

  if (fromLandingOffer) {
    state.pendingBuild = null
    state.stage = 'awaitingEndTurn'
  }
  autoSettle(state, playerId)
}

function declineBuild(state: GameState): void {
  if (state.stage !== 'awaitingBuild' || !state.pendingBuild) return
  addLog(
    state,
    'build',
    `${currentPlayer(state).name} chose not to build on ${displayNameOf(state.pendingBuild.propertyId)}.`,
  )
  state.pendingBuild = null
  state.stage = 'awaitingEndTurn'
}

function declinePurchase(state: GameState): void {
  if (state.stage !== 'awaitingPurchase' || !state.pendingPurchase) return
  const { propertyId } = state.pendingPurchase
  addLog(
    state,
    'property',
    `${currentPlayer(state).name} declined ${displayNameOf(propertyId)} — it stays with the Bank.`,
  )
  state.pendingPurchase = null
  state.stage = 'awaitingEndTurn'
}

/**
 * One roll of a Jail escape attempt. The turn only ends once the attempt is
 * over — either the total reached 12, or all three rolls have been used — so
 * the player presses Roll up to three times and watches the total build.
 */
function jailEscapeAttempt(state: GameState): void {
  if (state.stage !== 'inJail') return
  const attempt = attemptJailEscape(state, currentPlayer(state).id)
  if (attempt.finished) state.stage = 'awaitingEndTurn'
}

function endTurn(state: GameState): void {
  if (state.phase !== 'playing') return
  const player = currentPlayer(state)
  if (hasUnsettledDebt(state, player.id)) return
  if (
    state.stage === 'moving' ||
    state.stage === 'awaitingPurchase' ||
    state.stage === 'awaitingBuild'
  ) {
    return
  }

  checkGameOver(state)
  if (state.phase !== 'playing') return

  advanceToNextPlayer(state)
}

function advanceToNextPlayer(state: GameState): void {
  const order = state.turnOrder
  for (let step = 1; step <= order.length; step++) {
    const index = (state.currentIndex + step) % order.length
    const candidate = getPlayer(state, order[index])
    if (candidate.isOut) continue

    state.currentIndex = index
    state.turnNumber += 1
    // The rolled number stays on the table until the next roll. Clearing it
    // dropped the die back to a blank 1, which looks like a stuck die.
    state.pendingMove = null
    state.pendingPurchase = null
    state.pendingBuild = null
    // A player who earned their release last turn walks free now. Anybody
    // still in gets a clean sheet of three rolls for this turn.
    openJailDoorIfEarned(state, candidate.id)
    if (candidate.inJail) candidate.jailRolls = []
    state.stage = candidate.inJail ? 'inJail' : 'awaitingRoll'

    // "Pause on Next Turn" takes effect here, before the new player acts.
    if (state.pauseRequested) pauseNow(state)

    if (hasUnsettledDebt(state, candidate.id)) {
      addLog(
        state,
        'money',
        `${candidate.name} starts the turn owing ${money(debtOwedBy(state, candidate.id))} and must raise it before rolling.`,
      )
    }
    return
  }
}

// ---------------------------------------------------------------------------
// DEBT
// ---------------------------------------------------------------------------

function settleCurrentDebt(state: GameState): void {
  const player = currentPlayer(state)
  if (!settleDebt(state, player.id)) {
    // Still short. If nothing is left to liquidate, the player is finished.
    const owed = debtOwedBy(state, player.id)
    if (maxRaisableCash(state, player.id) < owed) {
      declareBankrupt(state, player.id)
      checkGameOver(state)
      if (state.phase === 'playing') advanceToNextPlayer(state)
    }
  }
}

/** After any fundraising action, clear the debt automatically if it can be. */
function autoSettle(state: GameState, playerId: string): void {
  if (hasUnsettledDebt(state, playerId)) settleDebt(state, playerId)
}

// ---------------------------------------------------------------------------
// WIN CONDITION
// ---------------------------------------------------------------------------

function checkGameOver(state: GameState): void {
  if (state.phase !== 'playing') return
  const remaining = activePlayers(state)
  if (remaining.length > 1) return

  state.phase = 'gameOver'
  state.winnerId = remaining[0]?.id ?? null
  state.stage = 'awaitingEndTurn'

  if (state.winnerId) {
    const winner = getPlayer(state, state.winnerId)
    addLog(state, 'system', `${winner.name} wins the game!`)
    notify(state, state.winnerId, `${winner.name} wins the game`, 'good')
  }
}
