import type { ItemDef } from '../../../types'
import { meleeMove } from '../../../combatComponents'

export const RED_SPEAR_REACH = 100
export const RED_SPEAR_ARC = 150 * Math.PI / 360
const slash = meleeMove({ shape: 'slash', damage: 36, reach: RED_SPEAR_REACH, angleDegrees: 150,
  windup: .09, active: .12, recover: .18, knockback: 50, stun: .3, aoe: { mode: 'secondary', retention: .5 } })
/** 三戳共用前后摇，各自拥有完整的 120ms 判定和独立命中。 */
export const stats = {
  rarity: 3, tier: 3, maxStack: 1, equipSlot: 'weaponA', combat: { penetration: 20, critChance: .15 }, melee: slash,
  meleePattern: { mode: 'mixed', moves: [
    { ...slash, sweepDirection: 1 }, { ...slash, sweepDirection: -1 },
    { ...slash, shape: 'stab', stabWidth: 26, active: .36, repeatHits: 3, powerCoefficient: .39 },
    { ...slash, sweepDirection: -1, movement: { distance: 42, direction: -1 } }
  ] }
} satisfies Partial<ItemDef>
/** 纵向矩形用于劈砸，外观仍为双手下劈，而不是普通戳刺。 */
export const RED_SPEAR_SLAM = { ...slash, damage: 99, shape: 'stab' as const, reach: 140, stabWidth: 44, contactProgress: .58, movement: { distance: 120, direction: 1 as const } }
