import { meleeMove } from '../../../combatComponents'
import type { ItemDef } from '../../../types'

/** 时间为秒，完整角度保留磁盘上的150度。 */
export const stats = {
  rarity: 4,
  tier: 4,
  maxStack: 1,
  equipSlot: 'weaponB',
  combat: {
    critChance: .25,
    penetration: 30
  },
  melee: meleeMove({
    shape: 'slash',
    damage: 299,
    powerCoefficient: 1,
    reach: 120,
    angleDegrees: 150,
    windup: .065,
    active: .105,
    recover: .21,
    knockback: 300,
    stun: .5,
    aoe: { mode: 'exponential', retention: 1 }
  })
} satisfies Partial<ItemDef>
