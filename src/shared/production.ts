import type { CharacterProfile } from './profile'
import type { Slot } from './inventory'
import { RELAY_FLAGS } from '../content/story/mainline/mine-relay/state'
import { getItemDef } from './itemDefs'
import { BAG_REINFORCE_ID } from '../content/items/vanilla/materials/bagUpgrades'
import { SPEAR_TETANUS_ID, WOOD_SHIELD_ID, STRANGE_GEL_ID, SWORD_RUSTY_ID } from '../content/items/vanilla/ids'
import {WOOD_BOW_ID,ELASTIC_CORD_ID,WOOD_ARROW_ID,IRON_ARROW_ID,SWORD_IRON_ID,SPEAR_IRON_ID,PICK_IRON_ID} from '../content/items/vanilla/ids'
import {IRON_WORK_FLAGS} from '../content/story/sidequests/crafting/ironWork'
import { WOOD_ID, ROCK_STONE_ID, FLAX_ID, HEMP_THREAD_ID, SLIME_BALL_ID, COAL_ID, ORE_COPPER_ID, ORE_IRON_ID, COPPER_INGOT_ID, IRON_INGOT_ID, SPEAR_STONE_ID, STAFF_WOOD_ID, SALT_SOUP_ID, SOUP_ID, MUSHROOM_ID, HERB_ID, ROCK_SALT_ID, HEAT_NOZZLE_ID } from '../content/items/vanilla/ids'
export { SOUP_RECIPE, SALT_SOUP_RECIPE } from './cookingRecipes'
import { GRILL_COST } from './cookingRecipes'
import { SILICA_SAND_ID,GLASS_ID,GOLD_INGOT_ID,ORE_GOLD_ID,GOLD_BELL_ID,RUBY_PENDANT_ID,BAT_FEATHER_CHARM_ID,VENOM_VIAL_ID,RUBY_ID,CLOVER_ID,BAT_WING_ID,POISON_GRASS_ID,FORGET_ME_NOT_ID,SMALL_CRYSTAL_CORE_ID } from '../content/items/vanilla/ids'
import { refreshCulinaryProgress } from '../content/story/sidequests/culinary/state'
import { FIRE_CORE_ID,FIRE_CRYSTAL_ID,GUNPOWDER_ID,SULFUR_ID } from '../content/items/vanilla/ids'
import { SALTPETER_ID } from '../content/items/vanilla/materials/saltpeter'

export type MaterialCost=ReadonlyArray<readonly [string,number]>
export interface Recipe {id:string;cost:MaterialCost;qty:number;unlock?:string;discovery?:readonly string[];inventoryUpgrade?:{capacity:number;stage:number}}
/** 批量数量与每种材料统一倍率，非正整数或溢出时不生成配方。 */
export function scaleRecipe(recipe:Recipe,count:number):Recipe|null{
  if(recipe.inventoryUpgrade&&count!==1)return null
  if(!Number.isSafeInteger(count)||count<1||!Number.isSafeInteger(recipe.qty*count)||recipe.cost.some(([,n])=>!Number.isSafeInteger(n*count)))return null
  return {...recipe,qty:recipe.qty*count,cost:recipe.cost.map(([id,n])=>[id,n*count] as const)}
}
export const CRAFT_RECIPES:readonly Recipe[]=[
  {id:FIRE_CRYSTAL_ID,qty:1,unlock:'base.crafting.unlocked',discovery:[RUBY_ID,FIRE_CORE_ID],cost:[[RUBY_ID,1],[FIRE_CORE_ID,1]]},
  {id:GUNPOWDER_ID,qty:3,unlock:'base.crafting.unlocked',discovery:[COAL_ID,SULFUR_ID,SALTPETER_ID],cost:[[COAL_ID,1],[SULFUR_ID,1],[SALTPETER_ID,2]]},
  {id:GOLD_BELL_ID,qty:1,unlock:'base.crafting.unlocked',cost:[[GOLD_INGOT_ID,2],[FORGET_ME_NOT_ID,3],[SMALL_CRYSTAL_CORE_ID,1]]},
  {id:RUBY_PENDANT_ID,qty:1,unlock:'base.crafting.unlocked',cost:[[RUBY_ID,1],[CLOVER_ID,1]]},
  {id:BAT_FEATHER_CHARM_ID,qty:1,unlock:'base.crafting.unlocked',cost:[[BAT_WING_ID,4],[ELASTIC_CORD_ID,1]]},
  {id:VENOM_VIAL_ID,qty:1,unlock:'base.crafting.unlocked',cost:[[GLASS_ID,1],[POISON_GRASS_ID,2],[SLIME_BALL_ID,2]]},
  {id:BAG_REINFORCE_ID,qty:1,unlock:'base.crafting.unlocked',cost:[[ELASTIC_CORD_ID,1],[HEMP_THREAD_ID,2],[WOOD_ID,4]],inventoryUpgrade:{capacity:12,stage:1}},
  {id:ELASTIC_CORD_ID,qty:1,unlock:'base.crafting.unlocked',cost:[[FLAX_ID,3],[SLIME_BALL_ID,1]]},
  {id:WOOD_BOW_ID,qty:1,unlock:'base.crafting.unlocked',cost:[[ELASTIC_CORD_ID,2],[WOOD_ID,8]]},
  {id:WOOD_ARROW_ID,qty:30,unlock:'base.crafting.unlocked',cost:[[WOOD_ID,1],[ROCK_STONE_ID,2],[SLIME_BALL_ID,1]]},
  {id:IRON_ARROW_ID,qty:30,unlock:IRON_WORK_FLAGS.unlocked,cost:[[IRON_INGOT_ID,1],[WOOD_ID,1],[SLIME_BALL_ID,1]]},
  {id:SPEAR_IRON_ID,qty:1,unlock:IRON_WORK_FLAGS.unlocked,cost:[[IRON_INGOT_ID,3],[WOOD_ID,8],[HEMP_THREAD_ID,2],[SLIME_BALL_ID,1]]},
  {id:SWORD_IRON_ID,qty:1,unlock:IRON_WORK_FLAGS.unlocked,cost:[[IRON_INGOT_ID,5],[WOOD_ID,4]]},
  {id:PICK_IRON_ID,qty:1,unlock:IRON_WORK_FLAGS.unlocked,cost:[[IRON_INGOT_ID,5],[WOOD_ID,4]]},
  {id:HEMP_THREAD_ID,qty:1,unlock:'base.crafting.unlocked',cost:[[FLAX_ID,3]]},
  {id:STAFF_WOOD_ID,qty:1,unlock:'base.crafting.unlocked',cost:[[HEMP_THREAD_ID,3],[WOOD_ID,8]]},
  {id:SPEAR_STONE_ID,qty:1,unlock:'base.crafting.unlocked',cost:[[WOOD_ID,6],[ROCK_STONE_ID,4],[HEMP_THREAD_ID,2],[SLIME_BALL_ID,1]]},
  {id:WOOD_SHIELD_ID,qty:1,unlock:'base.crafting.unlocked',cost:[[WOOD_ID,8],[HEMP_THREAD_ID,2]]},
  {id:SPEAR_TETANUS_ID,qty:1,unlock:'recipe.tetanusSpear.unlocked',cost:[[SPEAR_STONE_ID,1],[STRANGE_GEL_ID,1],[SWORD_RUSTY_ID,1]]}
]
export const SMELT_RECIPES:readonly Recipe[]=[{id:COPPER_INGOT_ID,qty:1,unlock:'base.furnace.ready',cost:[[ORE_COPPER_ID,3],[COAL_ID,1]]},{id:IRON_INGOT_ID,qty:1,unlock:'base.furnace.ready',cost:[[ORE_IRON_ID,3],[COAL_ID,1]]},
  {id:GLASS_ID,qty:1,unlock:'base.furnace.ready',cost:[[SILICA_SAND_ID,4]]},{id:GOLD_INGOT_ID,qty:1,unlock:'base.furnace.ready',cost:[[ORE_GOLD_ID,3]]}]
export const SMELT_BATCH_LIMIT=8
export const FURNACE_COSTS:readonly MaterialCost[]=[[[ROCK_STONE_ID,40],[WOOD_ID,15]],[[WOOD_ID,20],[HEMP_THREAD_ID,4],[SLIME_BALL_ID,3]],[[HEAT_NOZZLE_ID,1],[COAL_ID,8]]]
export const sources=(c:CharacterProfile)=>[c.inventory,c.quickSlots,c.storage]
export const materialCount=(c:CharacterProfile,id:string)=>sources(c).reduce((n,inv)=>n+inv.slots.reduce((sum,s)=>sum+(s?.id===id?s.qty:0),0),0)
export const furnaceStage=(c:CharacterProfile)=>Math.floor(Math.max(0,Math.min(3,Number(c.flag('base.furnace.stage'))||0)))
/** 工作桌含铁锭的配方统一受加工小剧情门控，未来新增配方也不能绕过；冶炼本身沿用炉子门控。 */
export function recipeUnlocked(c:CharacterProfile,recipe:Recipe):boolean {
  if(recipe.unlock&&!c.flagBool(recipe.unlock))return false
  if(recipe.discovery&&!recipe.discovery.every(id=>c.discovery.items.has(id)))return false
  if(recipe.inventoryUpgrade){
    const stage=Number(c.flag('base.bag.stage'))||0
    if(stage!==recipe.inventoryUpgrade.stage-1)return false
  }
  return !recipe.cost.some(([id])=>id===IRON_INGOT_ID)||(c.flagBool('base.crafting.unlocked')&&c.flagBool(IRON_WORK_FLAGS.unlocked))
}

/** 所有材料与成品先在副本上完整预演，空间不足时不会扣料；耗尽的原料格可直接放成品。 */
function plan(c:CharacterProfile,cost:MaterialCost,output?:{id:string;qty:number}):Slot[][]|'materials'|'space'{
  const slots=sources(c).map(inv=>inv.slots.map(s=>s?{...s}:null))
  for(const [id,n] of cost){let left=n;for(const inv of slots)for(let i=0;i<inv.length&&left>0;i++){const s=inv[i];if(s?.id!==id)continue;const take=Math.min(left,s.qty);left-=take;inv[i]=s.qty>take?{id,qty:s.qty-take}:null}if(left>0)return 'materials'}
  if(output){let left=output.qty;const bag=slots[0]!,cap=c.inventory.stackLimit(output.id)
    for(const filled of [true,false])for(let i=0;i<bag.length&&left>0;i++){const s=bag[i];if(filled?s?.id!==output.id:!!s)continue;const put=Math.min(left,cap-(s?.qty??0));if(put>0){bag[i]={id:output.id,qty:(s?.qty??0)+put};left-=put}}
    if(left>0)return 'space'
  }
  return slots
}
export function productionStatus(c:CharacterProfile,recipe:Recipe):'ready'|'locked'|'materials'|'space'{
  if(!recipeUnlocked(c,recipe))return 'locked'
  const result=plan(c,recipe.cost,recipe.inventoryUpgrade?undefined:{id:recipe.id,qty:recipe.qty});return typeof result==='string'?result:'ready'
}
export function produce(c:CharacterProfile,recipe:Recipe):'ready'|'locked'|'materials'|'space'{
  // 金属只允许走熔炉批次，不允许由通用即时制作绕过冶炼时间。
  if(SMELT_RECIPES.some(r=>r.id===recipe.id))return 'locked'
  if(!recipeUnlocked(c,recipe))return 'locked'
  const result=plan(c,recipe.cost,recipe.inventoryUpgrade?undefined:{id:recipe.id,qty:recipe.qty});if(typeof result==='string')return result
  sources(c).forEach((inv,index)=>result[index]!.forEach((s,i)=>{inv.slots[i]=s}))
  if(recipe.inventoryUpgrade){
    c.inventory.expand(recipe.inventoryUpgrade.capacity)
    c.setFlag('base.bag.stage',recipe.inventoryUpgrade.stage)
  }
  if(recipe.cost.some(([id])=>id===IRON_INGOT_ID)&&getItemDef(recipe.id).kind==='weapon')c.setFlag(IRON_WORK_FLAGS.crafted,true)
  if(!recipe.inventoryUpgrade){
    if(getItemDef(recipe.id).tags?.includes('dish'))c.discovery.cook(recipe.id,recipe.qty)
    else c.discovery.unlock(recipe.id)
  }
  refreshCulinaryProgress(c)
  return 'ready'
}
export function spendMaterials(c:CharacterProfile,cost:MaterialCost):boolean{
  const result=plan(c,cost);if(typeof result==='string')return false
  sources(c).forEach((inv,index)=>result[index]!.forEach((s,i)=>{inv.slots[i]=s}));return true
}
export function buildGrill(c:CharacterProfile):boolean {
  if(!c.flagBool('quest.grill.accepted')||c.flagBool('base.grill.built')||!spendMaterials(c,GRILL_COST))return false
  c.setFlag('base.grill.built',true)
  return true
}
export function repairFurnace(c:CharacterProfile):boolean{
  const stage=furnaceStage(c)
  if(!c.flagBool('base.furnace.inspected')||stage>=3||!spendMaterials(c,FURNACE_COSTS[stage]!))return false
  c.setFlag('base.furnace.stage',stage+1);if(stage===2)c.setFlag('base.furnace.ready',true);return true
}

export function smeltCost(recipe:Recipe,qty:number):MaterialCost{
  return recipe.cost.map(([id,n])=>[id,n*qty] as const)
}
/** 入炉只扣材料，成品留在炉中，因此无需预先腾出背包格。 */
export function smeltStatus(c:CharacterProfile,recipe:Recipe,qty:number):'ready'|'locked'|'materials'|'busy'{
  if(furnaceStage(c)!==3||!c.flagBool('base.furnace.ready')||!SMELT_RECIPES.some(r=>r.id===recipe.id)||!Number.isInteger(qty)||qty<1||qty>SMELT_BATCH_LIMIT)return 'locked'
  if(c.smelting)return 'busy'
  return typeof plan(c,smeltCost(recipe,qty))==='string'?'materials':'ready'
}
export function startSmelting(c:CharacterProfile,recipe:Recipe,qty:number):boolean{
  if(smeltStatus(c,recipe,qty)!=='ready'||!spendMaterials(c,smeltCost(recipe,qty)))return false
  c.smelting={id:recipe.id,qty,startedRound:c.round,state:'heating'}
  return true
}
/** 仅由正常下矿的成功撤离推进；刷新、回营与死亡均不结算。 */
export function completeSmeltingRun(c:CharacterProfile):void{
  if(c.smelting?.state==='heating'&&c.round>c.smelting.startedRound){c.smelting.state='ready';c.setFlag(IRON_WORK_FLAGS.smelted,true)}
}
/** 全批领取成功后才清空，背包放不下时完整保留成品。 */
export function claimSmelting(c:CharacterProfile):'ready'|'locked'|'space'{
  const batch=c.smelting
  if(batch?.state!=='ready')return 'locked'
  const result=plan(c,[],{id:batch.id,qty:batch.qty})
  if(typeof result==='string')return 'space'
  sources(c).forEach((inv,index)=>result[index]!.forEach((s,i)=>{inv.slots[i]=s}))
  c.smelting=null
  c.setFlag(RELAY_FLAGS.metalClaimed,true)
  c.setFlag(IRON_WORK_FLAGS.smelted,true)
  c.discovery.unlock(batch.id)
  return 'ready'
}

export function smeltClaimStatus(c:CharacterProfile):'ready'|'locked'|'space'{
  const batch=c.smelting
  if(batch?.state!=='ready')return 'locked'
  return typeof plan(c,[],{id:batch.id,qty:batch.qty})==='string'?'space':'ready'
}
