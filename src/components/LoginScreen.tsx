import { useState } from 'react'
import { AVATARS, DEFAULT_AVATAR_ID, avatarById } from '../data/avatars'
import {
  accountsPossible,
  passwordProblem,
  saveProfile,
  signIn,
  signUp,
  usernameProblem,
  type Profile,
} from '../net/accounts'
import { Avatar } from './AvatarArt'

/**
 * Signing in: a username, a password and a character.
 *
 * The account lives in one small table behind three database functions
 * (`supabase/accounts.sql`), so the username and the character follow the
 * player to any device. The password never leaves the database as anything but
 * a bcrypt hash and is never kept on this device.
 *
 * There is no way past it: he removed the "No account" option on 2026-10-09,
 * so everybody who plays has an account. The cost of that is worth saying out
 * loud — until `supabase/accounts.sql` has been run, NOBODY can get in, so the
 * message for that case names the file rather than just apologising.
 *
 * Signing in happens once per device and lasts until Log Out. See
 * `loadProfile`.
 */
export function LoginScreen({ onSignedIn }: { onSignedIn: (profile: Profile) => void }) {
  const [tab, setTab] = useState<'in' | 'new'>('new')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [avatarId, setAvatarId] = useState(DEFAULT_AVATAR_ID)
  const [error, setError] = useState<string | null>(null)
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [busy, setBusy] = useState(false)

  const chosen = avatarById(avatarId)

  const submit = async () => {
    setError(null)
    setBusy(true)
    try {
      const result =
        tab === 'new' ? await signUp(username, password, avatarId) : await signIn(username, password)
      if (!result.ok) {
        setError(result.error)
        setSetupNeeded(Boolean(result.setupNeeded))
        return
      }
      saveProfile(result.profile)
      onSignedIn(result.profile)
    } finally {
      setBusy(false)
    }
  }

  const nameProblem = usernameProblem(username)
  const passProblem = passwordProblem(password)
  const ready =
    tab === 'in' ? username.trim() !== '' && password !== '' : !nameProblem && !passProblem

  return (
    <div className="setup-shell">
      <div className="setup-hero">
        <h1>Business</h1>
        <p>
          {tab === 'in'
            ? 'Sign in and your character comes with you.'
            : 'Pick a character, choose a name, and you are in.'}
        </p>
      </div>

      <div className="panel">
        <div className="login-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'new'}
            className={`login-tab${tab === 'new' ? ' is-on' : ''}`}
            onClick={() => {
              setTab('new')
              setError(null)
            }}
          >
            Create account
          </button>
          <button
            role="tab"
            aria-selected={tab === 'in'}
            className={`login-tab${tab === 'in' ? ' is-on' : ''}`}
            onClick={() => {
              setTab('in')
              setError(null)
            }}
          >
            Sign in
          </button>
        </div>

        <div className="panel-body login-body">
          {/* The gallery. Not shown when signing in: the account already has
              a character, and it arrives with it. */}
          {tab === 'new' && (
            <div className="login-field">
              <label htmlFor="login-char">
                Your character
                <span className="login-hint">{chosen.name}</span>
              </label>
              <AvatarGallery id="login-char" value={avatarId} onChange={setAvatarId} />
            </div>
          )}

          <div className="login-field">
            <label htmlFor="login-user">
              Username
              <span className="login-hint">3–16 letters, numbers or _</span>
            </label>
            <input
              id="login-user"
              className="input"
              value={username}
              maxLength={16}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="aaran"
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && ready && !busy) void submit()
              }}
            />
            {username !== '' && nameProblem && tab === 'new' && (
              <span className="login-problem">{nameProblem}</span>
            )}
          </div>

          <div className="login-field">
            <label htmlFor="login-pass">
              Password
              <span className="login-hint">At least 6 characters</span>
            </label>
            <input
              id="login-pass"
              className="input"
              type="password"
              value={password}
              autoComplete={tab === 'new' ? 'new-password' : 'current-password'}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && ready && !busy) void submit()
              }}
            />
            {password !== '' && passProblem && tab === 'new' && (
              <span className="login-problem">{passProblem}</span>
            )}
          </div>

          {error && (
            <div className="login-error">
              {error}
              {setupNeeded && (
                <div className="login-setup">
                  Whoever runs this game needs to run <code>supabase/accounts.sql</code> once in
                  the Supabase SQL editor — it is in the repository, and it is one paste. Nobody
                  can sign in until that is done.
                </div>
              )}
            </div>
          )}

          {!accountsPossible() && (
            <div className="login-error">
              This build has no server set, so it cannot keep accounts. See{' '}
              <code>DEPLOY.md</code>.
            </div>
          )}

          <button className="btn btn-primary login-go" disabled={!ready || busy} onClick={submit}>
            {busy ? 'One moment…' : tab === 'new' ? 'Create account' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * The character gallery.
 *
 * Flowers, animals, cars and people, deliberately mixed rather than sorted,
 * because that is how it was asked for and because a grid of four blocks is
 * four short lists rather than one gallery.
 */
export function AvatarGallery({
  value,
  onChange,
  id,
}: {
  value: string
  onChange: (id: string) => void
  id?: string
}) {
  return (
    <div className="avatar-grid" id={id} role="radiogroup" aria-label="Character">
      {AVATARS.map((def) => (
        <button
          key={def.id}
          type="button"
          role="radio"
          aria-checked={value === def.id}
          aria-label={def.name}
          title={def.name}
          className={`avatar-pick${value === def.id ? ' is-on' : ''}`}
          onClick={() => onChange(def.id)}
        >
          <Avatar id={def.id} size={44} />
        </button>
      ))}
    </div>
  )
}
