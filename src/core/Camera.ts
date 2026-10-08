import type { Vec2 } from './types'

/**
 * 2D 跟随相机
 * - 平滑跟随目标（帧率独立的指数插值）
 * - 视口被世界边界 clamp，不显示黑边
 * - cover 自适应缩放：任何屏幕尺寸下世界区域都铺满视口（房间四周永无虚空）
 * - 内置 trauma 制屏幕震动：震屏随 trauma 平方衰减，越抖越轻
 */
export class Camera {
  /** 视口左上角的世界坐标 */
  x = 0
  y = 0

  /** 世界 → 屏幕的缩放（cover：max(屏宽/界宽, 屏高/界高)，>=1 或视小窗口时 <1） */
  zoom = 1

  /** 震动创伤值 0~1 */
  private trauma = 0
  /** 震动随机相位种子（不依赖每帧随机） */
  private shakeSeed = 0

  /** 跟随平滑系数（越大越紧） */
  followLerp = 10
  /** 震幅按屏幕像素计（换算世界单位时除以 zoom，任何缩放下屏感一致） */
  private maxTraumaOffset = 10

  constructor(
    public viewW: number,
    public viewH: number,
    /** 世界边界（通常是房间可活动区域） */
    public bounds: { left: number; top: number; right: number; bottom: number }
  ) {
    // 刷新时布局可能尚未就绪，零尺寸不能进入相机除法。
    this.viewW = Number.isFinite(viewW) && viewW > 0 ? viewW : 1
    this.viewH = Number.isFinite(viewH) && viewH > 0 ? viewH : 1
    this.updateZoom()
  }

  /** 视口尺寸变化时调用（重算 cover 缩放） */
  resize(viewW: number, viewH: number): void {
    // 暂时隐藏或尚未完成布局时沿用最后有效视口。
    if (!Number.isFinite(viewW) || !Number.isFinite(viewH) || viewW <= 0 || viewH <= 0) return
    this.viewW = viewW
    this.viewH = viewH
    this.updateZoom()
    this.clampPosition()
  }

  /** 屏幕能看到的世界尺寸（视口除以缩放） */
  get visibleW(): number {
    return this.viewW / this.zoom
  }
  get visibleH(): number {
    return this.viewH / this.zoom
  }

  /** cover 缩放：取宽高比的较大者，保证世界区域在两轴上都铺满、不留虚空 */
  private updateZoom(): void {
    const bw = Math.max(1, this.bounds.right - this.bounds.left)
    const bh = Math.max(1, this.bounds.bottom - this.bounds.top)
    this.zoom = Math.max(this.viewW / bw, this.viewH / bh)
  }

  /** 切换房间时更换世界边界并立刻钳制（房间级相机；本游戏房间同尺寸，zoom 不变） */
  setBounds(bounds: { left: number; top: number; right: number; bottom: number }): void {
    this.bounds = bounds
    this.updateZoom()
    this.clampPosition()
  }

  /** 立刻把相机中心放到指定点（切场景/出生时用） */
  snapTo(center: Vec2): void {
    this.x = center.x - this.visibleW / 2
    this.y = center.y - this.visibleH / 2
    this.clampPosition()
  }

  /** 每帧跟随目标点 */
  follow(target: Vec2, dt: number): void {
    const tx = target.x - this.visibleW / 2
    const ty = target.y - this.visibleH / 2
    // 帧率独立的指数平滑
    const t = 1 - Math.exp(-this.followLerp * dt)
    this.x += (tx - this.x) * t
    this.y += (ty - this.y) * t
    this.clampPosition()
  }

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount)
  }

  /** 屏幕坐标 → 世界坐标 */
  screenToWorld(sx: number, sy: number): Vec2 {
    const s = this.currentShake()
    return { x: sx / this.zoom + this.x + s.x, y: sy / this.zoom + this.y + s.y }
  }

  /**
   * 应用相机变换（含震动偏移）
   * 渲染场景时调用：ctx.save() → camera.apply(ctx) → 画世界 → ctx.restore()
   */
  apply(ctx: CanvasRenderingContext2D): void {
    const s = this.currentShake()
    ctx.scale(this.zoom, this.zoom)
    ctx.translate(-Math.round(this.x + s.x), -Math.round(this.y + s.y))
  }

  /** 每帧逻辑末尾推进震动衰减 */
  update(dt: number): void {
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - dt * 1.6)
    }
    this.shakeSeed += dt * 35
  }

  /** 震动位移（世界单位；屏幕震幅固定，故除以 zoom） */
  private currentShake(): Vec2 {
    if (this.trauma <= 0) return { x: 0, y: 0 }
    const mag = (this.trauma * this.trauma * this.maxTraumaOffset) / this.zoom
    return {
      x: (Math.sin(this.shakeSeed * 1.3) + Math.sin(this.shakeSeed * 2.7)) * 0.5 * mag,
      y: (Math.cos(this.shakeSeed * 1.7) + Math.sin(this.shakeSeed * 3.1)) * 0.5 * mag
    }
  }

  private clampPosition(): void {
    const { left, top, right, bottom } = this.bounds
    const w = Math.min(this.visibleW, right - left)
    const h = Math.min(this.visibleH, bottom - top)
    // 已污染的旧相机也能在下一次有效布局时恢复，避免黑屏持续到重载。
    if (!Number.isFinite(this.x)) this.x = left + (right - left - w) / 2
    if (!Number.isFinite(this.y)) this.y = top + (bottom - top - h) / 2
    this.x = Math.max(left, Math.min(this.x, right - w))
    this.y = Math.max(top, Math.min(this.y, bottom - h))
  }
}
