<script setup lang="ts">
/**
 * 键帽：按 action 当前绑定渲染真实按键（键盘＝文字键帽；鼠标左键＝小鼠标图标）
 * 键位表是响应式的，玩家改键后所有教学提示自动换字。
 */
import { computed } from 'vue'
import { keymap, keyLabel, isMouseToken, type ActionId } from '../core/keymap'

const props = defineProps<{ action: ActionId }>()
const token = computed(() => keymap.primary(props.action))
const isMouse = computed(() => isMouseToken(token.value))
const label = computed(() => keyLabel(token.value))
</script>

<template>
  <span class="keycap" :class="{ 'keycap-mouse': isMouse }">
    <!-- 鼠标左键：鼠标轮廓 + 左键区块高亮 -->
    <svg v-if="isMouse" viewBox="0 0 24 28" width="17" height="20" aria-label="鼠标左键">
      <path
        d="M12 1.5 C6.4 1.5 3 5.6 3 11.2 L3 19.5 C3 23.6 6.9 26.5 12 26.5 C17.1 26.5 21 23.6 21 19.5 L21 11.2 C21 5.6 17.6 1.5 12 1.5 Z"
        fill="rgba(20,15,8,0.85)"
        stroke="#d6ac60"
        stroke-width="1.4"
      />
      <path d="M12 2 L12 13" stroke="#d6ac60" stroke-width="1.2" />
          <path d="M12 2 L12 13 L3.6 13 C3.5 7 6.6 2.4 12 2 Z" fill="#d6ac60" opacity="0.85" />
    </svg>
    <template v-else>{{ label }}</template>
  </span>
</template>

<style scoped>
.keycap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  margin: 0 2px;
  border-radius: 4px;
  background: linear-gradient(180deg, #4a391f, #2a1f11);
  border: 1px solid rgba(214, 172, 96, 0.75);
  box-shadow:
    0 2px 0 rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(240, 205, 126, 0.25);
  color: #ffe9bf;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0;
  vertical-align: -5px;
  user-select: none;
}
.keycap-mouse {
  min-width: 24px;
  padding: 0 4px;
}
</style>
