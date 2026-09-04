import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BOARD, BOARD_SIZE } from './data/board'
import { ActionBar } from './components/ActionBar'
import { Board } from './components/Board'
import { BuildOffer } from './components/BuildOffer'
import { JailDice } from './components/Dice'
import { EventPopup } from './components/EventPopup'
import { HouseRulesModal } from './components/HouseRulesModal'
import { Leaderboard } from './components/Leaderboard'
import { ManageModal } from './components/ManageModal'
import { OrderRollScreen } from './components/OrderRollScreen'
import { PropertyCard } from './components/PropertyCard'
import { RemovePlayerModal } from './components/RemovePlayerModal'
import { ResultsScreen } from './components/ResultsScreen'
import { SetupScreen } from './components/SetupScreen'
import { PauseOverlay, TimerModal } from './components/TimerModal'
import { canBuild } from './engine/building'
import { JoinPanel } from './components/JoinPanel'
import { useSession } from './net/useSession'
import { money } from './engine/log'
import { debtOwedBy, displayNameOf } from './engine/queries'
import type { GameAction, GameState } from './engine/types'

type Dispatch = (action: GameAction) => void

export default function App() {
  const session = useSession()
  const { state } = session
  const dispatch = session.dispatch
  const [showJoin, setShowJoin] = useState(false)
  /** A guest shows the host's game; the host alone drives the turn machinery. */
  const isGuest = session.role === 'guest'
  const isGuestRef = useRef(isGuest)
  isGuestRef.current = isGuest

  const [rolling, setRolling] = useState(false)
  const [displayPositions, setDisplayPositions] = useState<Record<string, number>>({})
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null)
  const [showManage, setShowManage] = useState(false)
  const [showHouseRules, setShowHouseRules] = useState(false)
  const [showTimer, setShowTimer] = useState(false)
  const [showRemove, setShowRemove] = useState(false)
  const [remainingMs, setRemainingMs] = useState<number | null>(null)

  /** Bumped once per throw so each die picks a fresh spin. */
  const [rollId, setRollId] = useState(0)
  const rollTimer = useRef<number | null>(null)

  /** Wrap dispatch so any action that produces dice also spins them. */
  const act = useCallback<Dispatch>(
    (action) => {
      if (action.type === 'ROLL_DICE' || action.type === 'ROLL_FOR_ORDER') {
        setRolling(true)
        setRollId((n) => n + 1)
        if (rollTimer.current) window.clearTimeout(rollTimer.current)
        rollTimer.current = window.setTimeout(
          () => setRolling(false),
          state.settings.dice.rollAnimationMs,
        )
      }
      dispatch(action)
    },
    [state.settings.dice.rollAnimationMs],
  )

  useEffect(
    () => () => {
      if (rollTimer.current) window.clearTimeout(rollTimer.current)
    },
    [],
  )

  // Keep pawns in sync with real positions whenever nothing is animating.
  useEffect(() => {
    if (state.stage === 'moving') return
    setDisplayPositions(Object.fromEntries(state.players.map((p) => [p.id, p.position])))
  }, [state.players, state.stage])

  // Step the pawn one space at a time once the dice have settled.
  useEffect(() => {
    if (state.stage !== 'moving' || !state.pendingMove || rolling) return

    const { from, steps } = state.pendingMove
    const playerId = state.turnOrder[state.currentIndex]
    let step = 0

    const timer = window.setInterval(() => {
      step += 1
      setDisplayPositions((prev) => ({ ...prev, [playerId]: (from + step) % BOARD_SIZE }))
      if (step >= steps) {
        window.clearInterval(timer)
        // The guest animates the pawn to match, but the host decides when the
        // move is finished — otherwise two devices resolve the same landing.
        if (!isGuestRef.current) dispatch({ type: 'COMPLETE_MOVE' })
      }
    }, state.settings.moveStepMs)

    return () => window.clearInterval(timer)
  }, [
    state.stage,
    state.pendingMove,
    state.turnOrder,
    state.currentIndex,
    state.settings.moveStepMs,
    rolling,
  ])

  /**
   * The turn ends by itself. Once the player has resolved everything in front
   * of them — no popup, no purchase decision, no open dialog, no debt — play
   * moves on without an End Turn button.
   */
  const dialogOpen =
    showManage || showHouseRules || showTimer || showRemove || selectedProperty !== null
  const currentId = state.turnOrder[state.currentIndex]
  const blockedByDebt = currentId ? debtOwedBy(state, currentId) > 0 : false

  useEffect(() => {
    if (!state.settings.turn.autoEnd || isGuest) return
    if (state.phase !== 'playing' || state.paused) return
    if (state.stage !== 'awaitingEndTurn') return
    if (state.popups.length > 0 || dialogOpen || blockedByDebt) return

    const timer = window.setTimeout(
      () => dispatch({ type: 'END_TURN' }),
      state.settings.turn.autoEndDelayMs,
    )
    return () => window.clearTimeout(timer)
  }, [
    state.phase,
    state.stage,
    state.popups.length,
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

  // A guest stays on the join screen until they have actually taken a seat —
  // including after the host starts, since the seats only exist from then on.
  const seatedGuest = isGuest && session.myPlayerId !== null
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
    return <OrderRollScreen state={state} dispatch={act} rolling={rolling} rollId={rollId} />
  }
  if (state.phase === 'timeUp' || state.phase === 'gameOver' || state.phase === 'ended') {
    return <ResultsScreen state={state} dispatch={act} />
  }

  return (
    <PlayingView
      state={state}
      dispatch={act}
      canAct={!isGuest || session.myPlayerId === state.turnOrder[state.currentIndex]}
      seatName={
        isGuest
          ? (state.players.find((p) => p.id === session.myPlayerId)?.name ?? null)
          : null
      }
      rolling={rolling}
      rollId={rollId}
      displayPositions={displayPositions}
      remainingMs={remainingMs}
      selectedProperty={selectedProperty}
      setSelectedProperty={setSelectedProperty}
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
  /** The seat this phone is playing, when it joined with a code. */
  seatName: string | null
  rolling: boolean
  rollId: number
  displayPositions: Record<string, number>
  remainingMs: number | null
  selectedProperty: string | null
  setSelectedProperty: (id: string | null) => void
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
  seatName,
  rolling,
  rollId,
  displayPositions,
  remainingMs,
  selectedProperty,
  setSelectedProperty,
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
    if (state.stage === 'awaitingPurchase' && state.pendingPurchase) {
      return `${displayNameOf(state.pendingPurchase.propertyId)} — ${money(
        state.pendingPurchase.price,
      )} — unowned.`
    }
    if (state.stage === 'awaitingBuild' && state.pendingBuild) {
      return `${displayNameOf(state.pendingBuild.propertyId)} is yours.`
    }
    return `${player.name} is on ${space.label}.`
  }, [state, player, space])

  // The property card shown after landing, or when a space is clicked.
  const buildOffer = state.stage === 'awaitingBuild' ? state.pendingBuild : null
  const cardId =
    selectedProperty ?? state.pendingPurchase?.propertyId ?? buildOffer?.propertyId ?? null
  const popup = state.popups[0] ?? null
  const buildCheck = buildOffer ? canBuild(state, player.id, buildOffer.propertyId) : null
  const lowTime = remainingMs !== null && remainingMs <= 60000

  return (
    <div className="app">
      <header className="topbar">
        <button className="btn btn-sm" onClick={() => setShowTimer(true)}>
          {'\u{23F1}\u{FE0F}'} Timer
        </button>
        {remainingMs !== null && (
          <span className={`clock${lowTime ? ' is-low' : ''}`}>{formatClock(remainingMs)}</span>
        )}
        <div className="topbar-spacer" />
        <button className="btn btn-sm btn-ghost" onClick={() => setShowHouseRules(true)}>
          House Rules
        </button>
      </header>

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
          displayPositions={displayPositions}
          rolling={rolling}
          rollId={rollId}
          centreStatus={centreStatus}
          onRoll={() => dispatch({ type: 'ROLL_DICE' })}
          canRoll={state.stage === 'awaitingRoll' && owed === 0 && !state.paused && canAct}
          rollPrompt={
            !canAct
              ? `${player.name} is playing — watching from ${seatName ?? 'your phone'}`
              : state.stage === 'awaitingRoll' && owed === 0 && !state.paused
                ? `${player.name} — tap the die to roll`
                : ''
          }
          dieColour={player.colourHex}
          centreExtra={
            state.stage === 'inJail' || player.jailRolls.length > 0 ? (
              <JailDice
                rolls={player.jailRolls}
                slots={state.settings.jail.escapeDieRolls}
                target={state.settings.jail.escapeTargetTotal}
              />
            ) : undefined
          }
          onSelectSpace={setSelectedProperty}
        />

        <div className="side-col">
          <Leaderboard state={state} dispatch={dispatch} />
        </div>
      </div>

      <ActionBar
        state={state}
        dispatch={dispatch}
        canAct={canAct}
        onManage={() => setShowManage(true)}
        onHouseRules={() => setShowHouseRules(true)}
        onEndGame={() => dispatch({ type: 'END_GAME' })}
        onRemovePlayer={() => setShowRemove(true)}
      />

      {state.paused && <PauseOverlay dispatch={dispatch} />}

      {popup && !state.paused && (
        <EventPopup
          popup={popup}
          state={state}
          onDismiss={() => dispatch({ type: 'DISMISS_POPUP' })}
        />
      )}

      {cardId && !popup && !state.paused && (
        <div className="overlay" onClick={() => setSelectedProperty(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">
                {buildOffer?.propertyId === cardId ? 'Your property' : 'Property card'}
              </div>
              <button className="close-x" onClick={() => setSelectedProperty(null)}>
                ×
              </button>
            </div>

            {/* Whose turn it is, who would be buying, and what they hold. */}
            <div className="buyer-bar">
              <span className="player-token" style={{ background: player.colourHex }}>
                {player.name.charAt(0).toUpperCase()}
              </span>
              <div className="buyer-who">
                <span className="buyer-label">
                  {state.pendingPurchase?.propertyId === cardId
                    ? "Buying \u2014 it's their turn"
                    : 'Current turn'}
                </span>
                <strong>{player.name}</strong>
              </div>
              <div className="buyer-cash">
                <span className="buyer-label">Cash in hand</span>
                <strong>{money(player.cash)}</strong>
              </div>
            </div>
            <div className="modal-body">
              {buildOffer?.propertyId === cardId && (
                <BuildOffer state={state} playerId={player.id} propertyId={cardId} />
              )}
              <PropertyCard state={state} propertyId={cardId} />
            </div>
            <div className="modal-foot">
              {state.pendingPurchase?.propertyId === cardId ? (
                <>
                  {player.cash < state.pendingPurchase.price && (
                    <span className="foot-note">
                      {money(state.pendingPurchase.price)} needed — you hold {money(player.cash)}.
                    </span>
                  )}
                  <button
                    className="btn btn-good"
                    disabled={player.cash < state.pendingPurchase.price}
                    onClick={() => dispatch({ type: 'BUY_PROPERTY' })}
                  >
                    Buy for {money(state.pendingPurchase.price)}
                  </button>
                  <button className="btn" onClick={() => dispatch({ type: 'DECLINE_PURCHASE' })}>
                    {player.cash < state.pendingPurchase.price
                      ? 'Leave it with the Bank'
                      : "Don't buy"}
                  </button>
                </>
              ) : buildOffer?.propertyId === cardId ? (
                <>
                  <button
                    className="btn btn-good"
                    disabled={!buildCheck?.allowed}
                    title={buildCheck?.reason}
                    onClick={() => dispatch({ type: 'BUILD', propertyId: cardId })}
                  >
                    Build {buildCheck?.nextLabel || 'house'}
                    {buildCheck?.cost ? ` — ${money(buildCheck.cost)}` : ''}
                  </button>
                  <button className="btn" onClick={() => dispatch({ type: 'DECLINE_BUILD' })}>
                    Not now
                  </button>
                </>
              ) : (
                <button className="btn" onClick={() => setSelectedProperty(null)}>
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showManage && (
        <ManageModal state={state} dispatch={dispatch} onClose={() => setShowManage(false)} />
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
