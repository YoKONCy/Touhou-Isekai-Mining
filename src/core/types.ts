/**
 * 平台内核核心类型定义
 * 未来的 IGameModule（基地/矿洞/大世界）都将实现同一场景契约
 */

/** 二维向量 */
export interface Vec2 {
  x: number
  y: number
}

/** 引擎对外暴露给场景的上下文 */
export interface EngineContext {
  /** 视口 CSS 像素宽高 */
  readonly viewW: number
  readonly viewH: number
  /** 输入管理器 */
  readonly input: import('./InputManager').InputManager
  /** 触发命中停顿（秒）：期间世界逻辑时间冻结，玩家时钟不冻结，营造打击感 */
  hitStop(seconds: number): void
  /**
   * 每帧调用一次：消费命中停顿并返回本帧世界逻辑 dt。
   * 顿帧期间返回 0（敌人/弹幕/特效冻结），玩家自身仍应使用真实 dt 更新。
   */
  worldDt(realDt: number): number
  /** 触发屏幕震动（0~1 的强度）；值暂存于 shakeAmount，由场景相机当帧消费并清零 */
  shake(amount: number): void
  /** 待场景相机消费的震动量（场景读取后置 0） */
  shakeAmount: number
}

/**
 * 场景契约 —— 未来 IGameModule 的雏形
 * 每个玩法模块（矿洞/基地）只实现这几个钩子，互不引用
 */
export interface GameScene {
  /** 场景挂载时调用一次 */
  enter?(ctx: EngineContext): void
  /** 每帧逻辑更新（dt 单位秒，已做上限裁剪与命中停顿处理） */
  update(dt: number, ctx: EngineContext): void
  /** 每帧渲染（坐标系由场景自行通过相机管理） */
  render(ctx: CanvasRenderingContext2D, engine: EngineContext): void
}
