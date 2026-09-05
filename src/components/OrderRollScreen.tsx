import { orderRollComplete } from '../engine/game'
import type { GameAction, GameState } from '../engine/types'
import { DiceTray } from './Dice'

/**
 * Every player takes their own opening roll, on their own device. Highest
 * total starts; turns then run clockwise through the seating order. A tie is
 * re-rolled between the tied players.
 */
export function OrderRollScreen({
  state,
  dispatch,
  rolling,
  rollId,
  controlsPlayer,
}: {
  state: GameState
  dispatch: (action: GameAction) => void
  rolling: boolean
  rollId: number
  /** Whether this device is the one that rolls for a given player. */
  controlsPlayer: (playerId: string) => boolean
}) {
  const complete = orderRollComplete(state)
  const contenderTotals = state.orderRolls
    .filter((e) => state.orderContenders.includes(e.playerId))
    .map((e) => e.total ?? 0)
  const best = contenderTotals.length ? Math.max(...contenderTotals) : 0

  const waitingOnMe = state.orderRolls.some(
    (e) =>
      e.dice === null && state.orderContenders.includes(e.playerId) && controlsPlayer(e.playerId),
  )

  return (
    <div className="setup-shell">
      <div className="setup-hero">
        <h1>Who goes first?</h1>
        <p>Everyone rolls once, on their own phone. Highest total starts.</p>
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
              label="Rolled"
            />
          </div>

          <div className="order-list">
            {state.orderRolls.map((entry) => {
              const player = state.players.find((p) => p.id === entry.playerId)!
              const contending = state.orderContenders.includes(entry.playerId)
              const isWinner = complete && contending && entry.total === best
              const mine = controlsPlayer(entry.playerId)
              const awaiting = entry.dice === null && contending

              return (
                <div
                  key={entry.playerId}
                  className={[
                    'order-row',
                    awaiting && mine ? 'is-next' : '',
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
                    <div style={{ fontWeight: 800, fontSize: 14 }}>
                      {player.name}
                      {mine && (
                        <span className="chip" style={{ marginLeft: 6 }}>
                          You
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                      {entry.dice
                        ? entry.dice.join(' + ')
                        : contending
                          ? 'Waiting to roll'
                          : 'Out of the roll-off'}
                    </div>
                  </div>

                  {awaiting ? (
                    mine ? (
                      <button
                        className="btn btn-primary btn-sm order-roll-btn"
                        disabled={rolling}
                        onClick={() =>
                          dispatch({ type: 'ROLL_FOR_ORDER', playerId: entry.playerId })
                        }
                      >
                        {'\u{1F3B2}'} Roll
                      </button>
                    ) : (
                      <span className="order-waiting">on their phone</span>
                    )
                  ) : (
                    <span className="order-total">{entry.total ?? '—'}</span>
                  )}
                </div>
              )
            })}
          </div>

          <div className="order-foot">
            {!complete && (
              <span className="order-hint">
                {waitingOnMe
                  ? 'Your turn — press Roll on your row.'
                  : 'Waiting for the others to roll.'}
              </span>
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
