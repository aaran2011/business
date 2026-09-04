/**
 * ============================================================================
 * CHANCE CARDS — keyed by the dice total that moved the player onto Chance.
 * ============================================================================
 * The player does NOT roll again. The same total that brought them here
 * selects the card.
 *
 * Note the polarity is the OPPOSITE of UNO:
 *   ODD total  = PROFIT
 *   EVEN total = LOSS
 */

import type { EventCard } from './unoCards'

export const CHANCE_CARDS: Record<number, EventCard> = {
  // ---- ODD = PROFIT ----
  3: {
    total: 3,
    title: 'Lottery Prize',
    description: 'Receive $2,500.',
    effect: { type: 'bank', amount: 2500 },
  },
  5: {
    total: 5,
    title: 'Crossword Prize',
    description: 'Receive $1,000.',
    effect: { type: 'bank', amount: 1000 },
  },
  7: {
    total: 7,
    title: 'Collection',
    description: 'Collect $100 from each other active player.',
    effect: { type: 'collectFromEach', amount: 100 },
  },
  9: {
    total: 9,
    title: 'Jackpot',
    description: 'Receive $2,000.',
    effect: { type: 'bank', amount: 2000 },
  },
  11: {
    total: 11,
    title: 'Best Performance in Export',
    description: 'Receive $1,500.',
    effect: { type: 'bank', amount: 1500 },
  },

  // ---- EVEN = LOSS ----
  2: {
    total: 2,
    title: 'Loss in Share Market',
    description: 'Pay $2,000.',
    effect: { type: 'bank', amount: -2000 },
  },
  4: {
    total: 4,
    title: 'Fine for Accident / Wrong Driving',
    description: 'Pay $1,000.',
    effect: { type: 'bank', amount: -1000 },
  },
  6: {
    total: 6,
    title: 'House Repairs',
    description: 'Pay $1,500.',
    effect: { type: 'bank', amount: -1500 },
  },
  8: {
    total: 8,
    title: 'Loss Due to Fire',
    description: 'Pay $3,000.',
    effect: { type: 'bank', amount: -3000 },
  },
  10: {
    total: 10,
    title: 'Go Directly to Jail',
    description: 'Move straight to Jail.',
    effect: { type: 'goToJail' },
  },
  12: {
    total: 12,
    title: 'Repair of Car',
    description: 'Pay $200.',
    effect: { type: 'bank', amount: -200 },
  },
}
