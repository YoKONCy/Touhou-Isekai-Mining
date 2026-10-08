import type { StatusDefinition } from '../../shared/statusEffects'

/** 独立的短暂晕眩，重复施加只刷新，不叠加持续时间。 */
export const STUNNED: StatusDefinition = {
  id: 'touhou:stunned', kind: 'debuff', duration: .3, stacking: 'refresh', incapacitated: true,
  nameKey: 'status.stunned.name', descriptionKey: 'status.stunned.desc', effectKey: 'status.stunned.effect',
  icon: '<svg viewBox="0 0 32 32"><path d="m16 3 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z" fill="#dcc586" stroke="#715739"/><path d="M4 25Q16 31 28 25" fill="none" stroke="#baa679" stroke-width="2"/></svg>'
}
