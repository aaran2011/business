import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * The Realtime client.
 *
 * Only Broadcast is used — messages relayed through Supabase to everyone on a
 * channel. That needs no tables, no SQL and no row-level security, so there is
 * nothing to set up in the dashboard beyond having a project.
 *
 * The anon key is public by design: it is compiled into the browser bundle of
 * every Supabase app. Keeping it in an env var is about being able to swap
 * projects, not about hiding it.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const multiplayerConfigured = Boolean(url && anonKey)

let client: SupabaseClient | null = null

export function supabase(): SupabaseClient {
  if (!multiplayerConfigured) {
    throw new Error(
      'Multiplayer needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. See .env.example.',
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
