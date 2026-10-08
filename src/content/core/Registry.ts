/**
 * 通用内容注册表（工程化 L0）
 *
 * 每类资源（items/enemies/...）持有一个 Registry<T>；游戏逻辑只认 id 查表，
 * 不再 switch 具体类型。官方包与 MOD 走完全相同的 register 路径。
 */

/** 注册项的最低要求：必须带命名空间 id */
export interface RegisteredEntry {
  readonly id: string
}

export interface RegisterOptions {
  /**
   * 允许覆盖同 id 既有项（MOD 显式改造官方内容时必须置 true）。
   * 默认 false：重复注册直接抛错，防止两个包无意中互相踩踏。
   */
  override?: boolean
}

export class Registry<T extends RegisteredEntry> {
  private static readonly instances = new Set<Registry<RegisteredEntry>>()
  private readonly map = new Map<string, T>()
  /** 资源类别名（仅报错信息用） */
  constructor(private readonly kindName = 'content') {
    Registry.instances.add(this)
  }

  /** 保存全部注册表的条目映射；失败时撤销新增与覆盖，保留原有定义的引用及顺序。 */
  static createCheckpoint(): () => void {
    const snapshots = Array.from(Registry.instances, registry => ({ registry, entries: new Map(registry.map) }))
    // 同时记录纯数据对象的原属性；失败包通过 get 修改嵌套数值时也能原位恢复。
    // 保留函数和原对象引用，不用无法复制行为钩子的 structuredClone。
    const visited = new WeakSet<object>()
    const definitions: Array<{ target: object; descriptors: PropertyDescriptorMap }> = []
    const capture = (value: unknown): void => {
      if (value === null || typeof value !== 'object' || visited.has(value)) return
      const prototype = Object.getPrototypeOf(value)
      if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return
      visited.add(value)
      const descriptors = Object.getOwnPropertyDescriptors(value)
      definitions.push({ target: value, descriptors })
      for (const descriptor of Object.values(descriptors)) {
        if ('value' in descriptor) capture(descriptor.value)
      }
    }
    for (const { entries } of snapshots) for (const def of entries.values()) capture(def)
    return () => {
      for (const { target, descriptors } of definitions) {
        for (const key of Reflect.ownKeys(target)) {
          if (!Object.hasOwn(descriptors, key)) Reflect.deleteProperty(target, key)
        }
        Object.defineProperties(target, descriptors)
      }
      for (const { registry, entries } of snapshots) {
        registry.map.clear()
        for (const [id, def] of entries) registry.map.set(id, def)
      }
      // 导入失败的脚本可能创建新注册表，这些条目也必须撤销。
      const previous = new Set(snapshots.map(snapshot => snapshot.registry))
      for (const registry of Registry.instances) {
        if (!previous.has(registry)) registry.map.clear()
      }
    }
  }

  /** 注册一项内容 */
  register(def: T, opts: RegisterOptions = {}): void {
    if (this.map.has(def.id) && !opts.override) {
      throw new Error(`[registry] ${this.kindName} id 重复注册：${def.id}（覆盖请显式传 { override: true }）`)
    }
    this.map.set(def.id, def)
  }

  /** 查表（不存在返回 undefined；调用方自行兜底） */
  get(id: string): T | undefined {
    return this.map.get(id)
  }

  /** 查表（不存在直接抛错——用于"此 id 必定存在"的引擎内部逻辑） */
  require(id: string): T {
    const v = this.map.get(id)
    if (!v) throw new Error(`[registry] ${this.kindName} 缺少 id：${id}（对应内容包未加载或已被移除？）`)
    return v
  }

  has(id: string): boolean {
    return this.map.has(id)
  }

  /** 全部已注册项（顺序 = 注册顺序；遍历/校验用） */
  all(): readonly T[] {
    return Array.from(this.map.values())
  }

  /** 全部已注册 id */
  ids(): string[] {
    return Array.from(this.map.keys())
  }

  /** 按谓词筛选（tag、投放分组等都走它） */
  select(pred: (def: T) => boolean): T[] {
    return this.all().filter(pred)
  }
}

/**
 * 在候选项中按 weight 字段加权随机抽取一个；总权 ≤0 或空池返回 null。
 * 刷怪/掉落等"内容混编"入口统一走这里——加新内容只要给权重即可，
 * 引擎侧不认识任何具体 id。
 */
export function weightedPick<T>(entries: readonly T[], weightOf: (e: T) => number, rng: () => number = Math.random): T | null {
  let total = 0
  for (const e of entries) total += Math.max(0, weightOf(e))
  if (total <= 0) return null
  let roll = rng() * total
  for (const e of entries) {
    roll -= Math.max(0, weightOf(e))
    if (roll < 0) return e
  }
  return entries[entries.length - 1] ?? null
}
