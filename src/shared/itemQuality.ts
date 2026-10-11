import type { ItemDef } from '../content/items/types'

export type Grade=1|2|3|4|5|6
export type Rarity=1|2|3|4|5|6|7
export const COSMIC_GRADE:Grade=6
export const QUALITY_DEFAULT_COLOR='#d8c9a6'
export const gradeNameKey=(grade:Grade):string=>`ui.grade.${grade}`
const GRADE_WORLD:Record<Grade,string>={1:'#c9c4bb',2:'#6fc2a0',3:'#cf8bf2',4:'#e8b94a',5:'#e05ec4',6:'#f6ead0'}
const GRADE_UI:Record<Grade,string>={1:'#6f6a60',2:'#2e8b63',3:'#8a3cc0',4:'#9a6b12',5:'#a3267f',6:'#6b5410'}
const RARITY_WORLD:Record<Rarity,string>={1:'#e4e5df',2:'#85cc9b',3:'#84b9f1',4:'#c6a0f2',5:'#f0ce78',6:'#ed8889',7:'#e6c9ef'}
const RARITY_UI:Record<Rarity,string>={1:'#675f54',2:'#31764d',3:'#346b9b',4:'#8154a8',5:'#966a19',6:'#ad414c',7:'#86568c'}

export const isEquipmentItem=(def:ItemDef):boolean=>!!def.equipSlot||['weapon','pick','armor','spellcard'].includes(def.kind)
export function gradeColor(grade:Grade|undefined|null,target:'world'|'ui'='world'):string|null {
  return grade?(target==='ui'?GRADE_UI:GRADE_WORLD)[grade]:null
}
export function rarityColor(rarity:Rarity|undefined|null,target:'world'|'ui'='world'):string|null {
  return rarity?(target==='ui'?RARITY_UI:RARITY_WORLD)[rarity]:null
}
export function itemQualityLevel(def:ItemDef):number{return isEquipmentItem(def)?def.grade??1:def.rarity??1}
export function itemQualityColor(def:ItemDef,target:'world'|'ui'='world'):string {
  return (isEquipmentItem(def)?gradeColor(def.grade??1,target):rarityColor(def.rarity??1,target))??QUALITY_DEFAULT_COLOR
}
export const itemIsPrismatic=(def:ItemDef):boolean=>isEquipmentItem(def)?def.grade===6:def.rarity===7
/** 装备比同等级素材多搜一级，收藏品和消耗品按自身稀有度。 */
export function itemSearchLevel(def:ItemDef):number{return Math.min(7,itemQualityLevel(def)+(isEquipmentItem(def)?1:0))}
export const SEARCH_DURATIONS:readonly number[]=[.8,.95,1.15,1.65,2.3,3.1,4]
export const itemSearchDuration=(def:ItemDef):number=>SEARCH_DURATIONS[itemSearchLevel(def)-1]!
