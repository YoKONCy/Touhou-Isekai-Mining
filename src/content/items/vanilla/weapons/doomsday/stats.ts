import { meleeMove } from '../../../combatComponents'
import type { ItemDef } from '../../../types'

/** 时间为秒，角度为完整角度（度）。 */
export const stats = {
  grade: 5,
  maxStack: 1,
  equipSlot: 'weaponB',
  combat: {
    critChance: .20,
    penetration: 25
  },
  melee: meleeMove({
    shape: 'slash',
    damage: 66,
    powerCoefficient: 1.8,
    reach: 72,
    angleDegrees: 154.69860468532227,
    windup: .08,
    active: .10,
    recover: .32,
    knockback: 260,
    stun: .8,
    aoe: { mode: 'exponential', retention: 1 }
  }),
  empowered: {
    damage: 666,
    reachMultiplier: 3,
    aoe: { mode: 'exponential' as const, retention: 1 }
  }
} satisfies Partial<ItemDef> & { empowered: { damage: number; reachMultiplier: number; aoe: import('../../../combatComponents').AoeFalloff } }
