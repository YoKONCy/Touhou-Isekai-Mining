import type { CharacterProfile } from '../shared/profile'
import type { ModuleActions } from '../shared/moduleActions'
import type { EquipSlot, ItemId } from '../shared/itemDefs'
import type { Slot } from '../shared/inventory'
import { getItemDef } from '../shared/itemDefs'
import { ENABLED_SLOTS, EQUIP_SLOT_META, slotAccepts } from '../shared/equipment'
import { QUICK_ACCEPT_KINDS } from '../shared/quickSlots'

export type ItemSlotKey = `inv:${number}` | `storage:${number}` | `quick:${number}` | `eq:${EquipSlot}`
export type ItemAction = 'use' | 'equip' | 'unequip'
export interface InventorySlotAccess {
  keys(includeEquipment?:boolean):ItemSlotKey[]
  get(key:ItemSlotKey):Slot
  set(key:ItemSlotKey,stack:Slot):boolean
  accepts(key:ItemSlotKey,id:ItemId):boolean
  canTake(key:ItemSlotKey):boolean
  targets(key:ItemSlotKey,id:ItemId):ItemSlotKey[]
  action(key:ItemSlotKey):ItemAction|null
  perform(key:ItemSlotKey):boolean
  drop(stack:NonNullable<Slot>):boolean
}

/** 背包、快捷槽、装备和仓库共用数据适配器，所有数量直接写回档案唯一真值。 */
export function inventorySlots(profile:CharacterProfile,actions:ModuleActions,withStorage=false):InventorySlotAccess {
  const ordinary:ItemSlotKey[]=[
    ...profile.inventory.slots.map((_,i)=>`inv:${i}` as ItemSlotKey),
    ...profile.quickSlots.slots.map((_,i)=>`quick:${i}` as ItemSlotKey),
    ...(withStorage?profile.storage.slots.map((_,i)=>`storage:${i}` as ItemSlotKey):[])
  ]
  const all=[...ordinary,...EQUIP_SLOT_META.filter(m=>ENABLED_SLOTS.has(m.slot)).map(m=>`eq:${m.slot}` as ItemSlotKey)],valid=new Set(all)
  const keys=(includeEquipment=false)=>includeEquipment?all:ordinary
  const parts=(key:ItemSlotKey)=>key.split(':') as [string,string]
  const array=(kind:string)=>kind==='inv'?profile.inventory.slots:kind==='storage'&&withStorage?profile.storage.slots:kind==='quick'?profile.quickSlots.slots:null
  const get=(key:ItemSlotKey):Slot=>{
    const [kind,index]=parts(key)
    if(kind==='eq'){const id=profile.equipment.get(index as EquipSlot);return id?{id,qty:1}:null}
    return array(kind)?.[Number(index)]??null
  }
  const accepts=(key:ItemSlotKey,id:ItemId)=>{
    if(!valid.has(key))return false
    const [kind,index]=parts(key)
    return kind==='eq'?ENABLED_SLOTS.has(index as EquipSlot)&&slotAccepts(index as EquipSlot,id):kind!=='quick'||QUICK_ACCEPT_KINDS.has(getItemDef(id).kind)
  }
  const set=(key:ItemSlotKey,stack:Slot)=>{
    if(!valid.has(key)||stack&&(!accepts(key,stack.id)||!Number.isInteger(stack.qty)||stack.qty<1||stack.qty>getItemDef(stack.id).maxStack))return false
    const [kind,index]=parts(key)
    if(kind==='eq')return (!stack||stack.qty===1)&&actions.setEquipment(index as EquipSlot,stack?.id??null)
    const slots=array(kind);if(!slots)return false
    slots[Number(index)]=stack?{...stack}:null
    return true
  }
  const targets=(key:ItemSlotKey,id:ItemId)=>{
    const [kind]=parts(key),all=keys()
    if(withStorage)return all.filter(k=>kind==='storage'?k.startsWith('inv:')||k.startsWith('quick:'):k.startsWith('storage:'))
    if(kind!=='inv')return all.filter(k=>k.startsWith('inv:'))
    const equipment=keys(true).filter(k=>k.startsWith('eq:')&&!get(k)&&accepts(k,id))
    return [...equipment,...all.filter(k=>k.startsWith('quick:')&&accepts(k,id))]
  }
  const action=(key:ItemSlotKey):ItemAction|null=>{
    const stack=get(key);if(!stack)return null
    if(key.startsWith('eq:'))return key!=='eq:pick'?'unequip':null
    const d=getItemDef(stack.id)
    return d.consume?.heal?'use':d.equipSlot?'equip':null
  }
  const perform=(key:ItemSlotKey)=>{
    const stack=get(key),kind=action(key);if(!stack||!kind)return false
    if(kind==='unequip')return actions.unequip(parts(key)[1] as EquipSlot)
    if(kind==='use'){
      if(!actions.consumeItem(stack.id))return false
      return set(key,stack.qty>1?{id:stack.id,qty:stack.qty-1}:null)
    }
    if(stack.qty!==1)return false
    if(key.startsWith('inv:'))return actions.equipFromSlot(Number(parts(key)[1]))
    // 从仓库装备时借用一个空背包格，替换下来的装备归还原仓库格。
    const index=profile.inventory.firstEmpty();if(index<0)return false
    profile.inventory.slots[index]={...stack}
    if(!actions.equipFromSlot(index)){profile.inventory.slots[index]=null;return false}
    const old=profile.inventory.slots[index]
    set(key,old);profile.inventory.slots[index]=null
    return true
  }
  return {keys,get,set,accepts,canTake:key=>valid.has(key)&&key!=='eq:pick',targets,action,perform,drop:stack=>!withStorage&&actions.dropHeld(stack)}
}
