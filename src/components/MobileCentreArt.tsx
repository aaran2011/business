/**
 * The phone board's centre backdrop: a pale world above, a city along the
 * foot, trees in the two bottom corners.
 *
 * Atmosphere only, and deliberately faint — the world at 7%, the city at 13%.
 * It sits behind the dice and the property cards and must never be the first
 * thing the eye lands on. Drawn once as a single SVG, no images, so it costs
 * nothing to load and works offline.
 *
 * Phone only. The square board keeps its own, quieter centre.
 */
export function MobileCentreArt() {
  return (
    <svg
      className="mcentre-art"
      viewBox="0 0 240 390"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="mca-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#f5faff" />
          <stop offset="1" stopColor="#e4f0fd" />
        </linearGradient>
        <linearGradient id="mca-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cfeadf" />
          <stop offset="1" stopColor="#b9e2d0" />
        </linearGradient>
      </defs>

      <rect width="240" height="390" fill="url(#mca-sky)" />

      {/* The world: rough continents, never a map anyone should read. */}
      <g className="mca-world">
        {/* North America */}
        <path d="M18 52c8-10 26-14 40-10 10 3 20 1 26 8 4 5-2 11-8 14-7 3-9 10-15 14-6 4-12 3-16 9-3 5-9 5-12 0-3-6-9-9-12-15-3-7-7-13-3-20z" />
        {/* South America */}
        <path d="M60 96c7-2 14 2 17 8 3 7 1 14-2 20-3 7-5 15-9 21-3 4-8 3-9-2-2-8-1-16-4-23-2-7 0-21 7-24z" />
        {/* Europe */}
        <path d="M110 50c6-4 14-4 20-1 5 3 4 9-1 11-5 2-8 6-13 6-5 0-9-3-10-8-1-3 1-6 4-8z" />
        {/* Africa */}
        <path d="M112 74c9-4 22-3 29 3 5 5 4 12 1 18-3 7-4 15-9 21-4 5-10 5-12-1-2-7-4-13-8-19-4-6-9-17-1-22z" />
        {/* Asia */}
        <path d="M134 44c14-8 34-9 50-6 13 3 26 5 33 13 5 6-1 12-8 14-8 2-13 8-21 10-8 2-15 0-22 4-7 3-13 1-17-5-4-5-12-8-16-14-3-6-5-12 1-16z" />
        {/* Australia */}
        <path d="M184 116c7-4 17-3 23 1 4 3 3 9-1 12-5 3-12 4-18 2-5-2-9-5-8-9 0-3 1-5 4-6z" />
      </g>

      {/* A couple of soft clouds. */}
      <g className="mca-clouds">
        <ellipse cx="44" cy="170" rx="22" ry="7" />
        <ellipse cx="58" cy="165" rx="14" ry="8" />
        <ellipse cx="196" cy="150" rx="20" ry="6" />
        <ellipse cx="208" cy="146" rx="12" ry="7" />
      </g>

      {/* The city, standing on the ground line. */}
      <g className="mca-city">
        {/* A lattice tower */}
        <path d="M38 212l2 0 2 26 4 32 9 88h-6l-4-26h-12l-4 26h-6l9-88 4-32z" />
        <rect x="30" y="268" width="20" height="3" />
        <rect x="26" y="306" width="28" height="3" />
        {/* A big wheel */}
        <circle cx="80" cy="318" r="27" fill="none" strokeWidth="2.2" />
        <circle cx="80" cy="318" r="3" />
        <path
          d="M80 291v54M53 318h54M61 299l38 38M61 337l38-38"
          fill="none"
          strokeWidth="1.1"
        />
        <path d="M80 318l-12 42h4l8-30 8 30h4z" />
        {/* Towers, left to right */}
        <rect x="100" y="290" width="16" height="72" />
        <rect x="118" y="258" width="14" height="104" />
        <rect x="121" y="248" width="8" height="10" />
        <rect x="134" y="300" width="18" height="62" />
        {/* A dome */}
        <path d="M154 330a14 14 0 0 1 28 0v32h-28z" />
        <rect x="166" y="308" width="4" height="10" />
        {/* A tall spire */}
        <path d="M200 196l2 0 1 30h3v20h4v24h5v92h-28v-92h5v-24h4v-20h3z" />
        <rect x="184" y="286" width="12" height="76" />
        <rect x="218" y="276" width="18" height="86" />
        <rect x="222" y="266" width="10" height="10" />
      </g>

      {/* Ground, and trees in the two bottom corners. */}
      <path className="mca-ground" d="M0 356c40-10 80-8 120-3s80 6 120-4v41H0z" />
      <g className="mca-trees">
        <circle cx="10" cy="350" r="13" />
        <circle cx="24" cy="356" r="11" />
        <circle cx="4" cy="366" r="10" />
        <circle cx="230" cy="346" r="14" />
        <circle cx="216" cy="355" r="11" />
        <circle cx="238" cy="364" r="10" />
      </g>
    </svg>
  )
}
