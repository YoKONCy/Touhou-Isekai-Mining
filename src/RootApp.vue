<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, shallowRef, ref, watch } from 'vue'
import App from './App.vue'
import TitleScreen from './ui/TitleScreen.vue'
import type { CharacterProfile } from './shared/profile'
import { setPlayerAppearance } from './shared/playerAppearance'
import { dialogue } from './game/dialogue/dialogueService'
import { loadMineAssets } from './game/art/mineAssets'
import { loadPlayerRigAssets } from './game/art/rig/playerRig'
import { sfx, type AudioSettings as AudioSettingsValues } from './game/audio/Sfx'
import { t } from './i18n'

const profile = shallowRef<CharacterProfile | null>(null)
const entering = ref(false), error = ref(''), initialScreen = ref<'menu' | 'new'>('menu'), titleKey = ref(0)
const phase = ref<'idle' | 'fadeOut' | 'black' | 'fadeIn'>('idle')
const transitionTimers = new Map<number, () => void>()
let disposed = false
function transitionDelay(milliseconds: number): Promise<void> {
  return new Promise(resolve => {
    const timer = window.setTimeout(() => { transitionTimers.delete(timer); resolve() }, milliseconds)
    transitionTimers.set(timer, resolve)
  })
}
// 标题和游戏共用音量，标题页第一次调节前就恢复设置。
try {
  const raw = localStorage.getItem('touhou-isekai-mine:audio-v1')
  if (raw) {
    const stored = JSON.parse(raw) as Partial<AudioSettingsValues>
    const settings: Partial<AudioSettingsValues> = {}
    for (const key of ['master', 'sfx', 'music'] as const) {
      const value = stored[key]
      if (typeof value === 'number' && Number.isFinite(value)) settings[key] = Math.max(0, Math.min(1, value))
    }
    sfx.applySettings(settings)
  }
} catch { /* 旧设置不可读时使用默认值。 */ }

// 在旧玩法卸载后切换音乐，避免旧场景清理把刚开始的标题音乐一起释放。
watch([profile, phase], ([current, state]) => {
  sfx.setTitleMusic(!current && (state === 'idle' || state === 'fadeOut'))
}, { immediate: true, flush: 'post' })

/** 浏览器阻止首次自动出声时，任意标题交互都会重试解锁，不重播曲目。 */
function unlockTitleMusic(): void {
  if (!profile.value && !entering.value) sfx.setTitleMusic(true)
}
function blockTransitionKeys(event: KeyboardEvent): void {
  if (entering.value) { event.preventDefault(); event.stopImmediatePropagation() }
}
onMounted(() => {
  window.addEventListener('keydown', blockTransitionKeys, true)
  window.addEventListener('pointerdown', unlockTitleMusic, true)
  window.addEventListener('keydown', unlockTitleMusic, true)
})

async function start(next: CharacterProfile): Promise<void> {
  if (entering.value) return
  entering.value = true; error.value = ''
  try {
    // 首页及其弹窗先完整淡至黑屏，再释放旧场景并加载新档。
    phase.value = 'fadeOut'
    await transitionDelay(550)
    if (disposed) return
    phase.value = 'black'
    profile.value = null
    await nextTick()
    const [mapReady, rigReady] = await Promise.all([loadMineAssets(), loadPlayerRigAssets(next.playerAppearance), transitionDelay(220)])
    if (disposed) return
    if (!mapReady || !rigReady) throw new Error('场景或角色资源未加载完成')
    setPlayerAppearance(next.playerAppearance)
    dialogue.setProfile(next)
    profile.value = next
    await nextTick()
    phase.value = 'fadeIn'
    await transitionDelay(320)
  } catch (cause) {
    error.value = 'ui.title.error.enter_game'; console.error('[标题] 进入游戏失败', cause)
    if (!disposed) { phase.value = 'fadeIn'; await transitionDelay(320) }
  } finally { if (!disposed) { phase.value = 'idle'; entering.value = false } }
}
function showTitle(screen: 'menu' | 'new' = 'menu'): void {
  profile.value = null; initialScreen.value = screen; titleKey.value++; error.value = ''
}
onBeforeUnmount(() => {
  disposed = true
  for (const [timer, resolve] of transitionTimers) { window.clearTimeout(timer); resolve() }
  transitionTimers.clear()
  window.removeEventListener('keydown', blockTransitionKeys, true)
  window.removeEventListener('pointerdown', unlockTitleMusic, true)
  window.removeEventListener('keydown', unlockTitleMusic, true)
  sfx.dispose()
})
</script>
<template>
  <App v-if="profile" :profile="profile" @loaded="start" @new-game="showTitle('new')" @title="showTitle()"/>
  <TitleScreen v-else-if="phase !== 'black'" :key="titleKey" :initial-screen="initialScreen" @start="start"/>
  <div v-if="entering" class="journey-transition" :class="phase" role="status" :aria-label="t('ui.title.loading')"></div>
  <p v-if="error" class="journey-error" role="alert">{{ t(error) }}</p>
</template>
<style scoped>
.journey-transition{position:fixed;inset:0;z-index:4000;background:#000;cursor:wait;pointer-events:auto}.journey-transition.fadeOut{animation:journey-to-black .55s ease-in both}.journey-transition.black{opacity:1}.journey-transition.fadeIn{animation:journey-from-black .32s ease-out both}@keyframes journey-to-black{from{opacity:0}to{opacity:1}}@keyframes journey-from-black{from{opacity:1}to{opacity:0}}.journey-error{position:fixed;z-index:4001;left:50%;bottom:20px;transform:translateX(-50%);padding:12px 20px;max-width:90%;color:#decff1;background:#10152bf2;border-bottom:1px solid #a796c5;font-size:12px;text-align:center}@media(prefers-reduced-motion:reduce){.journey-transition.fadeOut,.journey-transition.fadeIn{animation-duration:.01ms}}
</style>
