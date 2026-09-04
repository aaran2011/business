import { useState } from 'react'
import { PLAYER_COLOURS } from '../data/playerColours'
import { DEFAULT_SETTINGS } from '../data/settings'
import { money } from '../engine/log'
import type { Session } from '../net/useSession'

interface Entry {
  name: string
  colourId: string
}

/** 2–6 players, each with a name and a token colour. */
export function SetupScreen({
  session,
  onJoinInstead,
}: {
  session: Session
  onJoinInstead: () => void
}) {
  const gameCode = session.state.gameCode
  const dispatch = session.dispatch
  const [copied, setCopied] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const { minPlayers, maxPlayers, startingCash } = DEFAULT_SETTINGS

  const [entries, setEntries] = useState<Entry[]>([
    { name: '', colourId: PLAYER_COLOURS[0].id },
    { name: '', colourId: PLAYER_COLOURS[1].id },
  ])

  const setEntry = (index: number, patch: Partial<Entry>) =>
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)))

  const addPlayer = () => {
    const taken = new Set(entries.map((e) => e.colourId))
    const free = PLAYER_COLOURS.find((c) => !taken.has(c.id)) ?? PLAYER_COLOURS[0]
    setEntries((prev) => [...prev, { name: '', colourId: free.id }])
  }

  const start = () =>
    dispatch({
      type: 'START_GAME',
      players: entries.map((e, i) => ({
        name: e.name.trim() || `Player ${i + 1}`,
        colourId: e.colourId,
      })),
    })

  return (
    <div className="setup-shell">
      {showCode && (
        <div className="overlay" onClick={() => setShowCode(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">Game code</div>
              <button className="close-x" onClick={() => setShowCode(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="code-box">
                <span className="code-label">Put this code in on the other phone</span>
                <span className="code-value">{gameCode}</span>
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    navigator.clipboard?.writeText(gameCode).then(
                      () => {
                        setCopied(true)
                        window.setTimeout(() => setCopied(false), 1600)
                      },
                      () => undefined,
                    )
                  }}
                >
                  {copied ? 'Copied' : 'Copy code'}
                </button>
              </div>

              <div className={`host-status is-${session.status}`}>
                {session.status === 'connecting' && 'Opening the game to other phones…'}
                {session.status === 'ready' &&
                  (session.guestCount === 0
                    ? 'Open. Put the code in on another phone to join.'
                    : `${session.guestCount} phone${session.guestCount === 1 ? '' : 's'} connected.`)}
                {session.status === 'error' && (session.error ?? 'Could not open the game.')}
                {session.status === 'idle' && 'Getting ready…'}
              </div>

              <div className="rent-note" style={{ background: 'transparent', padding: '10px 0 0' }}>
                This phone runs the game, so keep it open. Everyone else puts the code in on their
                own phone under <strong>Join a game</strong>, picks who they are, and sees only
                their own money.
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-primary" onClick={() => setShowCode(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="setup-hero">
        <h1>Business</h1>
        <p>
          {minPlayers}–{maxPlayers} players · {money(startingCash)} each · pass the device between
          turns
        </p>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span>Players</span>
          <span>
            {entries.length} of {maxPlayers}
          </span>
        </div>

        {entries.map((entry, i) => (
          <div className="setup-row" key={i}>
            <span
              className="player-token"
              style={{
                background: PLAYER_COLOURS.find((c) => c.id === entry.colourId)?.hex,
              }}
            >
              {i + 1}
            </span>
            <input
              className="input"
              placeholder={`Player ${i + 1}`}
              value={entry.name}
              maxLength={16}
              onChange={(e) => setEntry(i, { name: e.target.value })}
            />
            <div className="swatch-picker">
              {PLAYER_COLOURS.map((colour) => {
                const takenBy = entries.findIndex((e) => e.colourId === colour.id)
                const disabled = takenBy !== -1 && takenBy !== i
                return (
                  <button
                    key={colour.id}
                    className={`swatch${entry.colourId === colour.id ? ' is-selected' : ''}`}
                    style={{ background: colour.hex }}
                    disabled={disabled}
                    title={colour.name}
                    onClick={() => setEntry(i, { colourId: colour.id })}
                  />
                )
              })}
            </div>
            {entries.length > minPlayers && (
              <button
                className="close-x"
                onClick={() => setEntries((prev) => prev.filter((_, idx) => idx !== i))}
              >
                ×
              </button>
            )}
          </div>
        ))}

        <div className="panel-body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn" onClick={addPlayer} disabled={entries.length >= maxPlayers}>
            Add player
          </button>
          <button
            className="btn"
            onClick={() => {
              session.startHosting()
              setShowCode(true)
            }}
          >
            Get the code
          </button>
          <button className="btn" onClick={onJoinInstead}>
            Put Code — join a game
          </button>
          <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={start}>
            Continue → roll for turn order
          </button>
        </div>
      </div>
    </div>
  )
}
