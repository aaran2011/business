/**
 * Houses and hotels drawn in the owning player's colour, so a glance at the
 * board shows who built what and how much.
 */

export function HouseIcon({ colour, title }: { colour: string; title?: string }) {
  return (
    <svg className="building-icon" viewBox="0 0 24 24" role="img" aria-label={title ?? 'House'}>
      <path
        d="M12 2.4 23 11.2H1z"
        fill={colour}
        stroke="#ffffff"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <rect
        x="4.6"
        y="10.6"
        width="14.8"
        height="11"
        rx="1.4"
        fill={colour}
        stroke="#ffffff"
        strokeWidth="1.7"
      />
      <rect x="9.9" y="14.6" width="4.2" height="7" rx="0.8" fill="#ffffff" fillOpacity="0.9" />
    </svg>
  )
}

export function HotelIcon({ colour, title }: { colour: string; title?: string }) {
  return (
    <svg
      className="building-icon building-icon--hotel"
      viewBox="0 0 34 24"
      role="img"
      aria-label={title ?? 'Hotel'}
    >
      <rect
        x="1.5"
        y="4.5"
        width="31"
        height="17.5"
        rx="2"
        fill={colour}
        stroke="#ffffff"
        strokeWidth="1.7"
      />
      <path
        d="M1.5 6.5 17 1.2 32.5 6.5"
        fill={colour}
        stroke="#ffffff"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <g fill="#ffffff" fillOpacity="0.92">
        <rect x="5.4" y="9.4" width="4" height="4" rx="0.7" />
        <rect x="12" y="9.4" width="4" height="4" rx="0.7" />
        <rect x="18.6" y="9.4" width="4" height="4" rx="0.7" />
        <rect x="25.2" y="9.4" width="4" height="4" rx="0.7" />
        <rect x="14.4" y="16" width="5.2" height="6" rx="0.8" />
      </g>
    </svg>
  )
}

/** The full set of buildings standing on one property. */
export function BuildingRow({ level, colour }: { level: number; colour: string }) {
  if (level <= 0) return null
  if (level >= 4) return <HotelIcon colour={colour} />
  return (
    <>
      {Array.from({ length: level }, (_, i) => (
        <HouseIcon key={i} colour={colour} />
      ))}
    </>
  )
}
