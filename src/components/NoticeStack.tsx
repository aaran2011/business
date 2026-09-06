import { useEffect, useRef, useState } from 'react'
import { money } from '../engine/log'
import type { GameNotice, GameState } from '../engine/types'

/**
 * What just happened, for five seconds.
 *
 * Two kinds of thing come through here.
 *
 * A LINE is news about somebody else — "Priya landed on France". It goes to
 * everyone EXCEPT the device that caused it: if I moved my own token I watched
 * it happen, and being told is clutter. Whose it is comes from the player id
 * through `controlsPlayer`, never from comparing names.
 *
 * A CARD is money passing between players — rent, Party House, Resort, a card
 * that collects from everyone. That one goes to EVERYBODY, the payer included,
 * because handing money over is exactly what you want confirmed: who paid whom,
 * how much, and what for.
 *
 * Either way each keeps its own five seconds and fades in its own time. A later
 * event never cuts short or extends one already on screen.
 */
const SHOW_MS = 5000
const FADE_MS = 260

interface Shown {
  notice: GameNotice
  leaving: boolean
}

export function NoticeStack({
  notices,
  state,
  controlsPlayer,
}: {
  notices: GameNotice[]
  /** For turning player ids into names and colours. */
  state: GameState
  /** True when THIS device plays that seat. */
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

    // Money between players is shown to everyone; a line about somebody's move
    // is not shown to the person who made it.
    const forMe = fresh.filter((n) => n.transfer?.length || !controlsPlayer(n.playerId))
    if (!forMe.length) return

    setShown((current) => [...current, ...forMe.map((notice) => ({ notice, leaving: false }))])

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
          className={[
            'notice',
            `notice-${notice.tone}`,
            notice.transfer?.length ? 'notice-transfer' : '',
            leaving ? 'is-leaving' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {notice.transfer?.length ? (
            <Transfer notice={notice} state={state} />
          ) : (
            notice.text
          )}
        </div>
      ))}
    </div>
  )
}

/** Who paid whom, how much, and what for. */
function Transfer({ notice, state }: { notice: GameNotice; state: GameState }) {
  const name = (id: string) => state.players.find((p) => p.id === id)
  return (
    <>
      <div className="notice-reason">{notice.text}</div>
      <div className="notice-legs">
        {notice.transfer!.map((leg, i) => {
          const from = name(leg.fromId)
          const to = name(leg.toId)
          if (!from || !to) return null
          return (
            <div className="notice-leg" key={i}>
              <span className="notice-party">
                <span className="notice-dot" style={{ background: from.colourHex }} />
                {from.name}
              </span>
              <span className="notice-arrow" aria-hidden="true">
                →
              </span>
              <span className="notice-amount">{money(leg.amount)}</span>
              <span className="notice-arrow" aria-hidden="true">
                →
              </span>
              <span className="notice-party">
                <span className="notice-dot" style={{ background: to.colourHex }} />
                {to.name}
              </span>
            </div>
          )
        })}
      </div>
    </>
  )
}
