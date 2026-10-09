import { useId, type JSX } from 'react'
import { avatarById } from '../data/avatars'

/**
 * The characters, drawn.
 *
 * No image files, no web font, no CDN — every one is vector shapes in a 48x48
 * box, so the game still opens with no internet and the bundle does not grow
 * by a picture.
 *
 * They were flat cartoons at first and he rejected them: "they look too
 * animated and very weird, make them very realistic. Do not use real images,
 * but make them look real." So the whole set was redrawn to the rules below,
 * and anything new has to follow them or it will not sit with the rest:
 *
 *   * ONE LIGHT SOURCE, upper left. Every form carries a highlight on its
 *     upper left and a shadow on its lower right. That, more than detail, is
 *     what stops a shape reading as a sticker.
 *   * VOLUME WITH GRADIENTS, not flat fills. Round things get a radial
 *     gradient offset towards the light; long things get a linear one.
 *   * REAL EYES. A white, an iris with a darker rim, a pupil, a specular
 *     highlight and an eyelid line over the top. Two black dots is the single
 *     thing that made the old set look like clip art.
 *   * HONEST PROPORTIONS. Heads are ovals rather than circles, muzzles come
 *     forward, wheels are the same size as each other.
 *   * NO OUTLINES. Edges come from tone meeting tone.
 *
 * Gradient and pattern ids are suffixed per instance (`u`), because ids are
 * global to the document: a shared one is resolved from whichever copy happens
 * to be first and breaks the moment that copy unmounts.
 *
 * There are people here — an army officer, a doctor, a girl, a boy — because
 * he asked for them in the gallery. That does not change the rule about the
 * BOARD: there is still no person anywhere in the board's artwork, and Jail is
 * still bars and a padlock.
 */

const DARK = '#2b2b33'

// ---------------------------------------------------------------------------
// SHARED PARTS
// ---------------------------------------------------------------------------

/**
 * An eye that looks like an eye.
 *
 * `slit` gives a cat its vertical pupil. `lid` is the upper eyelid, drawn as a
 * thick arc of the surrounding colour — it is what makes a face look awake
 * rather than startled.
 */
function Eye({
  cx,
  cy,
  r = 2.3,
  iris = '#6b4a2a',
  slit = false,
  lid = '#000',
  lidOpacity = 0.55,
}: {
  cx: number
  cy: number
  r?: number
  iris?: string
  slit?: boolean
  lid?: string | null
  lidOpacity?: number
}) {
  return (
    <>
      <ellipse cx={cx} cy={cy} rx={r * 1.08} ry={r} fill="#f7f4f0" />
      <ellipse cx={cx} cy={cy} rx={r * 1.08} ry={r} fill="#000" opacity="0.1" />
      <ellipse cx={cx} cy={cy} rx={r * 1.0} ry={r * 0.94} fill="#fcfaf7" />
      <circle cx={cx} cy={cy} r={r * 0.74} fill={iris} />
      <circle cx={cx} cy={cy} r={r * 0.74} fill="#000" opacity="0.18" />
      <circle cx={cx} cy={cy - r * 0.1} r={r * 0.62} fill={iris} />
      {slit ? (
        <ellipse cx={cx} cy={cy} rx={r * 0.2} ry={r * 0.62} fill="#14161d" />
      ) : (
        <circle cx={cx} cy={cy} r={r * 0.38} fill="#14161d" />
      )}
      <circle cx={cx - r * 0.3} cy={cy - r * 0.38} r={r * 0.25} fill="#fff" opacity="0.95" />
      <circle cx={cx + r * 0.28} cy={cy + r * 0.32} r={r * 0.12} fill="#fff" opacity="0.5" />
      {lid && (
        <path
          d={`M${cx - r * 1.14} ${cy - r * 0.38} Q${cx} ${cy - r * 1.6} ${cx + r * 1.14} ${cy - r * 0.38}`}
          stroke={lid}
          strokeOpacity={lidOpacity}
          strokeWidth={r * 0.42}
          strokeLinecap="round"
          fill="none"
        />
      )}
    </>
  )
}

/** The almond of one eye, shared by the drawing and its clip path. */
function almond(cx: number, cy: number, w = 2.6, h = 1.85): string {
  return `M${cx - w} ${cy} q${w} ${-h * 1.3} ${w * 2} 0 q${-w} ${h * 1.2} ${-w * 2} 0 z`
}

const EYE_L = 20.3
const EYE_R = 27.7
const EYE_Y = 20.8

/**
 * A head, neck and shoulders with weight in them. Every person starts here.
 *
 * The proportions matter more than the detail: the head is an oval about
 * 22 wide and 27 tall with the eyes slightly ABOVE its middle, which is where
 * they sit on a real face. The first pass put small round eyes high on a small
 * round head, and that one thing is what made everybody look like a sticker.
 */
function Bust({
  u,
  coat,
  coatDark,
  collar,
}: {
  u: string
  coat: string
  coatDark: string
  collar?: string
}) {
  return (
    <>
      <defs>
        <radialGradient id={`${u}-skin`} cx="0.36" cy="0.28" r="0.86">
          <stop offset="0" stopColor="#f8d8b6" />
          <stop offset="0.55" stopColor="#efc096" />
          <stop offset="1" stopColor="#cb9165" />
        </radialGradient>
        <linearGradient id={`${u}-coat`} x1="0.2" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor={coat} />
          <stop offset="1" stopColor={coatDark} />
        </linearGradient>
        <clipPath id={`${u}-eL`}>
          <path d={almond(EYE_L, EYE_Y)} />
        </clipPath>
        <clipPath id={`${u}-eR`}>
          <path d={almond(EYE_R, EYE_Y)} />
        </clipPath>
      </defs>

      {/* shoulders: sloped, with the chest narrower than the arms */}
      <path
        d="M5.6 48c0-6.4 4.2-10.8 10.8-12.6l7.6-2 7.6 2C38.2 37.2 42.4 41.6 42.4 48z"
        fill={`url(#${u}-coat)`}
      />
      <path
        d="M16.4 35.4 24 33.4l7.6 2c1.4.4 2.6.9 3.7 1.5-3.5-1-7.3-1.5-11.3-1.5s-7.8.5-11.3 1.5c1.1-.6 2.3-1.1 3.7-1.5z"
        fill="#fff"
        opacity="0.22"
      />
      <path d="M5.6 48c0-5 2.6-8.8 7-11-2.8 2.8-4.3 6.5-4.5 11z" fill="#fff" opacity="0.14" />

      {/* neck, with the jaw's shadow falling across the top of it */}
      <path d="M20.3 30.4h7.4v7.2h-7.4z" fill="#dba87e" />
      <path d="M20.3 30.4h7.4v3.8c-3.8-.4-6.3-1.7-7.4-3.8z" fill="#ae7a52" opacity="0.8" />
      {collar && <path d="M18 36.2 24 45.4l6-9.2-6-2.4z" fill={collar} />}

      {/* head */}
      <path
        d="M24 7.6c6.8 0 11.1 4.7 11.1 11.8 0 3.7-.7 7.3-2.2 10.1C30.9 33 27.8 35.2 24 35.2s-6.9-2.2-8.9-5.7c-1.5-2.8-2.2-6.4-2.2-10.1C12.9 12.3 17.2 7.6 24 7.6z"
        fill={`url(#${u}-skin)`}
      />
      {/* ears, with a lobe and an inner shadow */}
      <path d="M13.4 19.4c-1.9-.4-3.2.6-3.4 2.6-.2 2.3 1 4.2 3 4.8z" fill="#ecbb90" />
      <path d="M12.3 21.4c-.9-.2-1.5.3-1.6 1.3-.1 1.1.4 2 1.3 2.3z" fill="#c08a5e" opacity="0.7" />
      <path d="M34.6 19.4c1.9-.4 3.2.6 3.4 2.6.2 2.3-1 4.2-3 4.8z" fill="#e3b088" />
      <path d="M35.7 21.4c.9-.2 1.5.3 1.6 1.3.1 1.1-.4 2-1.3 2.3z" fill="#b37f54" opacity="0.7" />
      {/* the light down the left of the face, and the shadow down the right */}
      <path
        d="M24 7.6c-6.8 0-11.1 4.7-11.1 11.8 0 1.8.2 3.6.5 5.3.6-9.6 4.3-15.2 10.6-17.1z"
        fill="#fff"
        opacity="0.3"
      />
      <path
        d="M30.8 9.8c2.8 2.1 4.3 5.4 4.3 9.6 0 3.7-.7 7.3-2.2 10.1-1.5 2.6-3.6 4.5-6.1 5.3 4.6-3.2 7.1-9 7.1-15.4 0-3.8-1-7-3.1-9.6z"
        fill="#a06d45"
        opacity="0.28"
      />
      {/* the planes of the face: brow ridge, cheekbones, chin */}
      <ellipse cx="24" cy="14.6" rx="7.4" ry="3.4" fill="#fff" opacity="0.14" />
      <ellipse cx="18.3" cy="24.6" rx="3.1" ry="2.1" fill="#dc8872" opacity="0.26" />
      <ellipse cx="29.7" cy="24.6" rx="3.1" ry="2.1" fill="#dc8872" opacity="0.26" />
      <path d="M24 33.4c-2.4 0-4.4-.8-6-2.3 1.7 1 3.7 1.5 6 1.5s4.3-.5 6-1.5c-1.6 1.5-3.6 2.3-6 2.3z" fill="#b8835b" opacity="0.4" />
    </>
  )
}

/**
 * Brows, eyes, nose and mouth.
 *
 * The eye is the piece that does the work: an almond of white, an iris CLIPPED
 * by it so the upper lid cuts across the top the way a real one does, a pupil,
 * a highlight, a lash line and a crease above it.
 */
function FaceFeatures({
  u,
  iris = '#6b4a2a',
  brow = '#4a3524',
  lash = '#4a3524',
  smile = 1,
}: {
  u: string
  iris?: string
  brow?: string
  lash?: string
  smile?: number
}) {
  const eye = (cx: number, clip: string) => (
    <>
      <path d={almond(cx, EYE_Y)} fill="#fbf8f4" />
      <g clipPath={`url(#${clip})`}>
        <ellipse cx={cx} cy={EYE_Y - 0.1} rx="1.68" ry="1.68" fill={iris} />
        <ellipse cx={cx} cy={EYE_Y - 0.1} rx="1.68" ry="1.68" fill="#000" opacity="0.22" />
        <ellipse cx={cx} cy={EYE_Y + 0.18} rx="1.5" ry="1.5" fill={iris} />
        <circle cx={cx} cy={EYE_Y} r="0.7" fill="#15171f" />
        <circle cx={cx - 0.5} cy={EYE_Y - 0.6} r="0.45" fill="#fff" opacity="0.95" />
        {/* the shadow the upper lid casts on the eye */}
        <path d={`M${cx - 3} ${EYE_Y - 2.6} h6 v2.1 h-6 z`} fill="#000" opacity="0.16" />
      </g>
      {/* lash line and crease */}
      <path
        d={`M${cx - 2.6} ${EYE_Y} q2.6 -2.4 5.2 0`}
        stroke={lash}
        strokeWidth="0.85"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={`M${cx - 2.2} ${EYE_Y - 2.3} q2.2 -1.2 4.4 -.2`}
        stroke="#c28d62"
        strokeOpacity="0.55"
        strokeWidth="0.5"
        strokeLinecap="round"
        fill="none"
      />
    </>
  )

  return (
    <>
      {/* brows: thicker at the inner end, arched over the outer */}
      <path
        d="M16.8 16.6q3.4-2.1 6.4-.6l-.3 1.5q-2.7-1.2-5.8.6z"
        fill={brow}
      />
      <path
        d="M31.2 16.6q-3.4-2.1-6.4-.6l.3 1.5q2.7-1.2 5.8.6z"
        fill={brow}
      />
      {eye(EYE_L, `${u}-eL`)}
      {eye(EYE_R, `${u}-eR`)}
      {/* nose: the shadow of the bridge, the tip, and two nostrils */}
      <path d="M24.2 19.4c.9 2.8 1.6 4.6 2 5.4.4 1-.3 1.7-2.2 1.9v-7.3z" fill="#cf9568" opacity="0.5" />
      <path d="M23.4 19.6c-.5 2.6-.9 4.3-1.1 5.2" stroke="#fff" strokeOpacity="0.3" strokeWidth="0.8" strokeLinecap="round" fill="none" />
      <ellipse cx="24" cy="25.6" rx="1.9" ry="1.1" fill="#dba67c" opacity="0.55" />
      <ellipse cx="22.4" cy="25.9" rx="0.6" ry="0.42" fill="#a9754b" opacity="0.85" />
      <ellipse cx="25.6" cy="25.9" rx="0.6" ry="0.42" fill="#a9754b" opacity="0.85" />
      {/* mouth: an upper lip in shadow, a lower lip catching the light */}
      <path
        d={`M20.6 28.6q1.6 -.9 3.4 -.6 1.8 -.3 3.4 .6 -1.5 ${1.9 * smile} -3.4 ${1.9 * smile} -1.9 0 -3.4 ${-1.9 * smile}z`}
        fill="#b86a60"
      />
      <path d="M20.6 28.6q1.6-.9 3.4-.6 1.8-.3 3.4.6-1.7-.2-3.4-.2t-3.4.2z" fill="#9c5349" />
      <path
        d={`M21.8 29.8q2.2 ${1.1 * smile} 4.4 0 -2.2 .5 -4.4 0z`}
        fill="#fff"
        opacity="0.3"
      />
      <ellipse cx="24" cy="32" rx="1.5" ry="0.8" fill="#c38b60" opacity="0.3" />
    </>
  )
}

/** A stalk with leaves that bend, for the flowers. */
function Stem({ top = 26, bend = 1 }: { top?: number; bend?: number }) {
  return (
    <>
      <path
        d={`M24 ${top}c.6 5 .4 9.5 0 ${46 - top}`}
        stroke="#3f7f3f"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={`M24 ${top}c.4 4 .3 8 0 ${46 - top}`}
        stroke="#6aa863"
        strokeWidth="0.9"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={`M23.6 ${top + 7 * bend}c-4.6-1.4-7.4-4.6-7.8-8.6 4.4.4 7.4 3.2 7.8 8.6z`}
        fill="#4f9a4f"
      />
      <path
        d={`M23.6 ${top + 7 * bend}c-3.4-1.6-5.8-4-6.8-6.8`}
        stroke="#3b7a3b"
        strokeWidth="0.7"
        fill="none"
      />
      <path
        d={`M24.4 ${top + 12 * bend}c4.6-1.4 7.4-4.4 7.8-8.2-4.4.4-7.4 3-7.8 8.2z`}
        fill="#3f8a44"
      />
    </>
  )
}

/** A wheel with a tyre, a rim and a hub. Shared by everything that rolls. */
function Wheel({ cx, cy, r = 4.6 }: { cx: number; cy: number; r?: number }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill="#23262e" />
      <circle cx={cx} cy={cy} r={r} fill="#000" opacity="0.25" />
      <circle cx={cx} cy={cy - r * 0.12} r={r * 0.94} fill="#33373f" />
      <circle cx={cx} cy={cy} r={r * 0.52} fill="#b9c2cf" />
      <circle cx={cx} cy={cy} r={r * 0.52} fill="#6b7585" opacity="0.4" />
      <circle cx={cx - r * 0.12} cy={cy - r * 0.14} r={r * 0.4} fill="#dfe6ef" />
      <circle cx={cx} cy={cy} r={r * 0.17} fill="#8d97a6" />
      <path
        d={`M${cx - r * 0.75} ${cy - r * 0.55}a${r * 0.95} ${r * 0.95} 0 0 1 ${r * 0.9} -.3`}
        stroke="#fff"
        strokeOpacity="0.25"
        strokeWidth={r * 0.2}
        strokeLinecap="round"
        fill="none"
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// THE CHARACTERS
// ---------------------------------------------------------------------------

const ART: Record<string, (u: string) => JSX.Element> = {
  // ------------------------------------------------------------- animals --
  cat: (u) => (
    <>
      <defs>
        <radialGradient id={`${u}-f`} cx="0.36" cy="0.26" r="0.86">
          <stop offset="0" stopColor="#f0a860" />
          <stop offset="0.6" stopColor="#dd8f45" />
          <stop offset="1" stopColor="#ab6628" />
        </radialGradient>
      </defs>
      {/* ears, set into the skull rather than stuck on top */}
      <path d="M13.4 20.6 12.2 7.8l10.2 5.6z" fill="#c87f3c" />
      <path d="M15.3 17.6 14.7 11.2l4.5 2.6z" fill="#e8907f" />
      <path d="M34.6 20.6 35.8 7.8l-10.2 5.6z" fill="#b97032" />
      <path d="M32.7 17.6 33.3 11.2l-4.5 2.6z" fill="#dd8273" />
      {/* skull: wider than tall, cheeks flaring below the eyes */}
      <path
        d="M24 11.4c7.4 0 12.4 4.6 12.4 11.6 0 4-1.5 7.6-4 9.9-2.2 2-5.1 3.1-8.4 3.1s-6.2-1.1-8.4-3.1c-2.5-2.3-4-5.9-4-9.9 0-7 5-11.6 12.4-11.6z"
        fill={`url(#${u}-f)`}
      />
      {/* tabby markings */}
      <path d="M24 11.6c1 2.2 1.4 4.4 1.2 6.6h-2.4c-.2-2.2.2-4.4 1.2-6.6z" fill="#b16f2e" opacity="0.55" />
      <path d="M18.4 13.2c.2 1.8.8 3.4 1.8 4.8l-1.8.8c-1-1.6-1.4-3.4-1.2-5.2z" fill="#b16f2e" opacity="0.4" />
      <path d="M29.6 13.2c-.2 1.8-.8 3.4-1.8 4.8l1.8.8c1-1.6 1.4-3.4 1.2-5.2z" fill="#b16f2e" opacity="0.4" />
      {/* the light across the brow */}
      <path
        d="M24 11.4c-5.6 0-9.9 2.6-11.6 7 2.6-3.4 6.7-5.2 11.6-5.2 1.6 0 3.1.2 4.5.6-1.4-1.6-3 -2.4-4.5-2.4z"
        fill="#fff"
        opacity="0.22"
      />
      {/* muzzle */}
      <ellipse cx="24" cy="29.4" rx="7.4" ry="5.2" fill="#f6dfc2" />
      <ellipse cx="24" cy="28.6" rx="7.4" ry="4.8" fill="#fdf0dd" />
      <ellipse cx="20.6" cy="29.2" rx="3.4" ry="2.9" fill="#fff" opacity="0.5" />
      <Eye cx={19.2} cy={23.2} r={2.9} iris="#c6952b" slit lid="#a4631f" lidOpacity={0.6} />
      <Eye cx={28.8} cy={23.2} r={2.9} iris="#c6952b" slit lid="#a4631f" lidOpacity={0.6} />
      {/* nose and the line down to the mouth */}
      <path d="M24 26.6c1.5 0 2.4.6 2.4 1.5 0 1-1.1 2-2.4 2s-2.4-1-2.4-2c0-.9.9-1.5 2.4-1.5z" fill="#e0867f" />
      <path d="M24 26.8c1.1 0 1.8.4 1.8 1 0 .3-.2.6-.5.9-.5-.6-1.3-1-2.3-1.1z" fill="#f3b3ab" />
      <path d="M24 30.1v1.6" stroke="#c89a6e" strokeWidth="0.8" strokeLinecap="round" />
      <path
        d="M24 31.7q-1.9 2-3.6 .3M24 31.7q1.9 2 3.6 .3"
        stroke="#b9875c"
        strokeWidth="0.9"
        strokeLinecap="round"
        fill="none"
      />
      {/* whiskers */}
      <g stroke="#fff" strokeOpacity="0.8" strokeWidth="0.55" strokeLinecap="round" fill="none">
        <path d="M17.4 28.2 8.6 26.4M17.4 29.6 8.4 30.2M30.6 28.2 39.4 26.4M30.6 29.6 39.6 30.2" />
      </g>
    </>
  ),

  dog: (u) => (
    <>
      <defs>
        <radialGradient id={`${u}-f`} cx="0.36" cy="0.26" r="0.84">
          <stop offset="0" stopColor="#d9a068" />
          <stop offset="0.6" stopColor="#bd8049" />
          <stop offset="1" stopColor="#8d5a2c" />
        </radialGradient>
      </defs>
      {/* ears hang, and hang behind the head */}
      <path d="M13.6 16c-3.6 1.4-5.2 5.6-4.4 10.4.8 4.6 3.4 7.6 6.6 7.2z" fill="#8f5c2f" />
      <path d="M34.4 16c3.6 1.4 5.2 5.6 4.4 10.4-.8 4.6-3.4 7.6-6.6 7.2z" fill="#7f4f26" />
      <path
        d="M24 10.6c7 0 11.8 4.6 11.8 11.4 0 4.2-1.4 8-3.8 10.4-2.1 2.1-4.9 3.3-8 3.3s-5.9-1.2-8-3.3c-2.4-2.4-3.8-6.2-3.8-10.4 0-6.8 4.8-11.4 11.8-11.4z"
        fill={`url(#${u}-f)`}
      />
      <path
        d="M24 10.6c-5.4 0-9.4 2.8-11 7.4 2.5-3.4 6.4-5.2 11-5.2z"
        fill="#fff"
        opacity="0.2"
      />
      {/* blaze */}
      <path d="M24 11.2c1.3 3.4 1.8 7 1.4 10.8h-2.8c-.4-3.8.1-7.4 1.4-10.8z" fill="#e9c197" opacity="0.5" />
      {/* long muzzle */}
      <path d="M24 23.6c4.4 0 7.4 2.6 7.4 6.4 0 4-3.2 6.8-7.4 6.8s-7.4-2.8-7.4-6.8c0-3.8 3-6.4 7.4-6.4z" fill="#f2dcc0" />
      <path d="M24 23.6c4 0 6.8 2.4 7.3 5.8-1.6-2.4-4.2-3.8-7.3-3.8s-5.7 1.4-7.3 3.8c.5-3.4 3.3-5.8 7.3-5.8z" fill="#fdf0dc" />
      <Eye cx={19.4} cy={21.4} r={2.4} iris="#6a4524" lid="#7a4e23" lidOpacity={0.6} />
      <Eye cx={28.6} cy={21.4} r={2.4} iris="#6a4524" lid="#7a4e23" lidOpacity={0.6} />
      <path d="M24 26.4c1.9 0 3 .9 3 2.1s-1.3 2.3-3 2.3-3-1.1-3-2.3.9-2.1 3-2.1z" fill="#2f2b2a" />
      <path d="M24 26.6c1.4 0 2.3.6 2.6 1.4-.7-.5-1.6-.8-2.6-.8s-1.9.3-2.6.8c.3-.8 1.2-1.4 2.6-1.4z" fill="#5d5653" />
      <path d="M24 30.8v1.6" stroke="#cbab85" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M24 32.4q-2 2.2-3.8.4M24 32.4q2 2.2 3.8.4" stroke="#b08f68" strokeWidth="1" strokeLinecap="round" fill="none" />
      <path d="M24 34.8c1.4 0 2.4 1 2.4 2.2s-1 2-2.4 2-2.4-.8-2.4-2 1-2.2 2.4-2.2z" fill="#e08a86" />
    </>
  ),

  panda: (u) => (
    <>
      <defs>
        <radialGradient id={`${u}-f`} cx="0.36" cy="0.26" r="0.82">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.65" stopColor="#f2f1ee" />
          <stop offset="1" stopColor="#cfcdc8" />
        </radialGradient>
        <radialGradient id={`${u}-e`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#3b3b43" />
          <stop offset="1" stopColor="#1b1b21" />
        </radialGradient>
      </defs>
      <circle cx="12.8" cy="14.6" r="5.4" fill={`url(#${u}-e)`} />
      <circle cx="35.2" cy="14.6" r="5.4" fill={`url(#${u}-e)`} />
      <circle cx="11.8" cy="13.4" r="2.2" fill="#fff" opacity="0.12" />
      <path
        d="M24 11.4c7.6 0 12.6 4.8 12.6 12 0 4-1.5 7.6-4.1 10-2.2 2-5.2 3.2-8.5 3.2s-6.3-1.2-8.5-3.2c-2.6-2.4-4.1-6-4.1-10 0-7.2 5-12 12.6-12z"
        fill={`url(#${u}-f)`}
      />
      {/* the patches, tilted the way a panda's really are */}
      <path d="M18.1 18.2c3 0 4.9 2 4.9 4.8 0 3-2.3 5.4-5.3 5.4s-5-2.1-5-4.8c0-3 2.4-5.4 5.4-5.4z" fill={`url(#${u}-e)`} transform="rotate(-14 18 23)" />
      <path d="M29.9 18.2c3 0 5.4 2.4 5.4 5.4 0 2.7-2 4.8-5 4.8s-5.3-2.4-5.3-5.4c0-2.8 1.9-4.8 4.9-4.8z" fill={`url(#${u}-e)`} transform="rotate(14 30 23)" />
      <Eye cx={18.4} cy={23} r={2} iris="#6b4a2a" lid={null} />
      <Eye cx={29.6} cy={23} r={2} iris="#6b4a2a" lid={null} />
      <path
        d="M24 11.4c-5.8 0-10 2.7-11.7 7.3 2.6-3.6 6.8-5.5 11.7-5.5z"
        fill="#fff"
        opacity="0.45"
      />
      <path d="M24 28.6c2 0 3.3 1 3.3 2.3s-1.5 2.4-3.3 2.4-3.3-1.1-3.3-2.4 1.3-2.3 3.3-2.3z" fill="#24242a" />
      <path d="M24 28.8c1.5 0 2.5.7 2.8 1.5-.8-.5-1.8-.8-2.8-.8s-2 .3-2.8.8c.3-.8 1.3-1.5 2.8-1.5z" fill="#55555e" />
      <path d="M24 33.2v1.4" stroke="#8d8d93" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M24 34.6q-1.9 1.9-3.5.3M24 34.6q1.9 1.9 3.5.3" stroke="#7d7d84" strokeWidth="0.9" strokeLinecap="round" fill="none" />
    </>
  ),

  fox: (u) => (
    <>
      <defs>
        <radialGradient id={`${u}-f`} cx="0.36" cy="0.24" r="0.86">
          <stop offset="0" stopColor="#f2995a" />
          <stop offset="0.6" stopColor="#df7a34" />
          <stop offset="1" stopColor="#ab5318" />
        </radialGradient>
      </defs>
      <path d="M12.4 20.2 10.6 5.4l11.2 7.2z" fill="#cf6d2c" />
      <path d="M14.4 16.8 13.4 9.4l5.2 3.4z" fill="#2f2a2c" />
      <path d="M35.6 20.2 37.4 5.4l-11.2 7.2z" fill="#bf6124" />
      <path d="M33.6 16.8 34.6 9.4l-5.2 3.4z" fill="#2a2527" />
      {/* a fox's face is a wedge: wide brow, narrow snout */}
      <path
        d="M24 11.6c7 0 11.8 4.2 11.8 10.6 0 3.6-1.3 6.8-3.6 9.1-2 2-4.8 3.3-8.2 4.7-3.4-1.4-6.2-2.7-8.2-4.7-2.3-2.3-3.6-5.5-3.6-9.1 0-6.4 4.8-10.6 11.8-10.6z"
        fill={`url(#${u}-f)`}
      />
      <path d="M24 11.6c-5.4 0-9.3 2.5-11 6.8 2.6-3.2 6.4-4.9 11-4.9z" fill="#fff" opacity="0.22" />
      {/* white cheeks and snout */}
      <path d="M24 22.4c3.6 1.6 5.8 4 6.6 7.4-1.2 2.6-3.4 4.6-6.6 6-3.2-1.4-5.4-3.4-6.6-6 .8-3.4 3-5.8 6.6-7.4z" fill="#fbf1e6" />
      <path d="M24 22.4c3 1.4 5 3.4 5.9 6.1-1.5-1.9-3.5-3.3-5.9-4.3-2.4 1-4.4 2.4-5.9 4.3.9-2.7 2.9-4.7 5.9-6.1z" fill="#fff" />
      <Eye cx={19.3} cy={21.4} r={2.3} iris="#7a4d1c" slit lid="#8a4a18" lidOpacity={0.6} />
      <Eye cx={28.7} cy={21.4} r={2.3} iris="#7a4d1c" slit lid="#8a4a18" lidOpacity={0.6} />
      <path d="M24 28.4c1.5 0 2.4.7 2.4 1.7s-1.1 1.9-2.4 1.9-2.4-.9-2.4-1.9.9-1.7 2.4-1.7z" fill="#2c2729" />
      <path d="M24 28.6c1.1 0 1.8.4 2 1-.6-.3-1.3-.5-2-.5s-1.4.2-2 .5c.2-.6.9-1 2-1z" fill="#5b5457" />
      <path d="M24 32.2v1.4" stroke="#d7c3ad" strokeWidth="0.7" strokeLinecap="round" />
    </>
  ),

  owl: (u) => (
    <>
      <defs>
        <radialGradient id={`${u}-f`} cx="0.36" cy="0.24" r="0.88">
          <stop offset="0" stopColor="#a995d8" />
          <stop offset="0.6" stopColor="#8775be" />
          <stop offset="1" stopColor="#5d4e8c" />
        </radialGradient>
      </defs>
      <path d="M11.6 15.6 13.4 7l6.6 5.4z" fill="#6f5da8" />
      <path d="M36.4 15.6 34.6 7l-6.6 5.4z" fill="#64529c" />
      <path
        d="M24 9.8c7.8 0 12.6 5.8 12.6 14.2 0 8-5 14-12.6 14S11.4 32 11.4 24c0-8.4 4.8-14.2 12.6-14.2z"
        fill={`url(#${u}-f)`}
      />
      {/* the breast, feathered in rows */}
      <path d="M24 22.6c5 0 8.4 3.2 8.4 8 0 4.6-3.6 7.4-8.4 7.4s-8.4-2.8-8.4-7.4c0-4.8 3.4-8 8.4-8z" fill="#c6b8e6" opacity="0.5" />
      <g fill="#fff" opacity="0.3">
        <path d="M18.4 28.6a2.6 2.2 0 0 1 5.2 0zM24.4 28.6a2.6 2.2 0 0 1 5.2 0zM21.4 32.4a2.6 2.2 0 0 1 5.2 0zM15.8 32.4a2.6 2.2 0 0 1 5.2 0zM27 32.4a2.6 2.2 0 0 1 5.2 0z" />
      </g>
      {/* facial discs */}
      <circle cx="18.6" cy="21.4" r="6" fill="#e8e1f6" />
      <circle cx="29.4" cy="21.4" r="6" fill="#ded5f1" />
      <circle cx="18.6" cy="21" r="5.4" fill="#f3eefb" />
      <circle cx="29.4" cy="21" r="5.4" fill="#eae3f8" />
      <Eye cx={18.6} cy={21} r={3.4} iris="#d99a2a" lid="#7a68ad" lidOpacity={0.45} />
      <Eye cx={29.4} cy={21} r={3.4} iris="#d99a2a" lid="#7a68ad" lidOpacity={0.45} />
      {/* beak */}
      <path d="M24 22.8c1.5 0 2.4.8 2.4 2 0 1.8-1.1 3.6-2.4 4.8-1.3-1.2-2.4-3-2.4-4.8 0-1.2.9-2 2.4-2z" fill="#e9a62e" />
      <path d="M24 22.8c1.2 0 2 .6 2.3 1.5-.6-.5-1.4-.8-2.3-.8s-1.7.3-2.3.8c.3-.9 1.1-1.5 2.3-1.5z" fill="#f6c766" />
      <path d="M24 9.8c-5.6 0-9.7 3-11.4 8.2 2.6-4 6.6-6.2 11.4-6.2z" fill="#fff" opacity="0.22" />
    </>
  ),

  penguin: (u) => (
    <>
      <defs>
        <radialGradient id={`${u}-b`} cx="0.34" cy="0.24" r="0.86">
          <stop offset="0" stopColor="#47506b" />
          <stop offset="0.6" stopColor="#2b3147" />
          <stop offset="1" stopColor="#151925" />
        </radialGradient>
      </defs>
      <ellipse cx="24" cy="26" rx="13" ry="15.4" fill={`url(#${u}-b)`} />
      {/* flippers */}
      <path d="M11.6 22c-2.8 2.6-3.6 7.4-2 13 1.8 1.6 3.6 1 4.4-1.6z" fill="#1d2232" />
      <path d="M36.4 22c2.8 2.6 3.6 7.4 2 13-1.8 1.6-3.6 1-4.4-1.6z" fill="#181d2b" />
      {/* belly */}
      <path d="M24 13.6c5.4 0 9 4.6 9 12.4s-3.6 14-9 14-9-6.2-9-14 3.6-12.4 9-12.4z" fill="#efeae2" />
      <path d="M24 13.6c4.6 0 7.9 3.4 8.8 9.4-1.6-4.6-4.8-7.4-8.8-7.4s-7.2 2.8-8.8 7.4c.9-6 4.2-9.4 8.8-9.4z" fill="#fff" />
      <Eye cx={20.2} cy={19.6} r={2.3} iris="#4a3a2c" lid={null} />
      <Eye cx={27.8} cy={19.6} r={2.3} iris="#4a3a2c" lid={null} />
      {/* beak */}
      <path d="M24 22.4c2.4 0 3.9 1 3.9 2.2s-1.7 2.4-3.9 2.4-3.9-1.2-3.9-2.4 1.5-2.2 3.9-2.2z" fill="#e08a2a" />
      <path d="M24 22.4c2 0 3.3.8 3.7 1.7-1-.5-2.3-.8-3.7-.8s-2.7.3-3.7.8c.4-.9 1.7-1.7 3.7-1.7z" fill="#f6b45c" />
      <path d="M20.3 25q3.7 1.3 7.4 0" stroke="#b96c18" strokeWidth="0.7" fill="none" />
      {/* feet */}
      <path d="M19.4 40.4c1.8-.6 3.2 0 3.4 1.8.2 1.8-1 2.8-3 2.8s-3.4-1-3.4-2.2c0-1 1.2-1.8 3-2.4z" fill="#e08a2a" />
      <path d="M28.6 40.4c-1.8-.6-3.2 0-3.4 1.8-.2 1.8 1 2.8 3 2.8s3.4-1 3.4-2.2c0-1-1.2-1.8-3-2.4z" fill="#cf7b1e" />
      <ellipse cx="18" cy="18.6" rx="3.6" ry="2.6" fill="#fff" opacity="0.1" />
    </>
  ),

  elephant: (u) => (
    <>
      <defs>
        <radialGradient id={`${u}-s`} cx="0.36" cy="0.26" r="0.84">
          <stop offset="0" stopColor="#b2bac9" />
          <stop offset="0.6" stopColor="#8e97a8" />
          <stop offset="1" stopColor="#636d7e" />
        </radialGradient>
        <radialGradient id={`${u}-ear`} cx="0.5" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#9aa3b4" />
          <stop offset="1" stopColor="#6c7687" />
        </radialGradient>
      </defs>
      {/* ears: big, thin, veined, behind the head */}
      <path d="M14.6 14.4C8.2 13.8 3.8 18.6 4.6 25.6c.8 6.6 5.6 10.4 10.8 8.6z" fill={`url(#${u}-ear)`} />
      <path d="M33.4 14.4c6.4-.6 10.8 4.2 10 11.2-.8 6.6-5.6 10.4-10.8 8.6z" fill={`url(#${u}-ear)`} />
      <path d="M13.8 17.4c-3.8.4-6.2 3.6-5.8 8.2.3 3.8 2.2 6.3 4.8 6.6-2-1.6-3-4.1-3-7.4 0-3 1.3-5.5 4-7.4z" fill="#000" opacity="0.14" />
      <path d="M34.2 17.4c3.8.4 6.2 3.6 5.8 8.2-.3 3.8-2.2 6.3-4.8 6.6 2-1.6 3-4.1 3-7.4 0-3-1.3-5.5-4-7.4z" fill="#000" opacity="0.2" />
      {/* skull */}
      <path
        d="M24 9.6c6.6 0 10.9 4.2 10.9 11 0 3.4-.8 6.6-2.3 9-1.9 3-5 4.8-8.6 4.8s-6.7-1.8-8.6-4.8c-1.5-2.4-2.3-5.6-2.3-9 0-6.8 4.3-11 10.9-11z"
        fill={`url(#${u}-s)`}
      />
      <path d="M24 9.6c-5.2 0-8.9 2.8-10.3 7.6 2.2-3.6 5.8-5.6 10.3-5.6z" fill="#fff" opacity="0.26" />
      {/* the dome of the forehead */}
      <path d="M24 11.4c3.4 0 5.6 2.2 5.6 5.6 0 2.2-1 4-2.6 4.8H21c-1.6-.8-2.6-2.6-2.6-4.8 0-3.4 2.2-5.6 5.6-5.6z" fill="#fff" opacity="0.12" />
      <Eye cx={18.6} cy={21.4} r={2} iris="#5b4530" lid="#5e6778" lidOpacity={0.6} />
      <Eye cx={29.4} cy={21.4} r={2} iris="#5b4530" lid="#5e6778" lidOpacity={0.6} />
      {/* trunk: tapers, curls, and has rings */}
      <path
        d="M20.4 27c0-2 1.6-3.2 3.6-3.2s3.6 1.2 3.6 3.2c0 2.6-.6 5-1.4 7.4-.7 2.1-.4 3.6 1.2 4.3 1.6.7 3-.1 3.6-2"
        stroke="#7d8697"
        strokeWidth="5.4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M20.4 27c0-2 1.6-3.2 3.6-3.2s3.6 1.2 3.6 3.2c0 2.6-.6 5-1.4 7.4-.7 2.1-.4 3.6 1.2 4.3 1.6.7 3-.1 3.6-2"
        stroke="#99a2b2"
        strokeWidth="3.6"
        strokeLinecap="round"
        fill="none"
      />
      <g stroke="#6b7484" strokeOpacity="0.5" strokeWidth="0.7" strokeLinecap="round" fill="none">
        <path d="M20.8 28.6h6.4M21 31h6M21.4 33.4h5.4M22.4 35.8h4.4" />
      </g>
      {/* tusks */}
      <path d="M18.8 28.6c-1 2-1.4 3.8-1 5.4 1.2-1.4 1.8-3.2 1.8-5.4z" fill="#f3efe4" />
      <path d="M29.2 28.6c1 2 1.4 3.8 1 5.4-1.2-1.4-1.8-3.2-1.8-5.4z" fill="#e6e1d4" />
    </>
  ),

  turtle: (u) => (
    <>
      <defs>
        <radialGradient id={`${u}-sh`} cx="0.34" cy="0.22" r="0.86">
          <stop offset="0" stopColor="#8fb46a" />
          <stop offset="0.55" stopColor="#5f8d45" />
          <stop offset="1" stopColor="#36612c" />
        </radialGradient>
        <radialGradient id={`${u}-sk`} cx="0.4" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#a8c98a" />
          <stop offset="1" stopColor="#6f9456" />
        </radialGradient>
      </defs>
      {/* flippers */}
      <path d="M11.6 31.6c-2.8.4-4.6 2.2-4.4 4.6.2 2.2 2 3.4 4.6 3l2-5z" fill={`url(#${u}-sk)`} />
      <path d="M36.4 31.6c2.8.4 4.6 2.2 4.4 4.6-.2 2.2-2 3.4-4.6 3l-2-5z" fill="#6f9456" />
      <path d="M17 37.6c-1.6 1.4-1.8 3.2-.4 4.4 1.4 1.2 3.2.8 4.4-1z" fill="#7da862" />
      <path d="M31 37.6c1.6 1.4 1.8 3.2.4 4.4-1.4 1.2-3.2.8-4.4-1z" fill="#6b9052" />
      {/* head, with a neck that comes out of the shell */}
      <path d="M24 9.4c3.8 0 6.4 2.6 6.4 6.6 0 4.2-2.8 7-6.4 7s-6.4-2.8-6.4-7c0-4 2.6-6.6 6.4-6.6z" fill={`url(#${u}-sk)`} />
      <path d="M24 9.4c-3 0-5.2 1.6-6 4.4 1.4-1.8 3.4-2.8 6-2.8z" fill="#fff" opacity="0.3" />
      <Eye cx={21} cy={14.6} r={1.8} iris="#4a3a22" lid="#4f6e3c" lidOpacity={0.6} />
      <Eye cx={27} cy={14.6} r={1.8} iris="#4a3a22" lid="#4f6e3c" lidOpacity={0.6} />
      <path d="M21.6 18.6q2.4 1.6 4.8 0" stroke="#4a6b38" strokeWidth="0.9" strokeLinecap="round" fill="none" />
      {/* carapace: a dome, with scutes that follow its curve */}
      <path d="M24 17.6c9 0 15.2 5.6 15.2 13.2 0 5.6-6.4 9.6-15.2 9.6S8.8 36.4 8.8 30.8c0-7.6 6.2-13.2 15.2-13.2z" fill={`url(#${u}-sh)`} />
      <g stroke="#2f5726" strokeOpacity="0.55" strokeWidth="0.9" fill="none">
        <path d="M24 19.6v18.8M12.2 27.4c7.8 2.6 15.8 2.6 23.6 0M14.6 34.6c6.2 1.6 12.6 1.6 18.8 0M16.8 22.4c4.8-1.4 9.6-1.4 14.4 0" />
      </g>
      <g fill="#a7cb80" opacity="0.4">
        <path d="M24 20.2c3 0 5.2 1 6.6 2.6-2.2-.8-4.4-1.2-6.6-1.2s-4.4.4-6.6 1.2c1.4-1.6 3.6-2.6 6.6-2.6z" />
      </g>
      {/* the rim of the shell, catching the light */}
      <path d="M24 17.6c-8.6 0-14.6 5.1-15.2 12.2C10.4 23.4 16.2 19.4 24 19.4z" fill="#fff" opacity="0.26" />
      <path d="M8.8 30.8c0 5.6 6.4 9.6 15.2 9.6s15.2-4 15.2-9.6c0 3.4-6.6 6-15.2 6s-15.2-2.6-15.2-6z" fill="#2f5726" opacity="0.35" />
    </>
  ),

  // ------------------------------------------------------------- flowers --
  tulip: (u) => (
    <>
      <defs>
        <linearGradient id={`${u}-p2`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#f9839f" />
          <stop offset="0.6" stopColor="#e4476f" />
          <stop offset="1" stopColor="#a81f46" />
        </linearGradient>
      </defs>
      <Stem top={25} />
      {/* three petals, the middle one in front */}
      <path d="M16.4 13.2c.6 6.4 3.2 10.6 7.6 12.6-3.2-4.6-4.6-9.6-4.2-15z" fill="#c22c56" />
      <path d="M31.6 13.2c-.6 6.4-3.2 10.6-7.6 12.6 3.2-4.6 4.6-9.6 4.2-15z" fill="#a81f46" />
      <path
        d="M24 5.4c4.4 3.6 6.8 8.2 6.8 13 0 4.4-2.6 7.4-6.8 7.4s-6.8-3-6.8-7.4c0-4.8 2.4-9.4 6.8-13z"
        fill={`url(#${u}-p2)`}
      />
      <path d="M24 5.4c-3 2.6-4.9 5.9-5.6 9.5.9 4 2.6 7.4 5 10.2-1.4-6.6-1.2-13.1.6-19.7z" fill="#fff" opacity="0.24" />
      <path d="M24 5.4c1.8 6.6 2 13.1.6 19.7 2.6-3 4.4-6.7 5.2-11-.8-3.3-2.7-6.2-5.8-8.7z" fill="#8c1739" opacity="0.4" />
    </>
  ),

  sunflower: (u) => (
    <>
      <defs>
        <linearGradient id={`${u}-pt`} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor="#ffd75e" />
          <stop offset="1" stopColor="#e89a14" />
        </linearGradient>
        <radialGradient id={`${u}-c`} cx="0.36" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#7b4a1c" />
          <stop offset="0.6" stopColor="#573011" />
          <stop offset="1" stopColor="#331a06" />
        </radialGradient>
      </defs>
      <Stem top={28} />
      {/* two rings of petals, the back one darker and offset */}
      <g fill="#d98c0f">
        {Array.from({ length: 12 }).map((_, i) => (
          <ellipse
            key={i}
            cx="24"
            cy="7.6"
            rx="2.6"
            ry="6.4"
            transform={`rotate(${i * 30 + 15} 24 18)`}
          />
        ))}
      </g>
      <g fill={`url(#${u}-pt)`}>
        {Array.from({ length: 12 }).map((_, i) => (
          <ellipse key={i} cx="24" cy="8.4" rx="2.8" ry="6.2" transform={`rotate(${i * 30} 24 18)`} />
        ))}
      </g>
      <circle cx="24" cy="18" r="7.4" fill={`url(#${u}-c)`} />
      {/* seeds, in the spiral they actually grow in */}
      <g fill="#2e1704" opacity="0.65">
        {Array.from({ length: 26 }).map((_, i) => {
          const a = i * 2.39996
          const rad = 0.95 * Math.sqrt(i)
          return (
            <circle
              key={i}
              cx={24 + rad * Math.cos(a)}
              cy={18 + rad * Math.sin(a)}
              r="0.72"
            />
          )
        })}
      </g>
      <circle cx="21.6" cy="15.6" r="3" fill="#fff" opacity="0.12" />
    </>
  ),

  daisy: (u) => (
    <>
      <defs>
        <radialGradient id={`${u}-c`} cx="0.36" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffd95e" />
          <stop offset="0.7" stopColor="#efab10" />
          <stop offset="1" stopColor="#c07c00" />
        </radialGradient>
      </defs>
      <Stem top={28} />
      <g>
        {Array.from({ length: 11 }).map((_, i) => (
          <ellipse
            key={i}
            cx="24"
            cy="9.4"
            rx="2.5"
            ry="6"
            fill="#e4e9ef"
            transform={`rotate(${i * 32.7 + 16} 24 18)`}
          />
        ))}
        {Array.from({ length: 11 }).map((_, i) => (
          <ellipse
            key={i}
            cx="24"
            cy="9.8"
            rx="2.3"
            ry="5.6"
            fill="#fdfdfd"
            transform={`rotate(${i * 32.7} 24 18)`}
          />
        ))}
      </g>
      <circle cx="24" cy="18" r="5.2" fill={`url(#${u}-c)`} />
      <g fill="#a86e00" opacity="0.45">
        {Array.from({ length: 12 }).map((_, i) => {
          const a = i * 2.39996
          const rad = 0.78 * Math.sqrt(i)
          return <circle key={i} cx={24 + rad * Math.cos(a)} cy={18 + rad * Math.sin(a)} r="0.6" />
        })}
      </g>
      <circle cx="22.2" cy="16.2" r="1.9" fill="#fff" opacity="0.3" />
    </>
  ),

  rose: (u) => (
    <>
      <defs>
        <radialGradient id={`${u}-r`} cx="0.4" cy="0.34" r="0.78">
          <stop offset="0" stopColor="#ef6a84" />
          <stop offset="0.55" stopColor="#d02f55" />
          <stop offset="1" stopColor="#8d1232" />
        </radialGradient>
      </defs>
      <Stem top={27} />
      {/* outer petals, each one a cupped shape rather than a circle */}
      <path d="M24 6.6c6.6 0 11 4.4 11 10.6 0 6-4.6 10.4-11 10.4S13 23.2 13 17.2c0-6.2 4.4-10.6 11-10.6z" fill={`url(#${u}-r)`} />
      <path d="M14.2 12.6c2.6-3.8 6.4-5.6 11-5.4-4.2 1-7.6 3.4-10 7z" fill="#fff" opacity="0.26" />
      <path d="M33.8 12.6c-2.6-3.8-6.4-5.6-11-5.4 4.2 1 7.6 3.4 10 7z" fill="#7a0d29" opacity="0.3" />
      {/* the spiral at the heart */}
      <path d="M24 10.4c4.2 0 7 2.8 7 6.8 0 3.8-2.8 6.6-7 6.6s-7-2.8-7-6.6c0-4 2.8-6.8 7-6.8z" fill="#b62246" />
      <path d="M24 12.6c2.8 0 4.8 1.9 4.8 4.6 0 2.6-2 4.4-4.8 4.4-2 0-3.4-1-3.4-2.6 0-1.4 1.1-2.4 2.6-2.4 1.1 0 1.8.6 1.8 1.4" fill="none" stroke="#6f0c24" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M24 12.6c2.5 0 4.3 1.6 4.7 3.9-1-1.6-2.7-2.5-4.7-2.5z" fill="#f08ea1" opacity="0.7" />
    </>
  ),

  lotus: (u) => (
    <>
      <defs>
        <linearGradient id={`${u}-pb`} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor="#e990c2" />
          <stop offset="1" stopColor="#b8438c" />
        </linearGradient>
        <linearGradient id={`${u}-pf`} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor="#fde4f0" />
          <stop offset="0.55" stopColor="#f7a9d2" />
          <stop offset="1" stopColor="#d9599f" />
        </linearGradient>
      </defs>
      {/* water, and the pad it sits on */}
      <path d="M0 34c6 0 6 2.2 12 2.2S18 34 24 34s6 2.2 12 2.2S42 34 48 34v14H0z" fill="#8fd0e4" opacity="0.55" />
      <ellipse cx="24" cy="33.4" rx="17" ry="3.4" fill="#55aec9" opacity="0.35" />
      <path d="M4.6 32.2c0-2.7 3.1-4.6 7.3-4.6s7.3 1.9 7.3 4.6-3.1 4.4-7.3 4.4-7.3-1.7-7.3-4.4z" fill="#4f9a56" />
      <path d="M11.9 27.6v9M5 31.4l6.9 1M19.2 31.4l-7.3 1" stroke="#3b7c42" strokeWidth="0.7" />
      <path d="M5.4 30c.9-1.5 3.3-2.4 6.5-2.4 1.3 0 2.5.2 3.5.4-3.9.1-7.2.8-10 2z" fill="#6fb877" opacity="0.7" />
      {/* the bloom: a back ring of petals, a front ring, and the seed pod */}
      <g>
        <path d="M24 8.5C18.4 17.725 19.52 27 24 29C28.48 27 29.6 17.725 24 8.5z" fill="#c45196" transform="rotate(-78 24 29)" />
        <path d="M24 8.5C18.4 17.725 19.52 27 24 29C28.48 27 29.6 17.725 24 8.5z" fill="#c45196" transform="rotate(-52 24 29)" />
        <path d="M24 8.5C18.4 17.725 19.52 27 24 29C28.48 27 29.6 17.725 24 8.5z" fill="#c45196" transform="rotate(-26 24 29)" />
        <path d="M24 8.5C18.4 17.725 19.52 27 24 29C28.48 27 29.6 17.725 24 8.5z" fill="#c45196" transform="rotate(0 24 29)" />
        <path d="M24 8.5C18.4 17.725 19.52 27 24 29C28.48 27 29.6 17.725 24 8.5z" fill="#c45196" transform="rotate(26 24 29)" />
        <path d="M24 8.5C18.4 17.725 19.52 27 24 29C28.48 27 29.6 17.725 24 8.5z" fill="#c45196" transform="rotate(52 24 29)" />
        <path d="M24 8.5C18.4 17.725 19.52 27 24 29C28.48 27 29.6 17.725 24 8.5z" fill="#c45196" transform="rotate(78 24 29)" />
      </g>
      <g>
        <path d="M24 13C19.1 20.2 20.08 27 24 29C27.92 27 28.9 20.2 24 13z" fill="url(#${u}-pb)" transform="rotate(-54 24 29)" />
        <path d="M24 13C19.1 20.2 20.08 27 24 29C27.92 27 28.9 20.2 24 13z" fill="url(#${u}-pb)" transform="rotate(-27 24 29)" />
        <path d="M24 13C19.1 20.2 20.08 27 24 29C27.92 27 28.9 20.2 24 13z" fill="url(#${u}-pb)" transform="rotate(0 24 29)" />
        <path d="M24 13C19.1 20.2 20.08 27 24 29C27.92 27 28.9 20.2 24 13z" fill="url(#${u}-pb)" transform="rotate(27 24 29)" />
        <path d="M24 13C19.1 20.2 20.08 27 24 29C27.92 27 28.9 20.2 24 13z" fill="url(#${u}-pb)" transform="rotate(54 24 29)" />
      </g>
      <g>
        <path d="M24 15.5C19.6 21.8 20.48 27.5 24 29.5C27.52 27.5 28.4 21.8 24 15.5z" fill="url(#${u}-pf)" transform="rotate(-26 24 29.5)" />
        <path d="M24 15.5C19.6 21.8 20.48 27.5 24 29.5C27.52 27.5 28.4 21.8 24 15.5z" fill="url(#${u}-pf)" transform="rotate(0 24 29.5)" />
        <path d="M24 15.5C19.6 21.8 20.48 27.5 24 29.5C27.52 27.5 28.4 21.8 24 15.5z" fill="url(#${u}-pf)" transform="rotate(26 24 29.5)" />
      </g>
      <ellipse cx="24" cy="28.6" rx="3.2" ry="2.1" fill="#e7c452" />
      <ellipse cx="24" cy="28.2" rx="2.6" ry="1.6" fill="#f6dd84" />
      <g fill="#b8942a" opacity="0.7">
        <circle cx="22.4" cy="28.2" r="0.42" />
        <circle cx="24" cy="27.8" r="0.42" />
        <circle cx="25.6" cy="28.2" r="0.42" />
      </g>
      <path d="M21.2 16c-.9 3.4-1.3 6.9-1.2 10.4h1.6z" fill="#fff" opacity="0.3" />
    </>
  ),

  cactus: (u) => (
    <>
      <defs>
        <linearGradient id={`${u}-c`} x1="0.15" y1="0" x2="0.9" y2="0">
          <stop offset="0" stopColor="#6fb87a" />
          <stop offset="0.45" stopColor="#4a9159" />
          <stop offset="1" stopColor="#2c6639" />
        </linearGradient>
        <linearGradient id={`${u}-pot`} x1="0.1" y1="0" x2="0.95" y2="0">
          <stop offset="0" stopColor="#d79a6a" />
          <stop offset="0.45" stopColor="#bd7a4a" />
          <stop offset="1" stopColor="#8d5430" />
        </linearGradient>
      </defs>
      <rect x="19.4" y="14.6" width="9.2" height="24" rx="4.6" fill={`url(#${u}-c)`} />
      {/* ribs */}
      <g stroke="#2d6b3b" strokeOpacity="0.45" strokeWidth="0.8" strokeLinecap="round">
        <path d="M22 17v20M26 17v20" />
      </g>
      <path d="M21 17v20" stroke="#8ccf94" strokeOpacity="0.5" strokeWidth="0.9" strokeLinecap="round" />
      {/* arms */}
      <path d="M19.4 25.4h-2.6a4.4 4.4 0 0 1-4.4-4.4v-2.6a2.2 2.2 0 0 1 4.4 0v1.4a1 1 0 0 0 1 1h1.6z" fill="#58a265" />
      <path d="M28.6 29.6h2.6a4.4 4.4 0 0 0 4.4-4.4v-3.4a2.2 2.2 0 0 0-4.4 0v2.2a1 1 0 0 1-1 1h-1.6z" fill="#3f8450" />
      {/* spines */}
      <g stroke="#e8f0d8" strokeOpacity="0.8" strokeWidth="0.55" strokeLinecap="round">
        <path d="M19.8 19.6l-1.4-.7M19.8 24.4l-1.4-.7M19.8 29.2l-1.4-.7M19.8 34l-1.4-.7M28.2 21.2l1.4-.7M28.2 26l1.4-.7M28.2 30.8l1.4-.7M28.2 35.6l1.4-.7" />
      </g>
      {/* flower */}
      <g>
        {Array.from({ length: 7 }).map((_, i) => (
          <ellipse key={i} cx="24" cy="9.6" rx="1.7" ry="3.4" fill="#ef5f84" transform={`rotate(${i * 51.4} 24 12.4)`} />
        ))}
      </g>
      <circle cx="24" cy="12.4" r="1.9" fill="#ffd45e" />
      {/* pot */}
      <path d="M14.4 36.6h19.2l-2 10.4a1.6 1.6 0 0 1-1.6 1.3H18a1.6 1.6 0 0 1-1.6-1.3z" fill={`url(#${u}-pot)`} />
      <rect x="13.2" y="34.4" width="21.6" height="3.8" rx="1.4" fill="#c8835a" />
      <path d="M16.6 37.4 18.6 48h-1L15.4 37.4z" fill="#fff" opacity="0.22" />
    </>
  ),

  bluebell: (u) => (
    <>
      <defs>
        <linearGradient id={`${u}-bell`} x1="0.15" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#9bb0f2" />
          <stop offset="0.45" stopColor="#6376dd" />
          <stop offset="1" stopColor="#36429c" />
        </linearGradient>
      </defs>
      {/* one arching stem, the way bluebells actually nod to one side */}
      <path
        d="M27.6 47c-1.4-8-2.6-16-2.2-23.4.2-4 1.4-7 3.6-9"
        stroke="#3f7f3f"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M27.2 47c-1.2-7.8-2.2-15.6-1.8-22.8"
        stroke="#6aa863"
        strokeWidth="0.8"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M25.6 30c-5.6-1-9-4.4-9.6-9.8 5.4.4 8.8 3.6 9.6 9.8z" fill="#4f9a4f" />
      <path d="M25.6 30c-4.2-1.4-7-3.8-8.4-7.2" stroke="#3b7a3b" strokeWidth="0.7" fill="none" />
      <path d="M26.4 38.8c4.4-.8 7.2-3.4 8-7.8-4.2.4-6.8 3-8 7.8z" fill="#3f8a44" />
      {/* three bells, each hung off the stem and turned a little differently */}
      {[
        { x: 15.6, y: 14.4, s: 1.1, a: -18 },
        { x: 29.4, y: 10.2, s: 0.95, a: 10 },
        { x: 19.4, y: 24.6, s: 0.85, a: -8 },
      ].map((b, i) => (
        <g key={i} transform={`translate(${b.x} ${b.y}) rotate(${b.a}) scale(${b.s})`}>
          {/* the short stalk it hangs from */}
          <path d="M0 -1.4 Q1.8 -3 4.6 -3.6" stroke="#4f8f4b" strokeWidth="1" fill="none" strokeLinecap="round" />
          {/* the bell: narrow at the top, flaring to the mouth */}
          <path
            d="M0 -1.6c2.2 0 3.4 1.2 3.6 3.4.2 2.4.2 4.4-.2 6-.4 1.6-1.5 2.4-3.4 2.4s-3-.8-3.4-2.4c-.4-1.6-.4-3.6-.2-6C-3.4-.4-2.2-1.6 0-1.6z"
            fill={`url(#${u}-bell)`}
          />
          {/* the light down its left side */}
          <path d="M-1.4-1.2c-1.2.6-1.9 1.9-2 3.9-.1 1.6-.1 3 .1 4.2.2-3.4.9-6.1 1.9-8.1z" fill="#fff" opacity="0.35" />
          {/* the lip, recurved outwards */}
          <path d="M-3.6 8.4c.5 1.4 1.6 2.1 3.6 2.1s3.1-.7 3.6-2.1c.3 1.8-.1 3-1.3 3.4-.5-1-1.2-1.5-2.3-1.5s-1.8.5-2.3 1.5c-1.2-.4-1.6-1.6-1.3-3.4z" fill="#4a5ac4" />
          <path d="M-1.2 10.2c-.3 1.3-.9 2-1.8 2.2.6-.8 1.2-1.5 1.8-2.2zM1.2 10.2c.3 1.3.9 2 1.8 2.2-.6-.8-1.2-1.5-1.8-2.2z" fill="#3a47a8" />
        </g>
      ))}
    </>
  ),

  // ---------------------------------------------------------------- cars --
  bicycle: (u) => (
    <>
      <defs>
        <linearGradient id={`${u}-fr`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#ff9b4e" />
          <stop offset="0.5" stopColor="#f2762a" />
          <stop offset="1" stopColor="#bd4f10" />
        </linearGradient>
      </defs>
      {/* wheels: tyre, spokes, hub — the same size as each other */}
      {[13.4, 34.6].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="31" r="10.4" fill="none" stroke="#23262e" strokeWidth="2.1" />
          <circle cx={cx} cy="31" r="9.4" fill="none" stroke="#8d97a6" strokeWidth="0.7" />
          <g stroke="#b9c2cf" strokeWidth="0.55" opacity="0.9">
            {Array.from({ length: 10 }).map((_, i) => {
              const a = (i * Math.PI) / 5
              return (
                <line
                  key={i}
                  x1={cx}
                  y1="31"
                  x2={cx + 9.2 * Math.cos(a)}
                  y2={31 + 9.2 * Math.sin(a)}
                />
              )
            })}
          </g>
          <circle cx={cx} cy="31" r="1.5" fill="#7b8595" />
          <path
            d={`M${cx - 7.6} ${24.6}a10.4 10.4 0 0 1 7 -3`}
            stroke="#fff"
            strokeOpacity="0.4"
            strokeWidth="1.1"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      ))}
      {/* diamond frame */}
      <g stroke={`url(#${u}-fr)`} strokeWidth="2.2" strokeLinecap="round" fill="none">
        <path d="M13.4 31 21.4 31 27 18.4" />
        <path d="M21.4 31 29.4 18.4 34.6 31" />
        <path d="M21.4 31 27 18.4" />
        <path d="M29.4 18.4 27 18.4" />
      </g>
      {/* fork and handlebars */}
      <path d="M34.6 31 30.6 16.6" stroke="#5a6273" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M30.6 16.6c-1.8-1.1-3.4-1.2-4.8-.3" stroke="#3b414f" strokeWidth="1.7" strokeLinecap="round" fill="none" />
      <circle cx="30.6" cy="16.6" r="1.2" fill="#4d5466" />
      {/* saddle */}
      <path d="M22.6 16.4c2.8 0 4.6.8 4.6 1.8s-1.4 1.4-3.4 1.4-4.4-.6-4.4-1.6.8-1.6 3.2-1.6z" fill="#2f3340" />
      <path d="M22.6 16.4c2.2 0 3.7.5 4.3 1.1-1-.4-2.4-.6-4-.6-1.2 0-2.3.1-3.1.3.5-.5 1.4-.8 2.8-.8z" fill="#5d6373" />
      <path d="M21.4 19.6V31" stroke="#f2762a" strokeWidth="2.2" strokeLinecap="round" />
      {/* chainring, crank and pedal */}
      <circle cx="21.4" cy="31" r="3.4" fill="#9aa3b2" />
      <circle cx="21.4" cy="31" r="2.3" fill="#cfd6e1" />
      <circle cx="21.4" cy="31" r="1" fill="#7b8595" />
      <path d="M21.4 31 19 34.6" stroke="#444b5c" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M17.4 34.6h3" stroke="#2f3340" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M21.4 31h13.2" stroke="#2f3340" strokeWidth="1" strokeLinecap="round" opacity="0.75" />
    </>
  ),

  racer: (u) => (
    <>
      <defs>
        <linearGradient id={`${u}-b`} x1="0.2" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#f4584f" />
          <stop offset="0.5" stopColor="#d6332e" />
          <stop offset="1" stopColor="#8e1612" />
        </linearGradient>
        <linearGradient id={`${u}-g`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#dff1ff" />
          <stop offset="1" stopColor="#90b8dc" />
        </linearGradient>
      </defs>
      {/* a low, wedge-shaped body with a cabin set back */}
      <path d="M4.6 30.4c.6-2.6 3-4 7-4.4l5-5.6c1.2-1.4 2.8-2 5-2h6.6c2.6 0 4.6.8 6.2 2.4l4 4c3.6.6 5.4 2.2 5.6 5l-.3 3.2c-.1 1-.9 1.6-2.2 1.6H6.4c-1.3 0-2-.7-1.9-2z" fill={`url(#${u}-b)`} />
      <path d="M17.6 20.6c.9-1 2.1-1.4 3.6-1.4h5.6c2 0 3.5.6 4.7 1.8l3.4 3.4H14.2z" fill={`url(#${u}-g)`} />
      <path d="M18.6 21.2h4.8v3.2h-7.4zM25 21.2h2.2c1.3 0 2.3.4 3.1 1.2l2 2H25z" fill="#5d87ad" opacity="0.5" />
      {/* the light along the shoulder line */}
      <path d="M11.6 26c7.8-1.4 16.6-1.4 26.4 0l.6.6c-9.8-1-18.8-1-27.6.2z" fill="#fff" opacity="0.4" />
      <path d="M5 32.2h38l-.2 1.4c-.1 1-.9 1.6-2.2 1.6H6.4c-1.3 0-2-.7-1.9-2z" fill="#000" opacity="0.22" />
      <rect x="4.8" y="27.4" width="3.4" height="2.4" rx="1.2" fill="#ffe08a" />
      <rect x="40" y="27.6" width="3" height="2" rx="1" fill="#ff8c7a" />
      <Wheel cx={14} cy={34.4} r={5.4} />
      <Wheel cx={34} cy={34.4} r={5.4} />
    </>
  ),

  taxi: (u) => (
    <>
      <defs>
        <linearGradient id={`${u}-b`} x1="0.2" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#ffd45e" />
          <stop offset="0.5" stopColor="#f3b212" />
          <stop offset="1" stopColor="#b57c00" />
        </linearGradient>
        <linearGradient id={`${u}-g`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#e6f3ff" />
          <stop offset="1" stopColor="#9bbdd9" />
        </linearGradient>
      </defs>
      <path d="M5 31.4c.2-2.6 2-4.2 5.4-4.8l4.8-6.4c1.1-1.5 2.7-2.2 4.8-2.2h9c2.1 0 3.7.7 4.8 2.2l4.8 6.4c3.4.6 5.2 2.2 5.4 4.8l-.2 2.6c-.1 1.1-.9 1.7-2.3 1.7H7.5c-1.4 0-2.2-.6-2.3-1.7z" fill={`url(#${u}-b)`} />
      <path d="M16.6 20.6c.8-1 1.9-1.5 3.4-1.5h8c1.5 0 2.6.5 3.4 1.5l4.2 5.8H12.4z" fill={`url(#${u}-g)`} />
      <path d="M17.6 21.2h5.6v5.2h-9.4zM24.8 21.2h3c1 0 1.8.3 2.4 1.1l3.1 4.1h-8.5z" fill="#5d87ad" opacity="0.45" />
      <path d="M10.4 27.4c9-1.4 18.2-1.4 27.2 0-9-.8-18.2-.8-27.2 0z" fill="#fff" opacity="0.45" />
      <path d="M5 32.6h38l-.2 1.4c-.1 1.1-.9 1.7-2.3 1.7H7.5c-1.4 0-2.2-.6-2.3-1.7z" fill="#000" opacity="0.2" />
      {/* roof sign */}
      <rect x="19.6" y="13" width="8.8" height="4.2" rx="1.4" fill="#2c3245" />
      <rect x="20.6" y="14" width="6.8" height="2.2" rx="0.9" fill="#ffe9a8" />
      {/* chequer band */}
      <g fill="#2c3245">
        <rect x="9.6" y="28.4" width="2.6" height="2.2" />
        <rect x="14.8" y="28.4" width="2.6" height="2.2" />
        <rect x="20" y="28.4" width="2.6" height="2.2" />
        <rect x="25.2" y="28.4" width="2.6" height="2.2" />
        <rect x="30.4" y="28.4" width="2.6" height="2.2" />
        <rect x="35.6" y="28.4" width="2.2" height="2.2" />
      </g>
      <Wheel cx={14.4} cy={34.8} r={5.2} />
      <Wheel cx={33.6} cy={34.8} r={5.2} />
    </>
  ),

  bus: (u) => (
    <>
      <defs>
        <linearGradient id={`${u}-b`} x1="0.15" y1="0" x2="0.75" y2="1">
          <stop offset="0" stopColor="#56c088" />
          <stop offset="0.5" stopColor="#2f9c66" />
          <stop offset="1" stopColor="#15663f" />
        </linearGradient>
        <linearGradient id={`${u}-g`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#e9f6ff" />
          <stop offset="1" stopColor="#9dc0da" />
        </linearGradient>
      </defs>
      <rect x="5.4" y="12.4" width="37.2" height="23.4" rx="4.6" fill={`url(#${u}-b)`} />
      <rect x="5.4" y="12.4" width="37.2" height="8" rx="4.6" fill="#fff" opacity="0.16" />
      {/* windows, with a pillar between each */}
      <g fill={`url(#${u}-g)`}>
        <rect x="8.4" y="16.6" width="8.4" height="7.2" rx="1.6" />
        <rect x="19.8" y="16.6" width="8.4" height="7.2" rx="1.6" />
        <rect x="31.2" y="16.6" width="8.4" height="7.2" rx="1.6" />
      </g>
      <g fill="#6d9bbd" opacity="0.4">
        <path d="M8.4 18.2h8.4v5.6h-4.2zM19.8 18.2h8.4v5.6H24zM31.2 18.2h8.4v5.6h-4.2z" />
      </g>
      <rect x="5.4" y="26.6" width="37.2" height="3.6" fill="#13603b" opacity="0.55" />
      <rect x="5.4" y="26.6" width="37.2" height="1" fill="#fff" opacity="0.22" />
      <rect x="7.4" y="31" width="7.4" height="3.2" rx="1.2" fill="#0f5434" opacity="0.5" />
      <rect x="37" y="14.6" width="3.2" height="2.4" rx="1" fill="#ffe08a" />
      <Wheel cx={14.6} cy={36.4} r={5} />
      <Wheel cx={33.4} cy={36.4} r={5} />
    </>
  ),

  pickup: (u) => (
    <>
      <defs>
        <linearGradient id={`${u}-b`} x1="0.2" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#6fa5e8" />
          <stop offset="0.5" stopColor="#3f73c4" />
          <stop offset="1" stopColor="#1e4484" />
        </linearGradient>
        <linearGradient id={`${u}-g`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#e6f3ff" />
          <stop offset="1" stopColor="#9bbdd9" />
        </linearGradient>
      </defs>
      {/* flat bed at the back, cab at the front */}
      <path d="M4.6 26.6h19.2v8.8H6.6c-1.3 0-2-.7-2-1.8z" fill={`url(#${u}-b)`} />
      <path d="M23.8 18.6h6.4c1.6 0 2.9.6 3.9 1.9l4.3 5.6c3 .5 4.6 2 4.8 4.4l-.2 3.3c-.1 1.1-.9 1.7-2.2 1.7H23.8z" fill={`url(#${u}-b)`} />
      <path d="M25.6 20.4h4.3c1.1 0 1.9.4 2.6 1.3l3.4 4.5h-10.3z" fill={`url(#${u}-g)`} />
      <path d="M25.6 21h3.2v4.2h-3.2z" fill="#5d87ad" opacity="0.4" />
      <path d="M4.6 26.6h19.2v1.4H4.6z" fill="#fff" opacity="0.3" />
      <path d="M24.6 26.4c6-.9 12-.9 18 0-6-.5-12-.5-18 0z" fill="#fff" opacity="0.4" />
      <path d="M4.6 32.4h38.6l-.1 1.2c-.1 1.1-.9 1.7-2.2 1.7H6.6c-1.3 0-2-.7-2-1.8z" fill="#000" opacity="0.2" />
      <rect x="39.8" y="27.4" width="3.2" height="2.4" rx="1" fill="#ffe08a" />
      <Wheel cx={13.4} cy={34.8} r={5.2} />
      <Wheel cx={33.6} cy={34.8} r={5.2} />
    </>
  ),

  convertible: (u) => (
    <>
      <defs>
        <linearGradient id={`${u}-b`} x1="0.2" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#58d0e0" />
          <stop offset="0.5" stopColor="#24a8bd" />
          <stop offset="1" stopColor="#0d6e80" />
        </linearGradient>
      </defs>
      {/* no roof, so the cabin is an open scoop */}
      <path d="M5 30.6c.3-2.8 2.4-4.4 6.2-4.8 2-4.4 6.4-6.6 12.8-6.6s10.8 2.2 12.8 6.6c3.8.4 5.9 2 6.2 4.8l-.2 2.8c-.1 1.1-.9 1.7-2.2 1.7H7.4c-1.3 0-2.1-.6-2.2-1.7z" fill={`url(#${u}-b)`} />
      <path d="M13.8 25.4c1.9-3 5.3-4.6 10.2-4.6s8.3 1.6 10.2 4.6c-2.6-1.6-6-2.4-10.2-2.4s-7.6.8-10.2 2.4z" fill="#0b5f70" opacity="0.6" />
      <path d="M15.2 24.4c2.2-1.4 5.1-2.1 8.8-2.1s6.6.7 8.8 2.1z" fill="#d9f3fa" opacity="0.6" />
      {/* seats and a windscreen */}
      <path d="M18.4 22.6h3.4v3.2h-3.4zM25.4 22.6h3.4v3.2h-3.4z" fill="#0a4f5e" opacity="0.7" />
      <path d="M15.6 19.6 18.4 14h2.6l-1.4 5.6z" fill="#e9f8fc" opacity="0.85" />
      <path d="M11.2 26.6c8.6-1.2 17-1.2 25.6 0-8.6-.6-17-.6-25.6 0z" fill="#fff" opacity="0.45" />
      <path d="M5 31.8h38l-.2 1.6c-.1 1.1-.9 1.7-2.2 1.7H7.4c-1.3 0-2.1-.6-2.2-1.7z" fill="#000" opacity="0.2" />
      <Wheel cx={14} cy={34.6} r={5.2} />
      <Wheel cx={34} cy={34.6} r={5.2} />
    </>
  ),

  van: (u) => (
    <>
      <defs>
        <linearGradient id={`${u}-b`} x1="0.15" y1="0" x2="0.75" y2="1">
          <stop offset="0" stopColor="#f69bc8" />
          <stop offset="0.5" stopColor="#e2619f" />
          <stop offset="1" stopColor="#a52f6a" />
        </linearGradient>
        <linearGradient id={`${u}-g`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#eaf5ff" />
          <stop offset="1" stopColor="#9dc0da" />
        </linearGradient>
      </defs>
      {/* a high box with a sloped nose, like a camper */}
      <path d="M6.4 15.6h22.4c1.6 0 2.9.6 3.9 1.8l6.4 7.6c1.9.5 2.9 1.8 2.9 3.8v4.6c0 1.3-.8 2-2.2 2H7.4c-1.4 0-2.2-.7-2.2-2V18c0-1.6.4-2.4 1.2-2.4z" fill={`url(#${u}-b)`} />
      <path d="M6.4 15.6h22.4c1.6 0 2.9.6 3.9 1.8l1 1.2H5.2V18c0-1.6.4-2.4 1.2-2.4z" fill="#fff" opacity="0.18" />
      <rect x="5.2" y="24.6" width="36.8" height="3.8" fill="#fff" opacity="0.8" />
      <rect x="5.2" y="24.6" width="36.8" height="1" fill="#fff" />
      <g fill={`url(#${u}-g)`}>
        <rect x="8.4" y="19" width="8.8" height="4.6" rx="1.2" />
        <rect x="29.6" y="19.4" width="7.4" height="4.2" rx="1.2" />
      </g>
      <path d="M29.6 19.4h3.4v4.2h-3.4z" fill="#5d87ad" opacity="0.4" />
      <rect x="38.8" y="20.6" width="3.2" height="2.4" rx="1" fill="#ffe08a" />
      {/* roof rack */}
      <rect x="12.4" y="12.6" width="15.6" height="3" rx="1.2" fill="#8e2a5c" />
      <rect x="12.4" y="12.6" width="15.6" height="1" rx="0.5" fill="#fff" opacity="0.25" />
      <Wheel cx={14.6} cy={34.6} r={5} />
      <Wheel cx={33.4} cy={34.6} r={5} />
    </>
  ),

  // -------------------------------------------------------------- people --
  doctor: (u) => (
    <>
      <Bust u={u} coat="#ffffff" coatDark="#d7e2ee" collar="#cfe4f6" />
      {/* short, side-parted hair that sits ON the skull */}
      <path d="M12.9 19.6c0-7.3 4.3-12 11.1-12s11.1 4.7 11.1 12c-.4-3-1.4-5.3-3-6.9-2.5 1.9-6.1 2.6-11 2.1-3.6-.4-6.1.6-7.5 3.1-.3.5-.5 1.1-.7 1.7z" fill="#3c3026" />
      <path d="M15.3 12.5c2-2.7 5-4.1 8.7-4.1 2.7 0 5 .8 6.8 2.3-2.7-.9-5.8-1.1-9.2-.7-2.5.3-4.6 1.1-6.3 2.5z" fill="#5c4a3c" opacity="0.8" />
      <FaceFeatures u={u} iris="#5a4a8c" brow="#3c3026" />
      {/* stethoscope, over the coat */}
      <path
        d="M18.4 37c-1.6 5.2-1 9 1.8 11.4M29.6 37c1.6 5.2 1 9-1.8 11.4"
        stroke="#39465c"
        strokeWidth="1.7"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M28.2 44.4c2.4 1 4 2.4 4.8 4.2" stroke="#39465c" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      <circle cx="34.2" cy="47.4" r="2.8" fill="#9fabbd" />
      <circle cx="34.2" cy="47.4" r="1.8" fill="#dde4ee" />
      <circle cx="33.6" cy="46.8" r="0.7" fill="#fff" opacity="0.8" />
    </>
  ),

  soldier: (u) => (
    <>
      <defs>
        <linearGradient id={`${u}-h`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#7d8c5f" />
          <stop offset="0.5" stopColor="#5f6c43" />
          <stop offset="1" stopColor="#3d4729" />
        </linearGradient>
      </defs>
      <Bust u={u} coat="#6d7b52" coatDark="#49543a" collar="#58633f" />
      <FaceFeatures u={u} iris="#4a5a3c" brow="#3a3326" />
      {/* a helmet with a brim, not a bowl */}
      <path d="M12.4 19.4c0-7.4 5-12.2 11.6-12.2s11.6 4.8 11.6 12.2z" fill={`url(#${u}-h)`} />
      <path d="M9.8 19c0-1 .8-1.6 2-1.6h24.4c1.2 0 2 .6 2 1.6v1.4c0 1-.8 1.6-2 1.6H11.8c-1.2 0-2-.6-2-1.6z" fill="#47532f" />
      <path d="M14.8 11.8c2.2-2.3 5.1-3.4 8.6-3.4 1.6 0 3.1.2 4.4.7-3.9-.2-8.2.7-13 2.7z" fill="#fff" opacity="0.2" />
      <path d="M24 9.4l1.6 3.4h-3.2z" fill="#e3c24a" />
      {/* camo patches */}
      <path d="M17.6 15.4c1.4-.6 2.6-.4 3.6.6-1.2.4-2.4.2-3.6-.6zM28.4 13.8c1.6.4 2.6 1.3 3 2.7-1.4-.5-2.4-1.4-3-2.7z" fill="#3d4729" opacity="0.6" />
      {/* rank flashes */}
      <path d="M18.6 42.4h10.8v2H18.6z" fill="#4c5737" />
      <circle cx="21" cy="46" r="1.1" fill="#e3c24a" />
      <circle cx="24" cy="46" r="1.1" fill="#e3c24a" />
      <circle cx="27" cy="46" r="1.1" fill="#e3c24a" />
    </>
  ),

  girl: (u) => (
    <>
      <defs>
        <linearGradient id={`${u}-hair`} x1="0.2" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#7a4a2a" />
          <stop offset="0.5" stopColor="#5a3420" />
          <stop offset="1" stopColor="#36200f" />
        </linearGradient>
      </defs>
      {/* hair behind the head, falling past the shoulders */}
      <path d="M10.6 36c-1.4-11 2.4-19.4 13.4-19.4S38.8 25 37.4 36c-.8 6-2.6 9.6-5.4 10.8 1.6-5.6 1.8-11.4.6-17.4H15.4c-1.2 6-1 11.8.6 17.4-2.8-1.2-4.6-4.8-5.4-10.8z" fill={`url(#${u}-hair)`} />
      <Bust u={u} coat="#ef6f9d" coatDark="#c23f73" collar="#d8558a" />
      <FaceFeatures u={u} iris="#4e6b3c" brow="#4b2e1a" />
      {/* a fringe with a parting, following the skull */}
      <path d="M12.9 20.2c-.6-7.9 4.2-12.6 11.1-12.6s11.7 4.7 11.1 12.6c-1.1-4.5-3.2-7.4-6.2-8.8-1.8 2.9-4.9 4.7-9.4 5.4-3 .5-5.1 1.6-6.6 3.4z" fill={`url(#${u}-hair)`} />
      <path d="M15.9 11.5c2.2-2.3 4.9-3.4 8.1-3.4 2.3 0 4.3.6 5.9 1.6-3.4-.7-7-.2-10.9 1.4-1.1.4-2.1.6-3.1.4z" fill="#fff" opacity="0.18" />
      {/* a ribbon, not a floating dot */}
      <path d="M33.2 15.6c1.8-1.4 3.3-1.5 4.4-.4 1.1 1.1.8 2.4-.8 4-1.4-.4-2.6-1.6-3.6-3.6z" fill="#f2c13c" />
      <path d="M33.2 15.6c-.6-2.2-.2-3.6 1.2-4.2 1.4-.6 2.6 0 3.6 1.8-1.4 1-3 1.8-4.8 2.4z" fill="#ffd75e" />
      <circle cx="33.4" cy="15.8" r="1.1" fill="#d99c17" />
    </>
  ),

  boy: (u) => (
    <>
      <Bust u={u} coat="#4f86d6" coatDark="#2e5ba4" collar="#3f72bd" />
      <FaceFeatures u={u} iris="#3e5f84" brow="#2f261c" />
      {/* cropped hair with a short fringe */}
      <path d="M12.8 19.8c-.3-7.9 4.5-12.2 11.2-12.2s11.5 4.3 11.2 12.2c-.9-3.8-2.5-6.3-4.8-7.4-1.8 1.8-4.8 2.5-8.9 2.3-3.4-.2-5.9.9-7.5 3.4-.5.5-.9 1.2-1.2 1.7z" fill="#332821" />
      <path d="M15.7 11.6c2.2-2.3 4.9-3.4 8.3-3.4 2.4 0 4.4.6 6.1 1.7-3.4-.9-7-.7-10.9.7-1.2.4-2.3.8-3.5 1z" fill="#5c4a3c" opacity="0.8" />
      {/* collar of a tee under the jumper */}
      <path d="M18.6 42.6h10.8v2.2H18.6z" fill="#3f72bd" />
      <path d="M18.6 42.6h10.8v.8H18.6z" fill="#fff" opacity="0.25" />
    </>
  ),

  chef: (u) => (
    <>
      <Bust u={u} coat="#fbfbfc" coatDark="#d9dee8" collar="#eef1f6" />
      <FaceFeatures u={u} iris="#5c4632" brow="#3b2c20" smile={1.1} />
      {/* the hat: a band and a puffed crown, with folds */}
      <path d="M15 15.4c-3.1 0-5-1.8-5-4.3 0-2.4 1.8-4 4.5-3.8C15.5 5 19 3.6 24 3.6s8.5 1.4 9.5 3.7c2.7-.2 4.5 1.4 4.5 3.8 0 2.5-1.9 4.3-5 4.3z" fill="#fdfdfe" />
      <path d="M15 15.4c-2.4 0-4.1-1-4.8-2.7 1.1 1 2.6 1.5 4.4 1.5h18.8c1.8 0 3.3-.5 4.4-1.5-.7 1.7-2.4 2.7-4.8 2.7z" fill="#cfd6e2" opacity="0.8" />
      <path d="M13.6 8.3c.6-1.8 2.7-3 5.8-3.6-2.3 1-3.9 2.4-4.7 4.2zM24 3.6c-1.4 2.5-2 5.4-1.8 8.7h-1.5c-.2-3.5.9-6.4 3.3-8.7z" fill="#dde3ec" opacity="0.7" />
      <rect x="14.8" y="15.2" width="18.4" height="3.4" rx="1" fill="#e0e5ed" />
      <rect x="14.8" y="15.2" width="18.4" height="1" rx="0.5" fill="#fff" />
      {/* double-breasted buttons */}
      <circle cx="20.4" cy="43" r="1.2" fill="#c3cad6" />
      <circle cx="27.6" cy="43" r="1.2" fill="#c3cad6" />
      <circle cx="20.4" cy="47" r="1.2" fill="#c3cad6" />
      <circle cx="27.6" cy="47" r="1.2" fill="#c3cad6" />
    </>
  ),

  astronaut: (u) => (
    <>
      <defs>
        <linearGradient id={`${u}-v`} x1="0.2" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#4f7ac4" />
          <stop offset="0.55" stopColor="#2d4f94" />
          <stop offset="1" stopColor="#152c5e" />
        </linearGradient>
        <radialGradient id={`${u}-dome`} cx="0.32" cy="0.26" r="0.86">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#eef2f8" />
          <stop offset="1" stopColor="#c0c8d6" />
        </radialGradient>
      </defs>
      {/* the back of the bubble, BEHIND the person */}
      <circle cx="24" cy="21.6" r="14.4" fill={`url(#${u}-dome)`} />
      <circle cx="24" cy="21.6" r="12.8" fill="#eef3fa" />
      <Bust u={u} coat="#eef1f7" coatDark="#c3cbd9" collar="#d7dde8" />
      <FaceFeatures u={u} iris="#4a5a7c" brow="#3f3328" />
      {/* the visor sits across the brow, well above the eyes */}
      <path d="M24 9c7.3 0 12.6 5.2 12.6 12.6-4.2-3.4-8.4-5.1-12.6-5.1s-8.4 1.7-12.6 5.1C11.4 14.2 16.7 9 24 9z" fill={`url(#${u}-v)`} />
      <path d="M15.4 16.4c2-3 5-4.7 8.9-5-3.2.6-5.9 2.4-7.8 5.3z" fill="#9dc2f2" opacity="0.85" />
      {/* the glass over the top of it all */}
      <path d="M24 7.2a14.4 14.4 0 0 1 14 10.9A14.4 14.4 0 0 0 24 9.6 14.4 14.4 0 0 0 10 18.1 14.4 14.4 0 0 1 24 7.2z" fill="#fff" opacity="0.6" />
      <path d="M13.6 14a14.4 14.4 0 0 1 6.3-4.7c-3.4 2.1-5.6 4.9-6.7 8.2z" fill="#fff" opacity="0.5" />
      {/* the curve of the glass across the chin */}
      <path d="M11.8 28.4a14.4 14.4 0 0 0 24.4 0 12.8 12.8 0 0 1 -24.4 0z" fill="#cfe0f2" opacity="0.5" />
      <rect x="7.4" y="19.4" width="4.2" height="7" rx="2" fill="#c3cbd9" />
      <rect x="36.4" y="19.4" width="4.2" height="7" rx="2" fill="#aeb7c7" />
      <circle cx="24" cy="42.6" r="2.2" fill="#e04a5c" />
      <circle cx="23.4" cy="42" r="0.8" fill="#fff" opacity="0.6" />
    </>
  ),

  firefighter: (u) => (
    <>
      <defs>
        <linearGradient id={`${u}-hel`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#e8564e" />
          <stop offset="0.5" stopColor="#c62f30" />
          <stop offset="1" stopColor="#8a1418" />
        </linearGradient>
      </defs>
      <Bust u={u} coat="#d8544c" coatDark="#9b2420" collar="#f0c23c" />
      <FaceFeatures u={u} iris="#4a3a2c" brow="#3a2a1e" />
      {/* a helmet with a front shield and a rear brim */}
      <path d="M12.2 19.6c0-7.4 5.1-12.2 11.8-12.2s11.8 4.8 11.8 12.2z" fill={`url(#${u}-hel)`} />
      <path d="M9.6 19.2c0-1.1.9-1.8 2.1-1.8h24.6c1.2 0 2.1.7 2.1 1.8v1.3c0 1.1-.9 1.8-2.1 1.8H11.7c-1.2 0-2.1-.7-2.1-1.8z" fill="#a51f22" />
      <path d="M9.6 19.6h28.8v.9H9.6z" fill="#fff" opacity="0.18" />
      <path d="M14.6 11.6c2.2-2.3 5.2-3.5 8.8-3.5 1.7 0 3.2.2 4.6.7-4.2-.2-8.5.7-13.4 2.8z" fill="#fff" opacity="0.26" />
      {/* the shield on the front */}
      <path d="M24 9.4c2.5 0 4.1.8 4.1 1.9 0 2-1.4 3.8-4.1 5.3-2.7-1.5-4.1-3.3-4.1-5.3 0-1.1 1.6-1.9 4.1-1.9z" fill="#f0c23c" />
      <path d="M24 10.9c1.2 0 1.9.3 1.9 1 0 .9-.6 1.8-1.9 2.5-1.3-.7-1.9-1.6-1.9-2.5 0-.7.7-1 1.9-1z" fill="#8a1418" />
      {/* reflective bands on the coat */}
      <path d="M12.6 42.4c6.8-1.6 15.2-1.6 22.8 0v2.6c-7.6-1.6-16-1.6-22.8 0z" fill="#f0e05c" />
      <path d="M12.6 43.2c6.8-1.4 15.2-1.4 22.8 0v.8c-7.6-1.4-16-1.4-22.8 0z" fill="#fff" opacity="0.5" />
    </>
  ),
}

/**
 * One character, drawn at whatever size the caller asks for.
 *
 * `showTitle` is off by default: the name is almost always already beside it,
 * and a tooltip on every token in a leaderboard is noise.
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
  /*
    One id per instance. Gradient, pattern and clip ids are global to the
    document: a shared one is resolved from whichever copy happens to be first
    and breaks the moment that copy unmounts, which with a dozen of these on a
    leaderboard is not hypothetical.
  */
  const u = `av${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const draw = ART[def.id] ?? ART.cat
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
      <defs>
        <radialGradient id={`${u}-disc`} cx="0.35" cy="0.28" r="0.85">
          <stop offset="0" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${u}-clip`}>
          <circle cx="24" cy="24" r="24" />
        </clipPath>
      </defs>
      <circle cx="24" cy="24" r="24" fill={def.tint} />
      <circle cx="24" cy="24" r="24" fill={`url(#${u}-disc)`} />
      {/* Clipped to the disc, so a helmet or a wheel cannot run off the edge. */}
      <g clipPath={`url(#${u}-clip)`}>{draw(u)}</g>
      {/* A faint inner edge, so the disc reads as a surface rather than a hole. */}
      <circle cx="24" cy="24" r="23.2" fill="none" stroke={DARK} strokeOpacity="0.09" strokeWidth="1.6" />
    </svg>
  )
}
