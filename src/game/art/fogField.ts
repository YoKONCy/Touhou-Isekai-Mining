import { randomVisual } from '../../core/simulation/random'
/**
 * 批次 F⑦（追加轮·二改）· 漂浮动态云层雾气
 *
 * 主人反馈：单椭圆像光斑，要的是"稀疏云层"——大片分散、像云一样
 * 有厚度与翻涌纹理、漂浮在空气中，但不能遮蔽视野。
 *
 * 做法：一团雾不再是单个椭圆，而是 6~10 个软圆（lobe）按种子
 * 错落地拼合成不规则云块：簇心处 lobe 大而密（云核厚）、外侧小而散
 * （云尾薄）；每个 lobe 独立错相呼吸，整块云便有缓慢翻涌感。
 * 云块尺度大（宽 320~620px）、数量克制（9 块）、块间留大片空隙，
 * 透明度克制——看得到云在飘，云下物体只被轻轻洗淡一层。
 *
 * 层级：RoomRuntime 在 y-sort 实体之后、弹幕之前绘制；光照压暗层
 * 随后把雾一并压暗。与 warpField 分工：warp=地面下异象星尘，
 * fog=实体上空气云层。
 */
import { CONFIG } from '../config'
import { radialStamp } from '../../core/rendering/RadialStamp'
import { drawSprite } from '../../core/rendering/SpriteCache'
import { canvasViewport, visible, type Viewport } from '../../core/rendering/Viewport'
import { profiler } from '../../core/performance/Profiler'
const FOG_STOPS:readonly [number,string][]=[[0,'rgba(196,205,226,1)'],[.5,'rgba(176,186,208,.62)'],[1,'rgba(160,170,196,0)']]

interface FogRaster {
  image: HTMLCanvasElement
  context: CanvasRenderingContext2D
  left: number; top: number; width: number; height: number
  time: number; opacity: number; alpha: number; roomW: number; roomH: number
  density: number
}
// 渲染缓存放在模拟状态之外，避免图像资源进入快照。
const rasters = new WeakMap<FogField, FogRaster>()

/** 云块内的一个软圆瓣 */
interface FogLobe {
  /** 相对云块中心的偏移 */
  ox: number
  oy: number
  /** 半径基准 */
  r: number
  /** 呼吸相位与幅度 */
  phase: number
  breath: number
}

interface FogPatch {
  /** 归一化位置（0~1 房间尺寸） */
  nx: number
  ny: number
  /** 水平漂移速度（归一化/秒） */
  vx: number
  /** 整块云纵向起伏 */
  swayAmp: number
  swayFreq: number
  phase: number
  /** 整块透明度系数与呼吸 */
  baseA: number
  breathFreq: number
  lobes: FogLobe[]
  /** 渲染半径（含最外 lobe），绕回接缝用 */
  halfW: number
}

export class FogField {
  private t = 0
  private patches: FogPatch[] = []

  constructor() {
    for (let i = 0; i < CONFIG.art.fog.count; i++) this.patches.push(this.makePatch())
  }

  /** 生成一块多瓣云：宽 320~620，6~10 个 lobe，中轴附近厚、两端薄 */
  private makePatch(): FogPatch {
    const width = 320 + randomVisual() * 300
    const lobes: FogLobe[] = []
    const n = 6 + Math.floor(randomVisual() * 5)
    let halfW = 0
    for (let i = 0; i < n; i++) {
      // lobe 沿云长轴铺开：均匀位置 + 抖动，端部自动收小
      const along = i / (n - 1) // 0~1
      const endK = Math.sin(along * Math.PI) // 端部 0、中部 1
      const ox = (along - 0.5) * width * (0.9 + randomVisual() * 0.2) + (randomVisual() - 0.5) * 40
      const oy = (randomVisual() - 0.5) * (46 + endK * 46)
      const r = (64 + randomVisual() * 52) * (0.55 + endK * 0.6)
      halfW = Math.max(halfW, Math.abs(ox) + r)
      lobes.push({
        ox,
        oy,
        r,
        phase: randomVisual() * Math.PI * 2,
        breath: 0.04 + randomVisual() * 0.06
      })
    }
    return {
      nx: randomVisual(),
      ny: randomVisual(),
      vx: 0.006 + randomVisual() * 0.01,
      swayAmp: 8 + randomVisual() * 16,
      swayFreq: 0.06 + randomVisual() * 0.08,
      phase: randomVisual() * Math.PI * 2,
      baseA: 0.62 + randomVisual() * 0.38,
      breathFreq: 0.04 + randomVisual() * 0.05,
      lobes,
      halfW
    }
  }

  update(dt: number): void {
    this.t += dt
  }

  get rasterBytes(): number {
    const image = rasters.get(this)?.image
    return image ? image.width * image.height * 4 : 0
  }
  releaseRenderResources(): void {
    const cached = rasters.get(this)
    if (cached) cached.image.width = cached.image.height = 1
    rasters.delete(this)
  }

  /**
   * 按房间像素尺寸全屋绘制；云块漂出边缘时在对侧补画整块副本（无缝）。
   */
  render(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!CONFIG.art.fog.enabled) return
    const started=profiler.start(),view=canvasViewport(ctx)
    const width = view.right - view.left, height = view.bottom - view.top
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      this.drawPatches(ctx, w, h, view)
      profiler.end('fog', started)
      return
    }
    const density = Math.min(1, 960 / Math.max(width, height))
    let cached = rasters.get(this)
    if (!cached) {
      const image = document.createElement('canvas')
      cached = { image, context: image.getContext('2d')!, left: NaN, top: NaN, width: NaN, height: NaN, time: NaN, opacity: NaN, alpha: NaN, roomW: NaN, roomH: NaN, density }
      rasters.set(this, cached)
    }
    if (cached.left !== view.left || cached.top !== view.top || cached.width !== width || cached.height !== height || cached.density !== density
      || cached.time !== this.t || cached.opacity !== ctx.globalAlpha || cached.alpha !== CONFIG.art.fog.alpha || cached.roomW !== w || cached.roomH !== h) {
      const pixelsW = Math.max(1, Math.ceil(width * density)), pixelsH = Math.max(1, Math.ceil(height * density))
      if (cached.image.width !== pixelsW) cached.image.width = pixelsW
      if (cached.image.height !== pixelsH) cached.image.height = pixelsH
      const c = cached.context
      c.setTransform(1, 0, 0, 1, 0, 0)
      c.clearRect(0, 0, cached.image.width, cached.image.height)
      c.setTransform(density, 0, 0, density, -view.left * density, -view.top * density)
      // 每瓣的原始透明度一起合成，保留多瓣重叠处的云核厚度。
      c.globalAlpha = ctx.globalAlpha
      this.drawPatches(c, w, h, view)
      cached.left = view.left; cached.top = view.top; cached.width = width; cached.height = height
      cached.density = density; cached.time = this.t; cached.opacity = ctx.globalAlpha
      cached.alpha = CONFIG.art.fog.alpha; cached.roomW = w; cached.roomH = h
      profiler.increment('fogBakes')
    } else profiler.increment('fogReuses')
    ctx.save()
    ctx.globalAlpha = 1
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(cached.image, 0, 0, width * density, height * density, view.left, view.top, width, height)
    ctx.restore()
    profiler.end('fog',started)
  }

  /** 云瓣先在柔光贴图内合成；显示帧只往主画布覆盖一次。 */
  private drawPatches(ctx: CanvasRenderingContext2D, w: number, h: number, view: Viewport): void {
    const t = this.t
    const span = 1.5
    for (const p of this.patches) {
      let nx = p.nx + p.vx * t
      nx = ((nx % span) + span) % span - (span - 1) / 2
      const x = nx * w
      const y = p.ny * h + Math.sin(t * p.swayFreq * Math.PI * 2 + p.phase) * p.swayAmp
      const breath = 0.82 + 0.18 * Math.sin(t * p.breathFreq * Math.PI * 2 + p.phase * 1.7)
      const a = CONFIG.art.fog.alpha * p.baseA * breath
      this.drawCloud(ctx, p, x, y, t, a,view)
      // 对侧副本：只有真正越界（云缘超出屏幕）时才补
      if (x - p.halfW < 0) this.drawCloud(ctx, p, x + w, y, t, a,view)
      else if (x + p.halfW > w) this.drawCloud(ctx, p, x - w, y, t, a,view)
    }
  }

  /** 绘制一整块云（逐 lobe 软圆叠加，重叠处自然变厚） */
  private drawCloud(
    ctx: CanvasRenderingContext2D,
    p: FogPatch,
    x: number,
    y: number,
    t: number,
    alpha: number,
    view:Viewport
  ): void {
    if (alpha <= 0.001) return
    for (const l of p.lobes) {
      const k = 1 + l.breath * Math.sin(t * 0.5 + l.phase)
      const r = l.r * k
      const ly = y + l.oy + Math.sin(t * 0.3 + l.phase * 2.1) * 5
      if(!visible(view,x+l.ox,ly,r))continue
      ctx.save();ctx.imageSmoothingEnabled=true;ctx.translate(x+l.ox,ly);ctx.scale(r/128,r/128);ctx.globalAlpha*=alpha
      drawSprite(ctx,radialStamp('fog:lobe',.08,FOG_STOPS));ctx.restore()
    }
  }
}
