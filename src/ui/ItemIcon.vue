<script setup lang="ts">
/**
 * 物品图标（工程化 L1：注册表驱动，无任何 kind/id switch）
 *
 * 双轨：
 * - 官方/脚本包：物品自带程序化 SVG 标记（itemDef.icon.type==='svg'），
 *   这里用 v-html 注入——内容全部来自本地注册表（MOD 为本地信任加载），无注入面；
 * - 数据包 MOD：直接给图片地址（icon.type==='image'），走 <img>。
 * 未知 id（MOD 已移除的存档）显示占位问号块，绝不空白崩溃。
 */
import { computed } from 'vue'
import { findItemDef, type ItemId } from '../shared/itemDefs'

const props = defineProps<{ id: ItemId | null | undefined; size?: number }>()

const def = computed(() => (props.id ? findItemDef(props.id) : null))
const px = computed(() => `${props.size ?? 36}px`)
const svgMarkup = computed(() => (def.value?.icon.type === 'svg' ? def.value.icon.svg : ''))
const imgSrc = computed(() => (def.value?.icon.type === 'image' ? def.value.icon.src : null))
</script>

<template>
  <div class="item-icon" :style="{ width: px, height: px }">
    <!-- 程序化 SVG 图标（内容注册表提供完整 <svg> 标记） -->
    <span v-if="svgMarkup" class="icon-host" v-html="svgMarkup"></span>
    <!-- MOD 外部图片图标 -->
    <img v-else-if="imgSrc" class="icon-host icon-img" :src="imgSrc" draggable="false" alt="" />
    <!-- 未知物品占位（已卸载 MOD 的容错） -->
    <span v-else class="icon-host icon-unknown">?</span>
  </div>
</template>

<style scoped>
.item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}
.icon-host {
  display: block;
  width: 100%;
  height: 100%;
  line-height: 1;
}
.icon-host :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}
.icon-img {
  object-fit: contain;
  image-rendering: pixelated;
}
.icon-unknown {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(60, 48, 36, 0.55);
  border: 1px dashed rgba(200, 170, 110, 0.6);
  color: rgba(220, 190, 130, 0.8);
  font-size: 60%;
  box-sizing: border-box;
}
</style>
