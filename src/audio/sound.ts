/**
 * Sound.
 *
 * There is NO background music. It was removed at Aaran's request — a loop
 * playing under a board game turned out to be a nuisance rather than
 * atmosphere. Do not add it back without being asked.
 *
 * What remains is a small set of short effects — a chime, a good and a bad
 * money sound, a click, dice, and a step — reused everywhere rather than a
 * different noise for every event. They are synthesised in the browser with
 * the Web Audio API: no audio files, so nothing to download, nothing
 * copyrighted, and everything works offline the moment the page does.
 *
 * All of it follows the app, and "follows" means the WINDOW, not just the
 * tab. A page whose window is behind another app is still `visible` as far as
 * the visibility API is concerned, so watching visibility alone left the game
 * rattling dice at somebody who had walked away from it. Focus is watched too,
 * and closing the page tears the audio down completely.
 */

type Sfx = 'chime' | 'good' | 'bad' | 'cash' | 'click' | 'dice' | 'step'

const STORAGE_KEY = 'business.sound'

interface Prefs {
  /** Short effects. On by default; they only ever fire on a real event. */
  sfx: boolean
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Prefs>
      return { sfx: saved.sfx ?? true }
    }
  } catch {
    // Storage blocked; the default is fine.
  }
  return { sfx: true }
}

let prefs = loadPrefs()

function savePrefs(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Nothing to do — the setting just will not survive a reload.
  }
}

let ctx: AudioContext | null = null
let master: GainNode | null = null
let sfxGain: GainNode | null = null
let started = false
/** The tab is hidden — switched away from, or the phone was locked. */
let hidden = false
/** The window is not the one being used — another app or window is in front. */
let blurred = typeof document !== 'undefined' ? !document.hasFocus() : false

/** Nothing may make a sound unless the game is the thing on screen. */
function silent(): boolean {
  return hidden || blurred
}

function audio(): AudioContext | null {
  if (ctx) return ctx
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  ctx = new Ctor()
  master = ctx.createGain()
  master.gain.value = 0.9
  master.connect(ctx.destination)

  sfxGain = ctx.createGain()
  sfxGain.gain.value = prefs.sfx ? 0.5 : 0
  sfxGain.connect(master)
  return ctx
}

// ---------------------------------------------------------------- effects --

/** A soft struck tone: the building block for most of the effects. */
function tone(
  freq: number,
  start: number,
  length: number,
  peak: number,
  type: OscillatorType = 'sine',
): void {
  const c = ctx!
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), start + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
  osc.connect(gain)
  gain.connect(sfxGain!)
  osc.start(start)
  osc.stop(start + length + 0.05)
}

/** Short filtered noise — dice landing on a table. */
function noise(start: number, length: number, peak: number, freq: number): void {
  const c = ctx!
  const frames = Math.max(1, Math.floor(c.sampleRate * length))
  const buffer = c.createBuffer(1, frames, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) {
    // Fades across the burst so it reads as a tap rather than a click.
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
  }
  const src = c.createBufferSource()
  src.buffer = buffer
  const band = c.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = freq
  band.Q.value = 0.9
  const gain = c.createGain()
  gain.gain.setValueAtTime(peak, start)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
  src.connect(band)
  band.connect(gain)
  gain.connect(sfxGain!)
  src.start(start)
  src.stop(start + length + 0.02)
}

export function play(sound: Sfx): void {
  if (!prefs.sfx || silent()) return
  const c = audio()
  if (!c) return
  if (c.state === 'suspended') void c.resume()
  const t = c.currentTime + 0.01

  switch (sound) {
    case 'chime':
      tone(880, t, 0.28, 0.16, 'triangle')
      tone(1320, t + 0.05, 0.22, 0.08, 'sine')
      break
    case 'good':
      // Rising third: money in.
      tone(660, t, 0.16, 0.16, 'triangle')
      tone(880, t + 0.09, 0.3, 0.16, 'triangle')
      tone(1320, t + 0.18, 0.34, 0.07, 'sine')
      break
    case 'bad':
      // Falling minor: money out. Soft, not a buzzer.
      tone(440, t, 0.2, 0.15, 'triangle')
      tone(370, t + 0.11, 0.34, 0.14, 'triangle')
      tone(294, t + 0.22, 0.4, 0.09, 'sine')
      break
    case 'cash':
      // Getting paid. Coins landing, then a bright two-note flourish over
      // them — longer and happier than 'good', which is the quiet version.
      noise(t, 0.05, 0.3, 3200)
      noise(t + 0.06, 0.05, 0.26, 2600)
      noise(t + 0.13, 0.04, 0.2, 3600)
      tone(784, t + 0.02, 0.2, 0.15, 'triangle')
      tone(1046, t + 0.13, 0.26, 0.15, 'triangle')
      tone(1568, t + 0.24, 0.42, 0.1, 'sine')
      tone(2093, t + 0.3, 0.36, 0.05, 'sine')
      break
    case 'click':
      tone(1200, t, 0.05, 0.09, 'square')
      break
    case 'dice':
      // Three uneven taps, like a die tumbling to rest.
      noise(t, 0.07, 0.5, 2400)
      noise(t + 0.1, 0.06, 0.38, 1900)
      noise(t + 0.19, 0.05, 0.26, 1500)
      break
    case 'step':
      tone(520, t, 0.05, 0.05, 'sine')
      break
  }
}

// --------------------------------------------------------------- lifecycle --

/**
 * Silence while the game is not the thing being used.
 *
 * A Web Audio context keeps running when the page goes into the background —
 * switching apps, locking the phone, moving to another tab, or simply clicking
 * on another window. Suspending the context stops everything already scheduled
 * at once, which is what makes it instant rather than "after this dice roll
 * finishes"; coming back resumes it.
 */
function suspendNow(): void {
  if (ctx && ctx.state === 'running') void ctx.suspend()
}

function resumeIfUsed(): void {
  if (silent() || !started || !ctx) return
  if (ctx.state === 'suspended') void ctx.resume()
}

function goQuiet(): void {
  hidden = true
  suspendNow()
}

function comeBack(): void {
  hidden = false
  resumeIfUsed()
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') goQuiet()
    else comeBack()
  })

  /*
   * The window losing focus is the case visibility does NOT cover: on a
   * laptop a tab behind another application is still "visible", so without
   * this the dice kept rattling at somebody who had moved on to something
   * else. Suspending on blur stops mid-sound.
   */
  window.addEventListener('blur', () => {
    blurred = true
    suspendNow()
  })

  window.addEventListener('focus', () => {
    blurred = false
    resumeIfUsed()
  })

  // Leaving the page for good: tear the context down rather than leave it
  // suspended. `persisted` means the page is going into the back/forward
  // cache and may come back, so that one is only paused.
  window.addEventListener('pagehide', (event) => {
    if ((event as PageTransitionEvent).persisted) {
      goQuiet()
      return
    }
    started = false
    void ctx?.close()
    ctx = null
    master = sfxGain = null
  })
}

/**
 * Prepare the audio. Browsers refuse to make noise until the player has
 * interacted with the page, so this is called from the first real tap. It
 * starts nothing playing by itself — there is no music to start.
 */
export function startAudio(): void {
  if (started) return
  const c = audio()
  if (!c) return
  started = true
  if (c.state === 'suspended') void c.resume()
}

export function soundPrefs(): Prefs {
  return { ...prefs }
}

export function setSfxOn(on: boolean): void {
  prefs = { ...prefs, sfx: on }
  savePrefs()
  if (sfxGain && ctx) sfxGain.gain.value = on ? 0.5 : 0
}

/**
 * A handle on the sound, for development only. Whether audio actually stops
 * when the page goes away is not something you can see on screen, so it has to
 * be checkable. Compiled out of the built game.
 */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { businessAudio?: unknown }).businessAudio = {
    start: startAudio,
    play,
    state: () => ({
      contextState: ctx?.state ?? 'none',
      started,
      hidden,
      blurred,
      silent: silent(),
      prefs: { ...prefs },
    }),
  }
}
