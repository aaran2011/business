/**
 * Headless rules check. Verifies the engine against the printed rules without
 * touching the UI. Run with: npm run check
 */

import {
  BOARD,
  BOARD_SIZE,
  cellRectFor,
  gridPositionFor,
  JAIL_INDEX,
  PARTY_HOUSE_INDEX,
} from '../src/data/board'
import { CHANCE_CARDS } from '../src/data/chanceCards'
import { COUNTRIES } from '../src/data/properties'
import { DEFAULT_SETTINGS } from '../src/data/settings'
import { SPECIAL_ASSETS } from '../src/data/specialAssets'
import { UNO_CARDS } from '../src/data/unoCards'
import { buildOneStep, canBuild, sellBuilding } from '../src/engine/building'
import { diceTotal, rollDice } from '../src/engine/dice'
import { createInitialState, gameReducer, makeGameCode, orderRollTurn } from '../src/engine/game'
import { attemptJailEscape } from '../src/engine/jail'
import { mortgageProperty, unmortgageProperty } from '../src/engine/mortgage'
import { movePlayer } from '../src/engine/movement'
import { charge } from '../src/engine/payments'
import {
  calculatePlayerAssets,
  checkElimination,
  countCountriesOwned,
  countCountriesOwnedInColour,
  debtOwedBy,
  hasCompleteColourGroup,
  leaderboard,
} from '../src/engine/queries'
import { calculateRent } from '../src/engine/rent'
import { purchasePriceOf } from '../src/engine/queries'
import {
  handleChance,
  handleCustomDuty,
  handlePartyHouse,
  handlePropertyLanding,
  handleResort,
  handleTravellingDuty,
  handleUno,
  buyProperty,
  sendToJail,
} from '../src/engine/spaces'
import { guestMayDo, maskCashExcept, redactFor } from '../src/net/protocol'
import type { GameState } from '../src/engine/types'

let passed = 0
const failures: string[] = []

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) passed++
  else failures.push(`${label}\n    expected ${e}\n    got      ${a}`)
}

function ok(label: string, condition: boolean) {
  check(label, condition, true)
}

/** A playing state with `n` players, no randomness involved. */
function makeState(n = 4): GameState {
  let state = createInitialState()
  // Everyone takes a seat in the lobby first, exactly as the screens do.
  for (let i = 0; i < n; i++) {
    state = gameReducer(state, {
      type: 'ADD_LOBBY_PLAYER',
      id: `p${i + 1}`,
      name: `P${i + 1}`,
      colourId: ['crimson', 'azure', 'emerald', 'amber', 'violet', 'slate'][i],
    })
  }
  state = gameReducer(state, { type: 'START_GAME' })
  // Skip the roll-off deterministically.
  state.orderRolls = state.orderRolls.map((e, i) => ({
    ...e,
    dice: [1, 1] as [number, number],
    total: i === 0 ? 12 : 3,
  }))
  state = gameReducer(state, { type: 'CONFIRM_ORDER' })
  return state
}

function give(state: GameState, playerId: string, ...propertyIds: string[]) {
  for (const id of propertyIds) state.holdings[id].ownerId = playerId
}

// ===========================================================================
console.log('\n— Board —')
// ===========================================================================

check('board has 36 spaces', BOARD_SIZE, 36)
check('index 0 is START', BOARD[0].kind, 'start')
check('index 9 is Resort (corner)', BOARD[9].kind, 'resort')
check('index 18 is Party House (corner)', BOARD[18].kind, 'partyHouse')
check('index 27 is Jail (corner)', BOARD[27].kind, 'jail')
check('Jail index', JAIL_INDEX, 27)
check('Party House index', PARTY_HOUSE_INDEX, 18)
check('England at index 1', BOARD[1].propertyId, 'england')
check('Singapore is last space', BOARD[35].propertyId, 'singapore')
check('two UNO spaces', BOARD.filter((s) => s.kind === 'uno').map((s) => s.index), [4, 25])
check('two Chance spaces', BOARD.filter((s) => s.kind === 'chance').map((s) => s.index), [16, 29])
check('20 countries', Object.keys(COUNTRIES).length, 20)
check('6 special assets', Object.keys(SPECIAL_ASSETS).length, 6)

// ===========================================================================
console.log('— Printed values (spot checks on the unusual ones) —')
// ===========================================================================

check('England price is 2500 with 700 site rent', [COUNTRIES.england.price, COUNTRIES.england.rent.site], [2500, 700])
check('England house cost is 7000', COUNTRIES.england.houseCost, 7000)
check('Italy price 3500 but house cost 2000', [COUNTRIES.italy.price, COUNTRIES.italy.houseCost], [3500, 2000])
check('Switzerland house cost 6500', COUNTRIES.switzerland.houseCost, 6500)
check('India house cost 5500 on a 4500 price', [COUNTRIES.india.price, COUNTRIES.india.houseCost], [4500, 5500])
check('Hong Kong house cost 2500 on a 2000 price', COUNTRIES.hongKong.houseCost, 2500)
check('USA hotel rent 7000', COUNTRIES.usa.rent.hotel, 7000)
check('Airways price 10500 / paired rent 2500', [SPECIAL_ASSETS.airways.price, SPECIAL_ASSETS.airways.pairedRent], [10500, 2500])

// ===========================================================================
console.log('— START bonus —')
// ===========================================================================

{
  const state = makeState(2)
  const p = state.players[0]
  p.position = 34
  const before = p.cash
  movePlayer(state, p.id, 4) // 34 -> 2, crosses START without stopping on it
  check('passing straight over START pays 1500', p.cash - before, 1500)
  check('position wraps correctly', p.position, 2)
  ok(
    'the round bonus is announced',
    state.notices.some((n) => n.text.includes('completed a round')),
  )
}
{
  const state = makeState(2)
  const p = state.players[0]
  p.position = 30
  const before = p.cash
  movePlayer(state, p.id, 6) // 30 -> 0, lands ON START
  check('landing on START pays 1500', p.cash - before, 1500)
}
{
  const state = makeState(2)
  const p = state.players[0]
  p.position = 5
  const before = p.cash
  movePlayer(state, p.id, 4)
  check('no START money without crossing', p.cash - before, 0)
}

// ===========================================================================
console.log('— Rent —')
// ===========================================================================

{
  const state = makeState(2)
  const [a] = state.players
  give(state, a.id, 'egypt')
  check('single green: plain site rent', calculateRent(state, 'egypt').amount, 300)

  give(state, a.id, 'iran', 'iraq')
  ok('3 greens completes the group', hasCompleteColourGroup(state, a.id, 'green'))
  check('unimproved site rent doubles', calculateRent(state, 'egypt').amount, 600)

  state.holdings.egypt.buildings = 1
  check('1 house uses printed rent, not doubled', calculateRent(state, 'egypt').amount, 1300)
  state.holdings.egypt.buildings = 4
  check('hotel uses printed rent, not doubled', calculateRent(state, 'egypt').amount, 4900)

  state.holdings.egypt.mortgaged = true
  check('mortgaged property collects no rent', calculateRent(state, 'egypt').amount, 0)
}
{
  // The doubling example from the rules: 400 site -> 800.
  const state = makeState(2)
  const [a] = state.players
  give(state, a.id, 'australia', 'mexico', 'brazil')
  check('gold group doubles 400 to 800', calculateRent(state, 'australia').amount, 800)
  check('Mexico 900 site doubles to 1800', calculateRent(state, 'mexico').amount, 1800)
}
{
  // Three same-colour cards double EVERY unimproved card of that colour, and
  // a card that gets built on drops out of the doubling on its own.
  const state = makeState(2)
  const [a] = state.players
  give(state, a.id, 'australia', 'mexico', 'brazil')
  check('all three gold cards are doubled', [
    calculateRent(state, 'australia').amount,
    calculateRent(state, 'mexico').amount,
    calculateRent(state, 'brazil').amount,
  ], [800, 1800, 600])

  // Build one house on Mexico only.
  state.holdings.mexico.buildings = 1
  check('the built card charges its printed 1-House rent', calculateRent(state, 'mexico').amount, 1800)
  check('and is no longer doubled', calculateRent(state, 'mexico').doubled, false)
  check('the other two cards keep their doubled site rent', [
    calculateRent(state, 'australia').amount,
    calculateRent(state, 'brazil').amount,
  ], [800, 600])

  // A card built on WITHOUT a colour group is simply the printed rent.
  const solo = makeState(2)
  const [x] = solo.players
  give(solo, x.id, 'canada')
  check('lone unimproved card is not doubled', calculateRent(solo, 'canada').amount, 400)
  solo.holdings.canada.buildings = 2
  check('lone card with 2 houses uses printed rent', calculateRent(solo, 'canada').amount, 2800)
  check('never doubled on top of a building', calculateRent(solo, 'canada').doubled, false)
}
{
  // Mexico's 1-House rent (1800) happens to equal its doubled site rent, so
  // pin the rule on a card where the two differ.
  const state = makeState(2)
  const [a] = state.players
  give(state, a.id, 'egypt', 'iran', 'iraq')
  check('Egypt doubled site rent', calculateRent(state, 'egypt').amount, 600)
  state.holdings.egypt.buildings = 1
  check('Egypt with 1 house is the printed 1300, not 2x anything', calculateRent(state, 'egypt').amount, 1300)
  check('Iran still doubled', calculateRent(state, 'iran').amount, 600)
  check('Iraq still doubled', calculateRent(state, 'iraq').amount, 1000)
}
{
  const state = makeState(2)
  const [a, b] = state.players
  give(state, a.id, 'satellite')
  check('satellite alone charges 500', calculateRent(state, 'satellite').amount, 500)
  give(state, a.id, 'waterways')
  check('satellite paired charges 1000', calculateRent(state, 'satellite').amount, 1000)
  check('waterways paired charges 2200', calculateRent(state, 'waterways').amount, 2200)

  give(state, b.id, 'railways')
  check('railways alone charges 1500', calculateRent(state, 'railways').amount, 1500)
  give(state, b.id, 'roadways')
  check('railways paired charges 2500', calculateRent(state, 'railways').amount, 2500)
  check('roadways paired charges 1500', calculateRent(state, 'roadways').amount, 1500)

  give(state, a.id, 'petroleum')
  check('petroleum alone charges 500', calculateRent(state, 'petroleum').amount, 500)
  give(state, a.id, 'airways')
  check('petroleum paired charges 1000', calculateRent(state, 'petroleum').amount, 1000)
  check('airways paired charges 2500', calculateRent(state, 'airways').amount, 2500)
}

// ===========================================================================
console.log('— Building —')
// ===========================================================================

{
  // A single owned country is enough — no colour group required.
  const state = makeState(2)
  const [a] = state.players
  give(state, a.id, 'malaysia')
  a.cash = 100000
  check('one green card owned', countCountriesOwnedInColour(state, a.id, 'green'), 1)

  const before = a.cash
  ok('builds on a lone card with no colour group', buildOneStep(state, a.id, 'malaysia'))
  check('house cost deducted', before - a.cash, COUNTRIES.malaysia.houseCost)
  check('level is 1', state.holdings.malaysia.buildings, 1)

  ok('builds a second house', buildOneStep(state, a.id, 'malaysia'))
  ok('builds a third house', buildOneStep(state, a.id, 'malaysia'))
  check('level is 3 after three houses', state.holdings.malaysia.buildings, 3)
  check('houses cap at three', buildOneStep(state, a.id, 'malaysia'), false)
  check('never reaches the hotel level', state.holdings.malaysia.buildings, 3)

  check(
    'every house charged the printed House Cost, never the Hotel Cost',
    100000 - a.cash,
    COUNTRIES.malaysia.houseCost * 3,
  )
  check('3-house rent is the printed value', calculateRent(state, 'malaysia').amount, 3600)

  const beforeSell = a.cash
  ok('sells a house back', sellBuilding(state, a.id, 'malaysia'))
  check('level back to 2', state.holdings.malaysia.buildings, 2)
  check(
    'refund uses the House Cost and the configurable ratio',
    a.cash - beforeSell,
    Math.round(COUNTRIES.malaysia.houseCost * state.settings.buildings.sellRefundRatio),
  )
}
{
  // The colour-group gate is still available as a house rule.
  const state = makeState(2)
  const [a] = state.players
  state.settings.colourGroups.requiredForBuilding = true
  give(state, a.id, 'malaysia')
  a.cash = 100000
  check('gate on: one card is not enough', buildOneStep(state, a.id, 'malaysia'), false)
  give(state, a.id, 'iran', 'iraq')
  ok('gate on: three same-colour cards unlock building', buildOneStep(state, a.id, 'malaysia'))
}
{
  // Raising the cap restores the printed Hotel tier and its own cost.
  const state = makeState(2)
  const [a] = state.players
  state.settings.buildings.maxLevel = 4
  give(state, a.id, 'malaysia')
  a.cash = 100000
  buildOneStep(state, a.id, 'malaysia')
  buildOneStep(state, a.id, 'malaysia')
  buildOneStep(state, a.id, 'malaysia')
  const beforeHotel = a.cash
  ok('upgrades to hotel', buildOneStep(state, a.id, 'malaysia'))
  check('hotel cost deducted', beforeHotel - a.cash, COUNTRIES.malaysia.hotelCost)
  check('level is 4 (hotel)', state.holdings.malaysia.buildings, 4)
  check('cannot build past hotel', buildOneStep(state, a.id, 'malaysia'), false)
  check('hotel rent is the printed value', calculateRent(state, 'malaysia').amount, 4600)
}
{
  // Special assets never take buildings.
  const state = makeState(2)
  const [a] = state.players
  give(state, a.id, 'railways')
  a.cash = 100000
  check('cannot build on a transport asset', buildOneStep(state, a.id, 'railways'), false)
}

// ===========================================================================
console.log('— Mortgage —')
// ===========================================================================

{
  const state = makeState(2)
  const [a] = state.players
  give(state, a.id, 'india')
  const before = a.cash
  ok('mortgages', mortgageProperty(state, a.id, 'india'))
  check('pays the printed mortgage value', a.cash - before, COUNTRIES.india.mortgage)
  check('no rent while mortgaged', calculateRent(state, 'india').amount, 0)
  const beforeLift = a.cash
  ok('unmortgages', unmortgageProperty(state, a.id, 'india'))
  check('costs the mortgage value back (0% interest)', beforeLift - a.cash, COUNTRIES.india.mortgage)
  check('rent restored', calculateRent(state, 'india').amount, 550)
}

// ===========================================================================
console.log('— Party House / Resort —')
// ===========================================================================

{
  const state = makeState(4)
  const [a, b, c, d] = state.players
  const before = a.cash
  handlePartyHouse(state, a.id)
  check('lander collects 200 x 3 = 600', a.cash - before, 600)
  check('each other player paid 200', [b.cash, c.cash, d.cash].map((v) => 25000 - v), [200, 200, 200])
}
{
  const state = makeState(4)
  const [a, b, c, d] = state.players
  const before = a.cash
  handleResort(state, a.id)
  check('lander pays 200 x 3 = 600', before - a.cash, 600)
  check('each other player received 200', [b.cash, c.cash, d.cash].map((v) => v - 25000), [200, 200, 200])
}
{
  // Eliminated players are skipped by both.
  const state = makeState(4)
  const [a, , c] = state.players
  c.isOut = true
  const before = a.cash
  handlePartyHouse(state, a.id)
  check('out players do not pay', a.cash - before, 400)
}

// ===========================================================================
console.log('— Duties —')
// ===========================================================================

{
  const state = makeState(2)
  const [a] = state.players
  give(state, a.id, 'egypt', 'iran', 'iraq', 'railways', 'airways', 'satellite')
  check('special assets are not countries', countCountriesOwned(state, a.id), 3)

  let before = a.cash
  handleCustomDuty(state, a.id)
  check('custom duty 3 countries = 300', before - a.cash, 300)

  before = a.cash
  handleTravellingDuty(state, a.id)
  check('travelling duty 3 countries = 150', before - a.cash, 150)
}
{
  const state = makeState(2)
  const [a] = state.players
  give(state, a.id, ...Object.keys(COUNTRIES)) // all 20
  a.cash = 100000
  let before = a.cash
  handleCustomDuty(state, a.id)
  check('custom duty caps at 1000', before - a.cash, 1000)
  before = a.cash
  handleTravellingDuty(state, a.id)
  check('travelling duty caps at 500', before - a.cash, 500)
}

// ===========================================================================
console.log('— UNO —')
// ===========================================================================

check('UNO covers totals 2..12', Object.keys(UNO_CARDS).map(Number).sort((x, y) => x - y), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])

{
  const state = makeState(4)
  const [a, b] = state.players
  const before = a.cash
  handleUno(state, a.id, 2) // Anniversary — 500 from each
  check('UNO 2 collects 500 from each of 3 players', a.cash - before, 1500)
  check('each payer is charged 500', 25000 - b.cash, 500)
}
{
  const state = makeState(2)
  const [a] = state.players
  const before = a.cash
  handleUno(state, a.id, 6)
  check('UNO 6 pays 2000', a.cash - before, 2000)
}
{
  const state = makeState(4)
  const [a] = state.players
  a.position = 4 // the first UNO space
  const before = a.cash
  handleUno(state, a.id, 8)
  check('UNO 8 moves to Party House', a.position, PARTY_HOUSE_INDEX)
  check('UNO 8 collects 200 from each (no START crossed)', a.cash - before, 600)
}
{
  const state = makeState(4)
  const [a] = state.players
  a.position = 25 // the second UNO space — Party House is backwards, so START is crossed
  const before = a.cash
  handleUno(state, a.id, 8)
  check('UNO 8 from the far UNO crosses START', a.cash - before, 600 + state.settings.startBonus.amount)
}
{
  const state = makeState(2)
  const [a] = state.players
  a.position = 4
  handleUno(state, a.id, 3)
  check('UNO 3 sends the player to Jail', a.position, JAIL_INDEX)
  ok('UNO 3 marks the player jailed', a.inJail)
}
{
  const state = makeState(2)
  const [a] = state.players
  const before = a.cash
  handleUno(state, a.id, 7)
  check('UNO 7 has no effect (no Passport system)', a.cash - before, 0)
}
{
  // The Jail card in the middle of the board is drawn from `stage === 'inJail'`
  // and the player's own escape rolls, so both are pinned here.
  let state = makeState(2)
  state.players[0].inJail = true
  state.stage = 'awaitingEndTurn'
  state = gameReducer(state, { type: 'END_TURN' })
  state = gameReducer(state, { type: 'END_TURN' })
  check('a jailed player opens their turn in Jail', state.stage, 'inJail')
  check('with no escape rolls yet', state.players[0].jailRolls, [])
  check('and cannot simply roll and move', state.pendingMove, null)
}
{
  const state = makeState(2)
  const [a] = state.players
  give(state, a.id, 'egypt', 'iran', 'iraq')
  state.holdings.egypt.buildings = 3 // 3 houses
  state.holdings.iran.buildings = 4 // hotel
  state.holdings.iraq.buildings = 2 // 2 houses
  const before = a.cash
  handleUno(state, a.id, 9)
  // 5 houses x 50 + 1 hotel x 100
  check('UNO 9 general repairs = 5x50 + 1x100', before - a.cash, 350)
}

// ===========================================================================
console.log('— Chance —')
// ===========================================================================

check('Chance covers totals 2..12', Object.keys(CHANCE_CARDS).map(Number).sort((x, y) => x - y), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])

{
  const state = makeState(2)
  const [a] = state.players
  const before = a.cash
  handleChance(state, a.id, 3)
  check('Chance 3 (odd) pays out 2500', a.cash - before, 2500)
}
{
  const state = makeState(2)
  const [a] = state.players
  const before = a.cash
  handleChance(state, a.id, 8)
  check('Chance 8 (even) costs 3000', before - a.cash, 3000)
}
{
  const state = makeState(4)
  const [a] = state.players
  const before = a.cash
  handleChance(state, a.id, 7)
  check('Chance 7 collects 100 from each of 3', a.cash - before, 300)
}
{
  const state = makeState(2)
  const [a] = state.players
  a.position = 29
  handleChance(state, a.id, 10)
  check('Chance 10 sends the player to Jail', a.position, JAIL_INDEX)
}

// ===========================================================================
console.log('— Jail —')
// ===========================================================================

{
  const state = makeState(2)
  const [a] = state.players
  check('escape needs 12 or more', state.settings.jail.escapeTargetTotal, 12)
  check('an attempt is 3 rolls of one die', state.settings.jail.escapeDieRolls, 3)
  check('pay-to-escape costs 500', state.settings.jail.payToEscape, 500)

  a.inJail = true
  a.position = JAIL_INDEX
  state.stage = 'inJail'
  const before = a.cash
  const next = gameReducer(state, { type: 'JAIL_PAY' })
  const na = next.players[0]
  check('paying deducts 500', before - na.cash, 500)
  check('paying earns release, taking effect next turn', na.jailReleasePending, true)
  check('the turn is spent in Jail', next.stage, 'awaitingEndTurn')
}
{
  // The attempt is UP TO three rolls, one press at a time, in one turn.
  const state = makeState(2)
  const [a] = state.players
  a.inJail = true
  a.position = JAIL_INDEX
  state.stage = 'inJail'

  const first = attemptJailEscape(state, a.id)
  check('one press throws one die', first.rolls.length, 1)
  check('the total is that die', first.total, first.rolls[0])
  const second = attemptJailEscape(state, a.id)
  check('a second press adds a second die', second.rolls.length, 2)
  check('and the total accumulates', second.total, second.rolls.reduce((x, y) => x + y, 0))
  check('release matches the 12 target', second.released, second.total >= 12)
  // Either way the player is still shown as jailed for the rest of this turn.
  check('the player stays on the Jail space this turn', a.inJail, true)
  check('release is only pending', a.jailReleasePending, second.released)
}
{
  // Three rolls is the ceiling: a fourth press changes nothing.
  const state = makeState(2)
  const [a] = state.players
  a.inJail = true
  a.position = JAIL_INDEX
  state.stage = 'inJail'
  const realRandom = Math.random
  Math.random = () => 0 // every face a 1, so the target is never reached
  attemptJailEscape(state, a.id)
  attemptJailEscape(state, a.id)
  const third = attemptJailEscape(state, a.id)
  const fourth = attemptJailEscape(state, a.id)
  Math.random = realRandom
  check('three rolls are the most on offer', third.rolls.length, 3)
  check('the attempt is finished after three', third.finished, true)
  check('a fourth press throws nothing', fourth.rolls.length, 3)
  check('and leaves them in Jail', a.jailReleasePending, false)
}
{
  // Reaching 12 early stops the attempt — no pointless third roll.
  const state = makeState(2)
  const [a] = state.players
  a.inJail = true
  a.position = JAIL_INDEX
  state.stage = 'inJail'
  const realRandom = Math.random
  Math.random = () => 0.99 // every face a 6
  attemptJailEscape(state, a.id)
  const second = attemptJailEscape(state, a.id)
  const third = attemptJailEscape(state, a.id)
  Math.random = realRandom
  check('6 + 6 makes the target', second.total, 12)
  check('which finishes the attempt', second.finished, true)
  check('released on 12', second.released, true)
  check('and no third die is thrown', third.rolls.length, 2)
}
{
  // Success frees the player at the START of the next turn, not immediately.
  let state = makeState(2)
  const a = state.players[0]
  a.inJail = true
  a.position = JAIL_INDEX
  state.stage = 'inJail'
  // Force a winning attempt by making every face a 6: 6 + 6 reaches 12.
  const realRandom = Math.random
  Math.random = () => 0.99
  state = gameReducer(state, { type: 'JAIL_ROLL' })
  check('one roll of 6 is not enough on its own', state.stage, 'inJail')
  state = gameReducer(state, { type: 'JAIL_ROLL' })
  Math.random = realRandom

  check('a winning roll still ends the turn in Jail', state.players[0].inJail, true)
  check('release is pending', state.players[0].jailReleasePending, true)
  check('the turn is over', state.stage, 'awaitingEndTurn')

  // Play round to their next turn.
  state = gameReducer(state, { type: 'END_TURN' })
  state = gameReducer(state, { type: 'END_TURN' })
  check('they walk free on their next turn', state.players[0].inJail, false)
  check('and may roll and move', state.stage, 'awaitingRoll')
  check('the pending flag is cleared', state.players[0].jailReleasePending, false)
}
{
  // Paying also frees the player from their NEXT turn.
  let state = makeState(2)
  const a = state.players[0]
  a.inJail = true
  a.position = JAIL_INDEX
  state.stage = 'inJail'
  const before = a.cash

  state = gameReducer(state, { type: 'JAIL_PAY' })
  check('the fee is taken', before - state.players[0].cash, 500)
  check('still in Jail for the rest of this turn', state.players[0].inJail, true)
  check('release is pending', state.players[0].jailReleasePending, true)
  check('the turn is over', state.stage, 'awaitingEndTurn')

  state = gameReducer(state, { type: 'END_TURN' })
  state = gameReducer(state, { type: 'END_TURN' })
  check('free on the next turn', state.players[0].inJail, false)
  check('and may roll', state.stage, 'awaitingRoll')
}
{
  // A failed attempt leaves them jailed with the same two options next turn.
  let state = makeState(2)
  const a = state.players[0]
  a.inJail = true
  a.position = JAIL_INDEX
  state.stage = 'inJail'
  const realRandom = Math.random
  Math.random = () => 0 // every face a 1, total 3 after all three rolls
  state = gameReducer(state, { type: 'JAIL_ROLL' })
  state = gameReducer(state, { type: 'JAIL_ROLL' })
  check('the turn is still theirs until the third roll', state.stage, 'inJail')
  state = gameReducer(state, { type: 'JAIL_ROLL' })
  Math.random = realRandom

  check('still jailed', state.players[0].inJail, true)
  check('no release pending', state.players[0].jailReleasePending, false)
  check('the turn ends', state.stage, 'awaitingEndTurn')

  state = gameReducer(state, { type: 'END_TURN' })
  state = gameReducer(state, { type: 'END_TURN' })
  check('the Jail choice comes round again', state.stage, 'inJail')
  check('and they are still in Jail', state.players[0].inJail, true)
}
{
  // Going to Jail a third time works exactly the same way.
  const state = makeState(2)
  const [a] = state.players
  for (let visit = 0; visit < 3; visit++) {
    a.inJail = false
    a.jailReleasePending = false
    a.jailRolls = []
    sendToJail(state, a.id)
    check(`visit ${visit + 1}: jailed`, a.inJail, true)
    check(`visit ${visit + 1}: no carry-over rolls`, a.jailRolls, [])
    check(`visit ${visit + 1}: no carry-over release`, a.jailReleasePending, false)
  }
}

// ===========================================================================
console.log('— Debt, assets and elimination —')
// ===========================================================================

{
  // No cash but owns property: stays in the game and carries a debt.
  const state = makeState(2)
  const [a, b] = state.players
  a.cash = 0
  give(state, a.id, 'usa') // mortgage value 5000
  const result = charge(state, a.id, [{ toId: b.id, amount: 1000 }], 'rent')
  check('short player defers rather than paying', result, 'deferred')
  check('debt recorded', debtOwedBy(state, a.id), 1000)
  check('player is NOT out', a.isOut, false)
  ok('not eliminated — assets can cover it', !checkElimination(state, a.id, 1000))

  mortgageProperty(state, a.id, 'usa')
  const settled = gameReducer(state, { type: 'SETTLE_DEBT' })
  check('debt clears once funds are raised', debtOwedBy(settled, a.id), 0)
  check('creditor received the money', settled.players[1].cash, 26000)
}
{
  // Truly nothing left: eliminated.
  const state = makeState(2)
  const [a, b] = state.players
  a.cash = 100
  const result = charge(state, a.id, [{ toId: b.id, amount: 1000 }], 'rent')
  check('penniless with no assets goes bankrupt', result, 'bankrupt')
  check('player is out', a.isOut, true)
  check('creditor takes what was left', b.cash - 25000, 100)
}
{
  // Assets returning to the Bank on elimination.
  const state = makeState(2)
  const [a, b] = state.players
  a.cash = 0
  give(state, a.id, 'egypt')
  state.holdings.egypt.mortgaged = true // nothing left to raise
  charge(state, a.id, [{ toId: b.id, amount: 50000 }], 'rent')
  check('holdings return to the Bank', state.holdings.egypt.ownerId, null)
  check('mortgage cleared with the deed', state.holdings.egypt.mortgaged, false)
}
{
  const state = makeState(2)
  const [a] = state.players
  a.cash = 0
  give(state, a.id, 'usa', 'railways')
  const assets = calculatePlayerAssets(state, a.id)
  check('net worth counts property with zero cash', assets.netWorth, 8500 + 9500)
  check('countries counted separately from assets', [assets.countries, assets.specialAssets], [1, 1])
  check('liquidatable = mortgage values', assets.liquidatable, 5000 + 5000)
}

// ===========================================================================
console.log('— Turn flow —')
// ===========================================================================

{
  let state = makeState(3)
  check('first player is P1 (highest opening roll)', state.players[state.currentIndex].name, 'P1')
  check('turn number starts at 1', state.turnNumber, 1)

  state = gameReducer(state, { type: 'END_TURN' })
  check('turn passes clockwise', state.turnOrder[state.currentIndex], 'p2')
  check('turn number increments', state.turnNumber, 2)

  state.players[2].isOut = true
  state = gameReducer(state, { type: 'END_TURN' })
  check('eliminated players are skipped', state.turnOrder[state.currentIndex], 'p1')
}
{
  // Buying, then a visitor paying rent.
  let state = makeState(2)
  const a = state.players[0]
  a.position = 11 // Germany
  state.stage = 'awaitingPurchase'
  state.pendingPurchase = { propertyId: 'germany', price: COUNTRIES.germany.price }
  state = gameReducer(state, { type: 'BUY_PROPERTY' })
  check('purchase deducts the price', 25000 - state.players[0].cash, 3500)
  check('ownership assigned', state.holdings.germany.ownerId, 'p1')
  check('stage moves on after buying', state.stage, 'awaitingEndTurn')

  // Owner lands on their own property: nothing changes hands.
  const ownerCash = state.players[0].cash
  handlePropertyLanding(state, 'p1', 'germany')
  check('landing on your own property costs nothing', state.players[0].cash, ownerCash)

  // Visitor lands on it: rent transfers automatically.
  const visitorCash = state.players[1].cash
  state.players[1].position = 11
  handlePropertyLanding(state, 'p2', 'germany')
  check('visitor pays the site rent', visitorCash - state.players[1].cash, 400)
  check('owner receives the rent', state.players[0].cash - ownerCash, 400)

  // Mortgaged property collects nothing from a visitor.
  state.holdings.germany.mortgaged = true
  const v2 = state.players[1].cash
  handlePropertyLanding(state, 'p2', 'germany')
  check('no rent is collected on a mortgaged property', state.players[1].cash, v2)
}
{
  // Declining leaves the property with the Bank — never auto-auctioned.
  let state = makeState(2)
  state.stage = 'awaitingPurchase'
  state.pendingPurchase = { propertyId: 'japan', price: COUNTRIES.japan.price }
  state = gameReducer(state, { type: 'DECLINE_PURCHASE' })
  check('declined property stays unowned', state.holdings.japan.ownerId, null)
  check('no auction is started', state.pendingPurchase, null)
  check('cash untouched', state.players[0].cash, 25000)
}

// ===========================================================================
console.log('— Layout: START bottom-right, path UP -> LEFT -> DOWN -> RIGHT —')
// ===========================================================================

check('START sits bottom-right', gridPositionFor(0), { row: 10, col: 10 })
check('Resort sits top-right', gridPositionFor(9), { row: 1, col: 10 })
check('Party House sits top-left', gridPositionFor(18), { row: 1, col: 1 })
check('Jail sits bottom-left', gridPositionFor(27), { row: 10, col: 1 })

check('England (index 1) is one space UP from START', gridPositionFor(1), { row: 9, col: 10 })
check('index 8 is still climbing the right edge', gridPositionFor(8), { row: 2, col: 10 })
check('index 10 moves LEFT along the top', gridPositionFor(10), { row: 1, col: 9 })
check('index 19 starts DOWN the left edge', gridPositionFor(19), { row: 2, col: 1 })
check('index 28 moves RIGHT along the bottom', gridPositionFor(28), { row: 10, col: 2 })
check('Singapore (index 35) is just left of START', gridPositionFor(35), { row: 10, col: 9 })

{
  // Consecutive spaces must always be adjacent cells — one step, no jumps.
  let contiguous = true
  for (let i = 0; i < BOARD_SIZE; i++) {
    const a = gridPositionFor(i)
    const b = gridPositionFor((i + 1) % BOARD_SIZE)
    const step = Math.abs(a.row - b.row) + Math.abs(a.col - b.col)
    if (step !== 1) contiguous = false
  }
  ok('the path is one continuous unbroken loop', contiguous)

  // Direction of travel across each edge.
  const dir = (i: number) => {
    const a = gridPositionFor(i)
    const b = gridPositionFor((i + 1) % BOARD_SIZE)
    if (b.row < a.row) return 'up'
    if (b.row > a.row) return 'down'
    if (b.col < a.col) return 'left'
    return 'right'
  }
  check('leaving START the pawn goes UP', dir(0), 'up')
  check('the right edge is travelled UP', dir(4), 'up')
  check('the top edge is travelled LEFT', dir(13), 'left')
  check('the left edge is travelled DOWN', dir(22), 'down')
  check('the bottom edge is travelled RIGHT', dir(31), 'right')
}

{
  // Every space must map to a distinct cell on the ring.
  const seen = new Set(
    Array.from({ length: BOARD_SIZE }, (_, i) => {
      const { row, col } = gridPositionFor(i)
      return `${row}:${col}`
    }),
  )
  check('all 36 spaces occupy distinct cells', seen.size, 36)
  const onRing = [...seen].every((key) => {
    const [row, col] = key.split(':').map(Number)
    return row === 1 || row === 10 || col === 1 || col === 10
  })
  ok('every space sits on the outer ring', onRing)
}

{
  // Pawn rectangles must stay inside the board and never overlap.
  const rects = Array.from({ length: BOARD_SIZE }, (_, i) => cellRectFor(i))
  const inside = rects.every(
    (r) => r.left >= -0.001 && r.top >= -0.001 && r.left + r.width <= 100.001 && r.top + r.height <= 100.001,
  )
  ok('every cell rect stays inside the board', inside)
  ok('corners are square', Math.abs(rects[0].width - rects[0].height) < 0.001)

  // A mid-edge space is track-thick on one axis and centre-wide on the other.
  // The track being the thicker of the two is what makes the country spaces
  // bigger than a plain 10x10 grid would.
  const edgeCell = rects[3] // right edge
  const track = Math.max(edgeCell.width, edgeCell.height)
  const centre = Math.min(edgeCell.width, edgeCell.height)
  ok('the playing track is thicker than a centre column', track > centre)
  ok('the track matches the corner size', Math.abs(track - rects[0].width) < 0.001)
}

// ===========================================================================
console.log('— Single die —')
// ===========================================================================

check('default is one movement die', DEFAULT_SETTINGS.dice.count, 1)

{
  const results = new Set<number>()
  for (let i = 0; i < 4000; i++) results.add(diceTotal(rollDice(1, 6)))
  check('one die produces totals 1..6', [...results].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6])
}
{
  const results = new Set<number>()
  for (let i = 0; i < 200; i++) results.add(rollDice(2, 6).length)
  check('two dice still supported', [...results], [2])
}

{
  // The printed decks start at 2, so a total of 1 has no card and must not
  // invent one. No money may move.
  const state = makeState(3)
  const [a, b] = state.players
  const before = [a.cash, b.cash]
  handleUno(state, a.id, 1)
  handleChance(state, a.id, 1)
  check('UNO/Chance total of 1 moves no money', [a.cash, b.cash], before)
  ok('and it is still announced', state.notices.some((n) => n.text.includes('no card')))
}

// ===========================================================================
console.log('— Automatic turn end —')
// ===========================================================================

check('auto-end is on by default', DEFAULT_SETTINGS.turn.autoEnd, true)

{
  // Out of reach: no card, no decision, the turn simply carries on.
  let state = makeState(2)
  const a = state.players[0]
  a.cash = 100
  a.position = 14 // six spaces short of USA at $8,500
  state.stage = 'moving'
  state.pendingMove = { from: 14, to: 20, steps: 6, taken: 0, teleport: false }
  state.lastTotal = 6
  state = gameReducer(state, { type: 'COMPLETE_MOVE' })
  check('nothing is offered with $100 in hand', state.pendingPurchase, null)
  check('and the turn moves straight on', state.stage, 'awaitingEndTurn')
  check('the token still arrived', state.players[0].position, 20)
  check('USA stays with the Bank', state.holdings.usa.ownerId, null)
}
{
  // Landing on an unowned space offers it whenever the player can pay, and
  // never when they cannot.
  const wrong: string[] = []
  for (const space of BOARD.filter((sp) => sp.kind === 'country' || sp.kind === 'special')) {
    const price = purchasePriceOf(space.propertyId!)
    for (const cash of [0, price - 1, price, price + 1000]) {
      let st = makeState(2)
      st.players[0].cash = cash
      st.players[0].position = space.index - 1
      st.stage = 'moving'
      st.pendingMove = { from: space.index - 1, to: space.index, steps: 1, taken: 0, teleport: false }
      st.lastTotal = 1
      st = gameReducer(st, { type: 'COMPLETE_MOVE' })
      const offered = st.stage === 'awaitingPurchase'
      if (offered !== cash >= price) wrong.push(`${space.propertyId}@${cash}`)
    }
  }
  check('offered exactly when affordable, never otherwise', wrong, [])
}
{
  // Affordable: the decision is held open until the player answers.
  let state = makeState(2)
  const a = state.players[0]
  a.position = 14
  state.stage = 'moving'
  state.pendingMove = { from: 14, to: 20, steps: 6, taken: 0, teleport: false }
  state.lastTotal = 6
  state = gameReducer(state, { type: 'COMPLETE_MOVE' })
  check('affordable purchase waits for an answer', state.stage, 'awaitingPurchase')
  state = gameReducer(state, { type: 'DECLINE_PURCHASE' })
  check('answering frees the turn to end', state.stage, 'awaitingEndTurn')
}

// ===========================================================================
console.log('— Pause on next turn —')
// ===========================================================================

{
  let state = makeState(3)
  state = gameReducer(state, { type: 'REQUEST_PAUSE' })
  check('pause is armed, not immediate', [state.pauseRequested, state.paused], [true, false])

  state = gameReducer(state, { type: 'END_TURN' })
  check('pause takes effect on the next turn', state.paused, true)
  check('the request is cleared once used', state.pauseRequested, false)

  const blocked = gameReducer(state, { type: 'ROLL_DICE' })
  check('rolling is blocked while paused', blocked.dice, null)

  state = gameReducer(state, { type: 'RESUME' })
  check('resuming unpauses', state.paused, false)
}
{
  let state = makeState(2)
  state = gameReducer(state, { type: 'REQUEST_PAUSE' })
  state = gameReducer(state, { type: 'CANCEL_PAUSE' })
  check('an armed pause can be cancelled', state.pauseRequested, false)
}

// ===========================================================================
console.log('— Game timer —')
// ===========================================================================

{
  let state = makeState(3)
  state = gameReducer(state, { type: 'SET_TIMER', durationMs: 600000 })
  check('timer duration recorded', state.timer.durationMs, 600000)
  ok('a deadline is running', state.timer.endsAt !== null)

  // Give one player a clear lead on total wealth.
  state.holdings.usa.ownerId = state.players[1].id
  state.holdings.airways.ownerId = state.players[1].id

  state = gameReducer(state, { type: 'TIME_UP' })
  check('time up ends the game', state.phase, 'timeUp')
  check('winner on time is the wealthiest', state.winnerId, state.players[1].id)

  const resumed = gameReducer(state, { type: 'RESUME_WITHOUT_TIMER' })
  check('resume returns to play', resumed.phase, 'playing')
  check('resume clears the timer', resumed.timer, {
    durationMs: null,
    endsAt: null,
    remainingMs: null,
  })
  check('resume keeps the board state', resumed.holdings.usa.ownerId, state.players[1].id)

  const home = gameReducer(state, { type: 'RESET' })
  check('good game returns to the home screen', home.phase, 'setup')
}
{
  // Pausing freezes the clock instead of letting it run down.
  let state = makeState(2)
  state = gameReducer(state, { type: 'SET_TIMER', durationMs: 300000 })
  state = gameReducer(state, { type: 'REQUEST_PAUSE' })
  state = gameReducer(state, { type: 'END_TURN' })
  ok('paused clock is frozen', state.timer.endsAt === null && state.timer.remainingMs !== null)
  state = gameReducer(state, { type: 'RESUME' })
  ok('resuming restarts the clock', state.timer.endsAt !== null)
}

// ===========================================================================
console.log('— UNO / Chance polarity on a single die (totals 1-6) —')
// ===========================================================================

/** Net cash change for the lander, plus what each other player paid. */
function cardEffect(deck: 'UNO' | 'CHANCE', total: number) {
  const state = makeState(3)
  const [a, b, c] = state.players
  const before = a.cash
  if (deck === 'UNO') handleUno(state, a.id, total)
  else handleChance(state, a.id, total)
  return {
    lander: a.cash - before,
    others: [25000 - b.cash, 25000 - c.cash],
    jailed: a.inJail,
  }
}

// UNO: ODD = LOSS, EVEN = PROFIT
check('UNO 3 (odd) sends the player to jail', cardEffect('UNO', 3).jailed, true)
check('UNO 5 (odd) pays 2500 to the bank', cardEffect('UNO', 5).lander, -2500)
check('UNO 2 (even) collects 500 from each player', cardEffect('UNO', 2), {
  lander: 1000,
  others: [500, 500],
  jailed: false,
})
check('UNO 4 (even) collects 2500 from the bank', cardEffect('UNO', 4).lander, 2500)
check('UNO 6 (even) collects 2000 from the bank', cardEffect('UNO', 6).lander, 2000)

// CHANCE: ODD = PROFIT, EVEN = LOSS — the opposite of UNO
check('CHANCE 3 (odd) collects 2500 from the bank', cardEffect('CHANCE', 3).lander, 2500)
check('CHANCE 5 (odd) collects 1000 from the bank', cardEffect('CHANCE', 5).lander, 1000)
check('CHANCE 2 (even) pays 2000 to the bank', cardEffect('CHANCE', 2).lander, -2000)
check('CHANCE 4 (even) pays 1000 to the bank', cardEffect('CHANCE', 4).lander, -1000)
check('CHANCE 6 (even) pays 1500 to the bank', cardEffect('CHANCE', 6).lander, -1500)

{
  // The polarities must be genuine opposites across every reachable total.
  const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0)
  const unoEvenProfit = [2, 4, 6].every((t) => sign(cardEffect('UNO', t).lander) > 0)
  const unoOddLoss = [5].every((t) => sign(cardEffect('UNO', t).lander) < 0)
  const chanceOddProfit = [3, 5].every((t) => sign(cardEffect('CHANCE', t).lander) > 0)
  const chanceEvenLoss = [2, 4, 6].every((t) => sign(cardEffect('CHANCE', t).lander) < 0)
  ok('UNO even = profit', unoEvenProfit)
  ok('UNO odd = loss', unoOddLoss)
  ok('CHANCE odd = profit', chanceOddProfit)
  ok('CHANCE even = loss', chanceEvenLoss)
}

// ===========================================================================
console.log('— Landing on your own country offers a build —')
// ===========================================================================

{
  const state = makeState(2)
  const [a] = state.players
  give(state, a.id, 'egypt', 'iran', 'iraq') // complete green group
  a.position = 8
  handlePropertyLanding(state, a.id, 'egypt')

  check('a build offer is raised', state.pendingBuild, { propertyId: 'egypt' })
  check('the stage waits for the decision', state.stage, 'awaitingBuild')

  const check1 = canBuild(state, a.id, 'egypt')
  ok('building is allowed with the colour group', check1.allowed)
  check('the offer names the house cost', check1.cost, COUNTRIES.egypt.houseCost)
}
{
  // Landing on your own country always opens the offer, group or no group.
  const state = makeState(2)
  const [a] = state.players
  give(state, a.id, 'malaysia') // one lone green card
  a.cash = 100000
  a.position = 34
  handlePropertyLanding(state, a.id, 'malaysia')
  check('offer raised on a lone card', state.pendingBuild, { propertyId: 'malaysia' })
  ok('and the build is allowed', canBuild(state, a.id, 'malaysia').allowed)
  check(
    'the offer quotes the printed House Cost',
    canBuild(state, a.id, 'malaysia').cost,
    COUNTRIES.malaysia.houseCost,
  )
}
{
  // Taking the offer builds and ends the turn.
  let state = makeState(2)
  const a = state.players[0]
  give(state, a.id, 'egypt', 'iran', 'iraq')
  a.cash = 50000
  a.position = 8
  handlePropertyLanding(state, a.id, 'egypt')
  state = gameReducer(state, { type: 'BUILD', propertyId: 'egypt' })
  check('the house is built', state.holdings.egypt.buildings, 1)
  check('the offer is cleared', state.pendingBuild, null)
  check('the turn is free to end', state.stage, 'awaitingEndTurn')
}
{
  // Declining also ends the turn, and builds nothing.
  let state = makeState(2)
  const a = state.players[0]
  give(state, a.id, 'egypt', 'iran', 'iraq')
  a.position = 8
  handlePropertyLanding(state, a.id, 'egypt')
  state = gameReducer(state, { type: 'DECLINE_BUILD' })
  check('nothing was built', state.holdings.egypt.buildings, 0)
  check('the turn is free to end', state.stage, 'awaitingEndTurn')
}
{
  // Special assets are not countries: no build offer, no buildings.
  const state = makeState(2)
  const [a] = state.players
  give(state, a.id, 'railways')
  handlePropertyLanding(state, a.id, 'railways')
  check('no build offer on a transport asset', state.pendingBuild, null)
  ok('and it is announced instead', state.notices.length > 0)
}

// ===========================================================================
console.log('— Everything purchasable can actually be bought —')
// ===========================================================================

{
  const purchasable = BOARD.filter((sp) => sp.kind === 'country' || sp.kind === 'special')
  check('26 purchasable spaces on the board', purchasable.length, 26)

  const notOffered: string[] = []
  const notBought: string[] = []

  for (const space of purchasable) {
    let state = makeState(2)
    const a = state.players[0]
    a.cash = 100000 // enough for anything, including Airways at 10,500
    // COMPLETE_MOVE advances from the current position, so start one back.
    a.position = space.index - 1
    state.stage = 'moving'
    state.pendingMove = { from: a.position, to: space.index, steps: 1, taken: 0, teleport: false }
    state.lastTotal = 1
    state = gameReducer(state, { type: 'COMPLETE_MOVE' })

    if (state.stage !== 'awaitingPurchase') {
      notOffered.push(space.propertyId!)
      continue
    }
    state = gameReducer(state, { type: 'BUY_PROPERTY' })
    if (state.holdings[space.propertyId!].ownerId !== a.id) notBought.push(space.propertyId!)
  }

  check('every purchasable space offers itself when landed on', notOffered, [])
  check('every purchasable space can be bought', notBought, [])
}
{
  // The six transport / utility assets specifically.
  const assets = ['satellite', 'waterways', 'roadways', 'railways', 'petroleum', 'airways']
  const blocked = assets.filter((id) => {
    let state = makeState(2)
    const a = state.players[0]
    a.cash = 100000
    const target = BOARD.findIndex((sp) => sp.propertyId === id)
    a.position = target - 1
    state.stage = 'moving'
    state.pendingMove = { from: a.position, to: target, steps: 1, taken: 0, teleport: false }
    state.lastTotal = 1
    state = gameReducer(state, { type: 'COMPLETE_MOVE' })
    state = gameReducer(state, { type: 'BUY_PROPERTY' })
    return state.holdings[id].ownerId !== a.id
  })
  check('Satellite, Waterways, Airways, Roadways, Railways, Petroleum all buyable', blocked, [])
}

// ===========================================================================
console.log('— Randomness and reachability —')
// ===========================================================================

{
  // A fair die: 200k rolls should sit within 2% of an even sixth each.
  const counts = new Array(7).fill(0)
  const N = 200000
  for (let i = 0; i < N; i++) counts[rollDice(1, 6)[0]]++
  const expected = N / 6
  const worstDrift = Math.max(
    ...[1, 2, 3, 4, 5, 6].map((f) => Math.abs(counts[f] - expected) / expected),
  )
  ok(`die faces are uniform (worst drift ${(worstDrift * 100).toFixed(2)}%)`, worstDrift < 0.02)
  ok('every face appears', [1, 2, 3, 4, 5, 6].every((f) => counts[f] > 0))
}
{
  // Walking the board with real rolls must reach every space, Jail and Party
  // House included — nothing is skippable when moving one step at a time.
  const visits = new Array(BOARD_SIZE).fill(0)
  let pos = 0
  for (let i = 0; i < 300000; i++) {
    pos = (pos + rollDice(1, 6)[0]) % BOARD_SIZE
    visits[pos]++
  }
  const unreached = visits.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0)
  check('every one of the 36 spaces is landed on', unreached, [])
  ok('Jail is reached', visits[JAIL_INDEX] > 0)
  ok('Party House is reached', visits[PARTY_HOUSE_INDEX] > 0)

  // With one die every space should be hit at roughly the same rate.
  const mean = visits.reduce((a, b) => a + b, 0) / BOARD_SIZE
  const worst = Math.max(...visits.map((v) => Math.abs(v - mean) / mean))
  ok(`landings are evenly spread (worst drift ${(worst * 100).toFixed(2)}%)`, worst < 0.06)
}

// ===========================================================================
console.log('— Rolls through the real reducer are unbiased —')
// ===========================================================================

{
  // The die is tested above in isolation; this drives ROLL_DICE the way the
  // UI does, so a bias introduced by the reducer would be caught too.
  const base = makeState(2)
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  const N = 60000
  let prev = -1
  let repeats = 0
  for (let i = 0; i < N; i++) {
    const rolled = gameReducer(base, { type: 'ROLL_DICE' })
    const v = rolled.lastTotal!
    counts[v]++
    if (v === prev) repeats++
    prev = v
  }
  const expected = N / 6
  const drift = Math.max(...[1, 2, 3, 4, 5, 6].map((f) => Math.abs(counts[f] - expected) / expected))
  ok(`reducer rolls are uniform (worst drift ${(drift * 100).toFixed(2)}%)`, drift < 0.03)
  ok('every face is produced', [1, 2, 3, 4, 5, 6].every((f) => counts[f] > 0))

  // A stuck or sticky die would show up as far too many repeats.
  const repeatRate = repeats / N
  ok(
    `consecutive repeats near 1-in-6 (${(repeatRate * 100).toFixed(1)}%)`,
    repeatRate > 0.13 && repeatRate < 0.21,
  )

  // The pawn must be sent exactly as far as the die shows.
  const oneRoll = gameReducer(base, { type: 'ROLL_DICE' })
  check('the move matches the rolled number', oneRoll.pendingMove!.steps, oneRoll.lastTotal)
  check('the die shown is the die rolled', diceTotal(oneRoll.dice!), oneRoll.lastTotal)
}

// ===========================================================================
console.log('— End game, remove player, transfers, game code —')
// ===========================================================================

{
  // The host can end the game at any point; standings decide the winner.
  let state = makeState(3)
  state.players[0].cash = 1000
  state.players[1].cash = 40000
  state.players[2].cash = 500
  state = gameReducer(state, { type: 'END_GAME' })
  check('the game is over', state.phase, 'ended')
  check('the richest player wins', state.winnerId, 'p2')

  const rows = leaderboard(state)
  check('every player is ranked', rows.length, 3)
  check('cash is reported per player', rows.map((r) => r.assets.cash), [40000, 1000, 500])
  ok('total assets are reported', rows.every((r) => typeof r.assets.netWorth === 'number'))
}
{
  // Removing a player hands their board back to the Bank.
  let state = makeState(3)
  give(state, 'p2', 'egypt', 'railways')
  state.holdings.egypt.buildings = 2
  state.holdings.railways.mortgaged = true

  state = gameReducer(state, { type: 'REMOVE_PLAYER', playerId: 'p2' })
  check('the player is out', state.players[1].isOut, true)
  check('their country returns to the Bank', state.holdings.egypt.ownerId, null)
  check('buildings are cleared', state.holdings.egypt.buildings, 0)
  check('their asset returns to the Bank', state.holdings.railways.ownerId, null)
  check('the mortgage is lifted with it', state.holdings.railways.mortgaged, false)
  check('the game carries on', state.phase, 'playing')
  check('turn order skips them', state.players.filter((p) => !p.isOut).length, 2)
}
{
  // Removing the current player passes the turn on.
  let state = makeState(3)
  const current = state.turnOrder[state.currentIndex]
  state = gameReducer(state, { type: 'REMOVE_PLAYER', playerId: current })
  ok('the turn moved to someone else', state.turnOrder[state.currentIndex] !== current)
  ok('and they are still in the game', !state.players.find((p) => p.id === state.turnOrder[state.currentIndex])!.isOut)
}
{
  // Down to one player, removal ends the game.
  let state = makeState(2)
  state = gameReducer(state, { type: 'REMOVE_PLAYER', playerId: 'p2' })
  check('one player left ends it', state.phase, 'gameOver')
  check('the survivor wins', state.winnerId, 'p1')
}
{
  // Rent raises a "A -> $x -> B" card.
  const state = makeState(2)
  give(state, 'p2', 'germany')
  state.players[0].position = 11
  handlePropertyLanding(state, 'p1', 'germany')
  const last = state.notices[state.notices.length - 1]
  ok('rent raises a transfer card', !!last.transfer?.length)
  check('with one leg', last.transfer!.length, 1)
  check(
    'from the payer to the owner',
    [last.transfer![0].fromId, last.transfer![0].toId],
    ['p1', 'p2'],
  )
  check('for the site rent', last.transfer![0].amount, 400)
  ok('and it names the property', last.text.includes('Germany'))
  check('and reads as money lost', last.tone, 'bad')
}
{
  // Party House is ONE card listing every payer, not a card each.
  const state = makeState(4)
  handlePartyHouse(state, 'p1')
  const last = state.notices[state.notices.length - 1]
  check('one card', state.notices.filter((n) => n.transfer?.length).length, 1)
  check('three legs, one per payer', last.transfer!.length, 3)
  ok('all paid to the lander', last.transfer!.every((l) => l.toId === 'p1'))
  ok('each leg is $200', last.transfer!.every((l) => l.amount === 200))
  check('as money received', last.tone, 'good')
}
{
  // A transfer card is for EVERYONE, the payer included — it is the one thing
  // you want confirmed even though you did it yourself. A plain line is not.
  const state = makeState(2)
  give(state, 'p2', 'germany')
  state.players[0].position = 11
  handlePropertyLanding(state, 'p1', 'germany')
  const transfer = state.notices[state.notices.length - 1]
  ok('the payer is the one who caused it', transfer.playerId === 'p1')
  ok('and it still carries the money detail for them', !!transfer.transfer?.length)
}
{
  // Bank payments are NOT announced as player-to-player transfers.
  const state = makeState(2)
  give(state, 'p1', 'egypt', 'iran', 'iraq')
  handleCustomDuty(state, 'p1')
  ok('a duty is announced as a payment', state.notices[state.notices.length - 1].tone === 'bad')
}
{
  // Every game gets a distinct, readable code.
  const codes = new Set(Array.from({ length: 400 }, () => makeGameCode()))
  ok('codes are 6 characters', [...codes].every((c) => c.length === 6))
  ok('no easily confused characters', [...codes].every((c) => !/[IO01]/.test(c)))
  ok('codes vary', codes.size > 380)
  ok('a fresh game carries one', /^[A-Z2-9]{6}$/.test(createInitialState().gameCode))
}

// ===========================================================================
console.log('— Lobby: everyone adds themselves —')
// ===========================================================================

{
  let state = createInitialState()
  check('a fresh game has an empty lobby', state.lobby, [])

  state = gameReducer(state, { type: 'ADD_LOBBY_PLAYER', id: 'host', name: 'Aaran', colourId: 'crimson', isHost: true })
  state = gameReducer(state, { type: 'ADD_LOBBY_PLAYER', id: 'g1', name: 'Rohan', colourId: 'azure' })
  check('two seats taken', state.lobby.map((e) => e.name), ['Aaran', 'Rohan'])
  check('the host seat is flagged', state.lobby[0].isHost, true)

  // Everyone edits only their own row; ids carry through to the players.
  state = gameReducer(state, { type: 'UPDATE_LOBBY_PLAYER', id: 'g1', name: 'Priya' })
  check('a guest can rename themselves', state.lobby[1].name, 'Priya')

  state = gameReducer(state, { type: 'START_GAME' })
  check('the game starts from the lobby', state.phase, 'orderRoll')
  check('names carry through', state.players.map((p) => p.name), ['Aaran', 'Priya'])
  check('and so do the ids, so a phone keeps its seat', state.players.map((p) => p.id), ['host', 'g1'])
}
{
  // Two players may never share a colour.
  let state = createInitialState()
  state = gameReducer(state, { type: 'ADD_LOBBY_PLAYER', id: 'a', name: 'A', colourId: 'crimson' })
  state = gameReducer(state, { type: 'ADD_LOBBY_PLAYER', id: 'b', name: 'B', colourId: 'crimson' })
  ok('a clashing colour is moved to a free one', state.lobby[1].colourId !== 'crimson')

  state = gameReducer(state, { type: 'UPDATE_LOBBY_PLAYER', id: 'b', colourId: 'crimson' })
  ok('and cannot be taken by editing either', state.lobby[1].colourId !== 'crimson')

  state = gameReducer(state, { type: 'UPDATE_LOBBY_PLAYER', id: 'b', colourId: 'emerald' })
  check('a free colour is accepted', state.lobby[1].colourId, 'emerald')
}
{
  // Guards: too few, too many, duplicates, and starting early.
  let state = createInitialState()
  state = gameReducer(state, { type: 'ADD_LOBBY_PLAYER', id: 'a', name: 'A', colourId: 'crimson' })
  state = gameReducer(state, { type: 'START_GAME' })
  check('one player cannot start a game', state.phase, 'setup')

  state = gameReducer(state, { type: 'ADD_LOBBY_PLAYER', id: 'a', name: 'again', colourId: 'azure' })
  check('the same id cannot take two seats', state.lobby.length, 1)

  for (let i = 0; i < 8; i++) {
    state = gameReducer(state, { type: 'ADD_LOBBY_PLAYER', id: `x${i}`, name: `X${i}`, colourId: 'azure' })
  }
  check('the lobby stops at the maximum', state.lobby.length, DEFAULT_SETTINGS.maxPlayers)

  state = gameReducer(state, { type: 'REMOVE_LOBBY_PLAYER', id: 'x0' })
  check('a seat can be given up', state.lobby.length, DEFAULT_SETTINGS.maxPlayers - 1)
}

// ===========================================================================
console.log('— Each player rolls their own opening die —')
// ===========================================================================

{
  let state = createInitialState()
  for (const id of ['a', 'b', 'c']) {
    state = gameReducer(state, { type: 'ADD_LOBBY_PLAYER', id, name: id.toUpperCase(), colourId: 'crimson' })
  }
  state = gameReducer(state, { type: 'START_GAME' })

  // Three different faces, so no tie sends anyone back for a re-roll.
  const realRandom = Math.random
  const queue = [0.0, 0.5, 0.99] // -> 1, 4, 6
  let nth = 0
  Math.random = () => queue[Math.min(nth++, queue.length - 1)]

  // Strictly in seating order: A, then B, then C. Nobody may jump the queue.
  check('A is up first', orderRollTurn(state), 'a')
  state = gameReducer(state, { type: 'ROLL_FOR_ORDER', playerId: 'b' })
  check('B cannot jump the queue', state.orderRolls.map((e) => e.dice !== null), [false, false, false])

  state = gameReducer(state, { type: 'ROLL_FOR_ORDER', playerId: 'a' })
  check('only the named player rolled', state.orderRolls.map((e) => e.dice !== null), [true, false, false])
  check('and it is the face that was rolled', state.orderRolls[0].total, 1)

  // Rolling twice for the same player changes nothing.
  state = gameReducer(state, { type: 'ROLL_FOR_ORDER', playerId: 'a' })
  check('a player cannot roll twice', state.orderRolls[0].total, 1)

  check('B is up next', orderRollTurn(state), 'b')
  state = gameReducer(state, { type: 'ROLL_FOR_ORDER', playerId: 'b' })
  check('C is up last', orderRollTurn(state), 'c')
  state = gameReducer(state, { type: 'ROLL_FOR_ORDER', playerId: 'c' })
  Math.random = realRandom

  ok('everyone has now rolled', state.orderRolls.every((e) => e.dice !== null))
  check('each got their own face', state.orderRolls.map((e) => e.total), [1, 4, 6])
  check('and nobody is left to roll', orderRollTurn(state), null)

  // A player not in the roll-off cannot roll.
  const before = JSON.stringify(state.orderRolls)
  state = gameReducer(state, { type: 'ROLL_FOR_ORDER', playerId: 'nobody' })
  check('an unknown player cannot roll', JSON.stringify(state.orderRolls), before)
}
{
  // A tie sends only the tied players back, and the round counter moves on.
  let state = createInitialState()
  for (const id of ['a', 'b']) {
    state = gameReducer(state, { type: 'ADD_LOBBY_PLAYER', id, name: id.toUpperCase(), colourId: 'crimson' })
  }
  state = gameReducer(state, { type: 'START_GAME' })

  const realRandom = Math.random
  Math.random = () => 0.99 // both roll a 6
  state = gameReducer(state, { type: 'ROLL_FOR_ORDER', playerId: 'a' })
  state = gameReducer(state, { type: 'ROLL_FOR_ORDER', playerId: 'b' })
  Math.random = realRandom

  check('a tie clears both rolls for a re-roll', state.orderRolls.map((e) => e.dice), [null, null])
  check('and starts a fresh round', state.orderRollRound, 2)
  check('with both still in the running', state.orderContenders.sort(), ['a', 'b'])
}

// ===========================================================================
console.log('— The token walks, one space at a time —')
// ===========================================================================

{
  // A roll of 6 visits all six spaces in order. No skipping, no teleporting.
  let state = makeState(2)
  const id = state.players[0].id
  state.players[0].position = 0
  state.stage = 'moving'
  state.lastTotal = 6
  state.pendingMove = { from: 0, to: 6, steps: 6, taken: 0, teleport: false }

  const visited: number[] = []
  for (let i = 0; i < 6; i++) {
    state = gameReducer(state, { type: 'STEP_MOVE' })
    visited.push(state.players.find((p) => p.id === id)!.position)
  }
  check('every space is visited in order', visited, [1, 2, 3, 4, 5, 6])
  check('and the move is finished', state.pendingMove, null)
  ok('the walk is over', state.stage !== 'moving')
}
{
  // Each of the six possible rolls lands exactly that many spaces on.
  const wrong: string[] = []
  for (let roll = 1; roll <= 6; roll++) {
    let st = makeState(2)
    st.players[0].position = 10
    st.stage = 'moving'
    st.lastTotal = roll
    st.pendingMove = { from: 10, to: 10 + roll, steps: roll, taken: 0, teleport: false }
    for (let i = 0; i < roll; i++) st = gameReducer(st, { type: 'STEP_MOVE' })
    if (st.players[0].position !== 10 + roll) wrong.push(`${roll}->${st.players[0].position}`)
  }
  check('a roll of N moves exactly N spaces', wrong, [])
}
{
  // Stepping past the end of the walk changes nothing.
  let state = makeState(2)
  state.players[0].position = 0
  state.stage = 'moving'
  state.lastTotal = 2
  state.pendingMove = { from: 0, to: 2, steps: 2, taken: 0, teleport: false }
  state = gameReducer(state, { type: 'STEP_MOVE' })
  state = gameReducer(state, { type: 'STEP_MOVE' })
  const settled = state.players[0].position
  state = gameReducer(state, { type: 'STEP_MOVE' })
  state = gameReducer(state, { type: 'STEP_MOVE' })
  check('extra steps are ignored', state.players[0].position, settled)
}
{
  // Walking over START pays the round bonus exactly once.
  let state = makeState(2)
  const before = state.players[0].cash
  state.players[0].position = BOARD_SIZE - 2
  state.stage = 'moving'
  state.lastTotal = 4
  state.pendingMove = { from: BOARD_SIZE - 2, to: 2, steps: 4, taken: 0, teleport: false }
  for (let i = 0; i < 4; i++) state = gameReducer(state, { type: 'STEP_MOVE' })
  check(
    'the round bonus is paid once for crossing START',
    state.players[0].cash - before,
    DEFAULT_SETTINGS.startBonus.amount,
  )
  check('and the token is past it', state.players[0].position, 2)
}
{
  // A roll that is not accepted must not change the die. This is what made
  // the same number appear over and over: the roll was refused because the
  // previous move had not finished, and the old face stayed on the table.
  let state = makeState(2)
  state.stage = 'moving'
  state.dice = [4]
  state.lastTotal = 4
  state.pendingMove = { from: 0, to: 4, steps: 4, taken: 4, teleport: false }
  const before = JSON.stringify({ dice: state.dice, pos: state.players[0].position })
  const after = gameReducer(state, { type: 'ROLL_DICE' })
  check(
    'a roll while already moving changes nothing',
    JSON.stringify({ dice: after.dice, pos: after.players[0].position }),
    before,
  )
}

// ===========================================================================
console.log('— Leaving, and the final standings —')
// ===========================================================================

{
  // Walking away is the same as being removed: the rules already say where
  // the money and the deeds go. The others carry on.
  let state = makeState(3)
  const [a] = state.players
  give(state, a.id, 'egypt', 'iran')
  state = gameReducer(state, { type: 'LEAVE_GAME', playerId: a.id })

  const gone = state.players.find((p) => p.id === a.id)!
  ok('the player is out', gone.isOut)
  check('their cash is gone', gone.cash, 0)
  check('their deeds go back to the Bank', state.holdings.egypt.ownerId, null)
  check('all of them', state.holdings.iran.ownerId, null)
  check('the game carries on', state.phase, 'playing')
  ok(
    'and everyone is told',
    state.notices.some((n) => n.text === `${gone.name} left the game`),
  )
  ok('the others are untouched', state.players.filter((p) => !p.isOut).length === 2)
}
{
  // Nobody may walk anybody ELSE out of the game.
  const state = makeState(3)
  const [a, b] = state.players
  ok('may leave their own seat', guestMayDo({ type: 'LEAVE_GAME', playerId: a.id }, a.id, state))
  ok(
    'may NOT leave on behalf of another',
    !guestMayDo({ type: 'LEAVE_GAME', playerId: b.id }, a.id, state),
  )
}
{
  // While the game runs, a device is sent only its own balance. Once it is
  // over, everyone gets the same complete final standings — otherwise each
  // device would show a different leaderboard.
  const state = makeState(3)
  state.players[0].cash = 1111
  state.players[1].cash = 2222

  const during = redactFor(state, state.players[0].id)
  check('mid-game, only your own cash', during.players[1].cash, 0)
  ok('and the rest is marked hidden', during.players[1].cashHidden)

  const final = redactFor(state, null, true)
  check('at the end, every balance is real', final.players[1].cash, 2222)
  ok('and nothing is hidden', final.players.every((p) => !p.cashHidden))
  check(
    'so every device can rank them the same way',
    final.players.map((p) => p.cash),
    state.players.map((p) => p.cash),
  )
}

// ===========================================================================
console.log('— The dice are actually random —')
// ===========================================================================

{
  const faces = DEFAULT_SETTINGS.dice.faces
  const N = 60000
  const counts = new Array(faces + 1).fill(0)
  let repeats = 0
  let previous = 0
  let longestRun = 0
  let run = 0
  for (let i = 0; i < N; i++) {
    const [v] = rollDice(1, faces)
    counts[v]++
    if (v === previous) {
      repeats++
      run++
    } else run = 1
    if (run > longestRun) longestRun = run
    previous = v
  }
  const expected = N / faces
  const worstDrift = Math.max(...counts.slice(1).map((c) => Math.abs(c - expected) / expected))
  ok(`every face comes up (${counts.slice(1).join('/')})`, counts.slice(1).every((c) => c > 0))
  ok(`no face drifts more than 5% (worst ${(worstDrift * 100).toFixed(1)}%)`, worstDrift < 0.05)
  // Repeats are allowed and expected — about one roll in six. What is NOT
  // allowed is the die sticking, which would push this towards 100%.
  const repeatRate = repeats / N
  ok(`repeats stay near 1-in-6 (${(repeatRate * 100).toFixed(1)}%)`, repeatRate > 0.12 && repeatRate < 0.21)
  ok(`no absurd run of one face (longest ${longestRun})`, longestRun < 15)
}
{
  // Two players rolling alternately get independent streams, not a shared
  // pattern and not a repeat of each other.
  let same = 0
  const N = 5000
  for (let i = 0; i < N; i++) {
    const [a] = rollDice(1, 6)
    const [b] = rollDice(1, 6)
    if (a === b) same++
  }
  const rate = same / N
  ok(`two players match about 1 time in 6 (${(rate * 100).toFixed(1)}%)`, rate > 0.12 && rate < 0.21)
}

// ===========================================================================
console.log('— Colour groups, building and the doubled site rent —')
// ===========================================================================

{
  // The printed rule, checked as arithmetic rather than as a sentence:
  // three of a colour doubles SITE rent; a house on a card ends the doubling
  // for THAT card, which then charges the printed building rent.
  const state = makeState(2)
  const [a] = state.players
  // A "group" is any THREE cards of a colour, not every card of that colour.
  const allGreen = Object.keys(COUNTRIES).filter((id) => COUNTRIES[id].colour === 'green')
  check('a colour group is three cards', DEFAULT_SETTINGS.colourGroups.sizeRequired, 3)
  ok('and there are at least three greens', allGreen.length >= 3)

  const green = allGreen.slice(0, 3)
  const [first, second, third] = green
  give(state, a.id, first)
  const alone = calculateRent(state, first)
  check('one card of the colour charges plain site rent', alone.amount, COUNTRIES[first].rent.site)
  ok('and is not doubled', !alone.doubled)

  give(state, a.id, second)
  check('two is still not a group', calculateRent(state, first).amount, COUNTRIES[first].rent.site)

  give(state, a.id, third)
  const grouped = calculateRent(state, first)
  check('three doubles the site rent', grouped.amount, COUNTRIES[first].rent.site * 2)
  ok('and says so', grouped.doubled)
  check(
    'on every card of the colour',
    green.map((id) => calculateRent(state, id).amount),
    green.map((id) => COUNTRIES[id].rent.site * 2),
  )

  // A house on the first card takes THAT card out of the doubling.
  buildOneStep(state, a.id, first)
  const built = calculateRent(state, first)
  check('a built card charges the printed house rent', built.amount, COUNTRIES[first].rent.house1)
  ok('and is no longer doubled', !built.doubled)
  check(
    'while the unimproved cards keep the doubling',
    [second, third].map((id) => calculateRent(state, id).amount),
    [second, third].map((id) => COUNTRIES[id].rent.site * 2),
  )
}

// ===========================================================================
console.log('— Nobody buys what they cannot afford —')
// ===========================================================================

{
  const state = makeState(2)
  const [a] = state.players
  const id = 'egypt'
  const price = COUNTRIES[id].price
  a.cash = price - 1
  state.pendingPurchase = { propertyId: id, price }
  state.stage = 'awaitingPurchase'

  const tried = gameReducer(state, { type: 'BUY_PROPERTY' })
  check('a purchase beyond the cash on hand does not happen', tried.holdings[id].ownerId, null)
  check('and no money moves', tried.players[0].cash, price - 1)

  const afford = makeState(2)
  afford.players[0].cash = price
  afford.pendingPurchase = { propertyId: id, price }
  afford.stage = 'awaitingPurchase'
  const bought = gameReducer(afford, { type: 'BUY_PROPERTY' })
  check('exactly enough is enough', bought.holdings[id].ownerId, bought.players[0].id)
}

// ===========================================================================
console.log('— The other phones are told, without being shown the card —')
// ===========================================================================

{
  const state = makeState(2)
  const [a] = state.players
  check('nothing has happened yet', state.notices.length, 0)

  buyProperty(state, a.id, 'egypt')
  const bought = state.notices[state.notices.length - 1]
  check('a purchase is announced', bought.text, `${a.name} bought Egypt.`)
  check('and attributed to the buyer', bought.playerId, a.id)
  ok('with no price in it', !bought.text.includes('$'))

  sendToJail(state, a.id)
  const jailed = state.notices[state.notices.length - 1]
  check('going to Jail is announced', jailed.text, `${a.name} went to Jail.`)
  ok('and never as just visiting', !jailed.text.toLowerCase().includes('visiting'))
}

{
  // Landing on the Jail space puts you IN Jail — Aaran's rule, and with one
  // die the only route that comes up often enough to matter.
  ok(
    'landing on Jail is not just visiting',
    !DEFAULT_SETTINGS.jail.landingOnJailIsJustVisiting,
  )

  let state = makeState(2)
  state.players[0].position = JAIL_INDEX - 1
  state.stage = 'moving'
  state.pendingMove = { from: JAIL_INDEX - 1, to: JAIL_INDEX, steps: 1, taken: 0, teleport: false }
  state = gameReducer(state, { type: 'COMPLETE_MOVE' })

  const jailed = state.players[0]
  ok('landing on Jail jails the player', jailed.inJail)
  check('and leaves them on the Jail space', jailed.position, JAIL_INDEX)
  ok('with no release owing to them', !jailed.jailReleasePending)
  check('their movement is over', state.stage, 'awaitingEndTurn')
  ok(
    'and the other devices are told',
    state.notices.some((n) => n.text === `${jailed.name} went to Jail.`),
  )

  // The turn passes to the next player; the jailed one is not asked anything.
    state = gameReducer(state, { type: 'END_TURN' })
  check('the next player is up', state.turnOrder[state.currentIndex], state.players[1].id)
  ok('and the jailed player is still in', state.players[0].inJail)

  // On their own next turn they are offered exactly the two choices.
  state = gameReducer(state, { type: 'END_TURN' })
  check('back to the jailed player', state.turnOrder[state.currentIndex], jailed.id)
  check('who is asked to choose', state.stage, 'inJail')
  check('with a fresh set of three rolls', state.players[0].jailRolls, [])
  check('and no movement roll available', state.pendingMove, null)
}
{
  // Option 2 in full: pay $500 now, walk free at the start of the next turn.
  let state = makeState(2)
  state.players[0].inJail = true
  state.players[0].position = JAIL_INDEX
  state.stage = 'inJail'
  const before = state.players[0].cash

  state = gameReducer(state, { type: 'JAIL_PAY' })
  check('the bank takes 500', before - state.players[0].cash, 500)
  ok('still in Jail for the rest of this turn', state.players[0].inJail)
  check('and the turn is over', state.stage, 'awaitingEndTurn')

    state = gameReducer(state, { type: 'END_TURN' })
  state = gameReducer(state, { type: 'END_TURN' })
  ok('free at the start of their next turn', !state.players[0].inJail)
  check('and may roll and move as normal', state.stage, 'awaitingRoll')
}
{
  // A roll on a later turn never opens the door by itself.
  let state = makeState(2)
  state.players[0].inJail = true
  state.players[0].position = JAIL_INDEX
  state.stage = 'inJail'

  // Three rolls of 1: nowhere near 12.
  const realRandom = Math.random
  Math.random = () => 0
  state = gameReducer(state, { type: 'JAIL_ROLL' })
  state = gameReducer(state, { type: 'JAIL_ROLL' })
  state = gameReducer(state, { type: 'JAIL_ROLL' })
  Math.random = realRandom

    state = gameReducer(state, { type: 'END_TURN' })
  state = gameReducer(state, { type: 'END_TURN' })
  ok('a failed attempt leaves them in Jail', state.players[0].inJail)
  check('and they are asked to choose again', state.stage, 'inJail')
  check('with three fresh rolls', state.players[0].jailRolls, [])
}

// ===========================================================================
console.log('— What a joined phone is allowed to do —')
// ===========================================================================

{
  // Lobby phase: you own your row and nothing else.
  let lobby = createInitialState()
  lobby = gameReducer(lobby, { type: 'ADD_LOBBY_PLAYER', id: 'host', name: 'H', colourId: 'crimson', isHost: true })
  lobby = gameReducer(lobby, { type: 'ADD_LOBBY_PLAYER', id: 'g1', name: 'G', colourId: 'azure' })

  ok('may rename themselves', guestMayDo({ type: 'UPDATE_LOBBY_PLAYER', id: 'g1', name: 'x' }, 'g1', lobby))
  ok('may NOT rename anyone else', !guestMayDo({ type: 'UPDATE_LOBBY_PLAYER', id: 'host', name: 'x' }, 'g1', lobby))
  ok('may give up their own seat', guestMayDo({ type: 'REMOVE_LOBBY_PLAYER', id: 'g1' }, 'g1', lobby))
  ok('may NOT remove anyone else', !guestMayDo({ type: 'REMOVE_LOBBY_PLAYER', id: 'host' }, 'g1', lobby))
  ok('may NOT add extra seats', !guestMayDo({ type: 'ADD_LOBBY_PLAYER', id: 'x', name: 'x', colourId: 'emerald' }, 'g1', lobby))
  ok('may NOT start the game', !guestMayDo({ type: 'START_GAME' }, 'g1', lobby))
  ok('an unseated phone may do nothing', !guestMayDo({ type: 'UPDATE_LOBBY_PLAYER', id: 'g1', name: 'x' }, null, lobby))

  // Opening roll: strictly one player at a time, in seating order.
  const rolling = gameReducer(lobby, { type: 'START_GAME' })
  check('the roll-off has no turn order yet', rolling.turnOrder, [])
  check('the host rolls first', orderRollTurn(rolling), 'host')
  ok(
    'may NOT roll before the roll-off reaches them',
    !guestMayDo({ type: 'ROLL_FOR_ORDER', playerId: 'g1' }, 'g1', rolling),
  )
  ok('may NOT roll for someone else', !guestMayDo({ type: 'ROLL_FOR_ORDER', playerId: 'host' }, 'g1', rolling))
  ok('may NOT confirm the order', !guestMayDo({ type: 'CONFIRM_ORDER' }, 'g1', rolling))

  // An out-of-turn roll is refused by the engine, not merely hidden.
  const jumped = gameReducer(rolling, { type: 'ROLL_FOR_ORDER', playerId: 'g1' })
  check(
    'rolling out of turn does nothing',
    jumped.orderRolls.find((e) => e.playerId === 'g1')!.dice,
    null,
  )
  check('and does not move the roll-off on', orderRollTurn(jumped), 'host')

  const afterHost = gameReducer(rolling, { type: 'ROLL_FOR_ORDER', playerId: 'host' })
  check('once the host has rolled it is the next player', orderRollTurn(afterHost), 'g1')
  ok('who may now roll', guestMayDo({ type: 'ROLL_FOR_ORDER', playerId: 'g1' }, 'g1', afterHost))
  ok(
    'and the host may not roll again',
    !guestMayDo({ type: 'ROLL_FOR_ORDER', playerId: 'host' }, 'host', afterHost),
  )
  check('exactly one player is ever up', [orderRollTurn(rolling), orderRollTurn(afterHost)].filter(Boolean).length, 2)
}
{
  // In play: only on your own turn, and never the host controls.
  const state = makeState(2)
  const upNow = state.turnOrder[state.currentIndex]
  const other = state.turnOrder[1]

  ok('may roll on their own turn', guestMayDo({ type: 'ROLL_DICE' }, upNow, state))
  ok('may NOT roll on someone else’s turn', !guestMayDo({ type: 'ROLL_DICE' }, other, state))
  ok('may buy on their own turn', guestMayDo({ type: 'BUY_PROPERTY' }, upNow, state))
  ok('may NOT buy out of turn', !guestMayDo({ type: 'BUY_PROPERTY' }, other, state))

  ok('may NOT end the game', !guestMayDo({ type: 'END_GAME' }, upNow, state))
  ok('may NOT remove a player', !guestMayDo({ type: 'REMOVE_PLAYER', playerId: other }, upNow, state))
  ok('may NOT change the house rules', !guestMayDo({ type: 'UPDATE_SETTINGS', settings: state.settings }, upNow, state))
  ok('may NOT set the timer', !guestMayDo({ type: 'SET_TIMER', durationMs: 60000 }, upNow, state))
  ok('may NOT reset the game', !guestMayDo({ type: 'RESET' }, upNow, state))
  ok('may NOT push a whole state across', !guestMayDo({ type: 'NET_SYNC', state }, upNow, state))
}
{
  // Nothing waits for a Continue any more: a settled event is news, and it
  // reaches every device as one short line.
  const state = makeState(2)
  const [a] = state.players
  buyProperty(state, a.id, 'egypt')
  const last = state.notices[state.notices.length - 1]
  check('a purchase is one line', last.text, `${a.name} bought Egypt.`)
  ok('with no price in it', !last.text.includes('$'))
  ok('and nothing to dismiss', !('popups' in (state as unknown as Record<string, unknown>)))
}

{
  // Your own deeds only — nobody may touch another player's property.
  const state = makeState(2)
  const [a, b] = state.players
  give(state, a.id, 'egypt')
  give(state, b.id, 'japan')

  ok('may mortgage their own country', guestMayDo({ type: 'MORTGAGE', propertyId: 'egypt' }, a.id, state))
  ok('may NOT mortgage someone else’s', !guestMayDo({ type: 'MORTGAGE', propertyId: 'japan' }, a.id, state))
  ok('may unmortgage their own', guestMayDo({ type: 'UNMORTGAGE', propertyId: 'egypt' }, a.id, state))
  ok('may NOT unmortgage someone else’s', !guestMayDo({ type: 'UNMORTGAGE', propertyId: 'japan' }, a.id, state))
  ok('may build on their own', guestMayDo({ type: 'BUILD', propertyId: 'egypt' }, a.id, state))
  ok('may NOT build on someone else’s', !guestMayDo({ type: 'BUILD', propertyId: 'japan' }, a.id, state))
  ok('may sell buildings on their own', guestMayDo({ type: 'SELL_BUILDING', propertyId: 'egypt' }, a.id, state))
  ok('may NOT sell someone else’s buildings', !guestMayDo({ type: 'SELL_BUILDING', propertyId: 'japan' }, a.id, state))
  ok('may NOT touch an unowned space', !guestMayDo({ type: 'MORTGAGE', propertyId: 'iraq' }, a.id, state))
}
{
  // Redaction really removes the numbers rather than hiding them.
  const state = makeState(3)
  state.players[0].cash = 11111
  state.players[1].cash = 22222
  state.players[2].cash = 33333

  const forP2 = redactFor(state, state.players[1].id)
  check('their own cash survives', forP2.players[1].cash, 22222)
  check('and is marked visible', forP2.players[1].cashHidden, false)
  check('everyone else is zeroed', [forP2.players[0].cash, forP2.players[2].cash], [0, 0])
  check('and marked hidden', [forP2.players[0].cashHidden, forP2.players[2].cashHidden], [true, true])
  ok(
    'no other balance appears anywhere in what is sent',
    !JSON.stringify(forP2).includes('11111') && !JSON.stringify(forP2).includes('33333'),
  )
  check('the host sends its ranking too', forP2.leaderboardOrder?.length, 3)
}

// ===========================================================================
console.log('— No device shows a balance it does not play —')
// ===========================================================================

{
  const state = makeState(3)
  state.players[0].cash = 11111
  state.players[1].cash = 22222
  state.players[2].cash = 33333
  const [a, b, c] = state.players

  // The HOST device: it plays seat A locally, the other two are on phones.
  const hostView = maskCashExcept(state, (id) => id === a.id)
  check('the host sees the seat it plays', hostView.players[0].cash, 11111)
  check('but not the phones’ balances', [hostView.players[1].cash, hostView.players[2].cash], [0, 0])
  check('and they are marked hidden', [hostView.players[1].cashHidden, hostView.players[2].cashHidden], [true, true])

  // Pass-and-play: one device holds every seat, so nothing is masked.
  const soloView = maskCashExcept(state, () => true)
  check('a solo device sees everything', soloView.players.map((p) => p.cash), [11111, 22222, 33333])
  ok('and nothing is flagged hidden', soloView.players.every((p) => p.cashHidden === false))

  // A device holding two local seats sees both, and no others.
  const twoSeats = maskCashExcept(state, (id) => id === a.id || id === c.id)
  check('both of its own seats are visible', [twoSeats.players[0].cash, twoSeats.players[2].cash], [11111, 33333])
  check('the third is still hidden', twoSeats.players[1].cash, 0)

  // The real state is untouched — the rules still run on the true numbers.
  check('masking does not mutate the game', state.players.map((p) => p.cash), [11111, 22222, 33333])
  void b
}

// ===========================================================================
console.log('— The rolled number stays on the table —')
// ===========================================================================

{
  // Clearing the dice between turns made the die snap back to a blank 1,
  // which is what "the dice keep returning 1" actually was.
  let state = makeState(2)
  state = gameReducer(state, { type: 'ROLL_DICE' })
  const rolled = state.lastTotal
  const shown = state.dice
  ok('a roll produced a number', typeof rolled === 'number' && rolled >= 1 && rolled <= 6)

  state = gameReducer(state, { type: 'COMPLETE_MOVE' })
    if (state.stage === 'awaitingPurchase') state = gameReducer(state, { type: 'DECLINE_PURCHASE' })
  if (state.stage === 'awaitingBuild') state = gameReducer(state, { type: 'DECLINE_BUILD' })
  state = gameReducer(state, { type: 'END_TURN' })

  check('the number survives into the next turn', state.lastTotal, rolled)
  check('and so do the dice faces', state.dice, shown)
  ok('so nothing ever falls back to a blank 1', state.dice !== null)
}
{
  // A roll of 1 must move exactly one space.
  const state = makeState(2)
  const realRandom = Math.random
  Math.random = () => 0 // lowest face
  const rolled = gameReducer(state, { type: 'ROLL_DICE' })
  Math.random = realRandom
  check('rolling a 1 reads as 1', rolled.lastTotal, 1)
  check('and moves exactly one space', rolled.pendingMove!.steps, 1)
  const moved = gameReducer(rolled, { type: 'COMPLETE_MOVE' })
  check('landing one space along', moved.players[moved.currentIndex].position, 1)
}

// ===========================================================================

console.log('')
if (failures.length) {
  console.log(`❌ ${failures.length} failed, ${passed} passed\n`)
  for (const f of failures) console.log('  ' + f + '\n')
  process.exit(1)
} else {
  console.log(`✅ all ${passed} rule checks passed\n`)
}
