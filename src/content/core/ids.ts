/**
 * 内容 id 与命名空间（工程化 L0）
 *
 * 一切可注册资源（物品/敌人/弹幕/矿物/摆件/事件……）的 id 统一为
 * `namespace:path` 形式：
 * - 官方内容：`touhou:ore_copper`
 * - MOD 内容：`作者名:crystal_sword`（namespace 即 MOD 包名，天然防撞车）
 *
 * 存档/存档槽位永久绑定完整 id；MOD 卸载后出现未知 id 时由读取方容错
 * （占位/丢弃），绝不炸档。
 */

/** 内容 id 就是字符串（MOD 内容运行时进入，TS 无法用联合类型枚举） */
export type ContentId = string

/** 官方内容包命名空间（等价"内置的第一个 MOD"） */
export const VANILLA_NS = 'touhou'

/** 生成官方内容 id：touhou:path */
export function vanilla(path: string): ContentId {
  return `${VANILLA_NS}:${path}`
}

/** 生成任意命名空间内容 id（MOD 用） */
export function namespaced(namespace: string, path: string): ContentId {
  return `${namespace}:${path}`
}

/** 拆分命名空间 id；非法格式归入默认（容错，不抛异常） */
export function parseId(id: ContentId): { namespace: string; path: string } {
  const i = id.indexOf(':')
  if (i <= 0) return { namespace: VANILLA_NS, path: id }
  return { namespace: id.slice(0, i), path: id.slice(i + 1) }
}

/** 取 id 的命名空间（判官方/MOD 归属用） */
export function namespaceOf(id: ContentId): string {
  return parseId(id).namespace
}
