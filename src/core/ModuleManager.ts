/**
 * 模块管理器：引擎唯一持有的"根场景"
 *
 * 自身实现 GameScene 契约（enter/update/render），所以 GameEngine 零改动——
 * 引擎只知道每帧驱动一个场景，至于当前是矿洞还是据点，由本管理器转发。
 */
import type { EngineContext, GameScene } from './types'
import { EventBus } from './EventBus'
import type { IGameModule, ModuleContext } from './module'

export class ModuleManager<E extends object = Record<string, unknown>>
  implements GameScene
{
  readonly bus: EventBus<E> = new EventBus<E>()
  private modules = new Map<string, IGameModule>()
  private current: IGameModule | null = null
  private mctx: ModuleContext<E>
  onTransition: ((state: { destination: string; failed: boolean } | null) => void) | null = null
  private transition: { id: string; payload?: unknown; start: number; switched: boolean } | null = null

  /** 幕间全遮挡时交接模块；短暂停留不是实际加载进度。 */
  transitionTo(id: string, payload?: unknown, failed = false): void {
    if (this.transition) return
    if (!this.modules.has(id)) throw new Error(`ModuleManager：未注册的模块「${id}」`)
    this.transition = { id, payload, start: performance.now(), switched: false }
    this.onTransition?.({ destination: id, failed })
  }

  get transitioning(): boolean { return this.transition !== null }

  constructor() {
    // engine 在 enter（引擎挂载）时才就位，先占位
    this.mctx = {
      engine: null as unknown as EngineContext,
      bus: this.bus as EventBus<E>,
      manager: this
    } as ModuleContext<E>
  }

  /** 注册模块（不触发 onEnter） */
  register(mod: IGameModule): void {
    this.modules.set(mod.id, mod)
  }

  /** GameScene 钩子：引擎挂载时注入引擎上下文 */
  enter(engine: EngineContext): void {
    ;(this.mctx as { engine: EngineContext }).engine = engine
  }

  /** 切换当前模块（旧模块 onExit → 新模块 onEnter） */
  switchTo(id: string, payload?: unknown): void {
    const next = this.modules.get(id)
    if (!next) throw new Error(`ModuleManager：未注册的模块「${id}」`)
    this.current?.onExit()
    this.current = next
    next.onEnter(this.mctx, payload)
  }

  get currentId(): string | null {
    return this.current?.id ?? null
  }

  /** 返回标题或读取其他档时释放当前场景，撤销剧情与输入监听。 */
  leave(): void {
    this.transition = null
    this.onTransition = null
    this.current?.onExit()
    this.current = null
  }

  /** 当前模块的 HUD 快照（无模块/无实现时返回 null） */
  getHudState(): Record<string, unknown> | null {
    return this.current?.getHudState?.() ?? null
  }

  update(dt: number, engine: EngineContext): void {
    const transition = this.transition
    if (transition) {
      const elapsed = performance.now() - transition.start
      if (!transition.switched && elapsed >= 300) {
        transition.switched = true
        this.switchTo(transition.id, transition.payload)
        // 至少渲染一次新场景，再允许解除覆盖层与输入锁。
        return
      }
      if (elapsed >= 2500) {
        engine.input.reset()
        this.transition = null
        this.onTransition?.(null)
      }
      return
    }
    this.current?.update(dt, engine)
  }

  render(g: CanvasRenderingContext2D, engine: EngineContext): void {
    this.current?.render(g, engine)
  }
}
