import { useRef, type CSSProperties } from 'react'

/**
 * Physical-feeling dice.
 *
 * The roll is not a generic tumble that gets cut off wherever it happens to
 * be. The moment the die is thrown we already know the result, so the die is
 * sent spinning through several whole turns and decelerates onto exactly the
 * face that was rolled. The number you watch land is the number you get.
 */

const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[2, 2]],
  2: [
    [1, 1],
    [3, 3],
  ],
  3: [
    [1, 1],
    [2, 2],
    [3, 3],
  ],
  4: [
    [1, 1],
    [1, 3],
    [3, 1],
    [3, 3],
  ],
  5: [
    [1, 1],
    [1, 3],
    [2, 2],
    [3, 1],
    [3, 3],
  ],
  6: [
    [1, 1],
    [1, 3],
    [2, 1],
    [2, 3],
    [3, 1],
    [3, 3],
  ],
}

/**
 * The rotation, in degrees, that brings each face to the front.
 * Kept as numbers so whole extra turns can be added to them.
 */
const FACE_ANGLES: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: 0, y: -180 },
  4: { x: 0, y: 90 },
  5: { x: -90, y: 0 },
  6: { x: 90, y: 0 },
}

/** Where each face is glued onto the cube. */
const FACE_PLACEMENT: Record<number, string> = {
  1: '',
  2: 'rotateY(90deg)',
  3: 'rotateY(180deg)',
  4: 'rotateY(-90deg)',
  5: 'rotateX(90deg)',
  6: 'rotateX(-90deg)',
}

function Pips({ value }: { value: number }) {
  return (
    <>
      {PIP_LAYOUTS[value].map(([row, col], i) => (
        <span key={i} className="pip" style={{ gridRow: row, gridColumn: col }} />
      ))}
    </>
  )
}

interface DieProps {
  value: number
  rolling: boolean
  /** Increments once per throw, so each roll gets a fresh spin. */
  rollId: number
  durationMs: number
  /** Pip colour — set to the current player's colour on their turn. */
  colour?: string
}

export function Die({ value, rolling, rollId, durationMs, colour }: DieProps) {
  // Spin accumulates in whole turns, so the resting orientation is always
  // exactly the rolled face no matter how many times the die has been thrown.
  const spin = useRef({ id: -1, x: 0, y: 0, z: 0 })
  if (spin.current.id !== rollId) {
    const turns = () => 360 * (2 + Math.floor(Math.random() * 3))
    spin.current = {
      id: rollId,
      x: spin.current.x + turns(),
      y: spin.current.y + turns(),
      // Quarter turns keep the pip pattern square while varying the landing.
      z: spin.current.z + 90 * Math.floor(Math.random() * 4),
    }
  }

  const face = FACE_ANGLES[value] ?? FACE_ANGLES[1]
  const { x, y, z } = spin.current

  return (
    <div className="die-stage">
      <div
        className="die-throw"
        style={rolling ? { animationDuration: `${durationMs}ms` } : undefined}
        data-rolling={rolling ? 'true' : undefined}
      >
        <div
          className="die"
          style={{
            // rotateZ first in the string means it is applied last, spinning
            // the cube in the screen plane without changing which face leads.
            transform: `rotateZ(${z}deg) rotateX(${x + face.x}deg) rotateY(${y + face.y}deg)`,
            transitionDuration: `${durationMs}ms`,
          }}
        >
          {[1, 2, 3, 4, 5, 6].map((f) => (
            <div
              key={f}
              className="die-face"
              style={{
                transform: `${FACE_PLACEMENT[f]} translateZ(var(--die-half))`,
                ...(colour ? { ['--pip-colour' as string]: colour } : {}),
              }}
            >
              <Pips value={f} />
            </div>
          ))}
        </div>
      </div>
      <span
        className="die-shadow"
        style={rolling ? { animationDuration: `${durationMs}ms` } : undefined}
        data-rolling={rolling ? 'true' : undefined}
      />
    </div>
  )
}

/**
 * Renders however many movement dice the settings call for, always with the
 * rolled number spelled out beside them so the result is never ambiguous.
 */
export function DiceTray({
  dice,
  rolling,
  count = 1,
  rollId = 0,
  durationMs = 1700,
  label = 'Roll',
  colour,
  onRoll,
  canRoll = false,
  prompt,
}: {
  dice: number[] | null
  rolling: boolean
  count?: number
  rollId?: number
  durationMs?: number
  label?: string
  /** The current player's colour, used for the pips. */
  colour?: string
  /** Rolling is done by tapping the dice themselves. */
  onRoll?: () => void
  canRoll?: boolean
  prompt?: string
}) {
  const shown = dice ?? Array.from({ length: count }, () => 1)
  const total = shown.reduce((a, b) => a + b, 0)

  const dice3d = (
    <div className="dice-tray">
      {shown.map((value, i) => (
        <Die
          key={i}
          value={value}
          rolling={rolling}
          rollId={rollId}
          durationMs={durationMs}
          colour={colour}
        />
      ))}
      {/*
        "Roll" is an instruction, so it only appears on the device that can
        actually roll. Everyone else sees the number that was rolled, which
        stays on the table until the next roll.
      */}
      <div className={`die-total${!rolling && dice ? ' is-settled' : ''}`} key={rollId}>
        {rolling || !dice ? '—' : total}
        <small>{shown.length > 1 ? 'Total' : onRoll && !canRoll ? 'Rolled' : label}</small>
      </div>
    </div>
  )

  if (!onRoll) return dice3d

  return (
    /*
      The active player's colour goes on `.dice-tint`, an element of its own
      behind the die. Never on a parent: a parent here is the middle of the
      board, and tinting that washes the whole inside of the board in one
      player's colour.
    */
    <div className="dice-roller" style={{ '--turn': colour ?? 'transparent' } as CSSProperties}>
      <span className="dice-tint" aria-hidden="true" />
      <button
        type="button"
        className={`dice-hit${canRoll ? ' can-roll' : ''}`}
        onClick={canRoll ? onRoll : undefined}
        disabled={!canRoll}
        aria-label={canRoll ? 'Roll the die' : 'Die'}
      >
        {dice3d}
      </button>
      {prompt && <div className={`dice-prompt${canRoll ? ' is-live' : ''}`}>{prompt}</div>}
    </div>
  )
}

/**
 * The Jail escape attempt: one slot per roll, filled in as the turns go by,
 * with the running total against the number needed to get out.
 */
export function JailDice({
  rolls,
  slots,
  target,
}: {
  rolls: number[]
  slots: number
  target: number
}) {
  const total = rolls.reduce((a, b) => a + b, 0)
  return (
    <div className="jail-dice">
      {Array.from({ length: slots }, (_, i) =>
        i < rolls.length ? (
          <div className="jail-die" key={i}>
            <Pips value={rolls[i]} />
          </div>
        ) : (
          <div className="jail-die is-empty" key={i}>
            <span>{i + 1}</span>
          </div>
        ),
      )}
      <div className="die-total">
        {total}
        <small>of {target}</small>
      </div>
    </div>
  )
}
