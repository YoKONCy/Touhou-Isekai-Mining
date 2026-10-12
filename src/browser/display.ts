import { computed, reactive } from 'vue'

export type ControlMode = 'auto' | 'touch' | 'desktop'
export type RenderQuality = 'auto' | 'low' | 'high'
const KEY = 'touhou-isekai-mine:display-v1'
export const displaySettings = reactive({ controls: 'auto' as ControlMode, quality: 'auto' as RenderQuality, frameRate: 0, buttonScale: 1, opacity: .82 })
export const viewport = reactive({ width: typeof window==='undefined'?1280:window.innerWidth, height: typeof window==='undefined'?720:window.innerHeight, coarse: false, lastInput: 'mouse' as 'mouse' | 'touch' | 'keyboard' | 'gamepad' })
export const touchControls = computed(() => displaySettings.controls === 'touch' || displaySettings.controls === 'auto' && viewport.lastInput === 'touch')
export const portrait = computed(() => viewport.height > viewport.width)
export const compactLayout = computed(() => viewport.coarse || viewport.width < 760 || viewport.height < 600)
export const landscapeRequired = computed(() => portrait.value && (viewport.coarse || touchControls.value))
const listeners = new Set<() => void>()
let renderLayoutKey = ''
export function activateGamepad(): void { if(viewport.lastInput!=='gamepad'){viewport.lastInput='gamepad';syncDocument()} }
export function deactivateGamepad(): void { if(viewport.lastInput==='gamepad'){viewport.lastInput=viewport.coarse?'touch':'mouse';syncDocument()} }
export function onDisplayChange(listener: () => void): () => void { listeners.add(listener); return () => listeners.delete(listener) }
export function saveDisplaySettings(): void {
  try { localStorage.setItem(KEY, JSON.stringify(displaySettings)) } catch { /* 本地存储不可用时保留本次会话设置。 */ }
  syncDocument()
}
function syncDocument(): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.controls = touchControls.value ? 'touch' : 'desktop'
  root.dataset.layout = compactLayout.value ? 'compact' : 'regular'
  root.dataset.compact = viewport.height < 600 || viewport.width < 760 ? 'true' : 'false'
  root.style.setProperty('--view-height', `${viewport.height}px`)
  root.style.setProperty('--view-width', `${viewport.width}px`)
  root.style.setProperty('--touch-scale', String(displaySettings.buttonScale))
  root.style.setProperty('--touch-opacity', String(displaySettings.opacity))
  // 点击、焦点与操作方式变化只更新界面状态，实际渲染尺寸改变才通知画布。
  const nextRenderLayoutKey = `${viewport.width}:${viewport.height}:${compactLayout.value}:${displaySettings.quality}:${window.devicePixelRatio}`
  if (nextRenderLayoutKey !== renderLayoutKey) {
    renderLayoutKey = nextRenderLayoutKey
    for (const listener of listeners) listener()
  }
}
/** 可用空间与输入设备分别记录，平板接鼠标时不必伪装成手机。 */
export function startDisplayAdaptation(): () => void {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    if (['auto', 'touch', 'desktop'].includes(saved.controls)) displaySettings.controls = saved.controls
    if (['auto', 'low', 'high'].includes(saved.quality)) displaySettings.quality = saved.quality
    if ([0, 30, 60, 90, 120].includes(saved.frameRate)) displaySettings.frameRate = saved.frameRate
    if (Number.isFinite(saved.buttonScale)) displaySettings.buttonScale = Math.max(.85, Math.min(1.2, saved.buttonScale))
    if (Number.isFinite(saved.opacity)) displaySettings.opacity = Math.max(.45, Math.min(1, saved.opacity))
  } catch { /* 设置损坏时沿用默认值。 */ }
  const media = matchMedia('(pointer: coarse)')
  viewport.coarse = media.matches
  viewport.lastInput = media.matches ? 'touch' : 'mouse'
  const resize = () => {
    viewport.width = Math.round(window.visualViewport?.width ?? window.innerWidth)
    viewport.height = Math.round(window.visualViewport?.height ?? window.innerHeight)
    viewport.coarse = media.matches
    syncDocument()
  }
  let lastTouch = -Infinity
  const pointer = (event: PointerEvent) => {
    if (!['touch', 'mouse', 'pen'].includes(event.pointerType)) return
    // 部分移动浏览器的兼容鼠标事件不能把触控布局立即切回桌面。
    if (event.pointerType === 'touch') lastTouch = performance.now()
    const source = event as PointerEvent & { sourceCapabilities?: { firesTouchEvents?: boolean } }
    if (event.pointerType === 'mouse' && (source.sourceCapabilities?.firesTouchEvents || performance.now() - lastTouch < 800)) return
    const next = event.pointerType === 'touch' ? 'touch' : 'mouse'
    if (viewport.lastInput !== next) { viewport.lastInput = next; syncDocument() }
  }
  const keyboard = (event: KeyboardEvent) => {
    if (event.target instanceof Element && event.target.closest('input,textarea,select')) return
    if (viewport.lastInput !== 'keyboard') { viewport.lastInput = 'keyboard'; syncDocument() }
  }
  resize()
  window.addEventListener('resize', resize)
  window.visualViewport?.addEventListener('resize', resize)
  media.addEventListener('change', resize)
  window.addEventListener('pointerdown', pointer, true)
  window.addEventListener('keydown', keyboard, true)
  return () => {
    window.removeEventListener('resize', resize)
    window.visualViewport?.removeEventListener('resize', resize)
    media.removeEventListener('change', resize)
    window.removeEventListener('pointerdown', pointer, true)
    window.removeEventListener('keydown', keyboard, true)
  }
}
