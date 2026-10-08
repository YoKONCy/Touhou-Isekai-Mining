import type { StatusDefinition } from '../../shared/statusEffects'

/** 所有毒液草共用同一毒素来源，重复命中只刷新四秒，不叠减速。 */
export const PARALYSIS_TOXIN:StatusDefinition={
  id:'touhou:paralysis_toxin',kind:'debuff',duration:4,stacking:'refresh',
  nameKey:'status.paralysis.name',descriptionKey:'status.paralysis.desc',effectKey:'status.paralysis.effect',conditionKey:'status.paralysis.condition',
  modifiers:[{stat:'moveSpeed',multiply:0.95}],
  icon:'<svg viewBox="0 0 32 32" fill="none"><path d="M17 3Q27 15 25 23Q23 30 15 29Q5 28 6 20Q7 13 17 3" fill="#8b9f59" stroke="#d0d59a"/><path d="M19 10L13 18H19L13 25" stroke="#363f2c" stroke-width="2"/><path d="M9 21Q9 25 13 26" stroke="#c6d69a"/></svg>'
}
