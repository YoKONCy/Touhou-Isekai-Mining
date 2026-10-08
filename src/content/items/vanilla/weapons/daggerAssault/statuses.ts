import type { StatusDefinition } from '../../../../../shared/statusEffects'

export const ASSAULT_WIND:StatusDefinition={
  id:'touhou:assault_wind',kind:'buff',stacking:'refresh',
  nameKey:'status.assault_wind.name',descriptionKey:'status.assault_wind.desc',effectKey:'status.assault_wind.effect',conditionKey:'status.assault_wind.condition',
  modifiers:[{stat:'moveSpeed',percent:.1},{stat:'dodgeCooldown',multiply:.7}],
  icon:'<svg viewBox="0 0 32 32" fill="none"><path d="M4 11H21Q29 11 27 5Q25 2 22 5M3 17H24Q31 17 27 23Q24 26 21 23M6 24H14" stroke="#b6c6b0" stroke-width="2" stroke-linecap="round"/><path d="M10 3L14 7L7 20L4 22L5 18Z" fill="#d8ddcd" stroke="#728e84"/><path d="M6 19L10 21" stroke="#bea276" stroke-width="1.5"/></svg>'
}
export const WIND_ASSAULT:StatusDefinition={
  id:'touhou:wind_assault',kind:'buff',duration:2,stacking:'refresh',
  nameKey:'status.wind_assault.name',descriptionKey:'status.wind_assault.desc',effectKey:'status.wind_assault.effect',conditionKey:'status.wind_assault.condition',
  modifiers:[{stat:'damageDealt',percent:.2}],
  afterimage:{interval:.065,duration:.18,opacity:.075,minDistance:3.5},
  icon:'<svg viewBox="0 0 32 32" fill="none"><path d="M5 20Q13 28 26 10M4 13Q12 4 25 6" stroke="#8faea7" stroke-width="2" stroke-linecap="round"/><path d="M10 25L6 28L4 26L9 22Z" fill="#49625d" stroke="#b2c5b1"/><path d="M8 21L17 10L27 4L22 15L12 25Z" fill="#d7dece" stroke="#657e78"/><path d="M11 22L23 8" stroke="#f0e7ca"/><path d="M8 21L13 25" stroke="#c7aa76" stroke-width="2"/></svg>'
}
