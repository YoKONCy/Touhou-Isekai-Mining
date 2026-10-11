import type { Recipe, MaterialCost } from './production'
import type { CharacterProfile } from './profile'
import { CAVE_STEW_ID, LUNCHEON_CAN_ID } from '../content/items/vanilla/ids'
import { SOUP_ID,SALT_SOUP_ID,MUSHROOM_ID,HERB_ID,WOOD_ID,ROCK_SALT_ID,IRON_INGOT_ID,ROCK_STONE_ID,FRAGRANT_MUSHROOM_ID,KEDAMA_TOFU_ID,MISO_ID,STRANGE_GEL_ID,DROOP_FRUIT_ID,MISO_TOFU_SOUP_ID,BITTER_HERB_SOUP_ID,KEDAMA_JELLY_ID,GRILLED_MUSHROOM_ID,GRILLED_TOFU_ID } from '../content/items/vanilla/ids'

export type CookingMethod = 'pot' | 'grill' | 'smoke'
export interface CookingRecipe extends Recipe { method: CookingMethod }
export const SOUP_RECIPE:CookingRecipe={id:SOUP_ID,qty:1,method:'pot',cost:[[MUSHROOM_ID,5],[WOOD_ID,3],[HERB_ID,3]]}
export const SALT_SOUP_RECIPE:CookingRecipe={id:SALT_SOUP_ID,qty:1,method:'pot',unlock:'recipe.saltSoup.unlocked',cost:[...SOUP_RECIPE.cost,[ROCK_SALT_ID,1]]}
export const GRILL_COST:MaterialCost=[[IRON_INGOT_ID,2],[WOOD_ID,8],[ROCK_STONE_ID,6]]
export const COOKING_RECIPES:readonly CookingRecipe[]=[SOUP_RECIPE,SALT_SOUP_RECIPE,
  {id:CAVE_STEW_ID,qty:1,method:'pot',unlock:'recipe.caveStew.unlocked',cost:[[LUNCHEON_CAN_ID,1],[MUSHROOM_ID,2],[ROCK_SALT_ID,2]]},
  {id:GRILLED_MUSHROOM_ID,qty:1,method:'grill',unlock:'base.grill.built',cost:[[FRAGRANT_MUSHROOM_ID,3],[WOOD_ID,1]]},
  {id:GRILLED_TOFU_ID,qty:1,method:'grill',unlock:'base.grill.built',cost:[[KEDAMA_TOFU_ID,3],[WOOD_ID,1]]},
  {id:MISO_TOFU_SOUP_ID,qty:1,method:'pot',unlock:'recipe.misoSoup.unlocked',cost:[[KEDAMA_TOFU_ID,2],[MISO_ID,1]]},
  {id:BITTER_HERB_SOUP_ID,qty:1,method:'pot',unlock:'recipe.culinaryRewards.unlocked',cost:[[HERB_ID,3]]},
  {id:KEDAMA_JELLY_ID,qty:1,method:'pot',unlock:'recipe.culinaryRewards.unlocked',cost:[[STRANGE_GEL_ID,1],[KEDAMA_TOFU_ID,2],[DROOP_FRUIT_ID,1]]}
]
export function cookingRecipes(profile:CharacterProfile,method:CookingMethod):readonly CookingRecipe[]{return COOKING_RECIPES.filter(recipe=>recipe.method===method&&(!recipe.unlock||profile.flagBool(recipe.unlock)))}
