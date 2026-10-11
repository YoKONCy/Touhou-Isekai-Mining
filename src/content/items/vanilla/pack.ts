/**
 * 官方物品包注册清单（vanilla pack = 内置的第一个 MOD）
 *
 * 加新物品的唯二动作：
 * 1. 在本目录新建物品内容文件（简单物品单文件，复杂物品建文件夹）
 * 2. 下面 import + register 各加一行
 * 引擎侧（背包/掉落/UI/渲染）无需任何改动。
 */
import { items } from '../registry'
import { restyleVanillaItem } from '../itemArt'
import oreCopper from './materials/oreCopper'
import oreIron from './materials/oreIron'
import oreGold from './materials/oreGold'
import oreSilver from './materials/oreSilver'
import ruby from './materials/ruby'
import rockStone from './materials/rockStone'
import pickRusty from './weapons/pickRusty'
import swordIron from './weapons/swordIron'
import swordSteel from './weapons/swordSteel'
import swordSilver from './weapons/swordSilver'
import diamondSword from './weapons/swordDiamond'
import soulSlayer from './weapons/soulSlayer'
import swordRusty from './weapons/swordRusty'
import cleaver from './weapons/cleaver'
import uchigatana from './weapons/uchigatana'
import spearStone from './weapons/spearStone'
import spearTetanus from './weapons/spearTetanus'
import woodShield from './armor/woodShield'
import spearIron from './weapons/spearIron'
import obsidianSpear, { reinforcedObsidianSpear } from './weapons/spearObsidian'
import spearRedTassel from './weapons/spearRedTassel'
import staffWood from './weapons/staffWood'
import battleScepter from './weapons/battleScepter'
import katanaForged from './weapons/katanaForged'
import daggerAssault from './weapons/daggerAssault'
import swordSteelBroad from './weapons/swordSteelBroad'
import axeSteel from './weapons/axeSteel'
import dualBlades from './weapons/dualBlades'
import boomerang from './weapons/boomerang'
import nunchaku from './weapons/nunchaku'
import pickIron from './weapons/pickIron'
import pickSteel from './weapons/pickSteel'
import leatherArmor from './armor/leatherArmor'
import doomsday from './weapons/doomsday'
import vorpal from './weapons/vorpal'
import whip from './weapons/whip'
import chainWhip from './weapons/chainWhip'
import spellHarae from './spells/spellHarae'
import darkEcho from './spells/darkEcho'
import { advancedEquipment } from './armor/advancedEquipment'
import foodOnigiri from './food/foodOnigiri'
import matches from './quest/matches'
import fragrantMushroom from './food/fragrantMushroom'
import strangeGel from './food/strangeGel'
import saltpeter from './materials/saltpeter'
import wood from './materials/wood'
import suspiciousMushroom from './materials/suspiciousMushroom'
import herb from './materials/herb'
import slimeBall from './materials/slimeBall'
import mushroomSoup from './food/mushroomSoup'
import { deepMaterials } from './materials/deepMaterials'
import { thirdFloorMaterials } from './materials/thirdFloorMaterials'
import { fourthFloorMaterials } from './materials/fourthFloorMaterials'
import smallCrystalCore from './materials/smallCrystalCore'
import tsukinagaAiTarot from './weapons/tarot'
import scp127 from './weapons/scp127'
import { workshopMaterials } from './materials/workshopMaterials'
import bowWood from './weapons/bowWood'
import bowRanger from './weapons/bowRanger'
import rangerMedal from './armor/rangerMedal'
import { craftedAccessories } from './armor/craftedAccessories'
import { smeltingMaterials } from './materials/smeltingMaterials'
import { oldHellMaterials } from './materials/oldHellMaterials'
import elasticCord from './materials/elasticCord'
import { arrows } from './ammunition/arrows'
import { bagUpgrades } from './materials/bagUpgrades'
import { cuisine } from './food/cuisine'
import { scavengingItems } from './materials/scavenging'
import { UCHIGATANA_ID, WHIP_ID, LEATHER_ARMOR_ID, CLEAVER_ID, NUNCHAKU_ID, ORE_IRON_ID } from './ids'
import { FOOD_ONIGIRI_ID, SOUP_ID, SALT_SOUP_ID } from './ids'

/** 注册全部官方物品（由 content/vanillaPack 在启动期调用一次） */
export function registerVanillaItems(): void {
  const footprints:Record<string,readonly [number,number]>={
    [UCHIGATANA_ID]:[1,3],[WHIP_ID]:[1,3],[LEATHER_ARMOR_ID]:[2,2],[CLEAVER_ID]:[2,1],[NUNCHAKU_ID]:[2,1],[ORE_IRON_ID]:[1,1]
  }
  for (const def of [
    ...scavengingItems,
    ...oldHellMaterials,
    oreCopper,
    oreIron,
    oreGold,
    oreSilver,
    ruby,
    rockStone,
    pickRusty,
    swordIron, swordSteel, swordSilver, diamondSword, soulSlayer, swordRusty, cleaver, uchigatana, boomerang, tsukinagaAiTarot, scp127, bowWood,bowRanger,rangerMedal,elasticCord,...arrows,nunchaku, pickIron, pickSteel, leatherArmor,
    spearStone, spearTetanus, spearIron, obsidianSpear, reinforcedObsidianSpear, spearRedTassel, staffWood, battleScepter, woodShield,
    katanaForged, daggerAssault, dualBlades, swordSteelBroad, axeSteel,
    doomsday,
    vorpal,
    whip,
    chainWhip,
    spellHarae,
    darkEcho,...advancedEquipment,
    foodOnigiri,
    matches,
    fragrantMushroom,
    strangeGel,
    saltpeter,
    wood, suspiciousMushroom, herb, slimeBall, mushroomSoup, smallCrystalCore, ...deepMaterials, ...workshopMaterials, ...thirdFloorMaterials, ...fourthFloorMaterials, ...bagUpgrades, ...cuisine,...craftedAccessories,...smeltingMaterials
  ]) {
    // 所有可堆叠官方物品统一上限，单件装备与叙事物品保持不可堆叠。
    if(def.equipSlot){def.grade??=1;delete def.rarity}
    else{def.rarity??=1;delete def.grade}
    if(footprints[def.id])def.searchFootprint=footprints[def.id]
    if (def.maxStack > 1) def.maxStack = 9999
    if ([FOOD_ONIGIRI_ID, SOUP_ID, SALT_SOUP_ID].includes(def.id)) def.tags = [...new Set([...(def.tags ?? []), 'food', 'dish'])]
    items.register(restyleVanillaItem(def))
  }
}
