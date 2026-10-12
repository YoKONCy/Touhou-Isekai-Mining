import { createApp } from 'vue'
// 首页先显示语言和存档摘要，玩法内容在确认启程后统一准备。
import './content/titleLanguage'
import RootApp from './RootApp.vue'
import { registerResourceCache } from './browser/resourceCache'
import './styles.css'
import './ui/game-ui.css'
import './ui/hud-theme.css'
import './ui/title-hud.css'
import './ui/mobile.css'
import { startDisplayAdaptation } from './browser/display'

startDisplayAdaptation()

// 全程禁用浏览器原生右键菜单：捕获阶段挂在 window 上，
// 画布、背包、仓库、对话等任何界面都不允许弹出系统菜单（右键自身的游戏逻辑不受影响）
window.addEventListener('contextmenu', (e) => e.preventDefault(), true)

createApp(RootApp).mount('#app')
registerResourceCache()
