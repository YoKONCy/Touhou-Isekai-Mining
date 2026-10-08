import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resourceCachePlugin } from './build/resourceCachePlugin'

// 本地开发使用根路径；Pages 工作流构建时通过 --base 指定仓库子路径。
export default defineConfig({
  plugins: [vue(), resourceCachePlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: false
  }
})
