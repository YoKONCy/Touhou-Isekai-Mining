import type { WeaponMotionView, WeaponGrip, WeaponBodyMotion } from '../../../types'
import { quantizeDir4, dirAngle } from '../../../../../game/art/rig/skeleton'
import { rigPalmOffset } from '../../../../../game/art/rig/handGrip'
import { staffArmAim } from '../staffWood/motion'

export const clamp = (p: number): number => Math.max(0, Math.min(1, p))
export const smooth = (p: number): number => { const t = clamp(p); return t * t * (3 - 2 * t) }
const angleMix = (a: number, b: number, p: number): number => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * p
export function scepterProgress(v: WeaponMotionView): number {
  const duration = v.phase === 'windup' ? v.move.windup : v.phase === 'active' ? v.move.active : v.move.recover
  return clamp(1 - v.timer / Math.max(.001, duration))
}

/** 待机杆身斜置腰侧，跑动压平；朝向只取人物行走方向。 */
export function scepterIdleAim(v: WeaponMotionView): number {
  const dir = quantizeDir4(v.bodyFacing ?? v.facing), gait = clamp(v.gaitWeight ?? 0)
  const angle = dir === 'right' ? -.42 : dir === 'left' ? Math.PI + .42 : dir === 'down' ? .42 : Math.PI - .42
  const flatten = dir === 'right' || dir === 'up' ? .24 : -.24
  return angle + flatten * gait + Math.sin((v.time ?? 0) * 1.8) * .012
}

/** 每个半周对应一端扫过，三整周与六次命中窗口一致。 */
export const scepterSpinAngle = (aim: number, progress: number): number => aim - Math.PI / 2 + progress * Math.PI * 6
/** 前摇前七成迅速甩到后肩；落棍明显加速，在判定窗口的百分之四十八触地。 */
const slamBack = (progress: number): number => 1 - Math.pow(1 - clamp(progress / .7), 3)
export const scepterSlamDrop = (progress: number): number => Math.pow(clamp((progress - .02) / .46), 2.4)
const backswingAngle = (aim: number): number => aim + Math.PI + (Math.cos(aim) >= 0 ? .42 : -.42)
export const scepterSlamAngle = (aim: number, drop: number): number => angleMix(backswingAngle(aim), aim, drop)

export function scepterSlamLift(v: WeaponMotionView): number {
  if (v.segment !== 3 || v.phase === 'none') return 0
  if (v.phase === 'windup') return slamBack(scepterProgress(v))
  return v.phase === 'active' ? 1 - scepterSlamDrop(scepterProgress(v)) : 0
}

/** 最后一段快速滑握后半杆，将整根棍先甩向后肩；其余各段双手握中段。 */
export function scepterGripShift(v: WeaponMotionView): number {
  if (v.phase === 'none' || v.segment !== 3) return 0
  const p = scepterProgress(v)
  return 24 * (v.phase === 'windup' ? slamBack(p) : v.phase === 'recover' ? 1 - smooth(p) : 1)
}

export function scepterArmAim(v: WeaponMotionView): number {
  if (v.phase === 'none') return scepterIdleAim(v)
  const p = scepterProgress(v)
  if (v.segment < 2) {
    if (v.phase !== 'recover') return staffArmAim(v)
    const finish = v.aim + (v.segment === 0 ? 1 : -1) * (v.move.arc ?? 0)
    return angleMix(finish, scepterIdleAim(v), smooth(p))
  }
  if (v.segment === 2) {
    const start = scepterSpinAngle(v.aim, 0), finish = scepterSpinAngle(v.aim, 1)
    if (v.phase === 'windup') return angleMix(v.liftStart, start, smooth(p))
    return v.phase === 'active' ? scepterSpinAngle(v.aim, p) : angleMix(finish, scepterIdleAim(v), smooth(p))
  }
  if (v.phase === 'windup') return angleMix(v.liftStart, backswingAngle(v.aim), slamBack(p))
  return v.phase === 'active' ? scepterSlamAngle(v.aim, scepterSlamDrop(p)) : angleMix(v.aim, scepterIdleAim(v), smooth(p))
}

/** 常态与四段攻击始终双手握杆，走动只保留轻微持杆起伏，不再向后拖单臂。 */
export function scepterGrip(v: WeaponMotionView): WeaponGrip {
  const idle = v.phase === 'none', dir = quantizeDir4(idle ? v.bodyFacing ?? v.facing : v.aim)
  const axis = scepterArmAim(v), local = dir === 'right' ? Math.PI - axis : axis
  const gait = clamp(v.gaitWeight ?? 0), p = scepterProgress(v)
  const nearBend: 1 | -1 = dir === 'down' ? -1 : 1
  const side = dir === 'left' || dir === 'right'
  const spacing = side ? -8 : -6.4
  const back = dirAngle(dir) + Math.PI, localBack = dir === 'right' ? Math.PI - back : back
  const rest = { x: (side ? -4.2 : 0) + Math.cos(local) * -spacing / 2,
    y: -4.3 + Math.sin(local) * -spacing / 2 + Math.sin(v.gaitPhase ?? 0) * .18 * gait }
  let main = rest
  if (!idle) {
    const coil = scepterSlamLift(v)
    // 侧面把双手整体送到胸前，近手靠前、远手靠后，避免双臂在躯干中央交叉重合。
    const target = { x: (side ? -4.2 : 0) + Math.cos(localBack) * 6 * coil + Math.cos(local) * -spacing / 2,
      y: -6 + (Math.sin(localBack) * 2 - 4) * coil + Math.sin(local) * -spacing / 2 }
    const prepare = v.segment === 3 ? slamBack(p) : v.segment === 2 ? smooth(p / .55) : smooth(p)
    const effort = v.phase === 'windup' ? prepare : v.phase === 'recover' ? 1 - smooth(p) : 1
    main = { x: rest.x + (target.x - rest.x) * effort, y: rest.y + (target.y - rest.y) * effort }
  }
  const behindSlam = v.segment === 3 && (v.phase === 'windup' && p > .25
    || v.phase === 'active' && scepterSlamDrop(p) < .3)
  return { offset: spacing, weight: 1, main, supportWeight: 1, palmOffset: rigPalmOffset(),
    support: { x: main.x + Math.cos(local) * spacing, y: main.y + Math.sin(local) * spacing },
    weaponAngle: axis, nearBend, farBend: -nearBend as 1 | -1,
    inFront: idle ? dir !== 'up' : !behindSlam }
}

export function scepterBodyMotion(v: WeaponMotionView): WeaponBodyMotion | undefined {
  if (v.phase === 'none') return undefined
  const p = scepterProgress(v)
  if (v.segment === 3) {
    const coil = scepterSlamLift(v), drop = scepterSlamDrop(p)
    const follow = v.phase === 'active' ? Math.pow(drop, .7) : v.phase === 'recover' ? Math.exp(-p * 6) : 0
    const force = -.19 * coil + .25 * follow
    return { facing: v.aim, rootX: Math.cos(v.aim) * (-3 * coil + 3.8 * follow),
      rootY: -3.5 * coil + 2 * follow, lean: Math.cos(v.aim) * force, tilt: Math.cos(v.aim) * force * .28 }
  }
  const strength = v.phase === 'active' ? 1 : v.phase === 'windup' ? smooth(p) : 1 - smooth(p)
  if (v.segment === 2) return { facing: v.aim, rootY: -.6 * strength, lean: Math.sin(p * Math.PI * 6) * .045 * strength }
  return { facing: v.aim, lean: (v.segment === 0 ? 1 : -1) * Math.sin(p * Math.PI) * .09 * strength }
}
