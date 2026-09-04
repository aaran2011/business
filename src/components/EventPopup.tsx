import { money, signedMoney } from '../engine/log'
import type { GameState, Popup } from '../engine/types'

/** Full-screen event card for UNO, Chance, Party House, Resort, duties, Jail. */
export function EventPopup({
  popup,
  state,
  onDismiss,
}: {
  popup: Popup
  state: GameState
  onDismiss: () => void
}) {
  const { body } = popup

  if (body.kind === 'transfer') {
    return (
      <div className="overlay" onClick={onDismiss}>
        <div className="event-card" onClick={(e) => e.stopPropagation()}>
          <div className="event-deck transfer">Money changes hands</div>
          <div className="transfer-title">{body.title}</div>
          {body.note && <div className="transfer-note">{body.note}</div>}

          <div className="transfer-legs">
            {body.legs.map((leg, i) => {
              const from = state.players.find((p) => p.id === leg.fromId)
              const to = state.players.find((p) => p.id === leg.toId)
              if (!from || !to) return null
              return (
                <div className="transfer-leg" key={i}>
                  <span className="transfer-party">
                    <span className="player-token" style={{ background: from.colourHex }}>
                      {from.name.charAt(0).toUpperCase()}
                    </span>
                    <strong>{from.name}</strong>
                  </span>

                  <span className="transfer-flow">
                    <span className="transfer-arrow" aria-hidden="true" />
                    <span className="transfer-amount">{money(leg.amount)}</span>
                    <span className="transfer-arrow" aria-hidden="true" />
                  </span>

                  <span className="transfer-party">
                    <span className="player-token" style={{ background: to.colourHex }}>
                      {to.name.charAt(0).toUpperCase()}
                    </span>
                    <strong>{to.name}</strong>
                  </span>
                </div>
              )
            })}
          </div>

          <div className="event-foot">
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={onDismiss}>
              Continue
            </button>
          </div>
        </div>
      </div>
    )
  }

  const deckClass = body.kind === 'card' ? (body.deck === 'UNO' ? 'uno' : 'chance') : 'neutral'
  const deckLabel = body.kind === 'card' ? body.deck : 'EVENT'

  const title = body.kind === 'card' ? body.card.title : body.title
  const description = body.kind === 'card' ? body.card.description : body.subtitle
  const delta = body.delta
  const icon = body.kind === 'card' ? (body.deck === 'UNO' ? '\u{1F0CF}' : '\u{2753}') : body.icon

  const polarity =
    body.kind === 'card'
      ? body.deck === 'UNO'
        ? body.total % 2 === 0
          ? `Rolled ${body.total} — even, so UNO pays out`
          : `Rolled ${body.total} — odd, so UNO costs you`
        : body.total % 2 === 1
          ? `Rolled ${body.total} — odd, so Chance pays out`
          : `Rolled ${body.total} — even, so Chance costs you`
      : null

  return (
    <div className="overlay" onClick={onDismiss}>
      <div className="event-card" onClick={(e) => e.stopPropagation()}>
        <div className={`event-deck ${deckClass}`}>{deckLabel}</div>
        {icon && <div className="event-icon">{icon}</div>}
        <div className="event-title">{title}</div>
        {description && <div className="event-desc">{description}</div>}
        {typeof delta === 'number' && delta !== 0 && (
          <div className={`event-delta ${delta > 0 ? 'pos' : 'neg'}`}>{signedMoney(delta)}</div>
        )}
        {polarity && <div className="event-polarity">{polarity}</div>}
        <div className="event-foot">
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={onDismiss}>
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
