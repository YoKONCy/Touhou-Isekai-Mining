/**
 * 矿脉矿物内容契约（工程化 L3）
 *
 * 矿种差异（晶簇色板/硬度/产量/发光/刷新权重/掉落物）全部在 MineralDef 里，
 * TileMap 生成时按 spawn 权重加权抽矿种，碎矿按 Def 掉落对应物品。
 * 加新矿种 = 新建 Def 文件（同时注册它的掉落物品）+ pack 加一行，引擎零改动。
 */
import type { ContentId } from '../core/ids'

export type MineralId = ContentId

/**
 * 矿种美术色板（迁自原 art/oreVein.ts 的 ORE_ART）：
 * 岩基主色/暗面 + 晶体主色/暗棱 + 亮棱 + 辉光色。
 * 程序化晶簇/岩基/裂纹露矿全部读这一组。
 */
export interface OrePalette {
  base: string
  baseDark: string
  crystal: string
  crystalDark: string
  hi: string
  light: string
}

/** 晶簇视觉特征开关（岩包三材质是全局机制，不在这里） */
export interface MineralVisual {
  /** 独立矿体形态：煤层、盐霜与各金属矿的专属轮廓。 */
  form?: 'coal' | 'salt' | 'metal' | 'copper' | 'iron' | 'gold'
  /** 常亮微光强度（暗房指引采矿：金 0.22 / 铜 0.12 / 铁 0.09） */
  glowPower: number
  /** 呼吸光晕基档：true=0.13（金矿更亮），false=0.08 */
  glowStrong?: boolean
  /** 晶顶两颗星点闪烁（金矿招牌） */
  twinkle?: boolean
}

/** 自然刷新投放配置（矿脉生成时加权抽矿种） */
export interface MineralSpawn {
  /** 刷出权重（铜 0.6 / 铁 0.28 / 金 0.12） */
  weight: number
  /** 岩包独立替换概率，不参与显矿簇的加权抽取。 */
  rockReplacementChance?: number
  /** 可出现的房型（缺省=所有房型都可能埋该矿） */
  rooms?: string[]
  /** 深度门控（min/max 均含端点；缺省不限制） */
  minDepth?: number
  maxDepth?: number
  /**
   * 楼层门控（正式下矿楼层号，第 1 层＝1；序章视为 0；min/max 均含端点）。
   * 金矿/红玉等稀有矿种靠它推迟到稍深层数才出现。
   */
  minFloor?: number
  maxFloor?: number
}

export interface MineralDef {
  /** 命名空间 id（同时写入 OreTile.kind；展示名走语言键 mineral.<id>.name） */
  id: MineralId
  /** 碎矿掉落的物品 id（应当已在物品注册表登记） */
  dropItemId: ContentId
  /** 采集HP区间，每格生成时随机确定。 */
  hp: readonly [number, number]
  /** 采集门槛，低档镐不能扣除HP。 */
  requiredMiningPower: 1 | 2 | 3 | 4 | 5
  /** 晶簇/岩基/碎粒配色 */
  palette: OrePalette
  /** 飘字文字色（碎粒色取 palette.crystal / palette.hi） */
  text: string
  /** 矿脉生成权重与门控 */
  spawn: MineralSpawn
  /** 视觉特征 */
  visual: MineralVisual
  /** 自由标签（门控/事件条件用，如 ['metal','rare']） */
  tags?: string[]
}
