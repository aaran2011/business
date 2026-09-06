/*
 * Offline.
 *
 * The whole game is HTML, CSS and JavaScript from this one origin — no CDN,
 * no web fonts, no audio files (the sound is synthesised in the browser). So
 * caching what the page asks for is enough to make it work with no internet
 * at all, including in airplane mode.
 *
 * Strategy, deliberately simple:
 *   navigations  — try the network, fall back to the cached page. That way a
 *                  new deploy is picked up when there IS a connection, and the
 *                  game still opens when there is not.
 *   assets       — serve from the cache and refresh in the background, so a
 *                  second launch is instant and never blocks on the network.
 *
 * Multiplayer needs the relay and cannot work offline; that is the honest
 * limit, and the game says so rather than pretending to sync. One device
 * passed around the table works completely offline.
 */

const CACHE = 'business-v1'
const SHELL = ['/', '/index.html', '/favicon.svg', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Only this origin. The relay and anything else is left well alone.
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put('/index.html', copy))
          return response
        })
        .catch(() => caches.match('/index.html').then((hit) => hit || caches.match('/'))),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => hit)
      return hit || network
    }),
  )
})
