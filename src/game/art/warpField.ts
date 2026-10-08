/**
 * 批次 F⑤ · 时空乱流氛围浮层
 *
 * 洞窟空间本身并不稳定：空气里悬浮着极稀疏的冷青紫星尘碎屑（原位缓慢漂浮 +
 * 明灭），偶有一两道斜向拖过的淡光带。只做氛围，不做交互、不产生游戏信息。
 *
 * 层级约定：由 RoomRuntime 在"地面层之后、y-sort 实体之前"绘制，
 * 因此实体会自然盖住碎屑；之后叠加的光照压暗层也会把它一并压暗，
 * 亮处依稀可见、暗处隐入黑中。普通 source-over 混合，不用加色发光。
 *
 * 碎屑用确定性网格哈希（无状态、不分配、不随相机闪烁）；
 * 光带是有生命周期的极淡渐变椭圆，update 推进重生。
 */
import { CONFIG } from '../config'

/** 冷青紫碎屑调色板（紫蓝系，刻意避开火把暖色系） */
const DUST_COLORS = ['#8a7cff', '#6f8fff', '#9f8bff', '#7c9cff']

/** 整数网格 → [0,1) 稳定哈希 */
function hash2(i: number, j: number, salt = 0): number {
  let h = (i * 374761393 + j * 668265263 + salt * 1442695041) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

interface WarpBand {
  /** 归一化位置（0~1 房间尺寸） */
  nx: number
  ny: number
  vx: number
  vy: number
  /** 带长 px / 倾斜角 rad */
  len: number
  angle: number
  /** 生命周期与当前年龄 */
  life: number
  maxLife: number
  /** 出现前延迟（错峰，避免两条同时生灭） */
  delay: number
  /** 峰值透明度与随机相位 */
  alpha: number
  seed: number
}

export class WarpField {
  private t = 0
  private bands: WarpBand[] = []

  constructor() {
    // 初始光带错峰（一条已在场上、一条延迟登场）
    this.bands.push(this.makeBand(0, 2))
    this.bands.push(this.makeBand(4, 9))
  }

  /** 生成一条光带：归一化漂移，寿命 9~15s，淡入淡出 */
  private makeBand(delay: number, seed: number): WarpBand {
    const a = Math.random() * Math.PI * 2
    const sp = 0.008 + Math.random() * 0.012
    return {
      nx: 0.15 + Math.random() * 0.7,
      ny: 0.15 + Math.random() * 0.7,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      len: 180 + Math.random() * 220,
      angle: -0.5 + Math.random() * 1.0,
      life: 0,
      maxLife: 9 + Math.random() * 6,
      delay,
      alpha: 0.08 + Math.random() * 0.06,
      seed
    }
  }

  update(dt: number): void {
    this.t += dt
    for (const b of this.bands) {
      if (b.delay > 0) {
        b.delay -= dt
        continue
      }
      b.life += dt
      b.nx += b.vx * dt
      b.ny += b.vy * dt
      // 越过边缘从对侧飘回
      if (b.nx < -0.2) b.nx = 1.2
      if (b.nx > 1.2) b.nx = -0.2
      if (b.ny < -0.2) b.ny = 1.2
      if (b.ny > 1.2) b.ny = -0.2
      if (b.life >= b.maxLife) Object.assign(b, this.makeBand(2 + Math.random() * 5, Math.random() * 100))
    }
  }

  /** 按房间像素尺寸全屋绘制（房间约 30×20 格，碎屑总量几十颗，无性能压力） */
  render(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!CONFIG.art.warp.enabled) return
    const t = this.t
    this.renderBands(ctx, w, h, t)
    this.renderDust(ctx, w, h, t)
  }

  /** 稀疏星尘碎屑：每格按概率一颗，原位椭圆漂浮 + 明灭 */
  private renderDust(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    const cell = CONFIG.art.warp.cell
    const cols = Math.ceil(w / cell) + 1
    const rows = Math.ceil(h / cell) + 1
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (hash2(i, j) >= CONFIG.art.warp.density) continue
        // 格内稳定参数（哈希派生，全部无状态）
        const fx = 0.25 + hash2(i, j, 1) * 0.5
        const fy = 0.25 + hash2(i, j, 2) * 0.5
        const orbit = 3 + hash2(i, j, 3) * 5 // 漂浮半径
        const period = 6 + hash2(i, j, 4) * 7 // 漂浮周期
        const ph = hash2(i, j, 5) * Math.PI * 2
        const baseA = 0.1 + hash2(i, j, 6) * 0.16
        const size = hash2(i, j, 7) < 0.12 ? 2.2 : 1.2
        const color = DUST_COLORS[Math.floor(hash2(i, j, 8) * DUST_COLORS.length) % DUST_COLORS.length]
        const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * (Math.PI * 2) / period + ph))
        const x = (i + fx) * cell + Math.cos(ph + t * 0.4) * orbit
        const y = (j + fy) * cell + Math.sin(ph + t * 0.33) * orbit
        ctx.globalAlpha = baseA * tw
        ctx.fillStyle = color
        ctx.fillRect(x - size / 2, y - size / 2, size, size)
      }
    }
    ctx.globalAlpha = 1
  }

  /** 偶发淡光带：斜向拉长的径向渐变椭圆，两端淡出 */
  private renderBands(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    for (const b of this.bands) {
      if (b.delay > 0) continue
      // 生命周期两端各 1.8s 淡入淡出
      const fade = Math.min(1, b.life / 1.8, (b.maxLife - b.life) / 1.8)
      if (fade <= 0) continue
      const cx = b.nx * w
      const cy = b.ny * h
      const breath = 0.85 + 0.15 * Math.sin(t * 0.6 + b.seed)
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(b.angle)
      ctx.scale(1, 0.08)
      const g = ctx.createRadialGradient(0, 0, b.len * 0.1, 0, 0, b.len)
      const a = b.alpha * fade * breath
      g.addColorStop(0, `rgba(138,124,255,0)`)
      g.addColorStop(0.35, `rgba(138,124,255,${a})`)
      g.addColorStop(0.7, `rgba(111,143,255,${a * 0.6})`)
      g.addColorStop(1, `rgba(138,124,255,0)`)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(0, 0, b.len, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }
}
