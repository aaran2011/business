import type { ReactElement, ReactNode } from 'react'

/**
 * ============================================================================
 * SPACE ICONS — one drawn set for every space that is not a country.
 * ============================================================================
 *
 * Countries keep their flag emoji: a flag has to be accurate, and the emoji
 * one IS the accurate one. Everything else used to be an emoji too, which
 * meant fourteen icons from fourteen different design languages sitting next
 * to each other — a flat luggage pictogram beside a glossy ship beside a
 * cartoon party popper. They are drawn here instead, all on the same 24x24
 * grid, in the same flat two-tone style, at the same optical weight.
 *
 * This is PRESENTATION ONLY. The emoji in src/data are untouched and still
 * the fallback: an id with no drawing here renders whatever the data says.
 * Nothing about what a space DOES is decided in this file.
 */

const B = '#3D7DFF' // blue, the transport/utility family
const BD = '#2B62D6' // its darker tone
const BL = '#CFE2FF' // its pale fill
const R = '#F0435C' // red
const RL = '#FFD5DB'
const A = '#FFB020' // amber
const AL = '#FFE6B5'
const G = '#17B978' // green
const S = '#56688A' // slate, for anything that should stay quiet

/** Every icon is drawn inside this, so they cannot drift apart. */
function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="space-glyph" aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

const ICONS: Record<string, () => ReactElement> = {
  // ------------------------------------------------------------ the decks --
  chance: () => (
    <Glyph>
      <path
        d="M8.4 9a3.6 3.6 0 1 1 5 3.3c-1 .5-1.5 1.2-1.5 2.2v.6"
        fill="none"
        stroke={R}
        strokeWidth="2.7"
        strokeLinecap="round"
      />
      <circle cx="11.9" cy="18.6" r="1.7" fill={R} />
    </Glyph>
  ),

  uno: () => (
    <Glyph>
      {/* Two cards, one behind the other. */}
      <rect x="4.2" y="6" width="9" height="12.6" rx="2" fill={BL} transform="rotate(-12 8.7 12.3)" />
      <rect
        x="10.6"
        y="4.8"
        width="9.2"
        height="13"
        rx="2"
        fill="#fff"
        stroke={B}
        strokeWidth="1.7"
      />
      <circle cx="15.2" cy="11.3" r="2.5" fill={A} />
    </Glyph>
  ),

  // ------------------------------------------------------------- the dues --
  customDuty: () => (
    <Glyph>
      <rect x="4.6" y="3.4" width="12.4" height="17.2" rx="2.2" fill="#fff" stroke={B} strokeWidth="1.7" />
      <path d="M7.6 8h6.2M7.6 11.2h6.2M7.6 14.4h3.6" stroke={BL} strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="16.8" cy="16.4" r="4.1" fill={A} stroke="#fff" strokeWidth="1.5" />
      <path d="M15.1 16.5l1.3 1.3 2.2-2.4" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </Glyph>
  ),

  travellingDuty: () => (
    <Glyph>
      <path d="M9.2 5.4V4.2a1.6 1.6 0 0 1 1.6-1.6h2.4a1.6 1.6 0 0 1 1.6 1.6v1.2" fill="none" stroke={BD} strokeWidth="1.8" strokeLinecap="round" />
      <rect x="3.2" y="5.6" width="17.6" height="13.4" rx="2.6" fill={BL} stroke={B} strokeWidth="1.6" />
      <path d="M9.4 5.6v13.4M14.6 5.6v13.4" stroke={B} strokeWidth="1.5" />
    </Glyph>
  ),

  // -------------------------------------------------------- the transport --
  airways: () => (
    <Glyph>
      <path
        d="M2.6 13.4l18.6-6.8a1.3 1.3 0 0 1 1.6 1.7l-2.5 6.1a2 2 0 0 1-1.2 1.1l-4.4 1.5-2.5 3.4a.8.8 0 0 1-1.4-.4l-.4-3.2-4.2-1.4c-.9-.3-.9-1.6 0-2z"
        fill={B}
      />
      <path d="M10.4 16.8l6.6-6.1" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
    </Glyph>
  ),

  roadways: () => (
    <Glyph>
      <path d="M3 15.2l1.4-4a3 3 0 0 1 2.8-2h9.6a3 3 0 0 1 2.8 2l1.4 4z" fill={BL} />
      <rect x="2.6" y="14.4" width="18.8" height="4.6" rx="1.8" fill={B} />
      <circle cx="7.1" cy="19.2" r="2" fill={BD} />
      <circle cx="16.9" cy="19.2" r="2" fill={BD} />
      <path d="M12 9.2v6" stroke="#fff" strokeWidth="1.4" />
    </Glyph>
  ),

  railways: () => (
    <Glyph>
      <rect x="5.4" y="3.6" width="13.2" height="13.4" rx="3" fill={BL} stroke={B} strokeWidth="1.6" />
      <rect x="8" y="6.6" width="8" height="4.4" rx="1.2" fill="#fff" />
      <path d="M6.2 17v1.4M17.8 17v1.4" stroke={B} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="8.4" cy="19.6" r="1.7" fill={BD} />
      <circle cx="15.6" cy="19.6" r="1.7" fill={BD} />
      <path d="M3.4 20.8h3M17.6 20.8h3" stroke={B} strokeWidth="1.6" strokeLinecap="round" />
    </Glyph>
  ),

  waterways: () => (
    <Glyph>
      <path d="M12 3.4v5.4M12 5.2h4.6l-1.6 2 1.6 2H12" fill={A} stroke={A} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M4.4 11.6h15.2l-1.9 5.2a2.4 2.4 0 0 1-2.2 1.5H8.5a2.4 2.4 0 0 1-2.2-1.5z" fill={B} />
      <path d="M2.6 19.4c1.5 0 1.5 1.4 3 1.4s1.5-1.4 3-1.4 1.5 1.4 3 1.4 1.5-1.4 3-1.4 1.5 1.4 3 1.4 1.5-1.4 3-1.4" fill="none" stroke={BL} strokeWidth="1.7" strokeLinecap="round" />
    </Glyph>
  ),

  satellite: () => (
    <Glyph>
      <rect x="10.2" y="8.4" width="5.2" height="7.2" rx="1.2" fill={BD} transform="rotate(-45 12.8 12)" />
      <rect x="2.6" y="7.2" width="6" height="5.2" rx="1" fill={BL} stroke={B} strokeWidth="1.4" transform="rotate(-45 5.6 9.8)" />
      <rect x="15.4" y="11.6" width="6" height="5.2" rx="1" fill={BL} stroke={B} strokeWidth="1.4" transform="rotate(-45 18.4 14.2)" />
      <path d="M15.4 4.2a4.6 4.6 0 0 1 4.4 4.4" fill="none" stroke={A} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15.2 1.6a7.2 7.2 0 0 1 7 7" fill="none" stroke={AL} strokeWidth="1.6" strokeLinecap="round" />
    </Glyph>
  ),

  petroleum: () => (
    <Glyph>
      <rect x="5.6" y="3.6" width="12.8" height="17" rx="3" fill={R} />
      <path d="M5.6 8.8h12.8M5.6 15.4h12.8" stroke={RL} strokeWidth="1.8" />
      <path d="M12 5.6c1.9 2 2.9 3.4 2.9 4.5a2.9 2.9 0 1 1-5.8 0c0-1.1 1-2.5 2.9-4.5z" fill="#fff" opacity="0.92" />
    </Glyph>
  ),

  // --------------------------------------------------------- the corners --
  partyHouse: () => (
    <Glyph>
      <path d="M3.2 20.8l4.6-11.2 6.6 6.6z" fill={R} />
      <path d="M3.2 20.8l2.1-5.1 3.1 3.1z" fill="#fff" opacity="0.35" />
      <circle cx="17.4" cy="5.6" r="1.5" fill={A} />
      <circle cx="20.6" cy="10.4" r="1.2" fill={G} />
      <circle cx="12.6" cy="4.2" r="1.2" fill={B} />
      <path d="M16.2 13.6l1.8-1M13.4 8.8l1-1.8" stroke={A} strokeWidth="1.5" strokeLinecap="round" />
    </Glyph>
  ),

  resort: () => (
    <Glyph>
      <path d="M3.6 11.4c1-4.4 5-7.2 9.2-6.6 4.2.6 7.2 4 7.6 8.2z" fill={R} />
      <path d="M8 10.9c.3-3.6 1.6-6.1 3.1-6.1s2.5 2.3 2.9 6z" fill="#fff" opacity="0.5" />
      <path d="M12.4 11.4V20" stroke={S} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M2.6 20.6c1.6 0 1.6-1.3 3.2-1.3s1.6 1.3 3.2 1.3 1.6-1.3 3.2-1.3 1.6 1.3 3.2 1.3 1.6-1.3 3.2-1.3 1.6 1.3 3.2 1.3" fill="none" stroke={BL} strokeWidth="1.6" strokeLinecap="round" />
    </Glyph>
  ),

  jail: () => (
    <Glyph>
      {/* A barred window and a padlock. Deliberately nobody inside it. */}
      <path d="M4.6 10.6a7.4 7.4 0 0 1 14.8 0v9.2H4.6z" fill={BL} stroke={BD} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8.5 5.4v14.4M12 4.2v15.6M15.5 5.4v14.4" stroke={BD} strokeWidth="1.6" strokeLinecap="round" />
      <rect x="8.6" y="14.6" width="6.8" height="6" rx="1.6" fill={A} stroke="#fff" strokeWidth="1.3" />
      <path d="M10.3 14.6v-1.4a1.7 1.7 0 0 1 3.4 0v1.4" fill="none" stroke={A} strokeWidth="1.5" />
    </Glyph>
  ),

  start: () => (
    <Glyph>
      <path d="M5.4 3.4v17.2" stroke={S} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7 4.2h12.4v8.4H7z" fill="#fff" stroke={S} strokeWidth="1.3" />
      <path d="M7 4.2h3.1v2.8H7zM13.2 4.2h3.1v2.8h-3.1zM10.1 7h3.1v2.8h-3.1zM16.3 7h3.1v2.8h-3.1zM7 9.8h3.1v2.8H7zM13.2 9.8h3.1v2.8h-3.1z" fill={S} />
    </Glyph>
  ),
}

/**
 * The drawing for a space, or null when there is none — the caller then falls
 * back to whatever icon the data carries.
 */
export function SpaceIcon({ name }: { name: string }) {
  const draw = ICONS[name]
  return draw ? draw() : null
}

export function hasSpaceIcon(name: string): boolean {
  return name in ICONS
}
