import { vanilla } from '../../core/ids'
import type { EnemyDef } from '../types'
import { BAT_WING_ID } from '../../items/vanilla/ids'
import { drawBat, drawBatMotion } from './deepEnemyAppearance'
import { drawBatWarning } from './batSprites'

export const CAVE_BAT_ID=vanilla('cave_bat')
const def:EnemyDef={
  id:CAVE_BAT_ID,ai:'charge_cycle',movement:'flying',hp:60,radius:12,exp:6,
  combat:{physicalResist:5,magicResist:5,contactDamage:10,attackCd:1,contactPad:5,knockback:170,recoil:100,stunResist:0},
  palette:{body:'#777080',edge:'#383141',death:'#a795a8',hpBar:'#b5a4bc'},hitMaterial:'bat',
  chargeCycle:{chaseSpeed:140.7,retreatSpeed:140.7,sight:340,triggerRange:260,windup:.4,dashSpeed:492.45,dashDistance:330,dashDamage:10,retreatDuration:[2,3]},
  spawn: { maxFloor: 3,weight:.5,rooms:['normal','exit'],minFloor:2},
  drops:[{item:BAT_WING_ID,chance:.133,qty:1}],
  visual:{render:drawBat,warning:drawBatWarning,motion:drawBatMotion,fastHop:false,antennae:false},tags:['bat','flying','melee']
}
export default def
