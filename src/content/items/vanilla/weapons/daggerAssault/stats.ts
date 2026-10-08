import type { ItemDef } from '../../../types'
import { meleeMove } from '../../../combatComponents'

export const DAGGER_REACH=59
export const DAGGER_ARC=130*Math.PI/360
const slash=meleeMove({
  shape:'slash',damage:14,reach:DAGGER_REACH,angleDegrees:130,
  windup:.02,active:.10,recover:.09,knockback:5,stun:.4,
  aoe:{mode:'exponential',retention:.2}
})
/** 三段都是挥砍；前送段只改变动作表现，不切换为矩形戳刺。 */
export const stats={
  rarity:2,tier:2,maxStack:1,equipSlot:'weaponA',
  combat:{penetration:5,critChance:.15},melee:slash,
  meleePattern:{mode:'sequence',moves:[
    {...slash,sweepDirection:-1,aoe:{...slash.aoe!}},
    {...slash,sweepDirection:1,aoe:{...slash.aoe!}},
    {...slash,sweepDirection:-1,aoe:{...slash.aoe!}}
  ]}
} satisfies Partial<ItemDef>
