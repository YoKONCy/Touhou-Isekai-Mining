<script setup lang="ts">
/**
 * 常驻操作快捷栏（屏幕底部居中，8 格）
 * [武器A=1] [武器B=2] [镐=3] ｜ [符卡A=E] [符卡B=R] ｜ [道具1=4] [道具2=5] [道具3=6]
 *
 * 武器/镐格是装备槽的镜像（点击/1/2/3 切换手持）；
 * 符卡槽批次 D 开放（当前灰显锁定）；
 * 道具 3 格从背包自由拖配，单击或按键直接使用。
 * 格子数据直读 CaveModule（唯一真值），tick 驱动重渲。
 */
import { computed, ref } from 'vue'
import type { ModuleActions } from '../shared/moduleActions'
import type { EquipSlot, ItemId } from '../shared/itemDefs'
import { findItemDef } from '../shared/itemDefs'
import { t, itemName, itemDesc } from '../i18n'
import { beginPointerDrag, isClickSuppressed, type DragPayload, type DropTarget } from './pointerDnd'
import ItemIcon from './ItemIcon.vue'
import { isInventoryMouseOpen } from './inventoryMouse'

const props = defineProps<{ cave: ModuleActions; tick: number; hand: number; mana: number; spellCd: number }>()

interface BarCell {
  kind: 'hand' | 'spell' | 'quick'
  eq?: EquipSlot
  q?: number
  key: string
  /** 槽位名语言键（quick 槽不用此键，名称按序号拼 ui.slot.quick） */
  labelKey: string
}
/** 栏位契约（顺序即 DESIGN_MEMO §4.4） */
const CELLS: BarCell[] = [
  { kind: 'hand', eq: 'weaponA', key: '1', labelKey: 'ui.slot.weaponA' },
  { kind: 'hand', eq: 'weaponB', key: '2', labelKey: 'ui.slot.weaponB' },
  { kind: 'hand', eq: 'pick', key: '3', labelKey: 'ui.slot.pick' },
  { kind: 'spell', eq: 'spellA', key: 'E', labelKey: 'ui.slot.spellA' },
  { kind: 'spell', eq: 'spellB', key: 'R', labelKey: 'ui.slot.spellB' },
  { kind: 'quick', q: 0, key: '4', labelKey: '' },
  { kind: 'quick', q: 1, key: '5', labelKey: '' },
  { kind: 'quick', q: 2, key: '6', labelKey: '' }
]

/** 每格当前物品 id（tick 驱动重算） */
const cellId = (c: BarCell): ItemId | null => {
  void props.tick
  if (c.kind === 'quick' && c.q !== undefined) return props.cave.quickSlots.get(c.q)?.id ?? null
  if (c.eq) return props.cave.equipment.get(c.eq)
  return null
}
const isActive = (c: BarCell, i: number): boolean => c.kind === 'hand' && i === props.hand

/** 符卡槽是否已装备（有符卡才能用；空槽灰显） */
const isSpellReady = (c: BarCell): boolean => c.kind === 'spell' && !!cellId(c)
/** 已装备符卡但灵力不够：格子压暗提示（阈值读当前符卡实际消耗，不硬编码） */
const isManaLow = (c: BarCell): boolean => {
  if (!isSpellReady(c)) return false
  const id = cellId(c)
  const cost = id ? findItemDef(id)?.spell?.manaCost : undefined
  return cost !== undefined && props.mana < cost
}

/** 点击：切手持 / 用道具 / 放符卡（拖拽松手后的伪 click 由 pointerDnd 抑制标志拦截） */
function onClickCell(c: BarCell, i: number): void {
  if (isClickSuppressed() || isInventoryMouseOpen()) return
  if (c.kind === 'hand') props.cave.selectHand(i)
  else if (c.kind === 'quick' && c.q !== undefined) props.cave.useQuickItem(c.q)
  else if (c.kind === 'spell') props.cave.requestCastSpellA()
}

// —— 自研指针拖拽（与背包面板同一套；常驻栏只有道具槽可作拖起源） ——

/** 克隆槽位内的物品图标节点作为跟手浮层 */
function cloneIcon(el: HTMLElement): HTMLElement {
  const icon = el.querySelector('.item-icon')
  return (icon ? icon.cloneNode(true) : document.createElement('div')) as HTMLElement
}

function onCellPointerDown(e: PointerEvent, el: HTMLElement, c: BarCell): void {
  if (isInventoryMouseOpen()) return
  // 武器/符卡格只响应点击，不可拖起；空道具槽也不拖
  if (c.kind !== 'quick' || c.q === undefined || !props.cave.quickSlots.get(c.q)) return
  const payload: DragPayload = { kind: 'quick', index: c.q }
  beginPointerDrag({ event: e, payload, sourceEl: el, ghostEl: cloneIcon(el), onEnd: onBarDrop })
}

/**
 * 常驻栏松手结算（回调自带源信息）。
 * 注：从背包面板起拖、落到常驻栏的拖拽，onEnd 是 InventoryPanel 的 handleDrop，
 * 不会走到这里——本函数只会处理 quick 源；inv 分支仅作类型完备的防御。
 */
function onBarDrop(target: DropTarget | null, discard: boolean, src: DragPayload): void {
  if (discard) {
    // 拖出背包面板/快捷栏容器（游戏画面上）= 丢在脚下
    if (src.kind === 'quick') props.cave.quickDrop(src.index)
    return
  }
  if (!target) return // 面板内空白/非法落点：回弹，什么都不做
  let ok = false
  if (target.type === 'quick') {
    if (src.kind === 'inv') ok = props.cave.invToQuick(src.index, target.index)
    else if (src.kind === 'quick') {
      props.cave.quickMove(src.index, target.index)
      ok = true
    }
  } else if (target.type === 'eq' && src.kind === 'inv') {
    ok = props.cave.equipFromSlotTo(src.index, target.slot)
  }
  if (!ok) flashReject(target)
}

/** 目标格不接受/交换失败时红框一闪（从 DOM 反查落点元素） */
function flashReject(target: DropTarget): void {
  const sel = target.type === 'eq' ? `[data-drop="eq:${target.slot}"]` : `[data-drop="${target.type}:${target.index}"]`
  const el = document.querySelector(sel)
  if (!el) return
  el.classList.remove('dragbad')
  void (el as HTMLElement).offsetWidth
  el.classList.add('dragbad')
  window.setTimeout(() => el.classList.remove('dragbad'), 320)
}

// —— Hover 小铜牌 ——
const hover = ref<{ i: number; x: number; y: number } | null>(null)
const hoverCell = computed<BarCell | null>(() => (hover.value ? CELLS[hover.value.i] : null))
const hoverId = computed<ItemId | null>(() => {
  const c = hoverCell.value
  return c ? cellId(c) : null
})
const hoverDef = computed(() => (hoverId.value ? findItemDef(hoverId.value) : null))
function onEnter(i: number, e: MouseEvent): void {
  if (isInventoryMouseOpen()) return
  hover.value = { i, x: e.clientX, y: e.clientY }
}
function onMove(e: MouseEvent): void {
  if (hover.value) hover.value = { ...hover.value, x: e.clientX, y: e.clientY }
}
function onLeave(): void {
  hover.value = null
}
/** 空槽的说明文案（让玩家看懂每一格是干嘛的；文案全部走语言键） */
function emptyHint(c: BarCell): string {
  if (c.kind === 'hand') return t('ui.hotbar.empty.hand', { name: t(c.labelKey), key: c.key })
  if (c.kind === 'spell') {
    return c.eq === 'spellB'
      ? t('ui.hotbar.empty.spell_b', { key: c.key })
      : t('ui.hotbar.empty.spell_a', { key: c.key })
  }
  const name = t('ui.slot.quick', { n: (c.q ?? 0) + 1 })
  return t('ui.hotbar.empty.quick', { name, key: c.key })
}
</script>

<template>
  <div class="hotbar gpanel-mini">
    <template v-for="(c, i) in CELLS" :key="c.key">
      <!-- 隔条只在符卡组【之前】出现一次：E/R 必须紧贴成组 -->
      <span v-if="c.kind === 'spell' && c.eq === 'spellA'" class="sep"></span>
      <div
        class="gslot cell"
        :class="{
          active: isActive(c, i),
          locked: c.kind === 'spell' && !isSpellReady(c),
          hand: c.kind === 'hand',
          castable: c.kind === 'spell' && isSpellReady(c),
          manalow: c.kind === 'spell' && isManaLow(c),
          'spell-first': c.kind === 'spell' && c.eq === 'spellA',
          'spell-last': c.kind === 'spell' && c.eq === 'spellB'
        }"
        :data-drop="c.kind === 'quick' ? `quick:${c.q}` : `eq:${c.eq}`"
        @pointerdown="onCellPointerDown($event, $event.currentTarget as HTMLElement, c)"
        @click="onClickCell(c, i)"
        @mouseenter="(e) => onEnter(i, e)"
        @mousemove="onMove"
        @mouseleave="onLeave"
      >
        <span class="keyhint">{{ c.key }}</span>
        <ItemIcon v-if="cellId(c)" :id="cellId(c)" :size="34" />
        <!-- 空槽暗纹：短剑线条（武器槽） -->
        <svg v-else-if="c.kind === 'hand' && c.eq !== 'pick'" class="ghost-ico" viewBox="0 0 24 24">
          <path d="M12 2.5v11.5M7 14h10M12 16.5v4.5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" />
        </svg>
        <span v-else-if="c.kind === 'spell'" class="ghost-word">{{ t('ui.hotbar.ghost_spell') }}</span>
        <span v-else class="ghost-dot">▢</span>
        <!-- 符卡 CD 旋灭遮罩（从下往上消退） -->
        <span
          v-if="c.kind === 'spell' && isSpellReady(c) && props.spellCd > 0.001"
          class="spell-cd"
          :style="{ height: `${Math.min(100, props.spellCd * 100)}%` }"
        ></span>
        <span
          v-if="c.kind === 'quick' && (props.cave.quickSlots.get(c.q!)?.qty ?? 0) > 1"
          class="qty"
        >{{ props.cave.quickSlots.get(c.q!)?.qty }}</span>
      </div>
    </template>

    <!-- Hover 提示 -->
    <div
      v-if="hover"
      class="gtooltip"
      :style="{ left: `${hover.x + 14}px`, top: `${hover.y + 14}px` }"
      @mouseenter="onMove($event)"
    >
      <template v-if="hoverDef && hoverId">
        <div class="tt-name">{{ itemName(hoverId) }}</div>
        <div v-if="hoverCell!.kind === 'hand'" class="tt-stat">
          {{ t('ui.hotbar.tt.hand', { key: hoverCell!.key }) }}{{ isActive(hoverCell!, hover!.i) ? t('ui.hotbar.tt.active') : '' }}
        </div>
        <div v-if="hoverCell!.kind === 'spell'" class="tt-stat">
          {{ t('ui.hotbar.tt.spell', { key: hoverCell!.key }) }}
        </div>
        <div v-if="hoverDef.consume?.heal" class="tt-stat">
          {{ t('ui.hotbar.tt.heal', { n: hoverDef.consume.heal, key: hoverCell!.key }) }}
        </div>
        <div class="tt-desc">{{ itemDesc(hoverId) }}</div>
      </template>
      <template v-else-if="hoverCell">
        <div class="tt-name tt-empty">{{ emptyHint(hoverCell) }}</div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.hotbar {
  /* 底部居中挂带（主人指定改回居中）；半透明轻量件，南门通道从栏下透得见 */
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
  pointer-events: auto;
  z-index: 5;
  /* 沿用已确认样板的哑光皮革、细黄铜顶边，图标与场景共享紫灰暗色。 */
  background: rgba(46, 37, 44, 0.94);
  box-shadow:
    inset 0 1px 0 rgba(188, 149, 98, 0.4),
    0 3px 8px rgba(20, 18, 28, 0.4);
}
.cell {
  width: 48px;
  height: 48px;
  transition: transform 0.09s ease-out, box-shadow 0.09s ease-out;
  background: #22212c;
  border-color: #51434c;
  box-shadow: inset 0 -1px 0 #62514d;
}
/* 悬停整格轻轻浮起（挂带上取物的触感） */
.cell:hover {
  transform: translateY(-2px);
}
/* 键位提示：像素小字刻在格顶左上角黄铜片上 */
.hotbar .keyhint {
  left: 2px;
  top: 1px;
  font-size: 10px;
  color: rgba(240, 205, 126, 0.82);
}
/* 武器/镐格可点击换手持 */
.cell.hand {
  cursor: pointer;
}
.cell.active {
  box-shadow:
    inset 0 1px 0 #f0d3a1,
    0 0 0 1px #d5b783;
}
/* 未开放/空的符卡槽 */
.cell.locked {
  opacity: 0.5;
  cursor: not-allowed;
  background: #22212c;
}
/* —— 符卡组：E/R 两格共用朱砂符纸底托、零间距紧贴（符卡是符术道具，视觉独立于兵器/道具） —— */
.gslot.cell.spell-first {
  margin-right: -4px; /* 吃掉 flex gap，与 R 格贴合 */
  padding-right: 2px;
  border-radius: 3px 0 0 3px;
  background:
    linear-gradient(180deg, rgba(255, 226, 178, 0.1), rgba(0, 0, 0, 0.28)),
    linear-gradient(160deg, #4c261e, #341812);
  box-shadow:
    inset 1px 0 0 rgba(192, 68, 56, 0.6),
    inset 0 1px 0 rgba(255, 220, 170, 0.18),
    inset 0 -1px 0 rgba(0, 0, 0, 0.4);
}
.gslot.cell.spell-last {
  padding-left: 2px;
  border-radius: 0 3px 3px 0;
  background:
    linear-gradient(180deg, rgba(255, 226, 178, 0.1), rgba(0, 0, 0, 0.28)),
    linear-gradient(160deg, #4c261e, #341812);
  box-shadow:
    inset -1px 0 0 rgba(192, 68, 56, 0.6),
    inset 0 1px 0 rgba(255, 220, 170, 0.18),
    inset 0 -1px 0 rgba(0, 0, 0, 0.4);
}
/* 空槽 locked 态仍要透出符纸托的暗红色调（特异度高于 .cell.locked） */
.gslot.cell.spell-first.locked,
.gslot.cell.spell-last.locked {
  background:
    linear-gradient(160deg, rgba(0, 0, 0, 0.25), rgba(0, 0, 0, 0.42)),
    linear-gradient(160deg, #3a1d18, #271210);
}
/* 已装备符卡：可点击释放，金色微辉 */
.cell.castable {
  cursor: pointer;
}
.cell.castable:hover {
  box-shadow:
    inset 0 2px 4px rgba(0, 0, 0, 0.4),
    0 0 0 2px rgba(255, 233, 168, 0.7),
    0 0 10px rgba(255, 233, 168, 0.4);
}
/* 灵力不足：图标压暗但不锁死（点击仍有反馈，门控在逻辑层） */
.cell.manalow {
  filter: grayscale(0.6) brightness(0.62);
}
/* 符卡 CD 遮罩：从格底向上退去的暗罩 */
.spell-cd {
  position: absolute;
  left: 2px;
  right: 2px;
  bottom: 2px;
  background: rgba(8, 10, 22, 0.66);
  border-top: 1px solid rgba(255, 233, 168, 0.5);
  pointer-events: none;
  transition: height 0.08s linear;
}
.ghost-word {
  font-family: var(--font-sign);
  font-size: 17px;
  color: rgba(201, 150, 80, 0.32);
  pointer-events: none;
}
.ghost-ico {
  opacity: 0.4;
  pointer-events: none;
}
.ghost-dot {
  font-size: 15px;
  color: rgba(201, 150, 80, 0.35);
  pointer-events: none;
}
/* 栏位分组竖隔条（铆钉皮带的金属分隔） */
.sep {
  width: 5px;
  height: 38px;
  margin: auto 5px;
  position: relative;
}
.sep::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 3px;
  bottom: 3px;
  width: 1px;
  background: linear-gradient(180deg, rgba(120, 60, 0.1), rgba(0, 0, 0, 0.45));
  box-shadow: 0 0 3px rgba(0, 0, 0, 0.6);
}
.tt-empty {
  color: var(--text-dim);
}
</style>
