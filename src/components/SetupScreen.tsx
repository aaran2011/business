import { useEffect, useRef, useState } from 'react'
import { PLAYER_COLOURS } from '../data/playerColours'
import { money } from '../engine/log'
import { multiplayerSetupHint } from '../net/supabase'
import type { Session } from '../net/useSession'

/**
 * The lobby. Everyone in the game appears here, whether they were added on
 * this device or joined from their own phone with the code — the roster lives
 * in shared state, so all screens show the same thing as it fills up.
 */
export function SetupScreen({
  session,
  onJoinInstead,
}: {
  session: Session
  onJoinInstead: () => void
}) {
  const { state, dispatch } = session
  const { minPlayers, maxPlayers, startingCash } = state.settings
  const [copied, setCopied] = useState(false)
  const [showCode, setShowCode] = useState(false)

  const lobby = state.lobby
  const full = lobby.length >= maxPlayers
  const ready = lobby.length >= minPlayers
  /** Only the device running the game sets it up and starts it. */
  const isGuest = session.role === 'guest'

  // The host device always holds at least one seat: whoever set the game up.
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current || lobby.length > 0 || isGuest) return
    seeded.current = true
    dispatch({
      type: 'ADD_LOBBY_PLAYER',
      id: 'host',
      name: '',
      colourId: PLAYER_COLOURS[0].id,
      isHost: true,
    })
  }, [dispatch, lobby.length, isGuest])

  const addLocalPlayer = () => {
    if (full) return
    dispatch({
      type: 'ADD_LOBBY_PLAYER',
      id: `local-${Date.now().toString(36)}`,
      name: '',
      colourId: PLAYER_COLOURS[lobby.length % PLAYER_COLOURS.length].id,
    })
  }

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
                <span className="code-label">Put this code in on the other devices</span>
                <span className="code-value">{state.gameCode}</span>
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    navigator.clipboard?.writeText(state.gameCode).then(
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
                    ? 'Open. Everyone else puts this code in on their own device.'
                    : `${session.deviceCount} device${session.deviceCount === 1 ? '' : 's'} connected.`)}
                {session.status === 'error' && (session.error ?? 'Could not open the game.')}
                {session.status === 'idle' && 'Getting ready…'}
              </div>

              <div className="rent-note" style={{ background: 'transparent', padding: '10px 0 0' }}>
                Keep this device open — it runs the game. Everyone who joins puts in their own name
                and colour, and they appear in the list here.
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
          {minPlayers}–{maxPlayers} players · {money(startingCash)} each
        </p>
        {!session.multiplayerAvailable && <p className="hero-note">{multiplayerSetupHint()}</p>}
      </div>

      <div className="panel">
        <div className="panel-head">
          <span>Players</span>
          <span>
            {lobby.length} of {maxPlayers}
          </span>
        </div>

        {lobby.map((entry, i) => {
          const mine = session.controlsPlayer(entry.id)
          return (
            <div className="setup-row" key={entry.id}>
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
                disabled={!mine}
                title={mine ? undefined : 'Set on their own phone'}
                onChange={(e) =>
                  dispatch({ type: 'UPDATE_LOBBY_PLAYER', id: entry.id, name: e.target.value })
                }
              />
              <div className="swatch-picker">
                {PLAYER_COLOURS.map((colour) => {
                  const takenBy = lobby.findIndex((e) => e.colourId === colour.id)
                  const disabled = !mine || (takenBy !== -1 && lobby[takenBy].id !== entry.id)
                  return (
                    <button
                      key={colour.id}
                      className={`swatch${entry.colourId === colour.id ? ' is-selected' : ''}`}
                      style={{ background: colour.hex }}
                      disabled={disabled}
                      title={colour.name}
                      onClick={() =>
                        dispatch({
                          type: 'UPDATE_LOBBY_PLAYER',
                          id: entry.id,
                          colourId: colour.id,
                        })
                      }
                    />
                  )
                })}
              </div>
              {!mine && <span className="seat-badge">on their device</span>}
              {mine && !entry.isHost && lobby.length > minPlayers && (
                <button
                  className="close-x"
                  onClick={() => dispatch({ type: 'REMOVE_LOBBY_PLAYER', id: entry.id })}
                >
                  ×
                </button>
              )}
            </div>
          )
        })}

        <div className="panel-body setup-actions">
          {isGuest ? (
            <div className="waiting-banner">
              <span className="waiting-dot" aria-hidden="true" />
              <div>
                <strong>Wait for the host to start the game.</strong>
                <div className="waiting-sub">
                  You're in as{' '}
                  {lobby.find((e) => session.controlsPlayer(e.id))?.name || 'Player'}. You can still
                  change your name or colour above.
                </div>
              </div>
            </div>
          ) : (
            <>
              <button className="btn" onClick={addLocalPlayer} disabled={full}>
                Add player on this device
              </button>
              {/*
                With no game server there is nothing behind these two, so they
                are not offered — a button that only ever produces an apology
                is worse than no button. Everybody can still play on one phone.
              */}
              {session.multiplayerAvailable && (
                <>
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
                </>
              )}
              <button
                className="btn btn-primary"
                style={{ marginLeft: 'auto' }}
                disabled={!ready}
                onClick={() => dispatch({ type: 'START_GAME' })}
                title={ready ? undefined : `Needs at least ${minPlayers} players`}
              >
                Start game
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
