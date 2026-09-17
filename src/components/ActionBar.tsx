import { canBuild } from '../engine/building'
import { money } from '../engine/log'
import { currentPlayer, debtOwedBy, displayNameOf, ownedPropertyIds } from '../engine/queries'
import type { GameAction, GameState } from '../engine/types'

interface Props {
  state: GameState
  dispatch: (action: GameAction) => void
  onManage: () => void
  onHouseRules: () => void
  onEndGame: () => void
  onRemovePlayer: () => void
  /** False on a joined phone when it is somebody else's turn. */
  canAct: boolean
  /** Only the device running the game gets the host controls. */
  isHost: boolean
  /** Building goes through here so the colour-group warning cannot be skipped. */
  onBuild: (propertyId: string) => void
  /**
   * `full` is the bar along the bottom of the square board. `decisions` is only
   * the buttons that answer the game — buy, build, pay, Jail — for the phone's
   * turn panel, which keeps everything else in its own menu. Same logic either
   * way, so the phone can never offer a choice the rules would refuse.
   */
  mode?: 'full' | 'decisions'
}

/**
 * There is no End Turn button — a turn ends by itself once the player has no
 * decision left to make. See the auto-end effect in App.
 */
export function ActionBar({
  state,
  dispatch,
  onManage,
  onHouseRules,
  onEndGame,
  onRemovePlayer,
  canAct,
  isHost,
  onBuild,
  mode = 'full',
}: Props) {
  if (state.phase !== 'playing') return null
  if (mode === 'decisions' && !canAct) return null

  // Waiting your turn. The host still runs the game while somebody else plays,
  // so its controls stay put rather than disappearing for most of the game.
  if (!canAct) {
    return (
      <div className="actionbar">
        <div className="not-your-turn">
          <span className="not-your-turn-label">Not your turn</span>
          <span>{currentPlayer(state).name} is playing — wait for your go.</span>
        </div>
        {isHost && <HostControls {...{ onHouseRules, onRemovePlayer, onEndGame }} />}
      </div>
    )
  }

  const player = currentPlayer(state)
  const owed = debtOwedBy(state, player.id)
  const inDebt = owed > 0
  const busy = state.stage === 'moving' || state.paused

  const inJail = state.stage === 'inJail' && !busy
  const purchase = state.stage === 'awaitingPurchase' ? state.pendingPurchase : null
  const buildOffer = state.stage === 'awaitingBuild' ? state.pendingBuild : null
  const buildCheck = buildOffer
    ? canBuild(state, player.id, buildOffer.propertyId)
    : { allowed: false, reason: '', cost: 0, nextLabel: '' }
  const ownsAnything = ownedPropertyIds(state, player.id).length > 0
  // Money just came in and the card saying why is still open. Every other
  // question waits behind its OK, so nothing is answered before it is read.
  const awaitingOk = (state.moneyToAck ?? []).some((a) => a.playerId === player.id)

  // Jail is manual: nothing rolls for the player, they choose.
  const jailButtons = inJail ? (
    <>
      <button className="btn btn-primary" onClick={() => dispatch({ type: 'JAIL_ROLL' })}>
        Roll ({player.jailRolls.length} of {state.settings.jail.escapeDieRolls} used) — need{' '}
        {state.settings.jail.escapeTargetTotal}+
      </button>
      <button
        className="btn btn-good"
        onClick={() => dispatch({ type: 'JAIL_PAY' })}
        disabled={player.cash < state.settings.jail.payToEscape}
        title={
          player.cash < state.settings.jail.payToEscape
            ? `Needs ${money(state.settings.jail.payToEscape)} in cash.`
            : undefined
        }
      >
        Pay {money(state.settings.jail.payToEscape)} to the bank
      </button>
    </>
  ) : null

  const purchaseButtons = purchase && (
    <>
      <button className="btn btn-good" onClick={() => dispatch({ type: 'BUY_PROPERTY' })}>
        Buy {displayNameOf(purchase.propertyId)} — {money(purchase.price)}
      </button>
      <button className="btn" onClick={() => dispatch({ type: 'DECLINE_PURCHASE' })}>
        Don't buy
      </button>
    </>
  )

  const buildButtons = (
    <>
      {buildOffer && buildCheck.allowed && (
        <>
          <button className="btn btn-good" onClick={() => onBuild(buildOffer.propertyId)}>
            Build {buildCheck.nextLabel || 'house'}
            {buildCheck.cost ? ` — ${money(buildCheck.cost)}` : ''}
          </button>
          <button className="btn" onClick={() => dispatch({ type: 'DECLINE_BUILD' })}>
            Not now
          </button>
        </>
      )}
      {buildOffer && !buildCheck.allowed && (
        <button className="btn" onClick={() => dispatch({ type: 'DECLINE_BUILD' })}>
          Continue
        </button>
      )}
    </>
  )

  /*
    Out of reach means out of reach. While an unaffordable country is on
    offer the deeds screen is closed too, so there is no mortgage-something
    -and-come-straight-back route to a purchase the player cannot afford.
    Raising cash is still possible on any other turn, and always when a
    debt has to be settled.
  */
  const manageButton = ownsAnything && (
    <button className="btn" onClick={onManage} disabled={busy}>
      Build / Sell / Mortgage
    </button>
  )

  const payButton = inDebt && (
    <button
      className="btn btn-good"
      onClick={() => dispatch({ type: 'SETTLE_DEBT' })}
      disabled={player.cash < owed}
      title={
        player.cash < owed
          ? `Only ${money(player.cash)} in hand — raise the rest by mortgaging or selling.`
          : undefined
      }
    >
      Pay {money(owed)}
    </button>
  )

  if (mode === 'decisions') {
    if (awaitingOk) return null
    return (
      <>
        {jailButtons}
        {purchaseButtons}
        {buildButtons}
        {payButton}
      </>
    )
  }

  return (
    <div className="actionbar">
      {!awaitingOk && (
        <>
          {jailButtons}
          {purchaseButtons}
          {buildButtons}
        </>
      )}
      {manageButton}
      {!awaitingOk && payButton}
      {isHost && <HostControls {...{ onHouseRules, onRemovePlayer, onEndGame }} />}
      <div className="action-hint">
        {awaitingOk ? 'Press OK on the card to carry on.' : hintFor(state)}
      </div>
    </div>
  )
}

/** House Rules, Remove Player and End Game. Never rendered on a joined phone. */
function HostControls({
  onHouseRules,
  onRemovePlayer,
  onEndGame,
}: {
  onHouseRules: () => void
  onRemovePlayer: () => void
  onEndGame: () => void
}) {
  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={onHouseRules}>
        House Rules
      </button>
      <button className="btn btn-ghost btn-sm" onClick={onRemovePlayer}>
        Remove Player
      </button>
      <button className="btn btn-bad btn-sm" onClick={onEndGame}>
        End Game
      </button>
    </>
  )
}

export function hintFor(state: GameState): string {
  if (state.paused) return 'Paused.'
  const player = currentPlayer(state)
  const owed = debtOwedBy(state, player.id)

  if (owed > 0) {
    return `${player.name} owes ${money(owed)}. Mortgage holdings or sell buildings to raise it, then pay.`
  }
  switch (state.stage) {
    case 'awaitingRoll':
      return `${player.name} to roll.`
    case 'moving':
      return 'Moving…'
    case 'awaitingPurchase': {
      if (!state.pendingPurchase) return ''
      const { propertyId, price } = state.pendingPurchase
      return player.cash < price
        ? `${displayNameOf(propertyId)} costs ${money(price)} — out of reach, so it stays with the Bank.`
        : `${displayNameOf(propertyId)} is unowned at ${money(price)}.`
    }
    case 'awaitingBuild':
      return state.pendingBuild
        ? `${displayNameOf(state.pendingBuild.propertyId)} is yours. Build on it, or carry on — either way the turn then ends.`
        : ''
    case 'inJail': {
      const { payToEscape, escapeDieRolls, escapeTargetTotal } = state.settings.jail
      return `${player.name} is in Jail. Roll one die ${escapeDieRolls} times and total ${escapeTargetTotal}+, or pay ${money(payToEscape)} — either way they get out on their next turn.`
    }
    case 'awaitingEndTurn':
      return 'Ending the turn…'
    default:
      return ''
  }
}
