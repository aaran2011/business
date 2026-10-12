import type { ReactNode } from 'react'
import type { GameSettings } from '../data/settings'
import { money } from '../engine/log'
import type { GameAction, GameState } from '../engine/types'
import type { Profile } from '../net/accounts'
import { Avatar } from './AvatarArt'
import { BiddingScene, ClassicScene, GlobeIcon, HomeBackdrop, RobotIcon, SwapIcon } from './HomeArt'

export type PlayMode = 'online' | 'computer' | 'local'

/**
 * The front door, after signing in.
 *
 * Two questions, in the order they matter: how the game is played, and who it
 * is played with. Both were asked for on 2026-10-09 — "the classic way" and
 * "the bid game", and "options of online, computer, or pass and play".
 *
 * The game type is a setting, so it goes into the shared game state and every
 * phone that joins sees which game it is in. The play mode is about this
 * device — who answers for the seats — so it stays here.
 *
 * Redrawn 2026-10-13 to a design he specified: a dreamy landscape, frosted
 * cards, far fewer words. The wording is his, cut to the bone; what it must
 * NOT lose is any of the information the old screen carried, and the one
 * place that bites is joining somebody else's game — see `onJoin` below.
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
  const { minPlayers, maxPlayers, startingCash, bidding } = state.settings

  const setMode = (next: 'classic' | 'bid') => {
    if (next === mode) return
    const settings: GameSettings = structuredClone(state.settings)
    settings.mode = next
    dispatch({ type: 'UPDATE_SETTINGS', settings })
  }

  return (
    <div className="home-shell">
      <HomeBackdrop />

      <div className="home-inner">
        <header className="home-hero">
          <h1>Business</h1>
          <p>
            {minPlayers}–{maxPlayers} players · {money(startingCash)} each
          </p>
        </header>

        <ProfileBar
          profile={profile}
          onEditProfile={onEditProfile}
          onSignOut={onSignOut}
        />

        <SectionLabel>How you play</SectionLabel>
        <div className="home-grid is-two">
          <ChoiceCard
            title="Classic"
            selected={mode === 'classic'}
            onClick={() => setMode('classic')}
            scene={<ClassicScene />}
          >
            Land on a country. It's yours at the printed price — or it stays with the Bank.
          </ChoiceCard>

          <ChoiceCard
            title="Bidding"
            selected={mode === 'bid'}
            onClick={() => setMode('bid')}
            scene={<BiddingScene />}
          >
            Land on a country nobody owns. Buy or skip — highest bid takes it.
          </ChoiceCard>
        </div>

        {/*
          The rules of the auction, only while it is the chosen game. Short,
          but not dropped: the clock and the minimum raise are the two numbers
          a player needs before the first auction, not during it.
        */}
        {mode === 'bid' && (
          <p className="home-note">
            {bidding.clockSeconds}s clock, reset by every bid · {money(bidding.minRaise)} minimum
            raise · nobody bids past their cash · {bidding.clockChoices.join(' or ')}s in House
            Rules · no price or rent changes
          </p>
        )}

        <SectionLabel>Who you play with</SectionLabel>
        <div className="home-grid is-three">
          <ChoiceCard
            title="Online"
            icon={<GlobeIcon />}
            onClick={() => onChoose('online')}
            disabled={!multiplayerAvailable}
            disabledReason="This build has no game server, so it cannot open a game to other devices."
            /*
              Joining lives HERE, inside the card it belongs to.

              He asked for no "Put Code" bar along the bottom, and there is
              none. But taking the bar away without putting the door anywhere
              else would mean a game can be hosted and never joined, which is
              half of online play gone. One quiet action on the card that is
              already about playing with other people costs nothing and keeps
              the screen the one place everything starts.
            */
            footer={
              multiplayerAvailable ? (
                <button
                  type="button"
                  className="card-link"
                  onClick={(e) => {
                    e.stopPropagation()
                    onJoin()
                  }}
                >
                  Have a code? Join
                </button>
              ) : undefined
            }
          >
            Play anywhere. Get a code to share. This device keeps it open.
          </ChoiceCard>

          <ChoiceCard title="Computer" icon={<RobotIcon />} onClick={() => onChoose('computer')}>
            Play against the machine. It buys, builds and bids on the same rules.
          </ChoiceCard>

          <ChoiceCard title="Pass and play" icon={<SwapIcon />} onClick={() => onChoose('local')}>
            Everyone on one device. No code, no connection. Works offline.
          </ChoiceCard>
        </div>
      </div>
    </div>
  )
}

/** The thin lettered rule above each group of cards. */
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="home-label">
      <span>{children}</span>
      <i aria-hidden="true" />
    </div>
  )
}

/** Who is signed in, and the two things they can do about it. */
function ProfileBar({
  profile,
  onEditProfile,
  onSignOut,
}: {
  profile: Profile
  onEditProfile: () => void
  onSignOut: () => void
}) {
  return (
    <div className="home-profile">
      <span className="home-profile-face">
        <Avatar id={profile.avatarId} size={44} />
      </span>
      <span className="home-profile-text">
        <strong>{profile.username}</strong>
        {/*
          A promise, not a status line: this device will not ask again until
          the button beside it is pressed. Said in two words, with the full
          sentence kept as the title for anyone who wonders.
        */}
        <span className="home-signed" title="Stays signed in until you log out">
          <i aria-hidden="true" /> Signed in
        </span>
      </span>
      <button className="home-pill" onClick={onEditProfile}>
        <PencilGlyph /> Change character
      </button>
      <button className="home-pill" onClick={onSignOut}>
        <ExitGlyph /> Log out
      </button>
    </div>
  )
}

/**
 * One frosted card.
 *
 * Does both jobs on this screen: the wide "how you play" card with a scene
 * across the top, and the narrow "who you play with" card with a drawn icon.
 * `selected` is for the first kind, where the choice persists and has to be
 * visible; the second kind acts at once, so its ring is an affordance saying
 * "pick one" rather than a record of anything.
 */
function ChoiceCard({
  title,
  children,
  onClick,
  selected = false,
  scene,
  icon,
  footer,
  disabled = false,
  disabledReason,
}: {
  title: string
  children: ReactNode
  onClick: () => void
  selected?: boolean
  scene?: ReactNode
  icon?: ReactNode
  footer?: ReactNode
  disabled?: boolean
  disabledReason?: string
}) {
  return (
    <div
      className={`home-card${selected ? ' is-on' : ''}${scene ? ' has-scene' : ''}${
        disabled ? ' is-off' : ''
      }`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={selected}
      aria-disabled={disabled}
      title={disabled ? disabledReason : undefined}
      onClick={() => !disabled && onClick()}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <span className={`home-tick${selected ? ' is-on' : ''}`} aria-hidden="true">
        {selected && (
          <svg viewBox="0 0 24 24">
            <path
              d="M6 12.5 10.2 16.7 18 8.9"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>

      {scene && <span className="home-card-scene">{scene}</span>}
      {icon && <span className="home-card-icon">{icon}</span>}

      <span className="home-card-text">
        <strong>{title}</strong>
        <span>{children}</span>
      </span>

      {footer && <span className="home-card-foot">{footer}</span>}
    </div>
  )
}

function PencilGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="pill-glyph">
      <path
        d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path d="M14.5 5.5 18.5 9.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

function ExitGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="pill-glyph">
      <path
        d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M13 12h8m0 0-3.2-3.2M21 12l-3.2 3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
