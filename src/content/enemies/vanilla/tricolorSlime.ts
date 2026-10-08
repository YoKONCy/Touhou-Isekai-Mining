import { vanilla } from '../../core/ids'
import type { EnemyDef } from '../types'
import { STRANGE_GEL_ID, SLIME_BALL_ID } from '../../items/vanilla/ids'
import { VENOM_STRAIGHT_ID } from '../../projectiles/vanilla/ids'
import { drawTricolor, tricolorBodyPath } from './tricolorAppearance'
import { drawSlimeWarning, drawSlimeMotion } from './slimeSignals'

export const TRICOLOR_SLIME_ID=vanilla('slime_tricolor')
const def:EnemyDef={
  id:TRICOLOR_SLIME_ID,ai:'charge_cycle',hp:200,radius:22,exp:20,
  combat:{physicalResist:10,magicResist:5,contactDamage:10,attackCd:1,contactPad:6,knockback:230,recoil:140,knockbackResist:40,stunResist:0},
  palette:{body:'#7396a4',edge:'#354a55',death:'#a8aaa5',hpBar:'#c2b685'},hitMaterial:'slime',
  chargeCycle:{chaseSpeed:134,retreatSpeed:147.4,sight:420,triggerRange:180,chaseTimeout:3,windup:.5,dashSpeed:430,dashDistance:135,dashDamage:15,retreatDuration:[3,4],volley:{interval:.9,gap:.1,projectileId:VENOM_STRAIGHT_ID}},
  // 二层仅一个撤离房，固定初始化一只；权重零，所有随机刷怪路径均不会抽到。
  spawn:{weight:0,fixedCount:1,rooms:['exit'],minFloor:2,maxFloor:2},
  drops:[{item:SLIME_BALL_ID,chance:1,qty:1},{item:STRANGE_GEL_ID,chance:1,qty:1}],
  visual:{render:drawTricolor,warning:drawSlimeWarning,motion:drawSlimeMotion,bodyPath:tricolorBodyPath,fastHop:false,antennae:false,horns:false},
  tags:['slime','elite','melee','venom']
}
export default def
