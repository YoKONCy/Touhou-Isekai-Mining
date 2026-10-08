import type { CharacterProfile } from '../../../../shared/profile'
import { WOOD_ID, SOUP_ID, SALT_SOUP_ID, ROCK_STONE_ID, SPELL_HARAE_ID } from '../../../items/vanilla/ids'
import { t, itemName } from '../../../../i18n'
import { SOUP_RECIPE, SALT_SOUP_RECIPE, produce, spendMaterials, scaleRecipe } from '../../../../shared/production'

/** 修缮与烹饪共用同一份配方，界面展示和实际扣料保持一致。 */
export const POT_REPAIR_COST: ReadonlyArray<readonly [string, number]> = [[ROCK_STONE_ID, 30], [WOOD_ID, 20]]
export const SOUP_COOK_COST = SOUP_RECIPE.cost

export function acceptCookingQuest(c:CharacterProfile):void {
  if(c.flagBool('prologue.done')&&!c.flagBool('quest.reimu.cooking.accepted'))c.setFlag('quest.reimu.cooking.accepted',true)
}
/** 材料可放背包或统一仓储；先完整检查再扣除。 */
function spend(c:CharacterProfile,cost:ReadonlyArray<readonly [string,number]>):boolean {
  return spendMaterials(c,cost)
}
export function repairPot(c:CharacterProfile):string {
  if(c.flagBool('base.pot.repaired'))return t('ui.camp.repaired')
  if(!spend(c,POT_REPAIR_COST))return t('ui.camp.materials_missing')
  c.setFlag('base.pot.repaired',true);return t('ui.camp.pot_repaired')
}
export function cookSoupBatch(c:CharacterProfile,id=SOUP_ID,count=1):{ok:boolean;message:string}{
  if(!c.flagBool('base.pot.repaired'))return {ok:false,message:t('ui.camp.need_repair')}
  if(id!==SOUP_ID&&id!==SALT_SOUP_ID)return {ok:false,message:t('quest.reimu_cooking.unavailable')}
  const recipe=scaleRecipe(id===SALT_SOUP_ID?SALT_SOUP_RECIPE:SOUP_RECIPE,count)
  if(!recipe)return {ok:false,message:t('ui.cooking.quantity_invalid')}
  const result=produce(c,recipe)
  return {ok:result==='ready',message:result==='ready'?t('ui.camp.received',{item:itemName(id),qty:recipe.qty}):t(result==='space'?'ui.camp.bag_full':result==='locked'?'quest.reimu_cooking.unavailable':'ui.camp.materials_missing')}
}
export function cookSoup(c:CharacterProfile,id=SOUP_ID,count=1):string {
  return cookSoupBatch(c,id,count).message
}
/** 符礼是否已在装备/背包/仓库任一处（防重复发放）。 */
function ownsHarae(c:CharacterProfile):boolean {
  return c.equipment.get('spellA')===SPELL_HARAE_ID
    || c.equipment.get('spellB')===SPELL_HARAE_ID
    || c.inventory.count(SPELL_HARAE_ID)>0
    || c.storage.count(SPELL_HARAE_ID)>0
}
export function deliverSoup(c:CharacterProfile):string {
  if(!c.flagBool('quest.reimu.cooking.accepted'))return t('quest.reimu_cooking.unavailable')
  if(c.flagBool('quest.reimu.cooking.done'))return t('ui.camp.done')
  const owned=ownsHarae(c)
  // 符卡无处可放时先拦住，不能先扣汤
  if(!owned&&c.equipment.get('spellA')&&!c.inventory.canAdd(SPELL_HARAE_ID)&&!c.storage.canAdd(SPELL_HARAE_ID))return t('ui.camp.bag_full')
  if(!c.flagBool('base.pot.repaired')||!spend(c,[[SOUP_ID,1]]))return t('quest.reimu_cooking.need_soup',{item:itemName(SOUP_ID)})
  if(!owned){
    // 优先装进符卡槽 A；被占用则入背包，背包满则入仓库
    if(!c.equipment.get('spellA'))c.equipment.set('spellA',SPELL_HARAE_ID)
    else if(c.inventory.canAdd(SPELL_HARAE_ID))c.inventory.add(SPELL_HARAE_ID,1)
    else c.storage.add(SPELL_HARAE_ID,1)
  }
  c.setFlag('quest.reimu.cooking.done',true)
  const gain=owned?'':'　'+t('ui.camp.received',{item:itemName(SPELL_HARAE_ID),qty:1})
  return t('quest.reimu_cooking.delivered')+gain
}
