import type { CharacterProfile } from './profile'
import { ENABLED_SLOTS, slotAccepts, TRINKET_SLOTS } from './equipment'
import { getItemDef, type EquipSlot } from './itemDefs'
import type { Slot } from './inventory'
import { QUICK_ACCEPT_KINDS } from './quickSlots'

/** 当前模块提供给背包与快捷栏的最小动作面，不依赖具体玩法模块。 */
export type ModuleActions = Pick<CharacterModuleActions, keyof CharacterModuleActions>

export abstract class CharacterModuleActions {
  constructor(protected readonly character: CharacterProfile) {}
  get inventory() { return this.character.inventory }
  get equipment() { return this.character.equipment }
  get quickSlots() { return this.character.quickSlots }
  /** 控制台按批领取弹药；空间不足时完整拒绝，按钮不会只发一部分。 */
  debugGiveAmmo(id:string,quantity=100):boolean {
    const def=getItemDef(id)
    if(def.kind!=='ammunition'||!Number.isSafeInteger(quantity)||quantity<1)return false
    const space=this.inventory.slots.reduce((n,slot)=>n+(!slot?def.maxStack:slot.id===id?def.maxStack-slot.qty:0),0)
    if(space<quantity)return false
    return this.inventory.add(id,quantity)===quantity
  }
  abstract healPlayer(amount: number): number
  abstract consumeItem(id: string): boolean
  abstract selectHand(index: number): void
  abstract requestCastSpellA(): void
  /** 光标拿放装备的统一入口；镐只能替换，不能卸空。 */
  setEquipment(slot: EquipSlot, id: string | null): boolean {
    if (!ENABLED_SLOTS.has(slot) || slot === 'pick' && !id || id && !slotAccepts(slot, id)) return false
    this.equipment.set(slot, id)
    this.equipmentChanged()
    return true
  }
  protected abstract equipmentChanged(): void
  protected abstract discardStack(slot: NonNullable<Slot>): boolean

  consumeSlot(index: number): boolean {
    const slot = this.inventory.slots[index]
    if (!slot) return false
    if (!this.consumeItem(slot.id)) return false
    this.inventory.removeAt(index, 1)
    return true
  }
  useQuickItem(index: number): boolean {
    const slot = this.quickSlots.get(index)
    if (!slot) return false
    if (!this.consumeItem(slot.id)) return false
    this.quickSlots.consumeOne(index)
    return true
  }
  private merge(src: NonNullable<Slot>, dst: Slot): { src: Slot; dst: Slot } {
    if (dst?.id === src.id) {
      const put = Math.min(getItemDef(src.id).maxStack - dst.qty, src.qty)
      if (put > 0) return { src: src.qty > put ? { id: src.id, qty: src.qty - put } : null, dst: { id: dst.id, qty: dst.qty + put } }
    }
    return { src: dst, dst: src }
  }
  invToQuick(from: number, to: number): boolean {
    const src = this.inventory.slots[from]
    if (!src || !QUICK_ACCEPT_KINDS.has(getItemDef(src.id).kind)) return false
    const result = this.merge(src, this.quickSlots.get(to))
    this.inventory.slots[from] = result.src
    this.quickSlots.set(to, result.dst)
    return true
  }
  quickToInv(from: number, to: number): void {
    const src = this.quickSlots.get(from)
    if (!src) return
    const result = this.merge(src, this.inventory.slots[to])
    this.quickSlots.set(from, result.src)
    this.inventory.slots[to] = result.dst
  }
  quickMove(from: number, to: number): void {
    const src = this.quickSlots.get(from)
    if (!src || from === to) return
    const result = this.merge(src, this.quickSlots.get(to))
    this.quickSlots.set(from, result.src)
    this.quickSlots.set(to, result.dst)
  }
  quickDrop(index: number): void {
    const slot = this.quickSlots.get(index)
    if (slot && this.discardStack(slot)) this.quickSlots.set(index, null)
  }
  dropFromSlot(index: number): void {
    const slot = this.inventory.slots[index]
    if (slot && this.discardStack(slot)) this.inventory.removeAt(index)
  }
  /**
   * 光标持有的拆堆栈丢出世界（右键拆分后点击容器外）。
   * 基地等不允许丢弃的场景返回 false，调用方必须把持有堆归还背包，杜绝吞物。
   */
  dropHeld(stack: NonNullable<Slot>): boolean {
    return this.discardStack(stack)
  }
  equipFromSlot(index: number): boolean {
    const slot = this.inventory.slots[index]
    if (!slot) return false
    const def = getItemDef(slot.id)
    const target = def.kind === 'weapon'
      ? (!this.equipment.get('weaponA') ? 'weaponA' : !this.equipment.get('weaponB') ? 'weaponB' : 'weaponA')
      : def.kind === 'spellcard' ? 'spellA'
        : def.equipSlot === 'trinket' ? TRINKET_SLOTS.find(s => !this.equipment.get(s)) ?? 'trinketA'
          : def.equipSlot
    return target ? this.equipFromSlotTo(index, target) : false
  }
  equipFromSlotTo(index: number, target: EquipSlot): boolean {
    const slot = this.inventory.slots[index]
    if (!slot || !ENABLED_SLOTS.has(target) || !slotAccepts(target, slot.id)) return false
    const old = this.equipment.set(target, slot.id)
    this.inventory.removeAt(index)
    if (old) this.inventory.placeAt(index, old)
    this.equipmentChanged()
    return true
  }
  unequipTo(slot: EquipSlot, index: number): boolean {
    const id = this.equipment.get(slot)
    if (!id || slot === 'pick' || !ENABLED_SLOTS.has(slot) || this.inventory.slots[index]) return false
    this.equipment.set(slot, null)
    this.inventory.placeAt(index, id)
    this.equipmentChanged()
    return true
  }
  unequip(slot: EquipSlot): boolean {
    const index = this.inventory.firstEmpty()
    return index >= 0 && this.unequipTo(slot, index)
  }
}
