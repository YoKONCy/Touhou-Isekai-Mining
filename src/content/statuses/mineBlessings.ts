import type { StatusDefinition } from '../../shared/statusEffects'

/** 每趟矿洞只抽取一次，持续至本趟结束。 */
export const MINE_BLESSINGS:readonly StatusDefinition[] = [
  {id:'touhou:blessing_wind',kind:'buff',nameKey:'status.blessing_wind.name',descriptionKey:'status.blessing_wind.desc',stacking:'refresh',unique:true,
    modifiers:[{stat:'moveSpeed',multiply:1.1}],icon:'<svg viewBox="0 0 32 32"><path d="M4 11H23Q30 11 27 6Q24 2 21 7M4 16H26M4 21H18Q25 21 23 26Q21 30 17 26" fill="none" stroke="#b6d8c2" stroke-width="2.5" stroke-linecap="round"/></svg>'},
  {id:'touhou:blessing_fire',kind:'buff',nameKey:'status.blessing_fire.name',descriptionKey:'status.blessing_fire.desc',stacking:'refresh',unique:true,
    modifiers:[{stat:'physicalDamageDealt',multiply:1.1}],icon:'<svg viewBox="0 0 32 32"><path d="M17 2Q20 11 26 14Q31 26 20 29Q7 32 5 22Q4 16 10 10L10 19Q17 16 17 2Z" fill="#dd876b"/><path d="M17 16Q25 26 17 29Q10 28 13 23Z" fill="#f4d497"/></svg>'},
  {id:'touhou:blessing_water',kind:'buff',nameKey:'status.blessing_water.name',descriptionKey:'status.blessing_water.desc',stacking:'refresh',unique:true,
    modifiers:[{stat:'hurtIFrame',add:.5}],icon:'<svg viewBox="0 0 32 32"><path d="M16 2Q29 17 27 23Q25 31 16 30Q6 30 5 22Q4 16 16 2Z" fill="#80b6ce"/><path d="M9 21Q9 27 15 27M10 16L12 12" fill="none" stroke="#deedf1" stroke-width="2" stroke-linecap="round"/></svg>'},
  {id:'touhou:blessing_earth',kind:'buff',nameKey:'status.blessing_earth.name',descriptionKey:'status.blessing_earth.desc',stacking:'refresh',unique:true,
    modifiers:[{stat:'physicalResist',add:3}],icon:'<svg viewBox="0 0 32 32"><path d="M6 11L17 5L27 12L29 23L20 29L5 26L2 18Z" fill="#b5a17d" stroke="#e1cfac"/><path d="M6 11L16 17L27 12M16 17L20 29M16 17L2 18" fill="none" stroke="#796952" stroke-width="1.5"/></svg>'}
]

export const DARK_ECHO_SLOW:StatusDefinition={
  id:'touhou:dark_echo_slow',kind:'debuff',duration:1,stacking:'refresh',unique:true,
  nameKey:'status.dark_echo_slow.name',descriptionKey:'status.dark_echo_slow.desc',
  modifiers:[{stat:'moveSpeed',multiply:.2}],
  icon:'<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="#292337" stroke="#b0a2c7"/><path d="M9 12Q16 5 23 12M7 18Q16 9 25 18M11 24Q16 18 21 24" fill="none" stroke="#c4b9d8" stroke-width="1.6"/></svg>'
}
