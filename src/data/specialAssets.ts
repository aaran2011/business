/**
 * ============================================================================
 * SPECIAL TRANSPORT / UTILITY ASSETS — transcribed exactly.
 * ============================================================================
 * These can be bought and mortgaged but never carry houses or hotels.
 * Each has a partner: owning both raises this asset's rent to `pairedRent`.
 *
 * They are NOT countries and must never be counted by Custom Duty or
 * Travelling Duty.
 */

export interface SpecialAssetDef {
  id: string
  name: string
  icon: string
  price: number
  rent: number
  /** Rent when the same player also owns `pairWith`. */
  pairedRent: number
  pairWith: string
  mortgage: number
}

export const SPECIAL_ASSETS: Record<string, SpecialAssetDef> = {
  satellite: {
    id: 'satellite',
    name: 'Satellite',
    icon: '\u{1F6F0}️',
    price: 2000,
    rent: 500,
    pairedRent: 1000,
    pairWith: 'waterways',
    mortgage: 1250,
  },
  waterways: {
    id: 'waterways',
    name: 'Waterways',
    icon: '\u{1F6A2}',
    price: 9500,
    rent: 1400,
    pairedRent: 2200,
    pairWith: 'satellite',
    mortgage: 2000,
  },
  roadways: {
    id: 'roadways',
    name: 'Roadways',
    icon: '\u{1F69B}',
    price: 3500,
    rent: 800,
    pairedRent: 1500,
    pairWith: 'railways',
    mortgage: 1800,
  },
  railways: {
    id: 'railways',
    name: 'Railways',
    icon: '\u{1F682}',
    price: 9500,
    rent: 1500,
    pairedRent: 2500,
    pairWith: 'roadways',
    mortgage: 5000,
  },
  petroleum: {
    id: 'petroleum',
    name: 'Petroleum',
    icon: '\u{1F6E2}️',
    price: 5500,
    rent: 500,
    pairedRent: 1000,
    pairWith: 'airways',
    mortgage: 1300,
  },
  airways: {
    id: 'airways',
    name: 'Airways',
    icon: '✈️',
    price: 10500,
    rent: 1500,
    pairedRent: 2500,
    pairWith: 'petroleum',
    mortgage: 5500,
  },
}

export const SPECIAL_ASSET_IDS = Object.keys(SPECIAL_ASSETS)
