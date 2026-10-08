<script setup lang="ts">
/** 暂停菜单沿用皮革铜钉框；所有记录与离场确认都在游戏内完成。 */
import { onBeforeUnmount, ref } from 'vue'
import type { CharacterProfile } from '../shared/profile'
import { t } from '../i18n'
import AudioSettings from './AudioSettings.vue'
import SaveSlotsDialog from './SaveSlotsDialog.vue'
import HudConfirm from './HudConfirm.vue'

const emit = defineEmits<{ close: []; loaded: [profile: CharacterProfile]; newGame: []; title: [] }>()
defineProps<{ canSave: boolean }>()
const mode = ref<'save' | 'load' | null>(null)
const pending = ref<'new' | 'title' | null>(null)
function close(): void { if (!mode.value && !pending.value) emit('close') }
function confirmExit(): void {
  const action = pending.value
  pending.value = null
  if (action === 'new') emit('newGame')
  else if (action === 'title') emit('title')
}
// 子弹窗显示时阻止 ESC 把底层暂停状态一起关闭；子弹窗自己处理返回。
function onKey(event: KeyboardEvent): void {
  if (!mode.value && !pending.value) return
  if (event.code === 'Escape' && !event.defaultPrevented) {
    // 子层使用捕获监听，优先消费；这里只拦截漏出的按键。
    event.preventDefault(); event.stopImmediatePropagation()
  }
}
window.addEventListener('keydown', onKey)
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="pause-mask hud-modal" @click.self="close">
    <section class="pause-panel gpanel hud-panel gpanel-pop" role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <h2 id="pause-title" class="gsign pause-title">{{ t('ui.pause.title') }}</h2>
      <div class="pause-sub">{{ t('ui.pause.sub') }}</div>
      <AudioSettings/>
      <button class="gbtn primary resume-btn" @click="close">{{ t('ui.pause.resume') }}</button>
      <div class="save-actions"><button class="gbtn" :disabled="!canSave" :title="canSave ? '' : t('ui.save.blocked_cave')" @click="mode = 'save'">{{ t('ui.save.save') }}</button><button class="gbtn" @click="mode = 'load'">{{ t('ui.save.load') }}</button></div>
      <small v-if="!canSave" class="save-note">{{ t('ui.save.blocked_cave') }}</small>
      <div class="departure-actions"><button @click="pending = 'new'">{{ t('ui.save.new') }}</button><span>·</span><button @click="pending = 'title'">{{ t('ui.title.return_title') }}</button></div>
      <div class="pause-hint">{{ t('ui.pause.hint_pre') }}<kbd>ESC</kbd>{{ t('ui.pause.hint_mid') }}<kbd>N</kbd>{{ t('ui.pause.hint_post') }}</div>
    </section>
    <SaveSlotsDialog v-if="mode" :mode="mode" @close="mode = null" @loaded="emit('loaded', $event)"/>
    <HudConfirm v-if="pending" :title="t(pending === 'new' ? 'ui.pause.confirm_new.title' : 'ui.pause.confirm_title.title')" :message="t(pending === 'new' ? 'ui.pause.confirm_new.message' : 'ui.pause.confirm_title.message')" :confirm-label="t(pending === 'new' ? 'ui.title.hero_group' : 'ui.title.return_title')" @cancel="pending = null" @confirm="confirmExit"/>
  </div>
</template>

<style scoped>
.pause-mask{position:fixed;inset:0;z-index:1400;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient(ellipse at center,#100d196e,#080711cf);cursor:default}.pause-panel{width:min(420px,100%);max-height:88dvh;overflow:auto;padding:28px 30px 23px;display:flex;flex-direction:column;align-items:center;box-shadow:0 18px 50px #0008}.pause-title{font-size:29px;font-weight:400;letter-spacing:8px;text-indent:8px}.pause-sub{margin-top:8px;font-size:11px;color:#c3ae8fa3;letter-spacing:2px}.resume-btn{min-width:190px;font-size:16px;letter-spacing:4px}.save-actions{display:flex;gap:13px;margin-top:17px}.save-note{font-size:10px;line-height:1.8;color:#a99b85;margin-top:12px;text-align:center}.departure-actions{display:flex;align-items:center;gap:20px;margin-top:24px;color:#8c755a}.departure-actions button{border:0;background:none;border-radius:0;font:inherit;font-size:12px;color:#b6a084;cursor:pointer;padding:5px 0}.departure-actions button:hover{color:#e0c5a0}.departure-actions button:focus-visible{outline:1px solid #dbc393;outline-offset:4px}.pause-hint{margin-top:18px;font-size:10px;color:#ad9b8180;letter-spacing:1px}.pause-hint kbd{padding:1px 5px;border:1px solid #b49b6655;border-radius:0;color:#cdb584;font:inherit}
</style>
