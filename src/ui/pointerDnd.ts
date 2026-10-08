/** 常驻快捷栏在游戏画面中的拖出丢弃；打开物品面板时交给共享 MC 交互层。 */
import type { EquipSlot } from '../shared/itemDefs'
import { isInventoryMouseOpen } from './inventoryMouse'

export type DragPayload =
  | { kind: 'inv'; index: number }
  | { kind: 'eq'; slot: EquipSlot }
  | { kind: 'quick'; index: number }

export type DropTarget =
  | { type: 'inv'; index: number }
  | { type: 'eq'; slot: EquipSlot }
  | { type: 'quick'; index: number }

/** 合法容器选择器：指针在这些元素【内部】松手都不算丢弃 */
const CONTAINER_SEL = '.inv-panel, .hotbar'
/** 可放落点 */
const DROP_SEL = '[data-drop]'

/** 起拖阈值（px）：小于这个位移视为点击 */
const THRESHOLD = 5

interface ActiveDrag {
  payload: DragPayload
  sourceEl: HTMLElement
  ghost: HTMLElement
  startX: number
  startY: number
  offsetX: number
  offsetY: number
  armed: boolean
  pointerId: number
  onEnd: (target: DropTarget | null, discard: boolean, payload: DragPayload) => void
}

let drag: ActiveDrag | null = null
/** 拖拽真正发生后短暂抑制 click（pointerup 后浏览器还会补发一次 click） */
let suppressUntil = 0

/** 面板/遮罩的 click 处理器调用：拖拽松手后的伪 click 应被忽略 */
export function isClickSuppressed(): boolean {
  return performance.now() < suppressUntil
}

/** 解析落点元素的 data-drop 描述（"inv:3" / "eq:spellA" / "quick:1"） */
export function parseDropTarget(el: HTMLElement): DropTarget | null {
  const raw = el.dataset.drop
  if (!raw) return null
  const [type, id] = raw.split(':')
  if (type === 'eq') return { type: 'eq', slot: id as EquipSlot }
  const n = Number(id)
  if (!Number.isFinite(n)) return null
  if (type === 'inv') return { type: 'inv', index: n }
  if (type === 'quick') return { type: 'quick', index: n }
  return null
}

function clearHover(): void {
  document.querySelectorAll('.dragover').forEach((el) => el.classList.remove('dragover'))
  document.querySelectorAll('.draginvalid').forEach((el) => el.classList.remove('draginvalid'))
  document.body.classList.remove('discarding')
}

/**
 * 在槽位 pointerdown 时调用（是否起拖由内部阈值决定）。
 * 跟手浮层仅克隆物品图案，槽位框留在原位置。
 */
export function beginPointerDrag(o: {
  event: PointerEvent
  payload: DragPayload
  sourceEl: HTMLElement
  ghostEl: HTMLElement
  onEnd: (target: DropTarget | null, discard: boolean, payload: DragPayload) => void
}): void {
  // 只响应游戏画面的左键拖拽；物品面板打开后统一交给 MC 交互层
  if (o.event.button !== 0 || isInventoryMouseOpen()) return
  const rect = o.sourceEl.getBoundingClientRect()
  drag = {
    payload: o.payload,
    sourceEl: o.sourceEl,
    ghost: o.ghostEl,
    startX: o.event.clientX,
    startY: o.event.clientY,
    offsetX: o.event.clientX - rect.left,
    offsetY: o.event.clientY - rect.top,
    armed: false,
    pointerId: o.event.pointerId,
    onEnd: o.onEnd
  }
  window.addEventListener('pointermove', onMove, { passive: false })
  window.addEventListener('pointerup', onUp, true)
  window.addEventListener('pointercancel', onCancel, true)
}

function arm(d: ActiveDrag, e: PointerEvent): void {
  d.armed = true
  // 跟手浮层：克隆物品图标，放大 1.12，带投影；pointer-events 必须为 none 才能穿透检测
  const float = document.createElement('div')
  float.className = 'drag-ghost'
  float.style.left = `${e.clientX - d.offsetX}px`
  float.style.top = `${e.clientY - d.offsetY}px`
  float.appendChild(d.ghost)
  document.body.appendChild(float)
  d.sourceEl.classList.add('drag-source')
  document.body.classList.add('dragging-item')
}

function onMove(e: PointerEvent): void {
  const d = drag
  if (!d || e.pointerId !== d.pointerId) return
  if (!d.armed) {
    if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < THRESHOLD) return
    arm(d, e)
  }
  e.preventDefault()
  const float = document.querySelector('.drag-ghost') as HTMLElement | null
  if (float) {
    float.style.left = `${e.clientX - d.offsetX}px`
    float.style.top = `${e.clientY - d.offsetY}px`
  }

  // 落点检测：先排除浮层自身
  const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
  const dropEl = under?.closest(DROP_SEL) as HTMLElement | null
  const inContainer = !!under?.closest(CONTAINER_SEL)

  clearHover()
  if (dropEl) {
    const target = parseDropTarget(dropEl)
    if (target && acceptKind(d.payload, target)) dropEl.classList.add('dragover')
    else dropEl.classList.add('draginvalid')
  } else if (!inContainer) {
    // 出了所有合法容器：松手即丢弃
    document.body.classList.add('discarding')
  }
}

/** 源/目标类型是否可交换（最终能否交换数据仍由 CaveModule 判定；这里只管高亮） */
function acceptKind(src: DragPayload, t: DropTarget): boolean {
  if (t.type === 'eq') return src.kind === 'inv'
  if (t.type === 'quick') return src.kind === 'inv' || src.kind === 'quick'
  return true // 背包格收一切（装备/快捷→背包的具体换算在 CaveModule）
}

function finish(e: PointerEvent, cancelled: boolean): void {
  const d = drag
  if (!d) return
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp, true)
  window.removeEventListener('pointercancel', onCancel, true)

  let target: DropTarget | null = null
  let discard = false
  if (d.armed && !cancelled) {
    const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
    const dropEl = under?.closest(DROP_SEL) as HTMLElement | null
    const inContainer = !!under?.closest(CONTAINER_SEL)
    if (dropEl) {
      const parsed = parseDropTarget(dropEl)
      if (parsed && acceptKind(d.payload, parsed)) target = parsed
    } else if (!inContainer) {
      discard = true
    }
    suppressUntil = performance.now() + 250
  }

  document.querySelector('.drag-ghost')?.remove()
  d.sourceEl.classList.remove('drag-source')
  clearHover()
  document.body.classList.remove('dragging-item')
  drag = null
  if (d.armed) d.onEnd(target, discard, d.payload)
}

function onUp(e: PointerEvent): void {
  if (drag && e.pointerId === drag.pointerId) finish(e, false)
}
function onCancel(e: PointerEvent): void {
  if (drag && e.pointerId === drag.pointerId) finish(e, true)
}

/** 打开物品面板前结束游戏快捷栏的拖影，避免两套输入监听交叉结算。 */
export function cancelPointerDrag(): void {
  if (drag) finish(new PointerEvent('pointercancel'), true)
}
