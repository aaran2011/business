import { useState } from 'react'
import { PLAYER_COLOURS } from '../data/playerColours'
import { CODE_LENGTH, normaliseCode } from '../net/protocol'
import type { Session } from '../net/useSession'

/**
 * "Put Code" — how a phone gets into someone else's game. Type the code, then
 * put in your own name and pick your own colour. You are added to the host's
 * lobby as you do it, and everyone sees you appear.
 */
export function JoinPanel({ session, onBack }: { session: Session; onBack: () => void }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const codeReady = normaliseCode(code).length === CODE_LENGTH

  const connected = session.status === 'ready' && session.role === 'guest'
  const seated = connected && session.myPlayerId !== null
  const me = seated ? session.state.lobby.find((e) => e.id === session.myPlayerId) : null

  const takenColours = new Set(
    session.state.lobby.filter((e) => e.id !== session.myPlayerId).map((e) => e.colourId),
  )
  const firstFree = PLAYER_COLOURS.find((c) => !takenColours.has(c.id)) ?? PLAYER_COLOURS[0]

  return (
    <div className="setup-shell">
      <div className="setup-hero">
        <h1>{connected ? 'You’re in' : 'Join a game'}</h1>
        <p>
          {connected
            ? 'Put in your name and pick your colour.'
            : "Put in the code showing on the host's screen."}
        </p>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span>{connected ? 'Your player' : 'Put Code'}</span>
          <span>{connected ? 'Connected' : 'Not connected'}</span>
        </div>

        <div className="panel-body">
          {/* ---------------------------------------------- enter the code -- */}
          {!connected && (
            <>
              <input
                className="input code-input"
                value={code}
                onChange={(e) => setCode(normaliseCode(e.target.value).slice(0, CODE_LENGTH))}
                placeholder="ABC123"
                maxLength={CODE_LENGTH}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                aria-label="Game code"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && codeReady) session.joinGame(code)
                }}
              />
              {session.status === 'connecting' && (
                <div className="host-status is-connecting">
                  Connecting to the game… this can take a few seconds.
                </div>
              )}
              {session.error && <div className="join-error">{session.error}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button className="btn" onClick={onBack}>
                  Back
                </button>
                <button
                  className="btn btn-primary"
                  style={{ marginLeft: 'auto' }}
                  disabled={!codeReady || session.status === 'connecting'}
                  onClick={() => session.joinGame(code)}
                >
                  {session.status === 'connecting' ? 'Connecting…' : 'Join game'}
                </button>
              </div>
            </>
          )}

          {/* ------------------------------------------- add yourself ------- */}
          {connected && !seated && (
            <>
              <input
                className="input"
                placeholder="Your name"
                value={name}
                maxLength={16}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') session.addMe(name, firstFree.id)
                }}
              />
              {session.error && <div className="join-error">{session.error}</div>}
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
                onClick={() => session.addMe(name, firstFree.id)}
              >
                Join as {name.trim() || 'Player'}
              </button>
            </>
          )}

          {/* --------------------------------------- change name / colour --- */}
          {seated && me && (
            <>
              <input
                className="input"
                value={me.name}
                maxLength={16}
                placeholder="Your name"
                onChange={(e) => session.editMe({ name: e.target.value })}
              />

              <div className="colour-choice">
                {PLAYER_COLOURS.map((colour) => {
                  const taken = takenColours.has(colour.id)
                  return (
                    <button
                      key={colour.id}
                      className={`swatch swatch-lg${me.colourId === colour.id ? ' is-selected' : ''}`}
                      style={{ background: colour.hex }}
                      disabled={taken}
                      title={taken ? `${colour.name} is taken` : colour.name}
                      onClick={() => session.editMe({ colourId: colour.id })}
                    />
                  )
                })}
              </div>

              <div className="host-status is-ready" style={{ marginTop: 16 }}>
                You're in as <strong>{me.name || 'Player'}</strong>. Waiting for the host to start.
              </div>

              <div className="lobby-list">
                {session.state.lobby.map((entry) => (
                  <div className="lobby-row" key={entry.id}>
                    <span
                      className="player-token"
                      style={{
                        background: PLAYER_COLOURS.find((c) => c.id === entry.colourId)?.hex,
                      }}
                    >
                      {(entry.name || 'P').charAt(0).toUpperCase()}
                    </span>
                    <strong>{entry.name || 'Player'}</strong>
                    {entry.id === session.myPlayerId && <span className="chip">You</span>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
