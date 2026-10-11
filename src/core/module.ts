/**
 * 玩法模块契约（一核多模架构的核心）
 *
 * 每个玩法模块（矿洞 CaveModule / 未来据点 BaseModule / 大世界 WorldModule）
 * 只实现这几个钩子；模块之间禁止互相 import，跨模块只走 EventBus + ModuleManager.switchTo。
 */
import type { EngineContext } from './types'
import type { EventBus } from './EventBus'
import type { ModuleManager } from './ModuleManager'

/** 模块生命周期上下文（onEnter 时由管理器提供） */
export interface ModuleContext<E extends object = Record<string, unknown>> {
  readonly engine: EngineContext
  readonly bus: EventBus<E>
  readonly manager: ModuleManager
}

export interface IGameModule {
  /** 完整玩法快照与安全恢复入口，和检查点存档分开。 */
  captureSimulation?(): unknown
  restoreSimulation?(state: unknown): void
  /** 录制时检查外部操作的轻量状态，避免每个逻辑步复制整层房间与弹幕。 */
  captureInputState?(): unknown
  /** 模块唯一 id（switchTo 时用） */
  readonly id: string
  // 上下文用 any 放宽：具体模块（如 CaveModule）可以收窄为 ModuleContext<GameEvents>
  /** 进入模块（可携带任意 payload，如矿洞深度） */
  onEnter(ctx: ModuleContext<any>, payload?: unknown): void
  /** 在暂停判断前只处理界面快捷键；不能推进移动、战斗或计时。 */
  handleUIInput?(engine: EngineContext): void
  /** 暂停期间仅同步视口等显示数据，不传入玩法时间。 */
  updatePaused?(engine: EngineContext): void
  /** 每个固定逻辑步更新，dt 为模拟时间。 */
  update(dt: number, engine: EngineContext): void
  /** 每帧渲染 */
  render(g: CanvasRenderingContext2D, engine: EngineContext): void
  /** 被切出时清理（事件退订/定时器等） */
  onExit(): void
  /** HUD 只读快照（外层约 10Hz 轮询，禁止每帧调用引发重渲染） */
  getHudState?(): Record<string, unknown>
  /**
   * 收集本模块的局内存档切片（自动保存/切模块时由上层调用）。
   * 仅持久化"局内进度"（如当前楼层布局）；角色常驻状态走账号级 Profile，不在此列。
   * 返回 undefined 表示该模块无需局内存档。
   */
  save?(): unknown
  /** 进模块时恢复局内切片（无档时参数为 null，模块按全新开局处理） */
  load?(slice: unknown | null): void
}
