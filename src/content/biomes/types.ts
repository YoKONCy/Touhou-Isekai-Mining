/**
 * 生物群系内容契约（工程化 L3）
 *
 * 群系配置敌人、矿物投放及共用矿洞底板的美术变种。
 * 官方旧矿洞与深窟使用同一底板，新增楼层与普通群系通过数据覆写。
 */
import type { ContentId } from '../core/ids'
import type { RoomKind } from '../../game/cave/dungeon/types'

export type BiomeId = ContentId

/**
 * 数量预算与怪种权重独立：先按共用曲线确定总数，再按怪种权重混编。
 */
export interface BiomeEnemyBudget {
  /** 入口房（安全房） */
  start: readonly [number, number]
  /** 死胡同奖励房（安全房） */
  reward: readonly [number, number]
  /** 末间（裂隙房；撤离点，压力峰值） */
  exit: readonly [number, number]
  /** 普通房基准平均数量，楼层只覆写这个预算。 */
  normalAverage: number
  /** 共用入口距离倍率；第一项对应首邻，超出长度沿用最后一项。 */
  depthMultipliers: readonly number[]
}

/** 地表材质参数，颜色使用六位十六进制；由群系提供，不影响碰撞网格。 */
export interface BiomeFloorStyle {
  base: string
  dark: string
  light: string
  dust: string
  detailDensity: number
}

/** 共用矿洞底板的材质与装饰参数；普通群系和楼层仅覆写这些数据。 */
export interface CaveSceneStyle {
  wallTint: string
  tintStrength: number
  dampness: number
  vegetation: number
  deposits: number
  /** 菌膜与地衣覆盖，不生成会混淆采集判断的装饰蘑菇。 */
  fungi: number
  boneFragments: number
  fogStrength: number
  /** 深窟也是底板变种，额外沉积与地标叠在共用地面和墙体上。 */
  deepHollow: boolean
}

export interface CaveArtVariation {
  floorStyle?: Partial<BiomeFloorStyle>
  sceneStyle?: Partial<CaveSceneStyle>
}

export interface BiomeDef {
  /** 静态地表材质，未来群系可独立配置色板与细节密度。 */
  floorStyle?: BiomeFloorStyle
  /** 普通矿洞群系复用同一渲染底板，差异由材质和装饰组合表达。 */
  sceneStyle?: Partial<CaveSceneStyle>
  /** 楼层覆写数据，禁止在房间渲染器内按楼层另写一套场景。 */
  floorArt?: Readonly<Record<number, CaveArtVariation>>
  /** 命名空间 id（展示名走语言键 biome.<id>.name） */
  id: BiomeId
  /** 敌人投放预算 */
  enemyBudget: BiomeEnemyBudget
  /** 不同楼层仅配置普通房平均预算，刷新机制与距离曲线共用。 */
  floorEnemyAverages?: Readonly<Record<number, number>>
  /** 指定楼层末间预算，仍复用同一个刷怪流程。 */
  floorExitBudgets?: Readonly<Record<number, readonly [number, number]>>
  /** 各房型矿脉格数量区间 [min,max] */
  oreRange: Record<RoomKind, readonly [number, number]>
  /** 自由标签（筛选/事件条件用） */
  tags?: string[]
}
