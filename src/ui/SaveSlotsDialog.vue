<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { saveService } from '../core/save/saveService'
import type { CharacterProfile, SaveProfile } from '../shared/profile'
import HudConfirm from './HudConfirm.vue'
import SaveRenameDialog from './SaveRenameDialog.vue'
import { currentLang, t } from '../i18n'

const props = withDefaults(defineProps<{ mode: 'save' | 'load'; theme?: 'game' | 'title' }>(), { theme: 'game' })
const emit = defineEmits<{ close: []; loaded: [profile: CharacterProfile] }>()
const panel = ref<HTMLElement | null>(null)
const slots = ref<Array<SaveProfile | null>>([null, null, null])
const autosave = ref<SaveProfile | null>(null)
const loading = ref(true), busy = ref(false), message = ref('')
const pending = ref<number | null>(null)
const renaming = ref<{ id: number; name: string } | null>(null)
const previousFocus = document.activeElement as HTMLElement | null
const entries = computed(() => [
  ...(props.mode === 'load' ? [{ id: 0, label: t('ui.records.autosave'), data: autosave.value }] : []),
  ...slots.value.map((data, index) => ({ id: index + 1, label: t('ui.records.slot', { n: String(index + 1).padStart(2, '0') }), data }))
])
function recordLabel(label: string, data: SaveProfile | null): string {
  return data?.meta.label ? t('ui.records.named_slot', { slot: label, name: data.meta.label }) : label
}
function openRename(id: number, data: SaveProfile | null): void {
  if (!data || busy.value || loading.value) return
  message.value = ''
  renaming.value = { id, name: data.meta.label ?? '' }
}
async function rename(name: string): Promise<void> {
  if (!renaming.value || busy.value) return
  busy.value = true; message.value = ''
  try {
    await saveService.renameSave(renaming.value.id, name)
    await refresh()
    renaming.value = null
    message.value = 'ui.records.renamed'
  } catch (error) { message.value = 'ui.records.error.rename'; console.error('[存档] 重命名失败', error) }
  finally { busy.value = false }
}
function identity(data: SaveProfile): string {
  return t('ui.records.identity', { name: data.character.name || t('ui.player.unnamed'), appearance: t(data.character.appearance === 'sister' ? 'ui.player.sister' : 'ui.player.brother') })
}
function savedTime(timestamp: number): string {
  try { return new Date(timestamp).toLocaleString(currentLang.value.replace(/_/g, '-')) }
  catch { return new Date(timestamp).toLocaleString() }
}
async function refresh(): Promise<void> {
  try { [slots.value, autosave.value] = await Promise.all([saveService.listSlots(), saveService.readAutosave()]) }
  catch (error) { message.value = 'ui.records.error.read'; console.error('[存档] 读取记录失败', error) }
  finally { loading.value = false }
}
function choose(id: number, data: SaveProfile | null): void {
  if (busy.value || loading.value || (props.mode === 'load' && !data)) return
  if (props.mode === 'load' || data) pending.value = id
  else void execute(id)
}
async function execute(id: number): Promise<void> {
  if (busy.value) return
  busy.value = true; message.value = ''
  try {
    if (props.mode === 'save') {
      await saveService.saveSlot(id)
      await refresh()
      pending.value = null
      message.value = 'ui.records.saved'
    } else {
      const profile = id === 0 ? await saveService.resumeAutosave() : await saveService.activateSlot(id)
      pending.value = null
      emit('loaded', profile)
    }
  } catch (error) { message.value = 'ui.records.error.operation'; console.error('[存档] 记录操作失败', error); pending.value = null }
  finally { busy.value = false }
}
function confirmPending(): void { if (pending.value !== null) void execute(pending.value) }
function close(): void { if (!busy.value && !renaming.value) emit('close') }
function onKey(event: KeyboardEvent): void {
  if (pending.value !== null || renaming.value) return
  event.stopImmediatePropagation()
  if (event.code === 'Escape') { event.preventDefault(); close() }
  if (event.code !== 'Tab') return
  const buttons = panel.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
  if (!buttons?.length) return
  const first = buttons[0], last = buttons[buttons.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
onMounted(async () => {
  window.addEventListener('keydown', onKey, true)
  await refresh(); await nextTick()
  panel.value?.querySelector<HTMLButtonElement>('button')?.focus()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey, true)
  if (previousFocus?.isConnected) previousFocus.focus()
})
</script>

<template>
  <div class="records-mask" :class="{ 'title-hud-mask': theme === 'title' }" @click.self="close">
    <section ref="panel" class="records-panel" :class="theme === 'title' ? 'title-hud-panel' : 'gpanel hud-panel'" role="dialog" aria-modal="true" aria-labelledby="records-title">
      <header><div><small>{{ t(theme === 'title' ? 'ui.title.records_caption' : 'ui.records.caption') }}</small><h2 id="records-title">{{ t(mode === 'save' ? 'ui.records.save_title' : 'ui.records.load_title') }}</h2></div><button class="records-close" :disabled="busy" :aria-label="t('ui.common.close')" @click="close">×</button></header>
      <div class="records-list">
        <div v-for="entry in entries" :key="entry.id" class="record-row">
        <button :class="[theme === 'title' ? 'title-record-sheet' : 'record-sheet', { empty: !entry.data }]" :disabled="loading || busy || (mode === 'load' && !entry.data)" @click="choose(entry.id, entry.data)">
          <span v-if="theme === 'game'" class="record-clip" aria-hidden="true"></span><span class="record-number">{{ recordLabel(entry.label, entry.data) }}</span>
          <template v-if="entry.data"><strong>{{ identity(entry.data) }}</strong><span>{{ t('ui.records.summary', { level: entry.data.combat.level, round: entry.data.round, depth: entry.data.deepestDepth }) }}</span><time>{{ savedTime(entry.data.meta.savedAt) }}</time><b class="record-stamp" :aria-hidden="theme === 'title'">{{ theme === 'title' ? '✦' : t('ui.records.stamp') }}</b></template>
          <template v-else><strong>{{ t(loading ? 'ui.records.loading' : 'ui.records.empty') }}</strong><span>{{ t(theme === 'title' ? 'ui.title.empty_record' : mode === 'save' ? 'ui.records.empty_save' : 'ui.records.empty_load') }}</span></template>
        </button>
        <button v-if="entry.data" class="record-rename" :disabled="busy || loading" :aria-label="t('ui.records.rename_slot', { slot: recordLabel(entry.label, entry.data) })" @click="openRename(entry.id, entry.data)">{{ t('ui.records.rename') }}</button>
        </div>
      </div>
      <footer><p role="status">{{ t(message || (mode === 'save' ? 'ui.records.save_note' : 'ui.records.load_note')) }}</p><button :class="theme === 'title' ? 'title-hud-action' : 'gbtn'" :disabled="busy" @click="close">{{ t('ui.common.back') }}</button></footer>
    </section>
    <HudConfirm v-if="pending !== null" :theme="theme" :title="t(mode === 'save' ? 'ui.records.confirm_save.title' : 'ui.records.confirm_load.title')" :message="t(mode === 'save' ? 'ui.records.confirm_save.message' : 'ui.records.confirm_load.message')" :confirm-label="t(mode === 'save' ? 'ui.records.save_action' : 'ui.records.load_action')" :busy="busy" @cancel="!busy && (pending = null)" @confirm="confirmPending"/>
    <SaveRenameDialog v-if="renaming" :name="renaming.name" :theme="theme" :busy="busy" :error="message === 'ui.records.error.rename' ? t(message) : ''" @cancel="!busy && (renaming = null)" @save="rename"/>
  </div>
</template>

<style scoped>
.record-row{position:relative;min-width:0}.record-row .record-sheet{width:100%}.record-number{display:block;padding-right:80px;overflow-wrap:anywhere}.record-rename{position:absolute;top:12px;right:14px;padding:4px 7px;border:0;border-radius:0;background:none;color:#806442;font:inherit;font-size:11px;cursor:pointer;z-index:1}.record-rename:hover:enabled{color:#523919;text-decoration:underline;text-underline-offset:3px}.record-rename:disabled{opacity:.5;cursor:default}.record-rename:focus-visible{outline:1px solid #9a7850;outline-offset:2px}
.records-mask{position:fixed;inset:0;z-index:1800;display:grid;place-items:center;padding:20px;background:#080a16bf;cursor:default}.records-panel{width:min(700px,100%);max-height:90dvh;display:flex;flex-direction:column;padding:24px;background:repeating-linear-gradient(2deg,transparent 0 24px,#d1b78505 25px,transparent 26px 50px),linear-gradient(135deg,#43353c,#282330);box-shadow:0 18px 60px #0008}
header{display:flex;align-items:center;justify-content:space-between;gap:20px;padding-bottom:20px;border-bottom:1px solid #bba27644}header small{font-size:10px;letter-spacing:3px;color:#ad967d}h2{font-size:25px;font-weight:400;letter-spacing:5px;margin-top:10px;color:#ead8b8}.records-close{border:0;background:none;font:inherit;font-size:30px;color:#c5af8c;cursor:pointer}.records-list{overflow:auto;min-height:0;display:grid;gap:18px;padding:20px 7px 10px}
.record-sheet{position:relative;flex:none;display:flex;flex-direction:column;gap:9px;min-height:122px;padding:17px 23px;text-align:left;border:1px solid #9b825f;border-left:5px solid #746345;background:repeating-linear-gradient(0deg,transparent 0 3px,#71593206 3px 4px),linear-gradient(105deg,#c1ad89,#e4d7b9 6%,#d5c19b);box-shadow:0 4px 9px #0004,inset 0 0 0 3px #f8e5b520;color:#766044;font:inherit;cursor:pointer;transition:transform .18s,filter .18s,box-shadow .18s}.record-sheet:hover:enabled,.record-sheet:focus-visible{transform:translateX(3px);filter:brightness(1.07);box-shadow:0 5px 16px #0005,inset 0 0 0 1px #ead08b;outline:1px solid #ead08b;outline-offset:2px}.record-sheet:disabled{opacity:.48;cursor:default}.record-sheet strong{font-weight:400;font-size:17px;color:#594832}.record-sheet>span:not(.record-clip){font-size:11px}.record-number{letter-spacing:2px;color:#968361}.record-sheet time{font-size:10px;color:#99815d}.record-sheet i{font-style:normal;margin:0 7px;color:#a68b60}.record-clip{position:absolute;top:-7px;right:25px;width:39px;height:11px;background:linear-gradient(#a78e63,#67563e);border:1px solid #594b36;box-shadow:0 2px 3px #46332b66}.record-stamp{position:absolute;right:24px;bottom:21px;padding:5px 8px;border:2px double #985d5466;font-size:22px;font-weight:400;color:#985d5466;transform:rotate(-9deg)}footer{display:flex;gap:18px;align-items:center;justify-content:space-between;padding-top:18px}footer p{color:#ac9a83;font-size:11px;line-height:1.8}button:focus-visible{outline:2px solid #e4c791;outline-offset:3px}@media(max-width:560px){.records-panel{padding:15px}.record-sheet{padding:15px}.record-stamp{right:15px}footer{align-items:flex-start}h2{font-size:21px}}
</style>
