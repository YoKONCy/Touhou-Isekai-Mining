import type { WeaponMotionView } from '../../../types'
export function doomEmpoweredSweep(t: number): number {
    if (t < 0.26) return 0.025 * Math.pow(t / 0.26, 2)
    if (t < 0.72) return 0.025 + 0.955 * (1 - Math.pow(1 - (t - 0.26) / 0.46, 3))
    return 0.98 + 0.02 * (t - 0.72) / 0.28
}


export function doomsdayArmAim(v: WeaponMotionView): number {
  const { move: m, phase, timer, aim: base, facing, segment: seg, liftStart, empowered } = v
  const arc = m.arc ?? 0

      const dir = seg === 0 ? 1 : -1
      const raised = base - dir * arc
      const finish = base + dir * arc
      const blendAngle = (from: number, to: number, amount: number): number => {
        const diff = Math.atan2(Math.sin(to - from), Math.cos(to - from))
        return from + diff * amount
      }
      if (phase === 'windup') {
        const t = Math.max(0, Math.min(1, 1 - timer / m.windup))
        // 慢抬、末端压住：不是起手直接跳到蓄力角。
        const lift = empowered ? Math.min(1, t / 0.78) : t
        const ease = lift * lift * (3 - 2 * lift)
        return blendAngle(liftStart, raised, ease)
      }
      if (phase === 'active') {
        const t = Math.max(0, Math.min(1, 1 - timer / m.active))
        const ease = empowered ? doomEmpoweredSweep(t) : t < 0.18 ? 0.06 * Math.pow(t / 0.18, 2)
          : t < 0.8 ? 0.06 + 0.9 * (1 - Math.pow(1 - (t - 0.18) / 0.62, 2))
          : 0.96 + 0.04 * (t - 0.8) / 0.2
        return raised + dir * arc * 2 * ease
      }
      const t = Math.max(0, Math.min(1, 1 - timer / m.recover))
      // 先压刀停顿，再花整个后摇缓慢回到当前瞄准方向的原持握位。
      const hold = empowered ? 0.32 : 0.16
      const returnT = Math.max(0, (t - hold) / (1 - hold))
      const ease = returnT * returnT * (3 - 2 * returnT)
      return blendAngle(finish, facing + 0.3, ease)
    
}
