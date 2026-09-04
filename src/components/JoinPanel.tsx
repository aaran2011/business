import { useState } from 'react'
import { CODE_LENGTH, normaliseCode } from '../net/protocol'
import type { Session } from '../net/useSession'

/**
 * "Put Code" — the way a second phone gets into a game someone else is
 * hosting. Type the code, pick which player you are, and you are in.
 */
export function JoinPanel({ session, onBack }: { session: Session; onBack: () => void }) {
  const [code, setCode] = useState('')
  const ready = normaliseCode(code).length === CODE_LENGTH

  const joined = session.status === 'ready' && session.role === 'guest'
  const seated = joined && session.myPlayerId !== null

  return (
    <div className="setup-shell">
      <div className="setup-hero">
        <h1>Join a game</h1>
        <p>Put in the code showing on the host's screen.</p>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span>Put Code</span>
          <span>{joined ? 'Connected' : 'Not connected'}</span>
        </div>

        <div className="panel-body">
          {!joined && (
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
                inputMode="text"
                aria-label="Game code"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && ready) session.joinGame(code)
                }}
              />

              {session.error && <div className="join-error">{session.error}</div>}

              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button className="btn" onClick={onBack}>
                  Back
                </button>
                <button
                  className="btn btn-primary"
                  style={{ marginLeft: 'auto' }}
                  disabled={!ready || session.status === 'connecting'}
                  onClick={() => session.joinGame(code)}
                >
                  {session.status === 'connecting' ? 'Connecting…' : 'Join game'}
                </button>
              </div>
            </>
          )}

          {joined && !seated && (
            <>
              <div className="notice" style={{ marginBottom: 12 }}>
                You're in. Now pick which player you are — that phone then shows only your
                money, and you roll on your own turn.
              </div>
              {session.state.players.length === 0 && (
                <div className="empty-note">
                  The host has not set the players up yet. This will fill in as soon as they do.
                </div>
              )}
              {session.state.players.map((player) => {
                const taken = session.takenSeats.includes(player.id)
                return (
                  <button
                    key={player.id}
                    className="remove-row"
                    disabled={taken}
                    style={taken ? { opacity: 0.45 } : undefined}
                    onClick={() => session.claimSeat(player.id)}
                  >
                    <span className="player-token" style={{ background: player.colourHex }}>
                      {player.name.charAt(0).toUpperCase()}
                    </span>
                    <strong>{player.name}</strong>
                    <span className="remove-meta">{taken ? 'Taken' : 'Tap to play as them'}</span>
                  </button>
                )
              })}
              {session.error && <div className="join-error">{session.error}</div>}
            </>
          )}

          {seated && (
            <div className="notice" style={{ marginBottom: 0 }}>
              Connected. Waiting for the host to start the game.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
