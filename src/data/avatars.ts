/**
 * ============================================================================
 * CHARACTERS — the gallery you pick from when you sign in.
 * ============================================================================
 * Flowers, animals, cars and people, mixed together rather than sorted into
 * groups, which is what Aaran asked for: "Both images will be mixed so there
 * will be so many images to choose from."
 *
 * Nothing here is a game rule and nothing reads it but the screens. A
 * character is a picture and a name beside a player; it buys no advantage.
 *
 * They are DRAWN, in `src/components/AvatarArt.tsx` — no image files, no CDN,
 * nothing to download. The game still opens and plays with no internet, and
 * the bundle does not grow by a single picture.
 *
 * `tint` is the disc behind the drawing. It is deliberately unrelated to the
 * six player colours: a player's colour is their token on the board, and two
 * players with the same character still have different colours.
 */

export type AvatarGroup = 'flower' | 'animal' | 'car' | 'person'

export interface AvatarDef {
  id: string
  name: string
  group: AvatarGroup
  tint: string
}

/**
 * The gallery, in the order it is shown — shuffled by hand between the four
 * kinds so the grid reads as a mixture rather than four blocks.
 */
export const AVATARS: AvatarDef[] = [
  { id: 'cat', name: 'Cat', group: 'animal', tint: '#ffe3c9' },
  { id: 'tulip', name: 'Tulip', group: 'flower', tint: '#ffe0ea' },
  { id: 'racer', name: 'Racing car', group: 'car', tint: '#ffd9d9' },
  { id: 'doctor', name: 'Doctor', group: 'person', tint: '#dff1ff' },
  { id: 'panda', name: 'Panda', group: 'animal', tint: '#eef2f7' },
  { id: 'sunflower', name: 'Sunflower', group: 'flower', tint: '#fff2cc' },
  { id: 'taxi', name: 'Taxi', group: 'car', tint: '#fff0c9' },
  { id: 'soldier', name: 'Army officer', group: 'person', tint: '#e6f0dd' },
  { id: 'fox', name: 'Fox', group: 'animal', tint: '#ffe6d2' },
  { id: 'daisy', name: 'Daisy', group: 'flower', tint: '#eaf7e6' },
  { id: 'bus', name: 'Bus', group: 'car', tint: '#dff0e8' },
  { id: 'girl', name: 'Girl', group: 'person', tint: '#ffe8f0' },
  { id: 'owl', name: 'Owl', group: 'animal', tint: '#e8e2f7' },
  { id: 'rose', name: 'Rose', group: 'flower', tint: '#ffdce1' },
  { id: 'pickup', name: 'Pickup truck', group: 'car', tint: '#e2ecfa' },
  { id: 'boy', name: 'Boy', group: 'person', tint: '#dfeaff' },
  { id: 'penguin', name: 'Penguin', group: 'animal', tint: '#e3f1fb' },
  { id: 'lotus', name: 'Lotus', group: 'flower', tint: '#f3e5fb' },
  { id: 'convertible', name: 'Convertible', group: 'car', tint: '#e8f7ff' },
  { id: 'chef', name: 'Chef', group: 'person', tint: '#fdf0e2' },
  { id: 'elephant', name: 'Elephant', group: 'animal', tint: '#e9edf4' },
  { id: 'cactus', name: 'Cactus flower', group: 'flower', tint: '#e4f5e7' },
  { id: 'van', name: 'Camper van', group: 'car', tint: '#fde8f3' },
  { id: 'astronaut', name: 'Astronaut', group: 'person', tint: '#e5e9fb' },
  { id: 'turtle', name: 'Turtle', group: 'animal', tint: '#e2f4ea' },
  { id: 'bluebell', name: 'Bluebell', group: 'flower', tint: '#e3eafd' },
  { id: 'bicycle', name: 'Bicycle', group: 'car', tint: '#fff1e6' },
  { id: 'firefighter', name: 'Firefighter', group: 'person', tint: '#ffe4df' },
  { id: 'dog', name: 'Dog', group: 'animal', tint: '#f6e6d2' },
]

export const DEFAULT_AVATAR_ID = 'cat'

/**
 * Characters that were renamed, so a profile saved before the change still
 * finds its picture instead of silently becoming a cat.
 */
const RENAMED: Record<string, string> = { scooter: 'bicycle' }

export function avatarById(id: string | undefined | null): AvatarDef {
  const wanted = id ? (RENAMED[id] ?? id) : id
  return AVATARS.find((a) => a.id === wanted) ?? AVATARS.find((a) => a.id === DEFAULT_AVATAR_ID)!
}

/** The labels above each run of the gallery, for anyone scanning for a kind. */
export const AVATAR_GROUP_LABELS: Record<AvatarGroup, string> = {
  flower: 'Flowers',
  animal: 'Animals',
  car: 'Cars',
  person: 'People',
}
