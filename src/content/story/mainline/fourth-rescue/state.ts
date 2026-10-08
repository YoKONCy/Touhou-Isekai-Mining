import type { CharacterProfile } from '../../../../shared/profile'

export const FOURTH_FLAGS = {
  won: 'story.fourth.won', rescued: 'story.fourth.rescued', known: 'story.fourth.rumiaKnown',
  arrived: 'story.fourth.arrived', campDone: 'story.fourth.campDone', asked: 'story.fourth.asked'
} as const
export const rumiaPending = (profile: CharacterProfile): boolean => profile.flagBool(FOURTH_FLAGS.rescued) && !profile.flagBool(FOURTH_FLAGS.asked)
export function joinRescuedNpcs(profile: CharacterProfile): void {
  for (const id of ['touhou:rumia', 'touhou:kedama_girl']) if (!profile.npcs.includes(id)) profile.npcs.push(id)
}
