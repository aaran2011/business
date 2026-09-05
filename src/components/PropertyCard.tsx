import { COLOUR_GROUP_LABELS, COUNTRIES } from '../data/properties'
import { SPECIAL_ASSETS } from '../data/specialAssets'
import { money } from '../engine/log'
import { unmortgageCost } from '../engine/mortgage'
import { ownsAssetPair } from '../engine/queries'
import { rentTable } from '../engine/rent'
import type { GameState } from '../engine/types'

const GROUP_COLOUR: Record<string, string> = {
  green: '#2fa563',
  red: '#d94452',
  blue: '#3182ce',
  gold: '#e2a32b',
}

/**
 * The card for a country or a special asset, shown when a player LANDS on it.
 * Nothing opens this by tapping the board.
 *
 * Deliberately short. It has to fit an iPhone 12 mini without scrolling, so it
 * carries the numbers a decision actually needs — the rents, what a house
 * costs, the mortgage value — and leaves out what the board already shows
 * (who owns it, whether it is mortgaged, which building level it is on).
 */
export function PropertyCard({ state, propertyId }: { state: GameState; propertyId: string }) {
  const holding = state.holdings[propertyId]
  const owner = holding?.ownerId ? state.players.find((p) => p.id === holding.ownerId) : null
  const country = COUNTRIES[propertyId]
  const asset = SPECIAL_ASSETS[propertyId]

  if (country) {
    const rents = rentTable(state, propertyId)!
    const level = holding.buildings
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
          <span className="prop-price">{money(country.price)}</span>
        </div>

        <table className="rent-table">
          <tbody>
            <tr className={level === 0 ? 'is-current' : ''}>
              <td>Site rent</td>
              <td>
                {money(rents.site)}
                <small className="rent-alt"> · {money(rents.groupSite)} with 3</small>
              </td>
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
              <td>House</td>
              <td>{money(country.houseCost)}</td>
            </tr>
            <tr>
              <td>Mortgage</td>
              <td>{money(country.mortgage)}</td>
            </tr>
            {holding.mortgaged && (
              <tr>
                <td>Lift mortgage</td>
                <td>{money(unmortgageCost(state, propertyId))}</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="rent-note">
          Owning 3 cards of the same colour doubles the SITE rent. Building a house on a card
          removes the doubling for that card; its rent becomes the printed building rent.
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
            <span>Transport / utility</span>
          </div>
          <span className="prop-price">{money(asset.price)}</span>
        </div>

        <table className="rent-table">
          <tbody>
            <tr className={!paired ? 'is-current' : ''}>
              <td>Rent</td>
              <td>{money(asset.rent)}</td>
            </tr>
            <tr className={paired ? 'is-current' : ''}>
              <td>With {partner.name}</td>
              <td>{money(asset.pairedRent)}</td>
            </tr>
            <tr className="sep">
              <td>Mortgage</td>
              <td>{money(asset.mortgage)}</td>
            </tr>
            {holding.mortgaged && (
              <tr>
                <td>Lift mortgage</td>
                <td>{money(unmortgageCost(state, propertyId))}</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="rent-note">
          Transport and utility assets never take houses, and are never counted by Custom Duty or
          Travelling Duty.
        </div>
      </div>
    )
  }

  return null
}
