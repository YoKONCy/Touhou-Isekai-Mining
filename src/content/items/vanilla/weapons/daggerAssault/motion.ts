import type { WeaponMotionView, WeaponGrip, WeaponBodyMotion } from '../../../types'
import { quantizeDir4 } from '../../../../../game/art/rig/skeleton'
import { armShoulders } from '../../../../../game/art/rig/handGrip'
import { DAGGER_ARC } from './stats'

const clamp=(p:number)=>Math.max(0,Math.min(1,p))
const smooth=(p:number)=>{const t=clamp(p);return t*t*(3-2*t)}
const angleMix=(a:number,b:number,p:number)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*p
export const daggerDirection=(segment:number):1|-1=>segment%3===1?1:-1
export const daggerSweep=(p:number)=>smooth(clamp(p)/.9)
function progress(view:WeaponMotionView):number{
  const duration=view.phase==='windup'?view.move.windup:view.phase==='active'?view.move.active:view.move.recover
  return clamp(1-view.timer/Math.max(.001,duration))
}
export function daggerIdleAim(view:WeaponMotionView):number{
  const dir=quantizeDir4(view.bodyFacing??view.facing)
  return (dir==='down'||dir==='right'?1.15:Math.PI-1.15)+Math.sin((view.time??0)*1.7)*.035+Math.sin(view.gaitPhase??0)*.025*(view.gaitWeight??0)
}
export function daggerBladeAngle(view:WeaponMotionView):number{
  if(view.phase==='none')return daggerIdleAim(view)
  const direction=daggerDirection(view.segment),start=view.aim-direction*DAGGER_ARC,finish=view.aim+direction*DAGGER_ARC,p=progress(view)
  if(view.phase==='windup')return angleMix(view.liftStart,start,smooth(p))
  if(view.phase==='active')return start+(finish-start)*daggerSweep(p)
  return angleMix(finish,daggerIdleAim({...view,bodyFacing:view.aim}),smooth(p))
}
export const daggerArmAim=daggerBladeAngle

/** 主手反解与刀轴分开：柄尾从拇指侧露出，短刃从握拳另一端伸出，副手自由护身。 */
export function daggerGrip(view:WeaponMotionView):WeaponGrip{
  const dir=quantizeDir4(view.phase==='none'?view.bodyFacing??view.facing:view.aim)
  const blade=daggerBladeAngle(view),local=dir==='right'?Math.PI-blade:blade
  const bob=Math.sin((view.time??0)*2.1)*.28+Math.cos(view.gaitPhase??0)*.22*(view.gaitWeight??0)
  const ready={x:dir==='down'?8:dir==='up'?-8:-7,y:-1.8+bob}
  let main=ready
  if(view.phase!=='none'){
    const p=progress(view),shoulder=armShoulders(dir).near
    const radius=view.phase==='active'?(view.segment===1?4.5+4.4*Math.sin(p*Math.PI):view.segment===2?5.8+1.8*Math.sin(p*Math.PI):6.8):5.4
    const target={x:shoulder.x+Math.cos(local)*radius,y:shoulder.y+Math.sin(local)*radius}
    const weight=view.phase==='windup'?smooth(p):view.phase==='recover'?1-smooth(p):1
    main={x:ready.x+(target.x-ready.x)*weight,y:ready.y+(target.y-ready.y)*weight}
  }
  return {offset:0,weight:1,supportWeight:0,main,weaponAngle:blade+Math.PI,nearBend:dir==='down'?-1:1,inFront:view.phase!=='none'||dir!=='up'}
}
export function daggerBodyMotion(view:WeaponMotionView):WeaponBodyMotion|undefined{
  if(view.phase==='none')return undefined
  const p=progress(view),effort=view.phase==='active'?Math.sin(p*Math.PI):view.phase==='recover'?(1-p)*.2:p*.15
  const thrust=view.segment===1?effort*2.8:effort*.7
  return {facing:view.aim,rootX:Math.cos(view.aim)*thrust,rootY:Math.sin(view.aim)*thrust-(view.segment===2?effort*1.7:0),
    lean:daggerDirection(view.segment)*effort*.1,tilt:daggerDirection(view.segment)*effort*.035}
}
