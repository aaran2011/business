import { BUILDING_LEVEL_LABELS, BUILDING_LEVEL_RENT_KEYS, COUNTRIES } from '../data/properties'
import { canBuild } from '../engine/building'
import { money } from '../engine/log'
import { getPlayer } from '../engine/queries'
import { calculateRent } from '../engine/rent'
import type { GameState } from '../engine/types'
import { HotelIcon, HouseIcon } from './BuildingIcons'

/**
 * Shown when a player lands on a country they already own: what a building
 * costs, what the space earns now, and what it would earn afterwards.
 */
export function BuildOffer({
  state,
  playerId,
  propertyId,
}: {
  state: GameState
  playerId: string
  propertyId: string
}) {
  const def = COUNTRIES[propertyId]
  if (!def) return null

  const player = getPlayer(state, playerId)
  const level = state.holdings[propertyId].buildings
  const check = canBuild(state, playerId, propertyId)
  const maxLevel = state.settings.buildings.maxLevel
  const nextLevel = Math.min(level + 1, maxLevel)

  const currentRent = calculateRent(state, propertyId)
  const rentAfter = def.rent[BUILDING_LEVEL_RENT_KEYS[nextLevel]]
  const isHotelStep = nextLevel === 4
  const atMax = level >= maxLevel
  const stepCost = check.cost || (isHotelStep ? def.hotelCost : def.houseCost)

  const headline = atMax
    ? maxLevel >= 4
      ? `${def.name} is fully built with a Hotel.`
      : `${def.name} already has the maximum of ${maxLevel} houses.`
    : `Would you like to build ${isHotelStep ? 'a Hotel' : 'a house'} on ${def.name} for ${money(stepCost)}?`

  return (
    <div className="build-offer">
      <div className="build-offer-head">
        <span className="build-offer-flag">{def.flag}</span>
        <div>
          <strong>This country is yours.</strong>
          <div className="build-offer-sub">{headline}</div>
        </div>
      </div>

      <div className="build-standing">
        <span className="build-standing-label">Standing here</span>
        <span className="build-standing-icons">
          {level === 0 && <span className="build-none">Site only — nothing built yet</span>}
          {level > 0 && level < 4 && (
            <>
              {Array.from({ length: level }, (_, i) => (
                <HouseIcon key={i} colour={player.colourHex} />
              ))}
              <span className="build-count">
                {level} of {Math.min(maxLevel, 3)} house{level === 1 ? '' : 's'}
              </span>
            </>
          )}
          {level === 4 && (
            <>
              <HotelIcon colour={player.colourHex} />
              <span className="build-count">Hotel</span>
            </>
          )}
        </span>
      </div>

      <table className="rent-table build-table">
        <tbody>
          <tr>
            <td>{isHotelStep ? 'Cost of Hotel' : 'Cost of House'}</td>
            <td>{money(isHotelStep ? def.hotelCost : def.houseCost)}</td>
          </tr>
          <tr>
            <td>Current rent — {BUILDING_LEVEL_LABELS[level]}</td>
            <td>{money(currentRent.amount)}</td>
          </tr>
          {!atMax && (
            <tr className="is-current">
              <td>Rent after building — {BUILDING_LEVEL_LABELS[nextLevel]}</td>
              <td>{money(rentAfter)}</td>
            </tr>
          )}
          <tr>
            <td>Your cash</td>
            <td>{money(player.cash)}</td>
          </tr>
        </tbody>
      </table>

      {!check.allowed && !atMax && <div className="build-blocked">{check.reason}</div>}
      <div className="rent-note">
        You do not need a colour group to build — landing on a country you already own is enough.
        Each country takes up to {Math.min(maxLevel, 3)} houses
        {maxLevel >= 4 ? ', then upgrades to a Hotel' : ''}, and every house appears on the board in
        your colour. Once a house is built here, this card charges its printed building rent and
        the colour-group doubling no longer applies to it.
      </div>
    </div>
  )
}
