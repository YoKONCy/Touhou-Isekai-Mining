import type { ItemDef } from '../../../types'
import { meleeMove } from '../../../combatComponents'

export const DUAL_REACH = 70
export const DUAL_ARC = 110 * Math.PI / 360
const slash = meleeMove({ shape: 'slash', damage: 10, reach: DUAL_REACH, angleDegrees: 110,
  windup: .02, active: .12, recover: .10, knockback: 10, stun: .3,
  aoe: { mode: 'exponential', retention: .4 } })
/** 普攻全为挥砍，第三段旋斩判定覆盖整圈；技能独立使用矩形刺击。 */
export const DUAL_STAB = { ...slash, shape: 'stab' as const, stabWidth: 24 }
export const stats = {
  rarity: 2, tier: 2, maxStack: 1, equipSlot: 'weaponA',
  combat: { penetration: 6, critChance: .18 }, melee: slash,
  meleePattern: { mode: 'sequence', moves: [
    { ...slash, sweepDirection: 1 }, { ...slash, sweepDirection: -1 },
    { ...slash, arc: Math.PI, sweepDirection: 1 }
  ] }
} satisfies Partial<ItemDef>
