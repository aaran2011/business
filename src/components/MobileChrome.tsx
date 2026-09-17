import type { ReactNode } from 'react'
import { money } from '../engine/log'
import { currentPlayer, debtOwedBy, ownedPropertyIds } from '../engine/queries'
import type { GameAction, GameState } from '../engine/types'
import { ActionBar, hintFor } from './ActionBar'
import { Wordmark } from './BoardCentre'
import { Leaderboard, rankedRows } from './Leaderboard'

/**
 * ============================================================================
 * THE PHONE SCREEN AROUND THE BOARD
 * ============================================================================
 *
 * A compact header, a compact leaderboard and a turn panel — laid out for a
 * phone held upright. Every control the square board's screen has is still
 * here; the rarer ones (the timer, the game code, removing a player, ending
 * the game, managing holdings) live behind the turn panel's "more" button so
 * the screen itself stays the game.
 *
 * Nothing here decides a rule. Decisions render through ActionBar in its
 * `decisions` mode, so a phone cannot offer a choice the rules would refuse.
 */

type Dispatch = (action: GameAction) => void

// ------------------------------------------------------------------ icons --

function Icon({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      className="micon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

const RulesIcon = () => (
  <Icon>
    <path d="M7 3h7l4 4v14H7z" />
    <path d="M14 3v4h4M10 12h5M10 16h5" />
  </Icon>
)

const LeaveIcon = () => (
  <Icon>
    <path d="M10 4H5v16h5" />
    <path d="M14 8l4 4-4 4M18 12H9" />
  </Icon>
)

const TrophyIcon = () => (
  <Icon size={15}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
    <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6M10 17h4" />
  </Icon>
)

const ArrowIcon = () => (
  <Icon size={14}>
    <path d="M5 12h13M13 7l5 5-5 5" />
  </Icon>
)

// ----------------------------------------------------------------- header --

/**
 * BUSINESS, House Rules and Leave — exactly the three things the design puts
 * here, for every player. The host's extra controls, the show/hide switch
 * among them, live in the turn panel's menu: three buttons plus a wordmark is
 * all 375px holds.
 */
export function MobileHeader({
  onHouseRules,
  onLeave,
}: {
  onHouseRules: () => void
  /** Absent in a one-device game, where there is nobody to leave. */
  onLeave?: () => void
}) {
  return (
    <header className="mheader">
      <Wordmark className="mheader-wordmark" />
      <div className="mheader-actions">
        <button className="mpill" onClick={onHouseRules}>
          <RulesIcon />
          House Rules
        </button>
        {onLeave && (
          <button className="mpill" onClick={onLeave}>
            <LeaveIcon />
            Leave
          </button>
        )}
      </div>
    </header>
  )
}

// ------------------------------------------------------------ leaderboard --

/** How many rows the compact leaderboard shows before "View All". */
const COMPACT_ROWS = 3

export function MobileLeaderboard({
  state,
  onViewAll,
}: {
  state: GameState
  onViewAll: () => void
}) {
  const rows = rankedRows(state)
  const currentId = state.turnOrder[state.currentIndex]

  // The leaders, and always the player whose turn it is — the one row
  // somebody glancing at the screen is most likely looking for.
  let shown = rows.slice(0, COMPACT_ROWS)
  const currentRow = rows.find((r) => r.player.id === currentId)
  if (currentRow && !shown.includes(currentRow)) {
    shown = [...rows.slice(0, COMPACT_ROWS - 1), currentRow]
  }

  return (
    <section className="mlb" aria-label="Leaderboard">
      <div className="mlb-head">
        <span className="mlb-title">
          <TrophyIcon />
          Leaderboard
        </span>
        <button className="mlb-all" onClick={onViewAll}>
          View All
          <ArrowIcon />
        </button>
      </div>
      {shown.map((row) => {
        const { player } = row
        const rank = rows.indexOf(row) + 1
        const isCurrent = player.id === currentId
        return (
          <div
            key={player.id}
            className={`mlb-row${isCurrent ? ' is-current' : ''}`}
            style={{ opacity: player.isOut ? 0.45 : 1 }}
          >
            <span className="mlb-rank">{rank}</span>
            <span className="mlb-avatar" style={{ background: player.colourHex }}>
              {player.name.charAt(0).toUpperCase()}
            </span>
            <span className="mlb-name">
              <span className="mlb-name-text">{player.name}</span>
              {player.inJail && <span className="tag tag-jail">Jail</span>}
              {player.isOut && <span className="tag tag-out">Out</span>}
            </span>
            <span className="mlb-cash">
              {player.cashHidden ? (
                <span className="mlb-hidden" title="Private to that player's own device">
                  •••••
                </span>
              ) : (
                money(player.cash)
              )}
            </span>
          </div>
        )
      })}
    </section>
  )
}

/** Every player, with totals and the host's pause button — the full board. */
export function LeaderboardSheet({
  state,
  dispatch,
  isHost,
  onClose,
}: {
  state: GameState
  dispatch: Dispatch
  isHost: boolean
  onClose: () => void
}) {
  return (
    <div className="overlay msheet-overlay" onClick={onClose}>
      <div className="msheet" onClick={(e) => e.stopPropagation()}>
        <div className="msheet-grab" aria-hidden="true" />
        <Leaderboard state={state} dispatch={dispatch} isHost={isHost} />
        <button className="btn msheet-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------- turn panel --

export function MobileTurnPanel({
  state,
  dispatch,
  canAct,
  isHost,
  reconnecting,
  clock,
  canRoll,
  onRoll,
  onBuild,
  onMore,
}: {
  state: GameState
  dispatch: Dispatch
  canAct: boolean
  isHost: boolean
  reconnecting: boolean
  /** The running game clock, when there is one. */
  clock?: ReactNode
  canRoll: boolean
  onRoll: () => void
  onBuild: (propertyId: string) => void
  onMore: () => void
}) {
  if (state.phase !== 'playing') return null
  const player = currentPlayer(state)

  let title: string
  let sub: string
  if (state.paused) {
    title = 'Paused'
    sub = 'The game is paused.'
  } else if (!canAct) {
    title = 'Not your turn'
    sub = `${player.name} is playing — wait for your go.`
  } else {
    title = 'Your turn'
    sub = hintFor(state)
  }
  if (reconnecting) sub = 'Reconnecting…'

  // Exactly the conditions ActionBar uses to show a decision, so the button
  // row appears when — and only when — there is something to answer.
  const busy = state.stage === 'moving' || state.paused
  const hasDecision =
    canAct &&
    ((state.stage === 'inJail' && !busy) ||
      (state.stage === 'awaitingPurchase' && Boolean(state.pendingPurchase)) ||
      (state.stage === 'awaitingBuild' && Boolean(state.pendingBuild)) ||
      debtOwedBy(state, player.id) > 0)

  return (
    <section className={`mturn${hasDecision ? ' has-decision' : ''}`}>
      <div className="mturn-main">
        <div className="mturn-text">
          <div className={`mturn-title${canAct && !state.paused ? ' is-mine' : ''}`}>{title}</div>
          <div className="mturn-sub" title={sub}>
            {sub}
          </div>
        </div>
        {clock}
        <button
          className="mturn-btn mturn-dice"
          onClick={canRoll ? onRoll : undefined}
          disabled={!canRoll}
          aria-label="Roll the die"
        >
          <span className="mturn-pips" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </button>
        <button className="mturn-btn mturn-more" onClick={onMore} aria-label="More">
          <span className="mturn-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </button>
      </div>

      {hasDecision && (
        <div className="mturn-actions">
          <ActionBar
            mode="decisions"
            state={state}
            dispatch={dispatch}
            canAct={canAct}
            isHost={isHost}
            onBuild={onBuild}
            onManage={() => {}}
            onHouseRules={() => {}}
            onEndGame={() => {}}
            onRemovePlayer={() => {}}
          />
        </div>
      )}
    </section>
  )
}

// ------------------------------------------------------------- more sheet --

export function MobileMoreSheet({
  state,
  dispatch,
  canAct,
  isHost,
  hasCode,
  onClose,
  onManage,
  onHouseRules,
  onTimer,
  onCode,
  onRemovePlayer,
  onEndGame,
  onHideBars,
}: {
  state: GameState
  dispatch: Dispatch
  canAct: boolean
  isHost: boolean
  /** False in a one-device game, which has no code to hand out. */
  hasCode: boolean
  onClose: () => void
  onManage: () => void
  onHouseRules: () => void
  onTimer: () => void
  onCode: () => void
  onRemovePlayer: () => void
  onEndGame: () => void
  /** The host's fold-away for the header and the turn panel. */
  onHideBars: () => void
}) {
  const player = currentPlayer(state)
  const busy = state.stage === 'moving' || state.paused
  // The same rule as the square board's "Build / Sell / Mortgage" button.
  const canManage = canAct && ownedPropertyIds(state, player.id).length > 0

  const item = (label: string, run: () => void, extra = '', disabled = false) => (
    <button
      className={`msheet-item${extra}`}
      disabled={disabled}
      onClick={() => {
        onClose()
        run()
      }}
    >
      {label}
    </button>
  )

  return (
    <div className="overlay msheet-overlay" onClick={onClose}>
      <div className="msheet" onClick={(e) => e.stopPropagation()}>
        <div className="msheet-grab" aria-hidden="true" />
        <div className="msheet-list">
          {canManage && item('Build / Sell / Mortgage', onManage, '', busy)}
          {item('House Rules', onHouseRules)}
          {isHost && (
            <>
              {item('\u{23F1}\u{FE0F} Timer', onTimer)}
              {hasCode && item('Get Code', onCode)}
              {item(
                state.pauseRequested ? '\u{23F3} Cancel the pause' : '\u{23F8}\u{FE0F} Pause on Next Turn',
                () => dispatch({ type: state.pauseRequested ? 'CANCEL_PAUSE' : 'REQUEST_PAUSE' }),
              )}
              {item('Hide the timer and controls', onHideBars)}
              {item('Remove Player', onRemovePlayer)}
              {item('End Game', onEndGame, ' is-danger')}
            </>
          )}
        </div>
        <button className="btn msheet-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
