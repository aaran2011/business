import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BOARD, BOARD_SIZE } from './data/board'
import { COUNTRIES } from './data/properties'
import { ActionBar } from './components/ActionBar'
import { Board } from './components/Board'
import { BuildOffer } from './components/BuildOffer'
import { BuildWarning } from './components/BuildWarning'
import { JailDice } from './components/Dice'
import { EventNotice } from './components/EventNotice'
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
  /** A guest shows the host's game; the host alone drives the turn machinery. */
  const isGuest = session.role === 'guest'
  const isGuestRef = useRef(isGuest)
  isGuestRef.current = isGuest

  const [rolling, setRolling] = useState(false)
  const [displayPositions, setDisplayPositions] = useState<Record<string, number>>({})
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
  const dialogOpen = showManage || showHouseRules || showTimer || showRemove
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
        rollId={rollId}
        controlsPlayer={session.controlsPlayer}
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
      reconnecting={session.reconnecting}
      controlsPlayer={session.controlsPlayer}
      seatName={state.players.find((p) => p.id === session.myPlayerId)?.name ?? null}
      rolling={rolling}
      rollId={rollId}
      displayPositions={displayPositions}
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
  /** True while this device is quietly getting back into the game. */
  reconnecting: boolean
  /** Whether this device plays a given seat. */
  controlsPlayer: (playerId: string) => boolean
  /** The seat this phone is playing, when it joined with a code. */
  seatName: string | null
  rolling: boolean
  rollId: number
  displayPositions: Record<string, number>
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
  reconnecting,
  seatName,
  controlsPlayer,
  rolling,
  rollId,
  displayPositions,
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
    if (!canAct) return `${player.name} is playing — not your turn.`
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
  const popup = state.popups[0] ?? null
  const buildCheck = buildOffer ? canBuild(state, player.id, buildOffer.propertyId) : null

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
        The clock is for everyone; setting it and changing the rules are the
        host's job, so a joined phone is not shown buttons it cannot use.
      */}
      <header className="topbar">
        {isHost && (
          <button className="btn btn-sm" onClick={() => setShowTimer(true)}>
            {'\u{23F1}\u{FE0F}'} Timer
          </button>
        )}
        {remainingMs !== null && (
          <span className={`clock${lowTime ? ' is-low' : ''}`}>{formatClock(remainingMs)}</span>
        )}
        {/* Says what is happening instead of throwing anybody out of the game. */}
        {reconnecting && <span className="reconnecting">Reconnecting…</span>}
        <div className="topbar-spacer" />
        {isHost && (
          <button className="btn btn-sm btn-ghost" onClick={() => setShowHouseRules(true)}>
            House Rules
          </button>
        )}
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
          centreCard={
            /*
              One slot in the middle of the board, and a clear order of who
              gets it: a card about what just happened first, then Jail, then
              the property you are being asked about.
            */
            popup && !state.paused ? (
              <EventPopup
                popup={popup}
                state={state}
                mine={popup.affects === null || controlsPlayer(popup.affects)}
                onDismiss={() => dispatch({ type: 'DISMISS_POPUP' })}
              />
            ) : state.stage === 'inJail' && !popup && !state.paused ? (
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
                    {canAct ? 'You are' : 'They are'} locked up and cannot move. Two choices:
                    pay {money(state.settings.jail.payToEscape)} to the bank, or take up to{' '}
                    {state.settings.jail.escapeDieRolls} rolls of one die and total{' '}
                    {state.settings.jail.escapeTargetTotal} or more. Either way the release takes
                    effect on {canAct ? 'your' : 'their'} next turn — a roll on a later turn does
                    not open the door by itself.
                  </p>
                  {canAct && (
                    <div className="jail-choices">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => dispatch({ type: 'JAIL_ROLL' })}
                      >
                        Roll ({player.jailRolls.length} of{' '}
                        {state.settings.jail.escapeDieRolls} used)
                      </button>
                      <button
                        className="btn btn-good btn-sm"
                        onClick={() => dispatch({ type: 'JAIL_PAY' })}
                        disabled={player.cash < state.settings.jail.payToEscape}
                        title={
                          player.cash < state.settings.jail.payToEscape
                            ? `Needs ${money(state.settings.jail.payToEscape)} in cash.`
                            : undefined
                        }
                      >
                        Pay {money(state.settings.jail.payToEscape)}
                      </button>
                    </div>
                  )}
                  {player.jailRolls.length > 0 && (
                    <JailDice
                      rolls={player.jailRolls}
                      slots={state.settings.jail.escapeDieRolls}
                      target={state.settings.jail.escapeTargetTotal}
                    />
                  )}
                  {!canAct && (
                    <div className="jail-waiting">Waiting for {player.name} to choose.</div>
                  )}
                </div>
              </div>
            ) : cardId && !popup && !state.paused ? (
              <div className="centre-card">
                <div className="centre-card-head">
                  <span>
                    {buildOffer?.propertyId === cardId ? 'Your property' : 'Property'}
                  </span>
                  <button
                    type="button"
                    className="centre-card-close"
                    aria-label="Close card"
                    onClick={() => {
                      if (offeredToMe?.propertyId === cardId) {
                        dispatch({ type: 'DECLINE_PURCHASE' })
                      } else if (buildOffer?.propertyId === cardId) {
                        dispatch({ type: 'DECLINE_BUILD' })
                      }
                    }}
                  >
                    ×
                  </button>
                </div>

                <div className="centre-card-body">
                  {buildOffer?.propertyId === cardId && (
                    <BuildOffer state={state} playerId={player.id} propertyId={cardId} />
                  )}
                  <PropertyCard state={state} propertyId={cardId} />
                </div>

                <div className="centre-card-foot">
                  {offeredToMe?.propertyId === cardId && player.cash >= offeredToMe.price ? (
                    <>
                      <button
                        className="btn btn-good btn-sm"
                        onClick={() => dispatch({ type: 'BUY_PROPERTY' })}
                      >
                        Buy for {money(offeredToMe.price)}
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() => dispatch({ type: 'DECLINE_PURCHASE' })}
                      >
                        Don't buy
                      </button>
                    </>
                  ) : offeredToMe?.propertyId === cardId ? (
                    <button
                      className="btn btn-sm"
                      onClick={() => dispatch({ type: 'DECLINE_PURCHASE' })}
                    >
                      Continue
                    </button>
                  ) : buildOffer?.propertyId === cardId && buildCheck?.allowed ? (
                    <>
                      <button
                        className="btn btn-good btn-sm"
                        onClick={() => requestBuild(cardId)}
                      >
                        Build {buildCheck.nextLabel || 'house'}
                        {buildCheck.cost ? ` — ${money(buildCheck.cost)}` : ''}
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() => dispatch({ type: 'DECLINE_BUILD' })}
                      >
                        Not now
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-sm"
                      onClick={() => dispatch({ type: 'DECLINE_BUILD' })}
                    >
                      Continue
                    </button>
                  )}
                </div>
              </div>
            ) : undefined
          }
          centreExtra={
            state.stage === 'inJail' || player.jailRolls.length > 0 ? (
              <JailDice
                rolls={player.jailRolls}
                slots={state.settings.jail.escapeDieRolls}
                target={state.settings.jail.escapeTargetTotal}
              />
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

      {/* The short line the other phones get instead of the card itself. */}
      <EventNotice
        notice={state.notice}
        mine={state.notice ? controlsPlayer(state.notice.playerId) : true}
      />

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
