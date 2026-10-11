import type { StatusDefinition } from '../../shared/statusEffects'

/** 四秒十六跳真实伤害；重复施加只刷新时长，保持跳伤节拍，多来源也不叠加。 */
export const BLEEDING:StatusDefinition={
  id:'touhou:bleeding',kind:'debuff',duration:4,interval:.25,stacking:'refresh',unique:true,
  nameKey:'status.bleeding.name',descriptionKey:'status.bleeding.desc',effectKey:'status.bleeding.effect',
  icon:'<svg viewBox="0 0 32 32"><path d="M17 3Q14 11 9 17Q5 24 11 28Q19 32 24 25Q28 18 17 3Z" fill="#a63d57" stroke="#482334" stroke-width="1.5"/><path d="M15 14Q11 19 12 23" fill="none" stroke="#efb0ad" stroke-width="1.5"/></svg>',
  onTick:({owner,instance})=>{if(owner.alive)owner.takeStatusDamage?.(1,instance.source)}
}
