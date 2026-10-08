/**
 * 槽位背包（星露谷式网格）：纯数据，不依赖 Canvas / Vue / 玩法模块
 *
 * 权威状态约定：本类的 slots 是背包唯一真值——
 * 世界拾取、Tab 面板、存档全部读写它，任何 UI 不得另存副本。
 * 布局：cols 列 × rows 行纯网格；快捷栏不是背包的一部分
 * （武器/镐/符卡走 Equipment，3 个可配置道具走 QuickSlots）。
 */
import { getItemDef, type ItemId, type ItemKind } from './itemDefs'

/** 单个格子：空为 null */
export type Slot = { id: ItemId; qty: number } | null

export class Inventory {
  readonly cols: number
  readonly rows: number
  readonly slots: Slot[]

  constructor(cols = 10, rows = 3) {
    this.cols = cols
    this.rows = rows
    this.slots = new Array<Slot>(cols * rows).fill(null)
  }

  get size(): number {
    return this.slots.length
  }

  /**
   * 加入物品：先堆同种现有格，再找空格。
   * @returns 实际入包数量；0 表示背包已满（调用方应让掉落物弹回）
   */
  add(id: ItemId, count = 1): number {
    const cap = getItemDef(id).maxStack
    let remain = count

    // 先填充已有堆叠
    if (cap > 1) {
      for (let i = 0; i < this.slots.length && remain > 0; i++) {
        const s = this.slots[i]
        if (s && s.id === id && s.qty < cap) {
          const put = Math.min(cap - s.qty, remain)
          s.qty += put
          remain -= put
        }
      }
    }
    // 再找空格
    for (let i = 0; i < this.slots.length && remain > 0; i++) {
      if (!this.slots[i]) {
        const put = Math.min(cap, remain)
        this.slots[i] = { id, qty: put }
        remain -= put
      }
    }
    return count - remain
  }

  /** 是否还能至少收入 1 个（掉落磁吸前预判用） */
  canAdd(id: ItemId): boolean {
    const cap = getItemDef(id).maxStack
    for (const s of this.slots) {
      if (!s) return true
      if (s.id === id && s.qty < cap) return true
    }
    return false
  }

  count(id: ItemId): number {
    let n = 0
    for (const s of this.slots) if (s?.id === id) n += s.qty
    return n
  }

  /** 从指定格取出 n 个（默认整堆），返回取出的物品 id（空槽返回 null） */
  removeAt(index: number, n?: number): ItemId | null {
    const s = this.slots[index]
    if (!s) return null
    const take = n === undefined ? s.qty : Math.min(n, s.qty)
    s.qty -= take
    const id = s.id
    if (s.qty <= 0) this.slots[index] = null
    return id
  }

  /**
   * 从指定格拆出 n 个成为光标持有堆（立即扣减，拿起即结算模型）。
   * @returns 拆出的堆；槽空或 n<=0 返回 null（不动数据）
   */
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
   * 把光标持有堆的 n 个存入指定格：空格直放 / 同类合并到上限；
   * 异类或堆满一律拒绝（交换由 UI 层另行组合 splitAt）。
   * @returns 实际存入数量（0 = 未存入，持有堆原样保留）
   */
  depositAt(index: number, stack: { id: ItemId; qty: number }, n: number): number {
    if (n <= 0 || stack.qty <= 0) return 0
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

  /**
   * 拖拽移动：同类尝试合并（受堆叠上限），合不下/异类则整堆交换。
   * 空目标格 = 单纯搬移。
   */
  moveSlots(from: number, to: number): void {
    if (from === to) return
    const a = this.slots[from]
    const b = this.slots[to]
    if (!a) return
    if (b && b.id === a.id) {
      const cap = getItemDef(a.id).maxStack
      const space = cap - b.qty
      if (space <= 0) {
        // 目标堆满：交换
        this.slots[from] = b
        this.slots[to] = a
        return
      }
      const put = Math.min(space, a.qty)
      b.qty += put
      a.qty -= put
      if (a.qty <= 0) this.slots[from] = null
    } else {
      this.slots[from] = b
      this.slots[to] = a
    }
  }

  /** 向指定格硬塞一个物品（装备卸下放回等场景）；空格失败返回 false */
  placeAt(index: number, id: ItemId): boolean {
    if (this.slots[index]) return false
    this.slots[index] = { id, qty: 1 }
    return true
  }

  /** 整理：装备工具、符卡、消耗品、素材、杂项；同类按内容ID稳定排序、合堆、空格后置。 */
  organize(): void {
    const totals = new Map<ItemId, number>()
    for (const s of this.slots) if (s) totals.set(s.id, (totals.get(s.id) ?? 0) + s.qty)
    const order: Record<ItemKind, number> = { weapon: 0, armor: 0, pick: 1, spellcard: 2,ammunition:2.5, consumable: 3, material: 4, misc: 5 }
    const ids = [...totals.keys()].sort((a, b) => {
      const da = getItemDef(a), db = getItemDef(b)
      const rankA = da.equipSlot && da.kind !== 'spellcard' ? 0 : order[da.kind]
      const rankB = db.equipSlot && db.kind !== 'spellcard' ? 0 : order[db.kind]
      return rankA - rankB || a.localeCompare(b)
    })
    this.clear()
    for (const id of ids) this.add(id, totals.get(id)!)
  }

  /** 找第一个空格（没有返回 -1） */
  firstEmpty(): number {
    return this.slots.findIndex((s) => s === null)
  }

  /** 序列化为紧凑数组（存档用；空槽为 null） */
  toJSON(): Array<{ id: ItemId; qty: number } | null> {
    return this.slots.map((s) => (s ? { ...s } : null))
  }

  /** 从存档恢复（长度不符时以当前容量为准截断/补空） */
  fromJSON(data: Array<{ id: ItemId; qty: number } | null>): void {
    for (let i = 0; i < this.slots.length; i++) {
      const s = data?.[i]
      this.slots[i] = s ? { ...s } : null
    }
  }

  clear(): void {
    this.slots.fill(null)
  }
}
