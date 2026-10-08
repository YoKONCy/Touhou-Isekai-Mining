/**
 * 装备品质轴（DESIGN_MEMO #53）
 *
 * 六档（繁体定名，与 STORY.md §2.2 切片三分类同构）：
 * 1 凡品 / 2 精良 / 3 夢幻 / 4 傳奇 / 5 萬象 / 6 寰宇
 *
 * 仅用于非素材物品（武器/装束/饰品/符卡）；与素材五档镐级、
 * ItemDef.tier 掉落光柱演出档均无关，三者互不换算。
 */

/** 品质档（1~6）；未设置品质的物品为 undefined */
export type Rarity = 1 | 2 | 3 | 4 | 5 | 6

/** 品质显示名语言键（遵循 #52：ui.rarity.<档>） */
export const rarityNameKey = (r: Rarity): string => `ui.rarity.${r}`

/** 寰宇档：唯一拥有动态虹彩待遇的顶档（Canvas / CSS 各端自行实现色相流转） */
export const COSMIC_RARITY: Rarity = 6

/**
 * 品质主色分两套，因为世界画面（Canvas 深色背景）与 tooltip（浅色羊皮纸底）
 * 的明度相反，同一组颜色不可能两边都清晰：
 * - world：头顶弹名等世界飘字，偏亮
 * - ui：羊皮纸 tooltip 文字，偏深
 * 两套色同色相家族，保证玩家能建立"颜色=档位"的对应直觉。
 */
const RARITY_WORLD_COLORS: Record<Rarity, string> = {
  1: '#c9c4bb', // 凡品：麻灰白（铁灰旧布）
  2: '#6fc2a0', // 精良：铜青绿（匠作 / 河童重工）
  3: '#cf8bf2', // 夢幻：幻紫（幻想乡魔法之器）
  4: '#e8b94a', // 傳奇：琥珀金（大迁移英雄异闻）
  5: '#e05ec4', // 萬象：業火玫红（彼方世界沉积奇物）
  6: '#f6ead0'  // 寰宇：白金底色（虹彩由调用端叠加动态色相）
}

const RARITY_UI_COLORS: Record<Rarity, string> = {
  1: '#6f6a60', // 凡品：石灰
  2: '#2e8b63', // 精良：深铜青
  3: '#8a3cc0', // 夢幻：深幻紫
  4: '#9a6b12', // 傳奇：深琥珀
  5: '#a3267f', // 萬象：深玫红
  6: '#6b5410'  // 寰宇：古金（CSS 端叠加深色虹彩渐变）
}

/** 无品质（素材/消耗品）时各端使用的默认文字色 */
export const RARITY_DEFAULT_COLOR = '#d8c9a6'

/** 取品质色；未设置品质返回 null，调用端可自行决定走默认色还是不着色 */
export function rarityColor(
  rarity: Rarity | undefined | null,
  target: 'world' | 'ui' = 'world'
): string | null {
  if (!rarity) return null
  return (target === 'ui' ? RARITY_UI_COLORS : RARITY_WORLD_COLORS)[rarity]
}
