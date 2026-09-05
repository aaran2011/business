/**
 * ============================================================================
 * BOARD ORDER — exact clockwise order from the printed board.
 * ============================================================================
 * 36 spaces. Index 0 is START; the printed list's 37th entry ("Back to START")
 * is the wrap-around, not a separate space.
 *
 * 36 spaces lay out perfectly on a 10x10 ring, which puts the four printed
 * corner spaces exactly on the corners.
 *
 * START sits at the bottom-right and the path runs UP -> LEFT -> DOWN ->
 * RIGHT, repeating:
 *
 *   Party House (18) ......... top edge, travelling LEFT ......... Resort (9)
 *        |                                                             ^
 *   left edge                                                    right edge
 *   going DOWN                                                    going UP
 *        v                                                             |
 *      Jail (27) ........... bottom edge, travelling RIGHT ...... START (0)
 */

export type SpaceKind =
  | 'start'
  | 'country'
  | 'special'
  | 'uno'
  | 'chance'
  | 'resort'
  | 'partyHouse'
  | 'customDuty'
  | 'travellingDuty'
  | 'jail'

export interface BoardSpaceDef {
  index: number
  kind: SpaceKind
  /** Country id or special-asset id, for purchasable spaces. */
  propertyId?: string
  label: string
  icon?: string
}

const s = (kind: SpaceKind, label: string, icon?: string): Omit<BoardSpaceDef, 'index'> => ({
  kind,
  label,
  icon,
})

const country = (propertyId: string, label: string): Omit<BoardSpaceDef, 'index'> => ({
  kind: 'country',
  propertyId,
  label,
})

const special = (propertyId: string, label: string): Omit<BoardSpaceDef, 'index'> => ({
  kind: 'special',
  propertyId,
  label,
})

export const BOARD: BoardSpaceDef[] = [
  s('start', 'START', '\u{1F3C1}'),
  country('england', 'England'),
  country('iraq', 'Iraq'),
  special('waterways', 'Waterways'),
  s('uno', 'UNO', '\u{1F0CF}'),
  country('france', 'France'),
  country('iran', 'Iran'),
  special('satellite', 'Satellite'),
  country('egypt', 'Egypt'),
  s('resort', 'Resort', '\u{1F3D6}️'),
  country('canada', 'Canada'),
  country('germany', 'Germany'),
  special('airways', 'Airways'),
  s('customDuty', 'Custom Duty', '\u{1F6C3}'),
  country('switzerland', 'Switzerland'),
  country('brazil', 'Brazil'),
  s('chance', 'Chance', '\u{2753}'),
  country('italy', 'Italy'),
  s('partyHouse', 'Party House', '\u{1F389}'),
  country('japan', 'Japan'),
  country('usa', 'USA'),
  s('travellingDuty', 'Travelling Duty', '\u{1F6C4}'),
  special('roadways', 'Roadways'),
  country('mexico', 'Mexico'),
  country('hongKong', 'Hong Kong'),
  s('uno', 'UNO', '\u{1F0CF}'),
  country('australia', 'Australia'),
  s('jail', 'Jail', '\u{1F46E}'),
  country('india', 'India'),
  s('chance', 'Chance', '\u{2753}'),
  country('saudiArabia', 'Saudi Arabia'),
  special('petroleum', 'Petroleum'),
  country('china', 'China'),
  special('railways', 'Railways'),
  country('malaysia', 'Malaysia'),
  country('singapore', 'Singapore'),
].map((space, index) => ({ ...space, index }))

export const BOARD_SIZE = BOARD.length

export const START_INDEX = 0
export const JAIL_INDEX = BOARD.findIndex((sp) => sp.kind === 'jail')
export const PARTY_HOUSE_INDEX = BOARD.findIndex((sp) => sp.kind === 'partyHouse')

/** Spaces that can be owned. */
export const PURCHASABLE_SPACES = BOARD.filter(
  (sp) => sp.kind === 'country' || sp.kind === 'special',
)

const SIDE = 10

/**
 * How thick the playing track is relative to a centre cell. Above 1 the
 * property spaces get deeper and the middle of the board gets smaller.
 *
 * Note the trade-off: the ten tracks across an edge always share the full
 * width, so a thicker ring also makes each space slightly NARROWER. Push this
 * much past 2.2 and the longest country names (Switzerland) stop fitting.
 * The CSS grid template is derived from this, so the two can never drift.
 */
export const TRACK_RATIO = 2.5

/**
 * On a phone the board stops being square, and the two axes stop sharing a
 * ratio.
 *
 * The trade-off is worth spelling out, because it is not obvious. Thickening
 * the ring on an axis makes the spaces on the OPPOSITE edges deeper, but the
 * eight spaces running ALONG that axis narrower — they share whatever is left.
 * A phone is tall and thin, so:
 *
 *   x (columns) stays modest — the eight countries along the top and bottom
 *   edges have only ~360px of width to share, and must not get any thinner.
 *
 *   y (rows) goes THINNER, which is the counter-intuitive half. The top and
 *   bottom spaces are limited by their width, not their height — no amount of
 *   extra depth lets "Canada" fit across 29px — so height spent on them is
 *   wasted. Giving it to the eight middle rows instead is what stops the left
 *   and right countries from clipping their flag and price.
 *
 * Together with a taller-than-wide board this gives every space about 55px of
 * height, which is what the flag, name, price and token strip actually need.
 */
export const TRACK_RATIO_MOBILE = { x: 1.9, y: 1.6 }

/** A square board uses the same ratio on both axes. */
export const TRACK_RATIO_SQUARE = { x: TRACK_RATIO, y: TRACK_RATIO }

export interface TrackRatio {
  x: number
  y: number
}

const axisTotal = (ratio: number) => ratio * 2 + (SIDE - 2)

export function boardGridColumns(ratio: TrackRatio): string {
  return `${ratio.x}fr repeat(${SIDE - 2}, 1fr) ${ratio.x}fr`
}

export function boardGridRows(ratio: TrackRatio): string {
  return `${ratio.y}fr repeat(${SIDE - 2}, 1fr) ${ratio.y}fr`
}

export const BOARD_GRID_TEMPLATE = boardGridColumns(TRACK_RATIO_SQUARE)

/**
 * Start and size of one grid track, as a fraction of the board.
 *
 * Pawn placement and the CSS grid are both derived from the SAME ratio, which
 * is what keeps a token exactly inside the space it belongs to. Pass the ratio
 * in rather than reading a constant, so the two cannot drift when the phone
 * layout uses a different one.
 */
function axisSpan(position: number, ratio: number): { start: number; size: number } {
  const total = axisTotal(ratio)
  if (position === 1) return { start: 0, size: ratio / total }
  if (position === SIDE) {
    return { start: (ratio + SIDE - 2) / total, size: ratio / total }
  }
  return { start: (ratio + position - 2) / total, size: 1 / total }
}

/**
 * Where a space sits on the board as percentages, so pawns can be positioned
 * over the grid without assuming every cell is the same size.
 */
export function cellRectFor(
  index: number,
  ratio: TrackRatio = TRACK_RATIO_SQUARE,
): {
  left: number
  top: number
  width: number
  height: number
} {
  const { row, col } = gridPositionFor(index)
  const x = axisSpan(col, ratio.x)
  const y = axisSpan(row, ratio.y)
  return {
    left: x.start * 100,
    top: y.start * 100,
    width: x.size * 100,
    height: y.size * 100,
  }
}

/**
 * Grid placement for the 10x10 ring: UP the right edge, LEFT along the top,
 * DOWN the left edge, RIGHT along the bottom, starting from START at the
 * bottom-right. Returns 1-based CSS grid row/column.
 */
export function gridPositionFor(index: number): { row: number; col: number } {
  if (index < SIDE) return { row: SIDE - index, col: SIDE } // right edge, going UP
  if (index < SIDE * 2 - 1) return { row: 1, col: SIDE * 2 - 1 - index } // top edge, going LEFT
  if (index < SIDE * 3 - 2) return { row: index - (SIDE * 2 - 3), col: 1 } // left edge, going DOWN
  return { row: SIDE, col: index - (SIDE * 3 - 4) } // bottom edge, going RIGHT
}

/** Which board edge a space sits on — used to orient the colour bar outward. */
export function edgeFor(index: number): 'top' | 'right' | 'bottom' | 'left' {
  if (index < SIDE) return 'right'
  if (index < SIDE * 2 - 1) return 'top'
  if (index < SIDE * 3 - 2) return 'left'
  return 'bottom'
}

/** Forward distance from `from` to `to`, wrapping through START. */
export function forwardDistance(from: number, to: number): number {
  return (to - from + BOARD_SIZE) % BOARD_SIZE
}

/** Does moving forward `steps` spaces from `from` pass or land on START? */
export function crossesStart(from: number, steps: number): boolean {
  if (steps <= 0) return false
  return from + steps >= BOARD_SIZE
}
