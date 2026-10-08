import { meleeMove } from '../../../combatComponents'
import type { ItemDef } from '../../../types'

/** 时间为秒，角度为完整角度（度）。 */
export const stats = {
  rarity: 1,
  tier: 2,
  maxStack: 1,
  equipSlot: 'weaponA',
  combat: {
    critChance: .1,
    penetration: 10
  },
  melee: meleeMove({
    shape: 'slash',
    damage: 17,
    reach: 60,
    angleDegrees: 90,
    windup: .07,
    active: .18,
    recover: .08,
    knockback: 30,
    stun: .5,
    aoe: { mode: 'exponential', retention: .1 }
  })
} satisfies Partial<ItemDef>

/** 原始链棍按 49 距离设计；近棍、链条、自由棍和判定厚度统一放大。 */
export const NUNCHAKU_VISUAL_SCALE = stats.melee.reach / 49
