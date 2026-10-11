import { randomLoot } from '../../core/simulation/random'
/**
 * 战利品表注册表 + roll 入口
 * 官方包/MOD 包都往这里登记；引擎开箱只认表 id，不认识具体物品。
 */
import { Registry, weightedPick } from '../core/Registry'
import type { LootDrop, LootTable,LootEntry } from './types'

/** 战利品表注册表单例 */
export const lootTables = new Registry<LootTable>('lootTable')

/**
 * 按表 roll 一次掉落。
 * @returns 总权为 0 / 表不存在时返回空数组
 */
export function rollLoot(tableId: string,rng:()=>number=randomLoot,accepts?:(entry:LootEntry)=>boolean): LootDrop[] {
  const table = lootTables.get(tableId)
  if (!table) return []
  const picked = weightedPick(accepts?table.entries.filter(accepts):table.entries, (e) => e.weight, rng)
  if (!picked) return []
  const qty = picked.min + Math.floor(rng() * (picked.max - picked.min + 1))
  return qty > 0 ? [{ item: picked.item, qty }] : []
}
