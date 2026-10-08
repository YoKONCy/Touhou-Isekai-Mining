/**
 * 批次 E · 地缝热气粒子
 *
 * 每条地缝按自己的节奏冒"一缕热气"（2~3 个错开的小汽团），
 * 汽团上升时左右轻摆、体积膨胀、淡入淡出——冷矿洞的地热呼吸感。
 * 纯视觉：无碰撞、无交互、不影响任何玩法。
 */
import type { SteamVent } from './roomTextureE'

interface SteamP {
  x: number
  y: number
  age: number
  maxLife: number
  /** 摆幅相位/速度 */
  sway: number
  /** 最终大小 */
  size: number
  drift: number
}

export class SteamVents {
  private ps: SteamP[] = []
  private clock = 0
  /** 每条缝距下一次喷发的倒计时 */
  private timers: number[]

  constructor(private vents: readonly SteamVent[]) {
    // 初始相位错开，避免进房所有缝同时冒气
    this.timers = vents.map((v) => 0.4 + (v.seed % 1) * 2.2)
  }

  update(dt: number): void {
    this.clock += dt
    for (let i = 0; i < this.vents.length; i++) {
      this.timers[i] -= dt
      if (this.timers[i] <= 0) {
        this.emit(this.vents[i])
        this.timers[i] = 2.4 + (this.vents[i].seed % 1) * 2.8
      }
    }
    for (let i = this.ps.length - 1; i >= 0; i--) {
      this.ps[i].age += dt
      if (this.ps[i].age >= this.ps[i].maxLife) this.ps.splice(i, 1)
    }
  }

  /** 一缕 = 2~3 个错开的汽团 */
  private emit(v: SteamVent): void {
    const n = 2 + (v.seed % 1 > 0.5 ? 1 : 0)
    for (let k = 0; k < n; k++) {
      this.ps.push({
        x: v.x + ((v.seed * (k + 1)) % 1 - 0.5) * 10,
        y: v.y + (k % 2) * 2,
        age: -k * 0.28,
        maxLife: 1.5 + (v.seed % 1) * 0.5,
        sway: v.seed + k * 2.3,
        size: 3.2 + ((v.seed * (k + 3)) % 1) * 2.2,
        drift: ((v.seed * (k + 2)) % 1) * 2 - 1
      })
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save()
    // 微光沿缝内错峰呼吸，不照亮整条岩唇，也不变成霓虹描边。
    for(const v of this.vents){
      for(let i=1;i<v.pts.length;i++){
        const a=v.pts[i-1],b=v.pts[i],pulse=.5+.5*Math.sin(this.clock*1.6+v.seed*7-i*.9)
        ctx.strokeStyle=`rgba(166,75,39,${.035+pulse*.10})`;ctx.lineWidth=.8
        ctx.beginPath();ctx.moveTo(a.x+(b.x-a.x)*.2,a.y+(b.y-a.y)*.2);ctx.lineTo(a.x+(b.x-a.x)*.65,a.y+(b.y-a.y)*.65);ctx.stroke()
      }
    }
    ctx.restore()
    for (const p of this.ps) {
      if (p.age < 0) continue
      const k = p.age / p.maxLife
      const rise = 30 + 22 * k
      const x = p.x + Math.sin(p.age * 2.4 + p.sway) * (3 + 5 * k) + p.drift * 3 * k
      const y = p.y - rise
      const size = p.size + 7 * k
      // 淡入 → 持续 → 淡出
      const alpha = Math.sin(Math.min(1, k * 1.6) * Math.PI) * 0.13
      const g = ctx.createRadialGradient(x, y, 0, x, y, size)
      g.addColorStop(0, `rgba(222,228,234,${alpha})`)
      g.addColorStop(1, 'rgba(222,228,234,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, size, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}
