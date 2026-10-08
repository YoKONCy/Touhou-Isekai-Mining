/**
 * PackApi 工厂（工程化 L4）
 *
 * 所有包（官方/MOD）拿到的 api 都指向同一批注册表单例——
 * MOD register(api) 里 api.items.register(...) 与官方包注册完全等价。
 */
import type { PackApi, ApiRegistryName } from '../core/pack'
import type { Registry } from '../core/Registry'
import { items } from '../items/registry'
import { enemies } from '../enemies/registry'
import { projectiles } from '../projectiles/registry'
import { minerals } from '../minerals/registry'
import { propDefs } from '../props/registry'
import { biomeDefs } from '../biomes/registry'

/** 类别名 → 注册表单例（具名字段的字符串镜像） */
const tables = {
  items,
  enemies,
  projectiles,
  minerals,
  props: propDefs,
  biomes: biomeDefs
} as const

/** 构造一个 MOD 注册用 API 句柄（底层始终是同一份注册表单例） */
export function createPackApi(): PackApi {
  return {
    items,
    enemies,
    projectiles,
    minerals,
    props: propDefs,
    biomes: biomeDefs,
    registry<T extends { id: string }>(name: ApiRegistryName): Registry<T> {
      return tables[name] as unknown as Registry<T>
    }
  }
}
