import type { CharacterProfile } from '../../../../shared/profile'
import { materialCount } from '../../../../shared/production'
import { STRANGE_GEL_ID } from '../../../items/vanilla/ids'

/** 回营时记录带回胶体；已有素材的旧存档同样能补接，不要求再次掉落。 */
export function rememberGelReturn(profile: CharacterProfile): void {
  if (profile.flagBool('story.strangeGel.found') || materialCount(profile, STRANGE_GEL_ID) > 0) profile.setFlag('story.strangeGel.returned', true)
}
export const tetanusRecipePending = (profile: CharacterProfile): boolean => profile.flagBool('base.crafting.unlocked') && profile.flagBool('story.strangeGel.returned') && !profile.flagBool('recipe.tetanusSpear.unlocked')
