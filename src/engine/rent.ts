/**
 * Rent calculation.
 *
 * Two rules matter most here:
 *  1. An UNIMPROVED country in a complete colour group charges DOUBLE its
 *     printed Site Only rent.
 *  2. As soon as a house or hotel exists, the doubling STOPS. The printed
 *     building rent is charged exactly as written.
 */

import { BUILDING_LEVEL_RENT_KEYS, COUNTRIES } from '../data/properties'
import { SPECIAL_ASSETS } from '../data/specialAssets'
import { hasCompleteColourGroup, ownsAssetPair } from './queries'
import type { GameState } from './types'

export interface RentBreakdown {
  amount: number
  /** Human-readable reason, shown in the popup and the log. */
  label: string
  doubled: boolean
  paired: boolean
}

export function calculateRent(state: GameState, propertyId: string): RentBreakdown {
  const holding = state.holdings[propertyId]
  if (!holding || !holding.ownerId) {
    return { amount: 0, label: 'Unowned', doubled: false, paired: false }
  }
  if (holding.mortgaged) {
    return { amount: 0, label: 'Mortgaged — no rent', doubled: false, paired: false }
  }

  const country = COUNTRIES[propertyId]
  if (country) {
    const level = holding.buildings

    if (level > 0) {
      // Printed building rent. Never doubled.
      const key = BUILDING_LEVEL_RENT_KEYS[level]
      return {
        amount: country.rent[key],
        label: level === 4 ? 'Hotel rent' : `${level} House${level === 1 ? '' : 's'} rent`,
        doubled: false,
        paired: false,
      }
    }

    const site = country.rent.site
    const complete = hasCompleteColourGroup(state, holding.ownerId, country.colour)
    if (complete) {
      return {
        amount: site * state.settings.colourGroups.unimprovedSiteRentMultiplier,
        label: 'Site rent, doubled for a complete colour group',
        doubled: true,
        paired: false,
      }
    }
    return { amount: site, label: 'Site only rent', doubled: false, paired: false }
  }

  const asset = SPECIAL_ASSETS[propertyId]
  if (asset) {
    const paired = ownsAssetPair(state, holding.ownerId, propertyId)
    return {
      amount: paired ? asset.pairedRent : asset.rent,
      label: paired ? `Paired with ${SPECIAL_ASSETS[asset.pairWith].name}` : 'Normal rent',
      doubled: false,
      paired,
    }
  }

  return { amount: 0, label: 'No rent', doubled: false, paired: false }
}

/**
 * The rent a property would charge at each level, for the property card.
 * `groupSiteRent` is the doubled figure shown alongside the plain site rent.
 */
export function rentTable(state: GameState, propertyId: string) {
  const country = COUNTRIES[propertyId]
  if (!country) return null
  return {
    site: country.rent.site,
    groupSite: country.rent.site * state.settings.colourGroups.unimprovedSiteRentMultiplier,
    house1: country.rent.house1,
    house2: country.rent.house2,
    house3: country.rent.house3,
    hotel: country.rent.hotel,
  }
}
