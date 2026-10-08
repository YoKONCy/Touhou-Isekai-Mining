import { InputManager } from './InputManager'
import type { EngineContext, GameScene } from './types'

/**
 * 游戏引擎：主循环、高分屏适配、命中停顿（hit-stop）
 *
 * 设计要点（2025-2026 Canvas 实践）：
 * - rAF 单循环 + dt 驱动，dt 上限裁剪防止切后台回来后"瞬移"
 * - 命中停顿时世界 dt=0 但玩家照常更新、渲染照常，产生冻结打击感而不拖慢攻速
 * - 按 devicePixelRatio 放大画布物理分辨率，CSS 尺寸保持 100%
 * - 关闭图像平滑，为未来像素风程序绘制保硬边
 */
export class GameEngine implements EngineContext {
  readonly input = new InputManager()

  viewW = 1
  viewH = 1

  /** 渲染帧率（指数平滑，供 HUD 显示） */
  fps = 0
  /** 最近一帧的帧时间（毫秒，供 HUD 显示） */
  frameMs = 0

  private ctx: CanvasRenderingContext2D
  private rafId = 0
  private lastTime = 0
  private running = false
  private dpr = 1
  private drawable = false
  private resizeObserver: ResizeObserver | null = null

  /** 命中停顿剩余秒数 */
  private hitStopLeft = 0

  private scene: GameScene | null = null

  /** 每帧统计回调（供 Vue HUD 取数，约每 0.2 秒触发一次节流在外部处理） */
  onStats: ((stats: { fps: number; frameMs: number }) => void) | null = null
  private statsTimer = 0

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('当前环境不支持 Canvas2D 喵！')
    this.ctx = ctx
    this.input.attach(canvas)
    this.resize()
    window.addEventListener('resize', this.resize)
    // 刷新后的布局变化不一定触发窗口 resize，直接跟踪画布尺寸。
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.resize)
      this.resizeObserver.observe(canvas)
    }
  }

  /** 挂载/切换场景（未来切换基地↔矿洞就走这里） */
  setScene(scene: GameScene): void {
    this.scene = scene
    scene.enter?.(this)
  }

  /** 启动主循环 */
  start(): void {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now()
    this.rafId = requestAnimationFrame(this.loop)
  }

  /** 停止并释放资源 */
  destroy(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
    window.removeEventListener('resize', this.resize)
    this.resizeObserver?.disconnect()
    this.input.detach()
  }

  hitStop(seconds: number): void {
    // 多次命中取较大值，不叠加到失控
    this.hitStopLeft = Math.max(this.hitStopLeft, seconds)
  }

  worldDt(realDt: number): number {
    // 顿帧期间世界 dt 归 0，但玩家由场景以真实 dt 单独更新（攻速/移动不被冻结）
    if (this.hitStopLeft > 0) {
      this.hitStopLeft = Math.max(0, this.hitStopLeft - realDt)
      return 0
    }
    return realDt
  }

  shake(amount: number): void {
    // 震动由场景内相机消费；这里转存，场景的相机在 update 中读取
    this.shakeAmount = amount
  }
  /** 待场景相机消费的震动量（消费后清零） */
  shakeAmount = 0

  private resize = (): void => {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    this.drawable = w > 0 && h > 0
    // 保留有效分辨率，避免零尺寸把相机和光照坐标污染为 NaN。
    if (!this.drawable) return
    this.dpr = Math.min(window.devicePixelRatio || 1, 2) // DPR 封顶 2，避免 4K 屏过度填充
    this.viewW = w
    this.viewH = h
    const width = Math.round(w * this.dpr)
    const height = Math.round(h * this.dpr)
    if (this.canvas.width !== width) this.canvas.width = width
    if (this.canvas.height !== height) this.canvas.height = height
  }

  private loop = (now: number): void => {
    if (!this.running) return
    this.rafId = requestAnimationFrame(this.loop)

    let dt = (now - this.lastTime) / 1000
    this.lastTime = now
    // 布局尚未就绪时不推进剧情黑幕；下一帧重新检查，恢复后才正常显影。
    if (!this.drawable) {
      this.resize()
      if (!this.drawable) {
        this.input.endFrame()
        return
      }
    }
    // 切后台/卡顿保护：单帧最多按 50ms 结算，防止实体穿墙
    dt = Math.min(dt, 0.05)

    this.frameMs = dt * 1000
    this.fps = this.fps === 0 ? 1 / dt : this.fps * 0.92 + (1 / dt) * 0.08

    // 命中停顿改由场景通过 engine.worldDt(dt) 消费：
    // 世界冻结、玩家不冻结；渲染始终照常
    if (this.scene) {
      this.scene.update(dt, this)
      // 帧之间不继承裁剪区、混合模式或未配平的保存栈；仅重置变换无法解除空裁剪黑屏。
      this.ctx.reset()
      // 每帧以 DPR 重置变换并清屏
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
      this.ctx.imageSmoothingEnabled = false
      this.scene.render(this.ctx, this)
    }

    // 统计节流上报给 HUD
    this.statsTimer += dt
    if (this.statsTimer >= 0.2) {
      this.statsTimer = 0
      this.onStats?.({ fps: this.fps, frameMs: this.frameMs })
    }

    this.input.endFrame()
  }
}
