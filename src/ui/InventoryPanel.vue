<script setup lang="ts">
/**
 * 东方符术背包：固定装备陈列与独立滚动的物品阵列。
 * 展示列数不参与槽位索引计算，容量增加时自然延展为新行。
 * 拿放、扫格与物品卡统一走共享交互层。
 */
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import type { ModuleActions } from '../shared/moduleActions'
import { ENABLED_SLOTS, EQUIP_SLOT_META, TRINKET_SLOTS } from '../shared/equipment'
import type { EquipSlot, ItemId } from '../shared/itemDefs'
import { t } from '../i18n'
import ItemIcon from './ItemIcon.vue'
import ItemTooltip from './ItemTooltip.vue'
import { useItemHover } from './useItemHover'
import { inventorySlots } from './inventorySlots'
import { inventoryMouse } from './inventoryMouse'
import { cancelPointerDrag } from './pointerDnd'
import type { CharacterProfile } from '../shared/profile'
import { ACTIVE_COMBAT_STATS, deriveCombat, expNeeded, spendPoint, type CombatStatKey } from '../shared/combat'
import { CONFIG } from '../game/config'

const props = defineProps<{ cave: ModuleActions; tick: number; profile: CharacterProfile }>()
const abilityOpen = ref(false)
const ability = computed(() => { void props.tick; void bump.value; return props.profile.combat })
const draft = ref<Partial<Record<CombatStatKey, number>>>({})
const pendingAction = ref<'bag' | 'close' | null>(null)
const draftCount = computed(() => Object.values(draft.value).reduce((sum, n) => sum + (n ?? 0), 0))
const remaining = computed(() => ability.value.unspentPoints - draftCount.value)
const derived = computed(() => deriveCombat(ability.value))
const preview = computed(() => deriveCombat({ ...ability.value, points: { ...ability.value.points, ...Object.fromEntries(ACTIVE_COMBAT_STATS.map(key => [key, ability.value.points[key] + (draft.value[key] ?? 0)])) } }))
const groups: Array<{ key: string; stats: CombatStatKey[] }> = [
  { key: 'survival', stats: ['vitality', 'spirit'] },
  { key: 'offense', stats: ['strength', 'haste', 'shooting'] },
  { key: 'defense', stats: ['agility', 'fortitude'] }
]
const summaryKeys = ['maxHp', 'maxMana', 'manaRegen', 'knockbackBonus', 'attackPower', 'moveSpeedMul', 'attackSpeedMul', 'physicalResist', 'magicResist', 'shootingDeviation', 'rangedCritChance'] as const
function summaryValue(key: typeof summaryKeys[number], value: number): string {
  if (key === 'moveSpeedMul' || key === 'attackSpeedMul') return `${Number(((value - 1) * 100).toFixed(2))}%`
  if (key === 'manaRegen') return t('ui.ability.regen_value', { n: Number(value.toFixed(2)) })
  if (key === 'physicalResist' || key === 'magicResist') return `${value} · ${(value / (100 + value) * 100).toFixed(1)}%`
  if (key === 'shootingDeviation') return `${Math.max(0, value)}°`
  if (key === 'rangedCritChance') return `${Number((value * 100).toFixed(1))}%`
  return String(value)
}
/** 已投入（含本次草案）是否到单项上限 */
function statTotal(key: CombatStatKey): number {
  return ability.value.points[key] + (draft.value[key] ?? 0)
}
function isCapped(key: CombatStatKey): boolean {
  return statTotal(key) >= CONFIG.statCap
}
function allocate(key: CombatStatKey, delta: number): void {
  if (pendingAction.value) return
  if (delta > 0 && (remaining.value < 1 || isCapped(key))) return
  if (delta < 0 && !(draft.value[key] ?? 0)) return
  draft.value = { ...draft.value, [key]: (draft.value[key] ?? 0) + delta }
}
function resetDraft(): void { draft.value = {} }
function commitDraft(): void {
  if (draftCount.value > ability.value.unspentPoints) return
  for (const key of ACTIVE_COMBAT_STATS) for (let n = 0; n < (draft.value[key] ?? 0); n++) spendPoint(props.profile.combat, key)
  resetDraft(); refresh(); emit('growth')
}
function navigate(action: 'bag' | 'close'): void {
  tip.value = null
  if (draftCount.value) { pendingAction.value = action; return }
  if (action === 'bag') abilityOpen.value = false
  else emit('close')
}
function resolvePending(confirm: boolean): void {
  const action = pendingAction.value
  if (confirm) commitDraft()
  else resetDraft()
  pendingAction.value = null
  if (action) navigate(action)
}
function openAbility(): void { mouse.cancel(); hover.hide(); abilityOpen.value = true }
function guardKeys(e: KeyboardEvent): void {
  if (e.code !== 'Escape') return
  e.preventDefault(); e.stopImmediatePropagation()
  if (e.repeat) return
  if (pendingAction.value) pendingAction.value = null
  else navigate('close')
}
const emit = defineEmits<{ close: []; growth: [] }>()

/** 本地刷新节拍（拖拽/使用后立即 +1，不等 10Hz） */
const bump = ref(0)
const refresh = (): void => {
  bump.value++
}

const slots = computed(() => {
  void props.tick
  void bump.value
  return props.cave.inventory.slots
})
const quickSlots = computed(() => {
  void props.tick
  void bump.value
  return props.cave.quickSlots.slots
})
/** 物品格保持固定尺寸，窄屏只调整可见列数，不改变数据顺序。 */
const bagViewport = ref<HTMLElement | null>(null)
const bagWidth = ref(0)
const invCols = computed(() => Math.max(1, Math.floor((bagWidth.value - 20 + 8) / 60)))
let bagResizeObserver: ResizeObserver | null = null
/** 已用格数（铭牌上的容量计数） */
const usedCount = computed(() => slots.value.filter((s) => s !== null).length)

/** 槽位显示名（语言键 → 文案） */
const eqLabelOf = (slot: EquipSlot): string =>
  t(EQUIP_SLOT_META.find((m) => m.slot === slot)?.key ?? '')

/**
 * 挂钉板布局（3 列 × 4 行；符卡/饰品在各自匣内，null=空位）
 * 装束槽（原头/身/腿三合一）压在人台胸甲正中；镐在左腿侧。
 */
const DOLL_LAYOUT: Array<EquipSlot | null> = [
  null, null, null,
  'weaponA', 'outfit', 'weaponB',
  null, null, null,
  'pick', null, null
]
/** 朱漆符匣 */
const SPELL_SLOTS: EquipSlot[] = ['spellA', 'spellB']

// —— 共享物品卡与 MC 鼠标交互 ————————————————————————
const hover = useItemHover()
const { tip, expanded, interactive } = hover
const access = inventorySlots(props.profile, props.cave)
const mouse = inventoryMouse({
  slots: access, containers: '.inv-panel, .hotbar', enabled: () => !abilityOpen.value,
  begin: hover.hide,
  changed: () => { refresh(); if (mouse.holding()) hover.hide(); else if (tip.value?.target) { const s = access.get(tip.value.target); if (!s) hover.hide(); else tip.value = { ...tip.value, id: s.id } } }
})
const tipAction = computed(() => { void bump.value; return tip.value?.target ? access.action(tip.value.target) : null })
function performTipAction(): void { if (tip.value?.target) mouse.act(tip.value.target) }
function showTip(e: MouseEvent, id: ItemId | null | undefined): void { if (!mouse.holding()) hover.show(e, id) }
function showEmptyTip(e: MouseEvent, text: string): void { if (!mouse.holding()) hover.show(e, null, text) }
function organizeBag(): void { mouse.cancel(); props.cave.inventory.organize(); hover.hide(); refresh() }
function organizeKey(e: KeyboardEvent): void {
  if (e.code !== 'KeyR' || e.repeat || e.ctrlKey || e.altKey || e.metaKey || abilityOpen.value) return
  e.preventDefault(); organizeBag()
}
function onMaskClick(e: MouseEvent): void { if (e.target === e.currentTarget) navigate('close') }
onMounted(() => {
  bagResizeObserver = new ResizeObserver(([entry]) => { if (entry) bagWidth.value = entry.contentRect.width })
  if (bagViewport.value) bagResizeObserver.observe(bagViewport.value)
  cancelPointerDrag(); mouse.mount()
  window.addEventListener('keydown', guardKeys, true)
  window.addEventListener('keydown', organizeKey)
})
onBeforeUnmount(() => {
  mouse.dispose(); bagResizeObserver?.disconnect()
  window.removeEventListener('keydown', guardKeys, true)
  window.removeEventListener('keydown', organizeKey)
})
</script>

<template>
  <div class="inv-mask hud-modal" @click="onMaskClick" @mousemove="hover.move">
    <!-- 出界丢弃提示（pointerDnd 给 body 加 .discarding 时显现） -->
    <div class="discard-hint">{{ t('ui.inv.discard') }}</div>

    <div class="inv-panel gpanel hud-panel gpanel-pop" :class="{ 'ability-mode': abilityOpen }" @click.stop>
      <!-- 箱盖铭牌 -->
      <div class="inv-head">
        <nav class="page-tabs" :aria-label="t('ui.ability.navigation')">
          <button :class="{ selected: !abilityOpen }" :aria-pressed="!abilityOpen" @click="navigate('bag')">{{ t('ui.inv.title') }}</button>
          <button :class="{ selected: abilityOpen }" :aria-pressed="abilityOpen" @click="openAbility">{{ t('ui.combat.title') }}<span v-if="ability.unspentPoints" class="point-badge">{{ ability.unspentPoints }}</span></button>
        </nav>
        <span v-if="!abilityOpen" class="capacity">{{ t('ui.inv.capacity', { used: usedCount, total: slots.length }) }}</span>
        <button v-if="!abilityOpen" class="organize-btn" @click="organizeBag">{{ t('ui.item.organize') }}</button>
        <button class="lock-nail" :title="t('ui.common.close_esc')" @click="navigate('close')" :aria-label="t('ui.inv.close_aria')">
          <span class="lock-ring"></span><span class="lock-keyhole"></span>
        </button>
      </div>

      <section v-if="abilityOpen" class="ability-sheet">
        <div class="ability-columns">
          <aside class="growth-record">
            <span class="record-seal" aria-hidden="true">录</span>
            <span class="record-caption">{{ t('ui.ability.record') }}</span>
            <h2>{{ t('ui.ability.level', { n: ability.level }) }}</h2>
            <div class="record-exp"><i :style="{ width: `${Math.min(1, ability.exp / expNeeded(ability.level)) * 100}%` }"></i></div>
            <p class="experience-count">{{ ability.exp }} / {{ expNeeded(ability.level) }}</p>
            <div class="available-points"><span>{{ t('ui.ability.available') }}</span><strong>{{ remaining }}</strong></div>
            <h3>{{ t('ui.ability.preview') }}</h3>
            <dl class="stat-preview"><div v-for="key in summaryKeys" :key="key"><dt>{{ t(`ui.ability.stat.${key}`) }}</dt><dd>{{ summaryValue(key, derived[key]) }}<span v-if="preview[key] !== derived[key]" class="changed"> → {{ summaryValue(key, preview[key]) }}</span></dd></div></dl>
            <p class="power-note">{{ t('ui.ability.power_note') }}</p>
          </aside>
          <div class="allocation-list">
            <section v-for="group in groups" :key="group.key" class="ability-group">
              <h3>{{ t(`ui.ability.group.${group.key}`) }}</h3>
              <div v-for="key in group.stats" :key="key" class="ability-row" :class="{ invested: draft[key] }">
                <span class="ability-name">{{ t(`ui.combat.${key}`) }}<small v-if="!isCapped(key)">{{ t(`ui.combat.${key}.gain`) }}</small><small v-else class="capped-note">{{ t('ui.ability.capped') }}</small></span>
                <span class="allocated-count">{{ statTotal(key) }}<i>/{{ CONFIG.statCap }}</i></span>
                <button :disabled="!draft[key] || !!pendingAction" :aria-label="t('ui.ability.subtract',{name:t(`ui.combat.${key}`)})" @click="allocate(key,-1)">−</button>
                <button :disabled="isCapped(key) || remaining < 1 || !!pendingAction" :aria-label="t('ui.ability.add',{name:t(`ui.combat.${key}`)})" @click="allocate(key,1)">＋</button>
              </div>
            </section>
          </div>
        </div>
        <footer class="allocation-actions"><span>{{ t('ui.ability.confirm_note') }}</span><button :disabled="!draftCount || !!pendingAction" @click="resetDraft">{{ t('ui.ability.reset') }}</button><button class="confirm-allocation" :disabled="!draftCount || !!pendingAction" @click="commitDraft">{{ t('ui.ability.confirm') }}</button></footer>
        <div v-if="pendingAction" class="pending-allocation" role="alert"><p>{{ t('ui.ability.pending') }}</p><div><button class="confirm-allocation" @click="resolvePending(true)">{{ t('ui.ability.confirm_continue') }}</button><button @click="resolvePending(false)">{{ t('ui.ability.discard') }}</button><button @click="pendingAction=null">{{ t('ui.ability.keep') }}</button></div></div>
      </section>
      <div v-show="!abilityOpen" class="inv-body">
        <!-- 左：挂钉板 + 符匣 + 随身道具 -->
        <div class="rack-col">
          <div class="section-tag">{{ t('ui.inv.rack') }}</div>
          <div class="doll-stage board">
            <!-- 断开的符术结构只连接装备位置，不覆盖物品。 -->
            <svg class="rack-sigil" viewBox="0 0 300 250" fill="none" aria-hidden="true">
              <g stroke="currentColor" stroke-width="1">
                <path d="M150 16 257 125 150 234 43 125Z M150 35 239 125 150 215 61 125Z" />
                <path d="M73 47A110 110 0 0 1 241 77 M256 147A110 110 0 0 1 119 231 M62 191A110 110 0 0 1 44 91" />
                <path d="M150 5V40 M150 210V245 M17 125H53 M247 125H283 M93 125H207 M150 62V188" />
                <path d="M137 23H163 M137 227H163 M31 112V138 M269 112V138" />
                <circle cx="150" cy="125" r="45" stroke-dasharray="45 15 8 12" />
              </g>
              <g fill="currentColor"><path d="m150 11 4 5-4 5-4-5Z M267 121l4 4-4 4-4-4Z M29 121l4 4-4 4-4-4Z" /></g>
            </svg>
            <!-- 盔甲架铜牌浮雕（挂在钉板上的人台：挂环→圆盔→肩甲→胸甲→裙甲→双腿，
                 槽位半透明叠在对应部位，空槽时人台可见，有装备时装备穿上身） -->
            <svg class="doll-figure" viewBox="0 0 174 210" aria-hidden="true">
              <!-- 顶部挂环（挂在钉板铜钉上） -->
              <circle cx="88" cy="9" r="4.6" fill="none" stroke="#8a6834" stroke-width="2.4" />
              <circle cx="88" cy="9" r="1.8" fill="#c9973f" />
              <path d="M84 13 L83 19 M92 13 L93 19" stroke="#241608" stroke-width="2.4" stroke-linecap="round" />
              <!-- 头盔（圆盔 + 盔脊 + 面甲缝 + 颊甲） -->
              <circle cx="88" cy="29" r="15" fill="#1c120a" />
              <circle cx="88" cy="28.4" r="13.4" fill="#3a2a18" />
              <path d="M77 23 A12 12 0 0 0 76 33" stroke="#6a4d28" stroke-width="2.4" fill="none" stroke-linecap="round" />
              <path d="M88 15 L88 24" stroke="#5a4020" stroke-width="3.4" stroke-linecap="round" />
              <rect x="78.5" y="29.6" width="19" height="2.8" rx="1" fill="#160d06" />
              <path d="M79 35 Q88 38.4 97 35" stroke="#160d06" stroke-width="2" fill="none" />
              <!-- 颈甲围脖 -->
              <path d="M79 42 L97 42 L100 49 L76 49 Z" fill="#25190d" stroke="#1c120a" stroke-width="1.4" />
              <!-- 领口暗三角 -->
              <path d="M66 50 L110 50 L88 62 Z" fill="#1c120a" />
              <!-- 左肩甲（大圆肩 + 受光弧 + 肩钉） -->
              <ellipse cx="42" cy="63" rx="16" ry="12" fill="#1c120a" />
              <ellipse cx="42" cy="62" rx="14.4" ry="10.6" fill="#332414" />
              <path d="M31 57 A13 9 0 0 1 45 52.5" stroke="#6a4d28" stroke-width="2.2" fill="none" stroke-linecap="round" />
              <path d="M33 66 Q42 70.4 52 66" stroke="#1c120a" stroke-width="1.6" fill="none" />
              <circle cx="33" cy="59" r="1.7" fill="#8a6834" />
              <!-- 右肩甲 -->
              <ellipse cx="132" cy="63" rx="16" ry="12" fill="#1c120a" />
              <ellipse cx="132" cy="62" rx="14.4" ry="10.6" fill="#332414" />
              <path d="M121 57 A13 9 0 0 1 135 52.5" stroke="#6a4d28" stroke-width="2.2" fill="none" stroke-linecap="round" />
              <path d="M122 66 Q132 70.4 141 66" stroke="#1c120a" stroke-width="1.6" fill="none" />
              <circle cx="141" cy="59" r="1.7" fill="#8a6834" />
              <!-- 胸甲主体（ink 衬底 + 主色 + 左受光/右暗分面） -->
              <path d="M58 50 Q88 44 118 50 L123 102 Q123 113 112 115 L64 115 Q53 113 53 102 Z" fill="#1c120a" />
              <path d="M60 51.4 Q88 46 116 51.4 L120.4 102 Q120.4 111 111 112.4 L65 112.4 Q56 111 56 102 Z" fill="#3a2a18" />
              <path d="M60 51.4 Q76 48 84 49 L80 112 L65 112.4 Q56 111 56 102 Z" fill="#4a351d" />
              <path d="M104 49 Q112 50 116 51.4 L120.4 102 Q120.4 111 111 112.4 L96 112 Z" fill="#281b0f" />
              <!-- 中央脊板 + 高光阴 -->
              <path d="M85 50 L91 50 L90 112 L84 112 Z" fill="#241810" />
              <path d="M85 50 L86.8 50 L85.8 112 L84 112 Z" fill="#634625" />
              <!-- 胸甲横板线 / 领口受光 -->
              <path d="M63 74 L113 74" stroke="#1c120a" stroke-width="1.8" />
              <path d="M64 89 L112 89" stroke="rgba(0,0,0,0.28)" stroke-width="1.2" />
              <path d="M68 50.4 Q88 46 108 50.4" stroke="#6a4d28" stroke-width="1.6" fill="none" />
              <!-- 双臂（垂入两侧武器槽方向，手藏进挂载槽） -->
              <path d="M44 67 L56 70.5 L54 98 L42 95 Z" fill="#2e2013" stroke="#1c120a" stroke-width="1.6" />
              <path d="M130 67 L118 70.5 L120 98 L132 95 Z" fill="#2e2013" stroke="#1c120a" stroke-width="1.6" />
              <!-- 腰带 + 铜带扣 -->
              <rect x="60" y="111" width="58" height="6.4" fill="#5a3f22" stroke="#1c120a" stroke-width="1" />
              <rect x="82.6" y="110" width="10.8" height="8.4" fill="#8a6834" stroke="#1c120a" stroke-width="1.2" />
              <rect x="84.6" y="112" width="6.8" height="4.4" fill="none" stroke="#3a2a12" stroke-width="1" />
              <!-- 裙甲（竖条甲片） -->
              <path d="M62 116 L114 116 L111 132 L65 132 Z" fill="#1c120a" />
              <path d="M64 117 L112 117 L109.4 130 L66.6 130 Z" fill="#2e2013" />
              <path d="M76 118 L75 129 M88 118 L88 129 M100 118 L101 129" stroke="rgba(0,0,0,0.32)" stroke-width="1.4" />
              <!-- 左腿（ink 衬底 → 主色 → 受光/暗面 → 束甲带 → 靴） -->
              <path d="M68 129 L86 129 L88 197 L69 197 Z" fill="#1c120a" />
              <path d="M70 130.4 L84 130.4 L85.6 195 L71 195 Z" fill="#332414" />
              <path d="M70 130.4 L74.4 130.4 L73.8 195 L71 195 Z" fill="#4a351d" />
              <path d="M80.6 130.4 L84 130.4 L85.6 195 L82.4 195 Z" fill="#23170c" />
              <rect x="70.4" y="158" width="15" height="4.4" fill="#1c120a" />
              <path d="M68 195 L89 195 L91 204 L68 204 Z" fill="#1c120a" />
              <path d="M70 197 L87 197" stroke="#3a2a18" stroke-width="1.4" />
              <!-- 右腿 -->
              <path d="M88 129 L106 129 L105 197 L86 197 Z" fill="#1c120a" />
              <path d="M90 130.4 L104 130.4 L103 195 L88.4 195 Z" fill="#332414" />
              <path d="M90 130.4 L94.4 130.4 L93.8 195 L91 195 Z" fill="#4a351d" />
              <path d="M100.6 130.4 L104 130.4 L103 195 L99.8 195 Z" fill="#23170c" />
              <rect x="88.6" y="158" width="15" height="4.4" fill="#1c120a" />
              <path d="M85 195 L106 195 L106 204 L83 204 Z" fill="#1c120a" />
              <path d="M87 197 L104 197" stroke="#3a2a18" stroke-width="1.4" />
            </svg>

            <div class="doll-grid">
              <template v-for="(slot, i) in DOLL_LAYOUT" :key="i">
                <div v-if="!slot" class="doll-blank" />
                <div
                  v-else
                  class="gequip eqcell peg"
                  :class="{ enabled: ENABLED_SLOTS.has(slot), disabled: !ENABLED_SLOTS.has(slot) }"
                  :data-drop="`eq:${slot}`"
                  @mouseenter="(e) => {
                    if (cave.equipment.get(slot)) showTip(e, cave.equipment.get(slot))
                    else showEmptyTip(e, t('ui.inv.slot_tip', { slot: eqLabelOf(slot) }))
                  }"
                  @mouseleave="hover.leave"
                >
                  <ItemIcon v-if="cave.equipment.get(slot)" :id="cave.equipment.get(slot)" :size="32" />
                  <span v-else class="eqlabel">{{ eqLabelOf(slot) }}</span>
                </div>
              </template>
            </div>
          </div>

          <div class="section-tag spell">{{ t('ui.inv.spellcase') }}</div>
          <div class="spell-row">
            <div
              v-for="slot in SPELL_SLOTS"
              :key="slot"
              class="gequip eqcell spellcase"
              :class="{ enabled: ENABLED_SLOTS.has(slot) }"
              :data-drop="`eq:${slot}`"
              @mouseenter="(e) => {
                if (cave.equipment.get(slot)) showTip(e, cave.equipment.get(slot))
                else showEmptyTip(e, t('ui.inv.spell_slot_tip'))
              }"
              @mouseleave="hover.leave"
            >
              <ItemIcon v-if="cave.equipment.get(slot)" :id="cave.equipment.get(slot)" :size="34" />
              <span v-else class="eqlabel">{{ t('ui.inv.ghost_spell') }}</span>
            </div>
          </div>

          <div class="section-tag trinket">{{ t('ui.inv.trinketcase') }}</div>
          <div class="trinket-row">
            <div
              v-for="slot in TRINKET_SLOTS"
              :key="slot"
              class="gequip eqcell trinketcase"
              :class="{ enabled: ENABLED_SLOTS.has(slot) }"
              :data-drop="`eq:${slot}`"
              @mouseenter="(e) => {
                if (cave.equipment.get(slot)) showTip(e, cave.equipment.get(slot))
                else showEmptyTip(e, t('ui.inv.slot_tip', { slot: eqLabelOf(slot) }))
              }"
              @mouseleave="hover.leave"
            >
              <ItemIcon v-if="cave.equipment.get(slot)" :id="cave.equipment.get(slot)" :size="30" />
              <span v-else class="eqlabel">{{ eqLabelOf(slot) }}</span>
            </div>
          </div>

          <div class="section-tag">{{ t('ui.inv.quick_section') }}</div>
          <div class="quick-row">
            <div
              v-for="(s, i) in quickSlots"
              :key="i"
              class="gslot qcell velvet"
              :data-drop="`quick:${i}`"
              @mouseenter="(e) => (s ? showTip(e, s.id) : showEmptyTip(e, t('ui.inv.quick_slot_tip')))"
              @mouseleave="hover.leave"
            >
              <span class="keyhint">{{ i + 4 }}</span>
              <ItemIcon v-if="s" :id="s.id" :size="34" />
              <span v-if="s && s.qty > 1" class="qty brass-qty">{{ s.qty }}</span>
            </div>
          </div>
        </div>

        <!-- 右：天鹅绒矿料囊 -->
        <div class="bag-side">
          <div class="section-tag bag">
            <span>{{ t('ui.inv.bag') }}</span>
            <span class="bag-hint">{{ t('ui.inv.bag_hint') }}</span>
          </div>
          <div ref="bagViewport" class="bag-viewport" @scroll="hover.hide">
          <div class="grid" :style="{ gridTemplateColumns: `repeat(${invCols}, 52px)` }">
            <div
              v-for="(s, i) in slots"
              :key="i"
              class="gslot invcell velvet"
              :data-drop="`inv:${i}`"
              @mouseenter="(e) => showTip(e, s?.id)"
              @mouseleave="hover.leave"
            >
              <ItemIcon v-if="s" :id="s.id" :size="36" />
              <span v-if="s && s.qty > 1" class="qty brass-qty">{{ s.qty }}</span>
            </div>
          </div>
          </div>
        </div>
      </div>

      <div v-show="!abilityOpen" class="inv-foot">
        {{ t('ui.inv.foot') }}
      </div>
    </div>

    <ItemTooltip :hover="tip" :expanded="expanded" :interactive="interactive" :profile="profile" :tick="tick + bump" :action="tipAction" @enter="hover.enterCard" @leave="hover.leaveCard" @action="performTipAction"/>

  </div>
</template>

<style scoped>
.inv-mask {
  position: absolute;
  inset: 0;
  background: rgba(8, 5, 2, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
  cursor: default;
}
/* —— 墨青结界陈列框：厚边、内衬与局部旧金受光 —— */
.inv-panel {
  --text-dim: #87978f;
  --text: #e4ddc8;
  --brass: #b8a277;
  position: relative;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: min(1180px, calc(100vw - 48px));
  height: min(780px, calc(100vh - 48px));
  padding: 26px 30px 18px;
  border: 7px solid #111b1b;
  border-image: none;
  border-radius: 4px;
  background:
    radial-gradient(ellipse at 12% 10%, #a8bc9b12, transparent 48%),
    radial-gradient(ellipse at 93% 88%, #ab733d0c, transparent 50%),
    repeating-linear-gradient(0deg, #d7dcc803 0 1px, transparent 1px 5px),
    linear-gradient(125deg, #263635, #172524 60%, #1c2928);
  box-shadow: 0 28px 90px #000b, 0 0 0 1px #847356,
    inset 0 0 0 1px #ad987a66, inset 0 0 0 5px #0d171744,
    inset 0 2px 4px #c5caaa20;
}
.inv-panel::before {
  content: '';
  position: absolute;
  inset: 10px;
  border: 1px solid #ab98712b;
  pointer-events: none;
}
.inv-panel::after {
  content: '';
  position: absolute;
  right: 17px;
  bottom: 15px;
  width: 22px;
  height: 22px;
  border: 1px solid #a5564380;
  background: linear-gradient(90deg, transparent 45%, #a556433b 45% 52%, transparent 52%),
    linear-gradient(0deg, transparent 45%, #a556433b 45% 52%, transparent 52%);
  transform: rotate(-6deg);
  pointer-events: none;
}
.inv-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 13px;
  padding-bottom: 9px;
  border-bottom: 1px solid rgba(168, 124, 68, 0.35);
  position: relative;
}
.inv-head::after {
  /* 铭牌下沿双线（手作箱盖的压边） */
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -3px;
  height: 1px;
  background: rgba(0, 0, 0, 0.4);
}
.title {
  font-size: 24px;
}
.capacity {
  font-size: 11px;
  letter-spacing: 2px;
  color: var(--text-dim);
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}
/* 铜锁扣关闭钮 */
.lock-nail {
  position: relative;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid #2a1a0a;
  background: radial-gradient(circle at 35% 30%, var(--brass-hi), var(--brass) 55%, #6e4f1d);
  cursor: pointer;
  box-shadow: 0 2px 0 #241608, inset 0 0 0 1px rgba(255, 240, 200, 0.35);
  padding: 0;
}
.lock-nail:active {
  transform: translateY(1px);
}
.lock-ring {
  position: absolute;
  inset: 7px;
  border-radius: 50%;
  border: 1px solid rgba(58, 36, 16, 0.55);
}
.lock-keyhole {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 4px;
  height: 9px;
  margin: -4.5px 0 0 -2px;
  border-radius: 2px 2px 1px 1px;
  background: #3a2410;
}
.lock-keyhole::before {
  content: '';
  position: absolute;
  left: 50%;
  top: -3px;
  width: 6px;
  height: 6px;
  margin-left: -3px;
  border-radius: 50%;
  background: #3a2410;
}

.inv-body {
  display: flex;
  gap: 24px;
}

/* —— 左列：挂架/符匣/道具 —— */
.rack-col {
  width: 182px;
  flex: none;
  display: flex;
  flex-direction: column;
}
/* 烫金皮牌分区标：两侧拉出金线 */
.section-tag {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 2px 2px 7px;
  font-family: var(--font-sign);
  font-size: 12px;
  letter-spacing: 3px;
  color: var(--brass);
}
.section-tag::before,
.section-tag::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, rgba(201, 151, 63, 0.5), rgba(201, 151, 63, 0.05));
}
.section-tag::after {
  background: linear-gradient(90deg, rgba(201, 151, 63, 0.05), rgba(201, 151, 63, 0.5));
}
.section-tag.spell {
  color: #d8705e;
  margin-top: 12px;
}
.section-tag.spell::before,
.section-tag.spell::after {
  background: linear-gradient(90deg, rgba(200, 90, 70, 0.45), rgba(200, 90, 70, 0.05));
}
.section-tag.spell::after {
  background: linear-gradient(90deg, rgba(200, 90, 70, 0.05), rgba(200, 90, 70, 0.45));
}
.section-tag.bag {
  margin-top: 0;
}
.bag-hint {
  font-family: var(--font-body);
  font-size: 9px;
  letter-spacing: 1px;
  color: var(--text-dim);
  white-space: nowrap;
}

/* —— 黄铜挂钉板（做旧木板底） —— */
.doll-stage {
  position: relative;
  width: 182px;
  height: 214px;
}
.doll-stage.board {
  border: 1px solid #241505;
  border-radius: 2px;
  background:
    repeating-linear-gradient(92deg, rgba(0, 0, 0, 0.16) 0 2px, transparent 2px 30px),
    repeating-linear-gradient(90deg, rgba(255, 214, 150, 0.03) 0 1px, transparent 1px 64px),
    linear-gradient(165deg, #4a3119, #33210f 70%, #2b1b0c);
  box-shadow:
    inset 0 2px 5px rgba(0, 0, 0, 0.55),
    inset 0 0 0 1px rgba(201, 151, 63, 0.2);
}
/* 四角铜包片 */
.doll-stage.board::before,
.doll-stage.board::after {
  content: '';
  position: absolute;
  width: 9px;
  height: 9px;
  background: linear-gradient(135deg, #e0b65c, #8a6324);
  border: 1px solid #5a4015;
  z-index: 2;
}
.doll-stage.board::before {
  top: 3px;
  left: 3px;
  box-shadow: 163px 0 0 -0px transparent;
}
.doll-stage.board::after {
  bottom: 3px;
  right: 3px;
}
.doll-figure {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  opacity: 0.85;
}
.doll-grid {
  position: absolute;
  inset: 0;
  display: grid;
  /* 列宽 52：3×52+2×5+左右各 5 内边距 = 176，收进 182 挂板（旧版 56 列溢出 8px） */
  grid-template-columns: repeat(3, 52px);
  grid-template-rows: repeat(4, 47px);
  gap: 5px;
  padding: 3px 5px;
  box-sizing: border-box;
}
.doll-blank {
  pointer-events: none;
}

/* 挂钉座槽位：深色皮垫 + 顶悬黄铜钉 */
.eqcell.peg {
  width: 52px;
  height: 47px;
  border: 1px solid rgba(20, 11, 4, 0.9);
  border-radius: 2px;
  background:
    radial-gradient(circle at 50% 12%, rgba(201, 151, 63, 0.18), transparent 60%),
    linear-gradient(160deg, rgba(0, 0, 0, 0.28), rgba(0, 0, 0, 0.5));
  box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.6);
  cursor: default;
}
.eqcell.peg.enabled {
  cursor: grab;
}
.eqcell.peg.enabled::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 50%;
  width: 5px;
  height: 5px;
  margin-left: -2.5px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #f0d28a, #a87c34 70%, #6e4f1d);
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.7);
}
.eqcell.peg.enabled:hover {
  box-shadow:
    inset 0 2px 5px rgba(0, 0, 0, 0.5),
    inset 0 0 0 1px rgba(240, 205, 126, 0.55);
}
.eqcell.peg.disabled {
  opacity: 0.32;
}
.eqcell .eqlabel {
  position: absolute;
  bottom: 2px;
  font-size: 9px;
  letter-spacing: 1px;
  color: rgba(201, 180, 142, 0.5);
  pointer-events: none;
}

/* —— 朱漆符匣 —— */
.spell-row {
  display: flex;
  gap: 8px;
  justify-content: center;
}
.eqcell.spellcase {
  width: 54px;
  height: 52px;
  border: 1px solid #2a1208;
  border-radius: 2px;
  background:
    repeating-linear-gradient(100deg, rgba(0, 0, 0, 0.1) 0 2px, transparent 2px 5px),
    linear-gradient(160deg, #572a20, #371810);
  box-shadow:
    inset 0 0 0 1px rgba(192, 68, 56, 0.5),
    inset 0 2px 5px rgba(0, 0, 0, 0.5);
  cursor: default;
}
.eqcell.spellcase.enabled {
  cursor: grab;
}
.eqcell.spellcase.enabled:hover {
  box-shadow:
    inset 0 0 0 1px rgba(232, 130, 100, 0.7),
    inset 0 2px 5px rgba(0, 0, 0, 0.45);
}

/* —— 紫绒饰匣（饰品 A~D 四槽，配色区别于朱漆符匣） —— */
.section-tag.trinket {
  color: #b79cf0;
  margin-top: 12px;
}
.section-tag.trinket::before,
.section-tag.trinket::after {
  background: linear-gradient(90deg, rgba(160, 120, 230, 0.45), rgba(160, 120, 230, 0.05));
}
.section-tag.trinket::after {
  background: linear-gradient(90deg, rgba(160, 120, 230, 0.05), rgba(160, 120, 230, 0.45));
}
.trinket-row {
  display: flex;
  gap: 6px;
  justify-content: center;
}
.eqcell.trinketcase {
  position: relative;
  width: 40px;
  height: 48px;
  border: 1px solid #1f1738;
  border-radius: 2px;
  background:
    repeating-linear-gradient(100deg, rgba(0, 0, 0, 0.12) 0 2px, transparent 2px 5px),
    linear-gradient(160deg, #3d3160, #221a3d);
  box-shadow:
    inset 0 0 0 1px rgba(170, 130, 240, 0.4),
    inset 0 2px 5px rgba(0, 0, 0, 0.5);
  cursor: default;
}
.eqcell.trinketcase.enabled {
  cursor: grab;
}
.eqcell.trinketcase.enabled:hover {
  box-shadow:
    inset 0 0 0 1px rgba(200, 170, 255, 0.7),
    inset 0 2px 5px rgba(0, 0, 0, 0.45);
}

/* —— 随身道具 —— */
.quick-row {
  display: flex;
  gap: 7px;
  justify-content: center;
}
.qcell {
  width: 54px;
  height: 54px;
}

/* —— 天鹅绒凹槽（矿料囊/道具槽通用） —— */
.velvet {
  border-radius: 2px;
  border: 1px solid #120a05;
  background:
    repeating-linear-gradient(115deg, rgba(255, 235, 200, 0.02) 0 1px, transparent 1px 3px),
    radial-gradient(circle at 38% 26%, rgba(255, 230, 190, 0.05), transparent 62%),
    linear-gradient(160deg, #2b1e16, #19100b);
  box-shadow:
    inset 0 3px 7px rgba(0, 0, 0, 0.72),
    inset 0 0 0 1px rgba(201, 151, 63, 0.13);
  cursor: default;
}
.velvet:has(.item-icon) {
  cursor: grab;
}
/* 物品接触软影 + hover 浮起（拟物的"物件躺在绒面上"） */
.velvet .item-icon,
.peg .item-icon,
.spellcase .item-icon {
  transition: transform 0.1s ease-out;
  filter: drop-shadow(0 3px 2px rgba(0, 0, 0, 0.6));
}
.velvet:hover .item-icon,
.peg.enabled:hover .item-icon,
.spellcase.enabled:hover .item-icon {
  transform: translateY(-2px) scale(1.06);
}

/* —— 右：矿料囊 —— */
.bag-side {
  flex: 1;
}
.grid {
  display: grid;
  /* 44px 格：10×44+9×4+内边距 20 = 496，收进右列 510（旧版 48 格溢出面板 39px） */
  gap: 4px;
  padding: 8px 10px;
  border: 1px solid rgba(20, 11, 4, 0.8);
  border-radius: 2px;
  background:
    repeating-linear-gradient(91deg, rgba(0, 0, 0, 0.14) 0 1px, transparent 1px 40px),
    linear-gradient(165deg, #3a2712, #27190b 75%);
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.55), inset 0 0 0 1px rgba(201, 151, 63, 0.14);
  width: fit-content;
}
.invcell {
  width: 44px;
  height: 44px;
}

/* 铜质圆数量牌 */
.brass-qty {
  right: 1px;
  bottom: 1px;
  min-width: 15px;
  height: 15px;
  line-height: 15px;
  padding: 0 3px;
  box-sizing: border-box;
  text-align: center;
  border-radius: 8px;
  background: radial-gradient(circle at 35% 30%, #f2d48c, #b5863b 62%, #6e4f1d);
  border: 1px solid #5a3f18;
  color: #2a1a08;
  font-size: 10px;
  text-shadow: none;
}

.inv-foot {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid rgba(0, 0, 0, 0.35);
  font-size: 11px;
  color: var(--text-dim);
  letter-spacing: 1px;
  text-align: center;
}

/* 装备陈列保持固定，只有右侧物品阵列随容量纵向滚动。 */
.inv-mask { background: #040b0bb0; }
.inv-head { flex: none; margin-bottom: 24px; padding-bottom: 15px; border-color: #b8a27740; }
.inv-body { flex: 1; min-height: 0; gap: 32px; }
.rack-col { width: 300px; min-height: 0; padding-right: 28px; border-right: 1px solid #b8a27730; box-sizing: content-box; }
.section-tag { flex: none; font-size: 13px; margin: 0 0 9px; letter-spacing: 4px; color: #c3b28f; }
.section-tag::before { flex: 0 0 12px; }
.section-tag::after { background: linear-gradient(90deg, #b8a27755, transparent); }
.section-tag.spell, .section-tag.trinket { margin-top: 16px; }
.section-tag.spell { color: #c59880; }
.section-tag.trinket { color: #9eafac; }
.section-tag.trinket::before, .section-tag.trinket::after { background: linear-gradient(90deg, #9eafac40, transparent); }
.doll-stage.board { width: 100%; height: auto; flex: 1; min-height: 195px; max-height: 285px; border: 0; border-radius: 0; background: radial-gradient(ellipse, #89a8990e, transparent 72%); box-shadow: none; }
.doll-stage.board::before, .doll-stage.board::after { display: none; }
.rack-sigil { position: absolute; inset: 0; width: 100%; height: 100%; color: #baa579; opacity: .21; pointer-events: none; }
.doll-figure { inset: 4% 25%; width: 50%; height: 92%; opacity: .32; filter: grayscale(1) sepia(.25) brightness(1.8); }
.doll-grid { grid-template-columns: repeat(3, 64px); grid-template-rows: repeat(4, 1fr); justify-content: space-between; gap: 0; padding: 10px 12px; align-items: center; }
.eqcell.peg { width: 64px; height: 58px; }
.eqcell.peg, .eqcell.spellcase, .eqcell.trinketcase, .velvet {
  box-sizing: border-box;
  border: 1px solid #8e9e8b30;
  border-radius: 2px;
  background: radial-gradient(ellipse at 40% 0, #aec4b40b, transparent 70%), linear-gradient(145deg, #172423, #101b1b);
  box-shadow: inset 0 3px 8px #0005, 0 1px 0 #d2d9bc0e;
  transition: border-color .16s, box-shadow .16s, background .16s;
}
.eqcell.peg.enabled::before { left: 5px; top: 5px; margin: 0; width: 7px; height: 7px; border-radius: 0; border-top: 1px solid #b8a27799; border-left: 1px solid #b8a27799; background: none; box-shadow: none; }
.eqcell:has(.item-icon) { border-color: #b8a27770; background: radial-gradient(ellipse at 50% 0, #b8a27715, transparent 75%), #142120; }
.eqcell:has(.item-icon)::after { content: ''; position: absolute; bottom: 4px; right: 4px; width: 5px; height: 5px; border-right: 1px solid #b76d56; border-bottom: 1px solid #b76d56; pointer-events: none; }
.eqcell.peg.enabled:hover, .eqcell.spellcase.enabled:hover, .eqcell.trinketcase.enabled:hover, .velvet:hover {
  border-color: #c6b68c99;
  box-shadow: inset 0 0 12px #d4be8610, 0 0 9px #d4be860b;
}
.eqcell .eqlabel { bottom: 4px; color: #a8b4a480; font-size: 10px; }
.spell-row, .trinket-row, .quick-row { flex: none; gap: 12px; justify-content: flex-start; margin-bottom: 3px; }
.eqcell.spellcase { width: 88px; height: 62px; border-top-color: #a56c5655; }
.eqcell.trinketcase { width: 64px; height: 56px; border-top-color: #94aaa055; }
.quick-row { margin-top: 2px; }
.quick-row .qcell { width: 64px; height: 60px; }
.quick-row + .section-tag { margin-top: 16px; }
.trinket-row + .section-tag { margin-top: 16px; }
.bag-side { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.section-tag.bag { gap: 14px; margin-bottom: 14px; }
.bag-hint { font-size: 11px; letter-spacing: 0; white-space: normal; }
.bag-viewport {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: #8c927366 #0d181855;
  border: 1px solid #a6b8a223;
  background: radial-gradient(ellipse at 90% 100%, #9f75490a, transparent 65%), #0e1b1b66;
  box-shadow: inset 0 4px 18px #0003;
}
.bag-viewport::-webkit-scrollbar { width: 6px; }
.bag-viewport::-webkit-scrollbar-thumb { background: #8c927366; border-radius: 3px; }
.grid { width: auto; box-sizing: border-box; justify-content: center; gap: 10px; padding: 16px; border: 0; border-radius: 0; background: none; box-shadow: none; }
.invcell { width: 64px; height: 64px; }
.velvet:has(.item-icon) { border-color: #8e9e8b50; }
.brass-qty { right: 4px; bottom: 3px; min-width: 15px; width: auto; height: auto; line-height: 17px; padding: 0 3px; border: 0; border-radius: 2px; background: #0a1414c7; color: #e6dfc9; font-size: 11px; font-variant-numeric: tabular-nums; }
.inv-foot { flex: none; margin-top: 18px; padding-top: 12px; padding-right: 22px; border-color: #b8a27726; color: #8e9d93; font-size: 11px; line-height: 1.7; }
.capacity { color: #b8bda8; font-size: 12px; letter-spacing: 1px; }
.lock-nail { width: 30px; height: 30px; flex: none; border-radius: 2px; border: 1px solid #b8a27755; background: #0e1b1b77; box-shadow: inset 0 1px 0 #d3c7a618; }
.lock-nail:hover { border-color: #c59880; background: #aa65551a; }
.lock-ring, .lock-keyhole { inset: auto; left: 7px; top: 14px; width: 14px; height: 1px; margin: 0; border: 0; border-radius: 0; background: #c5b593; transform: rotate(45deg); }
.lock-keyhole { transform: rotate(-45deg); }
.lock-ring { left: 7px; top: 14px; }
.lock-keyhole::before { display: none; }
.inv-panel.ability-mode { height: auto; max-height: calc(100vh - 48px); overflow-y: auto; }
@media (max-width: 900px) {
  .inv-panel { width: calc(100vw - 24px); height: calc(100vh - 24px); padding: 20px 18px 14px; }
  .inv-body { gap: 20px; }
  .rack-col { width: 264px; padding-right: 18px; }
  .trinket-row { gap: 8px; }
  .eqcell.trinketcase { width: 60px; }
  .page-tabs button { padding-left: 12px; padding-right: 12px; }
}
@media (max-height: 700px) and (min-width: 701px) {
  .inv-head { margin-bottom: 14px; padding-bottom: 9px; }
  .section-tag { margin-bottom: 5px; }
  .section-tag.spell, .section-tag.trinket, .trinket-row + .section-tag { margin-top: 9px; }
  .doll-stage.board { min-height: 150px; }
  .eqcell.peg { height: 48px; }
  .eqcell.spellcase, .eqcell.trinketcase, .quick-row .qcell { height: 46px; }
  .inv-foot { margin-top: 10px; padding-top: 7px; }
}
@media (max-width: 700px) {
  .inv-panel { overflow-y: auto; }
  .inv-head { flex-wrap: wrap; gap: 9px; margin-bottom: 16px; }
  .capacity { margin-left: 0; }
  .lock-nail { margin-left: auto; }
  .inv-body { flex: none; flex-direction: column; }
  .rack-col { width: auto; padding-right: 0; border-right: 0; }
  .doll-stage.board { flex: none; height: 220px; }
  .bag-side { min-height: 320px; }
  .bag-viewport { flex: none; height: 320px; }
}
@media (prefers-reduced-motion: reduce) {
  .inv-panel .item-icon, .inv-panel .eqcell, .inv-panel .velvet { transition: none; }
}
.organize-btn{padding:6px 10px;border:1px solid #b3976855;border-radius:2px;background:#c3a16a12;color:#cfb78d;font:inherit;font-size:11px;cursor:pointer}.organize-btn:hover{background:#c3a16a28}
/* 页签由朱砂短线标记，不再使用凸起的纸卡底板。 */
.page-tabs{display:flex;align-items:center;gap:20px;margin-right:auto;padding:0;background:none;border:0;box-shadow:none}
.page-tabs button{position:relative;padding:8px 4px 12px;border:0;border-radius:0;background:none;color:#89998f;font-family:var(--font-sign);font-size:20px;letter-spacing:5px;cursor:pointer;box-shadow:none;transition:color .15s}
.page-tabs button:hover{color:#e7d1a0}
.page-tabs button.selected{color:#e4d8b9;background:none;box-shadow:none;cursor:default}
.page-tabs button.selected::after{content:'';position:absolute;left:4px;bottom:0;width:28px;height:2px;background:#b66f56;box-shadow:0 0 7px #b66f5620}
.page-tabs button:focus-visible,.organize-btn:focus-visible,.lock-nail:focus-visible{outline:2px solid #c3b28f;outline-offset:4px}
.point-badge{display:inline-flex;align-items:center;justify-content:center;min-width:17px;height:17px;margin-left:7px;padding:0 5px;border-radius:2px;background:#8f3d2c;color:#ffe8c8;font-size:10px;line-height:17px;box-shadow:inset 0 0 0 1px #5f241c}
/* —— 成长记录：与背包共用墨青结界框 —— */
/* 原有纸页结构保留语义，材质在下方统一为暗色陈列内衬。 */
.ability-sheet{position:relative;min-height:430px;padding:26px 28px 72px;color:#47351f;border:1px solid #8f7243;border-radius:2px;overflow:hidden;
  background:
    repeating-linear-gradient(92deg,transparent 0 46px,rgba(110,79,36,.035) 46px 47px),
    radial-gradient(circle at 88% 12%,rgba(122,90,44,.07),transparent 42%),
    radial-gradient(circle at 12% 88%,rgba(122,90,44,.06),transparent 40%),
    linear-gradient(180deg,#e8d7ae,#dfca9c);
  box-shadow:0 10px 26px rgba(0,0,0,.55)}
.ability-sheet::before{content:'';position:absolute;inset:9px;border:1px solid rgba(110,84,44,.38);pointer-events:none}
.ability-sheet::after{content:'';position:absolute;inset:12px;border:1px solid rgba(110,84,44,.16);pointer-events:none}
.ability-columns{position:relative;display:grid;grid-template-columns:252px 1fr;gap:28px;min-height:380px}
/* 左侧账页：双层墨线＋朱色「录」字小印 */
.growth-record{position:relative;padding:20px 18px 16px;background:#f2e6c8;border:1px solid #a98d58;box-shadow:inset 0 0 0 3px #f2e6c8,inset 0 0 0 4px rgba(150,122,72,.55),2px 3px 0 rgba(101,76,40,.25)}
.record-seal{position:absolute;top:13px;right:13px;width:25px;height:25px;display:grid;place-items:center;border:1.5px solid #9c4632;color:#9c4632;font-family:var(--font-sign);font-size:14px;line-height:1;transform:rotate(-7deg);opacity:.82}
.record-caption{display:block;font-size:10px;letter-spacing:4px;color:#9a7a4f}
.growth-record h2{margin:4px 0 12px;padding-bottom:8px;border-bottom:1px solid #b39a68;color:#442e19;font-family:var(--font-sign);font-size:26px;font-weight:400}
.record-exp{height:8px;background:#d9c89d;border:1px solid #9a8052;box-shadow:inset 0 1px 2px rgba(60,40,12,.35)}
.record-exp i{display:block;height:100%;background:linear-gradient(90deg,#a67c2e,#d9b65c);transition:width .25s ease}
.experience-count{margin:6px 0 14px;text-align:right;font-size:11px;color:#765b37;font-variant-numeric:tabular-nums}
.available-points{display:flex;align-items:center;justify-content:space-between;padding:9px 4px;margin-bottom:17px;border-top:1px solid #b39a68;border-bottom:1px solid #b39a68;color:#6a4828;font-size:12px;letter-spacing:2px}
.available-points strong{font-size:24px;color:#8f3d2c;font-weight:400;font-variant-numeric:tabular-nums}
.growth-record h3{margin:0 0 8px;font-size:12px;color:#5d4529;letter-spacing:3px;font-weight:400}
.stat-preview{margin:0;display:grid;gap:0}
.stat-preview>div{display:flex;justify-content:space-between;gap:12px;align-items:baseline;font-size:12px;padding:5px 0;border-bottom:1px dotted rgba(130,101,58,.45)}
.stat-preview dt{color:#806640}.stat-preview dt::before{content:'·';margin-right:6px;color:#9c4632}
.stat-preview dd{margin:0;color:#493622;font-variant-numeric:tabular-nums}.stat-preview .changed{margin-left:3px;color:#8f3d2c;font-weight:700}
.power-note{margin:14px 0 0;padding:9px 2px 0;border-top:1px solid rgba(130,101,58,.45);font-size:10.5px;line-height:1.75;color:#8a6e46}
/* 右侧分配条目：纸签条目＋圆形铜钮 */
.allocation-list{padding-top:2px}
.ability-group{margin-bottom:19px}
.ability-group h3{position:relative;margin:0 0 10px;padding:0 0 7px 14px;border-bottom:1px solid #977c4a;color:#4d3822;font-size:14px;letter-spacing:5px;font-weight:400}
.ability-group h3::before{content:'';position:absolute;left:0;top:50%;width:7px;height:7px;background:#9c4632;transform:translateY(-50%) rotate(45deg)}
.ability-row{display:grid;grid-template-columns:minmax(0,1fr) 76px 32px 32px;align-items:center;gap:10px;min-height:50px;padding:7px 12px;margin-bottom:8px;background:#f4ead0;border:1px solid #b9a06e;box-shadow:1px 2px 0 rgba(101,76,40,.28);transition:border-color .15s ease,background .15s ease,box-shadow .12s ease}
.ability-row:hover{border-color:#9d8251;box-shadow:1px 3px 0 rgba(101,76,40,.32)}
.ability-row.invested{background:#f0dfb4;border-color:#a06a45;border-left:2px solid #9c4632}
.ability-name{font-size:14px;color:#4a351f;letter-spacing:1px}.ability-name small{display:block;margin-top:3px;font-size:10.5px;line-height:1.45;color:#8a7049;letter-spacing:0}
.allocated-count{font-size:12.5px;color:#685133;text-align:right;font-variant-numeric:tabular-nums}.allocated-count b{color:#8f3d2c;font-weight:700}.allocated-count i{font-style:normal;color:#a08b63;font-size:11px}.capped-note{color:#8f3d2c!important}
.ability-row button{width:30px;height:30px;padding:0;border-radius:50%;border:1px solid #6f4f22;background:radial-gradient(circle at 36% 30%,#e6c98a,#b38947 72%);color:#3a2710;font:inherit;font-size:14px;line-height:1;cursor:pointer;box-shadow:0 1px 1px rgba(0,0,0,.35),inset 0 -1px 0 rgba(0,0,0,.18);transition:transform .1s ease,filter .1s ease}
.ability-row button:first-of-type{border-color:#a98d58;background:radial-gradient(circle at 36% 30%,#f6eed8,#d8c8a0 72%);color:#6f4f22}
.ability-row button:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.05)}
.ability-row button:active:not(:disabled){transform:translateY(1px)}
.ability-row button:disabled{opacity:.32;cursor:default;box-shadow:none}
/* 底部：墨线＋朱印确认钮 */
.allocation-actions{position:absolute;left:28px;right:28px;bottom:18px;display:flex;justify-content:flex-end;align-items:center;gap:12px;padding-top:13px;border-top:1px solid rgba(110,84,44,.55);color:#80623b;font-size:11px}
.allocation-actions span{margin-right:auto;letter-spacing:1px}
.allocation-actions button,.pending-allocation button{font:inherit;font-size:12px;letter-spacing:2px;padding:8px 16px;border:1px solid #a98d58;border-radius:2px;background:transparent;color:#6f5230;cursor:pointer}
.allocation-actions button:hover:not(:disabled),.pending-allocation button:hover{background:rgba(110,84,44,.08)}
.allocation-actions .confirm-allocation,.pending-allocation .confirm-allocation{border-color:#6c2c1f;background:#8f3d2c;color:#f6e3c2;box-shadow:1px 2px 0 #5f271c}
.allocation-actions .confirm-allocation:hover:not(:disabled),.pending-allocation .confirm-allocation:hover{background:#a04834}
.allocation-actions button:disabled{opacity:.38;cursor:default;box-shadow:none}
/* 未确认加点的页内纸卡询问 */
.pending-allocation{position:absolute;inset:0;margin:auto;width:380px;height:fit-content;z-index:5;display:flex;flex-direction:column;align-items:center;gap:18px;padding:26px 28px;background:#e8d7ae;border:1px solid #8f7243;box-shadow:0 12px 30px rgba(0,0,0,.65),inset 0 0 0 4px #e8d7ae,inset 0 0 0 5px rgba(150,122,72,.55);color:#47351f}
.pending-allocation p{margin:0;font-size:14px;letter-spacing:2px;text-align:center;line-height:1.8}
.pending-allocation div{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
/* 统一暗色内衬，成长记录与加点区域以明度和结构分层。 */
.inv-panel.ability-mode { height: min(780px, calc(100vh - 48px)); max-height: none; overflow: hidden; }
.ability-sheet { display: flex; flex-direction: column; flex: 1; min-height: 0; padding: 0; border: 0; background: none; box-shadow: none; color: #ded8c5; overflow: visible; }
.ability-sheet::before, .ability-sheet::after { display: none; }
.ability-columns { flex: 1; min-height: 0; grid-template-columns: 328px minmax(0, 1fr); gap: 32px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #8c927366 #0d181855; }
.growth-record { padding: 24px 24px 18px; border: 1px solid #a6b8a22b; border-radius: 2px; background: radial-gradient(ellipse at 0 0, #a1b99c0c, transparent 65%), #0d1a1a55; box-shadow: inset 0 2px 12px #0002; }
.record-seal { top: 23px; right: 23px; border-color: #b76d56; color: #c48369; opacity: .75; }
.record-caption { color: #91a295; font-size: 11px; }
.growth-record h2 { margin-top: 9px; padding-bottom: 16px; border-color: #b8a2773b; color: #e4d8b9; font-size: 32px; letter-spacing: 3px; }
.record-exp { height: 5px; border: 0; background: #081313; box-shadow: inset 0 1px 2px #0006; }
.record-exp i { background: linear-gradient(90deg, #8b9874, #c3b28f); box-shadow: 0 0 8px #c3b28f18; }
.experience-count { margin-top: 8px; margin-bottom: 22px; color: #899b90; }
.available-points { padding: 12px 0; margin-bottom: 23px; border-color: #b8a27730; color: #b5bdac; }
.available-points strong { color: #d39a7c; font-size: 30px; }
.growth-record h3 { color: #c7b795; font-size: 13px; margin-bottom: 12px; }
.stat-preview>div { padding: 8px 0; border-bottom: 1px solid #a6b8a213; font-size: 12px; }
.stat-preview dt { color: #9eafa3; }
.stat-preview dt::before { color: #b76d56; }
.stat-preview dd { color: #dfd9c6; }
.stat-preview .changed { color: #d8aa83; }
.power-note { margin-top: 20px; padding-top: 13px; border-color: #b8a27730; color: #83958a; line-height: 1.9; }
.allocation-list { padding: 0 0 4px; }
.ability-group { margin-bottom: 18px; }
.ability-group:last-child { margin-bottom: 0; }
.ability-group h3 { padding: 0 0 9px 17px; margin-bottom: 10px; color: #c7b795; border-color: #b8a27730; font-family: var(--font-sign); font-size: 15px; letter-spacing: 4px; }
.ability-group h3::before { width: 5px; height: 5px; background: #b76d56; top: 9px; }
.ability-row { box-sizing: border-box; grid-template-columns: minmax(0,1fr) 66px 34px 34px; gap: 12px; min-height: 64px; padding: 10px 16px; margin-bottom: 8px; border: 1px solid #a6b8a22b; border-left: 2px solid #a6b8a236; background: linear-gradient(105deg, #a9beac07, transparent), #10201f77; box-shadow: inset 0 1px 0 #d2d9bc05; }
.ability-row:hover { border-color: #b8a27766; background: #20302dcc; box-shadow: inset 0 1px 0 #d2d9bc0b; }
.ability-row.invested { border-color: #b76d5655; border-left-color: #c48369; background: linear-gradient(90deg, #b76d5614, transparent), #182724; }
.ability-name { color: #ded8c5; font-size: 15px; }
.ability-name small { margin-top: 5px; color: #8fa196; font-size: 11px; }
.allocated-count { color: #ccbea0; font-size: 14px; }
.allocated-count i { margin-left: 3px; color: #7e9387; font-size: 11px; }
.capped-note { color: #c48369 !important; }
.ability-row button, .ability-row button:first-of-type { width: 34px; height: 34px; border-radius: 2px; border: 1px solid #b8a27755; background: linear-gradient(145deg, #b8a27710, transparent), #182827; color: #d7c6a2; box-shadow: inset 0 1px 0 #d2c29f13, 0 2px 3px #0003; }
.ability-row button:last-of-type { border-color: #b8a27788; }
.ability-row button:hover:not(:disabled) { border-color: #d0bc92; background: #b8a27720; transform: translateY(-1px); filter: none; }
.ability-row button:disabled { opacity: .25; }
.ability-row button:focus-visible, .allocation-actions button:focus-visible, .pending-allocation button:focus-visible { outline: 2px solid #c3b28f; outline-offset: 3px; }
.allocation-actions { position: static; flex: none; margin-top: 18px; padding-top: 14px; border-color: #b8a27730; color: #91a295; flex-wrap: wrap; line-height: 1.7; }
.allocation-actions button, .pending-allocation button { padding: 9px 18px; border-color: #b8a27755; color: #c7b795; background: #142322; }
.allocation-actions button:hover:not(:disabled), .pending-allocation button:hover { background: #b8a27716; }
.allocation-actions .confirm-allocation, .pending-allocation .confirm-allocation { border-color: #b76d5680; background: #804a3c; color: #f0dfc4; box-shadow: inset 0 1px 0 #e4b4971a, 0 2px 3px #0003; }
.allocation-actions .confirm-allocation:hover:not(:disabled), .pending-allocation .confirm-allocation:hover { background: #965944; }
.pending-allocation { box-sizing: border-box; width: min(470px, calc(100% - 24px)); padding: 28px; color: #ded8c5; background: #1b2b29; border: 1px solid #b8a27788; box-shadow: 0 0 0 100vmax #050c0ca6, 0 12px 30px #0009, inset 0 0 0 5px #0d171744; }
@media (max-width: 900px) {
  .inv-panel.ability-mode { height: calc(100vh - 24px); }
  .ability-columns { grid-template-columns: 264px minmax(0,1fr); gap: 20px; }
  .growth-record { padding: 18px; }
  .ability-row { gap: 8px; padding: 9px 10px; grid-template-columns: minmax(0,1fr) 48px 30px 30px; }
  .ability-row button, .ability-row button:first-of-type { width: 30px; height: 30px; }
}
@media (max-width: 700px) {
  .ability-columns { grid-template-columns: 1fr; }
  .allocation-actions { gap: 8px; }
  .allocation-actions span { flex-basis: 100%; }
}
@media (max-height: 700px) {
  .ability-row { min-height: 54px; padding-top: 7px; padding-bottom: 7px; }
  .ability-group { margin-bottom: 12px; }
}
/* 烟褐旧金：与常驻 HUD 同色系，大面板使用更实的内衬与边缘厚度。 */
.inv-panel {
  --text: #eee1c7;
  --text-dim: #ab977d;
  --brass: #c0a16d;
  border-color: #20170f;
  background:
    radial-gradient(ellipse at 8% 0%, #d6b57513, transparent 48%),
    radial-gradient(ellipse at 95% 95%, #875b3612, transparent 55%),
    repeating-linear-gradient(0deg, #e0c99d03 0 1px, transparent 1px 5px),
    linear-gradient(130deg, #3c3024, #2b221a 60%, #30261c);
  box-shadow: 0 28px 90px #000b, 0 0 0 1px #8c7550,
    inset 0 0 0 1px #c8ab7566, inset 0 0 0 5px #120c0744,
    inset 0 2px 4px #e3cc9d24, inset 0 -3px 8px #0005;
}
.inv-panel::before { border-color: #c0a16d30; }
.inv-head { border-color: #c0a16d45; }
.rack-col { border-color: #c0a16d30; }
.section-tag { color: #ccb58b; }
.section-tag::after { background: linear-gradient(90deg, #c0a16d55, transparent); }
.section-tag.trinket { color: #b9ad95; }
.section-tag.trinket::before, .section-tag.trinket::after { background: linear-gradient(90deg, #b9ad9540, transparent); }
.doll-stage.board { background: radial-gradient(ellipse, #c4a46e0c, transparent 72%); }
.rack-sigil { color: #c5a570; opacity: .24; }
.doll-figure { filter: sepia(.65) brightness(1.7); opacity: .3; }
.eqcell.peg, .eqcell.spellcase, .eqcell.trinketcase, .velvet {
  border-color: #baa07936;
  background: radial-gradient(ellipse at 35% 0, #d8bd8810, transparent 70%), linear-gradient(145deg, #291e15, #1a130d);
  box-shadow: inset 0 3px 8px #0007, inset 0 -1px 0 #d4b7820c, 0 1px 0 #e8cda318;
}
.eqcell:has(.item-icon) { border-color: #c0a16d77; background: radial-gradient(ellipse at 50% 0, #c0a16d1b, transparent 75%), #241a12; }
.eqcell.peg.enabled::before { border-color: #c0a16daa; }
.eqcell.peg.enabled:hover, .eqcell.spellcase.enabled:hover, .eqcell.trinketcase.enabled:hover, .velvet:hover { border-color: #d4bc8b99; box-shadow: inset 0 0 12px #d4bc8612, 0 0 9px #d4bc860c; }
.eqcell .eqlabel { color: #c5b39488; }
.velvet:has(.item-icon) { border-color: #baa07960; }
.bag-viewport { border-color: #baa07933; background: radial-gradient(ellipse at 95% 100%, #b48b4e0b, transparent 65%), #1b140d77; box-shadow: inset 0 4px 18px #0005, inset 0 -1px 0 #d4b7820d; scrollbar-color: #a88c5e77 #1b140d55; }
.bag-viewport::-webkit-scrollbar-thumb { background: #a88c5e77; }
.brass-qty { background: #160f09d9; color: #f0e0c3; }
.inv-foot { border-color: #c0a16d30; color: #ad997b; }
.capacity { color: #c5b394; }
.lock-nail { border-color: #c0a16d66; background: #1d150d99; }
.page-tabs button { color: #ac9679; }
.page-tabs button.selected { color: #efdcaf; }

/* 记录板偏暖、分配区偏暗，组别仅在细边与刻字上使用不同色相。 */
.ability-columns { scrollbar-color: #a88c5e77 #1b140d55; }
.growth-record {
  border-color: #b5976266;
  background: radial-gradient(ellipse at 20% 0, #cfb58414, transparent 65%),
    repeating-linear-gradient(0deg, #edd8b004 0 1px, transparent 1px 6px),
    linear-gradient(145deg, #493a29, #352a1e 75%);
  box-shadow: inset 0 1px 0 #e3ca9340, inset 0 0 0 3px #1e160c55,
    inset 0 0 0 4px #c9aa6420, 0 4px 10px #0004;
}
.record-caption, .experience-count { color: #b49b75; }
.growth-record h2 { color: #efdcb0; border-color: #c0a16d45; text-shadow: 0 2px 1px #0005; }
.record-exp { background: #1a1209; border: 1px solid #b0955933; height: 6px; }
.record-exp i { background: linear-gradient(90deg, #97703c, #d4b574); box-shadow: 0 0 8px #d4b57422; }
.available-points { color: #cab594; border-color: #c0a16d40; background: linear-gradient(90deg, #180e0633, transparent); padding-left: 8px; padding-right: 8px; }
.available-points strong { color: #d8a181; text-shadow: 0 2px 2px #0006; }
.growth-record h3 { color: #d3bc90; }
.stat-preview>div { border-color: #c0a16d1c; }
.stat-preview>div:nth-child(odd) { background: #ead3a505; }
.stat-preview dt { color: #bea887; }
.stat-preview dd { color: #f0e0c3; }
.power-note { color: #b09a78; border-color: #c0a16d36; }
.ability-group { --group-accent: #bba176; }
.ability-group:nth-child(1) { --group-accent: #b3ad80; }
.ability-group:nth-child(2) { --group-accent: #c29075; }
.ability-group:nth-child(3) { --group-accent: #a5acaa; }
.ability-group h3 { color: var(--group-accent); border-color: #c0a16d36; text-shadow: 0 1px 1px #0007; }
.ability-group h3::before { background: var(--group-accent); box-shadow: 0 1px 2px #0007; }
.ability-row {
  border-color: #b59a6b42;
  border-left-color: var(--group-accent);
  background: linear-gradient(180deg, #ddc3970b, transparent 38%), linear-gradient(100deg, #392c20, #2c2117);
  box-shadow: inset 0 1px 0 #efd2a215, inset 0 -1px 0 #100a0666, 0 2px 3px #0003;
}
.ability-row:hover { border-color: #c0a16d88; border-left-color: var(--group-accent); background: linear-gradient(100deg, #443426, #33261a); box-shadow: inset 0 1px 0 #efd2a224, 0 2px 4px #0004; }
.ability-row.invested { border-color: #c18a6266; border-left-color: #cf9875; background: radial-gradient(ellipse at 0 50%, #ad65431c, transparent 75%), linear-gradient(100deg, #453122, #302318); }
.ability-name { color: #ecddc1; text-shadow: 0 1px 1px #0006; }
.ability-name small { color: #b59f7e; text-shadow: none; }
.allocated-count { color: #e3c999; background: #1b120b44; padding: 5px 4px; border-radius: 2px; box-shadow: inset 0 1px 2px #0003; }
.allocated-count i { color: #a98e67; }
.ability-row button, .ability-row button:first-of-type {
  border-color: #a88b5c88;
  background: linear-gradient(145deg, #625039, #3b2c1b);
  color: #edd7a7;
  box-shadow: inset 0 1px 0 #f0d6a136, inset 0 -2px 0 #1c110966, 0 2px 2px #0005;
}
.ability-row button:last-of-type { border-color: #c5a16c99; background: linear-gradient(145deg, #806342, #4a3520); }
.ability-row button:hover:not(:disabled) { background: linear-gradient(145deg, #90724a, #564027); border-color: #d4bc8b; }
.ability-row button:active:not(:disabled) { transform: translateY(1px); box-shadow: inset 0 2px 3px #0006; }
.allocation-actions { color: #b5a080; border-color: #c0a16d40; }
.allocation-actions button, .pending-allocation button { color: #d6bc91; border-color: #b5976255; background: linear-gradient(180deg, #b597620b, transparent), #2b2016; box-shadow: inset 0 1px 0 #d4b78214, 0 2px 2px #0003; }
.allocation-actions .confirm-allocation, .pending-allocation .confirm-allocation { background: linear-gradient(145deg, #965b40, #633927); border-color: #c4876266; box-shadow: inset 0 1px 0 #e4b49733, inset 0 -2px 0 #32170e77, 0 2px 3px #0005; }
.pending-allocation { color: #eee1c7; background: radial-gradient(ellipse at 0 0, #cfb58412, transparent 70%), #392b1f; border-color: #b5976299; box-shadow: 0 0 0 100vmax #090603a6, 0 12px 30px #0009, inset 0 0 0 5px #160f0844, inset 0 1px 0 #e3ca9333; }
/* 紧凑背包：缩小占屏面积，保留物品区独立滚动和全部装备槽。 */
.inv-panel { width: min(960px, 86vw); height: min(620px, 80dvh); padding: 18px 20px 14px; }
.inv-panel.ability-mode { height: auto; max-height: min(620px, 80dvh); }
.inv-head { gap: 10px; margin-bottom: 14px; padding-bottom: 9px; }
.inv-body { gap: 20px; }
.rack-col { width: 244px; padding-right: 16px; box-sizing: border-box; overflow-y: auto; scrollbar-width: thin; }
.doll-stage.board { flex: none; min-height: 180px; height: 180px; max-height: 180px; }
.doll-grid { grid-template-columns: repeat(3, 52px); grid-template-rows: repeat(4, 40px); padding: 8px; }
.eqcell.peg { width: 52px; height: 40px; }
.section-tag { font-size: 11px; letter-spacing: 2px; margin-bottom: 6px; }
.section-tag.spell, .section-tag.trinket, .trinket-row + .section-tag { margin-top: 10px; }
.spell-row, .trinket-row, .quick-row { gap: 8px; }
.eqcell.spellcase { width: 76px; height: 46px; }
.eqcell.trinketcase { width: 46px; height: 42px; }
.quick-row .qcell { width: 52px; height: 46px; }
.section-tag.bag { margin-bottom: 9px; }
.grid { gap: 8px; padding: 10px; }
.invcell { width: 52px; height: 52px; }
.inv-foot { margin-top: 10px; padding-top: 8px; font-size: 10px; }
.page-tabs { gap: 14px; }
.page-tabs button { font-size: 17px; letter-spacing: 3px; padding: 6px 3px 10px; }
.ability-sheet { min-height: 0; padding: 16px 17px; }
.ability-columns { grid-template-columns: 206px minmax(0, 1fr); gap: 18px; min-height: 0; }
.growth-record { padding: 16px 14px; }
.ability-row { min-height: 46px; gap: 7px; padding: 7px 9px; }
.ability-name { font-size: 12px; }
.ability-name small { font-size: 10px; }
.allocation-actions { margin-top: 12px; padding-top: 10px; }
@media (max-width: 900px) and (min-width: 701px) {
  .inv-panel { padding: 16px; }
  .rack-col { width: 224px; padding-right: 12px; }
  .inv-body { gap: 14px; }
  .capacity { font-size: 10px; }
}
@media (max-width: 700px) {
  .inv-panel { width: calc(100vw - 24px); height: min(720px, 88dvh); padding: 16px 14px 12px; overflow-y: auto; }
  .inv-panel.ability-mode { max-height: 88dvh; }
  .inv-body { flex: none; flex-direction: column; }
  .rack-col { width: 100%; padding-right: 0; overflow: visible; }
  .doll-stage.board { width: min(244px, 100%); }
  .bag-side { min-height: 240px; }
  .bag-viewport { height: 240px; flex: none; }
  .inv-head { flex-wrap: wrap; }
  .ability-columns { grid-template-columns: 1fr; }
}
@media (max-height: 560px) and (min-width: 701px) {
  .inv-panel { height: 86dvh; padding: 12px 16px 10px; }
  .inv-head { margin-bottom: 10px; }
  .inv-foot { margin-top: 6px; padding-top: 5px; }
}
</style>
