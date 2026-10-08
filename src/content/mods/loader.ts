/**
 * ./mods 本地 MOD 加载器（工程化 L4）
 *
 * 扫描项目根 ./mods/<文件夹>/，支持两种形态：
 * - L1 数据包：只有 pack.json（可带 items 数组 + 内联 SVG 图标），零代码；
 * - L2 脚本包：index.ts 默认导出 { manifest, register(api) }，
 *   与官方包走同一批注册表，可加任意类别内容（自定义弹幕渲染/摆件/群系…）。
 *
 * 约定：同一文件夹若同时存在 index.ts 与 pack.json，视为脚本包（JSON 忽略）。
 * 单个包加载/注册失败只打印中文错误并跳过，绝不拖垮游戏启动。
 *
 * 文本约定（MC Mod 式 i18n）：MOD 的一切展示文本（物品/敌人/矿物等名称描述）
 * 一律放 mods/<id>/lang/<lang>.json（如 lang/zh_cn.json），扁平键值，键名与官方一致
 * （item.<全限定id>.name 等）；脚本包与数据包都一样，TS/JSON 定义里不写任何文案。
 *
 * 剧情约定：自定义对话/事件放 mods/<id>/dialogue/*.json，形状见 DialoguePackJson
 * ——节点文本同样只写 i18n 键（文案进 lang/*.json）；只开放声明式效果白名单
 * （flagSet/giveItem/equipSlot/heal/action），节点禁带函数，复杂演出用 action
 * 引用已注册的具名动作。
 *
 * 已知限制：mods 目录不经过 Vite 的 public/ 静态服务，image 类图标 URL 在
 * dev 下无法直接访问——示例统一用内联 SVG；图片 MOD 需把图放 public/mods/
 * （后续资源管线再打通）。
 */
import type { ContentPack, PackManifest } from '../core/pack'
import { createPackApi } from './api'
import { svgIcon, type ItemDef, type ItemKind } from '../items/types'
import { registerLang } from '../../i18n'
import { createModCheckpoint } from './registration'
import { orderPacks } from './packOrder'
import { dialogue } from '../../game/dialogue/dialogueService'
import type { DialoguePackJson } from '../../game/dialogue/types'

/* ---------------- 数据包 JSON 结构（L1 子集） ---------------- */

/** pack.json 里单条物品的字段（ItemDef 的可 JSON 化子集；文案走 lang/*.json，不在此声明） */
interface DataItemJson {
  /** 包内短 id（实际注册 id 自动加 "清单id:" 前缀） */
  id: string
  kind: ItemKind
  tier: 1 | 2 | 3 | 4 | 5
  color: string
  hi: string
  text: string
  maxStack: number
  /** 内联 SVG 图标（数据包唯一支持的图标形态） */
  iconSvg: string
  /** 消耗品效果（如 { "heal": 35 }） */
  consume?: ItemDef['consume']
  material?: boolean
  /** 对应矿物 id（需写全限定 id） */
  mineral?: string
  tags?: string[]
}

/** pack.json 清单结构 */
interface DataPackJson extends PackManifest {
  items?: DataItemJson[]
}

/* ---------------- glob 收集（loader 位于 src/content/mods，上三级到项目根） ---------------- */

// JSON 按包延迟导入；坏包的解析错误不会提前中断整个应用引导。
const dataPackGlobs = import.meta.glob<DataPackJson>('../../../mods/*/pack.json', {
  import: 'default'
})
// 语言文件随所属包的内容一起注册、一起回滚。
const langGlobs = import.meta.glob<Record<string, string>>('../../../mods/*/lang/*.json', {
  import: 'default'
})
// 剧情文件也纳入同一包的注册事务。
const dialogueGlobs = import.meta.glob<DialoguePackJson>('../../../mods/*/dialogue/*.json', {
  import: 'default'
})
// 脚本包：先导入清单，再按依赖排序注册；顶层注册副作用会被撤销。
const scriptPackGlobs = import.meta.glob<{ default: ContentPack }>('../../../mods/*/index.ts')

/** 内容、语言与剧情路径都按 mods 下的第一层目录归属到包。 */
function folderOf(key: string): string {
  return key.match(/\/mods\/([^/]+)\//)?.[1] ?? key
}

/** 一份"已解析、待应用"的包（数据包/脚本包统一形态） */
interface LoadedPack {
  folder: string
  manifest: PackManifest
  /** 依赖排序后调用：向注册表实际登记内容 */
  apply: (api: ReturnType<typeof createPackApi>) => void
}

/* ---------------- 数据包适配 ---------------- */

/** 把 pack.json 翻译成可注册的 LoadedPack（字段在此做校验/补默认/加命名空间） */
function buildDataPack(json: DataPackJson, folder: string): LoadedPack {
  if (!json.id || typeof json.id !== 'string') {
    throw new Error('pack.json 缺少合法的 id 字段')
  }

  const items: ItemDef[] = (json.items ?? []).map((raw) => {
    if (!raw.id) throw new Error('存在缺少 id 的物品条目')
    if (!raw.iconSvg) throw new Error(`物品 ${json.id}:${raw.id} 缺少 iconSvg（数据包仅支持内联 SVG 图标）`)
    return {
      // 自动注入命名空间前缀，包间 id 永不撞车
      id: `${json.id}:${raw.id}`,
      kind: raw.kind,
      tier: raw.tier,
      color: raw.color,
      hi: raw.hi,
      text: raw.text,
      maxStack: raw.maxStack,
      icon: svgIcon(raw.iconSvg),
      consume: raw.consume,
      material: raw.material,
      mineral: raw.mineral,
      tags: raw.tags
    } satisfies ItemDef
  })

  return {
    folder,
    manifest: validateManifest(json),
    apply(api) {
      for (const def of items) api.items.register(def)
    }
  }
}

/** 清单在执行注册前校验，避免异常字段影响其他包的依赖与冲突处理。 */
function validateManifest(manifest: PackManifest): PackManifest {
  if (!manifest || typeof manifest.id !== 'string' || !/^[a-zA-Z0-9_.-]+$/.test(manifest.id)) {
    throw new Error('包清单缺少合法 id（只允许字母、数字、下划线、点和短横线）')
  }
  if (manifest.id === 'touhou') throw new Error('MOD 不得占用官方包 id「touhou」')
  for (const key of ['dependencies', 'conflicts'] as const) {
    const values = manifest[key]
    if (values !== undefined && (!Array.isArray(values) || values.some(value => typeof value !== 'string' || !value))) {
      throw new Error(`包清单的 ${key} 必须是非空字符串数组`)
    }
  }
  return {
    ...manifest,
    name: manifest.name || manifest.id,
    version: manifest.version || '0.0.0',
    dependencies: [...(manifest.dependencies ?? [])],
    conflicts: [...(manifest.conflicts ?? [])]
  }
}

/** 加载本地 MOD；每个包的内容、词条和剧情共同提交，失败共同撤销。 */
export async function loadMods(): Promise<number> {
  const api = createPackApi()
  const loaded: LoadedPack[] = []
  const scriptFolders = new Set<string>()

  for (const [key, importer] of Object.entries(scriptPackGlobs)) {
    const folder = folderOf(key)
    scriptFolders.add(folder)
    const rollback = createModCheckpoint()
    try {
      const pack = (await importer()).default
      if (!pack || typeof pack.register !== 'function') {
        throw new Error('index.ts 必须 default 导出 { manifest, register(api) }')
      }
      if (pack.register.constructor.name === 'AsyncFunction') throw new Error('register 必须同步执行')
      const manifest = validateManifest(pack.manifest)
      loaded.push({ folder, manifest, apply: a => pack.register(a) })
    } catch (err) {
      console.error(`[MOD] 脚本包「${folder}」导入失败，已跳过：`, err)
    } finally {
      // 导入阶段只能声明内容；注册必须放在 register 内，不能绕过包的事务边界。
      rollback()
    }
  }

  for (const [key, importer] of Object.entries(dataPackGlobs)) {
    const folder = folderOf(key)
    if (scriptFolders.has(folder)) continue
    try {
      loaded.push(buildDataPack(await importer(), folder))
    } catch (err) {
      console.error(`[MOD] 数据包「${folder}」非法，已跳过：`, err)
    }
  }

  const { ordered, rejected } = orderPacks(loaded)
  for (const { pack, reason } of rejected) {
    console.error(`[MOD] 包「${pack.manifest.id}」无法加载：${reason}`)
  }
  const applied = new Map<string, PackManifest>()
  const appliedIds = new Set(['touhou'])
  let okCount = 0
  for (const pack of ordered) {
    const manifest = pack.manifest
    const missing = manifest.dependencies?.find(id => !appliedIds.has(id))
    if (missing) {
      console.error(`[MOD] 包「${manifest.id}」依赖「${missing}」未成功注册，已跳过`)
      continue
    }
    // 双向检查互斥：已加载包声明的限制与当前包声明的限制同样生效。
    const conflict = manifest.conflicts?.find(id => appliedIds.has(id))
      ?? Array.from(applied.values()).find(other => other.conflicts?.includes(manifest.id))?.id
    if (conflict) {
      console.error(`[MOD] 包「${manifest.id}」与包「${conflict}」互斥，已跳过`)
      continue
    }
    const rollback = createModCheckpoint()
    try {
      for (const [key, importer] of Object.entries(langGlobs)) {
        if (folderOf(key) !== pack.folder) continue
        const entries = await importer()
        if (!entries || typeof entries !== 'object' || Array.isArray(entries)
          || Object.values(entries).some(value => typeof value !== 'string')) {
          throw new Error(`语言文件「${key}」必须是字符串词条表`)
        }
        registerLang(key.split('/').pop()!.replace(/\.json$/i, ''), entries, key)
      }
      for (const [key, importer] of Object.entries(dialogueGlobs)) {
        if (folderOf(key) === pack.folder) dialogue.registerPack(await importer())
      }
      pack.apply(api)
      applied.set(manifest.id, manifest)
      appliedIds.add(manifest.id)
      okCount++
      console.info(`[MOD] 已加载：${manifest.name}（${manifest.id} v${manifest.version}）`)
    } catch (err) {
      rollback()
      console.error(`[MOD] 包「${manifest.id}」注册失败，已撤销该包的内容、词条与剧情：`, err)
    }
  }
  return okCount
}
