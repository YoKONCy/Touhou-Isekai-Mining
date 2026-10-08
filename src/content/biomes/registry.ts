/**
 * 生物群系注册表 + 投放查表 helper
 */
import { Registry } from '../core/Registry'
import type { BiomeDef, BiomeId } from './types'
import type { RoomKind, RoomDef } from '../../game/cave/dungeon/types'

/** 群系注册表单例 */
export const biomeDefs = new Registry<BiomeDef>('biome')

/** 官方默认群系（当前唯一；未来 RoomDef 可携带 biomeId 覆盖） */
export const DEFAULT_BIOME_ID: BiomeId = 'touhou:cave'

export function getBiomeDef(id: BiomeId): BiomeDef {
  return biomeDefs.require(id)
}

/** 区间内随机整数（含两端） */
function rollRange(range: readonly [number, number]): number {
  const [lo, hi] = range
  if (hi <= lo) return lo
  return lo + Math.floor(Math.random() * (hi - lo + 1))
}

/**
 * 各层共用数量规则：安全房、撤离房按房型取数，普通房按入口距离乘预算。
 * 陷阱房开局使用倒数第二档距离倍率，偏多但不采用最高档。
 * 浮点预算按小数概率取整，避免取整误差长期抬高或压低平均数量。
 *
 * @param room.depth 本房距入口的最短门数
 * @returns 本房应生成的敌人总数（之后按怪种 spawn.weight 加权混编）
 */
export function rollEnemyCount(
  biome: BiomeDef,
  room: { kind: RoomKind; depth?: number; floor?: number; encounter?: RoomDef['encounter'] }
): number {
  const b = biome.enemyBudget
  if (room.kind === 'start') return rollRange(b.start)
  if (room.kind === 'reward') return rollRange(b.reward)
  if (room.kind === 'exit') return rollRange(biome.floorExitBudgets?.[room.floor ?? 1] ?? b.exit)

  const average=biome.floorEnemyAverages?.[room.floor??1]??b.normalAverage
  const depth=Math.max(1,Math.floor(room.depth??1))
  const tier=room.encounter==='survival'?Math.max(0,b.depthMultipliers.length-2):Math.min(depth-1,b.depthMultipliers.length-1)
  const multiplier=b.depthMultipliers[tier]??1
  const expected=Math.max(0,average*multiplier),base=Math.floor(expected)
  return base+(Math.random()<expected-base?1:0)
}

/** 按房型取矿脉格数量区间 */
export function oreRangeForRoom(biome: BiomeDef, kind: RoomKind): readonly [number, number] {
  return biome.oreRange[kind]
}
