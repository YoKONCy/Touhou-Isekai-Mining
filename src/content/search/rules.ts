import { Registry } from '../core/Registry'
import type { ItemDef } from '../items/types'
import { isEquipmentItem, itemQualityLevel } from '../../shared/itemQuality'
import { SEARCH_BALANCE, SEARCH_UNLOCK_FLOORS } from './balance'
import type { ResolvedSearchRules, SearchContainerKind, SearchEffectDefinition, SearchFields, SearchGenerationContext, SearchLootModifier, SearchProfile, SearchRoomContext } from './types'

/** 内容包可注册幸运、节庆、诅咒等纯计算修正；行为不写入容器快照。 */
export const searchEffects = new Registry<SearchEffectDefinition>('searchEffect')
const finite = (value: number | undefined, fallback: number): number => value !== undefined && Number.isFinite(value) ? value : fallback
const multiplier = (value: number | undefined): number => Math.max(0, Math.min(16, finite(value, 1)))
const probability = (value: number): number => Math.max(0, Math.min(1, finite(value, 0)))

/** 群系、楼层、房型、区域和具体容器共用同一套解析入口。 */
export function resolveSearchRules(room: SearchRoomContext, kind: SearchContainerKind, sourceId = '', table = '', override?: SearchProfile): ResolvedSearchRules {
  const rules: ResolvedSearchRules = { floor: Math.max(0, Math.floor(finite(room.floor, 1))), density: 1, abundance: 1, rarity: 1, table, counts: [], emptyChance: 0,
    extraRolls: 0, quantityMultiplier: 1, itemWeights: {}, tagWeights: {}, qualityWeights: {}, appliedEffects: [] }
  const layers = [SEARCH_BALANCE.defaults, SEARCH_BALANCE.kinds[kind], SEARCH_BALANCE.biomes[room.biomeId ?? ''],
    SEARCH_BALANCE.floors[room.floor], SEARCH_BALANCE.roomKinds[room.roomKind ?? ''], SEARCH_BALANCE.regions[room.regionId ?? ''],
    room.profile, SEARCH_BALANCE.containers[sourceId], override]
  for (const layer of layers) if (layer) {
    rules.density = Math.min(16, rules.density * multiplier(layer.density))
    rules.abundance = Math.min(16, rules.abundance * multiplier(layer.abundance))
    rules.rarity = Math.min(16, rules.rarity * multiplier(layer.rarity))
    if (layer.counts) rules.counts = layer.counts.filter(c => Number.isFinite(c.count) && Number.isFinite(c.weight) && c.count >= 0 && c.weight > 0)
      .map(c => ({ count: Math.floor(c.count), weight: c.weight }))
    if (layer.table !== undefined) rules.table = layer.table
    if (layer.guaranteedTable !== undefined) rules.guaranteedTable = layer.guaranteedTable
    if (layer.emptyChance !== undefined) rules.emptyChance = probability(layer.emptyChance)
  }
  return rules
}

function mergeWeights(target: Record<string, number>, values: Readonly<Record<string, number>> | undefined): void {
  for (const [id, value] of Object.entries(values ?? {})) {
    if (['__proto__', 'constructor', 'prototype'].includes(id)) continue
    target[id] = Math.min(256, (target[id] ?? 1) * multiplier(value))
  }
}

/** 特殊效果只修正本次规则副本，不更改共享掉落表；相同效果标识只应用一次。 */
export function applySearchEffects(base: ResolvedSearchRules, context: SearchGenerationContext): ResolvedSearchRules {
  const rules = structuredClone(base)
  rules.floor = Math.max(0, Math.floor(finite(context.room.floor, 1)))
  const modifiers: SearchLootModifier[] = [...(context.effects.modifiers ?? [])]
  for (const effect of [...searchEffects.all()].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))) {
    const result = effect.resolve(context)
    if (result) modifiers.push(result)
  }
  for (const effect of modifiers) {
    if (rules.appliedEffects.includes(effect.id)) continue
    rules.appliedEffects.push(effect.id)
    rules.density = Math.min(16, rules.density * multiplier(effect.density))
    rules.abundance = Math.min(16, rules.abundance * multiplier(effect.abundance))
    rules.rarity = Math.min(16, rules.rarity * multiplier(effect.rarity))
    rules.extraRolls = Math.max(-256, Math.min(256, rules.extraRolls + finite(effect.extraRolls, 0)))
    rules.quantityMultiplier = Math.min(16, rules.quantityMultiplier * multiplier(effect.quantityMultiplier))
    if (effect.emptyChance !== undefined) rules.emptyChance = probability(effect.emptyChance)
    mergeWeights(rules.itemWeights, effect.itemWeights)
    mergeWeights(rules.tagWeights, effect.tagWeights)
    mergeWeights(rules.qualityWeights, effect.qualityWeights)
  }
  return rules
}

/** 品阶与非装备稀有度各用自己的等级；不混入仅用于搜索时长的装备加一级规则。 */
export function searchItemWeight(baseWeight: number, item: ItemDef, rules: ResolvedSearchRules): number {
  const floor = rules.floor ?? 1
  if ((item.consume || item.tags?.includes('food')) && floor < SEARCH_UNLOCK_FLOORS.food) return 0
  const exempt = item.equipSlot?.startsWith('trinket') || item.kind === 'spellcard' || item.equipSlot?.startsWith('spell')
  if (!exempt && isEquipmentItem(item) && floor < SEARCH_UNLOCK_FLOORS.equipment) return 0
  const quality = Math.max(1, Math.min(7, itemQualityLevel(item)))
  let weight = Math.max(0, finite(baseWeight, 0)) * rules.rarity ** (quality - 1)
    * (rules.itemWeights[item.id] ?? 1) * (rules.qualityWeights[quality] ?? 1)
  for (const tag of new Set(item.tags ?? [])) weight *= rules.tagWeights[tag] ?? 1
  return Number.isFinite(weight) ? Math.max(0, weight) : 0
}

/** 布景阶段也走相同修正入口；密度为零不会影响导演手动放置的教学容器。 */
export function searchDensity(room: SearchRoomContext, kind: SearchContainerKind, sourceId = '', override?: SearchProfile, containerFields?: SearchFields): number {
  const base = resolveSearchRules(room, kind, sourceId, '', override)
  return applySearchEffects(base, { phase: 'layout', room, kind, sourceId, containerFields, effects: {} }).density
}
