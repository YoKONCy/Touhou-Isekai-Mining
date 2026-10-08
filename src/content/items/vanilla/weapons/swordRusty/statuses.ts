import type { StatusDefinition } from '../../../../../shared/statusEffects'

/** 破伤风之刃只在暴击命中后附加，重复命中刷新持续时间。 */
export const TETANUS_SLOW: StatusDefinition = {
  id: 'touhou:tetanus_slow', kind: 'debuff', duration: 1.5, stacking: 'refresh',
  nameKey: 'skill.tetanus.name', descriptionKey: 'skill.tetanus.effect',
  modifiers: [{ stat: 'moveSpeed', multiply: .8 }],
  icon: '<svg viewBox="0 0 24 24"><path d="M5 19L17 4L20 5L19 9L8 21Z" fill="#a77658"/><path d="M4 16L10 21M5 21L2 23" stroke="#bcb097" stroke-width="2"/></svg>'
}
