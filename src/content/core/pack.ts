/**
 * 内容包（Content Pack）契约（工程化 L0 预留）
 *
 * 一个文件夹 = 一个内容包（官方 vanilla 包是"内置的第一个 MOD"）。
 * L4 落地 ./mods 目录加载器时，每个 MOD 文件夹提供一份 manifest +
 * 一个入口脚本，在 register() 里向各类注册表登记自己的内容。
 *
 * MOD 分级（与主人定稿）：
 * - L1 数据包：纯 JSON 清单 + png/svg 图标，零代码（复用官方行为/AI 模板）
 * - L2 脚本包：本地目录 + 入口 JS/TS，可注册自定义钩子与 AI（开发者向、信任加载）
 * - L3 模块包：实现 IGameModule 的完整新玩法模块（等价 DLC）
 */
import type { Registry } from './Registry'
import type { ItemDef } from '../items/types'
import type { EnemyDef } from '../enemies/types'
import type { ProjectileDef } from '../projectiles/types'
import type { MineralDef } from '../minerals/types'
import type { PropDef } from '../props/types'
import type { BiomeDef } from '../biomes/types'

/** 包清单（未来数据包可直接写成 pack.json） */
export interface PackManifest {
  /** 包唯一 id，同时是其内容 id 的命名空间（如 touhou / alice） */
  id: string
  /** 展示名与版本 */
  name: string
  version: string
  /** 依赖的其他包 id（加载顺序拓扑依据） */
  dependencies?: string[]
  /** 与哪些包互斥（同 id 不同版本的大型改版等） */
  conflicts?: string[]
  /** 兼容的游戏版本区间（加载器校验，字符串语义版本留待后续） */
  gameVersion?: string
}

/** PackApi.registry() 可按名取用的注册表类别 */
export type ApiRegistryName =
  | 'items'
  | 'enemies'
  | 'projectiles'
  | 'minerals'
  | 'props'
  | 'biomes'

/**
 * 注册入口拿到的 API 句柄：各类资源注册表统一从这里取，
 * 避免内容文件反向依赖引擎的单例模块。
 * 官方包与 MOD 包拿同一个 api，走完全相同的 register 路径。
 *
 * L5 预留（事件链，本期不实现、不建空模块）：
 * 未来将在本接口追加 onTrigger/registerCondition/registerEffect 三段式
 * 可注册链——MOD 声明"触发器（如 onKillEnemy/onMineBreak）→ 条件判定 →
 * 效果执行"组合，引擎在对应时机广播事件。当前脚本包若需深度改玩法，
 * 只能新增内容 Def，不能挂钩游戏事件（待 L5 事件总线落地）。
 */
export interface PackApi {
  /** 物品（武器/符卡/材料/消耗品） */
  readonly items: Registry<ItemDef>
  /** 敌人（AI 模板套皮 Def） */
  readonly enemies: Registry<EnemyDef>
  /** 弹幕弹种 */
  readonly projectiles: Registry<ProjectileDef>
  /** 矿物（色板/硬度/产量/发光/权重） */
  readonly minerals: Registry<MineralDef>
  /** 场景摆件（碰撞/布局/渲染器） */
  readonly props: Registry<PropDef>
  /** 生物群系（房型投放表） */
  readonly biomes: Registry<BiomeDef>
  /** 按类别名取注册表（具名字段的字符串镜像，数据驱动/未来新类别兜底） */
  registry<T extends { id: string }>(name: ApiRegistryName): Registry<T>
}

/** 脚本包（L2）入口实现的接口 */
export interface ContentPack {
  readonly manifest: PackManifest
  /** 加载器在启动阶段调用一次；包内全部内容在此登记 */
  register(api: PackApi): void
}
