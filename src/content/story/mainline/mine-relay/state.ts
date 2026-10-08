import type { CharacterProfile } from '../../../../shared/profile'

/** 本章的持久进度集中在这里，途中演出和宝箱名额只保存在当前探索实例。 */
export const RELAY_FLAGS = {
  metalClaimed: 'story.mineRelay.metalClaimed', metalSeen: 'story.mineRelay.metalSeen',
  shallowReturned: 'story.mineRelay.shallowReturned', hintSeen: 'story.mineRelay.hintSeen',
  returned: 'story.mineRelay.returned', reported: 'story.mineRelay.reported'
} as const
/** 中继在熔炉修好后开放，领取金属与烫手对白是独立的小剧情；兼容已有维修进度。 */
export const mineRelayUnlocked = (profile: CharacterProfile): boolean => profile.flagBool('base.furnace.ready') || Number(profile.flag('base.furnace.stage')) >= 3
export const needsMineRelay = (profile: CharacterProfile): boolean => mineRelayUnlocked(profile) && !profile.flagBool(RELAY_FLAGS.returned)
export const shouldStartMineRelay = (profile: CharacterProfile, floor: number): boolean => floor === 3 && needsMineRelay(profile)
export const mineRelayAttention = (profile: CharacterProfile): boolean => needsMineRelay(profile) && profile.flagBool(RELAY_FLAGS.hintSeen)
export function recordShallowReturn(profile: CharacterProfile, floor: number): void {
  if ((floor === 1 || floor === 2) && needsMineRelay(profile) && !profile.flagBool(RELAY_FLAGS.hintSeen)) profile.setFlag(RELAY_FLAGS.shallowReturned, true)
}
