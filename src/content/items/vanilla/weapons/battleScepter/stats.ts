import type { ItemDef } from '../../../types'
import { stats as woodStaff } from '../staffWood/stats'

const sweep = { ...woodStaff.melee, damage: 25 }

/** 地狱合金之杖。默认攻速下花棍持续六百毫秒，六个独立命中窗口各一百毫秒。 */
export const stats = {
  ...woodStaff,
  grade: 2,
  combat: { ...woodStaff.combat, penetration: 3, critChance: .08 },
  melee: sweep,
  meleePattern: { mode: 'mixed', moves: [
    { ...sweep, sweepDirection: 1 },
    { ...sweep, sweepDirection: -1 },
    { ...sweep, damage: 12, reach: 70, active: .6, repeatHits: 6, arc: Math.PI, powerCoefficient: .1 },
    { ...sweep, damage: 42, shape: 'stab', reach: 95, stabWidth: 25, contactProgress: .48 }
  ] }
} satisfies Partial<ItemDef>
