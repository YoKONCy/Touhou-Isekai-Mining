import { meleeMove } from '../../../combatComponents'
import type { ItemDef } from '../../../types'

/** 采集档位只判门槛，效率是每次扣除的采集HP；时间为秒。 */
export const stats = {
  rarity: 1,
  tier: 1,
  maxStack: 1,
  equipSlot: 'pick',
  miningPower: 1,
  miningEfficiency: 10,
  combat: {
    critChance: .02,
    penetration: 0
  },
  melee: meleeMove({
    shape: 'slash',
    damage: 9,
    reach: 52,
    angleDegrees: 143.2394487827058,
    windup: .07,
    active: .12,
    recover: .22,
    knockback: 0,
    stun: .45,
    aoe: { mode: 'exponential', retention: .01 }
  })
} satisfies Partial<ItemDef>
