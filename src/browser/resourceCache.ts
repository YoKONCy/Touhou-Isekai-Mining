/** 正式网页自动启用浏览器资源缓存；开发服务器保持实时更新，不缓存热更新文件。 */
export function registerResourceCache(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !window.isSecureContext) return
  let interacted = false
  const markInteraction = (): void => { interacted = true }
  window.addEventListener('pointerdown', markInteraction, { once: true, capture: true })
  window.addEventListener('keydown', markInteraction, { once: true, capture: true })
  let updating = false
  function activateIdleUpdate(registration: ServiceWorkerRegistration): boolean {
    if (updating) return true
    if (!navigator.serviceWorker.controller || !registration.waiting || interacted || !document.querySelector('.title-screen') || document.querySelector('.journey-transition')) return false
    updating = true
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // 仅首次打开、尚未操作的首页采用新版本；玩家操作后绝不刷新或中断游戏。
      if (!interacted && document.querySelector('.title-screen') && !document.querySelector('.journey-transition')) window.location.reload()
      else navigator.serviceWorker.controller?.postMessage({ type: 'CACHE_RESOURCES' })
    }, { once: true })
    registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' })
    return true
  }
  const begin = async (): Promise<void> => {
    try {
      const scope = new URL(import.meta.env.BASE_URL, window.location.href)
      const registration = await navigator.serviceWorker.register(new URL('service-worker.js', scope), { scope: scope.pathname, updateViaCache: 'none' })
      registration.addEventListener('updatefound', () => {
        registration.installing?.addEventListener('statechange', () => { activateIdleUpdate(registration) })
      })
      if (registration.installing) registration.installing.addEventListener('statechange', () => { activateIdleUpdate(registration) })
      if (activateIdleUpdate(registration)) return
      const ready = await navigator.serviceWorker.ready
      ready.active?.postMessage({ type: 'CACHE_RESOURCES' })
    } catch (error) { console.warn('[资源缓存] 浏览器缓存未启用，继续正常加载资源。', error) }
  }
  // 前台首页先完成加载，剩余资源由后台按小并发预取，不挡住玩家启程。
  if (document.readyState === 'complete') void begin()
  else window.addEventListener('load', () => { void begin() }, { once: true })
}
