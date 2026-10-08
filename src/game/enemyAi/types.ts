/**
 * 敌人 AI 模板契约（工程化 L2，属引擎机制不属内容）
 *
 * 预定义模板对 Enemy 的读写全部走 EnemyAiHost 接口，不直接依赖 Enemy 类，
 * 从而避免"模板 ↔ 实体"循环引用；Enemy 类实现该接口。
 * 未来 Boss 的 custom 脚本 AI 也实现同一个 EnemyBrain 接口注册进来。
 */
import type { TileMap } from '../tilemap'
import type { EnemyDef } from '../../content/enemies/types'
import type { ProjectileId } from '../../content/projectiles/types'

/** AI 行为态 */
export type AIState = 'idle' | 'wander' | 'chase' | 'kite'

/** 吐弹前摇态（none=未蓄力；期间站定告警示意，被僵直命中即作废） */
export type WindupKind = 'none' | 'straight' | 'ring'

/** pouncer 猛扑节拍态：none 拉扯游走 / windup 原地蓄力 / lunge 高速猛扑 */
export type PounceState = 'none' | 'windup' | 'lunge'

/**
 * 开火请求：
 * - straight=由场景瞄准玩家当前位置发射一发
 * - ring=由场景均布一圈（数量读 EnemyDef.kite.ringCount）
 * 弹种真值（速度/伤害/外观）由 projectileId 查弹幕注册表。
 */
export interface ShotRequest {
  readonly kind: 'straight' | 'ring'
  readonly projectileId: ProjectileId
  /** 显式角度用于波浪偏移；省略时由房间瞄准当前玩家。 */
  readonly angle?: number
  /** 配饰或其他独立发射点；普通怪省略时沿用身体边缘的出口。 */
  readonly origin?: { x: number; y: number }
}

/** AI 感知所需的最小玩家形状 */
export interface PlayerLike {
  x: number
  y: number
  /** 视觉半径（旧字段，缺省受击半径时兜底） */
  half: number
  /** 物理/受击碰撞圆半径（精瘦判定；接触伤害按此距离结算） */
  hitR?: number
  alive: boolean
  /** 不可选中期间保留仇恨记忆，但不刷新目标或起新瞄准攻击。 */
  untargetable?: boolean
  /** 当前速度（pouncer 预判猛扑用；缺省视为静止） */
  vx?: number
  vy?: number
}

/**
 * 模板可操作的宿主能力（Enemy 实现）：
 * 感知/移动节拍状态字段 + 共享导航与速度趋近方法 + 当前 Def。
 */
export interface EnemyAiHost {
  /** 同房间伙伴只读视图，不复制实体数组，也不跨房间索敌。 */
  readonly allies: readonly EnemyAlly[]
  x: number
  y: number
  readonly r: number
  vx: number
  vy: number
  readonly def: EnemyDef

  ai: AIState
  aiTimer: number
  wanderX: number
  wanderY: number

  /**
   * 强制警戒（剧情刷怪用）：true 时无视视野距离直接索敌玩家。
   * 序章怪物一出场就必须扑向玩家，不能等玩家走进 sight 才"发现"。
   */
  readonly alerted: boolean

  /** 弹幕僵直剩余秒数（只封出招不封移动） */
  stunT: number
  /** 技能封印和普通僵直共同门控主动技能，普通走位仍可进行。 */
  readonly canUseSkills: boolean

  // —— 接触攻击节拍：chaser/kite 命中后由实体消费；pouncer 读它决定何时起扑 ——
  contactCd: number

  // —— chaser 专用：周期升速节拍（surgeT>0＝加速档中；surgeCd＝距下次升速秒） ——
  surgeT: number
  surgeCd: number

  // —— kite_shooter 专用：横移方向/节拍 + 两种开火 CD + 前摇 ——
  strafeDir: number
  strafeTimer: number
  straightCd: number
  ringCd: number
  windup: WindupKind
  windupT: number
  /** 本帧产生的开火请求（场景每帧 drain） */
  pendingShots: ShotRequest[]
  /** 绕障偏转偏好（与横移换向同步） */
  avoidBias: number

  // —— pouncer 专用：猛扑三段节拍 + 锁定的扑向角（渲染读招也用） ——
  pounceState: PounceState
  pounceT: number
  pounceAng: number
  /** 冲刺循环模板独立状态，终点在起飞瞬间锁定。 */
  chargeStage:'chase'|'windup'|'dash'|'retreat'
  chargeT:number
  chaseT:number
  chargeEndX:number
  chargeEndY:number
  chargeHit:boolean
  /** 护卫回弹姿态进度，-1 为未回弹；不改变碰撞位置。 */
  guardianReboundProgress: number
  /** 护卫突刺独立冷却，按世界时间递减，受击和僵直不得修改。 */
  guardianDashCd: number
  burstT:number
  burstPending:boolean
  volleyLeft:number
  canMoveTo(map:TileMap,x:number,y:number):boolean

  /** 共享导航：前瞻避障申报期望速度（会绕矿脉、不蹭墙） */
  wantVelocity(map: TileMap, ang: number, speed: number): { x: number; y: number }
  /** 指数趋近目标速度 */
  approachVelocity(tvx: number, tvy: number, accel: number, dt: number): void
}

export interface EnemyAlly { x: number; y: number; r: number; alive: boolean; readonly def: EnemyDef }

/** AI 模板：每帧由 Enemy.update 在击退/碰撞结算之前调用一次 think */
export interface EnemyBrain {
  readonly id: string
  think(host: EnemyAiHost, dt: number, map: TileMap, player: PlayerLike, distP: number): void
}
