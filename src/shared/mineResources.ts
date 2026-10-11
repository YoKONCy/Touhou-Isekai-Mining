import type { ItemId } from '../content/items/types'
import { ROCK_STONE_ID,SILICA_SAND_ID,WOOD_ID,MUSHROOM_ID,HERB_ID,FLAX_ID,CLOVER_ID,DROOP_FRUIT_ID,FORGET_ME_NOT_ID } from '../content/items/vanilla/ids'
import { FRAGRANT_MUSHROOM_ID } from '../content/items/vanilla/food/fragrantMushroom'
import { naturalMineralsForFloor } from '../content/minerals/registry'
import { BONE_FRAGMENT_ID,TURMERIC_ID,SULFUR_ID,FIRE_FLOWER_ID } from '../content/items/vanilla/ids'
import { biomeOldHell } from '../content/biomes/vanilla/oldHell'

/** 自然采集的楼层规则：环境生成与选层记录共用，不纳入宝箱、怪物、炉骸和剧情奖励。 */
export const CAVE_GATHER_RESOURCES:readonly {item:ItemId;minFloor:number;maxFloor?:number}[]=[
  {item:WOOD_ID,minFloor:1,maxFloor:4},
  {item:MUSHROOM_ID,minFloor:1,maxFloor:4},
  {item:FRAGRANT_MUSHROOM_ID,minFloor:1,maxFloor:4},
  {item:HERB_ID,minFloor:1,maxFloor:4},
  {item:FLAX_ID,minFloor:2,maxFloor:4},
  {item:CLOVER_ID,minFloor:3,maxFloor:4},
  {item:DROOP_FRUIT_ID,minFloor:3,maxFloor:4},
  {item:FORGET_ME_NOT_ID,minFloor:4,maxFloor:4},
  {item:BONE_FRAGMENT_ID,minFloor:5,maxFloor:5},
  {item:TURMERIC_ID,minFloor:5,maxFloor:5},
  {item:SULFUR_ID,minFloor:5,maxFloor:5},
  {item:FIRE_FLOWER_ID,minFloor:5,maxFloor:5}
]

export function canGatherResource(item:ItemId,floor:number):boolean {
  return CAVE_GATHER_RESOURCES.some(rule=>rule.item===item&&floor>=rule.minFloor&&(rule.maxFloor===undefined||floor<=rule.maxFloor))
}

/** 展示整层可能自然采集到的资源，而非某一次随机房间中恰好刷出的资源。 */
export function mineFloorResourceIds(floor:number):ItemId[] {
  if(floor<1)return []
  const minerals=naturalMineralsForFloor(floor,floor===5?biomeOldHell.mineralIds:undefined)
  return [...new Set([
    ...minerals.flatMap(mineral=>mineral.drops?mineral.drops.map(drop=>drop.item):[mineral.dropItemId]),
    ROCK_STONE_ID,SILICA_SAND_ID,
    ...CAVE_GATHER_RESOURCES.filter(rule=>canGatherResource(rule.item,floor)).map(rule=>rule.item)
  ])]
}
