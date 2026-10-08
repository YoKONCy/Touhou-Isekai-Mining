/**
 * 固定脚本房间规格（序章导演用；普通随机房不带 spec）
 *
 * RoomRuntime 构造时若收到 spec，则跳过随机刷怪/随机矿脉等随机内容，
 * 完全按导演编排生成：指定怪点、手动火把、清场不开门等。
 */
import type { EnemyId } from '../../../content/enemies/types'
import type { Dir } from './types'

/** 脚本刷怪点（delay 秒后钻出/出现，用于"破门怪"演出） */
export interface ScriptedSpawn {
  id: EnemyId
  x: number
  y: number
  /** 进房后延迟出现秒数（默认 0 = 立即在场） */
  delay?: number
  /** 是否走裂土预警 + 钻出流程（默认 false = 直接站立） */
  burrow?: boolean
}

/**
 * 脚本房间专属环境压暗档（覆盖 CONFIG.art.ambient 的常规两档）：
 * 序章"越深入矿洞越黑"叙事用；数值同光照层口径（中心/边缘暗罩 alpha 0~1）。
 */
export interface ScriptedAmbient {
  /** 未清场战斗暗档 */
  dimCenter: number
  dimEdge: number
  /** 清场后亮档（仍允许比常规清场房暗） */
  litCenter: number
  litEdge: number
}

export interface ScriptedRoomSpec {
  /** 不生成任何矿脉/岩石（纯战斗/剧情房） */
  noOre?: boolean
  /**
   * 房间视觉主题（影响烘焙纹理：地板/墙面/装饰）。
   * 缺省为矿洞石板岩墙；'grimm' = 猩红圣堂黑石斗场（格林试炼）。
   */
  theme?: 'grimm'
  /** 纯战斗试炼场不生成阻挡技能落点的随机摆件。 */
  noProps?: boolean
  /** 主线首领房保持中央净空，不生成采集物和随机地面碰撞。 */
  noNature?: boolean
  /** 救援先于撤离，不在首领脚下生成普通裂隙。 */
  noFissure?: boolean
  /**
   * 固定本房矿脉格数量区间（覆盖生物群系按房型的随机量）。
   * 序章矿房用它把矿量压到"教学性质的极少量"；与 noOre 互斥（noOre 优先）。
   */
  oreRange?: readonly [number, number]
  /** 固定刷怪表（省略则走随机刷怪；空数组 = 明确空房） */
  spawns?: ScriptedSpawn[]
  /** 剧情途中也可复用随机落位与怪种权重，只覆盖每房总数。 */
  enemyRange?: readonly [number, number]
  /** 火把必须玩家 F 手动点燃（清场不自动亮） */
  manualTorches?: boolean
  /** 清场后不自动解封门/不点火把（门由导演脚本控制） */
  suppressAutoClear?: boolean
  /**
   * 导演手动宣告清场：怪数归零也不自动翻 cleared 牌（环境保持昏暗档、门不开），
   * 直到导演显式调用 room.storyClear()——用于"清场后先念一句台词，再亮灯开门"的节拍。
   */
  manualClear?: boolean
  /** 敲矿不会爆出怪（序章教学房） */
  noMonsterBurst?: boolean
  /** 敲岩石不会掉宝箱（序章房禁用，宝箱是正常下矿的惊喜） */
  noChest?: boolean
  /** 初始即锁门的空房（怪由导演后续手动刷入；R0 醒来房用） */
  startLocked?: boolean
  /**
   * 全场怪物出生即强制警戒索敌玩家（无视视野距离）。
   * 序章专用：教学节奏不允许"怪在远处游荡、要玩家凑近才激活"。
   */
  aggressive?: boolean
  /**
   * 房间专属环境压暗档（覆盖常规清场两档；序章后续房间逐房加暗）。
   * 不影响帽灯视域——只有 manualTorches 漆黑房才收紧帽灯。
   */
  ambient?: ScriptedAmbient
  /**
   * 常亮安全房（序章基地）：环境恒为明亮暖档、墙上火把构造即全部点燃，
   * 与清场状态无关。用于非战斗的剧情歇息点。
   */
  litRoom?: boolean
  /**
   * 剧情出口：一面墙上的单向"深入"门（无对端房间，不走 DoorDef）。
   * 构造时为封印态；导演调用 room.openStoryExit() 后玩家可踏入，
   * 踩入触发 RoomHost.requestStoryExit(ref)，由导演决定转场。
   */
  storyExit?: { dir: Dir; ref: string }
}
