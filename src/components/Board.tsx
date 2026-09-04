import type { ReactNode } from 'react'
import { BOARD, BOARD_GRID_TEMPLATE, cellRectFor, edgeFor, gridPositionFor } from '../data/board'
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
  Switzerland: 7,
  Petroleum: 6,
  Singapore: 5,
  Australia: 6,
  Waterways: 5,
  Satellite: 5,
  Roadways: 5,
  Malaysia: 5,
}

function withBreak(name: string): string {
  const at = BREAK_POINTS[name]
  return at ? `${name.slice(0, at)}${SOFT}${name.slice(at)}` : name
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
  /** Animated pawn positions, which lag behind state during a move. */
  displayPositions: Record<string, number>
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
  onSelectSpace: (propertyId: string) => void
}

export function Board({
  state,
  displayPositions,
  rolling,
  rollId,
  centreStatus,
  onRoll,
  canRoll,
  rollPrompt,
  dieColour,
  centreExtra,
  onSelectSpace,
}: BoardProps) {
  const activeIndex =
    state.phase === 'playing'
      ? displayPositions[state.turnOrder[state.currentIndex]]
      : undefined

  return (
    <div className="board-wrap">
      <div
        className="board"
        style={{
          gridTemplateColumns: BOARD_GRID_TEMPLATE,
          gridTemplateRows: BOARD_GRID_TEMPLATE,
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

          return (
            <button
              key={space.index}
              className={[
                'cell',
                `edge-${edge}`,
                isCorner ? 'is-corner' : '',
                activeIndex === space.index ? 'is-active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ gridRow: row, gridColumn: col }}
              onClick={() => space.propertyId && onSelectSpace(space.propertyId)}
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
            </button>
          )
        })}

        <div className="board-centre">
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
        </div>

        <div className="pawn-layer">
          {state.players.map((player, i) => {
            if (player.isOut) return null
            const index = displayPositions[player.id] ?? player.position
            const rect = cellRectFor(index)
            // Up to 6 pawns share a space — lay them out in a 3x2 grid inside it.
            const col = i % 3
            const row = Math.floor(i / 3)
            const isCurrent =
              state.phase === 'playing' && state.turnOrder[state.currentIndex] === player.id
            return (
              <span
                key={player.id}
                className={`pawn${isCurrent ? ' is-current' : ''}`}
                style={{
                  left: `${rect.left + rect.width * (0.22 + col * 0.28)}%`,
                  top: `${rect.top + rect.height * (0.58 + row * 0.22)}%`,
                  background: player.colourHex,
                }}
                title={player.name}
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
