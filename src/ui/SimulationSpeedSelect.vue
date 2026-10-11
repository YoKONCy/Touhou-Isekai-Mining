<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { sfx } from '../game/audio/Sfx'

const props = defineProps<{ modelValue: number; label: string; disabled?: boolean }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: number): void }>()
const speeds = [0.25, 0.5, 1, 2] as const
const id = useId()
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLElement | null>(null)
const open = ref(false)
const active = ref(2)

async function show(): Promise<void> {
  if (props.disabled) return
  active.value = Math.max(0, speeds.findIndex(speed => speed === props.modelValue))
  open.value = true
  await nextTick()
  menu.value?.focus()
}
function close(restoreFocus = false): void {
  open.value = false
  if (restoreFocus) trigger.value?.focus()
}
function choose(speed: number): void {
  emit('update:modelValue', speed)
  sfx.uiTap()
  close(true)
}
function toggle(): void { if (open.value) close(true); else void show() }
function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape' && open.value) {
    // 先收起速度菜单，避免一次 Esc 同时关掉整个调试台。
    event.preventDefault(); event.stopPropagation(); close(true)
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault(); event.stopPropagation()
    if (!open.value) void show()
    else active.value = (active.value + (event.key === 'ArrowDown' ? 1 : -1) + speeds.length) % speeds.length
  } else if (open.value && (event.key === 'Home' || event.key === 'End')) {
    event.preventDefault(); event.stopPropagation()
    active.value = event.key === 'Home' ? 0 : speeds.length - 1
  } else if (open.value && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault(); event.stopPropagation(); choose(speeds[active.value]!)
  } else if (event.key === 'Tab') close()
}
function outside(event: PointerEvent): void {
  if (event.target instanceof Node && !root.value?.contains(event.target)) close()
}
function onFocusOut(event: FocusEvent): void {
  if (!(event.relatedTarget instanceof Node) || !root.value?.contains(event.relatedTarget)) close()
}
onMounted(() => document.addEventListener('pointerdown', outside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))
</script>

<template>
  <div ref="root" class="speed-select" @keydown="onKey" @focusout="onFocusOut">
    <button ref="trigger" type="button" class="speed-trigger" :class="{ open }" :disabled="disabled"
      :aria-label="`${label} · ${modelValue}×`" aria-haspopup="listbox" :aria-expanded="open"
      :aria-controls="`${id}-menu`" @click="toggle">
      <span>{{ modelValue }}<span class="speed-unit">×</span></span>
      <svg class="speed-chevron" viewBox="0 0 12 8" aria-hidden="true"><path d="m2 2 4 4 4-4" /></svg>
    </button>
    <Transition name="speed-menu">
      <div v-if="open" :id="`${id}-menu`" ref="menu" class="speed-options" role="listbox" tabindex="-1"
        :aria-label="label" :aria-activedescendant="`${id}-option-${active}`">
        <div v-for="(speed, index) in speeds" :id="`${id}-option-${index}`" :key="speed"
          class="speed-option" :class="{ selected: speed === modelValue, active: index === active }"
          role="option" :aria-selected="speed === modelValue" @pointerdown.prevent @pointermove="active = index" @click="choose(speed)">
          <span class="speed-mark" aria-hidden="true">◆</span>
          <span>{{ speed }}<span class="speed-unit">×</span></span>
          <svg v-if="speed === modelValue" class="speed-check" viewBox="0 0 14 12" aria-hidden="true"><path d="m2 6 3 3 7-7" /></svg>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.speed-select { position: relative; width: 126px; flex: 0 0 auto; }
.speed-trigger {
  width: 100%; min-height: 34px; display: flex; align-items: center; justify-content: space-between;
  padding: 6px 12px; border: 1px solid #b18d54; border-radius: 0;
  color: #fff0cf; font: inherit; font-size: 14px; line-height: 1.3; letter-spacing: .5px;
  background: linear-gradient(180deg, #6b523b, #433124);
  box-shadow: inset 0 1px #e5c88955, inset 0 -2px #23190f, 0 2px 0 #17110f;
  text-shadow: 0 1px 1px #140f0d; cursor: pointer;
  transition: border-color .12s, background .12s;
}
.speed-trigger:hover, .speed-trigger.open { border-color: #edc779; background: linear-gradient(#7c6041, #4e3928); }
.speed-trigger:focus-visible { outline: 2px solid #efd195; outline-offset: 3px; }
.speed-trigger:disabled { opacity: .45; cursor: default; }
.speed-chevron { width: 12px; height: 8px; fill: none; stroke: #edcb8c; stroke-width: 1.8; transition: transform .12s; }
.speed-trigger.open .speed-chevron { transform: rotate(180deg); }
.speed-unit { margin-left: 2px; }
/* 菜单向上展开，避开底部记录按钮与窄屏面板的滚动边界。 */
.speed-options {
  position: absolute; z-index: 3; bottom: calc(100% + 6px); right: 0; width: 100%; box-sizing: border-box;
  padding: 4px; border: 1px solid #b79760; border-radius: 0; outline: none;
  background: linear-gradient(135deg, #332824, #211b1c);
  box-shadow: inset 0 0 0 1px #110f0e, inset 0 0 0 2px #8f735d33, 0 6px 18px #000b;
  transform-origin: bottom center;
}
.speed-option {
  position: relative; display: flex; align-items: center; gap: 9px; min-height: 34px; box-sizing: border-box;
  padding: 6px 8px; color: #f5e7d0; font-size: 14px; line-height: 1.3; letter-spacing: .5px;
  border: 1px solid transparent; cursor: pointer; text-shadow: 0 1px #000;
}
.speed-option + .speed-option { border-top-color: #ac8b5b26; }
.speed-option.active { color: #fff5dd; border-color: #d5af6966; background: #b8894333; }
.speed-option.selected { color: #ffdc8e; background: linear-gradient(90deg, #9f723c55, #8b67351a); }
.speed-option.selected::before { content: ''; position: absolute; top: 5px; bottom: 5px; left: -1px; width: 2px; background: #e6b768; }
.speed-mark { font-size: 8px; color: #8f7861; }
.selected .speed-mark { color: #e5ba70; text-shadow: 0 0 5px #b67a3555; }
.speed-check { margin-left: auto; width: 12px; height: 11px; fill: none; stroke: #f4ce82; stroke-width: 1.8; }
.speed-menu-enter-active, .speed-menu-leave-active { transition: opacity .1s, transform .1s; }
.speed-menu-enter-from, .speed-menu-leave-to { opacity: 0; transform: translateY(3px); }
@media (prefers-reduced-motion: reduce) {
  .speed-chevron, .speed-menu-enter-active, .speed-menu-leave-active { transition: none; }
}
</style>
