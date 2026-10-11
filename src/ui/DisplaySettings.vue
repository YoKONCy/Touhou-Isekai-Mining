<script setup lang="ts">
import { displaySettings as settings, saveDisplaySettings, viewport } from '../browser/display'
import { t } from '../i18n'
import { debugHudVisible } from '../shared/debugHud'
</script>
<template>
  <fieldset class="display-settings">
    <legend>{{ t('ui.mobile.settings') }}</legend>
    <label><span>{{ t('ui.mobile.controls') }}</span><select v-model="settings.controls" @change="saveDisplaySettings"><option value="auto">{{ t('ui.mobile.auto') }}</option><option value="touch">{{ t('ui.mobile.touch') }}</option><option value="desktop">{{ t('ui.mobile.desktop') }}</option></select></label>
    <label><span>{{ t('ui.mobile.quality') }}</span><select v-model="settings.quality" @change="saveDisplaySettings"><option value="auto">{{ t('ui.mobile.auto') }}</option><option value="low">{{ t('ui.mobile.economy') }}</option><option value="high">{{ t('ui.mobile.clear') }}</option></select></label>
    <label><span>{{ t('ui.mobile.frame_rate') }}</span><select v-model.number="settings.frameRate" @change="saveDisplaySettings"><option :value="0">{{ t('ui.mobile.auto') }}</option><option :value="120">120 FPS</option><option :value="90">90 FPS</option><option :value="60">60 FPS</option><option :value="30">30 FPS</option></select></label>
    <label><span>{{ t('ui.mobile.button_size') }}</span><input v-model.number="settings.buttonScale" type="range" min="0.85" max="1.2" step="0.05" @input="saveDisplaySettings"/></label>
    <label><span>{{ t('ui.mobile.opacity') }}</span><input v-model.number="settings.opacity" type="range" min="0.45" max="1" step="0.05" @input="saveDisplaySettings"/></label>
    <label><span>{{ t('ui.mobile.debug_hud') }}</span><input v-model="debugHudVisible" type="checkbox"/></label>
    <p v-if="viewport.lastInput==='gamepad'" class="gamepad-help">{{ t('ui.gamepad.help') }}</p>
  </fieldset>
</template>
<style scoped>
.gamepad-help{font-size:11px;line-height:1.8;color:#b9a789}
.display-settings{width:100%;border:0;border-top:1px solid #ac916d44;margin:12px 0 20px;padding:14px 0 0;display:grid;gap:10px;color:#d6c3a3;font-size:12px}.display-settings legend{padding:0 8px;letter-spacing:2px}.display-settings label{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:38px}.display-settings select{min-width:130px;border:1px solid #8f745077;background:#29232d;color:#eddfc5;padding:8px;font:inherit;color-scheme:dark}.display-settings input{max-width:150px;min-width:0;accent-color:#c1a06c}
</style>
