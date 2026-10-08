import type { ItemId } from '../content/items/types'
import { ROCK_STONE_ID,WOOD_ID,MUSHROOM_ID,HERB_ID,FLAX_ID,CLOVER_ID,DROOP_FRUIT_ID,FORGET_ME_NOT_ID } from '../content/items/vanilla/ids'
import { FRAGRANT_MUSHROOM_ID } from '../content/items/vanilla/food/fragrantMushroom'
import { naturalMineralsForFloor } from '../content/minerals/registry'

/** 自然采集的楼层规则：环境生成与选层记录共用，不纳入宝箱、怪物、炉骸和剧情奖励。 */
export const CAVE_GATHER_RESOURCES:readonly {item:ItemId;minFloor:number;maxFloor?:number}[]=[
  {item:WOOD_ID,minFloor:1},
  {item:MUSHROOM_ID,minFloor:1},
  {item:FRAGRANT_MUSHROOM_ID,minFloor:1},
  {item:HERB_ID,minFloor:1},
  {item:FLAX_ID,minFloor:2},
  {item:CLOVER_ID,minFloor:3},
  {item:DROOP_FRUIT_ID,minFloor:3},
  {item:FORGET_ME_NOT_ID,minFloor:4,maxFloor:4}
]

export function canGatherResource(item:ItemId,floor:number):boolean {
  return CAVE_GATHER_RESOURCES.some(rule=>rule.item===item&&floor>=rule.minFloor&&(rule.maxFloor===undefined||floor<=rule.maxFloor))
}

/** 展示整层可能自然采集到的资源，而非某一次随机房间中恰好刷出的资源。 */
export function mineFloorResourceIds(floor:number):ItemId[] {
  if(floor<1)return []
  return [...new Set([
    ...naturalMineralsForFloor(floor).map(mineral=>mineral.dropItemId),
    ROCK_STONE_ID,
    ...CAVE_GATHER_RESOURCES.filter(rule=>canGatherResource(rule.item,floor)).map(rule=>rule.item)
  ])]
}
