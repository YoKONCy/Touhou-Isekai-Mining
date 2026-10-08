import type { FloorPlan } from './types'
import { generateFloorPlan } from './bsp'
import { BIOME_DEEP_HOLLOW_ID } from '../../../content/biomes/vanilla/ids'

/** 深窟沿用共用的连通地图算法，专属地貌与生物池由群系配置。 */
export function buildFourthFloorPlan(): FloorPlan {
  const plan = generateFloorPlan()
  for (const room of plan.rooms) {
    room.floor = 4
    room.biomeId = BIOME_DEEP_HOLLOW_ID
    if (room.id === plan.exitId) room.landmark = 'kedama_arena'
  }
  // 首次末间由 FourthFloorDirector 接入战斗与救援，解救后重访恢复普通撤离。
  return plan
}
