import type { MeleeMove } from '../../../types'

export interface WhipPoint { x: number; y: number }
export interface WhipMotionView {
  x: number; y: number; hand: WhipPoint & { angle: number }; move: MeleeMove
  phase: string; timer: number; aim: number
}

/** 资源自带几何：绘制与碰撞共同使用，不依赖玩家运行时类。 */
export function whipCurve(v: WhipMotionView): WhipPoint[] {
  const { move: m, hand, phase, timer, aim } = v
  const active = phase === 'active', returning = phase === 'recover'
  const clamp = (n: number): number => Math.max(0, Math.min(1, n))
  const progress = active ? clamp(1 - timer / m.active) : returning ? clamp(1 - timer / m.recover) : 0
  const windup = phase === 'windup' ? clamp(1 - timer / m.windup) : 0
  const visualScale = m.reach / 160
  const ax = hand.x + Math.cos(hand.angle) * 7 * visualScale, ay = hand.y + Math.sin(hand.angle) * 7 * visualScale
  const late = clamp((progress - .55) / .45)
  const hook = active ? 2.55 * late * (2 - late) : returning ? 2.55 * (1 - progress) : 0
  const anchorForward = (ax - v.x) * Math.cos(aim) + (ay - v.y) * Math.sin(aim)
  // 攻击、回收随新距离变化；待机与前摇的原始固定长度也按同一比例缩短。
  const scale = active || returning ? Math.max(30 * visualScale, m.reach - anchorForward) * (returning ? 1 - .78 * progress * progress : 1) : (30 + windup * 115) * visualScale
  const points = [{ x: ax, y: ay }]
  let x = ax, y = ay
  for (let i = 1; i <= 40; i++) {
    const u = (i - .5) / 40, tail = Math.max(0, (u - .76) / .24)
    const t = clamp((progress - u * .32) / .68), sweep = t * t * (3 - 2 * t)
    const tangent = active ? -2.15 * (1 - sweep) + hook * Math.pow(tail, 1.5)
      : returning ? (Math.PI / 2 - aim) * sweep + hook * Math.pow(tail, 1.5)
      : (Math.PI / 2 - aim) * (1 - windup) - 2.15 * windup + .06 * Math.sin(u * Math.PI)
    x += Math.cos(aim + tangent) * scale / 40
    y += Math.sin(aim + tangent) * scale / 40
    points.push({ x, y })
  }
  return points
}

/** 逐次采样的扫掠状态，每次攻击必须重置。 */
export class WhipSweep {
  private previous: WhipPoint[] = []
  constructor(private readonly visualScale = 1) {}
  reset(): void { this.previous = [] }
  sample(current: WhipPoint[]): (x: number, y: number, radius: number) => boolean {
    const previous = this.previous.length === current.length ? this.previous : current
    this.previous = current
    let movement = 0
    for (let i = 0; i < current.length; i++) movement = Math.max(movement, Math.hypot(current[i].x - previous[i].x, current[i].y - previous[i].y))
    const steps = Math.max(1, Math.ceil(movement / 3))
    return (x, y, radius) => {
      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        for (let i = 1; i < current.length; i++) {
          const ax = previous[i - 1].x + (current[i - 1].x - previous[i - 1].x) * t
          const ay = previous[i - 1].y + (current[i - 1].y - previous[i - 1].y) * t
          const bx = previous[i].x + (current[i].x - previous[i].x) * t
          const by = previous[i].y + (current[i].y - previous[i].y) * t
          const dx = bx - ax, dy = by - ay
          const k = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)))
          const width = ((i / 40 < .7 ? 3.6 - i / 40 * 1.6 : 2.5 - (i / 40 - .7) * 4) / 2 + .5) * this.visualScale
          if (Math.hypot(x - ax - k * dx, y - ay - k * dy) <= radius + width + 1.5 * this.visualScale) return true
        }
      }
      return false
    }
  }
}
