import { useEffect, useRef, useState } from 'react'
import type { GameNotice } from '../engine/types'

/**
 * What just happened, in one line, for three seconds.
 *
 * Two rules make this useful rather than noisy:
 *
 * AUDIENCE. A notice goes to everyone EXCEPT the device that caused it. If I
 * roll and land on France I watched my own token get there; being told about
 * it is clutter. Whether it is mine is decided by player id through
 * `controlsPlayer`, never by comparing names — two people can be called Sam.
 *
 * TIMING. Each line keeps its own three-second life. A later event never
 * extends or cuts short one already on screen, and nothing is left stacked up
 * once it has been read.
 */
const SHOW_MS = 3000
const FADE_MS = 260

interface Shown {
  notice: GameNotice
  leaving: boolean
}

export function NoticeStack({
  notices,
  controlsPlayer,
}: {
  notices: GameNotice[]
  /** True when THIS device plays that seat — those notices are not shown. */
  controlsPlayer: (playerId: string) => boolean
}) {
  const [shown, setShown] = useState<Shown[]>([])
  const seen = useRef<Set<number>>(new Set())
  const primed = useRef(false)
  const timers = useRef<number[]>([])

  useEffect(
    () => () => {
      for (const t of timers.current) window.clearTimeout(t)
    },
    [],
  )

  useEffect(() => {
    // A device joining mid-game is handed everything that has happened so far.
    // Replaying all of it would be a wall of stale news, so on the very first
    // pass the backlog is marked as read and nothing is shown. This has to run
    // even when the list is EMPTY — otherwise a game watched from the start
    // treats its first real event as backlog and swallows it.
    if (!primed.current) {
      primed.current = true
      for (const n of notices) seen.current.add(n.id)
      return
    }

    const fresh = notices.filter((n) => !seen.current.has(n.id))
    if (!fresh.length) return
    for (const n of fresh) seen.current.add(n.id)

    const mine = (n: GameNotice) => controlsPlayer(n.playerId)
    const forMe = fresh.filter((n) => !mine(n))
    if (!forMe.length) return

    setShown((current) => [...current, ...forMe.map((notice) => ({ notice, leaving: false }))])

    // One timer per line, so each lives exactly three seconds of its own.
    for (const notice of forMe) {
      const fade = window.setTimeout(() => {
        setShown((current) =>
          current.map((s) => (s.notice.id === notice.id ? { ...s, leaving: true } : s)),
        )
        const drop = window.setTimeout(() => {
          setShown((current) => current.filter((s) => s.notice.id !== notice.id))
        }, FADE_MS)
        timers.current.push(drop)
      }, SHOW_MS)
      timers.current.push(fade)
    }
  }, [notices, controlsPlayer])

  if (!shown.length) return null
  return (
    <div className="notice-stack" role="status" aria-live="polite">
      {shown.map(({ notice, leaving }) => (
        <div
          key={notice.id}
          className={`notice notice-${notice.tone}${leaving ? ' is-leaving' : ''}`}
        >
          {notice.text}
        </div>
      ))}
    </div>
  )
}
