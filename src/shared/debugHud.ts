import { ref, watch } from 'vue'

const STORAGE_KEY = 'touhou-isekai-mine:debug-hud-v1'

/** 调试栏属于全局界面偏好，新游戏、读档和切场景都沿用同一个开关。 */
function readVisibility(): boolean {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true' }
  catch { return false }
}

export const debugHudVisible = ref(readVisibility())

watch(debugHudVisible, visible => {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, String(visible))
  } catch {
    // 浏览器禁止存储时仍保留本次会话的全局开关。
  }
}, { flush: 'sync' })
