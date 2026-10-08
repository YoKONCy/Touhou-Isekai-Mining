import type { WeaponMotionView, WeaponGrip, WeaponBodyMotion } from '../../../types'
import { quantizeDir4 } from '../../../../../game/art/rig/skeleton'

const clamp = (p: number) => Math.max(0, Math.min(1, p))
const smooth = (p: number) => { const v = clamp(p); return v * v * (3 - 2 * v) }
const angleMix = (from: number, to: number, p: number) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * p
export const katanaSweep = (p: number) => smooth(clamp((p - .06) / .86))

/** 四向独立安排腰侧握点与肘部弯曲，双手、刀柄和刀鞘共用轻摆。 */
export function katanaReadyLayout(bodyFacing: number, time = 0, gaitPhase = 0, gaitWeight = 0) {
  const dir = quantizeDir4(bodyFacing)
  const sway = Math.sin(time * 1.65) * .025 + Math.sin(time * .73 + .5) * .012 + Math.sin(gaitPhase) * .025 * gaitWeight
  const localAngle = (dir === 'down' ? Math.PI - .60 : dir === 'up' ? .60 : .48) + sway
  const angle = dir === 'right' ? Math.PI - localAngle : localAngle
  const main = {
    x: (dir === 'down' ? 4 : dir === 'up' ? -4 : -3.8) + Math.sin(time * 1.4) * .18 + Math.sin(gaitPhase) * .22 * gaitWeight,
    y: (dir === 'down' || dir === 'up' ? -3.8 : -3.3) + Math.sin(time * 2.1) * .35 + Math.cos(gaitPhase) * .25 * gaitWeight
  }
  const support = { x: main.x + Math.cos(localAngle) * 6, y: main.y + Math.sin(localAngle) * 6 }
  const nearBend: 1 | -1 = dir === 'down' ? -1 : 1
  return { angle, main, support, nearBend, farBend: -nearBend as 1 | -1, inFront: dir !== 'up' }
}
export function katanaReadyPose(view: WeaponMotionView, facing = view.bodyFacing ?? view.facing) {
  return katanaReadyLayout(facing, view.time ?? 0, view.gaitPhase ?? 0, view.gaitWeight ?? 0)
}
export function katanaSheathing(view: WeaponMotionView): number {
  return view.phase === 'recover' && !view.comboQueued ? smooth((1 - view.timer / view.move.recover - .6) / .4) : 0
}
export function katanaBladeReveal(view?: WeaponMotionView): number {
  if (!view) return 1
  if (view.phase === 'none') return 0
  if (view.phase === 'windup' && view.segment === 0) return smooth(1 - view.timer / view.move.windup)
  return 1 - katanaSheathing(view)
}
function bodyFacing(view: WeaponMotionView): number {
  const rest = view.bodyFacing ?? view.facing
  if (view.phase === 'none') return rest
  const p = view.phase === 'active' ? clamp(1 - view.timer / view.move.active)
    : view.phase === 'recover' ? clamp(1 - view.timer / view.move.recover) : clamp(1 - view.timer / view.move.windup)
  const attack = view.segment === 3 ? (view.phase === 'active' ? view.aim - Math.PI + Math.PI * 2 * katanaSweep(p)
    : view.phase === 'recover' ? view.aim + Math.PI * (1 - smooth(p)) : view.aim - Math.PI * smooth(p)) : view.aim
  if (view.phase === 'windup' && view.segment === 0) return angleMix(rest, attack, smooth(p))
  return angleMix(attack, rest, katanaSheathing(view))
}
export function katanaIdleAim(view: WeaponMotionView): number {
  return katanaReadyPose(view).angle
}
export function katanaArmAim(view: WeaponMotionView): number {
  const { phase, timer, move, aim, segment, liftStart } = view
  const arc = segment === 3 ? Math.PI : (move.arc ?? 0), direction = segment === 1 ? -1 : 1
  const start = segment === 2 ? aim - 1.55 : aim - direction * arc
  const finish = segment === 2 ? aim + .18 : aim + direction * arc
  if (phase === 'none') return katanaIdleAim(view)
  if (phase === 'windup') return angleMix(liftStart, start, smooth(1 - timer / move.windup))
  if (phase === 'active') {
    const p = clamp(1 - timer / move.active)
    return start + (finish - start) * (segment === 2 ? smooth(p / .62) : katanaSweep(p))
  }
  const ready = katanaReadyPose(view, bodyFacing(view)).angle
  return angleMix(finish, ready, katanaSheathing(view))
}
export function katanaArmBend(view: WeaponMotionView): number {
  const sign = view.segment === 1 ? -1 : 1
  if (view.phase === 'windup') return sign * .65 * smooth(1 - view.timer / view.move.windup)
  if (view.phase === 'active') return sign * .65 * (1 - katanaSweep(1 - view.timer / view.move.active))
  return 0
}
export function katanaThrust(view: WeaponMotionView): number {
  if (view.segment !== 2) return 0
  if (view.phase === 'windup') return -2 * smooth(1 - view.timer / view.move.windup)
  if (view.phase === 'active') return -2 + 5 * smooth((1 - view.timer / view.move.active) / .62)
  return 3 * (1 - smooth(1 - view.timer / view.move.recover))
}
export function katanaSupportGrip(view: WeaponMotionView): WeaponGrip {
  const layout = katanaReadyPose(view, bodyFacing(view))
  const elbows = { nearBend: layout.nearBend, farBend: layout.farBend }
  if (view.phase === 'none') return { offset: 6, weight: 1, main: layout.main, support: layout.support, ...elbows, inFront: layout.inFront }
  const sheathing = katanaSheathing(view)
  if (view.segment < 2) {
    const mainWeight = view.phase === 'windup' && view.segment === 0 ? 1 - smooth(1 - view.timer / view.move.windup) : sheathing
    return { offset: 6, weight: 1, main: layout.main, support: layout.support, mainWeight, onlySupport: mainWeight <= 0, ...elbows }
  }
  if (sheathing > 0) {
    const worldAngle = katanaArmAim(view), angle = quantizeDir4(bodyFacing(view)) === 'right' ? Math.PI - worldAngle : worldAngle
    const near = { x: Math.cos(angle) * 2.2, y: -6 + Math.sin(angle) * 2.2 }
    const far = { x: near.x - Math.cos(angle) * 4.5, y: near.y - Math.sin(angle) * 4.5 }
    const mix = (a: {x:number;y:number}, b: {x:number;y:number}) => ({ x: a.x + (b.x - a.x) * sheathing, y: a.y + (b.y - a.y) * sheathing })
    return { offset: -4.5, weight: 1, main: mix(near, layout.main), support: mix(far, layout.support), ...elbows }
  }
  return { offset: -4.5, weight: view.phase === 'windup' ? smooth(1 - view.timer / view.move.windup) : 1, ...elbows }
}
export function katanaBodyMotion(view: WeaponMotionView): WeaponBodyMotion | undefined {
  if (view.phase === 'none') return undefined
  const active = view.phase === 'active', recover = view.phase === 'recover'
  const p = active ? clamp(1 - view.timer / view.move.active) : recover ? clamp(1 - view.timer / view.move.recover) : clamp(1 - view.timer / view.move.windup)
  const strength = (active ? Math.sin(p * Math.PI) : recover ? (1 - p) * .2 : p * .25) * (1 - katanaSheathing(view))
  if (view.segment === 3) return { facing: bodyFacing(view), lean: strength * .07, tilt: Math.sin(p * Math.PI * 2) * .06 * strength, rootY: -strength * 1.2 }
  const direction = view.segment === 1 ? -1 : 1
  return { facing: bodyFacing(view), lean: direction * strength * (view.segment === 2 ? .14 : .08), tilt: direction * strength * .035,
    rootX: Math.cos(view.aim) * strength * (view.segment === 2 ? 2 : 1),
    rootY: Math.sin(view.aim) * strength * (view.segment === 2 ? 2 : 1) }
}
