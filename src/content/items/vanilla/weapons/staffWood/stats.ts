import { meleeMove } from '../../../combatComponents'
import type { ItemDef } from '../../../types'

/** 时间使用秒，160 度为完整扇形角度，两套动作共享同一数值。 */
export const stats = {
  rarity: 1,
  tier: 1,
  maxStack: 1,
  equipSlot: 'weaponA',
  combat: { penetration: 15, critChance: 0 },
  melee: meleeMove({
    shape: 'slash', damage: 12, reach: 85, angleDegrees: 160,
    windup: .10, active: .12, recover: .25,
    knockback: 60, stun: .30,
    aoe: { mode: 'exponential', retention: .90 }
  })
} satisfies Partial<ItemDef>
