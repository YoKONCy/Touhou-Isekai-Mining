import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

// 测试产物写入系统临时目录，不污染游戏资源和仓库。
const directory = await mkdtemp(join(tmpdir(), 'mining-simulation-'))
try {
  const output = join(directory, 'simulation.test.mjs')
  await build({
    entryPoints: ['tests/simulation.test.ts'], outfile: output, bundle: true,
    platform: 'node', format: 'esm', target: 'node22',
    define: { 'import.meta.env.BASE_URL': '"/"', 'import.meta.env.DEV': 'false' },
    logLevel: 'warning'
  })
  const result = spawnSync(process.execPath, ['--test', output], { stdio: 'inherit' })
  process.exitCode = result.status ?? 1
} finally {
  await rm(directory, { recursive: true, force: true })
}
