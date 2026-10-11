import { randomGeneration } from '../../core/simulation/random'
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
export function naturalMineralsForFloor(floor:number,allowed?:readonly MineralId[]):MineralDef[] {
  return minerals.select(def=>mineralAvailableOnFloor(def,floor)
    && (!allowed||allowed.includes(def.id))
    && (def.spawn.weight>0||(def.spawn.rockReplacementChance??0)>0)
    && (!def.spawn.rooms||def.spawn.rooms.some(room=>['start','normal','reward','exit'].includes(room))))
    .sort((a,b)=>(a.spawn.minFloor??1)-(b.spawn.minFloor??1))
}

/** 宝藏房挑普通矿池最稀有两种，盐化岩包也参与；岸矿保持独立的低概率房间投放。 */
export function rewardRareMineralIds(floor:number,allowed?:readonly MineralId[]):ReadonlySet<MineralId> {
  const probability = (def:MineralDef) => def.spawn.weight > 0 ? def.spawn.weight : def.spawn.rockReplacementChance ?? 0
  return new Set(naturalMineralsForFloor(floor,allowed)
    .filter(def=>!def.spawn.placement)
    .filter(def => !def.spawn.rooms || def.spawn.rooms.includes('reward'))
    .sort((a,b) => probability(a)-probability(b) || a.id.localeCompare(b.id))
    .slice(0,2).map(def=>def.id))
}

/**
 * 按房型/房内深度/楼层加权抽一种矿的 id。
 * TileMap 生成矿脉时逐格调用；spawn.rooms 缺省=不限房型。
 * @param floor 楼层号（正式第 1 层＝1，序章＝0；minFloor/maxFloor 门控用）
 * @returns 总权为 0（没有合格矿种）时返回 null
 */
export function rollMineralId(roomKind: string, depth: number, floor: number, allowed?:readonly MineralId[]): MineralId | null {
  const pool = minerals.select((d) => {
    const s = d.spawn
    if (!s || s.weight <= 0) return false
    if(s.placement||allowed&&!allowed.includes(d.id))return false
    if (s.rooms && !s.rooms.includes(roomKind)) return false
    if (s.minDepth !== undefined && depth < s.minDepth) return false
    if (s.maxDepth !== undefined && depth > s.maxDepth) return false
    if (!mineralAvailableOnFloor(d,floor)) return false
    return true
  })
  const rare = roomKind === 'reward' ? rewardRareMineralIds(floor,allowed) : undefined
  return weightedPick(pool, (d) => d.spawn.weight * (rare?.has(d.id) ? 3 : 1), randomGeneration)?.id ?? null
}
