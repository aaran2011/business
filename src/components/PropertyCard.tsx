import {
  BUILDING_LEVEL_LABELS,
  COLOUR_GROUP_LABELS,
  COUNTRIES,
} from '../data/properties'
import { SPECIAL_ASSETS } from '../data/specialAssets'
import { money } from '../engine/log'
import { unmortgageCost } from '../engine/mortgage'
import { hasCompleteColourGroup, ownsAssetPair } from '../engine/queries'
import { rentTable } from '../engine/rent'
import type { GameState } from '../engine/types'

const GROUP_COLOUR: Record<string, string> = {
  green: '#2fa563',
  red: '#d94452',
  blue: '#3182ce',
  gold: '#e2a32b',
}

/**
 * The full printed card for a country or a special asset. Shown when a space
 * is clicked and when a player lands on an unowned space.
 */
export function PropertyCard({ state, propertyId }: { state: GameState; propertyId: string }) {
  const holding = state.holdings[propertyId]
  const owner = holding?.ownerId ? state.players.find((p) => p.id === holding.ownerId) : null
  const country = COUNTRIES[propertyId]
  const asset = SPECIAL_ASSETS[propertyId]

  if (country) {
    const rents = rentTable(state, propertyId)!
    const level = holding.buildings
    const groupComplete = owner ? hasCompleteColourGroup(state, owner.id, country.colour) : false
    const required = state.settings.colourGroups.sizeRequired
    const maxLevel = state.settings.buildings.maxLevel
    const hotelInPlay = maxLevel >= 4

    return (
      <div className="prop-card">
        <div className="prop-banner" style={{ background: GROUP_COLOUR[country.colour] }}>
          <span className="flag">{country.flag}</span>
          <div>
            <h3>{country.name}</h3>
            <span>{COLOUR_GROUP_LABELS[country.colour]} group</span>
          </div>
        </div>

        <table className="rent-table">
          <tbody>
            <tr>
              <td>Purchase price</td>
              <td>{money(country.price)}</td>
            </tr>
            <tr>
              <td>Owner</td>
              <td style={{ color: owner?.colourHex }}>{owner ? owner.name : 'Bank'}</td>
            </tr>

            <tr className={`sep${level === 0 && !groupComplete ? ' is-current' : ''}`}>
              <td>Site only rent</td>
              <td>{money(rents.site)}</td>
            </tr>
            <tr className={level === 0 && groupComplete ? 'is-current' : ''}>
              <td>Site rent — complete {required}-card group</td>
              <td>{money(rents.groupSite)}</td>
            </tr>
            <tr className={level === 1 ? 'is-current' : ''}>
              <td>1 House</td>
              <td>{money(rents.house1)}</td>
            </tr>
            <tr className={level === 2 ? 'is-current' : ''}>
              <td>2 Houses</td>
              <td>{money(rents.house2)}</td>
            </tr>
            <tr className={level === 3 ? 'is-current' : ''}>
              <td>3 Houses</td>
              <td>{money(rents.house3)}</td>
            </tr>
            {hotelInPlay && (
              <tr className={level === 4 ? 'is-current' : ''}>
                <td>Hotel</td>
                <td>{money(rents.hotel)}</td>
              </tr>
            )}

            <tr className="sep">
              <td>Cost of House</td>
              <td>{money(country.houseCost)}</td>
            </tr>
            {hotelInPlay && (
              <tr>
                <td>Cost of Hotel</td>
                <td>{money(country.hotelCost)}</td>
              </tr>
            )}
            <tr>
              <td>Bank Mortgage Value</td>
              <td>{money(country.mortgage)}</td>
            </tr>
            {holding.mortgaged && (
              <tr>
                <td>Cost to lift mortgage</td>
                <td>{money(unmortgageCost(state, propertyId))}</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="rent-note">
          Holding {required} cards of one colour doubles the SITE rent on every unimproved card of
          that colour. The moment a house goes up here, this card leaves the doubling behind and
          charges its printed building rent instead — the rest of the colour group keeps its
          doubled site rent. You do not need a colour group to build: landing on a country you
          already own is enough, up to {maxLevel} house{maxLevel === 1 ? '' : 's'}.
        </div>

        <div className="prop-meta">
          <span className="chip">Building level: {BUILDING_LEVEL_LABELS[level]}</span>
          {groupComplete && <span className="chip">Colour group complete</span>}
          {holding.mortgaged ? (
            <span className="tag tag-mortgaged">Mortgaged</span>
          ) : (
            <span className="chip">Not mortgaged</span>
          )}
        </div>
      </div>
    )
  }

  if (asset) {
    const paired = owner ? ownsAssetPair(state, owner.id, propertyId) : false
    const partner = SPECIAL_ASSETS[asset.pairWith]

    return (
      <div className="prop-card">
        <div
          className="prop-banner"
          style={{ background: 'linear-gradient(94deg, #00c2c7, #2e86ff)' }}
        >
          <span className="flag">{asset.icon}</span>
          <div>
            <h3>{asset.name}</h3>
            <span>Transport / Utility asset</span>
          </div>
        </div>

        <table className="rent-table">
          <tbody>
            <tr>
              <td>Purchase price</td>
              <td>{money(asset.price)}</td>
            </tr>
            <tr>
              <td>Owner</td>
              <td style={{ color: owner?.colourHex }}>{owner ? owner.name : 'Bank'}</td>
            </tr>
            <tr className={`sep${!paired ? ' is-current' : ''}`}>
              <td>Normal rent</td>
              <td>{money(asset.rent)}</td>
            </tr>
            <tr className={paired ? 'is-current' : ''}>
              <td>Rent if owner also holds {partner.name}</td>
              <td>{money(asset.pairedRent)}</td>
            </tr>
            <tr className="sep">
              <td>Paired asset required</td>
              <td>
                {partner.icon} {partner.name}
              </td>
            </tr>
            <tr>
              <td>Bank Mortgage Value</td>
              <td>{money(asset.mortgage)}</td>
            </tr>
            {holding.mortgaged && (
              <tr>
                <td>Cost to lift mortgage</td>
                <td>{money(unmortgageCost(state, propertyId))}</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="rent-note">
          Transport and utility assets never take houses or hotels, and they are never counted by
          Custom Duty or Travelling Duty.
        </div>

        <div className="prop-meta">
          {paired && <span className="chip">Pair bonus active</span>}
          {holding.mortgaged ? (
            <span className="tag tag-mortgaged">Mortgaged</span>
          ) : (
            <span className="chip">Not mortgaged</span>
          )}
        </div>
      </div>
    )
  }

  return null
}
