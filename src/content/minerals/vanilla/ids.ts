/**
 * 官方矿种 id 常量（纯叶子模块）
 * TileMap 兜底/引擎点名引用具体矿种时统一从这里取，禁止裸字符串。
 *
 * 注意：本文件必须保持"零 def 依赖"——物品 Def 会反向引用矿物 id，
 * 若这里 re-export 矿物 def 文件会与物品侧形成 import 环（运行时 TDZ）。
 */
import { vanilla } from '../../core/ids'

export const MINERAL_COPPER_ID = vanilla('mineral_copper')
export const MINERAL_IRON_ID = vanilla('mineral_iron')
export const MINERAL_GOLD_ID = vanilla('mineral_gold')
export const MINERAL_COAL_ID = vanilla('mineral_coal')
export const MINERAL_SALT_ROCK_ID = vanilla('mineral_salt_rock')
export const MINERAL_RUBY_ID = vanilla('mineral_ruby')
