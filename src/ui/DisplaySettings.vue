<script setup lang="ts">
import { displaySettings as settings, saveDisplaySettings, viewport } from '../browser/display'
import { t } from '../i18n'
import { debugHudVisible } from '../shared/debugHud'
withDefaults(defineProps<{ theme?: 'game' | 'title' }>(), { theme: 'game' })
</script>
<template>
  <fieldset class="display-settings" :class="{ 'title-display-settings': theme === 'title' }">
    <legend>{{ t('ui.mobile.settings') }}</legend>
    <label><span>{{ t('ui.mobile.controls') }}</span><select v-model="settings.controls" @change="saveDisplaySettings"><option value="auto">{{ t('ui.mobile.auto') }}</option><option value="touch">{{ t('ui.mobile.touch') }}</option><option value="desktop">{{ t('ui.mobile.desktop') }}</option></select></label>
    <label><span>{{ t('ui.mobile.quality') }}</span><select v-model="settings.quality" @change="saveDisplaySettings"><option value="auto">{{ t('ui.mobile.auto') }}</option><option value="low">{{ t('ui.mobile.economy') }}</option><option value="high">{{ t('ui.mobile.clear') }}</option></select></label>
    <label><span>{{ t('ui.mobile.frame_rate') }}</span><select v-model.number="settings.frameRate" @change="saveDisplaySettings"><option :value="0">{{ t('ui.mobile.auto') }}</option><option :value="120">120 FPS</option><option :value="90">90 FPS</option><option :value="60">60 FPS</option><option :value="30">30 FPS</option></select></label>
    <label><span>{{ t('ui.mobile.button_size') }}</span><span class="setting-range"><input v-model.number="settings.buttonScale" type="range" min="0.85" max="1.2" step="0.05" @input="saveDisplaySettings"/><output>{{ Math.round(settings.buttonScale * 100) }}%</output></span></label>
    <label><span>{{ t('ui.mobile.opacity') }}</span><span class="setting-range"><input v-model.number="settings.opacity" type="range" min="0.45" max="1" step="0.05" @input="saveDisplaySettings"/><output>{{ Math.round(settings.opacity * 100) }}%</output></span></label>
    <label><span>{{ t('ui.mobile.debug_hud') }}</span><input v-model="debugHudVisible" type="checkbox"/></label>
    <p v-if="viewport.lastInput==='gamepad'" class="gamepad-help">{{ t('ui.gamepad.help') }}</p>
  </fieldset>
</template>
<style scoped>
.display-settings {
  --setting-text: #d6c3a3;
  --setting-muted: #b9a789;
  --setting-border: #ac916d44;
  --setting-accent: #edd6a0;
  --setting-field: #29232d;
  --setting-hover: #443540;
  --setting-track: linear-gradient(90deg, #b99b6a, #6c5138);
  --setting-thumb: linear-gradient(135deg, #fff1c7, #a48351);
  width: 100%; min-width: 0; border: 0; border-top: 1px solid var(--setting-border);
  margin: 12px 0 20px; padding: 14px 0 0; display: grid; gap: 10px;
  color: var(--setting-text); font: 12px var(--font-body); line-height: 1.5;
}
.title-display-settings {
  --setting-text: #e3dbf1;
  --setting-muted: #c5b7df;
  --setting-border: #a299c04d;
  --setting-accent: #e5d5ff;
  --setting-field: #0e1427;
  --setting-hover: #27334d;
  --setting-track: linear-gradient(90deg, #b0a0cf, #66547f);
  --setting-thumb: linear-gradient(135deg, #fff1ff, #bba2e9);
  font-size: 14px; gap: 12px; padding-top: 18px;
}
.display-settings legend { padding: 0 8px; color: var(--setting-muted); font-size: 12px; letter-spacing: 2px; }
.display-settings label { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 40px; }
.display-settings label > span:first-child { min-width: 0; }
.display-settings select {
  width: 156px; max-width: 50%; flex: none; min-height: 40px;
  appearance: none; border: 1px solid var(--setting-border); border-radius: 0;
  background: var(--setting-field) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='m2 2 4 4 4-4' fill='none' stroke='%23b9b1c9' stroke-width='1.5'/%3E%3C/svg%3E") no-repeat right 12px center;
  color: var(--setting-text); padding: 7px 32px 7px 12px; font: inherit; color-scheme: dark; cursor: pointer;
}
.display-settings select:hover { border-color: var(--setting-muted); background-color: var(--setting-hover); }
.display-settings option { background: var(--setting-field); color: var(--setting-text); }
.setting-range { display: flex; align-items: center; gap: 10px; width: 156px; max-width: 50%; flex: none; }
.setting-range output { flex: 0 0 38px; text-align: right; color: var(--setting-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.setting-range input { width: 100%; min-width: 0; height: 32px; margin: 0; padding: 0; border: 0; appearance: none; background: transparent; box-shadow: none; cursor: pointer; }
.setting-range input::-webkit-slider-runnable-track { height: 3px; background: var(--setting-track); }
.setting-range input::-webkit-slider-thumb { appearance: none; width: 15px; height: 15px; margin-top: -6px; border: 0; border-radius: 0; background: var(--setting-thumb); clip-path: polygon(50% 0,100% 50%,50% 100%,0 50%); }
.setting-range input::-moz-range-track { height: 3px; background: var(--setting-track); }
.setting-range input::-moz-range-thumb { width: 15px; height: 15px; border: 0; border-radius: 0; background: var(--setting-thumb); clip-path: polygon(50% 0,100% 50%,50% 100%,0 50%); }
.display-settings input[type=checkbox] { appearance: none; flex: none; width: 20px; height: 20px; margin: 0; border: 1px solid var(--setting-muted); border-radius: 0; background: var(--setting-field); cursor: pointer; }
.display-settings input[type=checkbox]:checked { background: var(--setting-accent) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='m5 10 3 3 7-7' fill='none' stroke='%23101628' stroke-width='2'/%3E%3C/svg%3E") center / 18px no-repeat; border-color: var(--setting-accent); }
.display-settings :is(select,input):focus-visible { outline: 1px solid var(--setting-accent); outline-offset: 4px; }
.gamepad-help { font-size: 12px; line-height: 1.8; color: var(--setting-muted); }
</style>
