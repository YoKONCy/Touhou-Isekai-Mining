import { PICK_STEEL_ID } from '../../ids'
import type { ItemDef } from '../../../types'
import ironPick from '../pickIron'
import { drawSteelPick, drawGroundSteelPick, STEEL_PICK_ICON } from './appearance'

/** 动作、采集等级与铁镐一致，战斗伤害和每次采集效率分别独立覆写。 */
const def:ItemDef={
  ...ironPick,id:PICK_STEEL_ID,
  color:'#96a9b6',hi:'#e1e9e8',text:'#d6e3e8',
  miningEfficiency:16,
  combat:{...ironPick.combat},
  melee:{...ironPick.melee!,damage:15,aoe:ironPick.melee!.aoe?{...ironPick.melee!.aoe}:undefined},
  icon:STEEL_PICK_ICON,ground:drawGroundSteelPick,
  weapon:{...ironPick.weapon!,drawHeld:drawSteelPick},
  tags:['tool','pick','steel']
}
export default def
