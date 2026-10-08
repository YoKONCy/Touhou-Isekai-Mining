<script setup lang="ts">
import { computed } from 'vue'
import type { StatusSnapshot } from '../shared/statusEffects'
import { t } from '../i18n'
const props = defineProps<{ effects: StatusSnapshot[] }>()
const rows = computed(() => (['buff', 'debuff'] as const).map(kind => ({ kind, effects: props.effects.filter(s => s.kind === kind) })).filter(row => row.effects.length))
function timeText(seconds: number): string { return seconds < 10 ? seconds.toFixed(1) : String(Math.ceil(seconds)) }
</script>

<template>
  <div v-if="rows.length" class="status-effects">
    <div v-for="row in rows" :key="row.kind" class="status-row" :class="row.kind" :aria-label="t(`status.ui.${row.kind}`)">
      <span class="row-mark" aria-hidden="true">{{ row.kind === 'buff' ? '＋' : '−' }}</span>
      <button v-for="effect in row.effects" :key="effect.key" class="status-icon gpanel-mini hud-surface" :aria-label="`${t(effect.nameKey)}：${t(effect.descriptionKey)}`">
        <span class="status-art" v-html="effect.icon"></span>
        <span v-if="effect.remaining !== null" class="status-time">{{ timeText(effect.remaining) }}</span>
        <span v-if="effect.stacks > 1" class="status-stacks">{{ effect.stacks }}</span>
        <span class="status-tip gpanel-mini hud-surface" role="tooltip">
          <strong>{{ t(effect.nameKey) }}</strong>
          <span v-if="effect.effectKey" class="status-values">{{ t(effect.effectKey) }}</span>
          <span class="status-description">{{ t(effect.descriptionKey) }}</span>
          <small v-if="effect.remaining !== null">{{ t('status.ui.remaining', { n: timeText(effect.remaining) }) }}</small>
          <small v-else-if="effect.conditionKey">{{ t(effect.conditionKey) }}</small>
          <small v-if="effect.stacks > 1">{{ t('status.ui.stacks', { n: effect.stacks }) }}</small>
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.status-effects { display: flex; flex-direction: column; gap: 5px; pointer-events: auto; }
.status-row { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; }
.row-mark { width: 10px; font-size: 10px; color: var(--brass-hi); opacity: .7; }
.debuff .row-mark { color: var(--danger); }
/* 与生命、灵力和楼层牌共用暖褐底与黄铜受光，不覆盖公共材质。 */
.status-icon { position: relative; width: 35px; height: 35px; padding: 3px; box-sizing: border-box; cursor: default; }
.debuff .status-icon { border-color: #8b4a3d; }
.status-art { display: block; width: 100%; height: 100%; }
.status-art :deep(svg) { width: 100%; height: 100%; display: block; }
.status-time { position: absolute; bottom: -1px; right: 0; padding: 0 2px; border-radius: 1px; background: #1c130bd9; color: var(--text); font: 9px/12px var(--font-body); font-variant-numeric: tabular-nums; }
.status-stacks { position: absolute; right: 1px; top: 0; color: #f0d7aa; font: 10px/12px var(--font-body); text-shadow: 0 1px 2px #000; }
.status-tip { display: none; position: absolute; top: calc(100% + 8px); left: 0; width: 245px; max-width: calc(100vw - 50px); box-sizing: border-box; padding: 12px 14px; text-align: left; font: 12px/1.7 var(--font-body); z-index: 60; pointer-events: none; }
.status-tip strong { display: block; margin-bottom: 6px; color: var(--brass-hi); font-family: var(--font-sign); font-size: 15px; letter-spacing: 2px; }
.status-tip>span { display: block; }
.status-description { margin-top: 8px; padding-top: 8px; border-top: 1px solid #8b735544; color: var(--text-dim); }
.status-tip small { display: block; margin-top: 7px; color: var(--text-dim); font-size: 10px; }
.status-icon:hover, .status-icon:focus-visible { border-color: #d0bc92; outline: none; }
.status-icon:hover .status-tip, .status-icon:focus-visible .status-tip { display: block; }
</style>
