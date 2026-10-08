/**
 * 地面可交互物（站立物 + F 交互）
 *
 * 与 Drop（磁吸自动拾取）的区别：交互物必须走近按 F 才生效，
 * 用于序章剧情道具（镐/剑）、手动火把、宝箱，以及未来 NPC/机关。
 * 房间拥有实体与判定，交互成功后的剧情推进经 RoomHost.onInteract 回调导演。
 */
import type { EquipSlot, ItemId } from '../../shared/itemDefs'

export type InteractKind = 'item' | 'torch' | 'chest' | 'special'

/** 一次交互同时结算的物品条目（主件或附带件通用） */
export interface ItemGrant {
  item: ItemId
  qty: number
  /** 拾取后直接装备到槽位（序章发镐/剑）；省略则入背包 */
  slot?: EquipSlot
}

/** 地面物品交互物的负载 */
export interface ItemInteractData {
  item: ItemId
  qty: number
  /** 拾取后直接装备到槽位（序章发镐/剑）；省略则入背包 */
  slot?: EquipSlot
  /** 附带一并入手的物品（如锈镐旁的火柴盒）：同一次 F 全部结算 */
  extras?: ItemGrant[]
}

/** 宝箱交互物的负载 */
export interface ChestInteractData {
  /** 战利品表 id（content/loot 注册表） */
  table: string
}

export interface Interactable {
  /** 房内唯一序号 */
  id: number
  kind: InteractKind
  x: number
  y: number
  /** F 触发半径（圆心距，像素） */
  range: number
  /** 屏幕提示文案（注册时已做 i18n 解析；null = 静默交互点） */
  hint: string | null
  /** 是否一次性（交互后移除；宝箱保留开盖外形但不再可交互） */
  oneShot: boolean
  /** 是否已失效 */
  done: boolean
  /** 导演侧自定义引用标识（special 用；item/chest 也可挂用于剧情分支） */
  ref?: string
  /** kind 专属负载 */
  data?: unknown
}
