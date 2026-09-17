import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { BOARD, gridPositionFor, type BoardSpaceDef } from '../data/board'
import type { GameState, Player } from '../engine/types'
import { describeSpace } from './Board'
import { Wordmark } from './BoardCentre'
import { HotelIcon, HouseIcon } from './BuildingIcons'
import { DiceTray } from './Dice'
import { compactMoney } from './format'
import { MobileCentreArt } from './MobileCentreArt'
import { hasSpaceIcon, SpaceIcon } from './SpaceIcon'

/**
 * ============================================================================
 * THE PHONE BOARD
 * ============================================================================
 *
 * Drawn for a phone held upright, the iPhone 12 mini (375px) first. It is NOT
 * the square board shrunk: that squeezed ten spaces into a 28px strip, turned
 * their labels on their sides and still broke words in half.
 *
 * This one is TALL — about one and a half times as high as it is wide — and is
 * built as three bands rather than one ten-by-ten grid:
 *
 *   ┌────────────────────────────────────────────┐
 *   │ corner │ eight narrow spaces      │ corner │   top row
 *   ├────────┴──┬──────────────────────┬─┴──────┤
 *   │ 8 spaces  │        centre        │8 spaces│   side columns are WIDER
 *   │ stacked   │                      │stacked │   than the corners above
 *   ├────────┬──┴──────────────────────┴─┬──────┤   them, as in the design
 *   │ corner │ eight narrow spaces      │ corner │   bottom row
 *   └────────────────────────────────────────────┘
 *
 * Every piece of GAME information comes from the same place the square board
 * reads it: `describeSpace`, the game state, the dice tray. Nothing about a
 * rule lives here — only where things go on a small screen.
 *
 * Text is never rotated and never broken mid-word. A word too wide for its
 * space is set slightly smaller and drawn condensed until it fits (see
 * `fitLabels`), which is how the design handles "Switzerland" in 31px.
 */

type Side = 'top' | 'bottom' | 'left' | 'right'

/**
 * The tint of each space on the phone, transcribed from the approved design,
 * keyed by board index. Purely decorative — the colour groups play no part in
 * it (Italy and Switzerland share a group and differ here), so it cannot be
 * read as ownership. The four corners take their own colours from the shared
 * corner system in the stylesheet and are not listed.
 */
type Tone = 'blue' | 'mint' | 'pink' | 'peach' | 'yellow' | 'lavender'
const PHONE_TONES: Record<number, Tone> = {
  // top row, left to right
  17: 'mint', // Italy
  16: 'pink', // Chance
  15: 'mint', // Brazil
  14: 'lavender', // Switzerland
  13: 'blue', // Custom Duty
  12: 'blue', // Airways
  11: 'peach', // Germany
  10: 'lavender', // Canada
  // left column, top to bottom
  19: 'mint', // Japan
  20: 'pink', // USA
  21: 'blue', // Travelling Duty
  22: 'mint', // Roadways
  23: 'peach', // Mexico
  24: 'pink', // Hong Kong
  25: 'yellow', // UNO
  26: 'blue', // Australia
  // right column, top to bottom
  8: 'pink', // Egypt
  7: 'blue', // Satellite
  6: 'mint', // Iran
  5: 'pink', // France
  4: 'yellow', // UNO
  3: 'blue', // Waterways
  2: 'peach', // Iraq
  1: 'lavender', // England
  // bottom row, left to right
  28: 'mint', // India
  29: 'pink', // Chance
  30: 'mint', // Saudi Arabia
  31: 'lavender', // Petroleum
  32: 'peach', // China
  33: 'blue', // Railways
  34: 'lavender', // Malaysia
  35: 'pink', // Singapore
}

/** The ring, cut into the four bands, in reading order. */
function bands() {
  const at = BOARD.map((space) => ({ space, ...gridPositionFor(space.index) }))
  const byCol = (a: { col: number }, b: { col: number }) => a.col - b.col
  const byRow = (a: { row: number }, b: { row: number }) => a.row - b.row
  return {
    top: at.filter((s) => s.row === 1).sort(byCol).map((s) => s.space),
    bottom: at.filter((s) => s.row === 10).sort(byCol).map((s) => s.space),
    left: at.filter((s) => s.col === 1 && s.row > 1 && s.row < 10).sort(byRow).map((s) => s.space),
    right: at.filter((s) => s.col === 10 && s.row > 1 && s.row < 10).sort(byRow).map((s) => s.space),
  }
}
const BANDS = bands()

/**
 * How a label is split into lines. Never mid-word.
 *
 * In a narrow space and in a corner, each word gets its own line — "Custom" /
 * "Duty", "Party" / "House". The side columns are twice as wide, so a label
 * stays whole there unless it is long ("Travelling Duty"); "Hong Kong" fits.
 */
function linesFor(label: string, side: Side, isCorner: boolean): string[] {
  const words = label.split(' ')
  if (words.length === 1) return words
  if ((side === 'left' || side === 'right') && !isCorner) {
    return label.length > 10 ? words : [label]
  }
  return words
}

interface MobileBoardProps {
  state: GameState
  rolling: boolean
  rollId: number
  centreStatus: string
  onRoll: () => void
  canRoll: boolean
  rollPrompt: string
  dieColour?: string
  centreExtra?: ReactNode
  centreCard?: ReactNode
  turnName?: string
}

export function MobileBoard({
  state,
  rolling,
  rollId,
  centreStatus,
  onRoll,
  canRoll,
  rollPrompt,
  dieColour,
  centreExtra,
  centreCard,
  turnName,
}: MobileBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null)
  const current = state.players.find((p) => p.id === state.turnOrder[state.currentIndex])
  const activeIndex = state.phase === 'playing' ? current?.position : undefined

  // Who is standing where. Straight from the state, like the square board.
  const standing = new Map<number, Player[]>()
  for (const player of state.players) {
    if (player.isOut) continue
    const list = standing.get(player.position) ?? []
    list.push(player)
    standing.set(player.position, list)
  }

  useLayoutEffect(() => {
    const board = boardRef.current
    if (!board) return
    const run = () => fitLabels(board)
    run()
    const observer = new ResizeObserver(run)
    observer.observe(board)
    // A web font or a late emoji can change a word's width after first paint.
    void document.fonts?.ready.then(run)
    return () => observer.disconnect()
  }, [])

  const cell = (side: Side) => (space: BoardSpaceDef) => (
    <MobileCell
      key={space.index}
      side={side}
      space={space}
      state={state}
      active={activeIndex === space.index}
      players={standing.get(space.index) ?? []}
      currentId={state.phase === 'playing' ? current?.id : undefined}
    />
  )

  return (
    <div className="mboard" ref={boardRef}>
      <div className="mrow mrow-top">{BANDS.top.map(cell('top'))}</div>

      <div className="mmid">
        <div className="mcol mcol-left">{BANDS.left.map(cell('left'))}</div>

        <div className="mcentre">
          <MobileCentreArt />
          <div className="mcentre-content">
            {centreCard ?? (
              <>
                <Wordmark className="mcentre-wordmark" />
                <DiceTray
                  dice={state.dice}
                  rolling={rolling}
                  rollId={rollId}
                  count={state.settings.dice.count}
                  durationMs={state.settings.dice.rollAnimationMs}
                  colour={dieColour}
                  onRoll={onRoll}
                  canRoll={canRoll}
                  prompt={rollPrompt}
                  turnName={turnName}
                />
                {centreExtra}
                <div className="centre-status">{centreStatus}</div>
              </>
            )}
          </div>
        </div>

        <div className="mcol mcol-right">{BANDS.right.map(cell('right'))}</div>
      </div>

      <div className="mrow mrow-bottom">{BANDS.bottom.map(cell('bottom'))}</div>
    </div>
  )
}

function MobileCell({
  side,
  space,
  state,
  active,
  players,
  currentId,
}: {
  side: Side
  space: BoardSpaceDef
  state: GameState
  active: boolean
  players: Player[]
  currentId?: string
}) {
  const { country, asset, holding, owner, isCorner, glyph } = describeSpace(state, space)
  const label = country?.name ?? asset?.name ?? space.label
  const price = country?.price ?? asset?.price
  const tone = PHONE_TONES[space.index]
  const lines = linesFor(label, side, isCorner)
  // UNO has no price, so on a side column its card sits beside the word.
  const inline = space.kind === 'uno' && (side === 'left' || side === 'right')

  return (
    <div className={`mcell-wrap m-${side}${active ? ' is-active-wrap' : ''}`}>
      <div
        className={[
          'mcell',
          `m-${side}`,
          `kind-${space.kind}`,
          tone ? `mtone-${tone}` : '',
          isCorner ? 'is-corner' : '',
          inline ? 'is-inline' : '',
          active ? 'is-active' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        title={space.label}
      >
        <span className="mcell-body">
          <span className="mcell-icon">
            {country ? (
              country.flag
            ) : hasSpaceIcon(glyph) ? (
              <SpaceIcon name={glyph} />
            ) : (
              (asset?.icon ?? space.icon)
            )}
          </span>
          <span className="mcell-name">
            {lines.map((line) => (
              <span className="mline" key={line}>
                <span className="mfit">{line}</span>
              </span>
            ))}
          </span>
          {price !== undefined && <span className="mcell-price">{compactMoney(price)}</span>}
        </span>

        {owner && <span className="mcell-owner" style={{ background: owner.colourHex }} />}

        {holding && owner && holding.buildings > 0 && (
          <span className="mcell-build">
            {holding.buildings >= 4 ? (
              <HotelIcon colour={owner.colourHex} />
            ) : (
              <>
                <HouseIcon colour={owner.colourHex} />
                {holding.buildings > 1 && <b>{holding.buildings}</b>}
              </>
            )}
          </span>
        )}

        {holding?.mortgaged && (
          <span className="mcell-mortgaged">
            <span className="mm-short">MTG</span>
            <span className="mm-long">MORTGAGED</span>
          </span>
        )}
      </div>

      {players.length > 0 && <Pawns players={players} side={side} currentId={currentId} />}
    </div>
  )
}

/**
 * The players standing on a space, as small markers on its INNER edge — the
 * side facing the middle of the board.
 *
 * In the top and bottom rows they sit inside the space, in a strip kept clear
 * for them. The side columns are too short for that, so there they sit on the
 * edge itself, half over the gap into the centre panel, which is not a space
 * and so cannot be mistaken for one. Several players on one space overlap a
 * little rather than growing the space.
 */
function Pawns({
  players,
  side,
  currentId,
}: {
  players: Player[]
  side: Side
  currentId?: string
}) {
  const n = players.length
  // Tighter as they multiply, so six still fit a narrow space.
  const step = n <= 1 ? 0 : Math.min(9, (side === 'top' || side === 'bottom' ? 16 : 32) / (n - 1))
  return (
    <span className="mpawns" aria-hidden="true">
      {players.map((player, i) => (
        <span
          key={player.id}
          className={`mpawn${player.id === currentId ? ' is-current' : ''}`}
          style={
            {
              background: player.colourHex,
              '--off': `${(i - (n - 1) / 2) * step}px`,
              zIndex: player.id === currentId ? 3 : 1,
            } as CSSProperties
          }
          title={player.name}
        >
          {player.name.charAt(0).toUpperCase()}
        </span>
      ))}
    </span>
  )
}

/**
 * Make every label fit its space, without breaking or turning it.
 *
 * A word wider than its line is first set a little smaller — never below 85%
 * of its size — and then, if it still does not fit, drawn condensed. That is
 * the design's treatment of "Switzerland" and "Petroleum" in a 31px space: the
 * same word, narrower, on one line. Short words are left exactly as they are.
 *
 * Reads every width first, then writes every change, so the browser lays the
 * board out twice rather than once per label.
 */
function fitLabels(board: HTMLElement) {
  const spans = [...board.querySelectorAll<HTMLElement>('.mfit')]
  for (const el of spans) {
    el.style.setProperty('--fs', '1')
    el.style.setProperty('--fit', '1')
  }
  const measured = spans.map((el) => ({
    el,
    avail: (el.parentElement as HTMLElement).clientWidth,
    natural: el.scrollWidth,
  }))
  for (const { el, avail, natural } of measured) {
    if (!avail || natural <= avail) continue
    const k = avail / natural
    const size = Math.max(0.85, Math.min(1, k / 0.72))
    const squeeze = Math.max(0.5, Math.min(1, avail / (natural * size)))
    el.style.setProperty('--fs', size.toFixed(3))
    el.style.setProperty('--fit', squeeze.toFixed(3))
  }
}
