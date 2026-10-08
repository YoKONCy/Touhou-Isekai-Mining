import type { WeaponMotionView, WeaponGrip, WeaponBodyMotion } from '../../../types'
import { quantizeDir4 } from '../../../../../game/art/rig/skeleton'

const clamp = (value: number): number => Math.max(0, Math.min(1, value))
const smooth = (value: number): number => value * value * (3 - 2 * value)

/** 双手待机沿用原有持械角，呼吸与步态只带动细小腕部轻摆。 */
export function staffIdleAim(view: WeaponMotionView): number {
  return view.facing + .08 + .22 * (1 - (view.gaitWeight ?? 0)) + Math.sin((view.time ?? 0) * 1.6) * .015
}

/** 主手握住中央握带，副手压在后侧握带；两段横扫共用双手握点。 */
export function staffSupportGrip(view: WeaponMotionView): WeaponGrip {
  const worldAngle = view.phase === 'none' ? staffIdleAim(view) : staffArmAim(view)
  const dir = quantizeDir4(view.bodyFacing ?? view.facing), angle = dir === 'right' ? Math.PI - worldAngle : worldAngle
  const pulse = Math.sin((view.time ?? 0) * 2.1) * .1
  const reach = 2.1 + pulse, nearBend: 1 | -1 = dir === 'down' ? -1 : 1
  return { offset: -4.2, weight: 1, main: { x: Math.cos(angle) * reach, y: -6 + Math.sin(angle) * reach },
    nearBend, farBend: -nearBend as 1 | -1, inFront: view.phase !== 'none' || dir !== 'up' }
}

/** 保留原有蓄势和正反手挥动节奏，让肩部随双手发力轻微扭转。 */
export function staffBodyMotion(view: WeaponMotionView): WeaponBodyMotion | undefined {
  if (view.phase === 'none') return undefined
  const bend = staffArmBend(view)
  return { lean: bend * .045, tilt: bend * .018 }
}

/** 蓄住起势后快速扫满 160 度；反手稍晚发力，末端减速形成重量感。 */
export function staffSweep(segment: number, progress: number): number {
  const value = clamp(progress)
  const release = segment === 0 ? .16 : .22
  const brake = segment === 0 ? .76 : .82
  if (value < release) return .035 * smooth(value / release)
  if (value < brake) {
    const push = (value - release) / (brake - release)
    return .035 + .93 * (1 - Math.pow(1 - push, 3))
  }
  return .965 + .035 * smooth((value - brake) / (1 - brake))
}

/** 收肘将棍身拉近肩侧，发力段迅速展开；两套动作使用相反的折肘方向。 */
export function staffArmBend(view: WeaponMotionView): number {
  const direction = view.segment === 0 ? 1 : -1
  if (view.phase === 'windup') {
    return direction * 1.1 * smooth(clamp((1 - view.timer / view.move.windup) / .8))
  }
  if (view.phase === 'active') return direction * 1.1 * (1 - staffSweep(view.segment, 1 - view.timer / view.move.active))
  return 0
}

export function staffArmAim(view: WeaponMotionView): number {
  const { move, phase, timer, aim, facing, segment, liftStart } = view
  const direction = segment === 0 ? 1 : -1
  const arc = move.arc ?? 0
  const start = aim - direction * arc, finish = aim + direction * arc
  if (phase === 'windup') {
    const raw = clamp(1 - timer / move.windup)
    const progress = smooth(clamp(raw / .85))
    const difference = Math.atan2(Math.sin(start - liftStart), Math.cos(start - liftStart))
    return liftStart + difference * progress - direction * .16 * Math.sin(raw * Math.PI)
  }
  if (phase === 'active') return start + direction * arc * 2 * staffSweep(segment, 1 - timer / move.active)
  const progress = clamp(1 - timer / move.recover)
  const settle = smooth(clamp((progress - .28) / .72))
  const difference = Math.atan2(Math.sin(facing + .3 - finish), Math.cos(facing + .3 - finish))
  // 只在收招演出中过冲，判定仍然严格使用 160 度扇形。
  const inertia = direction * .23 * Math.sin(Math.PI * clamp(progress / .32))
  const recoil = -direction * .10 * Math.sin(Math.PI * clamp((progress - .24) / .4))
  return finish + difference * settle + (inertia + recoil) * (1 - settle)
}

/** 正手从握柄处推送，反手略换握点回抽；杆身始终穿过手心，不脱离持握。 */
export function staffGripSlide(view: WeaponMotionView): number {
  const direction = view.segment === 0 ? 1 : -1
  if (view.phase === 'windup') return -direction * 3 * smooth(clamp(1 - view.timer / view.move.windup))
  if (view.phase === 'active') {
    return -direction * 3 + (3 + direction * 3) * staffSweep(view.segment, 1 - view.timer / view.move.active)
  }
  if (view.phase === 'recover') return 3 * (1 - smooth(clamp(1 - view.timer / view.move.recover)))
  return 0
}
