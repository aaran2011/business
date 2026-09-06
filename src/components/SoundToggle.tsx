import { useState } from 'react'
import { setMusicOn, setSfxOn, soundPrefs, startAudio } from '../audio/sound'

/**
 * Music and effects, on or off. Both settings are remembered.
 *
 * Lives inside House Rules rather than the top bar: the top bar is for the
 * game itself, and two speaker icons there were clutter.
 */
export function SoundToggle() {
  const [prefs, setPrefs] = useState(soundPrefs)

  return (
    <div className="sound-toggle">
      <span className="sound-label">Sound</span>
      <button
        className={`btn btn-sm btn-ghost${prefs.music ? '' : ' is-off'}`}
        aria-pressed={prefs.music}
        title={prefs.music ? 'Music on' : 'Music off'}
        onClick={() => {
          startAudio()
          const next = !prefs.music
          setMusicOn(next)
          setPrefs(soundPrefs())
        }}
      >
        {prefs.music ? '\u{1F3B5}' : '\u{1F507}'}
      </button>
      <button
        className={`btn btn-sm btn-ghost${prefs.sfx ? '' : ' is-off'}`}
        aria-pressed={prefs.sfx}
        title={prefs.sfx ? 'Sounds on' : 'Sounds off'}
        onClick={() => {
          startAudio()
          const next = !prefs.sfx
          setSfxOn(next)
          setPrefs(soundPrefs())
        }}
      >
        {prefs.sfx ? '\u{1F514}' : '\u{1F515}'}
      </button>
    </div>
  )
}
