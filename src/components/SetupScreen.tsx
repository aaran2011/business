import { useState } from 'react'
import { PLAYER_COLOURS } from '../data/playerColours'
import { DEFAULT_SETTINGS } from '../data/settings'
import { money } from '../engine/log'
import type { GameAction } from '../engine/types'

interface Entry {
  name: string
  colourId: string
}

/** 2–6 players, each with a name and a token colour. */
export function SetupScreen({
  gameCode,
  dispatch,
}: {
  gameCode: string
  dispatch: (action: GameAction) => void
}) {
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
                <span className="code-label">Share this code</span>
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
              <div className="notice" style={{ marginTop: 14, marginBottom: 0 }}>
                This code names the game session. Joining from a second device also needs a live
                server to sync the board between phones, which this build does not have yet — so
                for now everyone plays by passing this one device around.
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
          <button className="btn" onClick={() => setShowCode(true)}>
            Get the code
          </button>
          <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={start}>
            Continue → roll for turn order
          </button>
        </div>
      </div>
    </div>
  )
}
