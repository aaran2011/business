/**
 * Plays complete randomised games through the real reducer and asserts that
 * the invariants hold on every single step. Run with: npm run simulate
 */

import { BOARD_SIZE } from '../src/data/board'
import { COUNTRIES } from '../src/data/properties'
import { SPECIAL_ASSETS } from '../src/data/specialAssets'
import { canBuild, canSellBuilding } from '../src/engine/building'
import { createInitialState, gameReducer } from '../src/engine/game'
import { canMortgage } from '../src/engine/mortgage'
import { debtOwedBy, ownedPropertyIds } from '../src/engine/queries'
import type { GameAction, GameState } from '../src/engine/types'

const GAMES = 200
const MAX_ACTIONS = 20000

const violations: string[] = []
function violate(message: string) {
  if (violations.length < 20) violations.push(message)
}

function assertInvariants(state: GameState, context: string) {
  for (const player of state.players) {
    if (player.cash < 0) violate(`${context}: ${player.name} has negative cash ${player.cash}`)
    if (player.position < 0 || player.position >= BOARD_SIZE) {
      violate(`${context}: ${player.name} is off the board at ${player.position}`)
    }
    if (!Number.isFinite(player.cash)) violate(`${context}: ${player.name} cash is not finite`)
  }

  for (const [id, holding] of Object.entries(state.holdings)) {
    if (holding.buildings < 0 || holding.buildings > state.settings.buildings.maxLevel) {
      violate(`${context}: ${id} has an impossible building level ${holding.buildings}`)
    }
    if (SPECIAL_ASSETS[id] && holding.buildings !== 0) {
      violate(`${context}: transport asset ${id} has buildings`)
    }
    if (!holding.ownerId && holding.buildings > 0) {
      violate(`${context}: unowned ${id} still has buildings`)
    }
    if (!holding.ownerId && holding.mortgaged) {
      violate(`${context}: unowned ${id} is still mortgaged`)
    }
    if (holding.ownerId && state.players.find((p) => p.id === holding.ownerId)?.isOut) {
      violate(`${context}: ${id} is owned by an eliminated player`)
    }
  }

  const active = state.players.filter((p) => !p.isOut)
  if (state.phase === 'playing' && active.length <= 1) {
    violate(`${context}: still playing with ${active.length} active player(s)`)
  }
}

/** A simple but complete policy: buy, build, and raise cash when in debt. */
function chooseAction(state: GameState, rng: () => number): GameAction | null {
  if (state.popups.length > 0) return { type: 'DISMISS_POPUP' }

  const playerId = state.turnOrder[state.currentIndex]
  const player = state.players.find((p) => p.id === playerId)!
  const owed = debtOwedBy(state, playerId)

  if (owed > 0) {
    if (player.cash >= owed) return { type: 'SETTLE_DEBT' }

    // Sell buildings first, then mortgage, exactly as a player would.
    const ids = ownedPropertyIds(state, playerId)
    const sellable = ids.find((id) => canSellBuilding(state, playerId, id).allowed)
    if (sellable) return { type: 'SELL_BUILDING', propertyId: sellable }
    const mortgageable = ids.find((id) => canMortgage(state, playerId, id).allowed)
    if (mortgageable) return { type: 'MORTGAGE', propertyId: mortgageable }
    return { type: 'DECLARE_BANKRUPT' }
  }

  switch (state.stage) {
    case 'moving':
      return { type: 'COMPLETE_MOVE' }

    case 'inJail':
      // Pay when comfortable, otherwise take this turn's escape roll. The
      // attempt runs over three turns, so this can be chosen repeatedly.
      return player.cash > 5000 && rng() < 0.35
        ? { type: 'JAIL_PAY' }
        : { type: 'JAIL_ROLL' }

    case 'awaitingPurchase': {
      const price = state.pendingPurchase!.price
      return player.cash >= price + 2000 && rng() < 0.85
        ? { type: 'BUY_PROPERTY' }
        : { type: 'DECLINE_PURCHASE' }
    }

    case 'awaitingBuild': {
      // Landed on your own country: build when it is allowed and affordable.
      const propertyId = state.pendingBuild!.propertyId
      const build = canBuild(state, playerId, propertyId)
      return build.allowed && player.cash - build.cost > 3000 && rng() < 0.8
        ? { type: 'BUILD', propertyId }
        : { type: 'DECLINE_BUILD' }
    }

    case 'awaitingRoll':
      return { type: 'ROLL_DICE' }

    case 'awaitingEndTurn': {
      // Build when affordable, keeping a cash buffer.
      if (rng() < 0.7) {
        const buildable = ownedPropertyIds(state, playerId).filter((id) => {
          if (!COUNTRIES[id]) return false
          const check = canBuild(state, playerId, id)
          return check.allowed && player.cash - check.cost > 3000
        })
        if (buildable.length) {
          return { type: 'BUILD', propertyId: buildable[Math.floor(rng() * buildable.length)] }
        }
      }
      return { type: 'END_TURN' }
    }

    default:
      return null
  }
}

/** Deterministic PRNG so a failure can be reproduced from its seed. */
function makeRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

let completed = 0
let stalled = 0
let totalTurns = 0
let maxTurns = 0

for (let game = 0; game < GAMES; game++) {
  const rng = makeRng(game * 7919 + 13)
  const originalRandom = Math.random
  Math.random = rng

  try {
    const playerCount = 2 + Math.floor(rng() * 5)
    let state = createInitialState()
    for (let i = 0; i < playerCount; i++) {
      state = gameReducer(state, {
        type: 'ADD_LOBBY_PLAYER',
        id: `p${i + 1}`,
        name: `P${i + 1}`,
        colourId: ['crimson', 'azure', 'emerald', 'amber', 'violet', 'slate'][i],
      })
    }
    state = gameReducer(state, { type: 'START_GAME' })

    let guard = 0
    while (state.phase === 'orderRoll' && guard++ < 200) {
      // Each player takes their own opening roll, as the screens now do.
      const pending = state.orderRolls.find(
        (e) => e.dice === null && state.orderContenders.includes(e.playerId),
      )
      if (pending) {
        state = gameReducer(state, { type: 'ROLL_FOR_ORDER', playerId: pending.playerId })
        continue
      }
      const next = gameReducer(state, { type: 'CONFIRM_ORDER' })
      if (next.phase === 'playing') state = next
      else break
    }

    if (state.phase !== 'playing') {
      violate(`game ${game}: never reached the playing phase`)
      continue
    }

    let actions = 0
    while (state.phase === 'playing' && actions < MAX_ACTIONS) {
      const action = chooseAction(state, rng)
      if (!action) break
      const before = state.turnNumber
      state = gameReducer(state, action)
      assertInvariants(state, `game ${game} action ${action.type}`)
      actions++
      if (state.turnNumber === before && actions > MAX_ACTIONS - 10) break
    }

    totalTurns += state.turnNumber
    maxTurns = Math.max(maxTurns, state.turnNumber)

    if (state.phase === 'gameOver') {
      completed++
      const survivors = state.players.filter((p) => !p.isOut)
      if (survivors.length !== 1) violate(`game ${game}: ended with ${survivors.length} survivors`)
      if (state.winnerId !== survivors[0]?.id) violate(`game ${game}: wrong winner recorded`)
    } else {
      stalled++
    }
  } finally {
    Math.random = originalRandom
  }
}

console.log(`\nSimulated ${GAMES} games`)
console.log(`  reached a winner : ${completed}`)
console.log(`  hit the turn cap : ${stalled}`)
console.log(`  average turns    : ${Math.round(totalTurns / GAMES)}`)
console.log(`  longest game     : ${maxTurns} turns`)

if (violations.length) {
  console.log(`\n❌ ${violations.length} invariant violation(s):\n`)
  for (const v of violations) console.log('  ' + v)
  process.exit(1)
}
console.log('\n✅ no invariant violations\n')
