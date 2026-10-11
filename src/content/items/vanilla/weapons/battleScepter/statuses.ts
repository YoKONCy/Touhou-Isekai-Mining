import type { StatusDefinition } from '../../../../../shared/statusEffects'

/** 无离手残留时间；切换手持时由统一握持来源立即解除。 */
export const SCEPTER_PARRY: StatusDefinition = {
  id: 'touhou:scepter_parry', kind: 'buff', stacking: 'refresh', unique: true,
  nameKey: 'status.scepter_parry.name', effectKey: 'status.scepter_parry.effect',
  descriptionKey: 'status.scepter_parry.desc', conditionKey: 'status.scepter_parry.condition',
  modifiers: [{ stat: 'physicalDamageTaken', multiply: .9 }, { stat: 'projectileReduction', add: 1 }],
  icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M16 2L27 7V17Q26 25 16 30Q6 25 5 17V7Z" fill="#443940" stroke="#b6a58c" stroke-width="1.4"/><path d="M9 23L23 9" stroke="#261e28" stroke-width="4"/><path d="M9 23L23 9" stroke="#927760" stroke-width="2"/><path d="M7 23L9 25L12 22L10 20ZM20 10L22 12L25 9L23 7Z" fill="#82747e" stroke="#c2b5b4" stroke-width=".7"/></svg>'
}
