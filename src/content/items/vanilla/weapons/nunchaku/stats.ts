import { meleeMove } from '../../../combatComponents'
import type { ItemDef } from '../../../types'

/** 时间为秒，角度为完整角度（度）。 */
export const stats = {
  grade: 1,
  maxStack: 1,
  equipSlot: 'weaponA',
  combat: {
    critChance: .08,
    penetration: 2
  },
  melee: meleeMove({
    shape: 'slash',
    damage: 15.5,
    reach: 60,
    angleDegrees: 120,
    windup: .07,
    active: .18,
    recover: .08,
    knockback: 30,
    stun: .5,
    aoe: { mode: 'exponential', retention: .1 }
  })
} satisfies Partial<ItemDef>

/** 棍身沿用原来的长度比例；两根棍改由双手各自控制，攻击使用统一扇形判定。 */
export const NUNCHAKU_VISUAL_SCALE = stats.melee.reach / 49
