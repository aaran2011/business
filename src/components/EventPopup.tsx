import { money, signedMoney } from '../engine/log'
import type { GameState, Popup } from '../engine/types'

/**
 * UNO, Chance, Party House, Resort, duties, rent and the round bonus.
 *
 * This sits in the middle of the board, in the space the dice normally
 * occupy, rather than covering the screen. You keep looking at the board while
 * you read what happened, and the card is never bigger than the board itself.
 */
export function EventPopup({
  popup,
  state,
  onDismiss,
  mine,
}: {
  popup: Popup
  state: GameState
  onDismiss: () => void
  /** True on the device of the player this card is about. */
  mine: boolean
}) {
  const { body } = popup

  const deckClass = body.kind === 'card' ? (body.deck === 'UNO' ? 'uno' : 'chance') : 'neutral'
  const deckLabel =
    body.kind === 'card' ? body.deck : body.kind === 'transfer' ? 'MONEY' : 'EVENT'

  /**
   * Everyone reads what happened; only the player it happened to is asked to
   * do anything. A Continue button on somebody else's card does nothing, so it
   * is not shown — and neither is the × that would close it.
   */
  const foot = mine ? (
    <div className="centre-card-foot">
      <button className="btn btn-primary" style={{ width: '100%' }} onClick={onDismiss}>
        Continue
      </button>
    </div>
  ) : (
    <div className="centre-card-foot">
      <div className="event-watching">Waiting for them to continue…</div>
    </div>
  )

  const summary = popup.summary ? <div className="event-summary">{popup.summary}</div> : null

  return (
    <div className={`centre-card event-centre deck-${deckClass}`}>
      <div className="centre-card-head">
        <span>{deckLabel}</span>
        {mine && (
          <button
            type="button"
            className="centre-card-close"
            aria-label="Close card"
            onClick={onDismiss}
          >
            ×
          </button>
        )}
      </div>

      <div className="centre-card-body">
        {body.kind === 'transfer' ? (
          <TransferBody body={body} state={state} />
        ) : (
          <PlainBody body={body} />
        )}
        {summary}
      </div>

      {foot}
    </div>
  )
}

function TransferBody({
  body,
  state,
}: {
  body: Extract<Popup['body'], { kind: 'transfer' }>
  state: GameState
}) {
  return (
    <>
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
    </>
  )
}

function PlainBody({ body }: { body: Exclude<Popup['body'], { kind: 'transfer' }> }) {
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
    <>
      {icon && <div className="event-icon">{icon}</div>}
      <div className="event-title">{title}</div>
      {description && <div className="event-desc">{description}</div>}
      {typeof delta === 'number' && delta !== 0 && (
        <div className={`event-delta ${delta > 0 ? 'pos' : 'neg'}`}>{signedMoney(delta)}</div>
      )}
      {polarity && <div className="event-polarity">{polarity}</div>}
    </>
  )
}
