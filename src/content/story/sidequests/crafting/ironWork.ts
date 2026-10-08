import type { CharacterProfile } from '../../../../shared/profile'
import { RELAY_FLAGS } from '../../mainline/mine-relay/state'

export const IRON_WORK_FLAGS={smelted:'story.ironWork.firstSmelt',unlocked:'recipe.ironWork.unlocked',crafted:'story.ironWork.firstWeaponCrafted',commentSeen:'story.ironWork.commentSeen'} as const
/** 首炉完成或旧档已经领过金属都能补接，领取铜锭同样有效；控制台送铁不算冶炼。 */
export function rememberIronWork(profile:CharacterProfile):void {
  if(profile.smelting?.state==='ready'||profile.flagBool(RELAY_FLAGS.metalClaimed))profile.setFlag(IRON_WORK_FLAGS.smelted,true)
}
export const ironWorkPending=(profile:CharacterProfile):boolean=>profile.flagBool('base.crafting.unlocked')&&profile.flagBool(IRON_WORK_FLAGS.smelted)&&!profile.flagBool(IRON_WORK_FLAGS.unlocked)
