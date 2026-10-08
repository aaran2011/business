import { useId, type JSX } from 'react'
import { avatarById } from '../data/avatars'

/**
 * The characters, drawn.
 *
 * Every one is a handful of shapes in a 48x48 box, in the same flat style as
 * the board's own icon set: no image files, no web font, no CDN, so the game
 * still opens with no internet and the bundle does not grow by a picture.
 *
 * There are people here — an army officer, a doctor, a girl, a boy — because
 * he asked for them in the gallery. That does not change the rule about the
 * BOARD: there is still no person anywhere in the board's artwork, and Jail is
 * still bars and a padlock.
 */

const SKIN = '#f2c49b'
const SKIN_DARK = '#d9a273'
const INK = '#2a3550'

/** Two dots and a smile, shared by every face so they look like one family. */
function Face({ x = 24, y = 23, w = 3.4 }: { x?: number; y?: number; w?: number }) {
  return (
    <>
      <circle cx={x - w} cy={y} r="1.25" fill={INK} />
      <circle cx={x + w} cy={y} r="1.25" fill={INK} />
      <path
        d={`M${x - 2.6} ${y + 3.4} Q${x} ${y + 5.6} ${x + 2.6} ${y + 3.4}`}
        stroke={INK}
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
    </>
  )
}

/** Head, neck and shoulders. Every person is built on this. */
function Bust({ coat, collar }: { coat: string; collar?: string }) {
  return (
    <>
      <path d="M14 48c0-7.2 4.5-11 10-11s10 3.8 10 11z" fill={coat} />
      {collar && <path d="M20 37.6 24 43l4-5.4-4-1.6z" fill={collar} />}
      <rect x="21.4" y="32" width="5.2" height="5" rx="2" fill={SKIN_DARK} />
      <circle cx="24" cy="23" r="9" fill={SKIN} />
    </>
  )
}

/** A stalk with two leaves, shared by the flowers. */
function Stem({ top = 28 }: { top?: number }) {
  return (
    <>
      <path d={`M24 ${top}v14`} stroke="#3f9d5c" strokeWidth="2.4" strokeLinecap="round" />
      <path
        d={`M24 ${top + 5}c-4 0-6-1.6-6.6-4.2 2.8-.6 5.4.6 6.6 4.2z`}
        fill="#4fb36c"
      />
      <path d={`M24 ${top + 9}c4 0 6-1.6 6.6-4.2-2.8-.6-5.4.6-6.6 4.2z`} fill="#3f9d5c" />
    </>
  )
}

/** Wheels, body line and windows, shared by the vehicles. */
function Wheels({ y = 36, left = 15, right = 33 }: { y?: number; left?: number; right?: number }) {
  return (
    <>
      <circle cx={left} cy={y} r="4.4" fill={INK} />
      <circle cx={left} cy={y} r="1.7" fill="#cfd8e8" />
      <circle cx={right} cy={y} r="4.4" fill={INK} />
      <circle cx={right} cy={y} r="1.7" fill="#cfd8e8" />
    </>
  )
}

const ART: Record<string, JSX.Element> = {
  // --------------------------------------------------------------- animals
  cat: (
    <>
      <path d="M13 18 15 7l8 5zM35 18 33 7l-8 5z" fill="#f0a65c" />
      <path d="M15.6 15.4 16.6 10l3.6 2.3zM32.4 15.4 31.4 10l-3.6 2.3z" fill="#ffd6b0" />
      <circle cx="24" cy="26" r="12" fill="#f5b26b" />
      <circle cx="19.6" cy="24.4" r="1.5" fill={INK} />
      <circle cx="28.4" cy="24.4" r="1.5" fill={INK} />
      <path d="M24 27.4 22 29h4z" fill="#e2826a" />
      <path
        d="M22 31q2 2 4 0M13 25h-5M13 28h-5M35 25h5M35 28h5"
        stroke={INK}
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
      />
    </>
  ),
  panda: (
    <>
      <circle cx="13.5" cy="15" r="5" fill={INK} />
      <circle cx="34.5" cy="15" r="5" fill={INK} />
      <circle cx="24" cy="26" r="12.5" fill="#fff" />
      <ellipse cx="18.6" cy="24.6" rx="3.6" ry="4.2" fill={INK} />
      <ellipse cx="29.4" cy="24.6" rx="3.6" ry="4.2" fill={INK} />
      <circle cx="18.6" cy="24.6" r="1.3" fill="#fff" />
      <circle cx="29.4" cy="24.6" r="1.3" fill="#fff" />
      <ellipse cx="24" cy="30.4" rx="2.2" ry="1.6" fill={INK} />
      <path
        d="M21.4 33.6q2.6 2 5.2 0"
        stroke={INK}
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
    </>
  ),
  fox: (
    <>
      <path d="M12 14 16 5l7 6zM36 14 32 5l-7 6z" fill="#e8782f" />
      <path d="M24 12c7 0 11 5 11 11 0 6-5 11-11 11s-11-5-11-11c0-6 4-11 11-11z" fill="#f2914a" />
      <path d="M24 22c4.6 0 7 3.2 7 7 0 4-3.2 6.6-7 6.6S17 33 17 29c0-3.8 2.4-7 7-7z" fill="#fff6ee" />
      <circle cx="19.8" cy="23.6" r="1.5" fill={INK} />
      <circle cx="28.2" cy="23.6" r="1.5" fill={INK} />
      <ellipse cx="24" cy="29" rx="2.4" ry="1.8" fill={INK} />
    </>
  ),
  owl: (
    <>
      <path d="M24 10c8 0 13 6 13 14s-5 14-13 14-13-6-13-14 5-14 13-14z" fill="#8b79c4" />
      <path d="M13 14 18 9l3 5zM35 14 30 9l-3 5z" fill="#6f5daa" />
      <circle cx="18.8" cy="23" r="5.4" fill="#fff" />
      <circle cx="29.2" cy="23" r="5.4" fill="#fff" />
      <circle cx="18.8" cy="23" r="2.4" fill={INK} />
      <circle cx="29.2" cy="23" r="2.4" fill={INK} />
      <path d="M24 27 21 31h6z" fill="#ffb02e" />
      <path d="M17 34q7 4 14 0" stroke="#6f5daa" strokeWidth="1.6" fill="none" />
    </>
  ),
  penguin: (
    <>
      <ellipse cx="24" cy="26" rx="12" ry="14" fill={INK} />
      <ellipse cx="24" cy="29" rx="7.6" ry="10" fill="#fff" />
      <circle cx="20.4" cy="21" r="1.6" fill={INK} />
      <circle cx="27.6" cy="21" r="1.6" fill={INK} />
      <circle cx="20.4" cy="21" r="3.2" fill="#fff" />
      <circle cx="27.6" cy="21" r="3.2" fill="#fff" />
      <circle cx="20.4" cy="21.4" r="1.5" fill={INK} />
      <circle cx="27.6" cy="21.4" r="1.5" fill={INK} />
      <path d="M24 24 20.6 27h6.8z" fill="#ffa726" />
      <path d="M18 41h5l-2.4 3zM30 41h-5l2.4 3z" fill="#ffa726" />
    </>
  ),
  elephant: (
    <>
      <circle cx="24" cy="24" r="12" fill="#9aa8bd" />
      <ellipse cx="11.5" cy="22" rx="5" ry="7" fill="#8795ac" />
      <ellipse cx="36.5" cy="22" rx="5" ry="7" fill="#8795ac" />
      <path
        d="M24 32c3 0 4 3 2.6 6.4-1 2.4.6 4 2.4 3.4"
        stroke="#8795ac"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="19.6" cy="22.4" r="1.5" fill={INK} />
      <circle cx="28.4" cy="22.4" r="1.5" fill={INK} />
    </>
  ),
  turtle: (
    <>
      <ellipse cx="24" cy="28" rx="14" ry="9" fill="#7fc49a" />
      <path d="M24 19c6.6 0 11 4 11 9H13c0-5 4.4-9 11-9z" fill="#4e9d72" />
      <path
        d="M24 20v8M17 24.6l3-3.4M31 24.6l-3-3.4"
        stroke="#2f7a54"
        strokeWidth="1.3"
        fill="none"
      />
      <circle cx="36" cy="24" r="4.6" fill="#8fd3a8" />
      <circle cx="37.4" cy="23" r="1.2" fill={INK} />
      <path d="M13 36h4v4h-4zM31 36h4v4h-4z" fill="#8fd3a8" />
    </>
  ),
  dog: (
    <>
      <ellipse cx="12" cy="24" rx="4.6" ry="8" fill="#9c6b45" />
      <ellipse cx="36" cy="24" rx="4.6" ry="8" fill="#9c6b45" />
      <circle cx="24" cy="25" r="12" fill="#c58d5e" />
      <ellipse cx="24" cy="31" rx="7" ry="5.4" fill="#f0d8bf" />
      <circle cx="19.8" cy="22.6" r="1.5" fill={INK} />
      <circle cx="28.2" cy="22.6" r="1.5" fill={INK} />
      <ellipse cx="24" cy="29" rx="2.4" ry="1.8" fill={INK} />
      <path
        d="M24 31v2M21.6 34.4q2.4 1.8 4.8 0"
        stroke={INK}
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
      />
    </>
  ),

  // --------------------------------------------------------------- flowers
  tulip: (
    <>
      <Stem top={27} />
      <path d="M24 8c5 3 8 7 8 12 0 4-3.6 7-8 7s-8-3-8-7c0-5 3-9 8-12z" fill="#ef5e86" />
      <path d="M24 8c-2.6 3.4-3.6 7.6-3.6 12 0 3.4.8 5.8 2 7-3.4-.8-6.4-3.6-6.4-7 0-5 3-9 8-12z" fill="#ff85a6" />
      <path d="M24 9v16" stroke="#d63c6a" strokeWidth="1.2" />
    </>
  ),
  sunflower: (
    <>
      <Stem top={30} />
      <g fill="#ffc23d">
        <circle cx="24" cy="9.5" r="4" />
        <circle cx="24" cy="30.5" r="4" />
        <circle cx="13.5" cy="20" r="4" />
        <circle cx="34.5" cy="20" r="4" />
        <circle cx="16.6" cy="12.6" r="4" />
        <circle cx="31.4" cy="12.6" r="4" />
        <circle cx="16.6" cy="27.4" r="4" />
        <circle cx="31.4" cy="27.4" r="4" />
      </g>
      <circle cx="24" cy="20" r="7.4" fill="#7b4a1e" />
      <circle cx="24" cy="20" r="4.4" fill="#5e3614" />
    </>
  ),
  daisy: (
    <>
      <Stem top={29} />
      <g fill="#ffffff" stroke="#e7eef7" strokeWidth="0.8">
        <ellipse cx="24" cy="10.5" rx="3.4" ry="5" />
        <ellipse cx="24" cy="29.5" rx="3.4" ry="5" />
        <ellipse cx="14.5" cy="20" rx="5" ry="3.4" />
        <ellipse cx="33.5" cy="20" rx="5" ry="3.4" />
        <ellipse cx="17.2" cy="13.2" rx="4.4" ry="3.2" transform="rotate(-45 17.2 13.2)" />
        <ellipse cx="30.8" cy="13.2" rx="4.4" ry="3.2" transform="rotate(45 30.8 13.2)" />
        <ellipse cx="17.2" cy="26.8" rx="4.4" ry="3.2" transform="rotate(45 17.2 26.8)" />
        <ellipse cx="30.8" cy="26.8" rx="4.4" ry="3.2" transform="rotate(-45 30.8 26.8)" />
      </g>
      <circle cx="24" cy="20" r="5.4" fill="#ffc83d" />
    </>
  ),
  rose: (
    <>
      <Stem top={29} />
      <circle cx="24" cy="19" r="11" fill="#e8456a" />
      <path d="M24 19c0-4 3-6.4 6.6-5.6-1 4.6-3.4 7.6-6.6 5.6z" fill="#f4718c" />
      <path d="M24 19c-4 0-6.4-3-5.6-6.6 4.6 1 7.6 3.4 5.6 6.6z" fill="#f4718c" />
      <circle cx="24" cy="19" r="5.6" fill="#c42f53" />
      <circle cx="24" cy="19" r="2.4" fill="#f4718c" />
    </>
  ),
  lotus: (
    <>
      <path d="M24 10c3.4 3.4 5 7.4 5 11.4H19c0-4 1.6-8 5-11.4z" fill="#f094c6" />
      <path d="M14 13c3.8 1.8 6.2 5 7.2 8.4l-8.6 2.4C11.2 20.2 11.6 16.4 14 13z" fill="#e775b3" />
      <path d="M34 13c-3.8 1.8-6.2 5-7.2 8.4l8.6 2.4c1.4-3.6 1-7.4-1.4-10.8z" fill="#e775b3" />
      <path d="M12 26h24c0 5-5.4 9-12 9s-12-4-12-9z" fill="#d85ba3" />
      <path d="M14 38h20" stroke="#5fb8d6" strokeWidth="2.4" strokeLinecap="round" />
    </>
  ),
  cactus: (
    <>
      <rect x="20" y="16" width="8" height="24" rx="4" fill="#4fa772" />
      <path d="M20 26h-3a4 4 0 0 1-4-4v-2a2 2 0 0 1 4 0v1a1 1 0 0 0 1 1h2z" fill="#58b980" />
      <path d="M28 30h3a4 4 0 0 0 4-4v-3a2 2 0 0 0-4 0v2a1 1 0 0 1-1 1h-2z" fill="#58b980" />
      <circle cx="24" cy="13.5" r="4.4" fill="#ff6f91" />
      <circle cx="24" cy="13.5" r="1.8" fill="#ffd0dc" />
      <path d="M14 40h20v3H14z" fill="#d9a56b" />
    </>
  ),
  bluebell: (
    <>
      <path d="M24 40V14" stroke="#3f9d5c" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M24 22c-5 0-7.6-2-8-5.6 3.6-.6 6.6 1 8 5.6z" fill="#4fb36c" />
      <g fill="#5a7ce0">
        <path d="M17 13c0 3.4 1.6 6 3.6 6s3.6-2.6 3.6-6z" />
        <path d="M24.8 18c0 3.4 1.6 6 3.6 6s3.6-2.6 3.6-6z" />
        <path d="M18.6 26c0 3.4 1.6 6 3.6 6s3.6-2.6 3.6-6z" />
      </g>
      <g fill="#8aa3f0">
        <circle cx="20.6" cy="12.6" r="1.6" />
        <circle cx="28.4" cy="17.6" r="1.6" />
        <circle cx="22.2" cy="25.6" r="1.6" />
      </g>
    </>
  ),

  // ------------------------------------------------------------------ cars
  racer: (
    <>
      <path d="M8 30h32l-4-7H12z" fill="#e23b3b" />
      <path d="M14 23h20l-3-5H17z" fill="#ff6b5e" />
      <path d="M18.6 22h10.8l-1.8-3h-7.2z" fill="#cfe9ff" />
      <rect x="7" y="29" width="34" height="4" rx="2" fill="#b32a2a" />
      <Wheels y={35} left={15} right={33} />
      <path d="M10 26h3v2h-3z" fill="#ffd54d" />
    </>
  ),
  taxi: (
    <>
      <path d="M9 31h30l-3-8H12z" fill="#ffc62e" />
      <path d="M13.6 23h20.8l-2.2-5H15.8z" fill="#ffd85e" />
      <path d="M17 22h5.6v-3.4h-4.4zM25.4 22H31l-1.4-3.4h-4.2z" fill="#cfe9ff" />
      <rect x="8" y="30" width="32" height="4" rx="2" fill="#e8a800" />
      <rect x="20" y="12.4" width="8" height="4" rx="1.4" fill="#2a3550" />
      <Wheels y={36} left={16} right={32} />
    </>
  ),
  bus: (
    <>
      <rect x="8" y="14" width="32" height="20" rx="4" fill="#3aa06b" />
      <rect x="11" y="18" width="7" height="6" rx="1.4" fill="#cfe9ff" />
      <rect x="20.5" y="18" width="7" height="6" rx="1.4" fill="#cfe9ff" />
      <rect x="30" y="18" width="7" height="6" rx="1.4" fill="#cfe9ff" />
      <rect x="8" y="27" width="32" height="3" fill="#2d8457" />
      <circle cx="37.4" cy="16.6" r="1.4" fill="#ffd54d" />
      <Wheels y={36} left={15} right={33} />
    </>
  ),
  pickup: (
    <>
      <path d="M8 31h14V20h5l5 6h8v5z" fill="#4a7fd4" />
      <path d="M23.4 21.6h3.2l3.4 4.2h-6.6z" fill="#cfe9ff" />
      <rect x="7" y="30" width="34" height="4" rx="2" fill="#3867b4" />
      <path d="M9 23h11v2H9z" fill="#5f93e3" />
      <Wheels y={36} left={15} right={33} />
    </>
  ),
  convertible: (
    <>
      <path d="M8 31h32v-4H8z" fill="#2fb1c4" />
      <path d="M11 27h26c-1.6-5-6.6-7.6-13-7.6S12.6 22 11 27z" fill="#3ec9dd" />
      <path d="M18 26c1-3 3.4-4.4 6-4.4s5 1.4 6 4.4z" fill="#cfe9ff" />
      <path d="M12 19.6 15 15h3l-1.6 4.6z" fill="#e9f6fb" />
      <Wheels y={35} left={15} right={33} />
    </>
  ),
  van: (
    <>
      <rect x="9" y="16" width="30" height="17" rx="4" fill="#ef7fb4" />
      <path d="M9 24h30v3H9z" fill="#fff" />
      <rect x="12" y="19" width="8" height="4.4" rx="1.2" fill="#cfe9ff" />
      <rect x="27" y="19" width="9" height="4.4" rx="1.2" fill="#cfe9ff" />
      <path d="M17 12h14l-2 4H19z" fill="#d9609a" />
      <Wheels y={35} left={16} right={32} />
    </>
  ),
  scooter: (
    <>
      <circle cx="13" cy="33" r="6" fill={INK} />
      <circle cx="13" cy="33" r="2.4" fill="#cfd8e8" />
      <circle cx="35" cy="33" r="6" fill={INK} />
      <circle cx="35" cy="33" r="2.4" fill="#cfd8e8" />
      <path d="M13 33h8l4-10h6v10h4" stroke="#ff8a3d" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <path d="M22 22h8v5h-8z" fill="#ffab6b" />
      <path d="M30 14h4v3h-4z" fill={INK} />
      <path d="M31.4 17v6" stroke={INK} strokeWidth="2" />
    </>
  ),

  // ---------------------------------------------------------------- people
  doctor: (
    <>
      <Bust coat="#ffffff" collar="#dff1ff" />
      <path d="M15 22c0-6 4-9.6 9-9.6s9 3.6 9 9.6c-1.6-3.4-4.8-5-9-5s-7.4 1.6-9 5z" fill="#3a4a66" />
      <Face />
      <path d="M22.6 40h2.8v8h-2.8zM19 42.6h10v2.8H19z" fill="#e8465c" />
      <circle cx="30.4" cy="40.6" r="2.4" fill="#9fb4cf" />
    </>
  ),
  soldier: (
    <>
      <Bust coat="#6f7f52" collar="#5c6b43" />
      <Face />
      <path d="M13.6 20c0-6.4 4.6-10 10.4-10s10.4 3.6 10.4 10z" fill="#55653c" />
      <path d="M11.6 20h24.8v3H11.6z" fill="#49582f" />
      <path d="M24 12.6l1.4 3h-2.8z" fill="#ffd54d" />
      <path d="M18 41h12v2.4H18z" fill="#4e5c35" />
      <circle cx="20.4" cy="45" r="1.1" fill="#ffd54d" />
      <circle cx="23.4" cy="45" r="1.1" fill="#ffd54d" />
    </>
  ),
  girl: (
    <>
      <path d="M11 34c0-10 4-18 13-18s13 8 13 18c-2-2-4-10-13-10s-11 8-13 10z" fill="#5a3a22" />
      <Bust coat="#f06292" collar="#e14b7f" />
      <Face />
      <path d="M12.6 20c0-6.6 5-10.6 11.4-10.6S35.4 13.4 35.4 20c-2.4-4-6.6-6-11.4-6s-9 2-11.4 6z" fill="#5a3a22" />
      <circle cx="13.8" cy="27" r="3.6" fill="#5a3a22" />
      <circle cx="34.2" cy="27" r="3.6" fill="#5a3a22" />
      <circle cx="33" cy="15.6" r="2.6" fill="#ffd54d" />
    </>
  ),
  boy: (
    <>
      <Bust coat="#4a7fd4" collar="#3867b4" />
      <Face />
      <path d="M14.4 19.6c0-6 4.2-9.6 9.6-9.6s9.6 3.6 9.6 9.6c-2.2-3-5.6-4.6-9.6-4.6s-7.4 1.6-9.6 4.6z" fill="#3a2a1c" />
      <path d="M19 42h10v2.6H19z" fill="#3867b4" />
    </>
  ),
  chef: (
    <>
      <Bust coat="#ffffff" collar="#f3f6fb" />
      <Face />
      <path d="M15.4 18.4h17.2V15c2.6 0 4-1.8 4-4s-2-3.8-4.4-3.4C31.6 5.6 28.2 4.6 24 4.6s-7.6 1-8.2 3C13.4 7.2 11.4 8.6 11.4 11s1.4 4 4 4z" fill="#ffffff" stroke="#e3eaf4" strokeWidth="0.9" />
      <path d="M15.4 18.4h17.2v3H15.4z" fill="#e8465c" />
      <circle cx="24" cy="41" r="1.3" fill="#c9d4e4" />
      <circle cx="24" cy="45" r="1.3" fill="#c9d4e4" />
    </>
  ),
  astronaut: (
    <>
      <Bust coat="#e8edf7" collar="#cfd8e8" />
      <circle cx="24" cy="22" r="12" fill="#ffffff" stroke="#c6d2e4" strokeWidth="1.6" />
      <circle cx="24" cy="23" r="8.6" fill={SKIN} />
      <Face y={23} />
      <path
        d="M24 10.4c6.6 0 12 5.2 12 11.6H12c0-6.4 5.4-11.6 12-11.6z"
        fill="#3b5e9c"
      />
      <path
        d="M16.6 18.6c1.4-2.8 4-4.6 7.4-4.8"
        stroke="#9dc2f2"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="10.4" y="20.4" width="3.6" height="5.6" rx="1.6" fill="#c6d2e4" />
      <rect x="34" y="20.4" width="3.6" height="5.6" rx="1.6" fill="#c6d2e4" />
      <circle cx="24" cy="41.6" r="2" fill="#e8465c" />
    </>
  ),
  firefighter: (
    <>
      <Bust coat="#e8584a" collar="#ffd54d" />
      <Face />
      <path d="M12.6 21c0-6.6 5-10.4 11.4-10.4S35.4 14.4 35.4 21z" fill="#c2342a" />
      <path d="M10.6 21h26.8v3.2H10.6z" fill="#a8261e" />
      <path d="M24 12.4c1.6 1.4 2.4 3.2 2.4 5h-4.8c0-1.8.8-3.6 2.4-5z" fill="#ffd54d" />
      <path d="M18 41h12v2.6H18z" fill="#ffd54d" />
    </>
  ),
}

/**
 * One character, drawn at whatever size the caller asks for.
 *
 * `title` is off by default: the name is almost always already beside it, and
 * a tooltip on every token in a leaderboard is noise.
 */
export function Avatar({
  id,
  size = 32,
  showTitle = false,
  className,
}: {
  id: string | undefined | null
  size?: number
  showTitle?: boolean
  className?: string
}) {
  const def = avatarById(id)
  // One id per instance. A single shared id would be resolved from whichever
  // copy happens to be first in the document, and break when that one goes.
  const clipId = `avatar-disc-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className ? `avatar ${className}` : 'avatar'}
      role="img"
      aria-label={def.name}
    >
      {showTitle && <title>{def.name}</title>}
      <circle cx="24" cy="24" r="24" fill={def.tint} />
      {/* Clipped to the disc, so a hat or a wheel cannot run off the edge. */}
      <g clipPath={`url(#${clipId})`}>{ART[def.id] ?? ART.cat}</g>
      <defs>
        <clipPath id={clipId}>
          <circle cx="24" cy="24" r="24" />
        </clipPath>
      </defs>
    </svg>
  )
}
