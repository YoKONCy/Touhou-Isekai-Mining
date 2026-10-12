/** 首页只加载语言与存档摘要；确认启程后按官方包、剧情、MOD 的顺序注册玩法。 */
let pending: Promise<void> | undefined

export function prepareGameContent(): Promise<void> {
  if (!pending) {
    pending = (async () => {
      await import('./vanillaPack')
      await import('./story')
      const { loadMods } = await import('./mods/loader')
      await loadMods()
    })().catch(error => { pending = undefined; throw error })
  }
  return pending
}
