import type { WeaponBodyMotion, WeaponMotionView } from '../../../types'

const clamp = (p: number) => Math.max(0, Math.min(1, p))
const smooth = (p: number) => { const t = clamp(p); return t * t * (3 - 2 * t) }

/** 左右斩镜像展开，判定期使用线性角进度，与实际扫掠严格同步。 */
export function uchigatanaArmAim(v: WeaponMotionView): number {
  const direction = v.move.sweepDirection ?? (v.segment % 2 === 0 ? 1 : -1)
  const arc = v.move.arc ?? 1.25
  const start = v.aim - direction * arc, end = v.aim + direction * arc
  if (v.phase === 'windup') {
    const p = smooth(1 - v.timer / v.move.windup)
    return v.liftStart + Math.atan2(Math.sin(start - v.liftStart), Math.cos(start - v.liftStart)) * p
  }
  if (v.phase === 'active') return start + direction * arc * 2 * clamp(1 - v.timer / v.move.active)
  // 先留在斩击结束侧，再略收肘，为反向第二刀留出自然衔接。
  return end - direction * arc * .18 * smooth(1 - v.timer / v.move.recover)
}

export function uchigatanaArmBend(v: WeaponMotionView): number {
  const direction = v.segment % 2 === 0 ? 1 : -1
  const p = v.phase === 'windup' ? smooth(1 - v.timer / v.move.windup)
    : v.phase === 'active' ? 1 - clamp(1 - v.timer / v.move.active) : .2
  return direction * .3 * p
}

/** 仅带动持刀侧肩与腰部，另一只手保持自由，不使用双手握点。 */
export function uchigatanaBodyMotion(v: WeaponMotionView): WeaponBodyMotion | undefined {
  if (v.phase === 'none') return undefined
  const direction = v.segment % 2 === 0 ? 1 : -1
  const power = v.phase === 'active' ? Math.sin(clamp(1 - v.timer / v.move.active) * Math.PI)
    : v.phase === 'windup' ? .2 * smooth(1 - v.timer / v.move.windup) : .2 * clamp(v.timer / v.move.recover)
  return { lean: direction * power * .065, tilt: direction * power * .03,
    rootX: Math.cos(v.aim) * power * .6, rootY: Math.sin(v.aim) * power * .6 }
}
