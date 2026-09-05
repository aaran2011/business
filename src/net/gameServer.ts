/**
 * Where the game server lives.
 *
 * These two values are checked in on purpose. A Supabase publishable key is
 * public by design — it is compiled into the browser bundle of every Supabase
 * site, so putting it here exposes nothing that deploying the site would not.
 * What it buys is that ANY deploy of this repository can host a game with no
 * setup at all: no dashboard, no environment variables, nothing to forget.
 *
 * Safety does not rest on this key being secret. Only Realtime Broadcast is
 * used — messages relayed between the phones in one game. There are no tables
 * behind it, so there is no data for a key holder to read or write.
 *
 * An environment variable still wins where one is set, so a different project
 * can be pointed at (a test one, say) without editing code.
 */
export const BUILT_IN_SUPABASE_URL = ''
export const BUILT_IN_SUPABASE_ANON_KEY = ''
