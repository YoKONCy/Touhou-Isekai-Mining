import type { StatusDefinition } from '../../../../../shared/statusEffects'

export const RED_DRAGON: StatusDefinition = {
  id: 'touhou:red_dragon', kind: 'buff', stacking: 'refresh',
  nameKey: 'status.red_dragon.name', descriptionKey: 'status.red_dragon.desc', effectKey: 'status.red_dragon.effect', conditionKey: 'status.red_dragon.condition',
  modifiers: [{ stat: 'moveSpeed', percent: .15 }, { stat: 'physicalDamageTaken', multiply: .9 }],
  icon: '<svg viewBox="0 0 32 32" fill="none"><path d="M5 24C2 17 20 19 24 11L29 7L24 5L21 8C15 9 13 5 10 8C6 11 18 12 15 15C13 17 6 15 5 20" stroke="#be655e" stroke-width="3" stroke-linecap="round"/><path d="m22 7 1-4m2 6 4 1M4 26l6-1" stroke="#e4c8a3" stroke-width="1.4"/><path d="M8 25 24 7" stroke="#ece2d0" stroke-width="1.3"/></svg>'
}

/** 短距进枪的安全窗口，不刷新受伤无敌帧，也不在蓄力期间提前生效。 */
export const RED_SURGE_GUARD: StatusDefinition = {
  id: 'touhou:red_surge_guard', kind: 'buff', duration: .5, stacking: 'refresh', untargetable: true,
  nameKey: 'status.red_surge_guard.name', descriptionKey: 'status.red_surge_guard.desc', effectKey: 'status.red_surge_guard.effect',
  icon: '<svg viewBox="0 0 32 32" fill="none"><path d="M5 18Q5 6 19 5M8 25Q20 28 27 14" stroke="#b86260" stroke-width="2" stroke-linecap="round"/><path d="m8 24 15-17 6-3-3 7-15 17Z" fill="#dbd8cd" stroke="#805d57"/><path d="m19 11 5 4" stroke="#c75c59" stroke-width="2"/></svg>'
}
