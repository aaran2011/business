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
}: Props) {
  if (state.phase !== 'playing') return null

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
  const canAfford = purchase ? player.cash >= purchase.price : false
  const buildOffer = state.stage === 'awaitingBuild' ? state.pendingBuild : null
  const buildCheck = buildOffer
    ? canBuild(state, player.id, buildOffer.propertyId)
    : { allowed: false, reason: '', cost: 0, nextLabel: '' }
  const ownsAnything = ownedPropertyIds(state, player.id).length > 0

  return (
    <div className="actionbar">
      {inJail ? (
        <>
          <button
            className="btn btn-primary"
            onClick={() => dispatch({ type: 'JAIL_ROLL' })}
          >
            Roll the dice — {state.settings.jail.escapeDieRolls} rolls, need{' '}
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
            Pay {money(state.settings.jail.payToEscape)} and go free
          </button>
        </>
      ) : null}

      {purchase && canAfford && (
        <>
          <button className="btn btn-good" onClick={() => dispatch({ type: 'BUY_PROPERTY' })}>
            Buy {displayNameOf(purchase.propertyId)} — {money(purchase.price)}
          </button>
          <button className="btn" onClick={() => dispatch({ type: 'DECLINE_PURCHASE' })}>
            Don't buy
          </button>
        </>
      )}
      {purchase && !canAfford && (
        <button className="btn" onClick={() => dispatch({ type: 'DECLINE_PURCHASE' })}>
          Continue
        </button>
      )}

      {buildOffer && buildCheck.allowed && (
        <>
          <button
            className="btn btn-good"
            onClick={() => dispatch({ type: 'BUILD', propertyId: buildOffer.propertyId })}
          >
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

      {ownsAnything && (
        <button className="btn" onClick={onManage} disabled={busy}>
          Build / Sell / Mortgage
        </button>
      )}

      {inDebt && (
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
      )}

      {isHost && <HostControls {...{ onHouseRules, onRemovePlayer, onEndGame }} />}

      <div className="action-hint">{hintFor(state)}</div>
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

function hintFor(state: GameState): string {
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
