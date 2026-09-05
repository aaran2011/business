/**
 * The middle of the board.
 *
 * Deliberately almost empty: this is where the dice sit, and where a property
 * or event card opens when someone lands on something. A decorative globe used
 * to live here and it left no room for either.
 */
export function BoardCentre() {
  return (
    <div className="centrepiece" aria-hidden="true">
      <div className="centre-wordmark">BUSINESS</div>
    </div>
  )
}
