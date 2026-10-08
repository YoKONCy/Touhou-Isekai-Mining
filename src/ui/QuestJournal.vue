<script setup lang="ts">
import { computed, ref } from 'vue'
import type { QuestJournalData, QuestMaterial } from '../shared/quests'
import { t, itemName } from '../i18n'
import ItemIcon from './ItemIcon.vue'

const props = defineProps<{ journals: readonly QuestJournalData[] }>()
const emit = defineEmits<{ action: [id: string] }>()
const tab = ref<'active' | 'history'>('active'), selectedId = ref<string | null>(null)
const active = computed(() => props.journals.filter(quest => !quest.completed))
const history = computed(() => props.journals.filter(quest => quest.completed).reverse())
const entries = computed(() => tab.value === 'history' ? history.value : active.value)
// 任务完成后自动选择下一项；历史详情只读，不依赖当前背包里的任务物品。
const journal = computed(() => entries.value.find(quest => quest.id === selectedId.value) ?? entries.value[0])
const progress = computed(() => journal.value?.objectives.filter(step => step.complete).length ?? 0)
const ready = (material: QuestMaterial): boolean => material.available >= material.required
</script>

<template>
  <div class="quest-layout">
    <aside class="quest-index">
      <nav class="quest-tabs" :aria-label="t('ui.camp.quest_lists')">
        <button type="button" :class="{ selected: tab === 'active' }" :aria-pressed="tab === 'active'" @click="tab = 'active'; selectedId = null">{{ t('ui.camp.active_quests') }}<span>{{ active.length }}</span></button>
        <button type="button" :class="{ selected: tab === 'history' }" :aria-pressed="tab === 'history'" @click="tab = 'history'; selectedId = null">{{ t('ui.camp.history_quests') }}<span>{{ history.length }}</span></button>
      </nav>
      <span class="chapter-label">{{ journal?.chapter ?? t('ui.camp.journal') }}</span>
      <div class="quest-list">
        <button v-for="entry in entries" :key="entry.id" type="button" class="quest-entry" :class="{ selected: entry.id === journal?.id }" :aria-pressed="entry.id === journal?.id" @click="selectedId = entry.id"><span class="quest-marker" :class="{ archived: entry.completed }">{{ entry.completed ? '✓' : '' }}</span><span><strong>{{ entry.title }}</strong><small>{{ entry.status }}</small></span></button>
      </div>
      <div v-if="journal" class="quest-progress"><span>{{ t('ui.camp.quest_progress', { done: progress, total: journal.objectives.length }) }}</span><div class="quest-progress-track" aria-hidden="true"><i v-for="step in journal.objectives" :key="step.id" :class="{ passed: step.complete, current: step.current }"></i></div></div>
    </aside>
    <article v-if="journal" :key="journal.id" class="quest-sheet">
      <div class="quest-heading"><span>{{ journal.giver }}</span><span class="quest-status">{{ journal.status }}</span></div>
      <h2>{{ journal.title }}</h2>
      <p class="quest-summary">{{ journal.summary }}</p>
      <div class="objectives">
        <section v-for="(step, index) in journal.objectives" :key="step.id" class="objective" :class="{ complete: step.complete, locked: step.locked, current: step.current }">
          <span class="step-number">{{ step.complete ? '✓' : String(index + 1).padStart(2, '0') }}</span>
          <div>
            <div class="objective-title"><h3>{{ step.title }}</h3><span v-if="step.current" class="current-step">{{ t('quest.reimu_cooking.current') }}</span><span v-else-if="step.locked" class="later-step">{{ t('quest.reimu_cooking.later') }}</span></div>
            <p v-if="step.note" class="objective-note">{{ step.note }}</p>
            <div v-if="step.materials?.length && step.metered" class="repair-supplies">
              <div v-for="material in step.materials" :key="material.id" class="repair-supply" :class="{ ready: ready(material) }">
                <div class="supply-top"><ItemIcon :id="material.id" :size="30"/><span>{{ itemName(material.id) }}</span><b>{{ material.available }}<small> / {{ material.required }}</small></b></div>
                <div class="supply-meter" aria-hidden="true"><i :style="{ width: Math.min(100, material.available / material.required * 100) + '%' }"></i></div>
                <small class="supply-status">{{ t(ready(material) ? 'quest.reimu_cooking.material_ready' : 'quest.reimu_cooking.material_short', { qty: Math.max(0, material.required - material.available) }) }}</small>
              </div>
            </div>
            <div v-else-if="step.materials?.length" class="requirements"><span v-for="material in step.materials" :key="material.id" class="requirement" :class="{ ready: ready(material) }"><ItemIcon :id="material.id" :size="26"/><span>{{ itemName(material.id) }}</span><b>{{ Math.min(material.available, material.required) }} / {{ material.required }}</b></span></div>
            <p v-if="step.location" class="repair-location" :class="{ ready: step.location.ready }"><span>{{ step.location.status }}</span>{{ step.location.text }}</p>
          </div>
        </section>
      </div>
      <footer class="quest-footer"><span>{{ journal.goal }}</span><button v-if="journal.action && !journal.completed" class="quest-action" :disabled="journal.action.disabled" @click="emit('action', journal.id)">{{ journal.action.label }}</button></footer>
    </article>
    <article v-else class="quest-sheet quest-empty"><span class="empty-bookmark" aria-hidden="true">◇</span><h2>{{ t(tab === 'history' ? 'ui.camp.history_empty' : 'ui.camp.active_empty') }}</h2><p class="quest-summary">{{ t(tab === 'history' ? 'ui.camp.history_empty_note' : 'ui.camp.active_empty_note') }}</p></article>
  </div>
</template>

<style scoped>
.quest-tabs{display:flex;gap:5px;margin:0 0 19px;border-bottom:1px solid #a0875840;padding-bottom:13px}
.quest-tabs button{flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:7px 4px;background:#19171e55;border:1px solid #9d80553b;color:#ad9b7f;font:inherit;font-size:10px;cursor:pointer;white-space:nowrap}
.quest-tabs button.selected{background:#a486492b;border-color:#b899655f;color:#e6c896;box-shadow:inset 0 -2px #b89965}
.quest-tabs button span{font-size:9px;color:#b7a17a;font-variant-numeric:tabular-nums}
.quest-list{display:flex;flex-direction:column;gap:7px;margin-top:17px}
.quest-list .quest-entry{width:100%;margin:0;text-align:left;font:inherit;color:inherit;cursor:pointer;border:0;border-left:2px solid transparent;background:transparent;box-sizing:border-box;box-shadow:none}
.quest-list .quest-entry.selected{background:#b6975b17;border-left-color:#bd9b65;box-shadow:0 3px 5px #11111b40,inset 0 1px #dbc18e1f}
.quest-list .quest-entry:hover{background:#b6975b12}.quest-list .quest-entry>span:last-child{min-width:0}.quest-entry strong{overflow-wrap:anywhere}
.quest-marker.archived{width:10px;height:10px;transform:none;border:0;color:#b4bd95;font-size:12px;line-height:10px}
.quest-tabs button:focus-visible,.quest-entry:focus-visible{outline:1px solid #d4b67b;outline-offset:2px}
.quest-empty{display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;min-height:320px}.quest-empty h2{font-size:20px}.empty-bookmark{font-size:42px;color:#a18b656b;margin-bottom:10px}
@media(max-width:650px){.quest-tabs{max-width:280px;margin-bottom:12px}.quest-list{flex-direction:row;flex-wrap:wrap;margin-top:10px}.quest-list .quest-entry{width:auto;max-width:100%}.quest-empty{min-height:230px}}
.objective-title{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:9px}
.objective-title h3{margin:0!important}
.objective-note{margin:0 0 9px;font-size:11.5px;line-height:1.7;color:#8a7050}
.quest-summary{line-height:1.8}
.quest-progress{padding:18px 12px;font-size:10px;color:#b49e7c;letter-spacing:1px}.quest-progress-track{display:flex;gap:5px;margin-top:11px}.quest-progress-track i{display:block;flex:1;height:3px;background:#15131c;border:1px solid #77604644}.quest-progress-track i.passed{background:#8e956e;border-color:#b5b58e55}.quest-progress-track i.current{background:#b08d57;border-color:#d1ae7066}.current-step{font-size:9px;letter-spacing:2px;color:#8b693f;border:1px solid #9c774b44;padding:3px 7px;background:#a2804c0d}.later-step{font-size:9px;color:#9b8c72;letter-spacing:1px}
.objective.current{background:linear-gradient(90deg,#b18d5210,transparent 85%)}.objective.current .step-number{color:#866036}
.repair-supplies{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:13px 0}.repair-supply{min-width:0;border:1px solid #a38a6044;background:linear-gradient(135deg,#91744b0b,#f6e4c018);padding:10px 10px 8px;box-shadow:inset 0 1px #fff1d240}.supply-top{display:flex;align-items:center;gap:7px;font-size:11px;color:#736044}.supply-top>span{min-width:0;overflow-wrap:anywhere}.supply-top b{margin-left:auto;font-size:13px;color:#a16f51;font-weight:normal;white-space:nowrap;font-variant-numeric:tabular-nums}.supply-top b small{font-size:10px;color:#97805c}.repair-supply.ready .supply-top b{color:#6f7a56}.supply-meter{height:3px;margin:9px 0 7px;background:#9c82532b;box-shadow:inset 0 1px #8269411f}.supply-meter i{display:block;height:100%;background:#ad8d58}.repair-supply.ready .supply-meter i{background:#8a956d}.supply-status{display:block;text-align:right;font-size:9px;color:#aa7956}.repair-supply.ready .supply-status{color:#778361}
.repair-location{margin:12px 0 0!important;font-size:10px!important;line-height:1.8!important;color:#918063}.repair-location>span{display:block;margin-bottom:3px;color:#9c7852}.repair-location.ready>span{color:#73805c}
@media(max-width:650px){.quest-progress{padding:10px 0 0;display:flex;align-items:center;gap:12px}.quest-progress-track{flex:1;max-width:100px;margin:0}}
@media(max-width:420px){.repair-supplies{grid-template-columns:1fr}.quest-footer{flex-wrap:wrap}}.quest-layout{display:grid;grid-template-columns:205px 1fr;min-height:440px}.quest-index{padding:24px 16px;background:#191b2370;border-right:1px solid #81715533}.chapter-label{font-size:11px;color:#9b927f;letter-spacing:2px}.quest-entry{display:flex;gap:12px;align-items:center;margin-top:17px;padding:14px 12px;background:#b6975b17;border-left:2px solid #bd9b65}.quest-entry strong{font-size:14px;font-weight:normal}.quest-entry small{display:block;margin-top:7px;color:#9f927c;font-size:11px}.quest-marker{width:7px;height:7px;border:1px solid #c8a76b;transform:rotate(45deg)}
.quest-sheet{padding:26px 32px 24px;background:linear-gradient(110deg,#e3d5b9,#cbbc9c);color:#4b443a}.quest-heading{display:flex;justify-content:space-between;font-size:11px;color:#81715b;letter-spacing:1px}.quest-status{border:1px solid #a18b6455;padding:3px 8px;border-radius:2px}.quest-sheet h2{font-size:27px;font-weight:normal;letter-spacing:3px;margin:15px 0 9px}.quest-summary{margin:0 0 22px;color:#796b57;font-size:13px}.objectives{border-top:1px solid #8e785b33}.objective{display:flex;gap:16px;padding:17px 0;border-bottom:1px solid #8e785b29}.step-number{flex:none;width:25px;padding-top:3px;font-size:12px;color:#96794f}.objective>div{flex:1;min-width:0}.objective h3{font-size:14px;font-weight:normal;margin:0 0 8px}.complete h3{color:#79816a}.complete .step-number{color:#6a805b}.locked{opacity:.55}.requirements{display:flex;flex-wrap:wrap;gap:8px}.requirement{display:flex;align-items:center;gap:6px;padding:5px 8px;background:#5b48250a;border:1px solid #8f77542a;border-radius:3px;font-size:11px}.requirement b{font-weight:normal;margin-left:6px;color:#9b6451;white-space:nowrap}.requirement.ready b{color:#64764e}.quest-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:23px;font-size:11px;color:#81715b}.quest-action{padding:9px 20px;background:#665343;border:1px solid #4c3d31;color:#f0dfbc;font:inherit;font-size:13px;cursor:pointer;border-radius:3px}.quest-action:hover:enabled{background:#7b624b}
@media(max-width:650px){.quest-layout{grid-template-columns:1fr}.quest-index{padding:12px 20px;border-right:0;border-bottom:1px solid #81715533}.quest-entry{margin-top:8px;padding:8px 10px}.quest-entry small{display:none}.quest-sheet{padding:20px}}
.quest-layout{margin:0 9px 10px;border:1px solid #201b21;border-radius:0 0 3px 3px;overflow:hidden}
.quest-index{background:repeating-linear-gradient(30deg,#e4bc7b04 0 1px,transparent 1px 6px),linear-gradient(90deg,#352a28,#292329 93%,#17171e);border-right:0;box-shadow:inset 3px 0 8px #15131c66}
.quest-entry{position:relative;box-shadow:0 3px 5px #11111b40,inset 0 1px #dbc18e1f;border-radius:0 2px 2px 0}
.quest-sheet{position:relative;border-left:9px solid #877559;border-right:3px solid #a99572;border-bottom:4px double #ac9979;background:repeating-linear-gradient(0deg,transparent 0 3px,#70573505 3px 4px),radial-gradient(ellipse at 100% 0,#a1865830,transparent 55%),linear-gradient(100deg,#c8b493,#e4d7be 8%,#dfd0b0 90%,#cdbb99);box-shadow:inset 5px 0 9px #57432c28,inset -2px 0 #f4e5ca,inset 0 -2px #f1e2c2}
.quest-sheet::before{content:'';position:absolute;left:-8px;top:15px;bottom:15px;width:5px;pointer-events:none;background:repeating-linear-gradient(0deg,transparent 0 24px,#40382c 24px 27px,#dac7a5 27px 29px,transparent 29px 52px)}
.quest-status{transform:rotate(-3deg);border:1px solid #88715388;box-shadow:inset 0 0 0 2px #d8c8a8,inset 0 0 0 3px #88715344;color:#806549}
.quest-action{box-shadow:inset 0 1px #d3b18440,0 2px 2px #4f3a2726}.quest-action:active:enabled{box-shadow:inset 0 2px 4px #241b244d}
@media(max-width:650px){.quest-sheet{border-left-width:6px}.quest-sheet::before{left:-6px;width:4px}}
.quest-action:disabled{opacity:.45;cursor:default}
.quest-action:focus-visible{outline:2px solid #8b693f;outline-offset:3px}
</style>
