/**
 * ============================================================================
 * reCAPTCHA on the sign-in screen.
 * ============================================================================
 *
 * OFF until a site key is set below. With no key there is no widget, no script
 * from Google, no token and no change to anything — the game stays exactly as
 * it is, and in particular it still opens and plays with no internet.
 *
 * It guards CREATING AN ACCOUNT only — his decision, 2026-10-12. Signing in
 * stays one tap, and is already bolted by the ten-wrong-guesses lockout.
 *
 * Why it needs two halves. The tick-box proves nothing on its own: the signup
 * function is a public URL and anybody can call it straight from a terminal
 * without ever loading this page. What makes it real is the database checking
 * the token with Google before it creates an account — `supabase/recaptcha.sql`
 * does that, and it is a SEPARATE script from `accounts.sql` on purpose, so a
 * problem with the captcha cannot stop accounts working.
 *
 * To switch it on:
 *   1. Register the site at google.com/recaptcha (reCAPTCHA **v2**, the
 *      "I'm not a robot" tick-box) for the domain the game is served from.
 *   2. Put the SITE key below. It is public by design — it ships in the page
 *      on every site that uses reCAPTCHA.
 *   3. Put the SECRET key into the database, never into this repository:
 *      see the top of `supabase/recaptcha.sql`.
 *   4. Run `supabase/recaptcha.sql` once in the Supabase SQL editor.
 *
 * Leaving step 3 or 4 undone is safe: the database treats a missing secret as
 * "no captcha configured" and carries on, rather than locking everybody out.
 */

/**
 * The public site key. Empty switches reCAPTCHA off completely.
 *
 * Typed `string` on purpose: without it TypeScript narrows this to the one
 * literal it is set to and then calls `captchaEnabled()` a mistake, because
 * the comparison "can never be true". The whole point is that it can be
 * emptied again.
 */
export const RECAPTCHA_SITE_KEY: string = '6LejS-stAAAAABb9wHeGEVw1PFntlcpQMjy9mKcY'

/** Widget rendering is reCAPTCHA v2's "I'm not a robot" checkbox. */
const SCRIPT_URL = 'https://www.google.com/recaptcha/api.js?render=explicit'
const SCRIPT_ID = 'business-recaptcha'

export function captchaEnabled(): boolean {
  return RECAPTCHA_SITE_KEY !== ''
}

interface Grecaptcha {
  render: (
    container: HTMLElement,
    options: { sitekey: string; callback?: (token: string) => void; 'expired-callback'?: () => void },
  ) => number
  reset: (widgetId?: number) => void
  getResponse: (widgetId?: number) => string
}

declare global {
  interface Window {
    grecaptcha?: Grecaptcha
    // Google calls this once its script is ready.
    businessRecaptchaReady?: () => void
  }
}

let loading: Promise<Grecaptcha> | null = null

/**
 * Fetch Google's script, once, and resolve when the widget API is usable.
 *
 * Rejects rather than hanging if the script cannot be loaded — on a blocked
 * network, or behind an ad blocker, which is common enough to plan for. The
 * caller decides what that means; see `CaptchaBox`.
 */
export function loadCaptcha(): Promise<Grecaptcha> {
  if (!captchaEnabled()) return Promise.reject(new Error('reCAPTCHA is switched off.'))
  if (window.grecaptcha?.render) return Promise.resolve(window.grecaptcha)
  if (loading) return loading

  loading = new Promise<Grecaptcha>((resolve, reject) => {
    const give = window.setTimeout(
      () => reject(new Error('reCAPTCHA did not load.')),
      12000,
    )
    const done = () => {
      window.clearTimeout(give)
      if (window.grecaptcha?.render) resolve(window.grecaptcha)
      else reject(new Error('reCAPTCHA loaded but is not usable.'))
    }

    if (document.getElementById(SCRIPT_ID)) {
      // Another caller is already waiting on the same script.
      const poll = window.setInterval(() => {
        if (window.grecaptcha?.render) {
          window.clearInterval(poll)
          done()
        }
      }, 120)
      window.setTimeout(() => window.clearInterval(poll), 12000)
      return
    }

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = SCRIPT_URL
    script.async = true
    script.defer = true
    script.onerror = () => {
      window.clearTimeout(give)
      reject(new Error('reCAPTCHA could not be reached.'))
    }
    script.onload = () => {
      // `render=explicit` means the API object appears a moment after onload.
      const poll = window.setInterval(() => {
        if (window.grecaptcha?.render) {
          window.clearInterval(poll)
          done()
        }
      }, 80)
    }
    document.head.appendChild(script)
  })

  // A failed load should not be remembered for ever; the next attempt retries.
  loading.catch(() => {
    loading = null
  })
  return loading
}
