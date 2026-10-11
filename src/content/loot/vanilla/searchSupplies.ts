import type { LootTable } from '../types'
import { ROCK_STONE_ID,ORE_IRON_ID,ORE_COPPER_ID,COAL_ID,HERB_ID,DARK_ECHO_ID,MINER_HAT_ID,MYSTERIOUS_AMULET_ID,CLEAVER_ID,NUNCHAKU_ID,BOOMERANG_ID,WHIP_ID,LEATHER_ARMOR_ID,UCHIGATANA_ID,RANGER_MEDAL_ID,DIAMOND_ID,HERRING_CAN_ID,LUNCHEON_CAN_ID,MILK_CARTON_ID,CHEESE_ID,WHITE_PEARL_ID,SHRUB_POT_ID,OLD_MINER_OUTFIT_ID,SNOWPEAK_CHARM_ID,CAVE_STEW_RECIPE_ID,RAW_LOG_ID,SLIME_PLUSH_ID } from '../../items/vanilla/ids'

export const SEARCH_SUPPLIES_TABLE='touhou:search_supplies'
export const SEARCH_CHEST_TABLE='touhou:search_chest'
export const SEARCH_PROLOGUE_TABLE='touhou:search_prologue'
export const SEARCH_SEALED_TABLE='touhou:search_sealed_cabinet'
export const SEARCH_SEALED_RARE_TABLE='touhou:search_sealed_rare'
/** 普通杂物白名单；装备、珍珠、玩偶、金刚石和独占解锁物均不在其中。 */
export const SEARCH_COMMON_ITEMS:ReadonlySet<string>=new Set([ROCK_STONE_ID,ORE_COPPER_ID,ORE_IRON_ID,COAL_ID,HERB_ID,HERRING_CAN_ID,LUNCHEON_CAN_ID,MILK_CARTON_ID,CHEESE_ID,RAW_LOG_ID])
/** 非普通杂物的相对权重统一折减；最终概率仍按候选池归一化。 */
export const SEARCH_NON_JUNK_WEIGHT_MULTIPLIER=.25
/** 两列是折减前的相对权重。每条只生成一件，原木与玩偶已占各自份额。 */
const weights:ReadonlyArray<readonly [string,number,number]>=[
  [ROCK_STONE_ID,8,1],[ORE_COPPER_ID,10,4],[ORE_IRON_ID,8,4],[COAL_ID,8,4],[HERB_ID,9,4],
  [HERRING_CAN_ID,6,3],[LUNCHEON_CAN_ID,6,4],[MILK_CARTON_ID,6,4],[CHEESE_ID,5,4],[WHITE_PEARL_ID,4,8],
  [CLEAVER_ID,3,5],[NUNCHAKU_ID,2,5],[BOOMERANG_ID,2,5],[WHIP_ID,2,5],[LEATHER_ARMOR_ID,2,5],[UCHIGATANA_ID,2,5],
  [DARK_ECHO_ID,1,3],[MINER_HAT_ID,1,3],[MYSTERIOUS_AMULET_ID,1,3],[RANGER_MEDAL_ID,1,3],[SNOWPEAK_CHARM_ID,1,3],
  [DIAMOND_ID,.5,2],[SHRUB_POT_ID,1.5,2],[OLD_MINER_OUTFIT_ID,1.5,2],[CAVE_STEW_RECIPE_ID,1.5,2],
  [RAW_LOG_ID,5,3],[SLIME_PLUSH_ID,2,4]
]
const make=(id:string,column:1|2,commonOnly=false):LootTable=>({id,entries:weights
  .filter(entry=>!commonOnly||SEARCH_COMMON_ITEMS.has(entry[0]))
  .map(entry=>({item:entry[0],weight:entry[column]*(SEARCH_COMMON_ITEMS.has(entry[0])?1:SEARCH_NON_JUNK_WEIGHT_MULTIPLIER),min:1,max:1}))})
export const searchChest=make(SEARCH_CHEST_TABLE,2)
export const searchPrologue=make(SEARCH_PROLOGUE_TABLE,1,true)
/** 铁柜其余位置沿用宝箱权重，保底单独抽取；不再额外叠乘品质倍率。 */
export const searchSealed=make(SEARCH_SEALED_TABLE,2)
/** 精良符卡、饰品和金刚石组成稀有保底，避免用普通杂物占据保底名额。 */
const sealedRareItems:ReadonlySet<string>=new Set([DARK_ECHO_ID,MYSTERIOUS_AMULET_ID,RANGER_MEDAL_ID,DIAMOND_ID])
export const searchSealedRare:LootTable={id:SEARCH_SEALED_RARE_TABLE,entries:searchSealed.entries.filter(entry=>sealedRareItems.has(entry.item)).map(entry=>({...entry}))}
export default make(SEARCH_SUPPLIES_TABLE,1)
