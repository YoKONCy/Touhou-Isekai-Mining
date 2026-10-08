import type { StatusDefinition } from '../../shared/statusEffects'

/** 重复食用刷新持续时间，不叠加画面扭曲强度。 */
export const NAUSEA: StatusDefinition = {
  id: 'touhou:nausea', kind: 'debuff', duration: 8, stacking: 'refresh',
  nameKey: 'status.nausea.name', descriptionKey: 'status.nausea.desc', effectKey: 'status.nausea.effect',
  icon: '<svg viewBox="0 0 32 32" fill="none"><path d="M6 12Q5 4 15 5Q27 5 27 16Q26 27 15 27Q6 27 6 20" stroke="#bec798" stroke-width="2"/><path d="M10 13Q16 8 21 13Q24 19 17 21Q11 22 11 17Q11 14 16 15" stroke="#819873" stroke-width="2"/><path d="M5 14L2 18L8 19M23 26L28 24" stroke="#d8cda2" stroke-width="1.5"/></svg>'
}
