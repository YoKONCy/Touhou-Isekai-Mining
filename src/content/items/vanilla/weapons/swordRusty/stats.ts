import { meleeMove } from '../../../combatComponents'
import type { ItemDef } from '../../../types'

/** 时间为秒，角度为完整角度（度）。 */
export const stats = {
  rarity: 1,
  tier: 2,
  maxStack: 1,
  equipSlot: 'weaponA',
  combat: {
    critChance: .18,
    penetration: 5
  },
  melee: meleeMove({
    shape: 'slash',
    damage: 19,
    reach: 60,
    angleDegrees: 143.2394487827058,
    windup: .07,
    active: .12,
    recover: .40,
    knockback: 30,
    stun: .55,
    aoe: { mode: 'exponential', retention: .2 }
  })
} satisfies Partial<ItemDef>
