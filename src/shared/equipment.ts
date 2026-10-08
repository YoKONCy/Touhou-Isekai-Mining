/**
 * 装备状态（纸娃娃槽位）：纯数据
 *
 * 当前槽位：武器A/B、镐、符卡A/B、装束（头/身/腿三合一全身槽）、饰品 A~D。
 * ENABLED_SLOTS 控制哪些槽位已实装（符卡 B 仍灰显，其余已开放）。
 * 玩家实际攻击招式以这里装备的物品为准（CaveModule 同步给 Player）。
 */
import { getItemDef, type EquipSlot, type ItemId } from './itemDefs'
import {
  SWORD_RUSTY_ID,
  PICK_RUSTY_ID
} from '../content/items/vanilla/ids'

/** 饰品同型四槽（布局/门控/自动归位共用这一份序列，禁止各处各写一份） */
export const TRINKET_SLOTS: readonly EquipSlot[] = [
  'trinketA',
  'trinketB',
  'trinketC',
  'trinketD'
] as const

/**
 * 槽位展示顺序与语言键（背包面板纸娃娃用；文案在 lang/*.json 的 ui.slot.*）
 */
export const EQUIP_SLOT_META: Array<{ slot: EquipSlot; key: string }> = [
  { slot: 'weaponA', key: 'ui.slot.weaponA' },
  { slot: 'weaponB', key: 'ui.slot.weaponB' },
  { slot: 'pick', key: 'ui.slot.pick' },
  { slot: 'spellA', key: 'ui.slot.spellA' },
  { slot: 'spellB', key: 'ui.slot.spellB' },
  { slot: 'outfit', key: 'ui.slot.outfit' },
  { slot: 'trinketA', key: 'ui.slot.trinketA' },
  { slot: 'trinketB', key: 'ui.slot.trinketB' },
  { slot: 'trinketC', key: 'ui.slot.trinketC' },
  { slot: 'trinketD', key: 'ui.slot.trinketD' }
]

/** 已实装可交互的槽位（其余灰显不可放） */
export const ENABLED_SLOTS: ReadonlySet<EquipSlot> = new Set<EquipSlot>([
  'pick',
  'weaponA',
  'weaponB',
  'spellA',
  'outfit',
  'trinketA',
  'trinketB',
  'trinketC',
  'trinketD'
])

/**
 * 物品能否放入指定装备槽（槽位类型门控的唯一真值）：
 * - 武器 A/B 是同型双栏，任意 weapon 类物品都能放（不绑死物品的 equipSlot）；
 * - 符卡 A/B 同型，任意 spellcard 类物品都能放；
 * - 饰品 A~D 同型，物品声明虚拟归槽 `equipSlot: 'trinket'` 即可进任一槽；
 * - 其余槽位（镐/装束）按物品自带的 equipSlot 精确匹配。
 */
export function slotAccepts(slot: EquipSlot, id: ItemId): boolean {
  const def = getItemDef(id)
  if (slot === 'weaponA' || slot === 'weaponB') return def.kind === 'weapon'
  if (slot === 'spellA' || slot === 'spellB') return def.kind === 'spellcard'
  if (TRINKET_SLOTS.includes(slot)) return def.equipSlot === 'trinket'
  return def.equipSlot === slot
}

export class Equipment {
  private slots: Record<EquipSlot, ItemId | null> = {
    weaponA: SWORD_RUSTY_ID,
    weaponB: null,
    pick: PICK_RUSTY_ID,
    spellA: null,
    spellB: null,
    outfit: null,
    trinketA: null,
    trinketB: null,
    trinketC: null,
    trinketD: null
  }

  get(slot: EquipSlot): ItemId | null {
    return this.slots[slot]
  }

  /** 穿戴；返回被替换下来的旧物品 id（无则 null） */
  set(slot: EquipSlot, id: ItemId | null): ItemId | null {
    const old = this.slots[slot]
    this.slots[slot] = id
    return old
  }

  /** 取某槽位物品定义上的近战招式（无装备/无招式返回 null） */
  meleeOf(slot: EquipSlot) {
    const id = this.slots[slot]
    return id ? getItemDef(id).melee ?? null : null
  }

  toJSON(): Record<EquipSlot, ItemId | null> {
    return { ...this.slots }
  }

  fromJSON(data: Partial<Record<EquipSlot, ItemId | null>>): void {
    for (const key of Object.keys(this.slots) as EquipSlot[]) {
      if (data[key] !== undefined) this.slots[key] = data[key]
    }
  }
}
