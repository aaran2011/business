/**
 * ============================================================================
 * COUNTRY PROPERTY DATA — transcribed exactly from the printed cards.
 * ============================================================================
 * Some values are deliberately unusual (England and Italy in particular).
 * They are correct as printed. Do not "fix" them.
 */

export type ColourGroup = 'green' | 'red' | 'blue' | 'gold'

export interface CountryDef {
  id: string
  name: string
  flag: string
  colour: ColourGroup
  price: number
  rent: {
    /** Site only, no buildings. */
    site: number
    house1: number
    house2: number
    house3: number
    hotel: number
  }
  houseCost: number
  hotelCost: number
  mortgage: number
}

export const COLOUR_GROUP_LABELS: Record<ColourGroup, string> = {
  green: 'Green',
  red: 'Red',
  blue: 'Blue',
  gold: 'Yellow / Gold',
}

export const COUNTRIES: Record<string, CountryDef> = {
  australia: {
    id: 'australia',
    name: 'Australia',
    flag: '\u{1F1E6}\u{1F1FA}',
    colour: 'gold',
    price: 3300,
    rent: { site: 400, house1: 1400, house2: 2800, house3: 4200, hotel: 5200 },
    houseCost: 3300,
    hotelCost: 3300,
    mortgage: 2000,
  },
  switzerland: {
    id: 'switzerland',
    name: 'Switzerland',
    flag: '\u{1F1E8}\u{1F1ED}',
    colour: 'red',
    price: 3500,
    rent: { site: 700, house1: 1700, house2: 3400, house3: 5100, hotel: 6100 },
    houseCost: 6500,
    hotelCost: 6500,
    mortgage: 3300,
  },
  saudiArabia: {
    id: 'saudiArabia',
    name: 'Saudi Arabia',
    flag: '\u{1F1F8}\u{1F1E6}',
    colour: 'green',
    price: 5500,
    rent: { site: 600, house1: 1600, house2: 3200, house3: 4800, hotel: 5800 },
    houseCost: 5500,
    hotelCost: 5500,
    mortgage: 2800,
  },
  iran: {
    id: 'iran',
    name: 'Iran',
    flag: '\u{1F1EE}\u{1F1F7}',
    colour: 'green',
    price: 2500,
    rent: { site: 300, house1: 1300, house2: 2600, house3: 3900, hotel: 4900 },
    houseCost: 2500,
    hotelCost: 2500,
    mortgage: 1250,
  },
  iraq: {
    id: 'iraq',
    name: 'Iraq',
    flag: '\u{1F1EE}\u{1F1F6}',
    colour: 'green',
    price: 5000,
    rent: { site: 500, house1: 1500, house2: 3000, house3: 4500, hotel: 5500 },
    houseCost: 5000,
    hotelCost: 5000,
    mortgage: 2500,
  },
  malaysia: {
    id: 'malaysia',
    name: 'Malaysia',
    flag: '\u{1F1F2}\u{1F1FE}',
    colour: 'green',
    price: 1500,
    rent: { site: 200, house1: 1200, house2: 2400, house3: 3600, hotel: 4600 },
    houseCost: 1500,
    hotelCost: 1500,
    mortgage: 800,
  },
  hongKong: {
    id: 'hongKong',
    name: 'Hong Kong',
    flag: '\u{1F1ED}\u{1F1F0}',
    colour: 'blue',
    price: 2000,
    rent: { site: 200, house1: 1200, house2: 2400, house3: 3600, hotel: 4600 },
    houseCost: 2500,
    hotelCost: 2500,
    mortgage: 1000,
  },
  singapore: {
    id: 'singapore',
    name: 'Singapore',
    flag: '\u{1F1F8}\u{1F1EC}',
    colour: 'blue',
    price: 3000,
    rent: { site: 300, house1: 1300, house2: 2600, house3: 3900, hotel: 4900 },
    houseCost: 3000,
    hotelCost: 3000,
    mortgage: 1500,
  },
  mexico: {
    id: 'mexico',
    name: 'Mexico',
    flag: '\u{1F1F2}\u{1F1FD}',
    colour: 'gold',
    price: 4000,
    rent: { site: 900, house1: 1800, house2: 3600, house3: 5400, hotel: 6400 },
    houseCost: 4000,
    hotelCost: 4000,
    mortgage: 2000,
  },
  brazil: {
    id: 'brazil',
    name: 'Brazil',
    flag: '\u{1F1E7}\u{1F1F7}',
    colour: 'gold',
    price: 2500,
    rent: { site: 300, house1: 1300, house2: 2600, house3: 3900, hotel: 4900 },
    houseCost: 2500,
    hotelCost: 2500,
    mortgage: 1300,
  },
  canada: {
    id: 'canada',
    name: 'Canada',
    flag: '\u{1F1E8}\u{1F1E6}',
    colour: 'gold',
    price: 4000,
    rent: { site: 400, house1: 1400, house2: 2800, house3: 4200, hotel: 5200 },
    houseCost: 4000,
    hotelCost: 4000,
    mortgage: 2000,
  },
  japan: {
    id: 'japan',
    name: 'Japan',
    flag: '\u{1F1EF}\u{1F1F5}',
    colour: 'blue',
    price: 2500,
    rent: { site: 250, house1: 1250, house2: 2500, house3: 3750, hotel: 4750 },
    houseCost: 2500,
    hotelCost: 2500,
    mortgage: 1250,
  },
  germany: {
    id: 'germany',
    name: 'Germany',
    flag: '\u{1F1E9}\u{1F1EA}',
    colour: 'red',
    price: 3500,
    rent: { site: 400, house1: 1400, house2: 2800, house3: 4200, hotel: 5200 },
    houseCost: 3500,
    hotelCost: 3500,
    mortgage: 1750,
  },
  usa: {
    id: 'usa',
    name: 'USA',
    flag: '\u{1F1FA}\u{1F1F8}',
    colour: 'gold',
    price: 8500,
    rent: { site: 1000, house1: 2000, house2: 4000, house3: 6000, hotel: 7000 },
    houseCost: 8500,
    hotelCost: 8500,
    mortgage: 5000,
  },
  france: {
    id: 'france',
    name: 'France',
    flag: '\u{1F1EB}\u{1F1F7}',
    colour: 'red',
    price: 2500,
    rent: { site: 300, house1: 1300, house2: 2600, house3: 3900, hotel: 4900 },
    houseCost: 2500,
    hotelCost: 2500,
    mortgage: 1250,
  },
  china: {
    id: 'china',
    name: 'China',
    flag: '\u{1F1E8}\u{1F1F3}',
    colour: 'blue',
    price: 4500,
    rent: { site: 450, house1: 1450, house2: 2900, house3: 4350, hotel: 5350 },
    houseCost: 4500,
    hotelCost: 4500,
    mortgage: 2250,
  },
  india: {
    id: 'india',
    name: 'India',
    flag: '\u{1F1EE}\u{1F1F3}',
    colour: 'blue',
    price: 4500,
    rent: { site: 550, house1: 1550, house2: 3100, house3: 4650, hotel: 5650 },
    houseCost: 5500,
    hotelCost: 5500,
    mortgage: 2750,
  },
  egypt: {
    id: 'egypt',
    name: 'Egypt',
    flag: '\u{1F1EA}\u{1F1EC}',
    colour: 'green',
    price: 3200,
    rent: { site: 300, house1: 1300, house2: 2600, house3: 3900, hotel: 4900 },
    houseCost: 3200,
    hotelCost: 3200,
    mortgage: 1500,
  },
  england: {
    id: 'england',
    name: 'England',
    flag: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',
    colour: 'red',
    price: 2500,
    rent: { site: 700, house1: 1700, house2: 3400, house3: 5100, hotel: 6100 },
    houseCost: 7000,
    hotelCost: 7000,
    mortgage: 3500,
  },
  italy: {
    id: 'italy',
    name: 'Italy',
    flag: '\u{1F1EE}\u{1F1F9}',
    colour: 'red',
    price: 3500,
    rent: { site: 200, house1: 1200, house2: 2400, house3: 3600, hotel: 4600 },
    houseCost: 2000,
    hotelCost: 2000,
    mortgage: 1000,
  },
}

export const COUNTRY_IDS = Object.keys(COUNTRIES)

export const COUNTRIES_BY_COLOUR: Record<ColourGroup, string[]> = COUNTRY_IDS.reduce(
  (acc, id) => {
    acc[COUNTRIES[id].colour].push(id)
    return acc
  },
  { green: [], red: [], blue: [], gold: [] } as Record<ColourGroup, string[]>,
)

/** Rent for a given building level. 0 = site only, 1-3 = houses, 4 = hotel. */
export const BUILDING_LEVEL_RENT_KEYS = ['site', 'house1', 'house2', 'house3', 'hotel'] as const

export const BUILDING_LEVEL_LABELS = [
  'Site only',
  '1 House',
  '2 Houses',
  '3 Houses',
  'Hotel',
] as const
