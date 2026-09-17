/**
 * The middle of the board.
 *
 * Still deliberately almost empty: this is where the dice sit, and where a
 * property or event card opens when someone lands on something. A decorative
 * globe used to live here and it left no room for either.
 *
 * What it has now is a wordmark and a pattern faint enough to read as paper
 * texture rather than content — a dotted world and a skyline at well under a
 * tenth opacity. Nothing here must ever compete with the dice.
 */

/** One letter per colour, warm on the left running to cool on the right. */
export const WORDMARK: [string, string][] = [
  ['B', '#ff8f8f'],
  ['U', '#ffb27a'],
  ['S', '#ffd16a'],
  ['I', '#8dd5a6'],
  ['N', '#71c8c7'],
  ['E', '#8abaf5'],
  ['S', '#719bef'],
  ['S', '#9a91f3'],
]

export function BoardCentre() {
  return (
    <>
      <CentrePattern />
      <div className="centrepiece" aria-hidden="true">
        <Wordmark className="centre-wordmark" />
      </div>
    </>
  )
}

/**
 * BUSINESS, a colour per letter. One component, so the board's centre and the
 * phone's header can never drift into two different palettes.
 */
export function Wordmark({ className }: { className: string }) {
  return (
    <div className={className}>
      {WORDMARK.map(([letter, colour], i) => (
        <span key={i} style={{ color: colour }}>
          {letter}
        </span>
      ))}
    </div>
  )
}

/**
 * The faint background. Drawn rather than tiled so the skyline can sit on the
 * floor of the centre panel and the dots can thin out towards it.
 */
function CentrePattern() {
  return (
    <svg
      className="centre-pattern"
      viewBox="0 0 400 260"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <g className="centre-dots">
        {DOTS.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} />
        ))}
      </g>
      {/* A horizon, and a skyline standing on it. */}
      <g className="centre-skyline">
        <path d={SKYLINE} />
      </g>
    </svg>
  )
}

/**
 * A dotted world: coarse continents, placed by hand. Not a map anybody should
 * be able to read — at this opacity it is texture.
 */
const DOTS: [number, number, number][] = (() => {
  const blobs: [number, number, number, number][] = [
    // x, y, width, height of each rough landmass
    [34, 54, 62, 46], // north america
    [74, 118, 34, 54], // south america
    [150, 52, 46, 40], // europe
    [156, 100, 52, 62], // africa
    [214, 44, 96, 58], // asia
    [286, 132, 40, 26], // australia
  ]
  const out: [number, number, number][] = []
  for (const [bx, by, bw, bh] of blobs) {
    for (let x = bx; x < bx + bw; x += 9) {
      for (let y = by; y < by + bh; y += 9) {
        // A soft elliptical edge, so the blobs read as land rather than boxes.
        const dx = (x - (bx + bw / 2)) / (bw / 2)
        const dy = (y - (by + bh / 2)) / (bh / 2)
        if (dx * dx + dy * dy <= 1) out.push([x, y, 1.7])
      }
    }
  }
  return out
})()

/** A city skyline along the bottom edge, in one path. */
const SKYLINE = [
  'M0 260 V236 h18 v-16 h14 v16 h10 v-30 h16 v30 h12 v-20 h20 v20 h10 v-44 h14 v44',
  'h12 v-24 h18 v24 h10 v-34 h16 v34 h12 v-18 h20 v18 h10 v-40 h14 v40 h12 v-22 h18 v22',
  'h10 v-30 h16 v30 h12 v-16 h20 v16 h10 v-38 h14 v38 h12 v-20 h18 v20 h14 V260 Z',
].join(' ')
