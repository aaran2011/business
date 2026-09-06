/**
 * Sound.
 *
 * Everything here is synthesised in the browser with the Web Audio API — there
 * is not a single audio file in the project. That is deliberate three times
 * over: nothing to download, so it works offline the moment the page does;
 * nothing copyrighted, because every note is generated here; and nothing to
 * cache, so the game stays small.
 *
 * The music is one slow jazz progression on soft electric-piano-ish tones with
 * a brushed pulse, played at a low level and gently varied so it does not
 * announce itself. It loops indefinitely without repeating a bar exactly.
 *
 * The effects are a deliberately small set — a chime, a good and a bad money
 * sound, a click, dice, and a step — reused everywhere rather than a different
 * noise for every event.
 */

type Sfx = 'chime' | 'good' | 'bad' | 'click' | 'dice' | 'step'

const STORAGE_KEY = 'business.sound'

interface Prefs {
  music: boolean
  sfx: boolean
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { music: true, sfx: true, ...JSON.parse(raw) }
  } catch {
    // Storage blocked; the defaults are fine.
  }
  return { music: true, sfx: true }
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
let musicGain: GainNode | null = null
let sfxGain: GainNode | null = null
let musicTimer: number | null = null
let started = false

function audio(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  ctx = new Ctor()
  master = ctx.createGain()
  master.gain.value = 0.9
  master.connect(ctx.destination)

  musicGain = ctx.createGain()
  musicGain.gain.value = prefs.music ? 0.055 : 0
  musicGain.connect(master)

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

/** Short filtered noise — dice on a table, and the brush in the music. */
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
  if (!prefs.sfx) return
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

// ------------------------------------------------------------------ music --

/**
 * A slow ii-V-I-vi turnaround in F, voiced as sevenths and ninths. Each bar is
 * a chord; the bar length and the little melody note on top are varied so the
 * loop does not become a nag.
 */
const CHORDS: number[][] = [
  [174.61, 220.0, 261.63, 329.63], // Gm9-ish
  [130.81, 196.0, 233.08, 293.66], // C9
  [174.61, 261.63, 329.63, 392.0], // Fmaj7
  [146.83, 220.0, 277.18, 349.23], // Dm9
]
const MELODY = [523.25, 587.33, 698.46, 659.25, 587.33, 783.99, 698.46, 523.25]

let bar = 0

function playBar(): void {
  const c = ctx!
  if (!prefs.music) return
  const chord = CHORDS[bar % CHORDS.length]
  const t = c.currentTime + 0.05
  const barLength = 4.6

  chord.forEach((freq, i) => {
    const osc = c.createOscillator()
    const gain = c.createGain()
    // Two stacked sines make a rounder, more electric-piano tone than one.
    osc.type = i === 0 ? 'sine' : 'triangle'
    osc.frequency.value = freq
    const peak = i === 0 ? 0.5 : 0.24
    const at = t + i * 0.045
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.35)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + barLength * 0.92)
    osc.connect(gain)
    gain.connect(musicGain!)
    osc.start(at)
    osc.stop(at + barLength)
  })

  // A single melody note, not every bar, so it stays sparse.
  if (bar % 2 === 0) {
    const note = MELODY[(bar / 2) % MELODY.length]
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = note
    const at = t + 1.1
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.22, at + 0.12)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.6)
    osc.connect(gain)
    gain.connect(musicGain!)
    osc.start(at)
    osc.stop(at + 1.8)
  }

  // Brushed pulse on two and four, very quiet.
  for (const beat of [1.15, 3.45]) {
    const frames = Math.floor(c.sampleRate * 0.12)
    const buffer = c.createBuffer(1, frames, c.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
    const src = c.createBufferSource()
    src.buffer = buffer
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 5000
    const gain = c.createGain()
    gain.gain.setValueAtTime(0.05, t + beat)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + beat + 0.12)
    src.connect(hp)
    hp.connect(gain)
    gain.connect(musicGain!)
    src.start(t + beat)
    src.stop(t + beat + 0.14)
  }

  bar += 1
  musicTimer = window.setTimeout(playBar, barLength * 1000)
}

/**
 * Start everything. Browsers refuse to make noise until the player has
 * interacted with the page, so this is called from the first real tap.
 */
export function startAudio(): void {
  if (started) return
  const c = audio()
  if (!c) return
  started = true
  if (c.state === 'suspended') void c.resume()
  playBar()
}

export function soundPrefs(): Prefs {
  return { ...prefs }
}

export function setMusicOn(on: boolean): void {
  prefs = { ...prefs, music: on }
  savePrefs()
  if (musicGain && ctx) {
    musicGain.gain.setTargetAtTime(on ? 0.055 : 0, ctx.currentTime, 0.2)
  }
  if (on && started && musicTimer === null) playBar()
}

export function setSfxOn(on: boolean): void {
  prefs = { ...prefs, sfx: on }
  savePrefs()
  if (sfxGain && ctx) sfxGain.gain.value = on ? 0.5 : 0
}
