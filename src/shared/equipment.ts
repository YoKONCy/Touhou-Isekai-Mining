/**
 * 装备状态（纸娃娃槽位）：纯数据
 *
 * 当前槽位：武器A/B、镐、符卡A/B、装束、装束时装、饰品 A~F。
 * ENABLED_SLOTS 控制哪些槽位已实装，符卡 A/B 均已开放。
 * 玩家实际攻击招式以这里装备的物品为准（CaveModule 同步给 Player）。
 */
import { getItemDef, type EquipSlot, type ItemId } from './itemDefs'
import { itemStack,type Slot } from './inventory'
import type { PlayerCostume, PlayerVisualCostume } from './playerAppearance'
import {
  SWORD_RUSTY_ID,
  PICK_RUSTY_ID
} from '../content/items/vanilla/ids'

/** 饰品同型六槽（布局/门控/自动归位共用这一份序列，禁止各处各写一份） */
export const TRINKET_SLOTS: readonly EquipSlot[] = [
  'trinketA',
  'trinketB',
  'trinketC',
  'trinketD',
  'trinketE',
  'trinketF'
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
  { slot: 'vanityOutfit', key: 'ui.slot.vanityOutfit' },
  { slot: 'trinketA', key: 'ui.slot.trinketA' },
  { slot: 'trinketB', key: 'ui.slot.trinketB' },
  { slot: 'trinketC', key: 'ui.slot.trinketC' },
  { slot: 'trinketD', key: 'ui.slot.trinketD' },
  { slot: 'trinketE', key: 'ui.slot.trinketE' },
  { slot: 'trinketF', key: 'ui.slot.trinketF' }
]

/** 已实装可交互的槽位（其余灰显不可放） */
export const ENABLED_SLOTS: ReadonlySet<EquipSlot> = new Set<EquipSlot>([
  'pick',
  'weaponA',
  'weaponB',
  'spellA',
  'spellB',
  'outfit',
  'vanityOutfit',
  ...TRINKET_SLOTS
])

/**
 * 物品能否放入指定装备槽（槽位类型门控的唯一真值）：
 * - 武器 A/B 是同型双栏，任意 weapon 类物品都能放（不绑死物品的 equipSlot）；
 * - 符卡 A/B 同型，任意 spellcard 类物品都能放；
 * - 饰品 A~F 同型，物品声明虚拟归槽 `equipSlot: 'trinket'` 即可进任一槽；
 * - 装束时装接受装束类物品，只参与外观，不进入属性与被动结算；
 * - 其余槽位（镐/装束）按物品自带的 equipSlot 精确匹配。
 */
export function slotAccepts(slot: EquipSlot, id: ItemId): boolean {
  const def = getItemDef(id)
  if (slot === 'weaponA' || slot === 'weaponB') return def.kind === 'weapon'
  if (slot === 'spellA' || slot === 'spellB') return def.kind === 'spellcard'
  if (TRINKET_SLOTS.includes(slot)) return def.equipSlot === 'trinket'
  if (slot === 'vanityOutfit') return def.equipSlot === 'outfit'
  return def.equipSlot === slot
}

export class Equipment {
  private changeSerial=0
  private durability:Partial<Record<EquipSlot,number>>={}
  private hiddenVisuals: Partial<Record<EquipSlot, boolean>> = {}
  get revision():number{return this.changeSerial}
  private slots: Record<EquipSlot, ItemId | null> = {
    weaponA: SWORD_RUSTY_ID,
    weaponB: null,
    pick: PICK_RUSTY_ID,
    spellA: null,
    spellB: null,
    outfit: null,
    vanityOutfit: null,
    trinketA: null,
    trinketB: null,
    trinketC: null,
    trinketD: null,
    trinketE: null,
    trinketF: null
  }

  get(slot: EquipSlot): ItemId | null {
    return this.slots[slot] ?? null
  }
  /** 隐藏的是该位置的最终穿戴外观，实际装备属性始终保留。 */
  visualVisible(slot: EquipSlot): boolean { return !this.hiddenVisuals[slot] }
  setVisualVisible(slot: EquipSlot, visible: boolean): void {
    if (this.visualVisible(slot) === visible) return
    if (visible) delete this.hiddenVisuals[slot]
    else this.hiddenVisuals[slot] = true
    this.changeSerial++
  }
  visibilityJSON(): EquipSlot[] {
    return (Object.keys(this.slots) as EquipSlot[]).filter(slot => !this.visualVisible(slot))
  }
  restoreVisibility(hidden: readonly EquipSlot[] = []): void {
    for (const slot of Object.keys(this.slots) as EquipSlot[]) this.setVisualVisible(slot, !hidden.includes(slot))
  }
  /** 时装优先于实装；没有对应穿戴素材时继续使用衣架选择的基础服装。 */
  visibleCostume(base: PlayerCostume): PlayerVisualCostume {
    if (!this.visualVisible('outfit')) return base
    const vanity = this.get('vanityOutfit'), actual = this.get('outfit')
    const item = vanity ?? actual
    return item ? getItemDef(item).wearableAppearance ?? base : base
  }
  getStack(slot:EquipSlot):Slot {
    const id=this.get(slot);return id?itemStack(id,1,this.durability[slot]):null
  }
  setStack(slot:EquipSlot,stack:Slot):Slot {
    const old=this.getStack(slot);this.set(slot,stack?.id??null)
    if(stack)this.setDurability(slot,stack.durability)
    return old
  }
  setDurability(slot:EquipSlot,value?:number):void {
    const id=this.get(slot),max=id?getItemDef(id).durability:undefined
    if(max===undefined){delete this.durability[slot];return}
    const next=itemStack(id!,1,value).durability!
    if(this.durability[slot]!==next){this.durability[slot]=next;this.changeSerial++}
  }
  wear(slot:EquipSlot,amount:number):boolean {
    const stack=this.getStack(slot)
    if(stack?.durability===undefined||stack.durability<=0)return false
    this.setDurability(slot,stack.durability-Math.max(0,amount));return true
  }
  durabilityJSON():Partial<Record<EquipSlot,number>> {return {...this.durability}}
  restoreDurability(data:Partial<Record<EquipSlot,number>>={}):void {
    for(const slot of Object.keys(this.slots) as EquipSlot[])this.setDurability(slot,data[slot])
  }

  /** 穿戴；返回被替换下来的旧物品 id（无则 null） */
  set(slot: EquipSlot, id: ItemId | null): ItemId | null {
    const old = this.slots[slot]
    if(old!==id){this.slots[slot] = id;delete this.durability[slot];this.changeSerial++;if(id)this.setDurability(slot)}
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
      if (data[key] !== undefined) this.set(key,data[key]!)
    }
  }
}

/** 同一种饰品仅选一个生效槽；耗尽的消耗型饰品不挡住仍有耐久的同款。 */
export function uniqueTrinketSlots(equipment:Equipment):readonly EquipSlot[] {
  const selected:EquipSlot[]=[],indices=new Map<ItemId,number>()
  for(const slot of TRINKET_SLOTS){
    const id=equipment.get(slot);if(!id)continue
    const index=indices.get(id)
    if(index===undefined){indices.set(id,selected.length);selected.push(slot);continue}
    const previous=equipment.getStack(selected[index]!),current=equipment.getStack(slot)
    if(previous?.durability===0&&(current?.durability??0)>0)selected[index]=slot
  }
  return selected
}
