/**
 * The middle of the board. A spinning globe with the game's six transport and
 * utility assets orbiting it, replacing the old block of text.
 * Pure SVG + CSS so it scales with the board at any screen size.
 */

const ORBITERS = ['✈️', '\u{1F6A2}', '\u{1F682}', '\u{1F6F0}️', '\u{1F69B}', '\u{1F6E2}️']

export function BoardCentre() {
  return (
    <div className="centrepiece" aria-hidden="true">
      <div className="globe-stage">
        <svg className="globe" viewBox="0 0 200 200" role="img">
          <defs>
            <radialGradient id="ocean" cx="36%" cy="30%">
              <stop offset="0%" stopColor="#7cc4ff" />
              <stop offset="55%" stopColor="#2e86ff" />
              <stop offset="100%" stopColor="#1450b8" />
            </radialGradient>
            <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ff9a3d" />
              <stop offset="50%" stopColor="#ff5f6d" />
              <stop offset="100%" stopColor="#8f5bff" />
            </linearGradient>
            <clipPath id="globeClip">
              <circle cx="100" cy="100" r="62" />
            </clipPath>
          </defs>

          {/* orbit path */}
          <ellipse
            className="orbit-ring"
            cx="100"
            cy="100"
            rx="88"
            ry="88"
            fill="none"
            stroke="url(#ring)"
            strokeWidth="2.5"
            strokeDasharray="7 9"
            strokeLinecap="round"
          />

          <circle cx="100" cy="100" r="62" fill="url(#ocean)" />

          {/* landmasses, drifting behind the clip so the globe reads as turning */}
          <g clipPath="url(#globeClip)" className="landmass">
            <g fill="#25c281">
              <path d="M22 74c14-9 30-6 40 2s24 4 32 12-6 20-18 20-22-8-32-6-24-6-26-16 2-10 4-12z" />
              <path d="M74 128c10-7 24-4 30 5s18 7 22 16-8 15-20 13-26-6-32-14-6-16 0-20z" />
              <path d="M118 46c12-6 26 0 30 10s-2 18-12 20-20-2-24-10 0-16 6-20z" />
              <path d="M150 96c10-4 20 4 20 14s-8 16-16 14-14-10-12-18 4-9 8-10z" />
            </g>
            <g fill="#1aa06a" opacity="0.55">
              <path d="M40 96c8-4 16 0 18 6s-4 10-12 10-12-4-12-9 3-6 6-7z" />
              <path d="M96 60c8-3 15 2 15 9s-6 10-13 8-9-9-6-14z" />
            </g>
          </g>

          {/* meridians */}
          <g
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.4"
            strokeWidth="1.4"
            clipPath="url(#globeClip)"
          >
            <ellipse cx="100" cy="100" rx="26" ry="62" />
            <ellipse cx="100" cy="100" rx="50" ry="62" />
            <line x1="38" y1="100" x2="162" y2="100" />
            <ellipse cx="100" cy="100" rx="62" ry="30" />
          </g>

          <circle
            cx="100"
            cy="100"
            r="62"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.75"
            strokeWidth="2"
          />

          {/* highlight */}
          <ellipse cx="76" cy="72" rx="20" ry="13" fill="#ffffff" opacity="0.22" />
        </svg>

        {/*
          The six transport / utility assets circling the world. Each sits at a
          fixed angle and the whole field spins as one, so they stay evenly
          spread even when the spin is switched off for reduced motion.
        */}
        <div className="orbit-field">
          {ORBITERS.map((icon, i) => (
            <span
              className="orbiter"
              key={i}
              style={{ '--a': `${(360 / ORBITERS.length) * i}deg` } as React.CSSProperties}
            >
              <span className="orbiter-icon">{icon}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
