import { useEffect, useMemo, useRef, useState } from 'react'
import { COUNTRIES } from '../data/properties'
import { SPECIAL_ASSETS } from '../data/specialAssets'
import { bidProblem, maxBid, minimumBid } from '../engine/auction'
import { money } from '../engine/log'
import { displayNameOf } from '../engine/queries'
import type { GameAction, GameState } from '../engine/types'
import { compactMoney } from './format'

/**
 * What the card actually earns, in one line.
 *
 * Bidding without it is bidding blind — the board is behind the panel, and
 * nobody can weigh $5,500 for Iraq against a rent they cannot see. Printed
 * values, shown as printed.
 */
function worthLine(propertyId: string): string {
  const country = COUNTRIES[propertyId]
  if (country) return `site rent ${money(country.rent.site)} · house ${money(country.houseCost)}`
  const asset = SPECIAL_ASSETS[propertyId]
  if (asset) return `rent ${money(asset.rent)} · ${money(asset.pairedRent)} with the pair`
  return ''
}

/**
 * The auction, in BID mode only.
 *
 * It takes over the screen rather than sitting in the middle of the board, and
 * it does so on the phone and the laptop alike. Five seconds is not long
 * enough to go looking for a button: everybody at the table has to see the
 * price, the clock and their own bid buttons at a glance, and a 200-pixel card
 * in the middle of a phone board cannot carry that.
 *
 * It cannot be dismissed. There is no × and the backdrop does nothing — the
 * card is being sold whether or not this device joins in, and the panel goes
 * when the bidding is settled.
 */
export function AuctionPanel({
  state,
  dispatch,
  controlsPlayer,
}: {
  state: GameState
  dispatch: (action: GameAction) => void
  controlsPlayer: (playerId: string) => boolean
}) {
  const auction = state.auction
  const secondsLeft = useCountdown(state)

  if (!auction) return null

  const name = displayNameOf(auction.propertyId)
  const least = minimumBid(state)
  const highBidder = state.players.find((p) => p.id === auction.highBidderId)
  const lander = state.players.find((p) => p.id === auction.landedBy)

  /*
    Everyone this device is playing. On a joined phone that is one seat; on a
    pass-and-play game it is the whole table, so each player gets their own row
    of buttons and nobody has to hand the phone over mid-count.

    Computer seats are left out. This device does answer for them, but it
    answers as the machine — offering a person the buttons to bid on the
    computer's behalf would let them simply hand themselves the card.
  */
  const mine = state.players.filter((p) => !p.isOut && !p.isComputer && controlsPlayer(p.id))
  const computersBidding = state.players.some((p) => !p.isOut && p.isComputer)

  return (
    <div className="overlay is-auction">
      <div className="modal auction">
        <div className="auction-head">
          <div className="auction-title">
            <span className="auction-kicker">Up for auction</span>
            <strong>{name}</strong>
            <span className="auction-printed">
              Printed price {money(auction.price)}
              {worthLine(auction.propertyId) && ` · ${worthLine(auction.propertyId)}`}
            </span>
          </div>
          <Clock seconds={secondsLeft} paused={state.paused} />
        </div>

        <div className="auction-standing">
          {highBidder ? (
            <>
              <span
                className="player-token"
                style={{ background: highBidder.colourHex }}
                aria-hidden="true"
              >
                {highBidder.name.charAt(0).toUpperCase()}
              </span>
              <div className="auction-standing-text">
                <strong>{money(auction.highBid ?? 0)}</strong>
                <span>
                  {highBidder.name}
                  {auction.openedByBuy && auction.bids.length === 1 ? ' opened the bidding' : ' leads'}
                </span>
              </div>
            </>
          ) : (
            <div className="auction-standing-text">
              <strong>No bids yet</strong>
              <span>
                {lander ? `${lander.name} passed. ` : ''}First bid from {money(least)}
              </span>
            </div>
          )}
        </div>

        {state.paused ? (
          <div className="auction-note">The game is paused. The clock stops where it is.</div>
        ) : mine.length === 0 ? (
          <div className="auction-note">
            {computersBidding
              ? 'The computer players are bidding. Nothing here needs you.'
              : 'You have no seat in this game, so there is nothing for you to bid.'}
          </div>
        ) : (
          mine.map((player) => (
            <BidRow
              key={player.id}
              state={state}
              dispatch={dispatch}
              playerId={player.id}
              showWho={mine.length > 1}
            />
          ))
        )}

        <BidHistory state={state} />

        <div className="auction-foot">
          Bidding closes {state.settings.bidding.clockSeconds} seconds after the last bid. The
          minimum raise is {money(state.settings.bidding.minRaise)}, and nobody may bid more than
          they hold.
        </div>
      </div>
    </div>
  )
}

/**
 * The clock every device runs for itself.
 *
 * It counts from the moment this device HEARD the latest bid, not from a
 * timestamp the host put in the state. Phones' clocks disagree by seconds, and
 * on a five-second auction that would show one player 5 and another 0. The
 * host's own deadline is still the only thing that closes the bidding — see
 * `auctionExpired` — so this is a display, never an authority.
 */
function useCountdown(state: GameState): number {
  const total = Math.max(1, state.settings.bidding.clockSeconds) * 1000
  const auction = state.auction
  const seq = auction?.bidSeq ?? 0
  const open = Boolean(auction)
  const paused = state.paused
  const [left, setLeft] = useState(total)
  // The remainder a pause froze, so the count picks up where it stopped.
  const frozen = useRef(total)

  useEffect(() => {
    if (!open) return
    if (paused) {
      frozen.current = left
      return
    }
    const from = frozen.current
    const started = Date.now()
    setLeft(from)
    const tick = window.setInterval(() => {
      setLeft(Math.max(0, from - (Date.now() - started)))
    }, 100)
    return () => window.clearInterval(tick)
    // `left` is deliberately not a dependency: it changes on every tick, and
    // reading it here is only to remember where a pause stopped.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seq, paused, total])

  // A new bid gives the clock its full count back.
  useEffect(() => {
    frozen.current = total
  }, [seq, total])

  return Math.ceil(left / 1000)
}

function Clock({ seconds, paused }: { seconds: number; paused: boolean }) {
  return (
    <div className={`auction-clock${seconds <= 2 && !paused ? ' is-low' : ''}`}>
      <span className="auction-clock-num">{paused ? '–' : seconds}</span>
      <span className="auction-clock-unit">{paused ? 'paused' : 'sec'}</span>
    </div>
  )
}

/**
 * One player's bid buttons.
 *
 * The amounts are spelled out rather than offered as "+$100", because what
 * matters in five seconds is what you are about to commit, not the size of the
 * step. Every button is checked by the same `bidProblem` the engine uses, so a
 * button is never offered for a bid the rules would refuse.
 */
function BidRow({
  state,
  dispatch,
  playerId,
  showWho,
}: {
  state: GameState
  dispatch: (action: GameAction) => void
  playerId: string
  showWho: boolean
}) {
  const player = state.players.find((p) => p.id === playerId)!
  const least = minimumBid(state)
  const most = maxBid(state, playerId)
  const leading = state.auction?.highBidderId === playerId
  const [typed, setTyped] = useState('')

  // Several players on one device means several rows, so each one gets fewer
  // buttons: the panel has to stay on one screen during a five-second clock.
  const compact = showWho
  const offers = useMemo(() => {
    const amounts = new Set<number>([least])
    for (const step of state.settings.bidding.quickRaises) amounts.add(least + step)
    return [...amounts].sort((a, b) => a - b).slice(0, compact ? 2 : 4)
  }, [least, state.settings.bidding.quickRaises, compact])

  const bid = (amount: number) => {
    if (bidProblem(state, playerId, amount) !== null) return
    dispatch({ type: 'PLACE_BID', playerId, amount })
    setTyped('')
  }

  const typedAmount = Math.round(Number(typed))
  const typedProblem = typed === '' ? 'Type an amount.' : bidProblem(state, playerId, typedAmount)

  return (
    <div className={`bid-row${leading ? ' is-leading' : ''}${compact ? ' is-compact' : ''}`}>
      {showWho && (
        <div className="bid-who">
          <span className="player-token" style={{ background: player.colourHex }}>
            {player.name.charAt(0).toUpperCase()}
          </span>
          <span className="bid-who-name">{player.name}</span>
          <span className="bid-who-cash">{compactMoney(player.cash)}</span>
        </div>
      )}

      {leading ? (
        <div className="bid-leading">You are the high bidder — wait for the clock.</div>
      ) : most < least ? (
        <div className="bid-short">
          {showWho ? '' : 'You have '}
          {money(most)} — not enough to bid {money(least)}.
        </div>
      ) : (
        <div className={compact ? 'bid-line' : 'bid-stack'}>
          <div className="bid-buttons">
            {offers.map((amount) => (
              <button
                key={amount}
                className="btn btn-good btn-bid"
                disabled={bidProblem(state, playerId, amount) !== null}
                onClick={() => bid(amount)}
              >
                {money(amount)}
              </button>
            ))}
            {/* Everything they have, in one tap. His "Max at one time". */}
            <button
              className="btn btn-bid btn-max"
              disabled={bidProblem(state, playerId, most) !== null}
              title={`Bid everything you hold — ${money(most)}`}
              onClick={() => bid(most)}
            >
              Max {compactMoney(most)}
            </button>
          </div>
          <div className="bid-custom">
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={least}
              max={most}
              step={state.settings.bidding.minRaise}
              placeholder={`${least} or more`}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && typedProblem === null) bid(typedAmount)
              }}
            />
            <button
              className="btn btn-primary btn-sm"
              disabled={typedProblem !== null}
              title={typedProblem ?? undefined}
              onClick={() => bid(typedAmount)}
            >
              Bid
            </button>
          </div>
          {!showWho && <div className="bid-cash">You have {money(most)}</div>}
        </div>
      )}
    </div>
  )
}

/** The last few bids, newest first, so the room can see how it went. */
function BidHistory({ state }: { state: GameState }) {
  const bids = state.auction?.bids ?? []
  if (!bids.length) return null
  return (
    <ol className="bid-history">
      {[...bids]
        .reverse()
        .slice(0, 4)
        .map((entry, i) => {
          const who = state.players.find((p) => p.id === entry.playerId)
          return (
            <li key={`${entry.playerId}-${entry.amount}-${i}`}>
              <span className="bid-dot" style={{ background: who?.colourHex }} aria-hidden="true" />
              {who?.name ?? 'Someone'} bid <strong>{money(entry.amount)}</strong>
            </li>
          )
        })}
    </ol>
  )
}
