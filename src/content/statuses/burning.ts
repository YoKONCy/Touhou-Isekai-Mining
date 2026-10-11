import type { StatusDefinition } from '../../shared/statusEffects'

/** 所有火焰弹共用一个灼烧实例；重复命中只续时，跳伤节拍保持连续。 */
export const BURNING:StatusDefinition={
  id:'touhou:burning',kind:'debuff',duration:3,interval:1,stacking:'refresh',unique:true,
  nameKey:'status.burning.name',descriptionKey:'status.burning.desc',effectKey:'status.burning.effect',conditionKey:'status.burning.condition',
  icon:'<svg viewBox="0 0 32 32"><path d="M17 3Q23 10 21 15Q26 11 27 19Q28 28 17 30Q5 29 5 21Q5 14 11 9Q9 17 14 19Q19 15 17 3Z" fill="#d5783e" stroke="#edb66e"/><path d="M16 16Q24 23 18 28Q10 28 11 23Q12 19 16 16Z" fill="#f3d18a"/></svg>',
  onTick:({owner,instance})=>{if(owner.alive)owner.takeStatusDamage?.(1,instance.source)}
}
