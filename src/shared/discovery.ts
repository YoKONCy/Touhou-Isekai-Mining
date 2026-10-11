import type { CharacterProfile } from './profile'
import { findItemDef } from './itemDefs'

/** 永久图鉴只记录种类；烹饪计数单独保存，供任务比较接取后的新增产出。 */
export interface DiscoverySave { items: string[]; cooked: Record<string, number> }
export class ItemDiscovery {
  readonly items = new Set<string>()
  readonly cooked = new Map<string, number>()
  unlock(id: string): void { if (findItemDef(id) && !findItemDef(id)?.tags?.includes('recipe_only')) this.items.add(id) }
  cook(id: string, quantity: number): void {
    this.unlock(id)
    this.cooked.set(id, (this.cooked.get(id) ?? 0) + quantity)
  }
  get dishCount(): number { let count=0; for (const id of this.items) if (findItemDef(id)?.tags?.includes('dish')) count++; return count }
  toJSON(): DiscoverySave { return { items: [...this.items], cooked: Object.fromEntries(this.cooked) } }
  fromJSON(data?: DiscoverySave): void {
    this.items.clear(); this.cooked.clear()
    for (const id of data?.items ?? []) if (typeof id === 'string') this.items.add(id)
    for (const [id, count] of Object.entries(data?.cooked ?? {})) if (Number.isSafeInteger(count) && count > 0) this.cooked.set(id,count)
  }
}
/** 成功带出的装备、道具和素材都登记；失败回营不调用此入口。 */
export function discoverCarried(profile: CharacterProfile, includeStorage = false): void {
  for (const bag of [profile.inventory, profile.quickSlots, profile.trash, ...(includeStorage ? [profile.storage] : [])]) for (const slot of bag.slots) if (slot) profile.discovery.unlock(slot.id)
  for (const id of Object.values(profile.equipment.toJSON())) if (typeof id === 'string') profile.discovery.unlock(id)
}
