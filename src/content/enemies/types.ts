/**
 * 敌人内容契约（工程化 L2）
 *
 * 设计（主人拍板）：敌人 = **预定义 AI 模板套皮**——
 * 数值/配色/投放权重全在 Def 里，行为从引擎提供的模板（chaser/kite_shooter）
 * 里选一个；未来 Boss 再开放 custom 脚本 AI。
 * 加一只新怪 = 新建一个 Def 文件 + pack 加一行，引擎零改动。
 */
import type { ContentId } from '../core/ids'
import type { ProjectileId } from '../projectiles/types'

export type EnemyId = ContentId

/** 引擎预定义 AI 模板 id（custom 留给未来 Boss 脚本 AI） */
export type AiTemplateId = 'chaser' | 'kite_shooter' | 'pouncer' | (string & {})

/** 命中/死亡音效材质（与 Sfx 的 FleshKind 对应；新增怪沿用现有音色体系） */
export type HitMaterial = 'slime' | 'venom' | 'bat'

/** 调色板：身体主色 / ink 内描边 / 死亡溅开粒子 / 血条常规段颜色 */
export interface EnemyPalette {
  body: string
  edge: string
  death: string
  hpBar: string
}

/** 战斗参数（接触伤害结算 + 受击反馈） */
export interface EnemyCombat {
  /** 物抗/魔抗数值，缺省0；范围减伤为0~1。 */
  physicalResist?: number
  magicResist?: number
  aoeReduction?: number
  /** 接触伤害值 */
  contactDamage: number
  /** 同一只怪两次接触伤害的间隔（秒） */
  attackCd: number
  /** 接触判定额外容差（半径和之外多少 px 仍算咬到） */
  contactPad: number
  /** 被武器命中的击退初速度（武器未自带击退力时的兜底） */
  knockback: number
  /** 命中玩家后自身后撤速度 */
  recoil: number
  /**
   * 击退抗性（减法，px/s）：实际受击击退 = max(0, 来源击退力 - 抗性)。
   * 缺省 0＝吃满击退；抗性 ≥ 来源击退力时几乎原地硬扛（坦克怪）。
   */
  knockbackResist?: number
  /** 弹幕僵直抗性（实际僵直 = 武器 stun - 抗性） */
  stunResist: number
}

/** chaser 模板参数：游荡→追脸近战 */
export interface ChaserParams {
  wanderSpeed: number
  chaseSpeed: number
  accel: number
  sight: number
  loseSight: number
  /**
   * 周期性升速（可选）：每隔随机 [minInterval, maxInterval] 秒进入 duration 秒加速档，
   * 游荡/追击速度同乘 speedMult；升速中渲染层画拖尾。缺省＝恒速怪。
   */
  surge?: {
    minInterval: number
    maxInterval: number
    duration: number
    speedMult: number
  }
}

/** kite_shooter 模板参数：保持距离放风筝 + 两种弹幕节拍 */
export interface KiteShooterParams {
  wanderSpeed: number
  kiteSpeed: number
  accel: number
  sight: number
  loseSight: number
  /** 保持距离区间：太近后撤、太远逼近、区间内横移 */
  kiteMin: number
  kiteMax: number
  /** 直线瞄准弹间隔（秒） */
  straightInterval: number
  /** 16 向环弹间隔（秒） */
  ringInterval: number
  /** 环弹数量（均布一圈） */
  ringCount: number
  /** 两种吐弹前摇（秒） */
  straightWindup: number
  ringWindup: number
  /** 首次开火随机延迟上限（避免一群怪同帧齐射） */
  firstFireJitter: number
  /** 直线瞄准弹使用的弹种 id（查弹幕注册表） */
  straightProjectileId: ProjectileId
  /** 环弹使用的弹种 id */
  ringProjectileId: ProjectileId
}

/**
 * pouncer 模板参数：来拒去留 + 绕圈拉扯，周期性"预判猛扑"。
 * 平时与玩家保持环形距离（太近撤、太远追、甜区绕圈）；
 * 攻击 CD 到点原地蓄力（给读招/打断窗口），随后朝玩家预判位置短距猛扑，
 * 猛扑伤害由 combat.contactDamage 提供；可另配普通身体接触伤害。
 */
export interface PouncerParams {
  /** 普通身体接触伤害，缺省为零；与猛扑伤害择一结算，不叠加。 */
  bodyContactDamage?: number
  wanderSpeed: number
  /** 环绕/拉扯走位速度（应略快于同档 chaser，体现"更敏捷"） */
  kiteSpeed: number
  accel: number
  sight: number
  loseSight: number
  /** 拉扯甜区：小于 orbitMin 后撤、大于 orbitMax 逼近、区间内绕圈 */
  orbitMin: number
  orbitMax: number
  /** 猛扑攻击周期（秒；扑中/扑空后都重新等满） */
  attackInterval: number
  /** 扑前原地蓄力秒数（可被僵直打断） */
  pounceWindup: number
  /** 猛扑初速度 px/s */
  pounceSpeed: number
  /** 猛扑持续秒数（速度×时长≈扑击距离） */
  pounceDur: number
  /** 预判系数 0~1：瞄准点 = 玩家现位 + 玩家速度 × (pounceDur × lead) */
  lead: number
}

/** 自然刷新投放配置（缺省 = 不进自然刷怪池，仅事件/召唤物） */
/** 锁定终点的冲刺循环：追逐、蓄力、直线冲刺、定时拉扯，可选两连发。 */
export interface ChargeCycleParams {
  chaseSpeed:number
  retreatSpeed:number
  sight:number
  triggerRange:number
  /** 追逐未进入起手距离达到此时长，自动转回拉扯；缺省不限时。 */
  chaseTimeout?:number
  windup:number
  dashSpeed:number
  dashDistance:number
  dashDamage:number
  retreatDuration:readonly [number,number]
  volley?:{interval:number;gap:number;projectileId:ProjectileId}
}

export interface EnemySpawn {
  /** 固定投放数量，不参加随机权重池；每个匹配房间仅初始化一次。 */
  fixedCount?: number
  minFloor?: number
  maxFloor?: number
  /** 刷怪权重（混编时加权抽取；K 批次 蓝:绿=3:1） */
  weight: number
  /** 指定楼层可覆写混编权重，其他楼层沿用基础权重。 */
  floorWeights?: Readonly<Record<number, number>>
  /** 可出现的房型（默认 normal/exit 战斗房） */
  rooms?: string[]
  /** 深度门控（min/max 均含端点；缺省不限制） */
  minDepth?: number
  maxDepth?: number
}

/** 视觉/动作特征开关 */
export type EnemyBodyPath = (ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) => void

export interface EnemyAppearanceView {
  /** 固定方向精灵使用；纵向飞行统一使用下向，不连续旋转身体。 */
  facing?: 'left' | 'right' | 'down'
  ctx: CanvasRenderingContext2D
  x: number
  y: number
  r: number
  rx: number
  ry: number
  vx: number
  vy: number
  alive: boolean
  engaged: boolean
  phase: number
  windup: string | null
  windupProgress: number
  pounceProgress: number
  pounceState: string
  pounceAngle: number
  /** 来自正式数值定义的突刺最大位移，预警不能另写一套距离。 */
  dashDistance?: number
  /** 护卫后空翻进度，-1 表示未回弹；纯表现层读取。 */
  reboundProgress?: number
  ringCount: number
  antennaLag: number
  alpha: number
  flash: number
  palette: EnemyPalette
  visual: EnemyVisual
}

export interface EnemyVisual {
  /** 资源负责身体材质、表情及专属特征；不接触运行时实体。 */
  render?: (view: EnemyAppearanceView) => void
  warning?: (view: EnemyAppearanceView) => void
  motion?: (view: EnemyAppearanceView) => void
  /** 资源自带身体轮廓。 */
  bodyPath?: EnemyBodyPath
  /** hop 节奏：true=快蹦高弧线（蓝史莱姆），false=慢黏低弧线（绿史莱姆） */
  fastHop: boolean
  /** 头顶两根带毒滴触角（远程怪辨识标志） */
  antennae: boolean
  /** 头顶一对尖角（猛扑系史莱姆辨识标志，蓄力时角尖发红告警） */
  horns?: boolean
}

export interface EnemyDef {
  /** 飞行敌人越过矿石和矮摆件，仍受房间墙壁约束。 */
  movement?: 'flying' | 'stationary'
  /** 专属掉落表；存在时替代通用史莱姆凝液摇号，各项独立判定。 */
  drops?: readonly {item:ContentId;chance:number;qty:number}[]
  /** 命名空间 id（展示名走语言键 enemy.<id>.name） */
  id: EnemyId
  /** 选用的 AI 模板 */
  ai: AiTemplateId
  hp: number
  radius: number
  /** 受击区域独立于地面移动碰撞；偏移量以实体坐标为基准。 */
  hurtbox?: { offsetX?: number; offsetY?: number; radius: number }
  /** 击杀基础经验（吃深层倍率；缺省走 CONFIG.exp.kill） */
  exp?: number
  combat: EnemyCombat
  palette: EnemyPalette
  hitMaterial: HitMaterial
  /** chaser 模板参数（ai==='chaser' 时必填） */
  chaser?: ChaserParams
  /** kite_shooter 模板参数（ai==='kite_shooter' 时必填） */
  kite?: KiteShooterParams
  /** pouncer 模板参数（ai==='pouncer' 时必填） */
  pouncer?: PouncerParams
  turret?: {sight:number;interval:number;windup:number;burstChance:number;burstCount:number;burstGap:number;projectileId:ProjectileId}
  /** 护卫在伙伴与玩家之间站位，短扑后返回起扑点。 */
  guardian?: { speed: number; sight: number; guardDistance: number; interval: number; windup: number; lungeSpeed: number; lungeDuration: number; returnSpeed: number; bodyContactDamage?: number }
  /** 毛玉的六发波浪射击与定距分裂毛球共用一套放风筝节拍。 */
  kedama?: { speed: number; sight: number; retreatRange: number; interval: number; waveGap: number; waveProjectileId: ProjectileId; seedProjectileId: ProjectileId }
  chargeCycle?: ChargeCycleParams
  /** 自然刷怪配置（不填=只能由事件生成） */
  spawn?: EnemySpawn
  visual: EnemyVisual
  /** 自由标签（图鉴/Boss 门控/事件条件用） */
  tags?: string[]
}
