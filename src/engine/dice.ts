/** Dice logic. Kept isolated so it can be seeded or mocked for testing. */

export function rollDie(faces = 6): number {
  return 1 + Math.floor(Math.random() * faces)
}

/**
 * The movement dice. How many are rolled comes from settings — the game runs
 * on a single die by default.
 */
export function rollDice(count: number, faces = 6): number[] {
  return Array.from({ length: count }, () => rollDie(faces))
}

export function diceTotal(dice: number[]): number {
  return dice.reduce((sum, d) => sum + d, 0)
}

/** The single die used three times for a Jail escape attempt. */
export function rollJailDice(count: number): number[] {
  return Array.from({ length: count }, () => rollDie())
}
