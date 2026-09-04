import { orderRollComplete } from '../engine/game'
import type { GameAction, GameState } from '../engine/types'
import { DiceTray } from './Dice'

/**
 * Every player rolls once. Highest total starts; turns then run clockwise
 * through the seating order. A tie is re-rolled between the tied players.
 */
export function OrderRollScreen({
  state,
  dispatch,
  rolling,
  rollId,
}: {
  state: GameState
  dispatch: (action: GameAction) => void
  rolling: boolean
  rollId: number
}) {
  const nextEntry = state.orderRolls.find(
    (e) => e.dice === null && state.orderContenders.includes(e.playerId),
  )
  const complete = orderRollComplete(state)
  const contenderTotals = state.orderRolls
    .filter((e) => state.orderContenders.includes(e.playerId))
    .map((e) => e.total ?? 0)
  const best = contenderTotals.length ? Math.max(...contenderTotals) : 0

  return (
    <div className="setup-shell">
      <div className="setup-hero">
        <h1>Who goes first?</h1>
        <p>Every player rolls once. Highest total starts, then play runs clockwise.</p>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span>Opening roll</span>
          <span>Round {state.orderRollRound}</span>
        </div>
        <div className="panel-body">
          <div className="dice-stage" style={{ marginBottom: 20 }}>
            <DiceTray
              dice={state.dice}
              rolling={rolling}
              count={state.settings.dice.count}
              rollId={rollId}
              durationMs={state.settings.dice.rollAnimationMs}
              label="Roll"
            />
          </div>

          <div className="order-list">
            {state.orderRolls.map((entry) => {
              const player = state.players.find((p) => p.id === entry.playerId)!
              const contending = state.orderContenders.includes(entry.playerId)
              const isWinner = complete && contending && entry.total === best
              return (
                <div
                  key={entry.playerId}
                  className={[
                    'order-row',
                    nextEntry?.playerId === entry.playerId ? 'is-next' : '',
                    isWinner ? 'is-winner' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{ opacity: contending ? 1 : 0.45 }}
                >
                  <span className="player-token" style={{ background: player.colourHex }}>
                    {player.name.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{player.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                      {entry.dice
                        ? entry.dice.join(' + ')
                        : contending
                          ? 'Waiting to roll'
                          : 'Out of the roll-off'}
                    </div>
                  </div>
                  <span className="order-total">{entry.total ?? '—'}</span>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            {nextEntry && (
              <button
                className="btn btn-primary"
                disabled={rolling}
                onClick={() => dispatch({ type: 'ROLL_FOR_ORDER' })}
              >
                Roll for {state.players.find((p) => p.id === nextEntry.playerId)!.name}
              </button>
            )}
            {complete && (
              <button
                className="btn btn-good"
                style={{ marginLeft: 'auto' }}
                onClick={() => dispatch({ type: 'CONFIRM_ORDER' })}
              >
                Start the game
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
