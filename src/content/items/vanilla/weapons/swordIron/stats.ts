import { meleeMove } from '../../../combatComponents'
import type { ItemDef } from '../../../types'

/** 时间为秒，角度为完整角度（度）；保留原1.25弧度半角。 */
export const stats = {
  rarity: 1,
  tier: 2,
  maxStack: 1,
  equipSlot: 'weaponA',
  combat: {
    critChance: .05,
    penetration: 5
  },
  melee: meleeMove({
    shape: 'slash',
    damage: 24,
    reach: 80,
    angleDegrees: 143.2394487827058,
    windup: .06,
    active: .11,
    recover: .35,
    knockback: 30,
    stun: .55,
    aoe: { mode: 'exponential', retention: .4 }
  })
} satisfies Partial<ItemDef>
