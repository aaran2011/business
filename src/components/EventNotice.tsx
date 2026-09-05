import { useEffect, useState } from 'react'
import type { GameNotice } from '../engine/types'

/**
 * What the OTHER phones are told.
 *
 * One short sentence — "Priya bought Egypt." — and nothing else. No card, no
 * price, no rent table, no balances: a purchase is the buyer's business, and
 * the other players only need to know it happened. It needs no dismissing,
 * because it never blocks anything; it appears for a few seconds and goes.
 *
 * The notice itself travels in the game state, so every device gets the same
 * one at the same time. The device whose player caused it skips it — they
 * watched it happen in full.
 */
const SHOW_MS = 3600

export function EventNotice({
  notice,
  mine,
}: {
  notice: GameNotice | null
  /** True on the device of the player who caused it. */
  mine: boolean
}) {
  const [shown, setShown] = useState<GameNotice | null>(null)

  useEffect(() => {
    if (!notice || mine) return
    setShown(notice)
    const timer = window.setTimeout(() => setShown(null), SHOW_MS)
    return () => window.clearTimeout(timer)
    // Keyed on the id: the same sentence twice is still two events.
  }, [notice?.id, mine])

  if (!shown) return null
  return (
    <div className="event-notice" role="status">
      {shown.text}
    </div>
  )
}
