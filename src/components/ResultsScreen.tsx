import { money } from '../engine/log'
import { leaderboard } from '../engine/queries'
import type { GameAction, GameState } from '../engine/types'

/**
 * Shown when the game timer runs out, and when a game ends by elimination.
 * Lists every player's total value and names the winner.
 *
 * On a timed finish the winner is whoever holds the most total wealth; on a
 * normal finish it is the last player standing.
 */
export function ResultsScreen({
  state,
  dispatch,
}: {
  state: GameState
  dispatch: (action: GameAction) => void
}) {
  const rows = leaderboard(state)
  const timedOut = state.phase === 'timeUp'
  const endedByHost = state.phase === 'ended'

  const kicker = timedOut ? "Time's up" : endedByHost ? 'Game ended' : 'Game over'
  const blurb = timedOut
    ? 'The clock ran out. The player holding the most total wealth takes it.'
    : endedByHost
      ? 'The game was ended early. The player holding the most total wealth takes it.'
      : 'The last player left in the game takes it.'
  const winner = state.players.find((p) => p.id === state.winnerId) ?? rows[0]?.player
  const winnerAssets = rows.find((r) => r.player.id === winner?.id)?.assets

  return (
    <div className="results-shell">
      <div className="results-hero">
        <div className="results-kicker">{kicker}</div>
        <h1>{winner ? `${winner.name} wins` : 'No winner'}</h1>
        <p>{blurb}</p>
      </div>

      {winner && winnerAssets && (
        <div className="winner-card" style={{ borderColor: winner.colourHex }}>
          <span className="winner-trophy">{'\u{1F3C6}'}</span>
          <div className="winner-token" style={{ background: winner.colourHex }}>
            {winner.name.charAt(0).toUpperCase()}
          </div>
          <div className="winner-name">{winner.name}</div>
          <div className="winner-total">{money(winnerAssets.netWorth)}</div>
          <div className="winner-sub">Total value</div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <span>Final totals</span>
          <span>{rows.length} players</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="rent-table results-table">
            <tbody>
              <tr className="results-head">
                <td>#</td>
                <td>Player</td>
                <td>Cash</td>
                <td>Property</td>
                <td>Buildings</td>
                <td>Total value</td>
              </tr>
              {rows.map(({ player, assets }, i) => (
                <tr key={player.id} style={{ opacity: player.isOut ? 0.5 : 1 }}>
                  <td>{i + 1}</td>
                  <td style={{ textAlign: 'left' }}>
                    <span
                      className="player-token"
                      style={{
                        background: player.colourHex,
                        width: 18,
                        height: 18,
                        fontSize: 8,
                        display: 'inline-flex',
                        verticalAlign: 'middle',
                        marginRight: 7,
                      }}
                    >
                      {player.name.charAt(0).toUpperCase()}
                    </span>
                    {player.name}
                    {player.isOut && ' (out)'}
                  </td>
                  <td>{money(assets.cash)}</td>
                  <td>{money(assets.propertyValue)}</td>
                  <td>{money(assets.buildingValue)}</td>
                  <td>
                    <strong>{money(assets.netWorth)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="results-actions">
        {timedOut && (
          <button
            className="btn btn-primary btn-lg"
            onClick={() => dispatch({ type: 'RESUME_WITHOUT_TIMER' })}
          >
            Resume Game
          </button>
        )}
        <button className="btn btn-good btn-lg" onClick={() => dispatch({ type: 'RESET' })}>
          Good Game
        </button>
      </div>
      <p className="results-note">
        {timedOut
          ? 'Resume Game carries on from exactly where you stopped, with the timer switched off. Good Game returns to the home screen.'
          : 'Good Game returns to the home screen.'}
      </p>
    </div>
  )
}
