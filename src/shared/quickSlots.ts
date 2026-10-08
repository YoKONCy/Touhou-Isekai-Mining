/**
 * 道具快捷栏（3 个可配置槽，数字键 4/5/6）：纯数据
 *
 * 与背包（Inventory）是两个独立容器：玩家在背包面板把消耗品/道具
 * 拖进来配置；拖回背包/丢出世界由 CaveModule 协调两个容器完成。
 * 槽内可堆叠，堆叠上限跟随物品定义。
 */
import { getItemDef, type ItemId, type ItemKind } from './itemDefs'
import type { Slot } from './inventory'

/** 快捷道具槽数量（固定 3，对应键 4/5/6） */
export const QUICK_SLOT_COUNT = 3

/** 允许放进道具快捷槽的物品大类（武器/镐/符卡有专属装备槽） */
export const QUICK_ACCEPT_KINDS: ReadonlySet<ItemKind> = new Set<ItemKind>(['consumable', 'material'])

export class QuickSlots {
  readonly slots: Slot[] = new Array<Slot>(QUICK_SLOT_COUNT).fill(null)

  get(index: number): Slot {
    return this.slots[index] ?? null
  }

  /** 从指定槽拆出 n 个成为光标持有堆（立即扣减）；槽空或 n<=0 返回 null */
  splitAt(index: number, n: number): { id: ItemId; qty: number } | null {
    const s = this.slots[index]
    if (!s || n <= 0) return null
    const take = Math.min(n, s.qty)
    const id = s.id
    s.qty -= take
    if (s.qty <= 0) this.slots[index] = null
    return { id, qty: take }
  }

  /**
   * 光标持有堆存入指定道具槽：受 QUICK_ACCEPT_KINDS 类型门控，
   * 空格直放 / 同类合并到上限，异类或堆满拒绝。
   * @returns 实际存入数量
   */
  depositAt(index: number, stack: { id: ItemId; qty: number }, n: number): number {
    if (n <= 0 || stack.qty <= 0 || !QUICK_ACCEPT_KINDS.has(getItemDef(stack.id).kind)) return 0
    const cap = getItemDef(stack.id).maxStack
    const b = this.slots[index]
    if (b) {
      if (b.id !== stack.id || b.qty >= cap) return 0
      const put = Math.min(n, cap - b.qty, stack.qty)
      b.qty += put
      return put
    }
    const put = Math.min(n, cap, stack.qty)
    this.slots[index] = { id: stack.id, qty: put }
    return put
  }

  /** 直接写入整格（跨容器交换时由 CaveModule 调用） */
  set(index: number, slot: Slot): void {
    this.slots[index] = slot
  }

  /** 消耗 1 个，返回物品 id（空槽返回 null） */
  consumeOne(index: number): ItemId | null {
    const s = this.slots[index]
    if (!s) return null
    s.qty -= 1
    const id = s.id
    if (s.qty <= 0) this.slots[index] = null
    return id
  }

  /** 还能否放入某物品（类型门控 + 堆叠/空位预判） */
  canAccept(id: ItemId): boolean {
    if (!QUICK_ACCEPT_KINDS.has(getItemDef(id).kind)) return false
    const cap = getItemDef(id).maxStack
    for (const s of this.slots) {
      if (!s) return true
      if (s.id === id && s.qty < cap) return true
    }
    return false
  }

  toJSON(): Array<{ id: ItemId; qty: number } | null> {
    return this.slots.map((s) => (s ? { ...s } : null))
  }

  fromJSON(data: Array<{ id: ItemId; qty: number } | null> | undefined): void {
    for (let i = 0; i < this.slots.length; i++) {
      const s = data?.[i]
      this.slots[i] = s ? { ...s } : null
    }
  }

  clear(): void {
    this.slots.fill(null)
  }
}
