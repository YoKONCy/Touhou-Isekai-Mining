import { SPEAR_IRON_ID } from '../../ids'
import type { ItemDef } from '../../../types'
import stoneSpear from '../spearStone'
import { drawIronSpear, drawGroundIronSpear, IRON_SPEAR_ICON } from './appearance'

/** 沿用石矛的双手戳击、蓄势与单体判定，仅覆写数值和材质。 */
const def:ItemDef={
  ...stoneSpear,id:SPEAR_IRON_ID,
  color:'#82939c',hi:'#dce2d8',text:'#cedbdc',
  combat:{...stoneSpear.combat,penetration:12,critChance:.08},
  melee:{...stoneSpear.melee!,damage:23,aoe:stoneSpear.melee!.aoe?{...stoneSpear.melee!.aoe}:undefined},
  icon:IRON_SPEAR_ICON,ground:drawGroundIronSpear,
  weapon:{...stoneSpear.weapon!,drawHeld:drawIronSpear,trail:stoneSpear.weapon!.trail?{...stoneSpear.weapon!.trail}:undefined},
  tags:['weapon','spear','iron']
}
export default def
