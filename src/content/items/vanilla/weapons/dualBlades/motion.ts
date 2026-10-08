import type { WeaponMotionView, WeaponGrip, WeaponBodyMotion } from '../../../types'
import { quantizeDir4 } from '../../../../../game/art/rig/skeleton'
import { armShoulders } from '../../../../../game/art/rig/handGrip'
import { DUAL_ARC } from './stats'

const clamp = (p: number) => Math.max(0, Math.min(1, p))
const smooth = (p: number) => { const t = clamp(p); return t * t * (3 - 2 * t) }
/** 短暂咬住起手后迅速甩出，剩余判定时间保留沉刃姿态。 */
export const dualSweep = (p: number) => 1 - Math.pow(1 - clamp((p - .045) / .61), 3)
export const dualSpin = (p: number) => smooth(p / .9)
const mixAngle = (a: number, b: number, p: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * p
export function dualProgress(v: WeaponMotionView): number {
  const duration = v.phase === 'windup' ? v.move.windup : v.phase === 'active' ? v.move.active : v.move.recover
  return clamp(1 - v.timer / Math.max(.001, duration))
}
function bodyAngle(v: WeaponMotionView): number {
  if (v.phase === 'none') return v.charging ? v.facing : v.bodyFacing ?? v.facing
  const p = dualProgress(v)
  return !v.burst && v.segment % 3 === 2 ? v.aim + Math.PI * 2 * (v.phase === 'active' ? dualSpin(p) : v.phase === 'recover' ? 1 : 0) : v.aim
}
/** 侧身两刃都朝下；双持武器轴与手臂轴独立，呼吸和步态保持细小错相。 */
export function dualAngles(v: WeaponMotionView): { main: number; support: number } {
  const direction = quantizeDir4(bodyAngle(v)), mirror = direction === 'right'
  const bob = Math.sin((v.time ?? 0) * 2.1) * .025 + Math.sin(v.gaitPhase ?? 0) * .025 * (v.gaitWeight ?? 0)
  const idle = direction === 'down' ? { main: .65, support: Math.PI - .65 }
    : direction === 'up' ? { main: Math.PI + .5, support: -.5 } : { main: Math.PI - .8, support: Math.PI - 1.15 }
  const ready = { main: idle.main + bob, support: idle.support - bob }
  if (mirror) { ready.main = Math.PI - ready.main; ready.support = Math.PI - ready.support }
  if (v.charging) {
    const p = smooth(v.chargeProgress ?? 0)
    return { main: mixAngle(ready.main, v.aim + .3, p), support: mixAngle(ready.support, v.aim - .3, p) }
  }
  if (v.phase === 'none') return ready
  if (v.burst) {
    const left = v.segment % 2 === 0
    return { main: v.aim + (left ? .38 : -.035), support: v.aim + (left ? .035 : -.38) }
  }
  const seg = v.segment % 3, p = dualProgress(v)
  if (seg === 2) {
    const rotation = Math.PI * 2 * (v.phase === 'active' ? dualSpin(p) : v.phase === 'recover' ? 1 : 0)
    const current = { main: v.aim + rotation + .48, support: v.aim + rotation + Math.PI + .48 }
    if (v.phase === 'windup') return { main: mixAngle(ready.main, current.main, p), support: mixAngle(ready.support, current.support, p) }
    if (v.phase === 'recover') return { main: mixAngle(current.main, ready.main, smooth(p)), support: mixAngle(current.support, ready.support, smooth(p)) }
    return current
  }
  const sign = seg === 0 ? 1 : -1, swing = v.aim + sign * (-DUAL_ARC * 1.12 + DUAL_ARC * 2.24 * dualSweep(v.phase === 'active' ? p : v.phase === 'recover' ? 1 : 0))
  const backswing = v.aim + Math.PI + (seg === 0 ? -.52 : .52)
  const current = seg === 0 ? { main: backswing, support: swing } : { main: swing, support: backswing }
  const weight = v.phase === 'windup' ? p : v.phase === 'recover' ? 1 - smooth(p) : 1
  return { main: mixAngle(ready.main, current.main, weight), support: mixAngle(ready.support, current.support, weight) }
}
export const dualArmAim = (v: WeaponMotionView) => dualAngles(v).main

/** 单刀前甩时另一手向身后外侧收肘，交替形成蓄势；连刺则交替伸臂与撤刀。 */
export function dualGrip(v: WeaponMotionView): WeaponGrip {
  const dir = quantizeDir4(bodyAngle(v)), angles = dualAngles(v), shoulders = armShoulders(dir)
  const local = (angle: number) => dir === 'right' ? Math.PI - angle : angle
  const bob = Math.sin((v.time ?? 0) * 2.1) * .28 + Math.sin(v.gaitPhase ?? 0) * .35 * (v.gaitWeight ?? 0)
  const ready = dir === 'left' || dir === 'right'
    ? { main: { x: -5, y: -.8 + bob }, support: { x: 4, y: .4 - bob } }
    : { main: { x: shoulders.near.x + (dir === 'up' ? -1 : 1), y: -.5 + bob }, support: { x: shoulders.far.x + (dir === 'up' ? 1 : -1), y: -.5 - bob } }
  const p = dualProgress(v), seg = v.segment % 3
  const effort = v.charging ? smooth(v.chargeProgress ?? 0) * .7 : v.phase === 'active' ? 1 : v.phase === 'windup' ? p : v.phase === 'recover' ? 1 - smooth(p) : 0
  const blend = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: a.x + (b.x - a.x) * effort, y: a.y + (b.y - a.y) * effort })
  const extended = (shoulder: { x: number; y: number }, angle: number, radius: number) => ({ x: shoulder.x + Math.cos(local(angle)) * radius, y: shoulder.y + Math.sin(local(angle)) * radius })
  const retracted = (shoulder: { x: number; y: number }, side: number) => {
    const back = local(v.aim + Math.PI), outward = local(v.aim + side * Math.PI / 2)
    return { x: shoulder.x + Math.cos(back) * 4.4 + Math.cos(outward) * 4.7, y: shoulder.y + Math.sin(back) * 4.4 + Math.sin(outward) * 4.7 }
  }
  let main = ready.main, support = ready.support
  if (v.charging) {
    main = blend(main, extended(shoulders.near, v.aim + .75, 4.1)); support = blend(support, extended(shoulders.far, v.aim - .75, 4.1))
  } else if (v.phase !== 'none') {
    if (v.burst) {
      const left = v.segment % 2 === 0, thrust = Math.sin(Math.PI * Math.min(1, p / .82))
      main = blend(main, left ? retracted(shoulders.near, 1) : extended(shoulders.near, angles.main, 4.3 + thrust * 5.3))
      support = blend(support, left ? extended(shoulders.far, angles.support, 4.3 + thrust * 5.3) : retracted(shoulders.far, -1))
    } else if (seg === 2) {
      main = blend(main, extended(shoulders.near, angles.main, 8.5)); support = blend(support, extended(shoulders.far, angles.support, 8.5))
    } else {
      main = blend(main, seg === 0 ? retracted(shoulders.near, 1) : extended(shoulders.near, angles.main, 8.9))
      support = blend(support, seg === 0 ? extended(shoulders.far, angles.support, 8.9) : retracted(shoulders.far, -1))
    }
  }
  return { offset: 0, weight: 1, main, support, weaponAngle: angles.main, supportWeaponAngle: angles.support,
    nearBend: dir === 'down' ? -1 : 1, farBend: dir === 'up' ? -1 : 1, inFront: v.phase !== 'none' || v.charging || dir !== 'up' }
}
export function dualBodyMotion(v: WeaponMotionView): WeaponBodyMotion | undefined {
  if (v.charging) return { facing: v.facing, rootY: (v.chargeProgress ?? 0) * .7, lean: -.025 }
  if (v.phase === 'none') return undefined
  const p = dualProgress(v), effort = v.phase === 'active' ? Math.sin(Math.min(1, p / .72) * Math.PI) : v.phase === 'recover' ? .16 * (1 - p) : .16 * p
  const sign = v.segment % 2 === 0 ? 1 : -1
  return { facing: bodyAngle(v), rootX: Math.cos(v.aim) * effort * (v.burst ? .65 : 2), rootY: Math.sin(v.aim) * effort * (v.burst ? .65 : 2),
    lean: sign * effort * (v.burst ? .04 : .12), tilt: sign * effort * (v.burst ? .012 : .04) }
}
