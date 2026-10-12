import type { ItemDef } from '../../../types'

/** attackInterval是通用远程攻击间隔（秒），本武器回收后开始计时。 */
export const stats = {
  grade: 1,
  maxStack: 1,
  equipSlot: 'weaponA',
  combat: {
    critChance: 0,
    penetration: 0
  },
  ranged: {
    type: 'boomerang',
    damage: 21,
    speed: 360,
    accuracyPenalty: 5,
    attackInterval: .3,
    aoe: { mode: 'exponential', retention: 1 }
  }
} satisfies Partial<ItemDef>
