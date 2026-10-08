import type { WeaponMotionView, WeaponGrip, WeaponBodyMotion } from '../../../types'
import { quantizeDir4 } from '../../../../../game/art/rig/skeleton'

const clamp = (value: number): number => Math.max(0, Math.min(1, value))
const smooth = (value: number): number => value * value * (3 - 2 * value)

export function spearIdleAim(view: WeaponMotionView): number {
  return view.facing + .08 + .22 * (1 - (view.gaitWeight ?? 0)) + Math.sin((view.time ?? 0) * 1.6) * .015
}

/** 后手推杆、前手扶住矛杆，蓄势时拉开双手，释放后回到稳定的送矛握距。 */
export function spearSupportGrip(view: WeaponMotionView): WeaponGrip {
  const worldAngle = view.phase === 'none' ? spearIdleAim(view) : spearArmAim(view)
  const dir = quantizeDir4(view.bodyFacing ?? view.facing), angle = dir === 'right' ? Math.PI - worldAngle : worldAngle
  const load = spearLoad(view), reach = -2.1 - load * .2 + Math.sin((view.time ?? 0) * 2.1) * .08
  const nearBend: 1 | -1 = dir === 'down' ? -1 : 1
  return { offset: 4.2 + load * .4, weight: 1, main: { x: Math.cos(angle) * reach, y: -6 + Math.sin(angle) * reach },
    nearBend, farBend: -nearBend as 1 | -1, inFront: view.phase !== 'none' || dir !== 'up' }
}

/** 原有后拉、送杆位移照常使用，肩身配合双手蓄力，实体位置不变。 */
export function spearBodyMotion(view: WeaponMotionView): WeaponBodyMotion | undefined {
  if (view.phase === 'none') return undefined
  const load = spearLoad(view)
  return { rootX: -Math.cos(view.aim) * 2.2 * load, rootY: -Math.sin(view.aim) * 2.2 * load, lean: -.075 * load }
}

/** 前摇前 62% 收肘拉满，余下时间停住蓄势；刺出时快速伸肘释放。 */
function spearLoad(view: WeaponMotionView): number {
  if (view.phase === 'windup') return smooth(clamp((1 - view.timer / view.move.windup) / .62))
  if (view.phase === 'active') {
    const progress = clamp((1 - view.timer / view.move.active) / .68)
    return Math.pow(1 - progress, 3)
  }
  return 0
}

export function spearArmBend(view: WeaponMotionView): number {
  return 1.85 * spearLoad(view)
}

/** 唯一动作：后引蓄力、锁轴送矛、短暂停锋后收回；判定期不摆成扇形。 */
export function spearThrust(view: WeaponMotionView): number {
  const { move, phase, timer } = view
  // 保留后拉的蓄势幅度，只缩短送矛前冲和回收起点，避免短矛视觉超过新距离。
  const extension = 24 * move.reach / 120, finish = 22 * move.reach / 120
  if (phase === 'windup') return -23 * spearLoad(view)
  if (phase === 'active') {
    const progress = clamp(1 - timer / move.active)
    if (progress < .68) return -23 + (23 + extension) * (1 - spearLoad(view))
    return extension + (finish - extension) * smooth((progress - .68) / .32)
  }
  if (phase === 'recover') {
    const progress = clamp(1 - timer / move.recover)
    return finish * (1 - smooth(clamp((progress - .10) / .90)))
  }
  return 0
}

export function spearArmAim(view: WeaponMotionView): number {
  if (view.phase === 'windup') {
    const progress = smooth(clamp((1 - view.timer / view.move.windup) / .5))
    const difference = Math.atan2(Math.sin(view.liftStart - view.aim), Math.cos(view.liftStart - view.aim))
    return view.aim + difference * (1 - progress)
  }
  if (view.phase === 'active') return view.aim
  const progress = smooth(clamp(1 - view.timer / view.move.recover))
  const difference = Math.atan2(Math.sin(view.facing + .3 - view.aim), Math.cos(view.facing + .3 - view.aim))
  return view.aim + difference * progress
}
