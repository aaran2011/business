/**
 * Short prices, for the phone board only.
 *
 * Presentation, never data: a country priced 3500 is still 3500 everywhere
 * the rules look, and the desktop board still reads "$3,500". This only
 * decides how that number is WRITTEN in a 31px-wide space.
 *
 *   3500  -> $3.5k      4000  -> $4k      10500 -> $10.5k
 *   1250  -> $1.25k     800   -> $800
 */
export function compactMoney(amount: number): string {
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(Math.round(amount))
  if (abs < 1000) return `${sign}$${abs}`
  // Two decimals at most, and never a trailing zero: 3.50 reads as 3.5.
  const thousands = (abs / 1000).toFixed(2).replace(/\.?0+$/, '')
  return `${sign}$${thousands}k`
}
