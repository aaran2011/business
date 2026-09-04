# Business

A browser-based digital board game for 2–6 players, pass-and-play on one
screen, built from a printed International Business set.

The printed rules are implemented exactly as supplied. There is **no Monopoly
rule**, **no Credit Card system** and **no Passport system** anywhere in the
codebase.

```bash
npm install
npm run dev        # http://localhost:4600
npm test           # typecheck + 348 rule assertions
npm run simulate   # plays 200 full random games, checks invariants
npm run build      # production build into dist/
```

---

## How a turn works

There is **no End Turn button**. A turn ends by itself:

1. The player **taps the die itself** — there is no Roll Dice button.
2. One die rolls and the pawn walks to its new space.
3. If the space needs a decision — "buy this?", "build a house here?" — it is
   shown, with the price. An unowned space is always offered, even when the
   player cannot afford it; Buy is simply disabled with the shortfall named.
4. As soon as the player answers (Buy, Don't buy, Build, Not now, or dismissing
   an event card), the turn ends and play passes on.
5. A player in Jail is asked instead whether to pay $500 or take an escape
   roll, and answering ends the turn the same way.

Opening **Build / Sell / Mortgage** holds the turn open until it is closed, so
building is still possible. A player who owes money keeps the turn until the
debt is settled.

### Pause and the game timer

- **Pause on Next Turn** sits on the right of the Leaderboard header. It stops
  play at the start of the next turn, and freezes the game clock with it.
- **Timer** sets an optional game duration. When it reaches zero the game stops
  and the results screen shows every player's total value and the winner —
  which on a timed finish is whoever holds the most total wealth. From there,
  **Resume Game** carries on from exactly where you stopped with the clock
  switched off, and **Good Game** returns to the home screen.

---

## Where the rules live

All game values are data. Nothing is hard-coded in the UI.

| File | Contents |
|---|---|
| `src/data/settings.ts` | Every tunable rule value — starting cash, START bonus, duty rates and caps, jail costs, group size, multipliers |
| `src/data/properties.ts` | The 20 country cards: price, all five rents, house cost, hotel cost, mortgage value |
| `src/data/specialAssets.ts` | The 6 transport / utility assets and their paired-ownership rents |
| `src/data/board.ts` | The 36 spaces in printed clockwise order, plus the board geometry |
| `src/data/unoCards.ts` | UNO cards keyed by dice total (even = profit) |
| `src/data/chanceCards.ts` | Chance cards keyed by dice total (odd = profit) |
| `src/data/playerColours.ts` | Token colours |

To change a price or a rent, edit the data file. Nothing else needs touching.

### Engine modules

`src/engine/` holds the rules, split exactly as specified:

`dice` · `movement` · `rent` · `building` · `mortgage` · `payments` ·
`spaces` (UNO, Chance, Party House, Resort, duties, property landing) ·
`jail` · `queries` (assets, colour groups, elimination) · `game` (the reducer)

The named helpers all exist: `calculateRent`, `movePlayer`,
`handlePropertyLanding`, `handleUno`, `handleChance`, `handleJail`
(`attemptJailEscape` / `payToEscapeJail`), `handlePartyHouse`, `handleResort`,
`handleCustomDuty`, `handleTravellingDuty`, `mortgageProperty`,
`unmortgageProperty`, `buildHouse`, `buildHotel`, `sellBuilding`,
`transferMoney`, `calculatePlayerAssets`, `checkElimination`.

---

## Board layout

The 36 printed spaces fall naturally onto a 10×10 ring, which puts all four
corner spaces exactly on the corners. START sits at the **bottom-right** and
the path runs **UP → LEFT → DOWN → RIGHT**, repeating:

```
 Party House (18) ....... top edge, travelling LEFT ....... Resort (9)
      |                                                         ^
  left edge                                              right edge
  going DOWN                                              going UP
      v                                                         |
    Jail (27) .......... bottom edge, travelling RIGHT ..... START (0)
```

| Index | Space | Corner |
|---|---|---|
| 0 | START | bottom-right |
| 9 | Resort | top-right |
| 18 | Party House | top-left |
| 27 | Jail | bottom-left |

The playing track is thicker than a centre column (`TRACK_RATIO` in
`src/data/board.ts`), so the country spaces are larger than a plain 10×10 grid
would make them while the board itself stays compact. Everything inside the
board — labels, prices, dice, pawns — is sized in `cqi`, a share of the
board's own width, so it scales from an iPhone 12 Mini to a laptop with no
breakpoints. The middle of the board holds an animated globe with the six
transport and utility assets orbiting it.

---

## Host controls

- **End Game** sits in the action bar throughout. It stops the game there and
  then and works out the winner, each player's remaining cash and each
  player's total assets.
- **Remove Player** drops someone out of a game in progress. Their holdings go
  back to the Bank free of houses and mortgages, and play carries on.
- **Pause on Next Turn** and the **Timer** work as before.
- A **game code** is generated for every session and shown on the start screen
  under *Get the code*.

### Playing from more than one phone

- The host presses **Get the code** and leaves that phone open — it runs the
  game.
- Everyone else opens the same link, presses **Put Code — join a game**, types
  the code, then **puts in their own name and picks their own colour**. They
  appear in the lobby on every screen as they do it.
- The lobby is shared state, so each device may edit only its own row —
  everyone else's is shown greyed with "on their phone".
- **Each player takes their own opening roll**, on their own device: the Roll
  button only appears on your row. The host does not roll for anybody who has
  joined from a phone.
- From then on each phone shows the live board, and you roll on your own turn.

**Every player's cash is private to their own phone.** A joined phone is sent
the game with the other balances *removed* — they arrive as `•••••`, not hidden
by CSS. The host device is the banker and necessarily sees the whole board.

How it works, and the limits:

- Devices talk to each other directly over WebRTC (`peerjs`), brokered by
  PeerJS's free public signalling server. There is no backend, no account and
  nothing to pay for — it still deploys as a static site.
- **The host phone must stay open.** It is the only place the rules run; close
  it and the game goes with it.
- The rule engine has no idea the network exists. Guests send actions, the host
  applies them, and the result is broadcast — so two devices can never disagree
  about who owns Iraq.
- The host only accepts an action from the phone whose seat it is, and only on
  that seat's turn.

---

## Rules implemented

- **Setup** — 2–6 players, $25,000 each, all on START. Everyone rolls once;
  highest total starts and play continues clockwise. Ties are re-rolled
  between the tied players only.
- **START** — $1,500 for passing *or* landing on START.
- **Buying** — **every** unowned space is offered to the player who lands on
  it, with its price on screen, whether or not they can afford it. If the cash
  is short, Buy is disabled and says how much is missing rather than the turn
  silently moving on. Declining leaves the space with the Bank; there is no
  auction.
- **Rent** — automatic. No rent on your own property. Holding **3 cards of one
  colour doubles the Site Only rent on every unimproved card of that colour**.
  The moment a house goes up on one of them, that card leaves the doubling
  behind and charges its printed building rent — the other cards in the group
  keep their doubled site rent. A built card is never doubled on top.
- **Building** — SITE → 1 HOUSE → 2 HOUSES → 3 HOUSES, each step charging the
  card's own printed House Cost. **No colour group is needed to build**:
  landing on a country you already own is enough. A country takes a maximum of
  three houses, and each one appears on the board in the owner's own colour.
  The build offer shows the house cost, the rent the space earns now and the
  rent it would earn afterwards.
  The printed **Hotel** tier is switched off by default; House Rules →
  *Houses per country* → "3 houses, then a Hotel" restores it, and only that
  step ever uses Cost of Hotel.
- **Special assets** — Satellite/Waterways, Roadways/Railways and
  Petroleum/Airways each raise the other's rent when one player owns the pair.
  They never take buildings and are never counted by either duty.
- **Money between players** — any payment from one player to another raises a
  card showing it plainly: `Player A → $500 → Player B`, with both tokens and
  the amount. Payments to and from the Bank keep their own event cards.
- **Party House** — the lander collects $200 from every other active player.
- **Resort** — the lander pays $200 to every other active player.
- **Custom Duty** — $100 × countries owned, capped at $1,000.
- **Travelling Duty** — $50 × countries owned, capped at $500.
- **UNO / Chance** — resolved from the **same dice total that moved the player
  onto the space**. No second roll. UNO: even = profit, odd = loss. Chance:
  odd = profit, even = loss. UNO 7 displays “No Effect” (the Passport rule is
  not used online).
- **Jail** — a jailed player has exactly two options on their turn:
  **roll the dice** (one die, three rolls; 12 or more earns release) or
  **pay $500**. Either way the release lands on their **next** turn: this turn
  is spent in Jail, and they roll and move normally from the following one. A
  failed attempt simply ends the turn and the same two options come round
  again — and it works the same way however many times they are sent to Jail.
- **Mortgaging** — pays the printed Bank Mortgage Value, blocks rent, shows a
  MORTGAGED badge on the card and the board. Lifting it costs the mortgage
  value back (interest rate is a setting, default 0%).
- **Elimination** — $0 cash does **not** eliminate anyone. A player who cannot
  pay carries a debt and must mortgage or sell to clear it. Elimination only
  happens when there is no cash, no property to mortgage and no building to
  sell.
- **Leaderboard** — live ranking by total wealth (cash + property + buildings),
  so an asset-rich, cash-poor player still ranks high.

---

## Rules that were NOT in the printed set

These four were genuinely missing from the supplied rules, so they were **not
invented**. They are settings, editable in `src/data/settings.ts` and from the
in-game **House Rules** button.

| Setting | Default | Why it is open |
|---|---|---|
| `buildings.sellRefundRatio` | `0.5` | The rules allow selling buildings but give no sell price. Refund = printed build cost × this ratio. |
| `elimination.assetsGoTo` | `'bank'` | The rules do not say whether a bankrupt player's deeds return to the Bank or pass to the creditor. |
| `startBonus.awardOnForcedMoveToJail` | `false` | The rules only mention crossing START on the UNO "Go to Party House" card. Chance 10 from the second Chance space would otherwise cross START on the way to Jail. |
| `jail.landingOnJailIsJustVisiting` | `true` | The rules only send players to Jail via UNO 3 and Chance 10, so landing there by dice is treated as visiting. |
| `unoChanceMissingCardIsNoEffect` | `true` | See the note on one die below. |

### One die vs. the printed card decks

The game now rolls **one** die (`dice.count`), so a move is 1–6.

The printed UNO and Chance decks are keyed by the **dice total** and only
define cards for **2 to 12**, because the printed game used two dice. With one
die that means:

- Cards for totals **7–12 can never be drawn** — Anniversary, Beauty Contest,
  Income Tax Refund, Go to Party House, Interest on Shares, Sale of Stocks,
  General Repairs, Insurance Premium, Jackpot, Best Performance in Export,
  Loss Due to Fire, Go to Jail (Chance 10) and Repair of Car.
- A total of **1 has no printed card at all**. No card was invented for it —
  the space shows "No Card" and has no effect.

Both decks are left fully intact in the data files. Setting `dice.count` back
to `2`, in `src/data/settings.ts` or from the in-game House Rules panel,
restores the complete printed decks immediately.

`mortgage.unmortgageInterestRate` is also exposed (default `0`, i.e. exactly as
printed) so a fee can be added later without touching the mortgage code.

---

## Deploying free on Vercel

The app is a static Vite build, so Vercel's free Hobby tier hosts it at no cost.

**1 — Put this folder in its own GitHub repo.** From inside
`international-business/`:

```bash
git init
git add .
git commit -m "International Business board game"
git branch -M main
```

Create an empty repo on GitHub (no README), then:

```bash
git remote add origin https://github.com/<your-username>/international-business.git
git push -u origin main
```

**2 — Import it on Vercel.** Go to [vercel.com/new](https://vercel.com/new),
sign in with GitHub, pick the repo, and press Deploy. Vercel detects Vite on
its own — the defaults are already right:

- Framework preset: **Vite**
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

You get a live URL like `https://international-business.vercel.app`, and every
later `git push` redeploys automatically.

### If you keep it inside an existing repo instead

Push the whole parent repo, then in Vercel set **Settings → General → Root
Directory** to `international-business`. Everything else stays the same.
