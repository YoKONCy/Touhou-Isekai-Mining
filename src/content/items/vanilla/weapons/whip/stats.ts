import { meleeMove } from '../../../combatComponents'
import type { ItemDef } from '../../../types'

/** 时间单位为秒，攻击角度为完整角度（度）。 */
export const stats = {
  rarity: 1,
  tier: 1,
  maxStack: 1,
  equipSlot: 'weaponB',
  combat: { penetration: 6 },
  melee: meleeMove({
    shape: 'slash',
    damage: 16,
    reach: 130,
    angleDegrees: 4,
    windup: .08,
    active: .245,
    recover: .325,
    knockback: 50,
    stun: .3,
    aoe: { mode: 'secondary', retention: .1 }
  })
} satisfies Partial<ItemDef>

/** 皮鞭原始视觉按 160 距离设计，所有姿态统一使用该比例。 */
export const WHIP_VISUAL_SCALE = stats.melee.reach / 160
