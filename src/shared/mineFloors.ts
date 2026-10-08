import type { CharacterProfile } from './profile'
import { RELAY_FLAGS, mineRelayUnlocked } from '../content/story/mainline/mine-relay/state'
import { FOURTH_FLAGS, rumiaPending } from '../content/story/mainline/fourth-rescue/state'

/** 楼层入口跟随剧情；三层旧路在中继塌方后关闭，报告完成开放四层。 */
export const MINE_FLOORS = [1, 2, 3, 4, 5] as const
export function canEnterMineFloor(profile: CharacterProfile, floor: number): boolean {
  if (rumiaPending(profile)) return false
  return floor === 1 || (floor === 2 && profile.flagBool('quest.reimu.cooking.done'))
    || (floor === 3 && (profile.flagBool('story.furnaceKey.seen') || mineRelayUnlocked(profile)) && !profile.flagBool(RELAY_FLAGS.returned))
    || (floor === 4 && profile.flagBool(RELAY_FLAGS.reported))
    || (floor === 5 && profile.flagBool(FOURTH_FLAGS.asked))
}
/** 尚未开放的层级继续隐藏；已知但塌方的三层保留卡片，注明通道状态。 */
export function visibleMineFloors(profile: CharacterProfile): readonly number[] {
  return MINE_FLOORS.filter(floor => canEnterMineFloor(profile,floor) || floor===3 && profile.flagBool(RELAY_FLAGS.returned))
}
export function chosenMineFloor(profile: CharacterProfile, requested?: number): number {
  const floor = requested ?? Number(profile.flag('mine.lastFloor') ?? 1)
  return canEnterMineFloor(profile, floor) ? floor : floor===3&&profile.flagBool(RELAY_FLAGS.reported)?4:1
}

/** 新档记录实际进入；旧档沿用已完成的探索及一层委托记录。 */
export function hasEnteredMineFloor(profile:CharacterProfile,floor:number):boolean{
  return profile.flagBool(`mine.floor.${floor}.entered`)
    || (floor>1&&profile.deepestDepth>=floor)
    || (floor===1&&profile.flagBool('quest.reimu.cooking.done'))
}
