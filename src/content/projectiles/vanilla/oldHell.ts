import type { ProjectileDef,BulletView } from '../types'
import { drawMoltenProjectile } from '../../../game/art/oldHellFire'
import { BURNING } from '../../statuses/burning'

export const MAGMA_BALL_ID='touhou:magma_ball'
export const WISP_FLAME_ID='touhou:wisp_flame'

function drawFireBullet(v:BulletView,magma:boolean):void {
  drawMoltenProjectile(v.ctx,v.x,v.y,v.angle,v.phase,magma)
}

export const magmaBall:ProjectileDef={id:MAGMA_BALL_ID,speed:250,radius:7,damage:9,maxDistance:480,hitColor:'#f5b578',impactSound:'fire',onHitStatus:BURNING,statusOnBlockedHit:true,
  groundImpact:{radius:27,duration:5,damage:2,interval:1},render:v=>drawFireBullet(v,true),renderRadius:46,tags:['magma','fire']}
export const wispFlame:ProjectileDef={id:WISP_FLAME_ID,speed:540,radius:4,damage:10,life:3,hitColor:'#f5b578',impactSound:'fire',onHitStatus:BURNING,statusOnBlockedHit:true,surviveRoomClear:true,
  render:v=>drawFireBullet(v,false),renderRadius:46,tags:['fire','death_burst']}
