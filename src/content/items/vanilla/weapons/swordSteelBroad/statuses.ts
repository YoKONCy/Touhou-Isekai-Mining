import type { StatusDefinition } from '../../../../../shared/statusEffects'

export const HEAVY: StatusDefinition = {
  id: 'touhou:heavy', kind: 'debuff', stacking: 'refresh', heldReleaseDuration: 1,
  nameKey: 'status.heavy.name', descriptionKey: 'status.heavy.desc',
  effectKey: 'status.heavy.effect', conditionKey: 'status.heavy.condition',
  modifiers: [{ stat: 'moveSpeed', percent: -.1 }, { stat: 'dodgeCooldown', percent: .15 }],
  icon: '<svg viewBox="0 0 32 32" fill="none"><path d="M12 9V6Q16 1 20 6V9" stroke="#c0b28a" stroke-width="2.3"/><path d="M10 9H22L27 25Q16 30 5 25Z" fill="#6d7777" stroke="#aab4a6" stroke-width="1.4"/><path d="M11 11H21L24 23H8Z" fill="#909e99"/><path d="M16 12V22M12 18L16 22L20 18" stroke="#e1d2a8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
}
