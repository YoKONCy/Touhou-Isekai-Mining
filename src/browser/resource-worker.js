/* 构建时注入内容哈希与资源清单；不缓存存档、接口或仓库范围之外的请求。 */
const BUILD_ID = '__BUILD_ID__'
const MANIFEST = []
const scope = new URL(self.registration.scope)
const prefix = `touhou-isekai-mining:${scope.pathname}:`
const cacheName = `${prefix}${BUILD_ID}`
const entries = new Map(MANIFEST.map(entry => [new URL(entry.path, scope).href, entry]))
const pending = new Map()
let warming

function resourceURL(entry) { return new URL(entry.path, scope).href }

async function digest(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('')
}

/** 未变化的资源可复用旧构建缓存；内容哈希不同的文件必须重新获取。 */
async function download(entry) {
  const url = resourceURL(entry), cache = await caches.open(cacheName)
  const cached = await cache.match(url)
  if (cached) return cached
  for (const name of await caches.keys()) {
    if (name === cacheName || !name.startsWith(prefix)) continue
    const previous = await (await caches.open(name)).match(url)
    if (previous?.headers.get('X-Resource-Revision') !== entry.revision) continue
    await cache.put(url, previous.clone())
    return previous
  }
  const response = await fetch(url, { cache: 'no-cache' })
  if (!response.ok || response.status !== 200) throw new Error(`资源获取失败：${entry.path}（${response.status}）`)
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength !== entry.size || await digest(bytes) !== entry.revision) throw new Error(`资源版本不匹配：${entry.path}`)
  const headers = new Headers(response.headers)
  headers.delete('Content-Encoding'); headers.delete('Transfer-Encoding')
  headers.set('Content-Length', String(bytes.byteLength))
  headers.set('X-Resource-Revision', entry.revision)
  const full = new Response(bytes, { status: 200, headers })
  // 缓存满或不可用时仍返回当前资源，不能阻断正常游戏。
  try { await cache.put(url, full.clone()) }
  catch (error) { console.warn('[资源缓存] 写入失败，本次资源仍可使用。', error) }
  return full
}

async function ensureResource(entry) {
  const url = resourceURL(entry)
  let task = pending.get(url)
  if (!task) {
    task = download(entry)
    pending.set(url, task)
    task.then(() => pending.delete(url), () => pending.delete(url))
  }
  return (await task).clone()
}

async function warmResources(resources, required = false) {
  let cursor = 0
  async function run() {
    while (cursor < resources.length) {
      const entry = resources[cursor++]
      try { await ensureResource(entry) }
      catch (error) {
        if (required) throw error
        console.warn(`[资源缓存] 暂未缓存 ${entry.path}，后续访问会重试。`, error)
      }
    }
  }
  await Promise.all([run(), run()])
}

self.addEventListener('install', event => {
  event.waitUntil(warmResources(MANIFEST.filter(entry => entry.essential), true))
  // 更新等待旧页面结束后再接管，避免正在游玩的页面突然混用两版资源。
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // 清理仅限本仓库的旧资源缓存，绝不操作 IndexedDB 或其他站点的缓存。
    await Promise.all((await caches.keys()).filter(name => name.startsWith(prefix) && name !== cacheName).map(name => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') { event.waitUntil(self.skipWaiting()); return }
  if (event.data?.type !== 'CACHE_RESOURCES') return
  if (!warming) warming = warmResources(MANIFEST.filter(entry => !entry.essential)).finally(() => { warming = undefined })
  event.waitUntil(warming)
})

/** 音乐与循环视频使用字节区间读取；完整缓存可直接生成正确的 206 响应。 */
async function rangeResponse(response, range) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(range)
  if (!match || (!match[1] && !match[2])) return null
  const bytes = await response.arrayBuffer(), size = bytes.byteLength
  const suffix = !match[1]
  const start = suffix ? Math.max(0, size - Number(match[2])) : Number(match[1])
  const end = suffix || !match[2] ? size - 1 : Math.min(size - 1, Number(match[2]))
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
  const headers = new Headers(response.headers)
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`)
  headers.set('Content-Length', String(end - start + 1))
  headers.set('Accept-Ranges', 'bytes')
  return new Response(bytes.slice(start, end + 1), { status: 206, headers })
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return
  url.search = ''; url.hash = ''
  if (url.href === scope.href) url.pathname += 'index.html'
  const entry = entries.get(url.href)
  if (!entry) return
  const range = event.request.headers.get('Range')
  if (range) {
    event.waitUntil(ensureResource(entry).then(() => {}, error => { console.warn('[资源缓存] 媒体后台缓存暂未完成。', error) }))
    event.respondWith((async () => {
      const cached = await (await caches.open(cacheName)).match(resourceURL(entry))
      if (cached) {
        const partial = await rangeResponse(cached, range)
        if (partial) return partial
      }
      return fetch(event.request)
    })())
    return
  }
  event.respondWith(ensureResource(entry).catch(() => fetch(event.request)))
})
