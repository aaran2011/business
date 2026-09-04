import { money } from '../engine/log'
import { leaderboard } from '../engine/queries'
import type { GameAction, GameState } from '../engine/types'

/**
 * The only player-facing roster kept on the game screen. Ranked by total
 * wealth, so an asset-rich, cash-poor player still shows near the top.
 * "Pause on Next Turn" sits on the right of the header.
 */
export function Leaderboard({
  state,
  dispatch,
}: {
  state: GameState
  dispatch: (action: GameAction) => void
}) {
  const rows = leaderboard(state)
  const currentId = state.turnOrder[state.currentIndex]
  const pauseRequested = state.pauseRequested

  return (
    <div className="panel">
      <div className="panel-head">
        <span>Leaderboard</span>
        <button
          className={`btn btn-sm pause-btn${pauseRequested ? ' is-armed' : ''}`}
          onClick={() =>
            dispatch({ type: pauseRequested ? 'CANCEL_PAUSE' : 'REQUEST_PAUSE' })
          }
          title="Pause the game when the next turn begins"
        >
          {pauseRequested ? '\u{23F3} Pausing…' : '\u{23F8}\u{FE0F} Pause on Next Turn'}
        </button>
      </div>

      {rows.map(({ player, assets }, i) => (
        <div
          className={`lb-row${player.id === currentId ? ' is-current' : ''}`}
          key={player.id}
          style={{ opacity: player.isOut ? 0.45 : 1 }}
        >
          <span className="lb-rank">{i + 1}</span>
          <span
            className="player-token"
            style={{ background: player.colourHex, width: 20, height: 20, fontSize: 9 }}
          >
            {player.name.charAt(0).toUpperCase()}
          </span>
          <span className="lb-name">
            {player.name}
            {player.inJail && <span className="tag tag-jail">Jail</span>}
            {player.isOut && <span className="tag tag-out">Out</span>}
          </span>
          <span className="lb-money">
            <strong>{money(player.cash)}</strong>
            <small>{money(assets.netWorth)} total</small>
          </span>
        </div>
      ))}

      <div className="rent-note">
        Bold figure is cash in hand. Total counts cash, property and buildings — a player with no
        cash can still lead.
      </div>
    </div>
  )
}
