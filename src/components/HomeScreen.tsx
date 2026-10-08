import type { GameSettings } from '../data/settings'
import { money } from '../engine/log'
import type { GameAction, GameState } from '../engine/types'
import type { Profile } from '../net/accounts'
import { Avatar } from './AvatarArt'

export type PlayMode = 'online' | 'computer' | 'local'

/**
 * The front door.
 *
 * Two questions, in the order they matter: how the game is played, and who it
 * is played with. Both were asked for on 2026-10-09 — "the classic way" and
 * "the bid game", and "options of online, computer, or pass and play".
 *
 * The game type is a setting, so it goes into the shared game state and every
 * phone that joins sees which game it is in. The play mode is about this
 * device — who answers for the seats — so it stays here.
 */
export function HomeScreen({
  state,
  dispatch,
  profile,
  multiplayerAvailable,
  onChoose,
  onJoin,
  onEditProfile,
  onSignOut,
}: {
  state: GameState
  dispatch: (action: GameAction) => void
  profile: Profile
  multiplayerAvailable: boolean
  onChoose: (mode: PlayMode) => void
  onJoin: () => void
  onEditProfile: () => void
  onSignOut: () => void
}) {
  const mode = state.settings.mode

  const setMode = (next: 'classic' | 'bid') => {
    if (next === mode) return
    const settings: GameSettings = structuredClone(state.settings)
    settings.mode = next
    dispatch({ type: 'UPDATE_SETTINGS', settings })
  }

  return (
    <div className="setup-shell">
      <div className="setup-hero">
        <h1>Business</h1>
        <p>
          {state.settings.minPlayers}–{state.settings.maxPlayers} players ·{' '}
          {money(state.settings.startingCash)} each
        </p>
      </div>

      {/* Who you are. The character is what shows up beside your name on the
          board, so it is the first thing on the screen. */}
      <div className="panel me-panel">
        <Avatar id={profile.avatarId} size={48} />
        <div className="me-text">
          <strong>{profile.username}</strong>
          <span>
            {profile.local ? 'Playing without an account — this device only' : 'Signed in'}
          </span>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={onEditProfile}>
          Change character
        </button>
        <button className="btn btn-sm btn-ghost" onClick={onSignOut}>
          {profile.local ? 'Change name' : 'Sign out'}
        </button>
      </div>

      {/* ------------------------------------------------- how you play -- */}
      <div className="panel">
        <div className="panel-head">
          <span>How you play</span>
        </div>
        <div className="panel-body mode-cards">
          <button
            className={`mode-card${mode === 'classic' ? ' is-on' : ''}`}
            aria-pressed={mode === 'classic'}
            onClick={() => setMode('classic')}
          >
            <span className="mode-card-title">Classic</span>
            <span className="mode-card-body">
              The game exactly as printed. Land on a country nobody owns and it is yours at the
              printed price, or it stays with the Bank.
            </span>
          </button>
          <button
            className={`mode-card${mode === 'bid' ? ' is-on' : ''}`}
            aria-pressed={mode === 'bid'}
            onClick={() => setMode('bid')}
          >
            <span className="mode-card-title">Bidding</span>
            <span className="mode-card-body">
              Land on a country nobody owns and the whole table gets a go. Buy or skip — either way
              the rest may bid, and the highest bid takes the card.
            </span>
          </button>
        </div>
        {mode === 'bid' && (
          <div className="panel-body mode-note">
            Bidding closes {state.settings.bidding.clockSeconds} seconds after the last bid, and
            every bid puts the clock back to the top. The minimum raise is{' '}
            {money(state.settings.bidding.minRaise)}, nobody may bid more than they hold, and the
            clock can be changed to {state.settings.bidding.clockChoices.join(' or ')} seconds in
            House Rules once you have started. No price, rent or other rule changes.
          </div>
        )}
      </div>

      {/* ---------------------------------------------- who you play with -- */}
      <div className="panel">
        <div className="panel-head">
          <span>Who you play with</span>
        </div>
        <div className="panel-body play-cards">
          <button
            className="play-card"
            disabled={!multiplayerAvailable}
            title={
              multiplayerAvailable
                ? undefined
                : 'This build has no game server, so it cannot open a game to other devices.'
            }
            onClick={() => onChoose('online')}
          >
            <span className="play-card-icon" aria-hidden="true">
              {'\u{1F310}'}
            </span>
            <span className="play-card-title">Online</span>
            <span className="play-card-body">
              Everyone on their own phone, anywhere. You get a code to share. Keep this device open
              — it runs the game.
            </span>
          </button>

          <button className="play-card" onClick={() => onChoose('computer')}>
            <span className="play-card-icon" aria-hidden="true">
              {'\u{1F916}'}
            </span>
            <span className="play-card-title">Computer</span>
            <span className="play-card-body">
              Play against the machine. It buys, builds, pays its way out of Jail and bids, on the
              same rules as you.
            </span>
          </button>

          <button className="play-card" onClick={() => onChoose('local')}>
            <span className="play-card-icon" aria-hidden="true">
              {'\u{1F501}'}
            </span>
            <span className="play-card-title">Pass and play</span>
            <span className="play-card-body">
              Everybody round one device, handing it on. No code, no connection, works with no
              internet at all.
            </span>
          </button>
        </div>

        {multiplayerAvailable && (
          <div className="panel-body setup-actions">
            <button className="btn" onClick={onJoin}>
              Put Code — join someone else's game
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
