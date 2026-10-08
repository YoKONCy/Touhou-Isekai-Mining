import type { ItemDef } from '../../../types'
import { meleeMove } from '../../../combatComponents'

export const AXE_REACH = 90
export const AXE_ARC = 80 * Math.PI / 180
const slash = meleeMove({
  shape: 'slash', damage: 33, reach: AXE_REACH, angleDegrees: 160,
  innerZone: { reach: 60, damage: 19, penetration: 5 },
  windup: .25, active: .3, recover: .15, knockback: 100, stun: .9,
  aoe: { mode: 'exponential', retention: .9 }
})
export const stats = {
  rarity: 2, tier: 2, maxStack: 1, equipSlot: 'weaponA',
  combat: { penetration: 25, critChance: .2 }, melee: slash,
  meleePattern: { mode: 'sequence', moves: [
    { ...slash, sweepDirection: 1 }, { ...slash, sweepDirection: -1 }
  ] }
} satisfies Partial<ItemDef>
