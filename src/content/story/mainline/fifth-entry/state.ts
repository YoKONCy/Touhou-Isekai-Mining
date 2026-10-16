import type { CharacterProfile } from '../../../../shared/profile'
import { STRANGE_PORK_ID } from '../../../items/vanilla/ids'
import { materialCount } from '../../../../shared/production'

export const FIFTH_FLAGS = {
  introSeen: 'story.fifth.introSeen',
  returned: 'story.fifth.returned',
  reported: 'story.fifth.reported',
  emptySeen: 'story.fifth.emptySeen',
  meatReturned: 'story.fifth.meatReturned',
  meatSeen: 'story.fifth.meatSeen'
} as const

/** 成功带出与当前仍有肉分别检查，归仓、失败回营和对白补播不会凭空生成肉。 */
export function hasReturnedPork(profile: CharacterProfile): boolean {
  return (profile.flagBool(FIFTH_FLAGS.meatReturned) || profile.discovery.items.has(STRANGE_PORK_ID))
    && materialCount(profile, STRANGE_PORK_ID) > 0
}

/** 首次入口保留真实窄通道；镜头在出口处向熔岩与废墟展开。 */
export const FIFTH_ENTRANCE = {
  spawnCol: 5, spawnRow: 18, exitCol: 20, exitRow: 18,
  viewCol: 25, viewRow: 16
} as const
