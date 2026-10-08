import type { StatusDefinition } from '../../../../../shared/statusEffects'

export const TAROT_FOOL_SEAL: StatusDefinition = {
  id: 'touhou:tarot_fool_seal', kind: 'debuff', duration: 2, stacking: 'refresh', skillsDisabled: true,
  nameKey: 'tarot.fool.status', descriptionKey: 'tarot.fool.desc',
  icon: '<svg viewBox="0 0 32 32"><path d="M8 4H24V28H8Z" fill="#78638d" stroke="#e5c99b"/><path d="M12 11L20 21M20 11L12 21" stroke="#f1e1c5" stroke-width="2"/></svg>'
}
export const TAROT_TOWER_SLOW: StatusDefinition = {
  id: 'touhou:tarot_tower_slow', kind: 'debuff', duration: 1, stacking: 'refresh',
  modifiers: [{ stat: 'moveSpeed', multiply: .05 }], nameKey: 'tarot.tower.status', descriptionKey: 'tarot.tower.desc',
  icon: '<svg viewBox="0 0 32 32"><path d="M11 5H21L24 27H8Z" fill="#83738d" stroke="#e5c99b"/><path d="M17 3L12 14H20L15 29" fill="none" stroke="#f0ddaf" stroke-width="2"/></svg>'
}
