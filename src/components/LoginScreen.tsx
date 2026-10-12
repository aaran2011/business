import { useEffect, useRef, useState } from 'react'
import { AVATARS, DEFAULT_AVATAR_ID, avatarById } from '../data/avatars'
import {
  accountsPossible,
  passwordProblem,
  probeAccounts,
  saveProfile,
  signIn,
  signUp,
  usernameProblem,
  type Profile,
} from '../net/accounts'
import { captchaEnabled, loadCaptcha, RECAPTCHA_SITE_KEY } from '../net/recaptcha'
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
  const [detail, setDetail] = useState<string | null>(null)
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaBroken, setCaptchaBroken] = useState(false)

  const chosen = avatarById(avatarId)

  /*
    Ask the server, once, while they are picking a character.

    It does two jobs. If the database side is missing it says so NOW, rather
    than after they have filled the form in and waited. And it wakes a
    sleeping project up, so the real call a few seconds later is a quick one
    instead of the slow first request that made signing in feel broken.
  */
  const [serverState, setServerState] = useState<'checking' | 'ready' | 'setup' | 'unreachable'>(
    'checking',
  )
  useEffect(() => {
    let live = true
    probeAccounts().then(
      (state) => live && setServerState(state),
      () => live && setServerState('unreachable'),
    )
    return () => {
      live = false
    }
  }, [])

  /*
    WHEN a problem is shown, not whether.

    Nobody wants "at least 3 characters" thrown at them after typing one
    letter of a six-letter name. So the check runs when they STOP — a short
    pause, or leaving the box — and the moment they type again it goes quiet.
    The pause is short enough that it never feels like waiting for permission,
    and the check itself is two string tests, so there is nothing to lag.
  */
  const settled = useSettled(username, tab)
  const settledPass = useSettled(password, tab)

  const submit = async () => {
    setError(null)
    setDetail(null)
    setBusy(true)
    try {
      const result =
        tab === 'new'
          ? await signUp(username, password, avatarId, captchaToken)
          : await signIn(username, password, captchaToken)
      if (!result.ok) {
        setError(result.error)
        setDetail(result.detail ?? null)
        setSetupNeeded(Boolean(result.setupNeeded))
        // A reCAPTCHA token is good for one attempt only.
        if (captchaEnabled()) {
          setCaptchaToken('')
          window.grecaptcha?.reset()
        }
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
  const filledIn =
    tab === 'in' ? username.trim() !== '' && password !== '' : !nameProblem && !passProblem
  /*
    The tick-box gates the button, unless it could not be loaded at all —
    an ad blocker or a blocked network should not be able to shut the only
    door into the game. The database is still the thing that decides; this
    is only what the screen allows somebody to try.
  */
  const ready = filledIn && (!captchaEnabled() || captchaBroken || captchaToken !== '')

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
              placeholder="e.g. Alex"
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => settled.showNow()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && ready && !busy) void submit()
              }}
            />
            {settled.done && username !== '' && nameProblem && tab === 'new' && (
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
              onBlur={() => settledPass.showNow()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && ready && !busy) void submit()
              }}
            />
            {settledPass.done && password !== '' && passProblem && tab === 'new' && (
              <span className="login-problem">{passProblem}</span>
            )}
          </div>

          {serverState === 'unreachable' && !error && (
            <div className="login-error">
              {navigator.onLine
                ? 'The account server is not answering, and this device is online — so the server is down rather than you.'
                : 'This device is offline. Signing in needs a connection.'}
              <div className="login-setup">
                {navigator.onLine
                  ? 'Whoever runs this game needs to check that its Supabase project is still awake, at the address in src/net/gameServer.ts.'
                  : 'Everything else — the board, the rules, a game against the computer — needs no connection at all once you are in.'}
              </div>
            </div>
          )}

          {serverState === 'setup' && !error && (
            <div className="login-error">
              Accounts have not been switched on for this game yet, so nobody can sign in.
              <div className="login-setup">
                Run <code>supabase/accounts.sql</code> once in the Supabase SQL editor — it is in
                the repository, and it is one paste.
              </div>
            </div>
          )}

          {captchaEnabled() && (
            <CaptchaBox
              onToken={setCaptchaToken}
              onBroken={() => setCaptchaBroken(true)}
              resetKey={tab}
            />
          )}

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
              {detail && <div className="login-detail">Server said: {detail}</div>}
            </div>
          )}

          {!accountsPossible() && (
            <div className="login-error">
              This build has no server set, so it cannot keep accounts. See{' '}
              <code>DEPLOY.md</code>.
            </div>
          )}

          <button className="btn btn-primary login-go" disabled={!ready || busy} onClick={submit}>
            {busy
              ? serverState === 'ready'
                ? 'One moment…'
                : 'Waking the server…'
              : tab === 'new'
                ? 'Create account'
                : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * The "I'm not a robot" box.
 *
 * Rendered explicitly rather than by Google's auto-scan, so it appears
 * exactly here and nowhere else. If the script cannot be loaded — blocked
 * network, ad blocker, Google down — it says so and tells the form to stop
 * requiring a token, because a captcha that will not load must not be able to
 * lock the only door into the game. Nothing is lost by that: the database
 * checks the token independently, and refuses a signup that needs one.
 */
function CaptchaBox({
  onToken,
  onBroken,
  resetKey,
}: {
  onToken: (token: string) => void
  onBroken: () => void
  resetKey: string
}) {
  const box = useRef<HTMLDivElement | null>(null)
  const widget = useRef<number | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    loadCaptcha().then(
      (api) => {
        if (!live || !box.current || widget.current !== null) return
        widget.current = api.render(box.current, {
          sitekey: RECAPTCHA_SITE_KEY,
          callback: (token: string) => onToken(token),
          'expired-callback': () => onToken(''),
        })
      },
      () => {
        if (!live) return
        setFailed(true)
        onBroken()
      },
    )
    return () => {
      live = false
    }
    // Rendered once; the widget is reset rather than re-rendered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Switching between Create account and Sign in starts the challenge again.
  useEffect(() => {
    if (widget.current === null) return
    window.grecaptcha?.reset(widget.current)
    onToken('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  if (failed) {
    return (
      <div className="login-hint captcha-failed">
        The robot check could not be loaded, so it has been skipped here. The server still
        checks it.
      </div>
    )
  }
  return <div className="captcha-box" ref={box} />
}

/**
 * Whether the value has stopped changing — a short pause after the last
 * keystroke, or the moment the box is left.
 *
 * Returns a plain object on purpose. An earlier version returned the boolean
 * with a method hung off it, which boxes it: `new Boolean(false)` is TRUTHY,
 * so every message would have shown from the first keystroke — exactly the
 * thing this hook exists to prevent.
 */
function useSettled(value: string, resetKey: string): { done: boolean; showNow: () => void } {
  const [done, setDone] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    setDone(false)
    window.clearTimeout(timer.current)
    if (value === '') return
    // Long enough not to interrupt somebody mid-word, short enough that the
    // answer feels immediate once they stop.
    timer.current = window.setTimeout(() => setDone(true), 550)
    return () => window.clearTimeout(timer.current)
  }, [value])

  // Switching between Create account and Sign in starts the form again.
  useEffect(() => {
    setDone(false)
  }, [resetKey])

  return { done, showNow: () => setDone(true) }
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
