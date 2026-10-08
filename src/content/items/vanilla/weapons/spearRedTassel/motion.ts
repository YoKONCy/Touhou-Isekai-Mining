import type { WeaponMotionView, WeaponGrip, WeaponBodyMotion } from '../../../types'
import { quantizeDir4 } from '../../../../../game/art/rig/skeleton'
import { RED_SPEAR_ARC } from './stats'

const clamp = (v: number) => Math.max(0, Math.min(1, v))
export const redSweep = (p: number) => 1 - Math.pow(1 - clamp((p - .04) / .72), 3)
const smooth = (p: number) => { const t = clamp(p); return t * t * (3 - 2 * t) }
const mix = (a: number, b: number, p: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * p
export function redProgress(v: WeaponMotionView): number {
  const total = v.phase === 'windup' ? v.move.windup : v.phase === 'active' ? v.move.active : v.move.recover
  const p = clamp(1 - v.timer / Math.max(.001, total))
  return v.phase === 'active' && (v.move.repeatHits ?? 1) > 1 ? clamp(p * v.move.repeatHits! - (v.strikeIndex ?? 0)) : p
}
export function redIdleAim(v: WeaponMotionView): number {
  const dir = quantizeDir4(v.bodyFacing ?? v.facing), sway = Math.sin((v.time ?? 0) * 1.8) * .025 + Math.sin(v.gaitPhase ?? 0) * .035 * (v.gaitWeight ?? 0)
  return (dir === 'left' ? .24 : dir === 'right' ? Math.PI - .24 : dir === 'down' ? Math.PI - .26 : .26) + sway
}
/** 枪锋先高举，再沿屏幕竖向砸向瞄准方向的地面；上下朝向也有明确的落差。 */
export const redSlamDrop = (p: number) => smooth((p - .08) / .5)
export function redSlamTip(aim: number, drop: number): { x: number; y: number; angle: number; length: number } {
  const distance = 39 + 49 * drop, height = 85 * (1 - drop)
  const x = Math.cos(aim) * distance, y = Math.sin(aim) * distance - height
  return { x, y, angle: Math.atan2(y, x), length: Math.max(35, Math.hypot(x, y)) }
}
export function redSlamLift(v: WeaponMotionView): number {
  if (v.charging) return smooth(v.chargeProgress ?? 0)
  if (v.phase === 'windup') return 1
  if (v.phase === 'active') return 1 - redSlamDrop(redProgress(v))
  return 0
}
export function redArmAim(v: WeaponMotionView): number {
  if (v.charging) return mix(redIdleAim(v), redSlamTip(v.facing, 0).angle, smooth(v.chargeProgress ?? 0))
  if (v.phase === 'none') return redIdleAim(v)
  const p = redProgress(v), sign = v.segment === 0 ? 1 : -1
  if (v.chargeFull) {
    const raised = redSlamTip(v.aim, 0).angle, grounded = redSlamTip(v.aim, 1).angle
    if (v.phase === 'windup') return mix(v.liftStart, raised, smooth(p / .65))
    if (v.phase === 'active') return redSlamTip(v.aim, redSlamDrop(p)).angle
    return mix(grounded, redIdleAim({ ...v, bodyFacing: v.aim }), smooth(p))
  }
  const start = v.segment === 2 ? v.aim : v.aim - sign * RED_SPEAR_ARC
  const end = v.segment === 2 ? v.aim : v.aim + sign * RED_SPEAR_ARC
  if (v.phase === 'windup') return mix(v.liftStart, start, smooth(p / .7))
  if (v.phase === 'active') return start + (end - start) * redSweep(p)
  return mix(end, redIdleAim({ ...v, bodyFacing: v.aim }), smooth(p))
}
export function redThrust(v: WeaponMotionView): number {
  if (v.phase === 'none') return 0
  const p = redProgress(v)
  if (v.chargeFull) return 0
  if (v.segment !== 2) return 0
  if (v.phase === 'windup') return -15 * smooth(p / .65)
  if (v.phase === 'active') return -12 + 34 * Math.sin(Math.min(1, p / .86) * Math.PI)
  return -12 * (1 - smooth(p))
}
/** 待机仅主手拖枪，左挥接握；后撤横扫逐步放开副手，把长柄重新交回主手。 */
export function redGrip(v: WeaponMotionView): WeaponGrip {
  const dir = quantizeDir4(v.phase === 'none' ? v.charging ? v.facing : v.bodyFacing ?? v.facing : v.aim)
  const axis = redArmAim(v), local = dir === 'right' ? Math.PI - axis : axis, p = redProgress(v)
  const bob = Math.sin((v.time ?? 0) * 2.1) * .22 + Math.cos(v.gaitPhase ?? 0) * .22 * (v.gaitWeight ?? 0)
  const idle = { x: dir === 'down' ? 8 : dir === 'up' ? -8 : -3, y: 2.5 + bob }
  let weight = v.charging ? smooth(v.chargeProgress ?? 0) : v.phase === 'none' ? 0 : v.segment === 0 && v.phase === 'windup' ? smooth(p) : 1
  if (!v.chargeFull && v.segment === 3) weight = v.phase === 'windup' ? 1 : v.phase === 'active' ? 1 - smooth(p) : 0
  const effort = v.charging ? smooth(v.chargeProgress ?? 0) : v.phase === 'none' ? 0 : v.phase === 'windup' ? smooth(p) : v.phase === 'recover' && v.segment === 3 ? 1 - smooth(p) : 1
  const back = v.chargeFull || v.charging ? -3 : v.phase === 'windup' ? -3.8 : -1.4
  const target = { x: Math.cos(local) * back, y: -6 + Math.sin(local) * back - (v.chargeFull || v.charging ? redSlamLift(v) * 1.5 : 0) }
  const main = { x: idle.x + (target.x - idle.x) * effort, y: idle.y + (target.y - idle.y) * effort }
  const spacing = v.chargeFull || v.charging ? 6 : 7
  return { weight: 1, offset: spacing, main, support: { x: main.x + Math.cos(local) * spacing, y: main.y + Math.sin(local) * spacing }, supportWeight: weight,
    weaponAngle: axis, nearBend: dir === 'down' ? -1 : 1, farBend: dir === 'down' ? 1 : -1, inFront: v.phase !== 'none' || v.charging || dir !== 'up' }
}
export function redBodyMotion(v: WeaponMotionView): WeaponBodyMotion | undefined {
  if (v.charging) return { facing: v.facing, rootY: (v.chargeProgress ?? 0) * .8, lean: -.055 * (v.chargeProgress ?? 0) }
  if (v.phase === 'none') return undefined
  if (v.chargeFull) {
    const p = redProgress(v), lift = redSlamLift(v), impact = v.phase === 'active' ? Math.sin(redSlamDrop(p) * Math.PI) : v.phase === 'recover' ? Math.exp(-p * 6) : 0
    return { facing: v.aim, rootY: -lift * 2.2 + impact * 1.8, lean: Math.cos(v.aim) * impact * .12, tilt: Math.cos(v.aim) * impact * .04 }
  }
  const p = redProgress(v), effort = v.phase === 'active' ? Math.sin(Math.min(1, p / .8) * Math.PI) : v.phase === 'windup' ? -.4 * smooth(p) : .16 * (1 - p)
  const thrust = v.segment === 2 ? 2 : v.chargeFull ? 3 : 1.5
  return { facing: v.aim, rootX: Math.cos(v.aim) * effort * thrust, rootY: Math.sin(v.aim) * effort * thrust + (v.chargeFull ? effort : 0),
    lean: (v.segment === 0 ? 1 : -1) * effort * .11, tilt: v.segment === 3 ? -effort * .065 : effort * .025 }
}
