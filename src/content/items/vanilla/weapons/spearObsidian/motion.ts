import type { WeaponMotionView,WeaponGrip,WeaponBodyMotion } from '../../../types'
import { quantizeDir4 } from '../../../../../game/art/rig/skeleton'
import { spearIdleAim,spearArmAim,spearArmBend,spearThrust,spearSupportGrip,spearBodyMotion } from '../spearStone/motion'
import { staffArmAim,staffArmBend,staffBodyMotion } from '../staffWood/motion'

/** 横扫使用招式自身的半角，突刺完整沿用矛家族的后引与送杆。 */
export function obsidianArmAim(v:WeaponMotionView):number {
  return v.phase==='none'?spearIdleAim(v):v.move.shape==='stab'?spearArmAim(v):staffArmAim(v)
}
export function obsidianArmBend(v:WeaponMotionView):number {
  return v.phase==='none'?0:v.move.shape==='stab'?spearArmBend(v):staffArmBend(v)
}
export function obsidianThrust(v:WeaponMotionView):number {
  return v.move.shape==='stab'?spearThrust(v):0
}
export function obsidianBodyMotion(v:WeaponMotionView):WeaponBodyMotion|undefined {
  return v.move.shape==='stab'?spearBodyMotion(v):staffBodyMotion(v)
}

/** 两段均由后手推杆、前手扶杆；横扫握点随实际枪轴旋转，四向保持双手接触。 */
export function obsidianGrip(v:WeaponMotionView):WeaponGrip {
  if(v.phase==='none'||v.move.shape==='stab')return spearSupportGrip(v)
  const dir=quantizeDir4(v.bodyFacing??v.facing),axis=obsidianArmAim(v),angle=dir==='right'?Math.PI-axis:axis
  const reach=-2.1+Math.sin((v.time??0)*2.1)*.08,nearBend:1|-1=dir==='down'?-1:1
  return {offset:4.2,weight:1,main:{x:Math.cos(angle)*reach,y:-6+Math.sin(angle)*reach},
    nearBend,farBend:-nearBend as 1|-1,inFront:true}
}
