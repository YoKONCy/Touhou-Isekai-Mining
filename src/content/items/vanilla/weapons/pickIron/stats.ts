import { meleeMove } from '../../../combatComponents'
import type { ItemDef } from '../../../types'

/** 独立配置，不继承其他镐的可变数值；时间为秒，完整角度为度。 */
export const stats = {
  rarity: 1,
  tier: 2,
  maxStack: 1,
  equipSlot: 'pick',
  miningPower: 2,
  miningEfficiency: 14,
  combat: {
    critChance: .02,
    penetration: 0
  },
  melee: meleeMove({
    shape: 'slash',
    damage: 13,
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
