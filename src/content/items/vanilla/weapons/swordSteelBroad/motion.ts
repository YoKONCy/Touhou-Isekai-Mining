import type { WeaponMotionView, WeaponGrip, WeaponBodyMotion } from '../../../types'
import { quantizeDir4 } from '../../../../../game/art/rig/skeleton'

const clamp = (p: number) => Math.max(0, Math.min(1, p))
const smooth = (p: number) => { const v = clamp(p); return v * v * (3 - 2 * v) }
const angleMix = (a: number, b: number, p: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * p
export const broadswordDirection = (segment: number) => segment % 2 === 0 ? 1 : -1
/** 刀身先压住，再加速扫出，末端保留清楚的制动，两个方向共用同一节奏。 */
export function broadswordSweep(p: number): number {
  const v = clamp(p)
  if (v < .12) return .02 * smooth(v / .12)
  if (v < .82) return .02 + .95 * smooth((v - .12) / .7)
  return .97 + .03 * smooth((v - .82) / .18)
}
export function broadswordIdleAim(view: WeaponMotionView): number {
  const dir = quantizeDir4(view.bodyFacing ?? view.facing)
  const base = dir === 'left' ? -2.25 : dir === 'up' ? -2.15 : dir === 'right' ? -.9 : -1.1
  return base + Math.sin((view.time ?? 0) * 1.7) * .016 + Math.sin(view.gaitPhase ?? 0) * .025 * (view.gaitWeight ?? 0)
}
export function broadswordArmAim(view: WeaponMotionView): number {
  const { phase, timer, move, aim } = view, dir = broadswordDirection(view.segment)
  const start = aim - dir * (move.arc ?? 0), finish = aim + dir * (move.arc ?? 0)
  if (phase === 'none') return broadswordIdleAim(view)
  if (phase === 'windup') {
    const p = clamp(1 - timer / move.windup)
    return angleMix(view.liftStart, start, smooth(p / .88)) - dir * .12 * Math.sin(p * Math.PI)
  }
  if (phase === 'active') return start + (finish - start) * broadswordSweep(1 - timer / move.active)
  const p = clamp(1 - timer / move.recover)
  // 已排队的反手只稍微收腕，不绕回待机再重新挥出。
  const settle = view.comboQueued ? .1 * smooth(p) : smooth(p)
  return angleMix(finish, broadswordIdleAim(view), settle) + dir * .13 * Math.sin(p * Math.PI) * (1 - settle)
}
export function broadswordGrip(view: WeaponMotionView): WeaponGrip {
  const facing = view.phase === 'none' ? view.bodyFacing ?? view.facing : view.aim
  const dir = quantizeDir4(facing), worldAngle = broadswordArmAim(view)
  const angle = dir === 'right' ? Math.PI - worldAngle : worldAngle
  const pulse = Math.sin((view.time ?? 0) * 1.7) * .08 + Math.sin(view.gaitPhase ?? 0) * .08 * (view.gaitWeight ?? 0)
  // 握柄中心收在双肩之间，180 度横扫时两只手仍处于骨长可达范围。
  const radius = view.phase === 'active' ? 2.25 + Math.sin(clamp(1 - view.timer / view.move.active) * Math.PI) * .08 : 2.3
  const main = { x: Math.cos(angle) * radius, y: -6 + Math.sin(angle) * radius + pulse }
  const nearBend: 1 | -1 = dir === 'down' ? -1 : 1
  return { offset: -4.6, weight: 1, main, weaponAngle: worldAngle, nearBend, farBend: -nearBend as 1 | -1,
    inFront: view.phase !== 'none' || dir !== 'up' }
}
export function broadswordBodyMotion(view: WeaponMotionView): WeaponBodyMotion | undefined {
  if (view.phase === 'none') return undefined
  const active = view.phase === 'active', windup = view.phase === 'windup'
  const p = clamp(1 - view.timer / (active ? view.move.active : windup ? view.move.windup : view.move.recover))
  const force = active ? Math.sin(broadswordSweep(p) * Math.PI) : windup ? -.38 * smooth(p) : .25 * (1 - smooth(p))
  const dir = broadswordDirection(view.segment)
  return { facing: view.aim, lean: dir * force * .17, tilt: dir * force * .06,
    rootX: Math.cos(view.aim) * force * 2.5, rootY: Math.sin(view.aim) * force * 2.5 + Math.abs(force) * .5 }
}
