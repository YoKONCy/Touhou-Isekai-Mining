/**
 * 玩法层跨模块 / UI 事件真值表
 * 矿洞模块与 Vue HUD 之间只通过这些事件通信，互不持有引用。
 */

import type { ItemId } from '../shared/itemDefs'

/** 一趟下矿的结算统计（撤离/死亡共用） */
export interface RunStats {
  /** 当前层深度 */
  depth: number
  /** 已清场房间数 */
  roomsCleared: number
  /** 本层房间总数 */
  roomsTotal: number
  /** 本层击杀数 */
  kills: number
  /** 背包快照 */
  bag: { copper: number; iron: number; gold: number }
  /** 本次实际扣除的物品与经验快照，安全撤离时为空清单和零经验。 */
  losses: { items: Array<{ id: ItemId; qty: number }>; exp: number }
}

/** 游戏内覆盖面板（同一时刻至多一个；null = 全部关闭） */
export type UIPanelKind = 'inventory' | 'map' | 'pause' | 'npc' | 'quests' | 'storage' | 'cooking' | 'floors' | 'crafting' | 'furnace'

export interface GameEvents {
  /** 基地入口选层面板确认进入；基地验证解锁并保存下矿前检查点。 */
  'base:enterFloor': { floor: number }
  /** 矿洞：抵达下行裂隙并撤离（批次 C 前为占位结算） */
  'cave:extract': RunStats
  /** 矿洞：玩家倒下，结算携带素材与本级经验损失。 */
  'cave:died': RunStats
  /** 矿洞：角色升级（B0 金色提示；payload＝新等级与未分配点数） */
  'cave:levelup': { level: number; unspentPoints: number }
  /** UI：结算面板按钮 → 请求回营 */
  'cave:restart': void
  /** 模块 → UI：面板开关状态变化（Tab/M 键触发，Vue 据此显隐） */
  'ui:panel': UIPanelKind | null
  /** UI → 模块：请求切换面板（关闭按钮/快捷操作） */
  'ui:requestPanel': UIPanelKind | null
  /** 基地：收音机开始/切换曲目（payload＝曲名 i18n 键，UI 弹 3 秒 toast） */
  'base:now-playing': string
}
