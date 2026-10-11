import type { ItemDef } from '../../../types'
import { SWORD_DIAMOND_ID } from '../../ids'
import steelSword from '../swordSteel'
import { DIAMOND_SWORD_ICON,drawDiamondSword,drawGroundDiamondSword } from './appearance'
import { drawDiamondSwordTrail,DIAMOND_SWORD_TRAIL_DURATION } from './effects'

/** 剑身模型稍长，攻击距离和三段招式沿用钢剑；仅覆写指定战斗数值。 */
const diamondSword:ItemDef={
  ...steelSword,id:SWORD_DIAMOND_ID,grade:2,color:'#a1cce2',hi:'#f1faff',text:'#d8edf4',
  combat:{...steelSword.combat,critChance:.08,penetration:1.5,magicPenetration:10},
  melee:{...steelSword.melee!,damage:26,recover:.320},
  icon:DIAMOND_SWORD_ICON,ground:drawGroundDiamondSword,tags:['weapon','sword','diamond'],
  weapon:{...steelSword.weapon,autoRepeat:true,customSwingFx:true,drawHeld:drawDiamondSword,fixedMagicDamage:2,
    trail:{duration:DIAMOND_SWORD_TRAIL_DURATION,render:drawDiamondSwordTrail}}
}
export default diamondSword
