import { BUILDING_LEVEL_LABELS, COUNTRIES } from '../data/properties'
import { SPECIAL_ASSETS } from '../data/specialAssets'
import { canBuild, canSellBuilding } from '../engine/building'
import { money } from '../engine/log'
import { canMortgage, canUnmortgage } from '../engine/mortgage'
import { debtOwedBy, displayNameOf, ownedPropertyIds } from '../engine/queries'
import type { GameAction, GameState } from '../engine/types'

/**
 * Build, sell buildings, mortgage and unmortgage — everything a player can do
 * with the deeds they hold, including raising cash to clear a debt.
 */
export function ManageModal({
  state,
  dispatch,
  onClose,
  onBuild,
}: {
  state: GameState
  dispatch: (action: GameAction) => void
  onClose: () => void
  /** Building goes through here so the colour-group warning cannot be skipped. */
  onBuild: (propertyId: string) => void
}) {
  const playerId = state.turnOrder[state.currentIndex]
  const player = state.players.find((p) => p.id === playerId)!
  const ids = ownedPropertyIds(state, playerId)
  const owed = debtOwedBy(state, playerId)

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">{player.name}'s holdings</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              Cash {money(player.cash)}
              {owed > 0 && ` · owes ${money(owed)}`}
            </div>
          </div>
          <button className="close-x" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {owed > 0 && (
            <div className="notice">
              {player.name} owes {money(owed)}. Raise the cash here, then press “Pay” in the action
              bar. Owing money is not elimination — a player is only out when nothing is left to
              mortgage or sell.
            </div>
          )}

          {ids.length === 0 && <div className="empty-note">No holdings yet.</div>}

          <div className="manage-grid">
            {ids.map((id) => {
              const country = COUNTRIES[id]
              const asset = SPECIAL_ASSETS[id]
              const holding = state.holdings[id]

              const build = country
                ? canBuild(state, playerId, id)
                : { allowed: false, reason: '', cost: 0, nextLabel: '' }
              const sell = country
                ? canSellBuilding(state, playerId, id)
                : { allowed: false, reason: '', refund: 0, fromLabel: '', toLabel: '' }
              const mort = canMortgage(state, playerId, id)
              const unmort = canUnmortgage(state, playerId, id)

              return (
                <div className="manage-card" key={id}>
                  <h4>
                    <span>{country?.flag ?? asset?.icon}</span>
                    {displayNameOf(id)}
                    {holding.mortgaged && <span className="tag tag-mortgaged">Mortgaged</span>}
                  </h4>
                  <div className="sub">
                    {country
                      ? `${BUILDING_LEVEL_LABELS[holding.buildings]} · house ${money(
                          country.houseCost,
                        )} · hotel ${money(country.hotelCost)}`
                      : 'Transport / utility — no buildings'}
                  </div>

                  <div className="manage-actions">
                    {country && (
                      <button
                        className="btn btn-sm btn-good"
                        disabled={!build.allowed}
                        title={build.reason}
                        onClick={() => onBuild(id)}
                      >
                        Build {build.nextLabel || '—'}
                        {build.cost ? ` (${money(build.cost)})` : ''}
                      </button>
                    )}
                    {country && (
                      <button
                        className="btn btn-sm"
                        disabled={!sell.allowed}
                        title={sell.reason}
                        onClick={() => dispatch({ type: 'SELL_BUILDING', propertyId: id })}
                      >
                        Sell building{sell.refund ? ` (+${money(sell.refund)})` : ''}
                      </button>
                    )}
                    {holding.mortgaged ? (
                      <button
                        className="btn btn-sm"
                        disabled={!unmort.allowed}
                        title={unmort.reason}
                        onClick={() => dispatch({ type: 'UNMORTGAGE', propertyId: id })}
                      >
                        Unmortgage ({money(unmort.amount)})
                      </button>
                    ) : (
                      <button
                        className="btn btn-sm btn-bad"
                        disabled={!mort.allowed}
                        title={mort.reason}
                        onClick={() => dispatch({ type: 'MORTGAGE', propertyId: id })}
                      >
                        Mortgage (+{money(mort.amount)})
                      </button>
                    )}
                  </div>

                  {country && !build.allowed && build.reason && (
                    <div className="sub" style={{ marginTop: 7, marginBottom: 0 }}>
                      {build.reason}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="modal-foot">
          {owed > 0 && (
            <button
              className="btn btn-bad"
              onClick={() => {
                dispatch({ type: 'DECLARE_BANKRUPT' })
                onClose()
              }}
            >
              Give up — declare bankrupt
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
