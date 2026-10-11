import type { ItemDef } from '../../../types'
import { meleeMove } from '../../../combatComponents'

export const BROADSWORD_REACH = 115
export const BROADSWORD_ARC = Math.PI / 2
const slash = meleeMove({
  shape: 'slash', damage: 38, reach: BROADSWORD_REACH, angleDegrees: 180,
  windup: .35, active: .3, recover: .15, knockback: 80, stun: .8,
  aoe: { mode: 'exponential', retention: .8 }
})
export const stats = {
  grade: 2, maxStack: 1, equipSlot: 'weaponA',
  combat: { penetration: 2, critChance: .08 }, melee: slash,
  meleePattern: { mode: 'sequence', moves: [
    { ...slash, sweepDirection: 1, aoe: { ...slash.aoe! } },
    { ...slash, sweepDirection: -1, aoe: { ...slash.aoe! } }
  ] }
} satisfies Partial<ItemDef>
