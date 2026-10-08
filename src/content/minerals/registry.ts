/**
 * 矿物注册表 + 矿脉生成加权混编入口
 */
import { Registry, weightedPick } from '../core/Registry'
import type { MineralDef, MineralId } from './types'

/** 矿物注册表单例（官方包/MOD 包都往这里登记） */
export const minerals = new Registry<MineralDef>('mineral')

/** 取矿物定义（id 缺失抛错——已生成的矿格必定能查到） */
export function getMineralDef(id: MineralId): MineralDef {
  return minerals.require(id)
}

/** 取矿物定义（缺失返回 undefined：存档/残余矿格容错用） */
export function findMineralDef(id: MineralId): MineralDef | undefined {
  return minerals.get(id)
}

/** 自然矿种的楼层门槛共用于地图生成与勘探记录。 */
export function mineralAvailableOnFloor(def:MineralDef,floor:number):boolean {
  const s=def.spawn
  return (s.minFloor===undefined||floor>=s.minFloor)&&(s.maxFloor===undefined||floor<=s.maxFloor)
}

/** 常规矿脉与独立盐化岩包都纳入；仅事件发放的矿物不属于自然采集池。 */
export function naturalMineralsForFloor(floor:number):MineralDef[] {
  return minerals.select(def=>mineralAvailableOnFloor(def,floor)
    && (def.spawn.weight>0||(def.spawn.rockReplacementChance??0)>0)
    && (!def.spawn.rooms||def.spawn.rooms.some(room=>['start','normal','reward','exit'].includes(room))))
    .sort((a,b)=>(a.spawn.minFloor??1)-(b.spawn.minFloor??1))
}

/**
 * 按房型/房内深度/楼层加权抽一种矿的 id。
 * TileMap 生成矿脉时逐格调用；spawn.rooms 缺省=不限房型。
 * @param floor 楼层号（正式第 1 层＝1，序章＝0；minFloor/maxFloor 门控用）
 * @returns 总权为 0（没有合格矿种）时返回 null
 */
export function rollMineralId(roomKind: string, depth: number, floor: number): MineralId | null {
  const pool = minerals.select((d) => {
    const s = d.spawn
    if (!s || s.weight <= 0) return false
    if (s.rooms && !s.rooms.includes(roomKind)) return false
    if (s.minDepth !== undefined && depth < s.minDepth) return false
    if (s.maxDepth !== undefined && depth > s.maxDepth) return false
    if (!mineralAvailableOnFloor(d,floor)) return false
    return true
  })
  return weightedPick(pool, (d) => d.spawn.weight)?.id ?? null
}
