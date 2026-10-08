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
import ruby from './materials/ruby'
import rockStone from './materials/rockStone'
import pickRusty from './weapons/pickRusty'
import swordIron from './weapons/swordIron'
import swordRusty from './weapons/swordRusty'
import spearStone from './weapons/spearStone'
import spearTetanus from './weapons/spearTetanus'
import woodShield from './armor/woodShield'
import spearIron from './weapons/spearIron'
import spearRedTassel from './weapons/spearRedTassel'
import staffWood from './weapons/staffWood'
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
import spellHarae from './spells/spellHarae'
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
import { workshopMaterials } from './materials/workshopMaterials'
import bowWood from './weapons/bowWood'
import elasticCord from './materials/elasticCord'
import { arrows } from './ammunition/arrows'

/** 注册全部官方物品（由 content/vanillaPack 在启动期调用一次） */
export function registerVanillaItems(): void {
  for (const def of [
    oreCopper,
    oreIron,
    oreGold,
    ruby,
    rockStone,
    pickRusty,
    swordIron, swordRusty, boomerang, tsukinagaAiTarot, bowWood,elasticCord,...arrows,nunchaku, pickIron, pickSteel, leatherArmor,
    spearStone, spearTetanus, spearIron, spearRedTassel, staffWood, woodShield,
    katanaForged, daggerAssault, dualBlades, swordSteelBroad, axeSteel,
    doomsday,
    vorpal,
    whip,
    spellHarae,
    foodOnigiri,
    matches,
    fragrantMushroom,
    strangeGel,
    saltpeter,
    wood, suspiciousMushroom, herb, slimeBall, mushroomSoup, smallCrystalCore, ...deepMaterials, ...workshopMaterials, ...thirdFloorMaterials, ...fourthFloorMaterials
  ]) {
    // 所有可堆叠官方物品统一上限，单件装备与叙事物品保持不可堆叠。
    if (def.maxStack > 1) def.maxStack = 9999
    items.register(restyleVanillaItem(def))
  }
}
