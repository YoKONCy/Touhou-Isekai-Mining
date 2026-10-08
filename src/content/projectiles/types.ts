/**
 * 敌方弹幕内容契约（工程化 L3）
 *
 * 直线弹 / 环弹共用同一个 Projectile 实体，差异（速度/伤害/外观）全部在
 * ProjectileDef 里；kite_shooter 模板通过 KiteShooterParams 点名发射哪两发弹。
 * 加新弹种 = 新建一个 Def 文件（可自带渲染器）+ pack 加一行，引擎零改动。
 */
import type { StatusDefinition } from '../../shared/statusEffects'
import type { ContentId } from '../core/ids'

export type ProjectileId = ContentId

/** 弹体渲染视图（实体每帧传给 Def 自带渲染器的全部信息） */
export interface BulletView {
  ctx: CanvasRenderingContext2D
  x: number
  y: number
  /** 弹体碰撞半径（绘制基准尺寸） */
  r: number
  /** 蠕动/自转相位（每实体错峰） */
  phase: number
  /** 飞行方向，用于有朝向的滴形弹体 */
  angle: number
  /** 分裂弹的实际行程进度，仅供膨胀预警绘制，不改变碰撞半径。 */
  splitProgress?: number
  /** 持续时间与升起进度，表现与触碰门控使用同一时钟。 */
  age?: number
}

/** 弹体自定义绘制（不填则引擎不会兜底——弹种应当显式声明长相） */
export type BulletRenderer = (view: BulletView) => void

export interface ProjectileDef {
  /** 命名空间 id（touhou:xxx / mod:xxx；展示名走语言键 projectile.<id>.name） */
  id: ProjectileId
  /** 飞行速度 px/s（生成时按发射角展开为速度向量） */
  speed: number
  /** 碰撞半径 px */
  radius: number
  /** 命中玩家伤害 */
  damage: number
  /** 成功命中后施加的状态，来源按状态 id 合并。 */
  onHitStatus?: StatusDefinition
  /** 穿过房内瓦片与摆件障碍，仍在飞出地图或寿命耗尽时消失；缺省为 false。 */
  pierceObstacles?: boolean
  /** 穿过房内矿石和摆件，但仍由墙体及封闭门回收。 */
  ignoreRoomObstacles?: boolean
  /** 特殊弹种可声明最长存活秒数；缺省持续飞行，由墙体、障碍或战斗命中回收。 */
  life?: number
  /** 螺旋弹围绕出生点旋转并持续外扩，速度为径向速度。 */
  spiral?: { angularSpeed: number; initialRadius: number; angularDecay?: number }
  /** 滞留毛团升起时不造成伤害，升起后等待触发；命中一次即消失。 */
  lingering?: { riseTime: number }
  /** 达到实际飞行距离后分裂；撞墙、命中、消弹和寿终都不会触发。 */
  split?: { distance: number; count: number; projectileId: ProjectileId }
  /** 弹体外观（官方程序化绘制；MOD 可画任意形状） */
  render: BulletRenderer
  /** 自由标签（消弹分派/抗性/事件条件用，如 ['venom','ring']） */
  tags?: string[]
}
