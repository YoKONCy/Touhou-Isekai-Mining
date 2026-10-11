import { InputManager } from './InputManager'
import { profiler } from './performance/Profiler'
import type { EngineContext, GameScene } from './types'
import { displaySettings, compactLayout, onDisplayChange } from '../browser/display'

/**
 * 游戏引擎：主循环、高分屏适配、命中停顿（hit-stop）
 *
 * 设计要点（2025-2026 Canvas 实践）：
 * - rAF 只驱动界面与渲染，模块管理器以固定步长驱动模拟
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
  private stopDisplay: (() => void) | null = null
  private lastRender = 0
  private renderPhase = 0
  private renderFrameMs = 0

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
    this.stopDisplay = onDisplayChange(this.resize)
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
    this.stopDisplay?.()
    this.input.detach()
  }

  hitStop(seconds: number): void {
    // 多次命中取较大值，不叠加到失控
    this.hitStopLeft = Math.max(this.hitStopLeft, seconds)
  }
  captureTiming(): { hitStop: number } { return { hitStop: this.hitStopLeft } }
  restoreTiming(state: { hitStop: number }): void {
    if (!Number.isFinite(state.hitStop) || state.hitStop < 0) throw new Error('命中停顿快照无效')
    this.hitStopLeft = state.hitStop; this.shakeAmount = 0
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
    // 渲染像素预算与逻辑坐标分离，降低分辨率不会改变移动、瞄准与判定。
    const cap = displaySettings.quality === 'low' ? 1 : displaySettings.quality === 'high' ? 2 : compactLayout.value ? 1.25 : 2
    const pixels = displaySettings.quality==='low'?1200000:compactLayout.value?displaySettings.quality==='high'?3200000:1800000:8300000
    this.dpr = Math.max(.5, Math.min(window.devicePixelRatio || 1, cap, Math.sqrt(pixels / (w * h))))
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
    const frameInterval=dt
    this.lastTime = now
    // 布局尚未就绪时不推进剧情黑幕；下一帧重新检查，恢复后才正常显影。
    if (!this.drawable) {
      this.resize()
      if (!this.drawable) {
        this.input.endFrame()
        return
      }
    }
    // 切后台/卡顿保护：单帧最多接收 250ms；逻辑按固定步长分段，管理器限制追赶次数
    dt = Math.max(0, Math.min(dt, 0.25))

    this.frameMs = dt * 1000

    // 命中停顿改由场景通过 engine.worldDt(dt) 消费：
    // 世界冻结、玩家不冻结；渲染始终照常
    if (this.scene) {
      profiler.beginFrame()
      profiler.count('fps',this.fps)
      this.input.pollDevices()
      const updateStart=profiler.start()
      this.scene.update(dt, this)
      profiler.end('update',updateStart)
      const limit = displaySettings.frameRate || (compactLayout.value ? 60 : 0)
      const interval = limit ? 1000 / limit : 0
      const renderElapsed = now - this.lastRender
      this.renderPhase += Math.min(250, frameInterval * 1000)
      if (!interval || !this.lastRender || this.renderPhase >= interval - .5) {
        this.renderPhase = interval ? Math.max(0, this.renderPhase - interval) % interval : 0
        const renderStart=profiler.start()
        if (this.lastRender && renderElapsed > 0) {
          this.renderFrameMs = this.renderFrameMs ? this.renderFrameMs * .92 + renderElapsed * .08 : renderElapsed
          this.fps = 1000 / this.renderFrameMs
        }
        this.lastRender = now
        // 帧之间不继承裁剪区、混合模式或未配平的保存栈；仅重置变换无法解除空裁剪黑屏。
        this.ctx.reset()
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
        this.ctx.imageSmoothingEnabled = false
        this.scene.render(this.ctx, this)
        profiler.end('render',renderStart)
      }
    }
    profiler.finishFrame(frameInterval)

    // 统计节流上报给 HUD
    this.statsTimer += dt
    if (this.statsTimer >= 0.2) {
      this.statsTimer = 0
      this.onStats?.({ fps: this.fps, frameMs: this.frameMs })
    }

    this.input.endFrame()
  }
}
