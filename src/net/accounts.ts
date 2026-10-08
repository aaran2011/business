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
  /**
   * True for a profile that only exists on this device — somebody who chose
   * to play without signing in. It still names them and gives them a
   * character; it just is not an account anywhere.
   */
  local: boolean
}

export type AuthResult =
  | { ok: true; profile: Profile }
  | {
      ok: false
      error: string
      /** The database side has not been set up yet, which is worth saying. */
      setupNeeded?: boolean
    }

const STORE_KEY = 'business.profile'

/** How long to wait for the account server before saying it is not there. */
const ACCOUNT_TIMEOUT_MS = 7000

/** The signed-in player on this device, if there is one. */
export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Profile>
    if (!parsed.username) return null
    return {
      username: String(parsed.username),
      avatarId: String(parsed.avatarId ?? DEFAULT_AVATAR_ID),
      local: Boolean(parsed.local),
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
    // Private browsing. They stay signed in for this session only.
  }
}

export function clearProfile(): void {
  try {
    localStorage.removeItem(STORE_KEY)
  } catch {
    // Nothing to do: there is no copy anywhere else.
  }
}

/** Whether accounts can be reached at all from this build. */
export function accountsPossible(): boolean {
  return multiplayerConfigured
}

/**
 * The checks the database makes, repeated here so the form can say what is
 * wrong before anything is sent. The database is still the authority — see
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

interface RpcAnswer {
  ok?: boolean
  error?: string
  username?: string
  avatar?: string
}

/**
 * One call to one of the three functions.
 *
 * Every failure comes back as a sentence a player can act on. A missing
 * function means the SQL has not been run, which is a setup problem rather
 * than a wrong password, and is reported as such.
 */
async function call(fn: string, args: Record<string, string>): Promise<AuthResult> {
  if (!accountsPossible()) {
    return {
      ok: false,
      error: 'This build has no server, so it cannot keep accounts.',
      setupNeeded: true,
    }
  }

  /*
    Give up after a few seconds rather than leaving somebody watching "One
    moment…". Without this the browser's own timeout runs to twenty seconds,
    which on a bad connection feels like the game has hung — and the answer
    they need ("play without an account") is one tap away the whole time.
  */
  const abort = new AbortController()
  const giveUp = window.setTimeout(() => abort.abort(), ACCOUNT_TIMEOUT_MS)

  try {
    const { data, error } = await supabase().rpc(fn, args).abortSignal(abort.signal)

    if (error) {
      const text = `${error.message} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()
      const missing =
        error.code === '42883' ||
        error.code === 'PGRST202' ||
        text.includes('does not exist') ||
        text.includes('could not find the function') ||
        text.includes('schema cache')
      if (missing) {
        return {
          ok: false,
          error:
            'Accounts are not switched on for this game yet. Until they are, you can play without one.',
          setupNeeded: true,
        }
      }
      return { ok: false, error: 'Could not reach the account server. Check the connection.' }
    }

    const answer = (data ?? {}) as RpcAnswer
    if (!answer.ok) {
      return { ok: false, error: answer.error || 'That did not work.' }
    }
    return {
      ok: true,
      profile: {
        username: answer.username ?? args.p_username,
        avatarId: answer.avatar ?? DEFAULT_AVATAR_ID,
        local: false,
      },
    }
  } catch {
    return { ok: false, error: 'Could not reach the account server. Check the connection.' }
  } finally {
    window.clearTimeout(giveUp)
  }
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
