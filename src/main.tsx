import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/*
 * Make the game work with no internet.
 *
 * Everything it needs comes from this origin — no CDN, no web fonts, and no
 * audio files, since the sound is synthesised in the browser. So caching the
 * page and its assets is enough to open and play it in airplane mode. Only
 * multiplayer needs the network, and it says so rather than pretending.
 *
 * Registered after load so it never competes with the first paint, and only
 * in a built app: a service worker in front of the dev server would serve
 * yesterday's code back to us.
 */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // No offline support here; the game still runs normally online.
    })
  })
}
