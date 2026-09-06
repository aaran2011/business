import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BOARD } from './data/board'
import { COUNTRIES } from './data/properties'
import { ActionBar } from './components/ActionBar'
import { Board } from './components/Board'
import { BuildOffer } from './components/BuildOffer'
import { BuildWarning } from './components/BuildWarning'
import { JailDice } from './components/Dice'
import { NoticeStack } from './components/NoticeStack'
import { HouseRulesModal } from './components/HouseRulesModal'
import { Leaderboard } from './components/Leaderboard'
import { ManageModal } from './components/ManageModal'
import { OrderRollScreen } from './components/OrderRollScreen'
import { PropertyCard } from './components/PropertyCard'
import { RemovePlayerModal } from './components/RemovePlayerModal'
import { ResultsScreen } from './components/ResultsScreen'
import { SetupScreen } from './components/SetupScreen'
import { PauseOverlay, TimerModal } from './components/TimerModal'
import { JoinPanel } from './components/JoinPanel'
import { useSession } from './net/useSession'
import { play, startAudio } from './audio/sound'
import { GameCodeModal } from './components/GameCodeModal'
import { LeaveConfirm } from './components/LeaveConfirm'
import { maskCashExcept } from './net/protocol'
import { money } from './engine/log'
import { debtOwedBy, displayNameOf, hasCompleteColourGroup } from './engine/queries'
import type { GameAction, GameState } from './engine/types'

type Dispatch = (action: GameAction) => void

export default function App() {
  const session = useSession()
  const { state } = session
  const dispatch = session.dispatch
  const [showJoin, setShowJoin] = useState(false)

  /**
   * A window on the live game, for development only. Testing multiplayer means
   * being able to ask a device what it actually believes, rather than guessing
   * from the pixels. Compiled out of the built game.
   */
  if (import.meta.env.DEV) {
    ;(window as unknown as { businessState?: unknown }).businessState = {
      role: session.role,
      myPlayerId: session.myPlayerId,
      notices: state.notices,
      phase: state.phase,
      stage: state.stage,
      current: state.turnOrder[state.currentIndex],
    }
  }

  /**
   * Somebody who has left should land on the start screen, not back on the
   * "put in a code" panel they last used. Leaving is a way out, not a loop.
   */
  useEffect(() => {
    if (session.role === 'solo' && session.status === 'idle') setShowJoin(false)
  }, [session.role, session.status])
  /** A guest shows the host's game; the host alone drives the turn machinery. */
  const isGuest = session.role === 'guest'
  const isGuestRef = useRef(isGuest)
  isGuestRef.current = isGuest

  const [showManage, setShowManage] = useState(false)
  const [showHouseRules, setShowHouseRules] = useState(false)
  const [showTimer, setShowTimer] = useState(false)
  const [showRemove, setShowRemove] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [remainingMs, setRemainingMs] = useState<number | null>(null)

  /**
   * The die spins because a throw HAPPENED, not because something was tapped.
   *
   * `rollSeq` only moves when the rules accept a roll, so a refused tap — one
   * sent while the token is still walking, say — spins nothing and changes no
   * number. That is what used to make the same face appear over and over: the
   * roll was refused, the old face stayed on the table, and the animation ran
   * anyway, so it looked like the die kept landing on 4.
   */
  const [rolling, setRolling] = useState(false)
  const rollSeq = state.rollSeq
  useEffect(() => {
    if (rollSeq === 0) return
    setRolling(true)
    play('dice')
    const timer = window.setTimeout(() => setRolling(false), state.settings.dice.rollAnimationMs)
    return () => window.clearTimeout(timer)
  }, [rollSeq, state.settings.dice.rollAnimationMs])

  /** Any tap that matters also wakes the audio, which browsers gate on input. */
  const act = useCallback<Dispatch>(
    (action) => {
      startAudio()
      dispatch(action)
    },
    [dispatch],
  )

  /**
   * The token walks, one space at a time, and the HOST does the walking.
   *
   * Each step is a change to the shared game state, so every device sees the
   * same token cross the same spaces in the same order — nobody teleports and
   * nobody loses a step to a dropped message. The first step waits for the die
   * to finish spinning, so the number is on the table before the token leaves.
   */
  useEffect(() => {
    if (isGuest) return
    if (state.phase !== 'playing' || state.stage !== 'moving' || !state.pendingMove) return
    if (state.paused) return
    const first = state.pendingMove.taken === 0
    const delay = first ? state.settings.dice.rollAnimationMs : state.settings.moveStepMs
    const timer = window.setTimeout(() => dispatch({ type: 'STEP_MOVE' }), delay)
    return () => window.clearTimeout(timer)
  }, [
    isGuest,
    state.phase,
    state.stage,
    state.paused,
    state.pendingMove?.taken,
    state.pendingMove?.steps,
    state.turnNumber,
    state.settings.moveStepMs,
    state.settings.dice.rollAnimationMs,
  ])

  /** A quiet tick as the token passes each space, on every device. */
  const stepsTaken = state.pendingMove?.taken ?? 0
  useEffect(() => {
    if (stepsTaken > 0) play('step')
  }, [stepsTaken])

  /**
   * The turn ends by itself. Once the player has resolved everything in front
   * of them — no popup, no purchase decision, no open dialog, no debt — play
   * moves on without an End Turn button.
   */
  const dialogOpen = showManage || showHouseRules || showTimer || showRemove
  const currentId = state.turnOrder[state.currentIndex]
  const blockedByDebt = currentId ? debtOwedBy(state, currentId) > 0 : false

  useEffect(() => {
    if (!state.settings.turn.autoEnd || isGuest) return
    if (state.phase !== 'playing' || state.paused) return
    if (state.stage !== 'awaitingEndTurn') return
    if (dialogOpen || blockedByDebt) return

    // Long enough that the line about what just happened is readable before
    // the next player is up, short enough not to feel like a wait.
    const timer = window.setTimeout(
      () => dispatch({ type: 'END_TURN' }),
      state.settings.turn.autoEndDelayMs,
    )
    return () => window.clearTimeout(timer)
  }, [
    state.phase,
    state.stage,
    state.paused,
    state.turnNumber,
    state.settings.turn.autoEnd,
    state.settings.turn.autoEndDelayMs,
    dialogOpen,
    blockedByDebt,
    isGuest,
  ])

  // Game timer countdown.
  useEffect(() => {
    const { endsAt, remainingMs: frozen } = state.timer
    if (endsAt === null) {
      setRemainingMs(frozen)
      return
    }
    const tick = () => {
      const left = endsAt - Date.now()
      setRemainingMs(Math.max(0, left))
      if (left <= 0 && !isGuestRef.current) dispatch({ type: 'TIME_UP' })
    }
    tick()
    const timer = window.setInterval(tick, 250)
    return () => window.clearInterval(timer)
  }, [state.timer, state.phase])

  /**
   * What this device is allowed to SHOW. Balances belong to whoever is playing
   * that seat, so every other player's cash is masked — on the host too. The
   * real state is still what the rules run on; this is only what is rendered.
   * At the end of the game everything is revealed for the final standings.
   */
  const finished =
    state.phase === 'timeUp' || state.phase === 'gameOver' || state.phase === 'ended'
  const viewState = useMemo(
    () => (finished ? state : maskCashExcept(state, session.controlsPlayer)),
    [state, session.controlsPlayer, finished],
  )

  // A guest stays on the join screen until they have actually taken a seat —
  // including after the host starts, since the seats only exist from then on.
  const seatedGuest = isGuest && session.myPlayerId !== null

  /**
   * Connected, but the game began before this device took a seat. There is
   * nothing for them to play, so say so plainly rather than leaving them
   * watching a board they can never touch.
   */
  if (isGuest && !seatedGuest && state.phase !== 'setup') {
    return (
      <div className="setup-shell">
        <div className="setup-hero">
          <h1>Game already started</h1>
          <p>This game began before you took a seat, so there is no player for you.</p>
        </div>
        <div className="panel">
          <div className="panel-body" style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                session.leave()
                setShowJoin(false)
              }}
            >
              Back to the start
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (showJoin && !seatedGuest) {
    return <JoinPanel session={{ ...session, dispatch: act }} onBack={() => setShowJoin(false)} />
  }
  if (state.phase === 'setup') {
    return (
      <SetupScreen
        session={{ ...session, dispatch: act }}
        onJoinInstead={() => setShowJoin(true)}
      />
    )
  }
  if (state.phase === 'orderRoll') {
    return (
      <OrderRollScreen
        state={viewState}
        dispatch={act}
        rolling={rolling}
        rollId={rollSeq}
        controlsPlayer={session.controlsPlayer}
        isHost={session.isHost}
      />
    )
  }
  if (state.phase === 'timeUp' || state.phase === 'gameOver' || state.phase === 'ended') {
    return <ResultsScreen state={viewState} dispatch={act} />
  }

  return (
    <PlayingView
      state={viewState}
      dispatch={act}
      canAct={session.controlsPlayer(state.turnOrder[state.currentIndex])}
      isHost={session.isHost}
      controlsPlayer={session.controlsPlayer}
      session={session}
      showCode={showCode}
      setShowCode={setShowCode}
      confirmLeave={confirmLeave}
      setConfirmLeave={setConfirmLeave}
      reconnecting={session.reconnecting}
      seatName={state.players.find((p) => p.id === session.myPlayerId)?.name ?? null}
      rolling={rolling}
      rollId={rollSeq}
      remainingMs={remainingMs}
      showManage={showManage}
      setShowManage={setShowManage}
      showHouseRules={showHouseRules}
      setShowHouseRules={setShowHouseRules}
      showTimer={showTimer}
      setShowTimer={setShowTimer}
      showRemove={showRemove}
      setShowRemove={setShowRemove}
    />
  )
}

interface PlayingViewProps {
  state: GameState
  dispatch: Dispatch
  /** False on a phone whose player is not the one to move. */
  canAct: boolean
  /** Only the device running the game gets the host controls. */
  isHost: boolean
  /** Whether this device plays a given seat — decides who sees a notice. */
  controlsPlayer: (playerId: string) => boolean
  /** True while this device is quietly getting back into the game. */
  reconnecting: boolean
  session: ReturnType<typeof useSession>
  showCode: boolean
  setShowCode: (v: boolean) => void
  confirmLeave: boolean
  setConfirmLeave: (v: boolean) => void
  /** The seat this phone is playing, when it joined with a code. */
  seatName: string | null
  rolling: boolean
  rollId: number
  remainingMs: number | null
  showManage: boolean
  setShowManage: (v: boolean) => void
  showHouseRules: boolean
  setShowHouseRules: (v: boolean) => void
  showTimer: boolean
  setShowTimer: (v: boolean) => void
  showRemove: boolean
  setShowRemove: (v: boolean) => void
}

function PlayingView({
  state,
  dispatch,
  canAct,
  isHost,
  controlsPlayer,
  session,
  showCode,
  setShowCode,
  confirmLeave,
  setConfirmLeave,
  reconnecting,
  seatName,
  rolling,
  rollId,
  remainingMs,
  showManage,
  setShowManage,
  showHouseRules,
  setShowHouseRules,
  showTimer,
  setShowTimer,
  showRemove,
  setShowRemove,
}: PlayingViewProps) {
  const player = state.players.find((p) => p.id === state.turnOrder[state.currentIndex])!
  const owed = debtOwedBy(state, player.id)
  const space = BOARD[player.position]

  const centreStatus = useMemo(() => {
    if (state.paused) return 'Paused.'
    if (state.stage === 'moving') return 'Moving…'
    if (state.stage === 'inJail') return `${player.name} is in Jail.`
    if (!canAct) {
      // Say what they are actually doing, so nobody is left watching a frozen
      // board wondering whether the game has hung.
      if (state.stage === 'awaitingPurchase') return `${player.name} is deciding…`
      if (state.stage === 'awaitingBuild') return `${player.name} is deciding whether to build…`
      return `${player.name} is playing.`
    }
    if (state.stage === 'awaitingPurchase' && state.pendingPurchase) {
      return `${displayNameOf(state.pendingPurchase.propertyId)} — ${money(
        state.pendingPurchase.price,
      )} — unowned.`
    }
    if (state.stage === 'awaitingBuild' && state.pendingBuild) {
      return `${displayNameOf(state.pendingBuild.propertyId)} is yours.`
    }
    return `${player.name} is on ${space.label}.`
  }, [state, player, space, canAct])

  // The property card shown after landing, or when a space is clicked.
  const buildOffer = state.stage === 'awaitingBuild' && canAct ? state.pendingBuild : null
  // Only the device that has to answer sees the decision card pop up. Everyone
  // else can still tap a space to read it, but is not asked to choose.
  const offeredToMe = canAct ? state.pendingPurchase : null
  // Cards open because the game says so — landing on a space — and never
  // because somebody tapped the board.
  const cardId = offeredToMe?.propertyId ?? buildOffer?.propertyId ?? null

  /**
   * Building on a completed colour group costs that card its doubled site
   * rent, so the player is warned and asked before any money moves. Every
   * route to building goes through here.
   */
  const [confirmBuild, setConfirmBuild] = useState<string | null>(null)
  const requestBuild = (propertyId: string) => {
    const country = COUNTRIES[propertyId]
    const complete =
      country && hasCompleteColourGroup(state, player.id, country.colour)
    if (complete) setConfirmBuild(propertyId)
    else dispatch({ type: 'BUILD', propertyId })
  }
  const lowTime = remainingMs !== null && remainingMs <= 60000

  return (
    <div className="app">
      {/*
        The header carries what each person is actually allowed to do. The host
        runs the game, so the host sets the clock, hands out the code and edits
        the rules; everybody else gets the clock, the rules to read, and the
        door. Nobody is shown a control that would do nothing.
      */}
      <header className="topbar">
        <button className="btn btn-sm" onClick={() => setShowTimer(true)}>
          {'\u{23F1}\u{FE0F}'} Timer
        </button>
        {isHost && session.role !== 'solo' && (
          <button className="btn btn-sm" onClick={() => setShowCode(true)}>
            Get Code
          </button>
        )}
        {remainingMs !== null && (
          <span className={`clock${lowTime ? ' is-low' : ''}`}>{formatClock(remainingMs)}</span>
        )}
        {/* Says what is happening instead of throwing anybody out of the game. */}
        {reconnecting && <span className="reconnecting">Reconnecting…</span>}
        <div className="topbar-spacer" />
        <button className="btn btn-sm btn-ghost" onClick={() => setShowHouseRules(true)}>
          House Rules
        </button>
        {session.role !== 'solo' && (
          <button className="btn btn-sm btn-ghost" onClick={() => setConfirmLeave(true)}>
            Leave
          </button>
        )}
      </header>

      {/* Short lines about what others have done. Nothing to dismiss. */}
      <NoticeStack notices={state.notices} controlsPlayer={controlsPlayer} />

      {owed > 0 && (
        <div className="debt-banner">
          <span style={{ fontSize: 22 }}>{'\u{26A0}\u{FE0F}'}</span>
          <div>
            <strong>
              {player.name} owes {money(owed)}
            </strong>
            <div style={{ marginTop: 2 }}>
              {state.debts[player.id]?.reason}. Mortgage holdings or sell buildings to raise the
              cash, then press Pay. Running out of cash is not elimination.
            </div>
          </div>
          <button
            className="btn btn-sm"
            style={{ marginLeft: 'auto' }}
            onClick={() => setShowManage(true)}
          >
            Raise funds
          </button>
        </div>
      )}

      <div className="main">
        <Board
          state={state}
          rolling={rolling}
          rollId={rollId}
          centreStatus={centreStatus}
          onRoll={() => dispatch({ type: 'ROLL_DICE' })}
          canRoll={state.stage === 'awaitingRoll' && owed === 0 && !state.paused && canAct}
          rollPrompt={
            !canAct
              ? `${player.name}'s turn${seatName ? ` — you are ${seatName}` : ''}`
              : state.stage === 'awaitingRoll' && owed === 0 && !state.paused
                ? `${player.name} — tap the die to roll`
                : ''
          }
          dieColour={player.colourHex}
          centreCard={
            /*
              One slot in the middle of the board. Jail first, then whatever
              property the player has been asked about.

              This is INFORMATION. The buttons all live in the bar at the
              bottom of the screen, in one place, so nothing is offered twice.
            */
            state.stage === 'inJail' && !state.paused ? (
              <div className="centre-card jail-card">
                <div className="centre-card-head">
                  <span>{'\u{1F46E}'} Jail</span>
                </div>
                <div className="centre-card-body">
                  <div className="jail-who">
                    <span className="player-token" style={{ background: player.colourHex }}>
                      {player.name.charAt(0).toUpperCase()}
                    </span>
                    <strong>{player.name} is in Jail</strong>
                  </div>
                  <p className="jail-explain">
                    {canAct ? 'You are' : 'They are'} locked up and cannot move. Pay{' '}
                    {money(state.settings.jail.payToEscape)}, or roll one die up to{' '}
                    {state.settings.jail.escapeDieRolls} times and total{' '}
                    {state.settings.jail.escapeTargetTotal} or more. Either way the release lands
                    on {canAct ? 'your' : 'their'} next turn.
                  </p>
                  <JailDice
                    rolls={player.jailRolls}
                    slots={state.settings.jail.escapeDieRolls}
                    target={state.settings.jail.escapeTargetTotal}
                  />
                  {!canAct && (
                    <div className="jail-waiting">Waiting for {player.name} to choose.</div>
                  )}
                </div>
              </div>
            ) : cardId && !state.paused ? (
              <div className="centre-card">
                <div className="centre-card-head">
                  <span>{buildOffer?.propertyId === cardId ? 'Your property' : 'Property'}</span>
                </div>
                <div className="centre-card-body">
                  {buildOffer?.propertyId === cardId && (
                    <BuildOffer state={state} playerId={player.id} propertyId={cardId} />
                  )}
                  <PropertyCard state={state} propertyId={cardId} />
                </div>
              </div>
            ) : undefined
          }
        />

        <div className="side-col">
          <Leaderboard state={state} dispatch={dispatch} isHost={isHost} />
        </div>
      </div>

      <ActionBar
        state={state}
        dispatch={dispatch}
        canAct={canAct}
        isHost={isHost}
        onManage={() => setShowManage(true)}
        onHouseRules={() => setShowHouseRules(true)}
        onEndGame={() => dispatch({ type: 'END_GAME' })}
        onRemovePlayer={() => setShowRemove(true)}
        onBuild={requestBuild}
      />

      {state.paused && <PauseOverlay dispatch={dispatch} />}

      {showManage && (
        <ManageModal
          state={state}
          dispatch={dispatch}
          onClose={() => setShowManage(false)}
          onBuild={requestBuild}
        />
      )}

      {showHouseRules && (
        <HouseRulesModal
          state={state}
          dispatch={dispatch}
          onClose={() => setShowHouseRules(false)}
        />
      )}

      {showRemove && (
        <RemovePlayerModal
          state={state}
          dispatch={dispatch}
          onClose={() => setShowRemove(false)}
        />
      )}

      {showCode && <GameCodeModal session={session} onClose={() => setShowCode(false)} />}

      {confirmLeave && (
        <LeaveConfirm
          onConfirm={() => {
            setConfirmLeave(false)
            session.leaveGame()
          }}
          onCancel={() => setConfirmLeave(false)}
        />
      )}

      {confirmBuild && (
        <BuildWarning
          propertyId={confirmBuild}
          onConfirm={() => {
            dispatch({ type: 'BUILD', propertyId: confirmBuild })
            setConfirmBuild(null)
          }}
          onCancel={() => setConfirmBuild(null)}
        />
      )}

      {showTimer && (
        <TimerModal state={state} dispatch={dispatch} onClose={() => setShowTimer(false)} />
      )}
    </div>
  )
}

function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
