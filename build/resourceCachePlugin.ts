import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'

const STATIC_EXTENSIONS = new Set(['.html', '.js', '.css', '.json', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.avif', '.mp3', '.ogg', '.wav', '.mp4', '.webm', '.ttf', '.woff', '.woff2'])
interface ResourceEntry { path: string; revision: string; size: number; essential: boolean }

/** 从本次真实构建产物生成缓存清单，资源变化即换缓存版本，无需手改游戏版本号。 */
export function resourceCachePlugin(): Plugin {
  let config: ResolvedConfig
  return {
    name: 'touhou-static-resource-cache',
    apply: 'build',
    configResolved(resolved) { config = resolved },
    closeBundle() {
      if (!config.build.write || config.build.ssr) return
      const output = resolve(config.root, config.build.outDir)
      const manifest: ResourceEntry[] = []
      function collect(directory: string, prefix = ''): void {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          const file = join(directory, entry.name), path = `${prefix}${entry.name}`
          if (entry.isDirectory()) { collect(file, `${path}/`); continue }
          if (!entry.isFile() || path === 'service-worker.js' || !STATIC_EXTENSIONS.has(extname(path).toLowerCase())) continue
          const bytes = readFileSync(file)
          manifest.push({ path, revision: createHash('sha256').update(bytes).digest('hex'), size: bytes.length, essential: /\.(?:html|js|css)$/.test(path) })
        }
      }
      collect(output)
      manifest.sort((a, b) => a.path.localeCompare(b.path))
      const buildId = createHash('sha256').update(JSON.stringify(manifest)).digest('hex').slice(0, 20)
      const source = readFileSync(resolve(config.root, 'src/browser/resource-worker.js'), 'utf8')
        .replace('__BUILD_ID__', buildId)
        .replace('const MANIFEST = []', `const MANIFEST = ${JSON.stringify(manifest)}`)
      writeFileSync(join(output, 'service-worker.js'), source, 'utf8')
    }
  }
}
