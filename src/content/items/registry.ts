/**
 * 物品注册表（全局唯一一份物品真值）
 */
import { Registry } from '../core/Registry'
import type { ItemDef, ItemId } from './types'

/** 物品注册表单例（官方包/MOD 包都往这里登记） */
export const items = new Registry<ItemDef>('item')

/** 取物品定义（id 缺失抛错——引擎内部"必定存在"的路径用） */
export function getItemDef(id: ItemId): ItemDef {
  return items.require(id)
}

/** 取物品定义（缺失返回 undefined，UI 渲染未知/已移除 MOD 物品时容错用） */
export function findItemDef(id: ItemId): ItemDef | undefined {
  return items.get(id)
}

/** 按矿物 id 反查其掉落物品 id（碎矿链路用；未注册返回 null） */
export function itemIdForMineral(mineralId: string): ItemId | null {
  const hit = items.all().find((d) => d.mineral === mineralId)
  return hit ? hit.id : null
}
