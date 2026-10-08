import type { ItemDef } from '../../../types'

/** 时间使用秒；石矛沿锁定方向形成长 90、宽 25 的矩形判定。 */
export const stats = {
  rarity: 1,
  tier: 1,
  maxStack: 1,
  equipSlot: 'weaponA',
  combat: { penetration: 10, critChance: .05 },
  melee: {
    shape: 'stab', damage: 18, reach: 90, stabWidth: 25,
    windup: .10, active: .10, recover: .40,
    knockback: 30, stun: .20,
    aoe: { mode: 'none' }
  }
} satisfies Partial<ItemDef>
