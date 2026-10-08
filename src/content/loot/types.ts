/**
 * 战利品表结构（宝箱/事件奖励/未来据点产出共用）
 *
 * 一次开箱 = 按权重抽一个条目，再在 [min,max] 区间均匀 roll 数量；
 * B2 只有"必定金矿"一条目，结构先按可扩展形态落地。
 */
import type { ItemId } from '../../shared/itemDefs'

/** 单条掉落项（权重 + 数量区间） */
export interface LootEntry {
  item: ItemId
  /** 抽中权重（≥0） */
  weight: number
  /** 数量下限（含） */
  min: number
  /** 数量上限（含） */
  max: number
}

export interface LootTable {
  /** 全限定 id（如 touhou:chest_basic） */
  id: string
  entries: LootEntry[]
}

/** 一次 roll 的产物 */
export interface LootDrop {
  item: ItemId
  qty: number
}
