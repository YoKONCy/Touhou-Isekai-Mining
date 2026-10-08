import type { WeaponCurveView, WeaponPhysics, WeaponSweep } from './types'

type Point = { x: number; y: number }
type Particle = Point & { px: number; py: number; weight: number }

/** 轻量二维链棍：固定近棍端点、四节软链和一个刚性自由棍，无环境碰撞。 */
export class ChainRodPhysics implements WeaponPhysics {
  private particles: Particle[] = []
  private anchor: Point = { x: 0, y: 0 }
  private remainder = 0
  curve: Point[] = []
  freeRod: [Point, Point] = [{ x: 0, y: 0 }, { x: 0, y: 0 }]
  sweepPoints: Point[][] = []

  constructor(private readonly drawRod: (ctx: CanvasRenderingContext2D) => void,
    private readonly gripEnd = 10, private readonly chainLength = 9, private readonly rodLength = 19,
    private readonly visualScale = 1) {}

  private handEnd(view: WeaponCurveView): Point {
    return { x: view.hand.x + Math.cos(view.hand.angle) * this.gripEnd,
      y: view.hand.y + Math.sin(view.hand.angle) * this.gripEnd }
  }

  reset(view: WeaponCurveView): void {
    this.anchor = this.handEnd(view)
    this.remainder = 0
    this.particles = Array.from({ length: 6 }, (_, i) => {
      const y = this.anchor.y + (i <= 4 ? i * this.chainLength / 4 : this.chainLength + this.rodLength)
      return { x: this.anchor.x, y, px: this.anchor.x, py: y, weight: i === 0 ? 0 : i < 4 ? 4 : 1 }
    })
    this.publish()
    this.sweepPoints = []
  }

  private publish(): void {
    this.freeRod = [{ x: this.particles[4].x, y: this.particles[4].y },
      { x: this.particles[5].x, y: this.particles[5].y }]
    this.curve = this.freeRod.map(p => ({ ...p }))
  }

  update(view: WeaponCurveView, dt: number): void {
    const end = this.handEnd(view)
    const step = 1 / 240
    const total = this.remainder + Math.min(.1, Math.max(0, dt))
    const count = Math.floor(total / step)
    this.remainder = total - count * step
    this.sweepPoints = view.phase === 'active' ? [this.curve.map(p => ({ ...p }))] : []
    const start = this.anchor
    for (let s = 1; s <= count; s++) {
      const t = s / count
      const fixed = { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t }
      const damping = Math.exp(-(view.phase === 'none' ? 9 : 2.5) * step)
      for (let i = 1; i < this.particles.length; i++) {
        const p = this.particles[i], x = p.x, y = p.y
        p.x += (p.x - p.px) * damping
        p.y += (p.y - p.py) * damping + 650 * step * step
        p.px = x; p.py = y
      }
      // 手运动只通过固定链根牵引；禁止将自由棍角度吸附到预设姿态。
      for (let iteration = 0; iteration < 16; iteration++) {
        this.particles[0].x = fixed.x; this.particles[0].y = fixed.y
        for (let i = 1; i < this.particles.length; i++) {
          const a = this.particles[i - 1], b = this.particles[i]
          const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1
          const rest = i === 5 ? this.rodLength : this.chainLength / 4
          const correction = (length - rest) / length / (a.weight + b.weight)
          a.x += dx * correction * a.weight; a.y += dy * correction * a.weight
          b.x -= dx * correction * b.weight; b.y -= dy * correction * b.weight
        }
      }
      this.publish()
      if (view.phase === 'active') this.sweepPoints.push(this.curve.map(p => ({ ...p })))
    }
    this.anchor = end
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.particles.length) return
    ctx.save()
    ctx.lineWidth = 1.3 * this.visualScale; ctx.strokeStyle = '#3a3d3e'
    ctx.beginPath(); ctx.moveTo(this.particles[0].x, this.particles[0].y)
    for (let i = 1; i <= 4; i++) ctx.lineTo(this.particles[i].x, this.particles[i].y)
    ctx.stroke()
    for (let i = 1; i <= 4; i++) {
      const a = this.particles[i - 1], b = this.particles[i]
      ctx.strokeStyle = i % 2 ? '#cabf9e' : '#828483'; ctx.lineWidth = .65 * this.visualScale
      ctx.beginPath(); ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, 1.15 * this.visualScale, (i % 2 ? .9 : .4) * this.visualScale,
        Math.atan2(b.y - a.y, b.x - a.x), 0, Math.PI * 2); ctx.stroke()
    }
    const [a, b] = this.freeRod
    ctx.translate(a.x, a.y); ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x))
    this.drawRod(ctx)
    ctx.restore()
  }
}

/** 仅扫掠自由棍线段；子步和跨帧都保留，单次采样结果为只读闭包。 */
export class RodSweep implements WeaponSweep {
  private previous: Point[] = []
  constructor(private readonly thickness = 2.1) {}
  reset(): void { this.previous = [] }
  sample(current: Point[]): (x: number, y: number, radius: number) => boolean {
    const previous = this.previous.length === 2 ? this.previous : current
    this.previous = current.map(p => ({ ...p }))
    if (current.length !== 2) return () => false
    const movement = Math.max(...current.map((p, i) => Math.hypot(p.x - previous[i].x, p.y - previous[i].y)))
    const steps = Math.max(1, Math.ceil(movement / 1.5))
    return (x, y, radius) => {
      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        const ax = previous[0].x + (current[0].x - previous[0].x) * t
        const ay = previous[0].y + (current[0].y - previous[0].y) * t
        const bx = previous[1].x + (current[1].x - previous[1].x) * t
        const by = previous[1].y + (current[1].y - previous[1].y) * t
        const dx = bx - ax, dy = by - ay
        const k = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)))
        if (Math.hypot(x - ax - k * dx, y - ay - k * dy) <= radius + this.thickness) return true
      }
      return false
    }
  }
}
