import { ORE_SILVER_ID } from '../../items/vanilla/ids'
import { MINERAL_SILVER_ID } from './ids'
import type { MineralDef } from '../types'

/** 第五层起出现的银白片脉，使用二级镐力开采。 */
const def:MineralDef={
  id:MINERAL_SILVER_ID,dropItemId:ORE_SILVER_ID,hp:[140,170],requiredMiningPower:2,
  palette:{base:'#585463',baseDark:'#343141',crystal:'#b4c2cb',crystalDark:'#67788c',hi:'#e8eee1',light:'#c4dae6'},
  text:'#d6e2e7',spawn:{weight:.08,minFloor:5},visual:{form:'silver',glowPower:.12},tags:['metal','rare']
}
export default def
