import { createApp } from 'vue'
// 内容注册必须先于应用内任何模块：先官方包，再官方剧情，再叠加 ./mods 本地 MOD
import './content/vanillaPack'
import './content/story'
import { loadMods } from './content/mods/loader'
import RootApp from './RootApp.vue'
import { registerResourceCache } from './browser/resourceCache'
import './styles.css'
import './ui/game-ui.css'
import './ui/hud-theme.css'
import './ui/title-hud.css'

// 全程禁用浏览器原生右键菜单：捕获阶段挂在 window 上，
// 画布、背包、仓库、对话等任何界面都不允许弹出系统菜单（右键自身的游戏逻辑不受影响）
window.addEventListener('contextmenu', (e) => e.preventDefault(), true)

// MOD 含动态 import，用 async 引导保证挂载前全部内容已注册
async function bootstrap(): Promise<void> {
  await loadMods()
  // 标题页不建档、不运行玩法；玩家启程后再加载场景与角色。
  createApp(RootApp).mount('#app')
  registerResourceCache()
}

void bootstrap()
