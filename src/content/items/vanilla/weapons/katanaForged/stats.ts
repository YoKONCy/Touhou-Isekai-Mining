import { meleeMove } from '../../../combatComponents'
import type { ItemDef } from '../../../types'

const slash = meleeMove({
  shape: 'slash', damage: 20, reach: 95, angleDegrees: 160,
  windup: .04, active: .16, recover: .20, knockback: 10, stun: .2,
  aoe: { mode: 'secondary', retention: .5 }
})
/** 数值共用，第三段窄矩形宽 30，末段完整一周。 */
export const stats = {
  rarity: 2, tier: 2, maxStack: 1, equipSlot: 'weaponA',
  combat: { penetration: 5, critChance: .18 },
  melee: slash,
  meleePattern: { mode: 'mixed', moves: [
    { ...slash, sweepDirection: 1 },
    { ...slash, sweepDirection: -1 },
    { ...slash, shape: 'stab', stabWidth: 30 },
    { ...slash, arc: Math.PI, sweepDirection: 1 }
  ] }
} satisfies Partial<ItemDef>
