import type { WeaponMotionView, WeaponGrip, WeaponBodyMotion } from '../../../types'
import { quantizeDir4 } from '../../../../../game/art/rig/skeleton'

const clamp = (n: number) => Math.max(0, Math.min(1, n))
const smooth = (n: number) => { const p = clamp(n); return p * p * (3 - 2 * p) }
const mix = (a: number, b: number, p: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * p
export const axeDirection = (segment: number) => segment % 2 === 0 ? 1 : -1
/** 半蓄力以上松手即高速旋斩，末段减速制动，整段恰好一周。 */
export const axeSpin = (n: number) => 1 - Math.pow(1 - clamp(n), 2)
const spinning = (v: WeaponMotionView) => (v.chargePower ?? 1) > 1
export function axeFacing(v: WeaponMotionView): number {
  if (v.phase === 'active' && spinning(v)) return v.aim + axeDirection(v.segment) * Math.PI * 2 * axeSpin(1 - v.timer / v.move.active)
  return v.phase === 'none' && !v.charging ? v.bodyFacing ?? v.facing : v.aim
}
/** 斧头先拖住，腰肩发力后骤然加速，末端制动显出斧头的惯性。 */
export function axeSweep(n: number): number {
  const p = clamp(n)
  return p < .16 ? .025 * smooth(p / .16) : p < .84 ? .025 + .95 * smooth((p - .16) / .68) : .975 + .025 * smooth((p - .84) / .16)
}
export function axeIdleAim(v: WeaponMotionView): number {
  const dir = quantizeDir4(v.bodyFacing ?? v.facing)
  const angle = dir === 'left' || dir === 'up' ? -2.79 : -.35
  const idle = angle + Math.sin((v.time ?? 0) * 1.8) * .025 + Math.sin(v.gaitPhase ?? 0) * .035 * (v.gaitWeight ?? 0)
  if (!v.charging) return idle
  const p = v.chargeProgress ?? 0, side = axeDirection(v.segment)
  return mix(idle, v.aim - side * ((v.move.arc ?? 0) + .16), smooth(p)) + Math.sin((v.time ?? 0) * 23) * .009 * p * p
}
export function axeArmAim(v: WeaponMotionView): number {
  if (v.phase === 'none') return axeIdleAim(v)
  if (spinning(v)) {
    const end = v.liftStart + axeDirection(v.segment) * Math.PI * 2
    if (v.phase === 'active') return v.liftStart + (end - v.liftStart) * axeSpin(1 - v.timer / v.move.active)
    if (v.phase === 'recover') return mix(end, axeIdleAim(v), smooth(1 - v.timer / v.move.recover))
    return v.liftStart
  }
  const dir = axeDirection(v.segment), arc = v.move.arc ?? 0, start = v.aim - dir * arc, end = v.aim + dir * arc
  if (v.phase === 'windup') return mix(v.liftStart, start, smooth(1 - v.timer / v.move.windup)) - dir * .09 * Math.sin(clamp(1 - v.timer / v.move.windup) * Math.PI)
  if (v.phase === 'active') return start + (end - start) * axeSweep(1 - v.timer / v.move.active)
  const p = clamp(1 - v.timer / v.move.recover)
  return mix(end, axeIdleAim(v), smooth(p)) + dir * .15 * Math.sin(p * Math.PI)
}
export function axeGrip(v: WeaponMotionView): WeaponGrip {
  const facing = axeFacing(v)
  const dir = quantizeDir4(facing), worldAngle = axeArmAim(v), angle = dir === 'right' ? Math.PI - worldAngle : worldAngle
  const pulse = Math.sin((v.time ?? 0) * 1.8) * .13 + Math.sin(v.gaitPhase ?? 0) * .18 * (v.gaitWeight ?? 0)
  const p = v.charging ? v.chargeProgress ?? 0 : 0
  const radius = v.phase === 'active' ? 4.2 : 3.5
  const main = { x: Math.cos(angle) * radius - Math.cos(angle) * p * 2, y: -4.6 + Math.sin(angle) * radius + pulse - p }
  const bend: 1 | -1 = dir === 'down' ? -1 : 1
  return { offset: -8.5, weight: 1, main, weaponAngle: worldAngle, nearBend: bend, farBend: -bend as 1 | -1,
    inFront: v.phase !== 'none' || v.charging || dir !== 'up' }
}
export function axeBodyMotion(v: WeaponMotionView): WeaponBodyMotion | undefined {
  if (v.phase === 'none' && !v.charging) return undefined
  const dir = axeDirection(v.segment)
  const p = v.phase === 'active' ? clamp(1 - v.timer / v.move.active) : 0
  const force = v.charging ? -.42 * (v.chargeProgress ?? 0) : v.phase === 'active' ? Math.sin(axeSweep(p) * Math.PI) : v.phase === 'windup' ? -.3 * smooth(1 - v.timer / v.move.windup) : .28 * clamp(v.timer / v.move.recover)
  return { facing: axeFacing(v), lean: dir * force * .23, tilt: dir * force * .085,
    rootX: Math.cos(v.aim) * force * 3.4, rootY: Math.sin(v.aim) * force * 3.4 + Math.abs(force) * .7 }
}
