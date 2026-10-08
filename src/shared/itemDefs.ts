/**
 * 物品定义 facade（工程化 L1 后本文件不再持有任何内容）
 *
 * 真正的物品真值在 `src/content/items/`（注册表 + 官方内容文件）。
 * 本文件只做转发，保持背包/装备/UI 的既有 import 路径不破坏；
 * 新代码请直接从 content/items 引入。
 */
export type {
  ItemId,
  ItemKind,
  EquipSlot,
  ItemEquipSlot,
  MeleeMove,
  SpellCardDef,
  SpellFxColors,
  ConsumableEffect,
  ItemIcon,
  GroundDropView,
  GroundRenderer,
  ItemDef
} from '../content/items/types'
export { svgIcon } from '../content/items/types'
export { items, getItemDef, findItemDef, itemIdForMineral } from '../content/items/registry'
