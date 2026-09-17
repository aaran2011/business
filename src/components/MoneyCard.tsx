import { useCallback, useEffect, useRef, useState } from 'react'
import { money } from '../engine/log'
import type { GameNotice, GameState } from '../engine/types'

/**
 * "You got paid — here is why", in the middle of the board where a country
 * card opens, with an OK.
 *
 * Two kinds, and the difference matters:
 *
 *   The player whose turn it is was paid. That card comes from the game state
 *   (`moneyToAck`), and the turn does not move on until they press OK — the
 *   device running the game waits for it.
 *
 *   Somebody else was paid during this turn — rent, usually. They get the same
 *   card on their own device, but it holds up nobody: one person away from
 *   their phone must not freeze the game for everyone. Those are kept here,
 *   on the device, and OK simply closes them.
 */

export interface MoneyCardData {
  /** Unique per card on this device. */
  key: string
  /** The notice it came from; what OK sends back for a card that waits. */
  noticeId: number
  playerId: string
  amount: number
  why: string
  from: string[]
  /** True when the turn is waiting for this OK. */
  holdsTheTurn: boolean
}

export function useMoneyCards(
  state: GameState,
  controlsPlayer: (playerId: string) => boolean,
): { card: MoneyCardData | null; dismissLocal: (key: string) => void } {
  const [local, setLocal] = useState<MoneyCardData[]>([])
  const seen = useRef<Set<number>>(new Set())
  const primed = useRef(false)
  const currentRef = useRef<string | undefined>(undefined)
  currentRef.current = state.turnOrder[state.currentIndex]

  useEffect(() => {
    // Joining mid-game hands a device every notice so far; none of that is new
    // money. Marked read on the first pass, even when there is nothing yet.
    if (!primed.current) {
      primed.current = true
      for (const n of state.notices) seen.current.add(n.id)
      return
    }
    const fresh = state.notices.filter((n) => !seen.current.has(n.id))
    if (!fresh.length) return
    for (const n of fresh) seen.current.add(n.id)

    const cards = fresh.flatMap((n) => cardsFor(n, controlsPlayer, currentRef.current))
    if (cards.length) setLocal((queue) => [...queue, ...cards])
  }, [state.notices, controlsPlayer])

  const dismissLocal = useCallback(
    (key: string) => setLocal((queue) => queue.filter((c) => c.key !== key)),
    [],
  )

  // The turn's own money first: it is the one holding the game.
  const waiting = (state.moneyToAck ?? []).find((a) => controlsPlayer(a.playerId))
  const card: MoneyCardData | null = waiting
    ? { ...waiting, key: `ack-${waiting.id}`, noticeId: waiting.id, holdsTheTurn: true }
    : (local[0] ?? null)

  return { card, dismissLocal }
}

/** Money in for a seat this device plays — other than the player on the move. */
function cardsFor(
  notice: GameNotice,
  controlsPlayer: (playerId: string) => boolean,
  currentId: string | undefined,
): MoneyCardData[] {
  return (notice.credited ?? [])
    .filter((c) => c.playerId !== currentId && controlsPlayer(c.playerId))
    .map((c) => ({
      key: `${notice.id}-${c.playerId}`,
      noticeId: notice.id,
      playerId: c.playerId,
      amount: c.amount,
      why: notice.why ?? notice.text,
      from: [
        ...new Set(
          (notice.transfer ?? []).filter((l) => l.toId === c.playerId).map((l) => l.fromId),
        ),
      ],
      holdsTheTurn: false,
    }))
}

export function MoneyCard({
  card,
  state,
  onOk,
}: {
  card: MoneyCardData
  state: GameState
  onOk: () => void
}) {
  const player = state.players.find((p) => p.id === card.playerId)
  const payers = card.from
    .map((id) => state.players.find((p) => p.id === id)?.name)
    .filter((name): name is string => Boolean(name))

  return (
    <div className="centre-card money-card" role="dialog" aria-label="Money received">
      <div className="centre-card-head">
        <span>{'\u{1F4B0}'} Money received</span>
      </div>
      <div className="centre-card-body money-body">
        {player && (
          <div className="money-who">
            <span className="player-token" style={{ background: player.colourHex }}>
              {player.name.charAt(0).toUpperCase()}
            </span>
            <strong>{player.name}</strong>
          </div>
        )}
        <div className="money-amount">+{money(card.amount)}</div>
        <div className="money-why">{sentence(card.why)}</div>
        {payers.length > 0 && <div className="money-from">From {listOf(payers)}</div>}
        <button className="btn btn-good money-ok" onClick={onOk}>
          OK
        </button>
      </div>
    </div>
  )
}

function sentence(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text
}

function listOf(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}
