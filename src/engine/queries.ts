/**
 * Read-only queries over game state: ownership, colour groups, net worth.
 * Nothing here mutates.
 */

import { COUNTRIES, COUNTRIES_BY_COLOUR, type ColourGroup } from '../data/properties'
import { SPECIAL_ASSETS } from '../data/specialAssets'
import type { GameState, Player } from './types'

export function isCountry(propertyId: string): boolean {
  return propertyId in COUNTRIES
}

export function isSpecialAsset(propertyId: string): boolean {
  return propertyId in SPECIAL_ASSETS
}

export function getPlayer(state: GameState, playerId: string): Player {
  const player = state.players.find((p) => p.id === playerId)
  if (!player) throw new Error(`Unknown player: ${playerId}`)
  return player
}

export function currentPlayer(state: GameState): Player {
  return getPlayer(state, state.turnOrder[state.currentIndex])
}

export function activePlayers(state: GameState): Player[] {
  return state.players.filter((p) => !p.isOut)
}

export function otherActivePlayers(state: GameState, playerId: string): Player[] {
  return state.players.filter((p) => !p.isOut && p.id !== playerId)
}

export function ownedPropertyIds(state: GameState, playerId: string): string[] {
  return Object.keys(state.holdings).filter((id) => state.holdings[id].ownerId === playerId)
}

/** Countries only — never the transport / utility assets. */
export function ownedCountryIds(state: GameState, playerId: string): string[] {
  return ownedPropertyIds(state, playerId).filter(isCountry)
}

export function ownedSpecialAssetIds(state: GameState, playerId: string): string[] {
  return ownedPropertyIds(state, playerId).filter(isSpecialAsset)
}

/**
 * Custom Duty and Travelling Duty both charge per normal country owned.
 * Airways, Waterways, Roadways, Railways, Satellite and Petroleum never count.
 */
export function countCountriesOwned(state: GameState, playerId: string): number {
  return ownedCountryIds(state, playerId).length
}

export function countCountriesOwnedInColour(
  state: GameState,
  playerId: string,
  colour: ColourGroup,
): number {
  const { mortgagedCardsCountTowardGroup } = state.settings.colourGroups
  return COUNTRIES_BY_COLOUR[colour].filter((id) => {
    const holding = state.holdings[id]
    if (holding.ownerId !== playerId) return false
    if (!mortgagedCardsCountTowardGroup && holding.mortgaged) return false
    return true
  }).length
}

/**
 * A "complete" group is the printed requirement of N cards of one colour
 * (3 by default), not all five cards of that colour.
 */
export function hasCompleteColourGroup(
  state: GameState,
  playerId: string,
  colour: ColourGroup,
): boolean {
  return (
    countCountriesOwnedInColour(state, playerId, colour) >= state.settings.colourGroups.sizeRequired
  )
}

/** True when the owner of a special asset also owns its printed partner. */
export function ownsAssetPair(state: GameState, playerId: string, assetId: string): boolean {
  const def = SPECIAL_ASSETS[assetId]
  if (!def) return false
  return state.holdings[def.pairWith]?.ownerId === playerId
}

export function countHouses(state: GameState, playerId: string): number {
  return ownedCountryIds(state, playerId).reduce((total, id) => {
    const level = state.holdings[id].buildings
    return total + (level >= 1 && level <= 3 ? level : 0)
  }, 0)
}

export function countHotels(state: GameState, playerId: string): number {
  return ownedCountryIds(state, playerId).reduce(
    (total, id) => total + (state.holdings[id].buildings === 4 ? 1 : 0),
    0,
  )
}

/** Money a property would return if mortgaged right now. */
export function mortgageValueOf(propertyId: string): number {
  return COUNTRIES[propertyId]?.mortgage ?? SPECIAL_ASSETS[propertyId]?.mortgage ?? 0
}

export function purchasePriceOf(propertyId: string): number {
  return COUNTRIES[propertyId]?.price ?? SPECIAL_ASSETS[propertyId]?.price ?? 0
}

export function displayNameOf(propertyId: string): string {
  return COUNTRIES[propertyId]?.name ?? SPECIAL_ASSETS[propertyId]?.name ?? propertyId
}

/** Refund for selling one building step off a property. */
export function buildingSellRefund(state: GameState, propertyId: string): number {
  const def = COUNTRIES[propertyId]
  if (!def) return 0
  const level = state.holdings[propertyId].buildings
  if (level <= 0) return 0
  const cost = level === 4 ? def.hotelCost : def.houseCost
  return Math.round(cost * state.settings.buildings.sellRefundRatio)
}

/** Total spent on buildings currently standing on a property. */
export function buildingsValueOf(state: GameState, propertyId: string): number {
  const def = COUNTRIES[propertyId]
  if (!def) return 0
  const level = state.holdings[propertyId].buildings
  if (level === 0) return 0
  if (level === 4) return def.houseCost * 3 + def.hotelCost
  return def.houseCost * level
}

/**
 * calculatePlayerAssets — cash plus everything the player still holds.
 * A player with no cash but valuable property can still rank highly.
 */
export interface PlayerAssets {
  cash: number
  propertyValue: number
  buildingValue: number
  countries: number
  specialAssets: number
  houses: number
  hotels: number
  mortgagedCount: number
  /** Cash raisable right now without selling to another player. */
  liquidatable: number
  netWorth: number
}

export function calculatePlayerAssets(state: GameState, playerId: string): PlayerAssets {
  const { includeBuildingCost, mortgagedPropertyValue } = state.settings.netWorth
  const ids = ownedPropertyIds(state, playerId)

  let propertyValue = 0
  let buildingValue = 0
  let mortgagedCount = 0
  let liquidatable = 0

  for (const id of ids) {
    const holding = state.holdings[id]
    const price = purchasePriceOf(id)
    const mortgage = mortgageValueOf(id)

    if (holding.mortgaged) {
      mortgagedCount++
      if (mortgagedPropertyValue === 'equity') propertyValue += price - mortgage
      else if (mortgagedPropertyValue === 'price') propertyValue += price
    } else {
      propertyValue += price
      liquidatable += mortgage
    }

    if (includeBuildingCost) buildingValue += buildingsValueOf(state, id)

    // Selling buildings down to site level is also a source of cash.
    let level = state.holdings[id].buildings
    const def = COUNTRIES[id]
    if (def) {
      const ratio = state.settings.buildings.sellRefundRatio
      while (level > 0) {
        liquidatable += Math.round((level === 4 ? def.hotelCost : def.houseCost) * ratio)
        level--
      }
    }
  }

  const player = getPlayer(state, playerId)

  return {
    cash: player.cash,
    propertyValue,
    buildingValue,
    countries: ids.filter(isCountry).length,
    specialAssets: ids.filter(isSpecialAsset).length,
    houses: countHouses(state, playerId),
    hotels: countHotels(state, playerId),
    mortgagedCount,
    liquidatable,
    netWorth: player.cash + propertyValue + buildingValue,
  }
}

/** The most cash a player could possibly raise to settle a debt. */
export function maxRaisableCash(state: GameState, playerId: string): number {
  const assets = calculatePlayerAssets(state, playerId)
  return assets.cash + assets.liquidatable
}

/**
 * checkElimination — a player is only out when they have no cash AND nothing
 * left that could produce cash. Zero cash alone never eliminates anyone.
 */
export function checkElimination(state: GameState, playerId: string, amountOwed: number): boolean {
  return maxRaisableCash(state, playerId) < amountOwed
}

export function debtOwedBy(state: GameState, playerId: string): number {
  const debt = state.debts[playerId]
  if (!debt) return 0
  return debt.payouts.reduce((sum, p) => sum + p.amount, 0)
}

export function hasUnsettledDebt(state: GameState, playerId: string): boolean {
  return debtOwedBy(state, playerId) > 0
}

/** Live leaderboard, richest first. */
export function leaderboard(state: GameState): { player: Player; assets: PlayerAssets }[] {
  return state.players
    .map((player) => ({ player, assets: calculatePlayerAssets(state, player.id) }))
    .sort((a, b) => {
      if (a.player.isOut !== b.player.isOut) return a.player.isOut ? 1 : -1
      return b.assets.netWorth - a.assets.netWorth
    })
}
