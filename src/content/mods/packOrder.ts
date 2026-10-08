import type { PackManifest } from '../core/pack'

/** 仅隔离重复、缺依赖和循环依赖的包及其下游；无关包仍可按依赖顺序加载。 */
export function orderPacks<T extends { manifest: PackManifest }>(packs: readonly T[]): {
  ordered: T[]
  rejected: Array<{ pack: T; reason: string }>
} {
  const byId = new Map<string, T>()
  const duplicated = new Set<string>()
  for (const pack of packs) {
    const id = pack.manifest.id
    if (byId.has(id)) duplicated.add(id)
    byId.set(id, pack)
  }
  const reasons = new Map<T, string>()
  for (const pack of packs) {
    if (duplicated.has(pack.manifest.id)) reasons.set(pack, '包 id 重复，无法确定依赖目标')
  }
  const ordered: T[] = []
  const state = new Map<T, 'visiting' | 'done'>()
  const visit = (pack: T, chain: string[]): boolean => {
    if (reasons.has(pack)) return false
    if (state.get(pack) === 'done') return true
    if (state.get(pack) === 'visiting') {
      reasons.set(pack, `依赖存在循环：${[...chain, pack.manifest.id].join(' → ')}`)
      return false
    }
    state.set(pack, 'visiting')
    for (const dependency of pack.manifest.dependencies ?? []) {
      // 官方内容在加载器调用前已完成注册。
      if (dependency === 'touhou') continue
      const target = byId.get(dependency)
      if (!target || !visit(target, [...chain, pack.manifest.id])) {
        if (!reasons.has(pack)) reasons.set(pack, `依赖「${dependency}」不存在或无法加载`)
        return false
      }
    }
    state.set(pack, 'done')
    ordered.push(pack)
    return true
  }
  for (const pack of packs) visit(pack, [])
  return { ordered, rejected: Array.from(reasons, ([pack, reason]) => ({ pack, reason })) }
}
