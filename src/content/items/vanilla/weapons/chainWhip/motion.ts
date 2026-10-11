import type { WeaponGrip, WeaponMotionView } from '../../../types'
import { quantizeDir4 } from '../../../../../game/art/rig/skeleton'

/** 待机按人物四向把握柄收在腰侧，腕部仅轻微抬起，不随鼠标伸臂。 */
export function chainIdleAim(view: WeaponMotionView): number {
  const dir = quantizeDir4(view.bodyFacing ?? view.facing)
  const sway = Math.sin((view.time ?? 0) * 1.7) * .015 + Math.sin(view.gaitPhase ?? 0) * .025 * (view.gaitWeight ?? 0)
  return (dir === 'right' || dir === 'down' ? -.18 : Math.PI + .18) + sway
}

/** 仅调整待机主手，副手自由摆动；攻击仍使用皮鞭原有的手臂与曲线动作。 */
export function chainIdleGrip(view: WeaponMotionView): WeaponGrip | undefined {
  if (view.phase !== 'none') return undefined
  const dir = quantizeDir4(view.bodyFacing ?? view.facing)
  const bob = Math.sin((view.time ?? 0) * 1.7) * .08 + Math.sin(view.gaitPhase ?? 0) * .18 * (view.gaitWeight ?? 0)
  return {
    offset: 0, weight: 1, supportWeight: 0,
    main: { x: dir === 'down' ? 6.2 : dir === 'up' ? -6.2 : -4.8, y: -1.7 + bob },
    weaponAngle: chainIdleAim(view), nearBend: dir === 'down' ? -1 : 1, inFront: dir !== 'up'
  }
}
