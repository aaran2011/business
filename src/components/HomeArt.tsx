import { useId } from 'react'

/**
 * ============================================================================
 * THE FRONT DOOR'S ARTWORK — a dreamy landscape, drawn rather than downloaded.
 * ============================================================================
 *
 * Every piece here is vector shapes. That is not stylistic stubbornness: the
 * game has to open and play with no internet, and the service worker can only
 * promise that while nothing is fetched from anywhere. A photograph of a
 * mountain would be the easy way to get this look and would quietly break it.
 *
 * The scene is built the way a painter builds one — sky, light, far hills,
 * mist, near hills, foreground — each layer paler and bluer than the one in
 * front of it. That recession is what makes a flat gradient read as distance.
 *
 * All ids are suffixed per instance. Gradients, filters and clips live in one
 * global namespace, so a shared id is resolved from whichever copy happens to
 * be first in the document and breaks the moment that copy unmounts.
 */

// ---------------------------------------------------------------------------
// THE BACKDROP
// ---------------------------------------------------------------------------

/**
 * The scene behind the whole page.
 *
 * `slice` rather than `meet`: the picture is a backdrop, so it should fill
 * whatever shape the window is and let the edges fall off, never letterbox.
 * The composition keeps its subjects away from the middle, because the middle
 * is where the cards go.
 */
export function HomeBackdrop() {
  const u = `hb${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg
      className="home-backdrop"
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${u}-sky`} x1="0" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#cfe2f7" />
          <stop offset="0.38" stopColor="#e4ecf8" />
          <stop offset="0.68" stopColor="#fbe6d6" />
          <stop offset="1" stopColor="#ffe9d2" />
        </linearGradient>
        <radialGradient id={`${u}-sun`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff6e2" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#ffe7c0" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffd9a8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${u}-far`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9cbe6" />
          <stop offset="1" stopColor="#d7e3f3" />
        </linearGradient>
        <linearGradient id={`${u}-mid`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#9db3d4" />
          <stop offset="1" stopColor="#c3d2e8" />
        </linearGradient>
        <linearGradient id={`${u}-near`} x1="0.2" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#8aa0c4" />
          <stop offset="1" stopColor="#aebfdb" />
        </linearGradient>
        <linearGradient id={`${u}-grass`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#cfe0a8" />
          <stop offset="0.55" stopColor="#a9c983" />
          <stop offset="1" stopColor="#7fa45f" />
        </linearGradient>
        <linearGradient id={`${u}-rock`} x1="0.2" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#b79a86" />
          <stop offset="1" stopColor="#8a6f5e" />
        </linearGradient>
        <filter id={`${u}-soft`} x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="22" />
        </filter>
        <filter id={`${u}-softer`} x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="40" />
        </filter>
        <filter id={`${u}-haze`} x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <linearGradient id={`${u}-floor`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.35" stopColor="#fdfaff" stopOpacity="0.72" />
          <stop offset="1" stopColor="#f6f2fb" stopOpacity="0.92" />
        </linearGradient>
      </defs>

      {/* sky, and the sun that lights everything from the right */}
      <rect width="1600" height="900" fill={`url(#${u}-sky)`} />
      <circle cx="1395" cy="150" r="330" fill={`url(#${u}-sun)`} />
      <circle cx="1395" cy="150" r="62" fill="#fff8ec" opacity="0.92" />

      {/* furthest peaks: barely there, which is what puts them far away */}
      <g fill={`url(#${u}-far)`} opacity="0.55">
        <path d="M-40 470 180 250 330 400 470 290 650 470z" />
        <path d="M980 470 1130 300 1250 400 1400 268 1560 470z" />
      </g>

      {/* mist across their feet */}
      <g fill="#ffffff" filter={`url(#${u}-softer)`} opacity="0.75">
        <ellipse cx="300" cy="455" rx="420" ry="46" />
        <ellipse cx="1240" cy="450" rx="400" ry="42" />
      </g>

      {/* the mountains that read as the real subject, left and right */}
      <g>
        <path d="M-60 560 150 230 290 395 395 300 560 560z" fill={`url(#${u}-mid)`} />
        <path d="M150 230 230 326 180 356 118 300z" fill="#f2f7ff" opacity="0.85" />
        <path d="M395 300 452 370 408 388 362 345z" fill="#f2f7ff" opacity="0.7" />
        <path d="M1120 560 1300 255 1420 390 1510 310 1660 560z" fill={`url(#${u}-mid)`} />
        <path d="M1300 255 1372 345 1326 372 1266 320z" fill="#f2f7ff" opacity="0.8" />
      </g>

      {/* nearer ridge, warmer and darker, cut off by the cloud sea */}
      <g>
        <path d="M-80 640 120 400 250 520 340 440 520 640z" fill={`url(#${u}-near)`} opacity="0.75" />
        <path d="M1180 640 1330 430 1450 540 1540 470 1680 640z" fill={`url(#${u}-near)`} opacity="0.7" />
      </g>

      {/* ---- the floating island, right of centre, in the warm light ---- */}
      <g transform="translate(1212 118) scale(0.88)">
        {/* its underside tapers to a point, which is what makes it float */}
        <path d="M18 92C18 92 96 86 150 92 212 99 250 118 250 118L142 232 36 118z" fill={`url(#${u}-rock)`} />
        <path d="M36 118 142 232 94 150z" fill="#6f5748" opacity="0.5" />
        <path d="M14 86c0-18 54-32 124-32s124 14 124 32-56 34-124 34S14 104 14 86z" fill={`url(#${u}-grass)`} />
        <path d="M22 80c8-13 56-23 116-23 34 0 64 3 86 9-24-10-62-16-102-16-46 0-85 11-100 30z" fill="#e6f0c8" opacity="0.75" />
        {/* the path up to the house */}
        <path
          d="M56 104c26-12 48-6 66-14s24-20 46-22"
          stroke="#e9dcc2"
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
          opacity="0.9"
        />
        {/* a small house with a warm roof and a flag */}
        <g transform="translate(150 28)">
          <rect x="6" y="22" width="40" height="30" rx="3" fill="#fbf4e8" />
          <rect x="6" y="22" width="12" height="30" fill="#ffffff" opacity="0.6" />
          <path d="M0 24 26 2 52 24z" fill="#e2703a" />
          <path d="M0 24 26 2 26 24z" fill="#f28a53" />
          <rect x="30" y="4" width="13" height="16" rx="2" fill="#fbf4e8" />
          <path d="M28 6 46 -8 48 6z" fill="#d85f33" />
          <rect x="20" y="34" width="9" height="18" rx="1.5" fill="#9fc0e0" />
          <path d="M43 -8v-13" stroke="#8a6f5e" strokeWidth="2" strokeLinecap="round" />
          <path d="M43 -21 60 -16 43 -11z" fill="#e2443f" />
        </g>
        {/* pines, smaller towards the back */}
        {[
          [44, 54, 1],
          [68, 50, 0.82],
          [92, 56, 0.94],
          [214, 56, 0.9],
          [236, 52, 0.76],
        ].map(([x, y, s], i) => (
          <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
            <path d="M0 0 11 26H-11z" fill="#4e7d4a" />
            <path d="M0 -12 9 10H-9z" fill="#5f9158" />
            <path d="M0 0 11 26H0z" fill="#3f6a3d" opacity="0.55" />
          </g>
        ))}
      </g>

      {/* ---- the sea of cloud the whole page sits on ---- */}
      <g fill="#ffffff" filter={`url(#${u}-soft)`}>
        <ellipse cx="240" cy="660" rx="430" ry="92" opacity="0.95" />
        <ellipse cx="760" cy="700" rx="520" ry="104" opacity="0.92" />
        <ellipse cx="1340" cy="655" rx="430" ry="88" opacity="0.95" />
        <ellipse cx="520" cy="620" rx="260" ry="58" opacity="0.8" />
        <ellipse cx="1080" cy="612" rx="240" ry="54" opacity="0.78" />
      </g>
      <rect y="640" width="1600" height="260" fill={`url(#${u}-floor)`} />
      {/* cloud tops, lit from the right, so the sea has a surface */}
      <g filter={`url(#${u}-haze)`}>
        <path
          d="M80 790c40-44 96-54 142-26 28-44 96-54 134-14 34-30 86-24 108 14 44-30 104-16 118 26z"
          fill="#ffffff"
          opacity="0.95"
        />
        <path
          d="M900 806c44-48 104-58 152-26 30-46 102-56 142-14 36-32 92-26 116 16 46-32 110-18 126 24z"
          fill="#ffffff"
          opacity="0.92"
        />
        <path
          d="M470 836c34-36 82-44 120-22 24-38 82-46 114-12 30-26 74-20 92 12z"
          fill="#fff8f0"
          opacity="0.9"
        />
      </g>
      <g fill="#ffffff" filter={`url(#${u}-soft)`} opacity="0.75">
        <ellipse cx="420" cy="860" rx="520" ry="80" />
        <ellipse cx="1180" cy="868" rx="520" ry="76" />
      </g>

      {/* drifting cloud, high and thin, to break up the empty sky */}
      <g fill="#ffffff" filter={`url(#${u}-haze)`} opacity="0.65">
        <ellipse cx="620" cy="180" rx="150" ry="20" />
        <ellipse cx="700" cy="164" rx="92" ry="15" />
        <ellipse cx="1080" cy="120" rx="118" ry="15" />
      </g>

      {/* foreground: dark enough to frame, soft enough not to shout */}
      <g>
        <path d="M-60 900 -20 700 120 760 230 690 330 900z" fill="#8ea7c8" opacity="0.5" />
        <path d="M1300 900 1390 700 1500 770 1600 702 1680 900z" fill="#8ea7c8" opacity="0.45" />
        {[
          [60, 790, 1.5],
          [150, 826, 1.9],
          [1460, 800, 1.6],
          [1548, 836, 2],
        ].map(([x, y, s], i) => (
          <g key={i} transform={`translate(${x} ${y}) scale(${s})`} opacity="0.55">
            <path d="M0 0 16 40H-16z" fill="#56804f" />
            <path d="M0 -18 13 14H-13z" fill="#679a5c" />
          </g>
        ))}
      </g>

      {/* birds, because an empty sky looks unfinished */}
      <g stroke="#9fb0c8" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.65">
        <path d="M1490 100q7-7 14 0M1504 100q7-7 14 0" />
        <path d="M1536 132q6-6 12 0M1548 132q6-6 12 0" />
        <path d="M1466 148q5-5 10 0M1476 148q5-5 10 0" />
      </g>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// THE TWO "HOW YOU PLAY" SCENES
// ---------------------------------------------------------------------------

/** Classic: a warm little homestead on a hill. Settled, owned, finished. */
export function ClassicScene() {
  const u = `cs${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg className="card-scene" viewBox="0 0 320 150" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${u}-sky`} x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#dfeafb" />
          <stop offset="1" stopColor="#ffeeda" />
        </linearGradient>
        <linearGradient id={`${u}-hill`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#d4e3ab" />
          <stop offset="0.5" stopColor="#aacb84" />
          <stop offset="1" stopColor="#7da55e" />
        </linearGradient>
        <filter id={`${u}-soft`} x="-40%" y="-80%" width="180%" height="260%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>
      <rect width="320" height="150" fill={`url(#${u}-sky)`} />
      <circle cx="258" cy="36" r="56" fill="#fff3dd" opacity="0.8" />
      <circle cx="258" cy="36" r="17" fill="#fffaf0" />
      <path d="M-10 96 44 60 96 92 150 66 196 96z" fill="#c3d4ea" opacity="0.55" />
      <g fill="#ffffff" filter={`url(#${u}-soft)`} opacity="0.9">
        <ellipse cx="60" cy="118" rx="120" ry="24" />
        <ellipse cx="250" cy="124" rx="130" ry="22" />
      </g>
      {/* the hill */}
      <path d="M26 150c0-38 50-62 134-62s134 24 134 62z" fill={`url(#${u}-hill)`} />
      <path d="M40 142c10-26 52-44 112-44 20 0 38 2 54 6-20-8-46-12-74-12-52 0-84 20-92 50z" fill="#e8f2ce" opacity="0.7" />
      <path d="M96 150c22-16 36-22 50-30s20-18 38-22" stroke="#efe3c8" strokeWidth="6" strokeLinecap="round" fill="none" />
      {/* the house */}
      <g transform="translate(142 68)">
        <rect x="6" y="20" width="40" height="28" rx="3" fill="#fdf7ec" />
        <rect x="6" y="20" width="13" height="28" fill="#ffffff" opacity="0.7" />
        <path d="M0 22 26 2 52 22z" fill="#e2703a" />
        <path d="M0 22 26 2 26 22z" fill="#f4915b" />
        <rect x="20" y="32" width="10" height="16" rx="1.5" fill="#9cc0e2" />
        <rect x="33" y="27" width="8" height="8" rx="1.5" fill="#9cc0e2" />
      </g>
      {[
        [104, 96, 1],
        [120, 92, 0.82],
        [206, 96, 0.95],
        [222, 93, 0.78],
      ].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <path d="M0 0 12 28H-12z" fill="#4f7f4a" />
          <path d="M0 -13 10 11H-10z" fill="#63955b" />
        </g>
      ))}
    </svg>
  )
}

/** Bidding: a cold peak with one tower on it. Contested, out of reach. */
export function BiddingScene() {
  const u = `bs${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg className="card-scene" viewBox="0 0 320 150" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${u}-sky`} x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#d8e6fa" />
          <stop offset="1" stopColor="#f2f6fd" />
        </linearGradient>
        <linearGradient id={`${u}-peak`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#9db5d8" />
          <stop offset="1" stopColor="#6d87b2" />
        </linearGradient>
        <filter id={`${u}-soft`} x="-40%" y="-80%" width="180%" height="260%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>
      <rect width="320" height="150" fill={`url(#${u}-sky)`} />
      <circle cx="54" cy="34" r="44" fill="#ffffff" opacity="0.5" />
      {/* flanking peaks, paler, so the middle one reads as nearest */}
      <path d="M-20 140 50 72 108 124 150 96 198 140z" fill="#bccee7" opacity="0.7" />
      <path d="M190 140 246 80 292 122 340 92 350 140z" fill="#bccee7" opacity="0.6" />
      {/* the one that matters */}
      <path d="M78 150 160 36 244 150z" fill={`url(#${u}-peak)`} />
      <path d="M160 36 196 86 170 100 140 72z" fill="#f4f8ff" />
      <path d="M160 36 196 86 160 86z" fill="#dae6f6" />
      <path d="M78 150 160 36 160 150z" fill="#ffffff" opacity="0.12" />
      {/* the tower on the summit */}
      <g transform="translate(149 6)">
        <rect x="3" y="12" width="16" height="26" rx="2" fill="#f7f3ea" />
        <rect x="3" y="12" width="6" height="26" fill="#ffffff" opacity="0.7" />
        <path d="M0 13 11 0 22 13z" fill="#3f6fa8" />
        <path d="M0 13 11 0 11 13z" fill="#5a8bc4" />
        <rect x="8" y="20" width="6" height="8" rx="1.5" fill="#9cc0e2" />
        <path d="M11 0v-9" stroke="#8a93a6" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M11 -9 24 -5 11 -1z" fill="#e2443f" />
      </g>
      <g fill="#ffffff" filter={`url(#${u}-soft)`} opacity="0.92">
        <ellipse cx="70" cy="132" rx="130" ry="20" />
        <ellipse cx="260" cy="136" rx="120" ry="18" />
        <ellipse cx="160" cy="146" rx="150" ry="18" />
      </g>
      <g stroke="#a9bcd6" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7">
        <path d="M268 42q5-5 10 0M278 42q5-5 10 0" />
        <path d="M292 60q4-4 8 0M300 60q4-4 8 0" />
      </g>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// THE THREE "WHO YOU PLAY WITH" ICONS
// ---------------------------------------------------------------------------

/** Online: a globe, lit from the upper left like everything else here. */
export function GlobeIcon() {
  const u = `gi${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg className="play-icon" viewBox="0 0 72 72" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${u}-o`} cx="0.34" cy="0.28" r="0.82">
          <stop offset="0" stopColor="#8fd3f4" />
          <stop offset="0.6" stopColor="#4aa3e0" />
          <stop offset="1" stopColor="#1f6bb0" />
        </radialGradient>
        <clipPath id={`${u}-c`}>
          <circle cx="36" cy="38" r="26" />
        </clipPath>
      </defs>
      <ellipse cx="38" cy="66" rx="20" ry="4" fill="#5b7ea8" opacity="0.18" />
      <circle cx="36" cy="38" r="26" fill={`url(#${u}-o)`} />
      <g clipPath={`url(#${u}-c)`}>
        <g fill="#7fd4a0">
          <path d="M8 26c8-5 15-3 20 2s2 12-5 13-12-3-15-8z" />
          <path d="M40 18c9-2 16 1 19 7s-1 10-7 9-10-6-12-11z" />
          <path d="M30 48c10-4 20-2 26 4s2 14-7 15-20-6-23-12z" />
        </g>
        <g stroke="#dff0ff" strokeOpacity="0.5" strokeWidth="1.3" fill="none">
          <path d="M10 38h52M36 12c9 10 9 42 0 52M36 12c-9 10-9 42 0 52" />
          <path d="M14 24c12 6 32 6 44 0M14 52c12-6 32-6 44 0" />
        </g>
      </g>
      <circle cx="36" cy="38" r="26" fill="none" stroke="#1b5f9e" strokeOpacity="0.35" strokeWidth="1.4" />
      <ellipse cx="26" cy="27" rx="9" ry="6" fill="#ffffff" opacity="0.4" transform="rotate(-28 26 27)" />
    </svg>
  )
}

/** Computer: a friendly machine, not a menacing one. */
export function RobotIcon() {
  const u = `ri${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg className="play-icon" viewBox="0 0 72 72" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${u}-b`} x1="0.2" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#bfe2fb" />
          <stop offset="0.5" stopColor="#7fb6e8" />
          <stop offset="1" stopColor="#4a7fc0" />
        </linearGradient>
        <linearGradient id={`${u}-v`} x1="0.2" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#36507a" />
          <stop offset="1" stopColor="#1d2f4d" />
        </linearGradient>
      </defs>
      <ellipse cx="37" cy="66" rx="19" ry="4" fill="#5b7ea8" opacity="0.18" />
      <path d="M36 8v7" stroke="#8aa6c8" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="36" cy="7" r="4" fill="#ff9a4d" />
      <circle cx="34.6" cy="5.8" r="1.4" fill="#ffd9b4" />
      <rect x="9" y="30" width="7" height="14" rx="3.5" fill="#8fb4dd" />
      <rect x="56" y="30" width="7" height="14" rx="3.5" fill="#6f98c6" />
      <rect x="13" y="16" width="46" height="40" rx="13" fill={`url(#${u}-b)`} />
      <rect x="19" y="24" width="34" height="21" rx="9" fill={`url(#${u}-v)`} />
      <circle cx="29" cy="34.5" r="4" fill="#7fe3ff" />
      <circle cx="43" cy="34.5" r="4" fill="#7fe3ff" />
      <circle cx="27.8" cy="33.2" r="1.4" fill="#ffffff" />
      <circle cx="41.8" cy="33.2" r="1.4" fill="#ffffff" />
      <path d="M31 41q5 3 10 0" stroke="#7fe3ff" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M17 22c3-4 8-6 15-6 5 0 9 1 12 3-4-1-9-2-14-2-6 0-10 2-13 5z" fill="#ffffff" opacity="0.5" />
      <rect x="27" y="49" width="18" height="4" rx="2" fill="#5f8cbd" />
    </svg>
  )
}

/** Pass and play: the device going round, which is what the arrows mean. */
export function SwapIcon() {
  const u = `si${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg className="play-icon" viewBox="0 0 72 72" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${u}-a`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#a9c8f5" />
          <stop offset="0.5" stopColor="#6d9ce8" />
          <stop offset="1" stopColor="#3f6cc0" />
        </linearGradient>
        <linearGradient id={`${u}-b`} x1="0.9" y1="0" x2="0.1" y2="1">
          <stop offset="0" stopColor="#8fb6f2" />
          <stop offset="0.5" stopColor="#5586d8" />
          <stop offset="1" stopColor="#2f569f" />
        </linearGradient>
      </defs>
      <ellipse cx="37" cy="66" rx="19" ry="4" fill="#5b7ea8" opacity="0.18" />
      {/* upper arrow, pointing right */}
      <path
        d="M14 30c2-9 11-15 22-15h14v-7l14 11-14 11v-7H36c-7 0-12 3-14 8z"
        fill={`url(#${u}-a)`}
      />
      <path d="M16 28c3-7 10-11 20-11h12l-2 2H36c-9 0-16 4-20 9z" fill="#ffffff" opacity="0.45" />
      {/* lower arrow, pointing left */}
      <path
        d="M58 40c-2 9-11 15-22 15H22v7L8 51l14-11v7h14c7 0 12-3 14-8z"
        fill={`url(#${u}-b)`}
      />
      <path d="M56 42c-3 7-10 11-20 11H24l2-2h10c9 0 16-4 20-9z" fill="#ffffff" opacity="0.3" />
    </svg>
  )
}
