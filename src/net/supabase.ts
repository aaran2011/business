import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { BUILT_IN_SUPABASE_ANON_KEY, BUILT_IN_SUPABASE_URL } from './gameServer'

/**
 * The Realtime client.
 *
 * Only Broadcast is used — messages relayed through Supabase to everyone on a
 * channel. That needs no tables, no SQL and no row-level security, so there is
 * nothing to set up in the dashboard beyond having a project.
 *
 * The address is normally the one checked in at `gameServer.ts`, so a fresh
 * deploy just works. An environment variable overrides it when there is one.
 */
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || BUILT_IN_SUPABASE_URL
const anonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || BUILT_IN_SUPABASE_ANON_KEY

export const multiplayerConfigured = Boolean(url && anonKey)

/**
 * What to tell somebody staring at a Home screen that will not host a game.
 * Says where the gap is rather than only that there is one.
 */
export function multiplayerSetupHint(): string {
  return 'This build has no game server yet, so it cannot open a game for other phones. Playing with everybody on this one device still works.'
}

let client: SupabaseClient | null = null

export function supabase(): SupabaseClient {
  if (!multiplayerConfigured) {
    throw new Error(
      'No game server: set BUILT_IN_SUPABASE_URL and BUILT_IN_SUPABASE_ANON_KEY in src/net/gameServer.ts, or the matching VITE_ environment variables. See DEPLOY.md.',
    )
  }
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: { persistSession: false },
      // The board is small; a generous rate keeps a burst of rolls smooth.
      realtime: { params: { eventsPerSecond: 20 } },
    })
  }
  return client
}
