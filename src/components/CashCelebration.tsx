import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { play } from '../audio/sound'
import type { GameNotice, GameState } from '../engine/types'

/**
 * Getting paid, on the screen of the player who got paid.
 *
 * A shower of confetti falling from the top of the screen to the bottom, and
 * a coin flourish — on a phone and on a laptop alike — and BOTH belong to the
 * person the money went to. Everybody else keeps the quiet line they already get. That is
 * the whole point of it: the table hears one person being pleased, rather than
 * six devices going off at once every time somebody crosses START.
 *
 * Who receives is read from `notice.credited`, which the engine fills in from
 * the player id — never from a name, and never from whose turn it is. Rent
 * paid to you while somebody else is playing is still money to you.
 */

/** Longest fall plus the latest start, with a little to spare. */
const BURST_MS = 4600
const PIECES = 72

/** The festive set, plus the receiving player's own colour mixed through it. */
const CONFETTI = ['#ff5f7e', '#ffb020', '#ffd76a', '#17b978', '#2e86ff', '#8e86f0', '#00c2c7']

interface Burst {
  id: number
  pieces: CSSProperties[]
}

export function CashCelebration({
  notices,
  state,
  controlsPlayer,
}: {
  notices: GameNotice[]
  state: GameState
  /** True when THIS device plays that seat. */
  controlsPlayer: (playerId: string) => boolean
}) {
  const [bursts, setBursts] = useState<Burst[]>([])
  const seen = useRef<Set<number>>(new Set())
  const primed = useRef(false)
  const timers = useRef<number[]>([])
  const nextId = useRef(1)
  /** Every credit this device has celebrated, for the development probe. */
  const fired = useRef<string[]>([])

  // The colours are needed at the moment a burst fires, but must not put the
  // whole game state in the effect's dependencies — it changes constantly.
  const playersRef = useRef(state.players)
  playersRef.current = state.players

  useEffect(
    () => () => {
      for (const t of timers.current) window.clearTimeout(t)
    },
    [],
  )

  /** Throw one burst. Kept apart from the rules for firing it so the effect
      below reads as "who got paid", and so it can be triggered on its own. */
  const fire = useCallback((colourHint?: string) => {
    const id = nextId.current++
    setBursts((current) => [...current, { id, pieces: makePieces(colourHint) }])
    const clear = window.setTimeout(() => {
      setBursts((current) => current.filter((b) => b.id !== id))
    }, BURST_MS)
    timers.current.push(clear)
  }, [])

  useEffect(() => {
    // A device joining mid-game is handed every notice so far. Firing poppers
    // for all of them would be a party for news that is minutes old, so the
    // backlog is marked read on the first pass. This has to run even when the
    // list is EMPTY, or a game watched from the start swallows its first event.
    if (!primed.current) {
      primed.current = true
      for (const n of notices) seen.current.add(n.id)
      return
    }

    const fresh = notices.filter((n) => !seen.current.has(n.id))
    if (!fresh.length) return
    for (const n of fresh) seen.current.add(n.id)

    const mine = fresh.find((n) => n.credited?.some((c) => controlsPlayer(c.playerId)))
    if (!mine) return

    const paid = mine.credited!.find((c) => controlsPlayer(c.playerId))!
    play('cash')
    fired.current.push(paid.playerId)

    // Someone who has asked their system for less movement gets the sound and
    // the line, and no flying paper. Read at the moment of firing, so changing
    // the setting takes effect without a reload. This is the ONLY place that
    // decision is made — there is no second copy of it in the stylesheet.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    fire(playersRef.current.find((p) => p.id === paid.playerId)?.colourHex)
  }, [notices, controlsPlayer, fire])

  /*
   * A handle on the celebration, for development only. Whether the poppers go
   * off on the RIGHT device is the whole point of this, and it cannot be
   * checked from a screenshot — a burst is gone in under two seconds, and on a
   * machine set to reduced motion it never draws at all. Compiled out of the
   * built game.
   */
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    ;(window as unknown as { businessPoppers?: unknown }).businessPoppers = {
      firedFor: fired.current,
      count: fired.current.length,
      fire,
    }
  }

  if (!bursts.length) return null
  return (
    <div className="poppers" aria-hidden="true">
      {bursts.map((burst) => (
        <div key={burst.id} className="popper-burst">
          {burst.pieces.map((style, i) => (
            <span key={i} className="popper-bit" style={style} />
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * One shower. Every piece starts just above the top of the screen at its own
 * spot across the width, waits its own moment, and drifts down past the
 * bottom — swaying a little, spinning as it goes. A third are dots, the rest
 * paper strips, so it reads as confetti rather than a colour wash.
 */
function makePieces(ownColour?: string): CSSProperties[] {
  const palette = ownColour ? [ownColour, ownColour, ...CONFETTI] : CONFETTI
  return Array.from({ length: PIECES }, (_, i) => {
    const size = 6 + Math.random() * 6
    const round = i % 3 === 0
    return {
      left: `${(Math.random() * 100).toFixed(1)}vw`,
      width: `${size.toFixed(1)}px`,
      height: `${(round ? size : size * 1.7).toFixed(1)}px`,
      borderRadius: round ? '50%' : '2px',
      background: palette[i % palette.length],
      '--sway': `${(Math.random() * 18 - 9).toFixed(1)}vw`,
      '--rot': `${(Math.random() * 1080 - 540).toFixed(0)}deg`,
      '--tilt': `${(Math.random() * 90 - 45).toFixed(0)}deg`,
      '--delay': `${(Math.random() * 1.1).toFixed(2)}s`,
      '--dur': `${(2.3 + Math.random() * 1.2).toFixed(2)}s`,
    } as CSSProperties
  })
}
