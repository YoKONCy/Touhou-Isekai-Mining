/* 构建时注入内容哈希；首页外壳按版本保存，实际用到的素材按内容版本跨更新复用。 */
const BUILD_ID = '__BUILD_ID__'
const MANIFEST = []
const scope = new URL(self.registration.scope)
const prefix = `touhou-isekai-mining:${scope.pathname}:`
const cacheName = `${prefix}${BUILD_ID}`
const assetCacheName = `${prefix}assets-v2`
const manifestURL = new URL('.resource-manifest.json', scope).href
const entries = new Map(MANIFEST.map(entry => [new URL(entry.path, scope).href, entry]))
const pending = new Map()

function resourceURL(entry) { return new URL(entry.path, scope).href }
function assetKey(entry) {
  const url = new URL(resourceURL(entry))
  url.searchParams.set('__resource_revision', entry.revision)
  return url.href
}

async function digest(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('')
}

/** 新缓存以内容哈希为键；旧版已缓存且哈希相同的资源在使用时迁入，不重新下载。 */
async function cachedResource(entry) {
  try {
    const cache = await caches.open(entry.essential ? cacheName : assetCacheName)
    const key = entry.essential ? resourceURL(entry) : assetKey(entry)
    const cached = await cache.match(key)
    if (cached) return cached
    const shared = await (await caches.open(assetCacheName)).match(assetKey(entry))
    if (shared) return shared
    for (const name of await caches.keys()) {
      if (!name.startsWith(prefix) || name === cacheName || name === assetCacheName) continue
      const previous = await (await caches.open(name)).match(resourceURL(entry))
      if (previous?.headers.get('X-Resource-Revision') !== entry.revision) continue
      try { await cache.put(key, previous.clone()) }
      catch (error) { console.warn('[资源缓存] 旧资源迁移暂未完成，继续使用已有资源。', error) }
      return previous
    }
  } catch (error) { console.warn('[资源缓存] 本地缓存暂不可读，继续网络加载。', error) }
  return null
}

/** 下载与校验写入分开：前台立即消费响应流，只有完整且匹配的资源才进入缓存。 */
async function storeResource(entry, response) {
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength !== entry.size || await digest(bytes) !== entry.revision) throw new Error(`资源版本不匹配：${entry.path}`)
  const headers = new Headers(response.headers)
  headers.delete('Content-Encoding'); headers.delete('Transfer-Encoding')
  headers.set('Content-Length', String(bytes.byteLength))
  headers.set('X-Resource-Revision', entry.revision)
  try {
    const cache = await caches.open(entry.essential ? cacheName : assetCacheName)
    await cache.put(entry.essential ? resourceURL(entry) : assetKey(entry), new Response(bytes, { status: 200, headers }))
  } catch (error) { console.warn('[资源缓存] 写入失败，本次资源仍可使用。', error) }
}

function loadResource(entry, request) {
  const key = assetKey(entry)
  let task = pending.get(key)
  if (!task) {
    task = (async () => {
      const cached = await cachedResource(entry)
      if (cached) return { response: cached, stored: Promise.resolve() }
      const response = await fetch(request || resourceURL(entry), { cache: entry.essential && !entry.path.endsWith('.html') ? 'default' : 'no-cache' })
      const stored = response.status === 200 ? storeResource(entry, response.clone()) : Promise.resolve()
      // 校验与写入由事件延长生命周期，不能让后台拒绝先于前台挂接处理而变成未处理错误。
      stored.catch(() => {})
      return { response, stored }
    })()
    pending.set(key, task)
    const release = () => { if (pending.get(key) === task) pending.delete(key) }
    task.then(result => result.stored).then(release, release)
  }
  return task
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    // 安装只缓存入口及静态依赖，绝不把动态玩法、整套立绘和音乐当作首页必需品。
    await Promise.all(MANIFEST.filter(entry => entry.essential).map(async entry => {
      const result = await loadResource(entry)
      if (result.response.status !== 200) throw new Error(`首页资源获取失败：${entry.path}`)
      await result.stored
    }))
    await (await caches.open(cacheName)).put(manifestURL, new Response(JSON.stringify(MANIFEST), { headers: { 'Content-Type': 'application/json' } }))
  })())
})

/** 保留最近两个旧外壳供尚未关闭的页面使用；共享素材保留这些版本仍引用的内容。 */
async function pruneCaches() {
  const names = (await caches.keys()).filter(name => name.startsWith(prefix) && name !== cacheName && name !== assetCacheName)
  const retained = names.slice(-2)
  await Promise.all(names.slice(0, -2).map(name => caches.delete(name)))
  const allowed = new Set(MANIFEST.map(assetKey))
  for (const name of retained) {
    const previous = await (await caches.open(name)).match(manifestURL)
    // 旧缓存没有清单，先保留共享素材；仍可按响应中的内容哈希惰性迁移。
    if (!previous) return
    for (const entry of await previous.json()) allowed.add(assetKey(entry))
  }
  const assets = await caches.open(assetCacheName)
  for (const request of await assets.keys()) if (!allowed.has(request.url)) await assets.delete(request)
}

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await self.clients.claim()
    try { await pruneCaches() }
    catch (error) { console.warn('[资源缓存] 旧版本清理稍后重试，不影响当前加载。', error) }
  })())
})

self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting())
  // 兼容旧页面消息，但不再执行 CACHE_RESOURCES 全量预取。
})

/** 完整缓存存在时在原生 Blob 上截取字节区间，避免每次都复制整首音乐到 JS 数组。 */
async function rangeResponse(response, range) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(range)
  if (!match || (!match[1] && !match[2])) return null
  const blob = await response.blob(), size = blob.size
  const suffix = !match[1]
  const start = suffix ? Math.max(0, size - Number(match[2])) : Number(match[1])
  const end = suffix || !match[2] ? size - 1 : Math.min(size - 1, Number(match[2]))
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
  const headers = new Headers(response.headers)
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`)
  headers.set('Content-Length', String(end - start + 1))
  headers.set('Accept-Ranges', 'bytes')
  return new Response(blob.slice(start, end + 1), { status: 206, headers })
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return
  url.search = ''; url.hash = ''
  if (url.href === scope.href) url.pathname += 'index.html'
  const entry = entries.get(url.href)
  if (!entry) {
    // 更新时旧页面可能仍请求旧哈希模块，只回退这类不可变代码，不回退已变更的普通图片。
    if (!/\/assets\/[^/]+-[\w-]+\.(?:js|css)$/.test(url.pathname)) return
    event.respondWith((async () => {
      try {
        const shared = await (await caches.open(assetCacheName)).match(url.href, { ignoreSearch: true })
        if (shared) return shared
        for (const name of (await caches.keys()).filter(name => name.startsWith(prefix) && name !== assetCacheName)) {
          const previous = await (await caches.open(name)).match(url.href)
          if (previous) return previous
        }
      } catch { /* 缓存不可用时由正常网络请求继续处理。 */ }
      return fetch(event.request)
    })())
    return
  }
  const range = event.request.headers.get('Range')
  if (range) {
    event.respondWith((async () => {
      const cached = await cachedResource(entry)
      if (cached) {
        const partial = await rangeResponse(cached, range)
        if (partial) return partial
      }
      // 未命中只交给浏览器原生分段请求，不另起完整音视频下载。
      return fetch(event.request)
    })().catch(() => fetch(event.request)))
    return
  }
  const task = loadResource(entry, event.request)
  event.respondWith(task.then(result => result.response.clone()).catch(() => fetch(event.request)))
  event.waitUntil(task.then(result => result.stored).catch(error => { console.warn(`[资源缓存] 暂未保存 ${entry.path}，后续访问会重试。`, error) }))
})
