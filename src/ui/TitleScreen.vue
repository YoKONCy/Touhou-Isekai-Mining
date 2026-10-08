<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { CharacterProfile } from '../shared/profile'
import type { PlayerAppearance } from '../shared/playerAppearance'
import { saveService } from '../core/save/saveService'
import { sfx } from '../game/audio/Sfx'
import AudioSettings from './AudioSettings.vue'
import SaveSlotsDialog from './SaveSlotsDialog.vue'
import HudConfirm from './HudConfirm.vue'
import LoopingTitleVideo from './LoopingTitleVideo.vue'
import { t } from '../i18n'

const props = withDefaults(defineProps<{ initialScreen?: 'menu' | 'new' }>(), { initialScreen: 'menu' })
const emit = defineEmits<{ start: [profile: CharacterProfile] }>()
const screen = ref<'menu' | 'new'>(props.initialScreen)
const modal = ref<'load' | 'settings' | null>(null)
const appearance = ref<PlayerAppearance>('brother'), name = ref('')
const activeMenu = ref(0), busy = ref(false), message = ref(''), confirmNew = ref(false)
const video = ref<{ resume: () => void } | null>(null), root = ref<HTMLElement | null>(null)
const baseURL = import.meta.env.BASE_URL
const menu = ['ui.title.new_game', 'ui.title.load_game', 'ui.title.settings']
const heroes = [{ id: 'brother', label: 'ui.player.brother', portrait: 'hero-base.png' }, { id: 'sister', label: 'ui.player.sister', portrait: 'characters/sister/portrait.png' }] as const
function tap(): void { sfx.uiTap(); video.value?.resume() }
async function openMenu(index: number): Promise<void> {
  if (busy.value) return
  tap(); message.value = ''
  if (index === 0) screen.value = 'new'
  else modal.value = index === 1 ? 'load' : 'settings'
  await nextTick()
  if (index === 0) root.value?.querySelector<HTMLButtonElement>('.hero-choice.selected')?.focus()
  if (index === 2) root.value?.querySelector<HTMLInputElement>('.settings-panel input')?.focus()
}
function choose(value: PlayerAppearance): void { appearance.value = value; tap() }
async function requestNew(): Promise<void> {
  if (busy.value) return
  busy.value = true; message.value = ''
  try {
    if (await saveService.hasSave()) confirmNew.value = true
    else await createNew()
  } catch (error) { message.value = 'ui.title.error.check_save'; console.error('[标题] 检查存档失败', error) }
  finally { busy.value = false }
}
async function createNew(): Promise<void> {
  busy.value = true; message.value = ''
  try {
    const profile = await saveService.newGame(appearance.value, name.value)
    confirmNew.value = false
    tap(); emit('start', profile)
  } catch (error) { message.value = 'ui.title.error.new_game'; confirmNew.value = false; console.error('[标题] 建立新游戏失败', error) }
  finally { busy.value = false }
}
async function back(): Promise<void> {
  if (busy.value) return
  if (modal.value) modal.value = null
  else screen.value = 'menu'
  message.value = ''; tap()
  await nextTick()
  root.value?.querySelector<HTMLButtonElement>('.title-option.active')?.focus()
}
function onKey(event: KeyboardEvent): void {
  if (busy.value || confirmNew.value || modal.value === 'load' || event.isComposing) return
  if (event.code === 'Escape') { event.preventDefault(); void back(); return }
  if (modal.value) {
    if (event.code === 'Tab') {
      const controls = root.value?.querySelectorAll<HTMLElement>('.settings-panel input, .settings-panel button')
      if (controls?.length) {
        const first = controls[0], last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    return
  }
  if ((event.target as HTMLElement)?.matches('input')) return
  if (screen.value === 'menu') {
    if (event.code === 'ArrowDown' || event.code === 'ArrowUp') {
      event.preventDefault()
      activeMenu.value = (activeMenu.value + (event.code === 'ArrowDown' ? 1 : 2)) % 3
      void nextTick(() => root.value?.querySelector<HTMLButtonElement>('.title-option.active')?.focus())
    }
    // 有焦点的按钮由原生键盘激活，避免 Enter 触发两次。
    if (event.code === 'Enter' && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); void openMenu(activeMenu.value) }
  } else if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
    event.preventDefault(); choose(event.code === 'ArrowLeft' ? 'brother' : 'sister')
    void nextTick(() => root.value?.querySelector<HTMLButtonElement>('.hero-choice.selected')?.focus())
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <main ref="root" class="title-screen" :class="{ choosing: screen === 'new' }">
    <div class="title-stage">
      <img class="title-poster" :src="`${baseURL}title/poster.jpg?v=2`" :alt="t('ui.title.background_alt')"/>
      <LoopingTitleVideo ref="video" class="title-video" :src="`${baseURL}title/background.mp4?v=3`" :poster="`${baseURL}title/poster.jpg?v=2`"/>
      <nav v-if="screen === 'menu'" class="title-menu" :aria-label="t('ui.title.menu_label')">
        <button v-for="(label, index) in menu" :key="label" class="title-option art-word" :class="{ active: activeMenu === index }" @pointerenter="activeMenu = index" @focus="activeMenu = index" @click="openMenu(index)"><span class="option-spark" aria-hidden="true">✦</span><span>{{ t(label) }}</span><i aria-hidden="true"></i></button>
      </nav>
    </div>
    <Transition name="selection">
      <section v-if="screen === 'new'" class="new-game" aria-labelledby="journey-title">
        <header><small>{{ t('ui.title.journey_caption') }}</small><h1 id="journey-title" class="art-word">{{ t('ui.title.choose_hero') }}</h1></header>
        <div class="hero-choices" role="group" :aria-label="t('ui.title.hero_group')">
          <button v-for="hero in heroes" :key="hero.id" class="hero-choice" :class="{ selected: appearance === hero.id }" :aria-pressed="appearance === hero.id" :disabled="busy" @click="choose(hero.id)"><span class="hero-light" aria-hidden="true"></span><img :src="`${baseURL}${hero.portrait}`" :alt="t(hero.label)"/><span class="hero-label art-word">{{ t(hero.label) }}<i aria-hidden="true">✦</i></span></button>
        </div>
        <form class="journey-form" @submit.prevent="requestNew">
          <label for="traveler-name">{{ t('ui.title.name_label') }}</label><input id="traveler-name" v-model="name" maxlength="12" autocomplete="off" :placeholder="t('ui.title.name_placeholder', { name: t('story.player.default_name') })" :disabled="busy"/>
          <div class="journey-actions"><button type="button" class="art-action" :disabled="busy" @click="back">{{ t('ui.common.back') }}</button><button type="submit" class="art-action begin" :disabled="busy">{{ t(busy ? 'ui.title.departing' : 'ui.title.begin') }}<span aria-hidden="true">›</span></button></div>
        </form>
      </section>
    </Transition>
    <p v-if="message" class="title-message" role="status">{{ t(message) }}</p>
    <footer v-if="screen === 'menu'" class="title-hint">{{ t('ui.title.keyboard_hint') }}</footer>
    <SaveSlotsDialog v-if="modal === 'load'" mode="load" theme="title" @close="back" @loaded="emit('start', $event)"/>
    <div v-if="modal === 'settings'" class="settings-mask title-hud-mask" @click.self="back">
      <section class="settings-panel title-hud-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <small>{{ t('ui.title.settings_caption') }}</small><h2 id="settings-title">{{ t('ui.title.settings') }}</h2><AudioSettings theme="title"/><button class="title-hud-action" @click="back">{{ t('ui.common.back') }}</button>
      </section>
    </div>
    <HudConfirm v-if="confirmNew" theme="title" :title="t('ui.title.confirm_new.title')" :message="t('ui.title.confirm_new.message')" :confirm-label="t('ui.title.begin')" :busy="busy" @cancel="!busy && (confirmNew = false)" @confirm="createNew"/>
  </main>
</template>

<style scoped>
.title-screen{position:absolute;inset:0;overflow:hidden;background:#080b17;color:#eee9fa;cursor:default;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}.title-stage{position:absolute;inset:0}.title-poster,.title-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.title-video{pointer-events:none}.title-stage::after{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,#05091824,transparent 65%);transition:background .4s}
.art-word{font-family:'KaiTi','STKaiti','楷体','华文楷体',serif;font-weight:700}.title-menu{position:absolute;z-index:1;left:12%;top:47%;display:flex;flex-direction:column;align-items:flex-start;gap:clamp(12px,2.4vw,38px)}.title-option{position:relative;display:flex;align-items:center;gap:14px;padding:8px 12px;border:0;background:none;box-shadow:none;border-radius:0;color:#b5afca;font-size:clamp(22px,2.45vw,44px);letter-spacing:.22em;cursor:pointer;text-shadow:0 3px 7px #070814,0 0 20px #15152f;transform-origin:22px 50%;transition:transform .24s,color .24s,text-shadow .24s}.title-option.active{transform:scale(1.13) translateX(8px);color:#f5f0ff;text-shadow:0 2px 5px #06071c,0 0 16px #a9a1f399,0 0 35px #8175db77}.option-spark{font-size:15px;opacity:0;transform:scale(.5) rotate(-50deg);color:#cabfff;transition:opacity .24s,transform .3s}.active .option-spark{opacity:1;transform:scale(1) rotate(0)}.title-option i{position:absolute;left:39px;right:12px;bottom:0;height:1px;background:linear-gradient(90deg,#e1d6ffb3,transparent);transform:scaleX(0);transform-origin:left;transition:transform .24s}.active i{transform:scaleX(1)}.title-option:focus-visible{outline:none}.title-option:focus-visible>span:nth-child(2){text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:9px}.title-hint{position:absolute;left:6%;bottom:3%;font-size:11px;letter-spacing:2px;color:#aaa4bd88;text-shadow:0 1px 4px #050711}
.new-game{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;padding:3dvh 20px 2dvh;background:radial-gradient(ellipse at 50% 44%,#272548a6,#080c19eb 85%);overflow-y:auto;z-index:2}.new-game header{text-align:center;flex:none}.new-game header small{font-size:11px;letter-spacing:5px;color:#a9a1c5}.new-game h1{font-size:clamp(26px,3.2vw,45px);letter-spacing:5px;margin:13px 0 0;color:#eee8ff;text-shadow:0 2px 4px #070a18,0 0 25px #a195e244}.hero-choices{display:flex;justify-content:center;gap:clamp(35px,8vw,150px);width:min(900px,100%);flex:1;min-height:230px;max-height:60dvh;margin:1dvh 0 2dvh}.hero-choice{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;width:38%;min-width:0;border:0;background:none;padding:12px 0;cursor:pointer;isolation:isolate;color:#9992ad}.hero-choice img{position:relative;min-height:0;max-width:100%;height:calc(100% - 50px);object-fit:contain;filter:brightness(.63) saturate(.65);transform:scale(.93);transform-origin:50% 75%;transition:transform .35s cubic-bezier(.2,.7,.3,1),filter .35s}.hero-choice.selected img{transform:scale(1.055);filter:brightness(1.03) saturate(1) drop-shadow(0 0 14px #a397e83d)}.hero-light{position:absolute;z-index:-1;inset:8% -20% 0;opacity:0;background:radial-gradient(ellipse at 50% 68%,#8478ca42,transparent 65%);transition:opacity .35s}.selected .hero-light{opacity:1}.hero-label{position:relative;display:block;flex:none;font-size:clamp(24px,2.5vw,34px);letter-spacing:7px;transition:color .25s,transform .25s}.selected .hero-label{color:#f4edff;transform:scale(1.1);text-shadow:0 0 18px #b7a8f366}.hero-label i{position:absolute;bottom:-15px;left:50%;font-size:10px;font-style:normal;opacity:0;color:#cfc0ff;transition:opacity .3s}.selected .hero-label i{opacity:1}.hero-choice:focus-visible{outline:none}.hero-choice:focus-visible .hero-label{text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:7px}.hero-choice:disabled{cursor:default}
.journey-form{width:min(400px,90%);flex:none;text-align:center}.journey-form label{display:block;font-size:11px;letter-spacing:4px;color:#aba1bf;margin:0 0 11px}.journey-form input{display:block;width:100%;border:0;border-bottom:1px solid #a69bcf66;border-radius:0;padding:8px 10px 12px;background:linear-gradient(0deg,#b9a7ef0c,transparent);color:#efe8ff;font:inherit;font-size:19px;letter-spacing:3px;text-align:center;outline:none;user-select:text}.journey-form input:focus{border-color:#e5d9ff;box-shadow:0 9px 15px -15px #e6d4ff}.journey-form input::placeholder{font-size:11px;letter-spacing:1px;color:#7f7696}.journey-actions{display:flex;align-items:center;justify-content:space-between;margin:20px 0 10px}.art-action{position:relative;border:0;border-radius:0;background:none;color:#a69bbb;font-family:'KaiTi','STKaiti','楷体',serif;font-size:22px;letter-spacing:4px;padding:8px 12px;cursor:pointer;transition:transform .2s,color .2s,text-shadow .2s}.art-action.begin{color:#e4d7fa;font-size:27px}.art-action span{margin-left:14px;color:#bda7ee}.art-action:hover:enabled,.art-action:focus-visible{color:#fff1ff;transform:scale(1.08);text-shadow:0 0 18px #bfa1e999;outline:none}.art-action:focus-visible{text-decoration:underline;text-underline-offset:7px}.art-action:disabled{opacity:.4;cursor:default}.title-message{position:absolute;z-index:5;bottom:2%;left:50%;transform:translateX(-50%);font-size:12px;line-height:1.6;color:#decff1;background:#10152bd9;padding:9px 18px;max-width:90%;text-align:center}
.settings-mask{position:fixed;inset:0;z-index:1800;display:grid;place-items:center;padding:20px;background:#080a16b3}.settings-panel{width:min(430px,100%);max-height:88dvh;overflow:auto;padding:28px;background:repeating-linear-gradient(25deg,#d4b99004 0 1px,transparent 1px 5px),linear-gradient(145deg,#42343b,#28212e);box-shadow:0 15px 60px #0008}.settings-panel>small{color:#a89177;font-size:10px;letter-spacing:3px}.settings-panel h2{color:#e6d2b2;font-size:25px;letter-spacing:6px;font-weight:400;margin:13px 0}.settings-panel>button{display:block;margin:30px auto 0}.selection-enter-active,.selection-leave-active{transition:opacity .3s}.selection-enter-from,.selection-leave-to{opacity:0}@media(max-height:600px){.new-game{padding-top:14px}.new-game h1{font-size:26px;margin-top:8px}.hero-choices{min-height:150px;margin-bottom:6px;max-height:51dvh}.journey-actions{margin-top:9px}.journey-form input{padding:5px 8px 7px}.hero-label{font-size:23px}.new-game header small{font-size:9px}}@media(max-width:600px){.title-menu{left:8%;top:44%;gap:8px}.title-option{font-size:clamp(17px,4vw,24px);gap:7px;padding:4px 5px}.title-option i{left:25px}.option-spark{font-size:10px}.title-hint{font-size:9px}.hero-choices{gap:15px}.hero-choice{width:45%}.new-game h1{font-size:25px;letter-spacing:2px}}@media(prefers-reduced-motion:reduce){.title-option,.title-option i,.option-spark,.hero-choice img,.hero-light,.hero-label,.art-action,.selection-enter-active,.selection-leave-active{transition:none}}
</style>

