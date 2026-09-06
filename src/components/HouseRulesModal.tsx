import { UNCONFIRMED_SETTINGS, type GameSettings } from '../data/settings'
import type { GameAction, GameState } from '../engine/types'
import { SoundToggle } from './SoundToggle'

/**
 * The four rules the printed game did not specify. They are settings rather
 * than invented rules, and can be agreed at the table before or during play.
 */
export function HouseRulesModal({
  state,
  dispatch,
  onClose,
}: {
  state: GameState
  dispatch: (action: GameAction) => void
  onClose: () => void
}) {
  const s = state.settings

  const update = (mutate: (draft: GameSettings) => void) => {
    const draft = structuredClone(s)
    mutate(draft)
    dispatch({ type: 'UPDATE_SETTINGS', settings: draft })
  }

  const detail = (path: string) => UNCONFIRMED_SETTINGS.find((u) => u.path === path)!

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">House Rules</div>
          <button className="close-x" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="notice">
            Everything else in this game follows the printed International Business rules exactly.
            The four settings below were <strong>not covered</strong> by those rules, so they are
            left open rather than invented. All values live in <code>src/data/settings.ts</code>.
          </div>

          <div className="settings-row">
            <div className="label">
              <strong>{detail('dice.count').label}</strong>
              <span>{detail('dice.count').detail}</span>
            </div>
            <div className="control">
              <select
                className="input"
                value={s.dice.count}
                onChange={(e) =>
                  update((d) => {
                    d.dice.count = Number(e.target.value)
                  })
                }
              >
                <option value={1}>1 die — moves 1–6</option>
                <option value={2}>2 dice — moves 2–12</option>
              </select>
            </div>
          </div>

          <div className="settings-row">
            <div className="label">
              <strong>Houses per country</strong>
              <span>
                How far a country can be built up. Three houses is the cap in play; the printed
                cards also carry a Hotel tier above that.
              </span>
            </div>
            <div className="control">
              <select
                className="input"
                value={s.buildings.maxLevel}
                onChange={(e) =>
                  update((d) => {
                    d.buildings.maxLevel = Number(e.target.value)
                  })
                }
              >
                <option value={3}>Up to 3 houses</option>
                <option value={4}>3 houses, then a Hotel</option>
              </select>
            </div>
          </div>

          <div className="settings-row">
            <div className="label">
              <strong>Colour group needed to build</strong>
              <span>
                Off: landing on a country you already own lets you build there. Either way, holding{' '}
                {s.colourGroups.sizeRequired} cards of one colour still doubles the site rent on
                every unimproved card of that colour.
              </span>
            </div>
            <div className="control">
              <select
                className="input"
                value={String(s.colourGroups.requiredForBuilding)}
                onChange={(e) =>
                  update((d) => {
                    d.colourGroups.requiredForBuilding = e.target.value === 'true'
                  })
                }
              >
                <option value="false">Not needed — build on any card you own</option>
                <option value="true">Needs {s.colourGroups.sizeRequired} same-colour cards</option>
              </select>
            </div>
          </div>

          <div className="settings-row">
            <div className="label">
              <strong>{detail('buildings.sellRefundRatio').label}</strong>
              <span>{detail('buildings.sellRefundRatio').detail}</span>
            </div>
            <div className="control">
              <select
                className="input"
                value={s.buildings.sellRefundRatio}
                onChange={(e) =>
                  update((d) => {
                    d.buildings.sellRefundRatio = Number(e.target.value)
                  })
                }
              >
                <option value={1}>100% of build cost</option>
                <option value={0.75}>75% of build cost</option>
                <option value={0.5}>50% of build cost</option>
                <option value={0.25}>25% of build cost</option>
              </select>
            </div>
          </div>

          <div className="settings-row">
            <div className="label">
              <strong>{detail('elimination.assetsGoTo').label}</strong>
              <span>{detail('elimination.assetsGoTo').detail}</span>
            </div>
            <div className="control">
              <select
                className="input"
                value={s.elimination.assetsGoTo}
                onChange={(e) =>
                  update((d) => {
                    d.elimination.assetsGoTo = e.target.value as 'bank' | 'creditor'
                  })
                }
              >
                <option value="bank">Back to the Bank</option>
                <option value="creditor">To the creditor</option>
              </select>
            </div>
          </div>

          <div className="settings-row">
            <div className="label">
              <strong>{detail('startBonus.awardOnForcedMoveToJail').label}</strong>
              <span>{detail('startBonus.awardOnForcedMoveToJail').detail}</span>
            </div>
            <div className="control">
              <select
                className="input"
                value={String(s.startBonus.awardOnForcedMoveToJail)}
                onChange={(e) =>
                  update((d) => {
                    d.startBonus.awardOnForcedMoveToJail = e.target.value === 'true'
                  })
                }
              >
                <option value="false">No START money</option>
                <option value="true">Pay START money if crossed</option>
              </select>
            </div>
          </div>

          <div className="settings-row">
            <div className="label">
              <strong>{detail('jail.landingOnJailIsJustVisiting').label}</strong>
              <span>{detail('jail.landingOnJailIsJustVisiting').detail}</span>
            </div>
            <div className="control">
              <select
                className="input"
                value={String(s.jail.landingOnJailIsJustVisiting)}
                onChange={(e) =>
                  update((d) => {
                    d.jail.landingOnJailIsJustVisiting = e.target.value === 'true'
                  })
                }
              >
                <option value="true">Just visiting</option>
                <option value="false">Sent to Jail</option>
              </select>
            </div>
          </div>

          <div className="settings-row">
            <div className="label">
              <strong>Unmortgage interest</strong>
              <span>
                The printed rules say the mortgage amount is simply paid back. This is kept
                editable so a fee can be added later.
              </span>
            </div>
            <div className="control">
              <select
                className="input"
                value={s.mortgage.unmortgageInterestRate}
                onChange={(e) =>
                  update((d) => {
                    d.mortgage.unmortgageInterestRate = Number(e.target.value)
                  })
                }
              >
                <option value={0}>0% — as printed</option>
                <option value={0.1}>+10%</option>
                <option value={0.2}>+20%</option>
              </select>
            </div>
          </div>
        </div>

        <div className="modal-foot">
          {/* Sound lives here rather than in the top bar, which is for the game. */}
          <SoundToggle />
          <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
