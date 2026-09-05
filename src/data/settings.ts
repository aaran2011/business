/**
 * ============================================================================
 * GAME SETTINGS — every tunable rule value lives here.
 * ============================================================================
 * Nothing in the UI hard-codes a price, a rent or a rule threshold.
 * Change a number here and the whole game changes.
 *
 * Values marked [PRINTED] come straight from the printed International
 * Business rules supplied by the game owner. Do not "correct" them.
 *
 * Values marked [NOT PRINTED] were NOT specified in the supplied rules. They
 * are exposed here (and in the in-game House Rules panel) so they can be set
 * deliberately rather than invented and buried in code.
 */

export type EliminationAssetDestination = 'bank' | 'creditor'

export interface GameSettings {
  /** [PRINTED] Cash every player starts with. */
  startingCash: number

  /** [PRINTED] Player-count bounds. */
  minPlayers: number
  maxPlayers: number

  dice: {
    /**
     * How many dice are rolled for movement.
     *
     * IMPORTANT: the printed UNO and Chance decks are keyed by the dice TOTAL
     * and only define cards for totals 2-12, because the printed game used two
     * dice. With one die the reachable totals are 1-6, so cards 7-12 can never
     * be drawn and a total of 1 has no printed card at all — see
     * `unoChanceMissingCardIsNoEffect`. Set this back to 2 to restore the full
     * printed decks.
     */
    count: number
    faces: number
    /** How long the tumble animation runs before the dice settle. */
    rollAnimationMs: number
  }

  turn: {
    /** End the turn automatically once no decision is outstanding. */
    autoEnd: boolean
    /** Beat before the automatic end, so the result stays readable. */
    autoEndDelayMs: number
  }

  startBonus: {
    /** [PRINTED] Paid when a player passes START or lands on START. */
    amount: number
    /**
     * [NOT PRINTED] The printed rules only say the UNO "Go to Party House"
     * card pays START money if the move actually crosses START. These two
     * flags decide whether the same applies to other forced moves.
     */
    awardOnForcedMoveToPartyHouse: boolean
    awardOnForcedMoveToJail: boolean
  }

  colourGroups: {
    /** Cards of one colour that make a complete group. */
    sizeRequired: number
    /**
     * Holding a complete group DOUBLES the Site Only rent on every unimproved
     * card of that colour. The moment a house goes up on a card, that card
     * leaves the doubling behind and charges its printed building rent — the
     * other unimproved cards in the group keep their doubled site rent.
     */
    unimprovedSiteRentMultiplier: number
    /**
     * Whether a complete colour group is also needed before you may BUILD.
     * Off: landing on a country you already own always lets you build there.
     * The group still doubles unimproved site rent either way.
     */
    requiredForBuilding: boolean
    /**
     * [NOT PRINTED] Do mortgaged cards still count toward the 3-card group?
     * (A mortgaged property never collects rent either way.)
     */
    mortgagedCardsCountTowardGroup: boolean
  }

  buildings: {
    /**
     * Top building level. 3 = SITE -> 1H -> 2H -> 3H, a maximum of three
     * houses per country. 4 adds the printed HOTEL tier on top.
     */
    maxLevel: number
    /**
     * [NOT PRINTED] The printed rules give no sell-back price for houses or
     * hotels. Refund = printed build cost x this ratio. Editable in-game.
     */
    sellRefundRatio: number
    /**
     * [NOT PRINTED] Must houses be built evenly across a colour group?
     * The printed rules say nothing about even building, so this is off.
     */
    requireEvenBuilding: boolean
  }

  mortgage: {
    /** [PRINTED] Unmortgaging costs the printed mortgage value back. */
    unmortgageInterestRate: number
    /** [NOT PRINTED] Whether a property must be building-free to mortgage. */
    requireNoBuildings: boolean
  }

  /** [PRINTED] Party House: lander RECEIVES this from each other player. */
  partyHousePerPlayer: number
  /** [PRINTED] Resort: lander PAYS this to each other player. */
  resortPerPlayer: number

  /** [PRINTED] $100 per country owned, capped at $1,000. */
  customDuty: { perCountry: number; max: number }
  /** [PRINTED] $50 per country owned, capped at $500. */
  travellingDuty: { perCountry: number; max: number }

  /** [PRINTED] UNO 9 — General Repairs. */
  generalRepairs: { perHouse: number; perHotel: number }

  jail: {
    /** [PRINTED] Option A — pay the bank to be released immediately. */
    payToEscape: number
    /** [PRINTED] Option B — a total of THREE rolls of one die per attempt. */
    escapeDieRolls: number
    /**
     * How many of those rolls are taken per turn. 1 means the attempt is spread
     * across three turns: one roll each turn, the total carrying over. Set it
     * to `escapeDieRolls` to take all three in a single turn instead.
     */
    escapeRollsPerTurn: number
    /** [PRINTED] Release on a total of 12 or more. */
    escapeTargetTotal: number
    /**
     * [NOT PRINTED] The printed rules only send players to Jail via UNO 3 and
     * Chance 10. Landing on the Jail space by dice is treated as visiting.
     */
    landingOnJailIsJustVisiting: boolean
  }

  elimination: {
    /**
     * [NOT PRINTED] Where an eliminated player's properties go. 'bank'
     * returns them to the market unowned and building-free; 'creditor'
     * hands them to the player who bankrupted them.
     */
    assetsGoTo: EliminationAssetDestination
  }

  /**
   * [NOT PRINTED] With one die a UNO or Chance total of 1 is possible, and the
   * printed decks have no card for it. When true the space simply has no
   * effect and says so, rather than a card being invented.
   */
  unoChanceMissingCardIsNoEffect: boolean

  netWorth: {
    /** Count money spent on houses/hotels toward total wealth. */
    includeBuildingCost: boolean
    /**
     * How a mortgaged property is valued on the leaderboard.
     * 'equity'  = purchase price minus the mortgage owed
     * 'price'   = full purchase price
     * 'zero'    = not counted
     */
    mortgagedPropertyValue: 'equity' | 'price' | 'zero'
  }

  /** Milliseconds per board space during pawn movement. */
  moveStepMs: number
  /**
   * How long the token sits on its new space before a card opens over the
   * middle of the board. Without this the landing is covered instantly and you
   * never see where you actually went.
   */
  landingPauseMs: number
}

export const DEFAULT_SETTINGS: GameSettings = {
  startingCash: 25000,

  minPlayers: 2,
  maxPlayers: 6,

  dice: { count: 1, faces: 6, rollAnimationMs: 1700 },

  turn: { autoEnd: true, autoEndDelayMs: 550 },

  startBonus: {
    amount: 1500,
    awardOnForcedMoveToPartyHouse: true,
    awardOnForcedMoveToJail: false,
  },

  colourGroups: {
    sizeRequired: 3,
    unimprovedSiteRentMultiplier: 2,
    // Building is open on any country you own — the group only doubles rent.
    requiredForBuilding: false,
    mortgagedCardsCountTowardGroup: true,
  },

  buildings: {
    // Three houses per country. Set to 4 to restore the printed HOTEL tier.
    maxLevel: 3,
    sellRefundRatio: 0.5,
    requireEvenBuilding: false,
  },

  mortgage: {
    unmortgageInterestRate: 0,
    requireNoBuildings: true,
  },

  partyHousePerPlayer: 200,
  resortPerPlayer: 200,

  customDuty: { perCountry: 100, max: 1000 },
  travellingDuty: { perCountry: 50, max: 500 },

  generalRepairs: { perHouse: 50, perHotel: 100 },

  jail: {
    payToEscape: 500,
    escapeDieRolls: 3,
    // One roll per turn: an escape attempt plays out over three turns.
    escapeRollsPerTurn: 1,
    escapeTargetTotal: 12,
    landingOnJailIsJustVisiting: true,
  },

  elimination: { assetsGoTo: 'bank' },

  unoChanceMissingCardIsNoEffect: true,

  netWorth: { includeBuildingCost: true, mortgagedPropertyValue: 'equity' },

  // Deliberately unhurried, so the pawn can be followed space by space.
  moveStepMs: 320,
  landingPauseMs: 1400,
}

/** Durations offered by the Timer button, in minutes. */
export const TIMER_PRESETS = [5, 10, 15, 20, 30, 45, 60, 90] as const

/**
 * Settings that were NOT covered by the printed rules and are surfaced in the
 * in-game House Rules panel so they can be agreed at the table.
 */
export const UNCONFIRMED_SETTINGS = [
  {
    path: 'buildings.sellRefundRatio',
    label: 'House / hotel sell-back refund',
    detail:
      'The printed rules allow selling buildings but give no sell price. Refund = printed build cost x this ratio.',
  },
  {
    path: 'elimination.assetsGoTo',
    label: 'Eliminated player’s properties go to',
    detail: 'The printed rules do not say whether they return to the bank or pass to the creditor.',
  },
  {
    path: 'startBonus.awardOnForcedMoveToJail',
    label: 'START money when sent to Jail',
    detail:
      'The printed rules only mention crossing START on the UNO "Go to Party House" card. Chance 10 from the second Chance space would otherwise cross START on the way to Jail.',
  },
  {
    path: 'jail.landingOnJailIsJustVisiting',
    label: 'Landing on Jail by dice is just visiting',
    detail: 'The printed rules only send players to Jail via UNO 3 and Chance 10.',
  },
  {
    path: 'dice.count',
    label: 'Number of movement dice',
    detail:
      'The printed UNO and Chance decks are keyed by the dice total and only cover 2-12, because the printed game used two dice. With one die, totals 7-12 can never come up and a total of 1 has no printed card — that space simply has no effect. Switch back to two dice to use the full decks.',
  },
] as const

/** [PRINTED] Banknote denominations in the physical set (display only). */
export const BANKNOTES = [50, 100, 500, 1000, 5000, 10000] as const
