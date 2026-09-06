import { useState } from 'react'
import { setSfxOn, soundPrefs, startAudio } from '../audio/sound'

/**
 * The sound switch: the short effects that go with a roll or a payment.
 *
 * There is no music setting because there is no music. It lives inside House
 * Rules rather than the top bar, which is for the game itself.
 */
export function SoundToggle() {
  const [prefs, setPrefs] = useState(soundPrefs)

  return (
    <div className="sound-toggle">
      <span className="sound-label">Sound</span>
      <button
        className={`btn btn-sm btn-ghost${prefs.sfx ? '' : ' is-off'}`}
        aria-pressed={prefs.sfx}
        title={prefs.sfx ? 'Sounds on' : 'Sounds off'}
        onClick={() => {
          startAudio()
          setSfxOn(!prefs.sfx)
          setPrefs(soundPrefs())
        }}
      >
        {prefs.sfx ? '\u{1F514}' : '\u{1F515}'}
      </button>
    </div>
  )
}
