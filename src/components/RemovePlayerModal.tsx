import { useState } from 'react'
import { money } from '../engine/log'
import { calculatePlayerAssets } from '../engine/queries'
import type { GameAction, GameState } from '../engine/types'

/**
 * Host tool: drop a player out of a game in progress. Their holdings go back
 * to the Bank so the rest of the board keeps working.
 */
export function RemovePlayerModal({
  state,
  dispatch,
  onClose,
}: {
  state: GameState
  dispatch: (action: GameAction) => void
  onClose: () => void
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const active = state.players.filter((p) => !p.isOut)
  const target = confirmId ? state.players.find((p) => p.id === confirmId) : null

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Remove a player</div>
          <button className="close-x" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {target ? (
            <>
              <div className="notice">
                Remove <strong>{target.name}</strong> from the game? Everything they own goes back
                to the Bank, free of houses and mortgages, and they take no further turns. This
                cannot be undone.
              </div>
              <div className="remove-row" style={{ borderColor: target.colourHex }}>
                <span className="player-token" style={{ background: target.colourHex }}>
                  {target.name.charAt(0).toUpperCase()}
                </span>
                <strong>{target.name}</strong>
                <span className="remove-worth">
                  {money(calculatePlayerAssets(state, target.id).netWorth)}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="notice">
                Play carries on without them. If only one player is left, the game ends there and
                then.
              </div>
              {active.length <= 1 && <div className="empty-note">No one left to remove.</div>}
              {active.map((p) => {
                const assets = calculatePlayerAssets(state, p.id)
                return (
                  <button key={p.id} className="remove-row" onClick={() => setConfirmId(p.id)}>
                    <span className="player-token" style={{ background: p.colourHex }}>
                      {p.name.charAt(0).toUpperCase()}
                    </span>
                    <strong>{p.name}</strong>
                    <span className="remove-meta">
                      {assets.countries} countries · {assets.specialAssets} assets
                    </span>
                    <span className="remove-worth">{money(assets.netWorth)}</span>
                  </button>
                )
              })}
            </>
          )}
        </div>

        <div className="modal-foot">
          {target ? (
            <>
              <button className="btn" onClick={() => setConfirmId(null)}>
                Back
              </button>
              <button
                className="btn btn-bad"
                onClick={() => {
                  dispatch({ type: 'REMOVE_PLAYER', playerId: target.id })
                  onClose()
                }}
              >
                Remove {target.name}
              </button>
            </>
          ) : (
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
