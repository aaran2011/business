import { useState } from 'react'
import type { Session } from '../net/useSession'

/**
 * The join code, and how many devices are actually in the game.
 *
 * "Devices", not "phones": a laptop and a tablet count the same as a phone,
 * and the host needs to know how many are really connected before starting.
 * Only the host ever sees this.
 */
export function GameCodeModal({ session, onClose }: { session: Session; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const devices = session.deviceCount

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Game code</div>
          <button className="close-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="code-box">
            <span className="code-label">Put this code in on the other device</span>
            <span className="code-value">{session.state.gameCode}</span>
            <button
              className="btn btn-sm"
              onClick={() => {
                navigator.clipboard?.writeText(session.state.gameCode).then(
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
            {devices} device{devices === 1 ? '' : 's'} connected
          </div>

          <div className="modal-note">
            Somebody joining now picks the game up exactly as it stands — the board, the money and
            whose turn it is. Nothing here is reset, and nobody else's game is interrupted.
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
