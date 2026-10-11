import type { StatusDefinition } from '../../shared/statusEffects'

/** 反复命中只刷新持续时间，不重置跳伤计时，也不按命中次数叠加伤害。 */
export const EQUIPMENT_POISON:StatusDefinition={
  id:'touhou:equipment_poison',kind:'debuff',duration:5,interval:1,stacking:'refresh',unique:true,
  nameKey:'status.equipment_poison.name',descriptionKey:'status.equipment_poison.desc',
  icon:'<svg viewBox="0 0 32 32"><path d="M16 3Q27 16 26 23Q23 31 15 29Q5 29 6 20Q7 13 16 3Z" fill="#7d9d57"/><path d="M12 18L14 22M21 18L19 22M13 25H19" stroke="#2d4135" stroke-width="2"/><path d="M12 12L10 17" stroke="#d0dfa0" stroke-width="2"/></svg>',
  onTick:({owner,instance})=>{if(owner.alive)owner.takeStatusDamage?.(1,instance.source)}
}
