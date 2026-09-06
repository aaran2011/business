import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import {
  BOARD,
  boardGridColumns,
  boardGridRows,
  cellRectFor,
  edgeFor,
  gridPositionFor,
  TRACK_RATIO_MOBILE,
  TRACK_RATIO_SQUARE,
  type TrackRatio,
} from '../data/board'
import { COUNTRIES } from '../data/properties'
import { SPECIAL_ASSETS } from '../data/specialAssets'
import { money } from '../engine/log'
import type { GameState } from '../engine/types'
import { BoardCentre } from './BoardCentre'
import { BuildingRow } from './BuildingIcons'
import { DiceTray } from './Dice'

const GROUP_COLOUR: Record<string, string> = {
  green: 'var(--grp-green)',
  red: 'var(--grp-red)',
  blue: 'var(--grp-blue)',
  gold: 'var(--grp-gold)',
}

/**
 * Long single-word names cannot fit one line in a board space on a phone.
 * A soft hyphen tells the browser where to break them, so they read as
 * "Switzer-land" instead of being chopped at an arbitrary letter. It is
 * invisible whenever the word does fit.
 */
const SOFT = '\u00AD'
const BREAK_POINTS: Record<string, number> = {
  Switzerland: 6,
  Petroleum: 5,
  Singapore: 4,
  Australia: 6,
  Waterways: 5,
  Satellite: 5,
  Roadways: 5,
  Malaysia: 5,
  Germany: 3,
  Canada: 3,
  Airways: 3,
  Railways: 4,
  Arabia: 3,
}

function withBreak(name: string): string {
  // Multi-word names get a break point inside each word that needs one, so a
  // wrap reads as "Saudi Ara-bia" rather than being chopped at any old letter.
  return name
    .split(' ')
    .map((word) => {
      const at = BREAK_POINTS[word]
      return at ? `${word.slice(0, at)}${SOFT}${word.slice(at)}` : word
    })
    .join(' ')
}

/** Bright bar colours for the non-country spaces. */
const KIND_COLOUR: Record<string, string> = {
  special: 'linear-gradient(90deg, #00c2c7, #2e86ff)',
  uno: 'linear-gradient(90deg, #ff9a3d, #ff5f6d)',
  chance: 'linear-gradient(90deg, #2e86ff, #8f5bff)',
  customDuty: 'linear-gradient(90deg, #8f5bff, #ff5f9e)',
  travellingDuty: 'linear-gradient(90deg, #8f5bff, #ff5f9e)',
}

interface BoardProps {
  state: GameState
  rolling: boolean
  rollId: number
  centreStatus: string
  /** Tapping the die is how a turn is rolled. */
  onRoll: () => void
  canRoll: boolean
  rollPrompt: string
  dieColour?: string
  /** Extra centre content, e.g. the three Jail escape dice. */
  centreExtra?: ReactNode
  /**
   * A property or event card. When present it takes over the middle of the
   * board and the dice step aside, rather than a sheet covering everything.
   */
  centreCard?: ReactNode
}

export function Board({
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
}: BoardProps) {
  const ratio = useTrackRatio()
  const current = state.players.find((p) => p.id === state.turnOrder[state.currentIndex])
  const activeIndex = state.phase === 'playing' ? current?.position : undefined

  return (
    <div className="board-wrap">
      <div
        className="board"
        style={{
          gridTemplateColumns: boardGridColumns(ratio),
          gridTemplateRows: boardGridRows(ratio),
        }}
      >
        {BOARD.map((space) => {
          const { row, col } = gridPositionFor(space.index)
          const edge = edgeFor(space.index)
          const country = space.propertyId ? COUNTRIES[space.propertyId] : undefined
          const asset = space.propertyId ? SPECIAL_ASSETS[space.propertyId] : undefined
          const holding = space.propertyId ? state.holdings[space.propertyId] : undefined
          const owner = holding?.ownerId
            ? state.players.find((p) => p.id === holding.ownerId)
            : undefined
          const isCorner = space.index % 9 === 0
          const rect = cellRectFor(space.index, ratio)

          return (
            /*
              A plain div, not a button. A space is a place on the board, not a
              control: cards open because the game says somebody landed here.
            */
            <div
              key={space.index}
              className={[
                'cell',
                `edge-${edge}`,
                isCorner ? 'is-corner' : '',
                activeIndex === space.index ? 'is-active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={
                {
                  gridRow: row,
                  gridColumn: col,
                  // The cell's own size, for the rotated layout on the narrow
                  // edges: cqi is a share of the board's width, cqb of its
                  // height. Handing these to CSS is what lets a rotated body
                  // be exactly as long as the cell is tall.
                  '--cell-w': `${rect.width}cqi`,
                  '--cell-h': `${rect.height}cqb`,
                } as CSSProperties
              }
              title={space.label}
            >
              {country && (
                <span className="cell-bar" style={{ background: GROUP_COLOUR[country.colour] }} />
              )}
              {!country && !isCorner && (
                <span
                  className="cell-bar"
                  style={{ background: KIND_COLOUR[space.kind] ?? '#c8d8ea' }}
                />
              )}

              <span className="cell-body">
                {country ? (
                  <>
                    <span className="cell-flag">{country.flag}</span>
                    <span className="cell-name">{withBreak(country.name)}</span>
                    <span className="cell-price">{money(country.price)}</span>
                  </>
                ) : asset ? (
                  <>
                    <span className="cell-icon">{asset.icon}</span>
                    <span className="cell-name">{withBreak(asset.name)}</span>
                    <span className="cell-price">{money(asset.price)}</span>
                  </>
                ) : (
                  <>
                    <span className="cell-icon">{space.icon}</span>
                    <span className="cell-name">{space.label}</span>
                  </>
                )}
              </span>

              {owner && <span className="cell-owner" style={{ background: owner.colourHex }} />}

              {holding && holding.buildings > 0 && owner && (
                <span className="cell-buildings">
                  <BuildingRow level={holding.buildings} colour={owner.colourHex} />
                </span>
              )}

              {holding?.mortgaged && <span className="cell-mortgaged">MORTGAGED</span>}
            </div>
          )
        })}

        <div className="board-centre">
          {centreCard ?? (
            <>
              <BoardCentre />
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
              />
              {centreExtra}
              <div className="centre-status">{centreStatus}</div>
            </>
          )}
        </div>

        {/*
          Tokens.

          Every token is placed from the SAME cell rectangle the CSS grid uses,
          so it is always inside exactly one space — never floating between two
          countries. There is no movement transition: the pawn steps from space
          to space, and each step lands cleanly rather than sliding across the
          border. Up to six share a space in two rows of three, in a strip kept
          clear at the bottom of the cell, so the flag, name and price above are
          never covered.
        */}
        <div className="pawn-layer">
          {state.players.map((player, i) => {
            if (player.isOut) return null
            // Straight from the game state. The token is wherever the rules
            // say it is — there is no second, animated copy to drift from it.
            const index = player.position
            const rect = cellRectFor(index, ratio)
            const perRow = 3
            const col = i % perRow
            const row = Math.floor(i / perRow)
            const isCurrent =
              state.phase === 'playing' && state.turnOrder[state.currentIndex] === player.id
            // Centres of a 3x2 grid inside the bottom third of the space.
            const x = rect.left + rect.width * (0.22 + col * 0.28)
            const y = rect.top + rect.height * (0.8 + row * 0.11)
            return (
              <span
                key={player.id}
                className={`pawn${isCurrent ? ' is-current' : ''}`}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  background: player.colourHex,
                }}
                title={`${player.name} — ${BOARD[index].label}`}
              >
                {player.name.charAt(0).toUpperCase()}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * Which track thickness to lay the board out with.
 *
 * A phone gets the thicker ring. This is read once here and handed to both the
 * grid template and the token placement, so the two can never disagree about
 * where a space is.
 */
function useTrackRatio(): TrackRatio {
  const query = '(max-width: 820px)'
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setNarrow(mql.matches)
    mql.addEventListener('change', onChange)
    onChange()
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return narrow ? TRACK_RATIO_MOBILE : TRACK_RATIO_SQUARE
}
