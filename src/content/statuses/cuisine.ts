import type { StatusDefinition } from '../../shared/statusEffects'
import { FOOD_COOLDOWN_SECONDS, SATIETY_ID } from '../../shared/food'

export const SATIETY: StatusDefinition = {
  id: SATIETY_ID, kind: 'debuff', duration: FOOD_COOLDOWN_SECONDS, unique: true, stacking: 'refresh', persistOnDeath: true, preventsEating: true,
  nameKey: 'status.satiety.name', descriptionKey: 'status.satiety.desc', effectKey: 'status.satiety.desc',
  icon: '<svg viewBox="0 0 32 32"><path d="M4 15Q5 28 16 28Q27 28 28 15Z" fill="#bc9a65"/><path d="M7 15H25M11 5V10M17 3V9M23 6V11" fill="none" stroke="#f2dfb8" stroke-width="2"/></svg>'
}

export const SOUP_REGEN: StatusDefinition = {
  id:'touhou:soup_regeneration',kind:'buff',duration:30,interval:2,stacking:'refresh',
  nameKey:'status.soup_regen.name',descriptionKey:'status.soup_regen.desc',effectKey:'status.soup_regen.desc',
  icon:'<svg viewBox="0 0 32 32"><path d="M5 16Q8 29 16 29Q25 29 28 16Z" fill="#9f845e"/><path d="M13 7H19V12H24V18H19V23H13V18H8V12H13Z" fill="#c5d69d"/></svg>',
  onTick:({owner})=>{if(owner.alive)owner.heal(1)}
}
export const JELLY_REGEN: StatusDefinition = {
  id:'touhou:jelly_mana',kind:'buff',duration:20,interval:1,stacking:'refresh',
  nameKey:'status.jelly_regen.name',descriptionKey:'status.jelly_regen.desc',effectKey:'status.jelly_regen.desc',
  icon:'<svg viewBox="0 0 32 32"><path d="M16 3Q28 17 25 24Q19 32 9 27Q0 22 16 3Z" fill="#91b7ce"/><path d="M12 13L10 21L17 17" fill="none" stroke="#e4e6cb" stroke-width="2"/></svg>',
  onTick:({owner})=>{if(owner.alive)owner.restoreMana?.(1)}
}
