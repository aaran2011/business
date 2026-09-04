/** Token colours for up to the maximum player count. */
export interface PlayerColour {
  id: string
  name: string
  hex: string
  token: string
}

export const PLAYER_COLOURS: PlayerColour[] = [
  { id: 'crimson', name: 'Crimson', hex: '#e23c4e', token: '\u{1F534}' },
  { id: 'azure', name: 'Azure', hex: '#2f8fe6', token: '\u{1F535}' },
  { id: 'emerald', name: 'Emerald', hex: '#2fb673', token: '\u{1F7E2}' },
  { id: 'amber', name: 'Amber', hex: '#e8a33d', token: '\u{1F7E1}' },
  { id: 'violet', name: 'Violet', hex: '#9a6ae0', token: '\u{1F7E3}' },
  { id: 'slate', name: 'Slate', hex: '#5c7a99', token: '\u{26AA}' },
]
