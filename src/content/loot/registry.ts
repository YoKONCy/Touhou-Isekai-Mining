/**
 * 战利品表注册表 + roll 入口
 * 官方包/MOD 包都往这里登记；引擎开箱只认表 id，不认识具体物品。
 */
import { Registry, weightedPick } from '../core/Registry'
import type { LootDrop, LootTable } from './types'

/** 战利品表注册表单例 */
export const lootTables = new Registry<LootTable>('lootTable')

/**
 * 按表 roll 一次掉落。
 * @returns 总权为 0 / 表不存在时返回空数组
 */
export function rollLoot(tableId: string): LootDrop[] {
  const table = lootTables.get(tableId)
  if (!table) return []
  const picked = weightedPick(table.entries, (e) => e.weight)
  if (!picked) return []
  const qty = picked.min + Math.floor(Math.random() * (picked.max - picked.min + 1))
  return qty > 0 ? [{ item: picked.item, qty }] : []
}
