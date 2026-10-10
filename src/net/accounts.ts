/**
 * ============================================================================
 * ACCOUNTS — a username, a password and a character.
 * ============================================================================
 *
 * The rest of the game needs no database at all: multiplayer is Realtime
 * Broadcast, which relays messages between the phones in one game and stores
 * nothing. An account with a password is the one thing that cannot work that
 * way, because a password has to be checked somewhere that is not the player's
 * own browser.
 *
 * So there is exactly one table, reachable only through three database
 * functions — `supabase/accounts.sql` in this repository, which has to be run
 * once in the Supabase SQL editor. The table itself has row-level security on
 * and no policies, so the publishable key that ships in the bundle cannot read
 * or write a single row of it; the functions run as the owner and hand back
 * only a username and a character. Passwords are bcrypt hashes and never leave
 * the database.
 *
 * NOTHING HERE MAY BLOCK THE GAME. If the SQL has not been run, or the device
 * is offline, signing in says so plainly and the player can carry on without
 * an account — the board, the rules and pass-and-play do not need one. That is
 * why every call returns a reason rather than throwing.
 */

import { DEFAULT_AVATAR_ID } from '../data/avatars'
import { multiplayerConfigured, supabase } from './supabase'

export interface Profile {
  username: string
  avatarId: string
}

export type AuthResult =
  | { ok: true; profile: Profile }
  | {
      ok: false
      error: string
      /** The database side has not been set up yet, which is worth saying. */
      setupNeeded?: boolean
      /**
       * The server's own words, shown small under the message. A player does
       * not need it; anybody working out why it failed needs nothing else.
       */
      detail?: string
    }

const STORE_KEY = 'business.profile'

/**
 * The signed-in player on this device, if there is one.
 *
 * SIGNING IN LASTS UNTIL THEY LOG OUT. His words, 2026-10-09: "it should not
 * log out by itself... always keep them signed in until and unless the user
 * clicks Log Out." So there is no expiry here, nothing to refresh and no
 * re-check against the server — a signed-in player gets straight to the board
 * even with no connection at all, and only `clearProfile` ever ends it.
 */
export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Profile> & { local?: boolean }
    if (!parsed.username) return null
    /*
      Profiles saved while "No account" existed were device-only. That option
      is gone, so one of those is not a signed-in player: they are asked to
      create an account or sign in once, and remembered from then on.
    */
    if (parsed.local) return null
    return {
      username: String(parsed.username),
      avatarId: String(parsed.avatarId ?? DEFAULT_AVATAR_ID),
    }
  } catch {
    // Storage blocked, or something else wrote nonsense to the key. Treat it
    // as nobody signed in rather than refusing to start.
    return null
  }
}

export function saveProfile(profile: Profile): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(profile))
  } catch {
    /*
      Storage is blocked — private browsing, or site data switched off. They
      stay signed in for this session, but a reload will ask again, and there
      is nothing this code can do about that from inside the page.
    */
  }
}

export function clearProfile(): void {
  try {
    localStorage.removeItem(STORE_KEY)
  } catch {
    // Nothing to do: there is no copy anywhere else.
  }
}

/**
 * Whether the DEVICE is off the network.
 *
 * Only ever used to word a failure. It is a hint, not proof — a laptop on a
 * wifi network with no route out still reports itself online — so nothing is
 * decided by it.
 */
function deviceOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/** Whether accounts can be reached at all from this build. */
export function accountsPossible(): boolean {
  return multiplayerConfigured
}

/**
 * The checks the database makes, repeated here so the form can say what is
 * wrong without a round trip. The database is still the authority — see
 * `business_name_problem` in the SQL.
 */
export function usernameProblem(username: string): string | null {
  const key = username.trim().toLowerCase()
  if (key.length < 3) return 'Pick a username of at least 3 characters.'
  if (key.length > 16) return 'Usernames can be at most 16 characters.'
  if (!/^[a-z0-9_]+$/.test(key)) return 'Letters, numbers and underscores only.'
  return null
}

export function passwordProblem(password: string): string | null {
  if (password.length < 6) return 'Pick a password of at least 6 characters.'
  return null
}

/**
 * How long to wait before giving up on one attempt.
 *
 * Twenty seconds, not seven. A Supabase project that has been idle takes its
 * time over the first request, and the old seven-second limit was cutting that
 * off and then blaming the player's connection for it — "it is taking too long
 * and then it says could not reach the account server" was exactly this.
 */
const ACCOUNT_TIMEOUT_MS = 20000

/** A second go, because a cold server almost always answers the next one. */
const RETRY_DELAY_MS = 400

interface RpcAnswer {
  ok?: boolean
  error?: string
  username?: string
  avatar?: string
}

/** What went wrong, told apart so the message can be worth reading. */
type Trouble =
  | { kind: 'timeout' }
  | { kind: 'unreachable'; detail?: string }
  | { kind: 'missing' }
  | { kind: 'refused'; detail: string }
  | { kind: 'server'; detail: string }

function describe(trouble: Trouble): AuthResult {
  switch (trouble.kind) {
    case 'missing':
      return {
        ok: false,
        error: 'Accounts have not been switched on for this game yet.',
        setupNeeded: true,
      }
    case 'timeout':
      return {
        ok: false,
        error:
          'The account server did not answer. If it has been asleep it may need another go — try once more.',
        detail: 'timed out twice',
      }
    case 'refused':
      return {
        ok: false,
        error: 'The account server refused this game’s key.',
        setupNeeded: true,
        detail: trouble.detail,
      }
    case 'server':
      return { ok: false, error: 'The account server had a problem.', detail: trouble.detail }
    default:
      /*
        Whose problem is it? Worth getting right. Telling somebody to "check
        the connection" when their connection is fine and the SERVER has gone
        sends them looking in the wrong place — which is exactly what happened
        on 2026-10-10, when the game's Supabase project had stopped existing
        and the app blamed the player's wifi for it.
      */
      return {
        ok: false,
        error: deviceOffline()
          ? 'This device is offline. Signing in needs a connection.'
          : 'The account server did not answer, and this device is online — so the server itself is down, paused or has moved.',
        detail: trouble.detail,
      }
  }
}

/** One attempt. Returns the answer, or what went wrong with it. */
async function attempt(
  fn: string,
  args: Record<string, string>,
): Promise<{ answer: RpcAnswer } | { trouble: Trouble }> {
  const abort = new AbortController()
  const giveUp = window.setTimeout(() => abort.abort(), ACCOUNT_TIMEOUT_MS)

  try {
    const { data, error } = await supabase().rpc(fn, args).abortSignal(abort.signal)

    if (error) {
      const text = `${error.code ?? ''} ${error.message} ${error.details ?? ''} ${
        error.hint ?? ''
      }`.toLowerCase()
      const detail = (error.code ? `${error.code}: ${error.message}` : error.message).slice(0, 160)

      // The SQL has not been run, or PostgREST has not noticed it yet.
      if (
        error.code === '42883' ||
        error.code === 'PGRST202' ||
        text.includes('could not find the function') ||
        text.includes('schema cache') ||
        text.includes('does not exist')
      ) {
        return { trouble: { kind: 'missing' } }
      }
      // The key is wrong, or EXECUTE was never granted to anon.
      if (
        error.code === '42501' ||
        error.code === 'PGRST301' ||
        text.includes('permission denied') ||
        text.includes('jwt') ||
        text.includes('api key')
      ) {
        return { trouble: { kind: 'refused', detail } }
      }
      /*
        The request never arrived. supabase-js does not throw for this — it
        hands back the fetch failure as an ordinary error object, which is why
        "TypeError: Failed to fetch" was being reported as a problem at the
        server's end rather than as not reaching one.
      */
      if (
        !error.code ||
        text.includes('failed to fetch') ||
        text.includes('fetch failed') ||
        text.includes('load failed') ||
        text.includes('networkerror') ||
        text.includes('network request failed')
      ) {
        return { trouble: { kind: 'unreachable', detail } }
      }
      return { trouble: { kind: 'server', detail } }
    }

    return { answer: (data ?? {}) as RpcAnswer }
  } catch (thrown) {
    const name = (thrown as { name?: string })?.name
    if (name === 'AbortError' || abort.signal.aborted) return { trouble: { kind: 'timeout' } }
    const message = (thrown as { message?: string })?.message
    return { trouble: { kind: 'unreachable', detail: message?.slice(0, 160) } }
  } finally {
    window.clearTimeout(giveUp)
  }
}

/**
 * One call to one of the three functions, with a second go if the first one
 * never lands.
 *
 * A failure comes back as a sentence a player can act on, and `detail` carries
 * the server's own words for anyone trying to work out why. Nothing here ever
 * throws: the caller always gets an answer it can show.
 */
async function call(fn: string, args: Record<string, string>): Promise<AuthResult> {
  if (!accountsPossible()) {
    return {
      ok: false,
      error: 'This build has no server, so it cannot keep accounts.',
      setupNeeded: true,
    }
  }

  let result = await attempt(fn, args)

  /*
    One more go, but only for a request that failed FAST. A dropped or
    refused connection is often a one-off and the next one lands. A request
    that sat there for the full twenty seconds is not going to be helped by
    another twenty — that would just double a wait that already felt broken.
  */
  if ('trouble' in result && result.trouble.kind === 'unreachable') {
    await new Promise((resolve) => window.setTimeout(resolve, RETRY_DELAY_MS))
    result = await attempt(fn, args)
  }

  if ('trouble' in result) return describe(result.trouble)

  const answer = result.answer
  if (!answer.ok) return { ok: false, error: answer.error || 'That did not work.' }
  return {
    ok: true,
    profile: {
      username: answer.username ?? args.p_username,
      avatarId: answer.avatar ?? DEFAULT_AVATAR_ID,
    },
  }
}

/**
 * Ask the server, quietly, whether accounts work here.
 *
 * Called when the sign-in screen opens, and it earns its keep twice over: it
 * tells the player that the database side is missing BEFORE they have picked a
 * character and typed a password, and it wakes a sleeping project up so that
 * the real call a few seconds later is a fast one rather than the slow first
 * request everybody was waiting on.
 *
 * The username it asks about cannot exist, and a name that does not exist is
 * not counted as a wrong guess, so this locks nobody out.
 */
export async function probeAccounts(): Promise<'ready' | 'setup' | 'unreachable'> {
  if (!accountsPossible()) return 'setup'
  const result = await attempt('business_login', {
    p_username: '__probe__',
    p_password: '__probe__',
  })
  if ('answer' in result) return 'ready'
  if (result.trouble.kind === 'missing' || result.trouble.kind === 'refused') return 'setup'
  return 'unreachable'
}

export function signUp(username: string, password: string, avatarId: string): Promise<AuthResult> {
  const problem = usernameProblem(username) ?? passwordProblem(password)
  if (problem) return Promise.resolve({ ok: false, error: problem })
  return call('business_signup', {
    p_username: username.trim(),
    p_password: password,
    p_avatar: avatarId,
  })
}

export function signIn(username: string, password: string): Promise<AuthResult> {
  if (!username.trim() || !password) {
    return Promise.resolve({ ok: false, error: 'Fill in both boxes.' })
  }
  return call('business_login', { p_username: username.trim(), p_password: password })
}

/** Change the character on an account. The password proves it is theirs. */
export function setAccountAvatar(
  username: string,
  password: string,
  avatarId: string,
): Promise<AuthResult> {
  return call('business_set_avatar', {
    p_username: username.trim(),
    p_password: password,
    p_avatar: avatarId,
  })
}
