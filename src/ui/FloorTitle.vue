<script setup lang="ts">
/**
 * 楼层标题卡：屏幕正中大字（序章/矿洞楼层复用）
 * 节拍由 floorTitle 服务驱动（in→hold→out）；视觉与进房小横幅同一套
 * 像素招牌语言（zpix 像素字 + 黄铜色 + ◆ 钉饰），只是字号更大、居中、节奏更慢。
 */
import { floorTitle } from '../game/dialogue/floorTitle'
import { t } from '../i18n'
</script>

<template>
  <div v-if="floorTitle.current.value" :key="floorTitle.current.value.seq" class="ft-root" :class="`ft-${floorTitle.current.value.phase}`">
    <span class="ft-nail">◆</span>
    <span class="ft-title">{{ t(floorTitle.current.value.key) }}</span>
    <span class="ft-nail">◆</span>
  </div>
</template>

<style scoped>
.ft-root {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 26px;
  pointer-events: none;
  /* 元素存在期间默认不透明：hold 阶段靠它维持可见；in/out 动画各自 both 保持终态 */
  opacity: 1;
}
.ft-title {
  font-family: var(--font-sign);
  font-size: clamp(34px, 5vw, 48px);
  letter-spacing: 12px;
  text-indent: 12px; /* 字距导致的右偏补偿，让字块视觉居中 */
  color: var(--brass-hi);
  text-shadow:
    0 3px 6px rgba(0, 0, 0, 0.95),
    0 0 26px rgba(240, 205, 126, 0.4);
  white-space: nowrap;
}
.ft-nail {
  font-family: var(--font-sign);
  font-size: 18px;
  color: var(--brass);
  text-shadow: 0 0 12px rgba(240, 205, 126, 0.45);
}
/* 入/出节拍对齐服务 timing（in 1s / out .9s）：像素字招牌式收放字距 */
.ft-in {
  animation: ft-in 1s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.ft-out {
  animation: ft-out 0.9s ease-in both;
}
@keyframes ft-in {
  0% {
    opacity: 0;
    transform: translateY(12px);
    letter-spacing: 22px;
  }
  100% {
    opacity: 1;
    transform: translateY(0);
    letter-spacing: 12px;
  }
}
@keyframes ft-out {
  0% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-8px);
  }
}
</style>
