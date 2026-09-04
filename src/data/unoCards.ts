/**
 * ============================================================================
 * UNO CARDS — keyed by the dice total that moved the player onto UNO.
 * ============================================================================
 * The player does NOT roll again. The same total that brought them here
 * selects the card.
 *
 *   EVEN total = PROFIT
 *   ODD total  = LOSS
 */

export type CardEffect =
  /** Straight bank payment. Positive = receive, negative = pay. */
  | { type: 'bank'; amount: number }
  /** Collect `amount` from every other active player. */
  | { type: 'collectFromEach'; amount: number }
  /** Pay `amount` to every other active player. */
  | { type: 'payEach'; amount: number }
  /** Move directly to a board space, then resolve it. */
  | { type: 'goToPartyHouse' }
  | { type: 'goToJail' }
  /** $50 per house + $100 per hotel, from settings. */
  | { type: 'generalRepairs' }
  /** Explicitly nothing happens. */
  | { type: 'none' }

export interface EventCard {
  total: number
  title: string
  description: string
  effect: CardEffect
}

export const UNO_CARDS: Record<number, EventCard> = {
  // ---- EVEN = PROFIT ----
  2: {
    total: 2,
    title: 'Anniversary',
    description: 'Collect $500 from each other active player.',
    effect: { type: 'collectFromEach', amount: 500 },
  },
  4: {
    total: 4,
    title: 'First Prize in Beauty Contest',
    description: 'Receive $2,500 from the Bank.',
    effect: { type: 'bank', amount: 2500 },
  },
  6: {
    total: 6,
    title: 'Income Tax Refund',
    description: 'Receive $2,000 from the Bank.',
    effect: { type: 'bank', amount: 2000 },
  },
  8: {
    total: 8,
    title: 'Go to Party House',
    description: 'Move directly to Party House and collect $200 from every other active player.',
    effect: { type: 'goToPartyHouse' },
  },
  10: {
    total: 10,
    title: 'Interest on Shares',
    description: 'Receive $1,500 from the Bank.',
    effect: { type: 'bank', amount: 1500 },
  },
  12: {
    total: 12,
    title: 'Sale of Stocks',
    description: 'Receive $3,000 from the Bank.',
    effect: { type: 'bank', amount: 3000 },
  },

  // ---- ODD = LOSS ----
  3: {
    total: 3,
    title: 'Go Directly to Jail',
    description: 'Move straight to Jail.',
    effect: { type: 'goToJail' },
  },
  5: {
    total: 5,
    title: 'School & Medical Fees',
    description: 'Pay $2,500 to the Bank.',
    effect: { type: 'bank', amount: -2500 },
  },
  7: {
    total: 7,
    title: 'No Effect',
    description:
      'The original physical game used a Passport rule here. The online game does not use Passports, so nothing happens.',
    effect: { type: 'none' },
  },
  9: {
    total: 9,
    title: 'General Repairs',
    description: 'Pay $50 for every house owned and $100 for every hotel owned.',
    effect: { type: 'generalRepairs' },
  },
  11: {
    total: 11,
    title: 'Insurance Premium',
    description: 'Pay $1,500 to the Bank.',
    effect: { type: 'bank', amount: -1500 },
  },
}
