import { useState } from 'react'
import { TIMER_PRESETS } from '../data/settings'
import type { GameAction, GameState } from '../engine/types'

/** Sets an optional game duration. When it runs out the results screen opens. */
export function TimerModal({
  state,
  dispatch,
  onClose,
}: {
  state: GameState
  dispatch: (action: GameAction) => void
  onClose: () => void
}) {
  const current = state.timer.durationMs ? Math.round(state.timer.durationMs / 60000) : null
  const [custom, setCustom] = useState('')

  const set = (minutes: number) => {
    dispatch({ type: 'SET_TIMER', durationMs: minutes * 60000 })
    onClose()
  }

  const customMinutes = Number(custom)
  const customValid = Number.isFinite(customMinutes) && customMinutes > 0 && customMinutes <= 600

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ width: 'min(430px, 100%)' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{'\u{23F1}\u{FE0F}'} Game timer</div>
          <button className="close-x" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            Pick how long the game should run. When the clock hits zero the game stops and the
            results screen shows every player's total value and who won. You can carry on from
            there without the clock.
          </p>

          <div className="timer-grid">
            {TIMER_PRESETS.map((minutes) => (
              <button
                key={minutes}
                className={`btn timer-chip${current === minutes ? ' is-selected' : ''}`}
                onClick={() => set(minutes)}
              >
                {minutes} min
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <input
              className="input"
              type="number"
              min={1}
              max={600}
              placeholder="Custom minutes"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
            <button
              className="btn btn-primary"
              disabled={!customValid}
              onClick={() => set(customMinutes)}
            >
              Set
            </button>
          </div>
        </div>

        <div className="modal-foot">
          {state.timer.durationMs !== null && (
            <button
              className="btn btn-bad"
              onClick={() => {
                dispatch({ type: 'SET_TIMER', durationMs: null })
                onClose()
              }}
            >
              Turn timer off
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

/** Full-screen curtain while the game is paused between turns. */
export function PauseOverlay({ dispatch }: { dispatch: (action: GameAction) => void }) {
  return (
    <div className="overlay">
      <div className="event-card">
        <div className="event-deck neutral">Paused</div>
        <div className="event-icon">{'\u{23F8}\u{FE0F}'}</div>
        <div className="event-title">Game paused</div>
        <div className="event-desc">
          The clock is stopped too. Nothing moves until someone resumes.
        </div>
        <div className="event-foot">
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={() => dispatch({ type: 'RESUME' })}
          >
            Resume game
          </button>
        </div>
      </div>
    </div>
  )
}
