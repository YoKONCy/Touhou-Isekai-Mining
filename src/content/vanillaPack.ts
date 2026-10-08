/**
 * 官方内容包总注册（vanilla = 内置的第一个 MOD）
 *
 * 由 main.ts 在创建 Vue 应用【之前】import 一次，保证任何玩法/UI 模块
 * 读到注册表时内容已就位。L4 的 ./mods 加载器将在这之后、挂应用之前
 * 叠加玩家本地 MOD（可声明 override 覆盖官方条目）。
 */
import { registerVanillaItems } from './items/vanilla/pack'
import { registerVanillaEnemies } from './enemies/vanilla/pack'
import { registerVanillaProjectiles } from './projectiles/vanilla/pack'
import { registerVanillaMinerals } from './minerals/vanilla/pack'
import { registerVanillaProps } from './props/vanilla/pack'
import { registerVanillaBiomes } from './biomes/vanilla/pack'
import { registerVanillaLoot } from './loot/vanilla/pack'
import { registerLang } from '../i18n'
// 官方简体中文语言文件（MC Mod 式：内容名/描述/UI 全部以语言键外置）
import zhCn from './vanilla/lang/zh_cn.json'

// 语言先行：任何注册表/UI 读到内容前，官方词条已就位
registerLang('zh_cn', zhCn as Record<string, string>, 'src/content/vanilla/lang/zh_cn.json')

// 矿物/摆件 Def 仅以字符串引用物品 id，注册先后无强依赖；统一先物品
registerVanillaItems()
registerVanillaMinerals()
registerVanillaProps()
registerVanillaBiomes()
registerVanillaEnemies()
registerVanillaProjectiles()
registerVanillaLoot()
