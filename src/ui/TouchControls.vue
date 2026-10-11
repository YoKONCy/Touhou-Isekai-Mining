<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import type { InputManager } from '../core/InputManager'
import { t } from '../i18n'
import { touchControls } from '../browser/display'

const props = defineProps<{ input: InputManager | null; blocked: boolean; panel: string | null; base: boolean; searching: boolean; dodgeCd: number; skillCd: number; skillAvailable: boolean; facing: number }>()
const emit = defineEmits<{ panel: [kind: 'inventory' | 'map' | 'pause' | 'quests' | null] }>()
type Pad = 'move' | 'attack' | 'special' | 'dodge' | 'interact'
interface Finger { pad: Pad; el: HTMLElement; knob: HTMLElement | null; x: number; y: number; cancel: boolean; dodge: boolean }
const fingers = new Map<number, Finger>()
const charging = ref(false), cancelZone = ref<HTMLElement | null>(null)
const dodgeButton = ref<HTMLButtonElement | null>(null)
function reset(): void {
  clear(true)
}
function clear(cancelInput: boolean): void {
  const previous = [...fingers]; fingers.clear()
  for (const [id, finger] of previous) { finger.knob?.style.removeProperty('transform'); delete finger.el.dataset.pressed; delete finger.el.dataset.cancel; if (finger.el.hasPointerCapture(id)) finger.el.releasePointerCapture(id) }
  charging.value = false; if(cancelInput)props.input?.cancelTouchActions()
  if (dodgeButton.value) delete dodgeButton.value.dataset.pressed
}
function move(event: PointerEvent): void {
  const finger = fingers.get(event.pointerId), input = props.input
  if (!finger || !input) return
  const dx = event.clientX - finger.x, dy = event.clientY - finger.y, length = Math.hypot(dx, dy), radius = finger.el.clientWidth * .34
  const scale = length > radius ? radius / length : 1
  if (finger.knob) finger.knob.style.transform = `translate(${dx * scale}px,${dy * scale}px)`
  if (finger.pad === 'move') input.setTouchMove(length < 10 ? 0 : dx / Math.max(radius, length), length < 10 ? 0 : dy / Math.max(radius, length))
  if (finger.pad === 'attack' || finger.pad === 'special') {
    // 右拇指可从攻击摇杆滑到闪避，再滑回；期间保留攻击长按与原瞄准。
    const dodgeRect = dodgeButton.value?.getBoundingClientRect()
    const overDodge = finger.pad === 'attack' && ![...fingers.values()].some(other=>other!==finger&&other.pad==='dodge') && !!dodgeRect && event.clientX >= dodgeRect.left && event.clientX <= dodgeRect.right && event.clientY >= dodgeRect.top && event.clientY <= dodgeRect.bottom
    if (overDodge !== finger.dodge) { input.setTouchAction('dodge', overDodge); finger.dodge = overDodge; if (dodgeButton.value) dodgeButton.value.dataset.pressed = String(overDodge) }
    if (length > 9 && !overDodge) input.setTouchAim(dx, dy)
    const zone = cancelZone.value?.getBoundingClientRect()
    finger.cancel = finger.pad === 'special' && !!zone && event.clientX >= zone.left && event.clientX <= zone.right && event.clientY >= zone.top && event.clientY <= zone.bottom
    finger.el.dataset.cancel = String(finger.cancel)
  }
}
function start(pad: Pad, event: PointerEvent): void {
  if (pad === 'dodge' && [...fingers.values()].some(finger => finger.dodge)) return
  if (props.blocked || !props.input || [...fingers.values()].some(finger => finger.pad === pad || (pad === 'special' || pad === 'attack') && (finger.pad === 'special' || finger.pad === 'attack'))) return
  event.preventDefault()
  const el = event.currentTarget as HTMLElement, rect = el.getBoundingClientRect()
  const finger: Finger = { pad, el, knob: el.querySelector<HTMLElement>('.touch-knob'), x: pad === 'move' ? rect.left + rect.width / 2 : event.clientX, y: pad === 'move' ? rect.top + rect.height / 2 : event.clientY, cancel: false, dodge: false }
  fingers.set(event.pointerId, finger); el.setPointerCapture(event.pointerId); el.dataset.pressed = 'true'
  if (pad === 'move') props.input.setTouchMove(0, 0)
  else {
    if (pad === 'attack' || pad === 'special') props.input.setTouchAim(Math.cos(props.facing), Math.sin(props.facing))
    props.input.setTouchAction(pad, true)
  }
  if (pad === 'special') charging.value = true
  move(event)
}
function end(event: PointerEvent): void {
  const finger = fingers.get(event.pointerId)
  if (!finger) return
  move(event)
  fingers.delete(event.pointerId); delete finger.el.dataset.pressed; delete finger.el.dataset.cancel; finger.knob?.style.removeProperty('transform')
  if (finger.el.hasPointerCapture(event.pointerId)) finger.el.releasePointerCapture(event.pointerId)
  if (finger.dodge) { props.input?.setTouchAction('dodge', false); if (dodgeButton.value) delete dodgeButton.value.dataset.pressed }
  if (finger.pad === 'move') props.input?.setTouchMove(0, 0)
  else if (finger.cancel) props.input?.cancelTouchAction(finger.pad)
  else props.input?.setTouchAction(finger.pad, false)
  if (finger.pad === 'special') charging.value = false
}
function lost(event: PointerEvent): void { if (fingers.has(event.pointerId)) reset() }
function open(kind: 'inventory' | 'map' | 'pause' | 'quests'): void { reset(); emit('panel', props.panel === kind ? null : kind) }
watch(() => [props.blocked, props.panel, props.base, props.searching], reset, { flush: 'sync' })
window.addEventListener('blur', reset)
const visibility = () => { if (document.hidden) reset() }
document.addEventListener('visibilitychange', visibility)
onBeforeUnmount(() => { clear(touchControls.value); window.removeEventListener('blur', reset); document.removeEventListener('visibilitychange', visibility) })
</script>
<template>
  <div class="touch-controls" :class="{ 'touch-blocked': blocked }" @pointerdown.stop @click.stop @contextmenu.prevent>
    <nav v-if="!blocked" class="touch-menu">
      <button @click="open('inventory')">{{ t(panel === 'inventory' ? 'ui.mobile.close_bag' : 'ui.mobile.bag') }}</button>
      <button v-if="!base" @click="open('map')">{{ t('ui.mobile.map') }}</button>
      <button @click="open('quests')">{{ t('ui.mobile.quests') }}</button>
      <button @click="open('pause')">Ⅱ</button>
    </nav>
    <template v-if="!blocked && !panel">
      <div class="touch-pad touch-move" role="group" :aria-label="t('ui.mobile.move')" @pointerdown="start('move',$event)" @pointermove="move" @pointerup="end" @pointercancel="reset" @lostpointercapture="lost"><span class="touch-knob">✥</span></div>
      <button class="touch-button touch-interact" @pointerdown="start('interact',$event)" @pointerup="end" @pointercancel="reset" @lostpointercapture="lost">{{ t('ui.mobile.interact') }}</button>
      <template v-if="!base && !searching">
        <div class="touch-pad touch-attack" role="group" :aria-label="t('ui.mobile.attack')" @pointerdown="start('attack',$event)" @pointermove="move" @pointerup="end" @pointercancel="reset" @lostpointercapture="lost"><span class="touch-knob">{{ t('ui.mobile.attack') }}</span></div>
        <div v-if="skillAvailable" class="touch-pad touch-special" role="group" :aria-label="t('ui.mobile.skill')" @pointerdown="start('special',$event)" @pointermove="move" @pointerup="end" @pointercancel="reset" @lostpointercapture="lost"><span class="touch-knob">{{ t('ui.mobile.skill') }}</span><small v-if="skillCd>.05">{{ skillCd.toFixed(1) }}</small></div>
        <button ref="dodgeButton" class="touch-button touch-dodge" @pointerdown="start('dodge',$event)" @pointerup="end" @pointercancel="reset" @lostpointercapture="lost">{{ t('ui.mobile.dodge') }}<small v-if="dodgeCd>.05">{{ dodgeCd.toFixed(1) }}</small></button>
        <div v-if="charging" ref="cancelZone" class="touch-cancel">{{ t('ui.mobile.cancel_skill') }}</div>
      </template>
    </template>
  </div>
</template>
<style scoped>
.touch-controls{position:absolute;inset:0;z-index:25;pointer-events:none;--pad:calc(clamp(96px,24vh,124px)*var(--touch-scale));--small:calc(52px*var(--touch-scale));opacity:var(--touch-opacity)}.touch-pad,.touch-button,.touch-menu button{pointer-events:auto;touch-action:none;-webkit-touch-callout:none;border:1px solid #c4a67477;color:#eddbba;background:radial-gradient(circle at 35% 22%,#6e59623d,#27212da6 75%);box-shadow:inset 0 0 0 3px #17121c55,0 2px 8px #0004;font:inherit}.touch-pad{position:absolute;display:grid;place-items:center;border-radius:50%;width:var(--pad);height:var(--pad)}.touch-knob{display:grid;place-items:center;border:1px solid #c4a67455;background:#3b303aaa;width:53%;height:53%;border-radius:50%;pointer-events:none;font-size:13px;will-change:transform}.touch-move{left:calc(var(--safe-left) + 22px);bottom:calc(var(--safe-bottom) + 22px)}.touch-move .touch-knob{font-size:30px}.touch-attack{right:calc(var(--safe-right) + 20px);bottom:calc(var(--safe-bottom) + 24px)}.touch-special{width:calc(var(--pad)*.65);height:calc(var(--pad)*.65);right:calc(var(--safe-right) + var(--pad) + 27px);bottom:calc(var(--safe-bottom) + 26px)}.touch-special .touch-knob{width:70%;height:70%;font-size:12px}.touch-button{position:absolute;display:grid;place-items:center;min-width:var(--small);height:var(--small);border-radius:50%;font-size:12px;padding:6px}.touch-dodge{right:calc(var(--safe-right) + 30px);bottom:calc(var(--safe-bottom) + var(--pad) + 36px)}.touch-interact{left:calc(var(--safe-left) + var(--pad) + 36px);bottom:calc(var(--safe-bottom) + 40px)}.touch-menu{position:absolute;right:calc(var(--safe-right) + 10px);top:calc(var(--safe-top) + 10px);display:flex;gap:5px}.touch-menu button{min-width:44px;min-height:40px;padding:6px 9px;border-radius:2px;font-size:12px}.touch-pad[data-pressed=true],.touch-button[data-pressed=true]{border-color:#ffe0a5;background-color:#a2814d55}.touch-pad[data-cancel=true]{border-color:#df786b;background:#7a353a99}.touch-pad small,.touch-button small{position:absolute;bottom:4px;font-size:10px;pointer-events:none}.touch-cancel{position:absolute;right:calc(var(--safe-right) + 145px);bottom:calc(var(--safe-bottom) + 150px);padding:16px 22px;border:1px dashed #d79689;color:#f4c0b5;background:#3d2029dd;font-size:12px}.touch-blocked{display:none}@media(max-height:380px){.touch-controls{--pad:calc(90px*var(--touch-scale));--small:calc(46px*var(--touch-scale))}.touch-move,.touch-attack{bottom:calc(var(--safe-bottom) + 12px)}}
</style>
