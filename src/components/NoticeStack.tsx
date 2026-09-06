import { useEffect, useRef, useState } from 'react'
import { play } from '../audio/sound'
import type { GameNotice } from '../engine/types'

/**
 * What just happened, in one line, for a few seconds.
 *
 * Everything the rules have already settled comes through here: rent, cards,
 * Resort, Party House, purchases, Jail. There is nothing to press — a card
 * asking you to confirm something that has already happened is a card asking
 * you to agree with the past.
 *
 * The queue comes from the game state, so every device shows the same lines in
 * the same order. Each is shown once; the ids already seen are remembered so a
 * reconnect does not replay the whole game.
 *
 * On a phone these sit under the header where the eye already is; on a wider
 * screen they sit at the bottom, out of the way of the board.
 */
const SHOW_MS = 3000

export function NoticeStack({ notices }: { notices: GameNotice[] }) {
  const [visible, setVisible] = useState<GameNotice[]>([])
  const seen = useRef<Set<number>>(new Set())
  const primed = useRef(false)

  useEffect(() => {
    const fresh = notices.filter((n) => !seen.current.has(n.id))
    if (!fresh.length) return
    for (const n of fresh) seen.current.add(n.id)

    // The first state a device receives carries whatever has happened so far.
    // Showing all of it at once would be a wall of stale news, so the backlog
    // is marked as seen and only what happens from now on is announced.
    if (!primed.current) {
      primed.current = true
      return
    }

    for (const n of fresh) {
      if (n.tone === 'good') play('good')
      else if (n.tone === 'bad') play('bad')
      else play('chime')
    }

    setVisible((current) => [...current, ...fresh].slice(-2))
    const timer = window.setTimeout(() => {
      setVisible((current) => current.filter((n) => !fresh.some((f) => f.id === n.id)))
    }, SHOW_MS)
    return () => window.clearTimeout(timer)
  }, [notices])

  if (!visible.length) return null
  return (
    <div className="notice-stack" role="status" aria-live="polite">
      {visible.map((n) => (
        <div key={n.id} className={`notice notice-${n.tone}`}>
          {n.text}
        </div>
      ))}
    </div>
  )
}
