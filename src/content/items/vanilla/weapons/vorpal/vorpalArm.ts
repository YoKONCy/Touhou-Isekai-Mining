import type { WeaponMotionView } from '../../../types'
import { vorpalSweep } from './vorpalSlash'

export function vorpalArmAim(v: WeaponMotionView): number {
  const { move: m, phase, timer, aim: base, facing, segment: seg, liftStart, empowered } = v
  const arc = m.arc ?? 0

      const dir = seg === 1 ? -1 : 1
      const width = seg === 2 ? 1.55 : 1.25
      const raised = base - dir * width
      if (phase === 'windup') {
        const t = Math.max(0, Math.min(1, 1 - timer / m.windup))
        const diff = Math.atan2(Math.sin(raised - liftStart), Math.cos(raised - liftStart))
        return liftStart + diff * t * t * (3 - 2 * t)
      }
      if (phase === 'active') {
        const t = Math.max(0, Math.min(1, 1 - timer / m.active))
        const sweep = vorpalSweep(seg, t)
        return raised + dir * width * 2 * sweep
      }
      const t = Math.max(0, Math.min(1, 1 - timer / m.recover))
      const ease = Math.max(0, (t - .28) / .72)
      const finish = base + dir * width
      const diff = Math.atan2(Math.sin(facing + .3 - finish), Math.cos(facing + .3 - finish))
      return finish + diff * ease * ease
    
}
