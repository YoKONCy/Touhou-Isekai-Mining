<script setup lang="ts">
import { reactive } from 'vue'
import { sfx } from '../game/audio/Sfx'
import { t } from '../i18n'
withDefaults(defineProps<{ theme?: 'game' | 'title' }>(), { theme: 'game' })
const audio = reactive({ ...sfx.settings })
const rows = [{ key: 'master', label: 'ui.pause.master' }, { key: 'sfx', label: 'ui.pause.sfx' }, { key: 'music', label: 'ui.pause.music' }] as const
let lastTick = 0
function commit(key: 'master' | 'sfx' | 'music', event: Event): void {
  audio[key] = Number((event.target as HTMLInputElement).value) / 100
  sfx.applySettings({ [key]: audio[key] })
  try { localStorage.setItem('touhou-isekai-mine:audio-v1', JSON.stringify(audio)) }
  catch { /* 写入不可用时，本次会话的设置仍生效。 */ }
  if (key === 'sfx' && performance.now() - lastTick > 90) { lastTick = performance.now(); sfx.uiTap() }
}
</script>
<template>
  <div class="audio-settings" :class="{ 'title-audio-settings': theme === 'title' }">
    <label v-for="row in rows" :key="row.key"><span>{{ t(row.label) }}</span><input type="range" min="0" max="100" :value="Math.round(audio[row.key] * 100)" @input="commit(row.key, $event)"/><small>{{ t('ui.common.percent', { n: Math.round(audio[row.key] * 100) }) }}</small></label>
  </div>
</template>
<style scoped>
.audio-settings{width:100%;display:grid;gap:22px;margin:25px 0}.audio-settings label{display:flex;align-items:center;gap:14px;color:#d6c3a3;font-size:14px;letter-spacing:1px}.audio-settings label>span{width:62px;flex:none}.audio-settings small{width:40px;text-align:right;color:#c9ae7f;font-size:12px}
input{min-width:0;flex:1;appearance:none;height:8px;border:1px solid #17121c;background:linear-gradient(#17131de6,#51404a);box-shadow:inset 0 2px 3px #0008,0 1px #baa17133;cursor:pointer}input::-webkit-slider-thumb{appearance:none;width:14px;height:20px;border:1px solid #382b20;background:linear-gradient(#edd6a0,#a48351);box-shadow:inset 0 1px #fff1c7,0 2px 4px #0006}input::-moz-range-thumb{border-radius:0;width:14px;height:20px;border:1px solid #382b20;background:linear-gradient(#edd6a0,#a48351)}input:focus-visible{outline:1px solid #d9c2a1;outline-offset:5px}
</style>
