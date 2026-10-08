<script setup lang="ts">
/**
 * 教程气泡（全局常驻）
 * 屏幕中下位置的小木牌；modal 气泡显示"按 F 继续"并需确认，普通气泡自动淡出。
 * 文案支持 {key:actionId} 记号，渲染为真实键帽（跟随键位设置），如：
 * "按 {key:hand3} 切出镐子，{key:attack} 挥动"。
 */
import { computed } from 'vue'
import { tutorial } from '../game/dialogue/tutorial'
import { t } from '../i18n'
import KeyCap from './KeyCap.vue'
import type { ActionId } from '../core/keymap'

type Seg = { kind: 'text'; value: string } | { kind: 'key'; value: ActionId }

/** 拆 {key:xxx} 记号为文本/键帽片段 */
function parseTokens(s: string): Seg[] {
  const out: Seg[] = []
  const re = /\{key:([a-zA-Z0-9_]+)\}/g
  let last = 0
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (m.index > last) out.push({ kind: 'text', value: s.slice(last, m.index) })
    out.push({ kind: 'key', value: m[1] as ActionId })
    last = m.index + m[0].length
  }
  if (last < s.length) out.push({ kind: 'text', value: s.slice(last) })
  return out
}

const segments = computed<Seg[]>(() => {
  const c = tutorial.current.value
  return c ? parseTokens(t(c.key, c.params as Record<string, string> | undefined)) : []
})
</script>

<template>
  <Transition name="tut">
    <div v-if="tutorial.current.value" :key="tutorial.current.value.seq" class="tut-root hud-surface" @click="tutorial.dismiss()">
      <span class="tut-nail">◆</span>
      <span class="tut-text">
        <template v-for="(seg, i) in segments" :key="i">
          <KeyCap v-if="seg.kind === 'key'" :action="seg.value" />
          <template v-else>{{ seg.value }}</template>
        </template>
      </span>
      <span v-if="tutorial.current.value.modal" class="tut-confirm">{{ t('ui.tutorial.confirm') }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.tut-root {
  position: absolute;
  left: 50%;
  bottom: 19%;
  transform: translateX(-50%);
  max-width: 70vw;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 22px 10px;
  background: linear-gradient(180deg, rgba(45, 34, 20, 0.94), rgba(27, 19, 11, 0.94));
  border: 1px solid rgba(214, 172, 96, 0.5);
  border-radius: 4px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(240, 205, 126, 0.12);
  color: #f0e4c8;
  font-size: 15px;
  letter-spacing: 2px;
  line-height: 1.5;
  white-space: nowrap;
  z-index: 30;
  cursor: pointer;
  pointer-events: auto;
}
.tut-nail {
  color: var(--brass);
  font-size: 10px;
}
.tut-confirm {
  margin-left: 6px;
  padding-left: 12px;
  border-left: 1px solid rgba(214, 172, 96, 0.35);
  font-size: 12px;
  color: var(--brass-hi);
  white-space: nowrap;
  animation: tut-blink 1s ease-in-out infinite;
}
@keyframes tut-blink {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 1;
  }
}
.tut-enter-active {
  transition: all 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.tut-leave-active {
  transition: all 0.2s ease-in;
}
.tut-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}
.tut-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-6px);
}
</style>
