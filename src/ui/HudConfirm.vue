<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { t } from '../i18n'

const props = withDefaults(defineProps<{ title: string; message: string; confirmLabel?: string; busy?: boolean; theme?: 'game' | 'title' }>(), { busy: false, theme: 'game' })
const emit = defineEmits<{ confirm: []; cancel: [] }>()
const panel = ref<HTMLElement | null>(null)
const previousFocus = document.activeElement as HTMLElement | null
function onKey(event: KeyboardEvent): void {
  // 捕获阶段阻止 ESC 穿透到暂停菜单或游戏输入。
  event.stopImmediatePropagation()
  if (event.code === 'Escape') { event.preventDefault(); if (!props.busy) emit('cancel') }
  if (event.code !== 'Tab') return
  const buttons = panel.value?.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled)')
  if (!buttons?.length) return
  const first = buttons[0], last = buttons[buttons.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
onMounted(async () => {
  window.addEventListener('keydown', onKey, true)
  await nextTick()
  const input = panel.value?.querySelector<HTMLInputElement>('input')
  if (input) { input.focus(); input.select() }
  else panel.value?.querySelector<HTMLButtonElement>('button')?.focus()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey, true)
  if (previousFocus?.isConnected) previousFocus.focus()
})
</script>

<template>
  <Teleport to="body">
    <div class="confirm-mask" :class="{ 'title-hud-mask': theme === 'title' }" @click.self="!busy && emit('cancel')">
      <section ref="panel" class="confirm-panel" :class="theme === 'title' ? 'title-hud-panel' : 'gpanel hud-panel'" role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
        <span class="confirm-caption">{{ t(theme === 'title' ? 'ui.title.confirm_caption' : 'ui.confirm.caption') }}</span>
        <h2 id="confirm-title">{{ title }}</h2>
        <slot name="body"><div class="confirm-paper"><p id="confirm-message">{{ message }}</p><span aria-hidden="true">{{ theme === 'title' ? '✦' : t('ui.records.stamp') }}</span></div></slot>
        <footer><button :class="theme === 'title' ? 'title-hud-action' : 'gbtn'" :disabled="busy" @click="emit('cancel')">{{ t('ui.common.cancel') }}</button><button :class="theme === 'title' ? 'title-hud-action primary' : 'gbtn primary'" :disabled="busy" @click="emit('confirm')">{{ busy ? t('ui.common.processing') : confirmLabel ?? t('ui.common.confirm') }}</button></footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.confirm-mask{position:fixed;inset:0;z-index:3000;display:grid;place-items:center;padding:20px;background:#080812b3;cursor:default}
.confirm-panel{width:min(440px,100%);padding:24px;background:repeating-linear-gradient(25deg,#dcc7a805 0 1px,transparent 1px 5px),linear-gradient(140deg,#45353b,#25202b);box-shadow:0 20px 70px #0009}
.confirm-caption{font-size:10px;letter-spacing:3px;color:#a78f70}.confirm-panel h2{margin:10px 0 20px;color:#ead6b1;font-size:22px;font-weight:400;letter-spacing:3px}
.confirm-paper{position:relative;padding:20px 22px 34px;border:1px solid #af956c;background:repeating-linear-gradient(0deg,transparent 0 3px,#72553606 3px 4px),linear-gradient(110deg,#c6b18b,#e5d8bb 9%,#d9c6a3);box-shadow:inset 4px 0 #78644435,0 3px 8px #0004;color:#65513c}
.confirm-paper p{font-size:13px;line-height:1.9;white-space:pre-line}.confirm-paper>span{position:absolute;right:13px;bottom:9px;border:1px solid #95564e66;color:#995c5366;padding:2px 5px;transform:rotate(-8deg)}footer{display:flex;justify-content:flex-end;gap:12px;margin-top:22px}.gbtn:focus-visible{outline:2px solid #f1dba6;outline-offset:4px}
</style>
