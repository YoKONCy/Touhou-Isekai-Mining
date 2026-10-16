import type { SearchContainerKind, SearchProfile } from './types'

/** 只限制搜索产出，采集、战斗掉落、制作和任务奖励不受影响。 */
export const SEARCH_UNLOCK_FLOORS = { food: 3, equipment: 2 } as const

/**
 * 搜索经济统一配置：density 管搜索点密度，abundance 管箱内堆数，rarity 管稀有倾向。
 * 三项倍率逐层相乘，数量分布与专属池由更具体的配置覆盖。
 * 楼层示例：floors[4] = { density: 1.2, abundance: 1.1, rarity: 1.15 }。
 * 区域同理，在 RoomDef.searchRegion 填区域键；普通矿脉和怪物掉落不受这里控制。
 */
export const SEARCH_BALANCE: {
  defaults: SearchProfile
  kinds: Record<SearchContainerKind, SearchProfile>
  biomes: Record<string, SearchProfile>
  floors: Record<number, SearchProfile>
  roomKinds: Record<string, SearchProfile>
  regions: Record<string, SearchProfile>
  containers: Record<string, SearchProfile>
} = {
  defaults: { density: 1, abundance: 1, rarity: 1, emptyChance: 0 },
  kinds: {
    small: { counts: [{ count: 1, weight: 50 }, { count: 2, weight: 50 }] },
    large: { counts: [{ count: 1, weight: 25 }, { count: 2, weight: 50 }, { count: 3, weight: 25 }] },
    // 宝箱专属池已提高装备和稀有物的基础权重，不再重复乘品质倍率。
    chest: { counts: [{ count: 2, weight: 15 }, { count: 3, weight: 40 }, { count: 4, weight: 30 }, { count: 5, weight: 15 }] }
  },
  biomes: {},
  floors: {},
  roomKinds: {},
  regions: {},
  containers: {}
}
