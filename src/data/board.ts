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

const AXIS_TOTAL = TRACK_RATIO * 2 + (SIDE - 2)

export const BOARD_GRID_TEMPLATE = `${TRACK_RATIO}fr repeat(${SIDE - 2}, 1fr) ${TRACK_RATIO}fr`

/** Start and size of one grid track, as a fraction of the board. */
function axisSpan(position: number): { start: number; size: number } {
  if (position === 1) return { start: 0, size: TRACK_RATIO / AXIS_TOTAL }
  if (position === SIDE) {
    return { start: (TRACK_RATIO + SIDE - 2) / AXIS_TOTAL, size: TRACK_RATIO / AXIS_TOTAL }
  }
  return { start: (TRACK_RATIO + position - 2) / AXIS_TOTAL, size: 1 / AXIS_TOTAL }
}

/**
 * Where a space sits on the board as percentages, so pawns can be positioned
 * over the grid without assuming every cell is the same size.
 */
export function cellRectFor(index: number): {
  left: number
  top: number
  width: number
  height: number
} {
  const { row, col } = gridPositionFor(index)
  const x = axisSpan(col)
  const y = axisSpan(row)
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
