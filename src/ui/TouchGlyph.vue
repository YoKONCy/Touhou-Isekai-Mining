<script setup lang="ts">
/** 触控入口共用实物轮廓、材质明暗与暖色金属细节，避免文字和系统表情混用。 */
defineProps<{ kind: 'bag' | 'map' | 'journal' | 'pause' | 'move' | 'interact' | 'attack' | 'skill' | 'dodge' | 'cancel' | 'spell' | 'pick' | 'quick' }>()
</script>

<template>
  <svg class="touch-glyph" viewBox="0 0 48 48" aria-hidden="true" focusable="false" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <g v-if="kind === 'bag'" stroke="#30252b" stroke-width="1.6">
      <path d="M17 13V9Q24 3 31 9V13" stroke="#c1aa7e" stroke-width="3"/>
      <path d="M13 13Q24 9 35 13L39 39Q24 45 9 39Z" fill="#866147"/>
      <path d="M13 14Q24 11 35 14L33 25Q24 30 15 25Z" fill="#b28c61"/>
      <path d="M12 31Q24 28 36 31L35 39H13Z" fill="#654a3b"/>
      <path d="M22 15H26V32H22Z" fill="#d1b47c"/>
      <rect x="20" y="23" width="8" height="7" rx="1" fill="#5d4b3a" stroke="#e0c58c"/>
      <path d="M15 16L16 21M15 34H19M29 34H33" stroke="#dcc39a" stroke-width="1"/>
    </g>
    <g v-else-if="kind === 'map'" stroke="#514238" stroke-width="1.4">
      <path d="M5 12L17 8L30 12L42 7V37L30 42L17 38L5 42Z" fill="#cfbc91"/>
      <path d="M17 8L30 12V42L17 38Z" fill="#a99472"/>
      <path d="M17 9V38M30 12V41" stroke="#ead9af"/>
      <path d="M9 31Q13 20 21 28T36 17" stroke="#826653" stroke-dasharray="2 3"/>
      <path d="M32 16L35 11L38 16L35 23Z" fill="#a86151"/>
      <path d="M9 16L12 13L15 17M32 33L36 30L39 33" stroke="#75836b"/>
    </g>
    <g v-else-if="kind === 'journal'" stroke="#35262d" stroke-width="1.5">
      <path d="M11 7L35 5L39 39L14 43L9 38Z" fill="#7e5245"/>
      <path d="M14 8L34 7L37 37L16 40Z" fill="#a47c58"/>
      <path d="M10 9L13 39M17 39L36 36" stroke="#d8c29a"/>
      <path d="M20 14H29M19 19H30M19 24H26" stroke="#dfc492"/>
      <path d="M28 6L30 17L33 14L36 17L34 6" fill="#a9554b"/>
      <path d="M30 29H40V34H30Z" fill="#d4b67d"/>
    </g>
    <g v-else-if="kind === 'pause'" stroke="#8f7b5e" stroke-width="1.3">
      <path d="M14 10H20V38H14Z M28 10H34V38H28Z" fill="#e3d2ae"/>
      <path d="M15 11H19M29 11H33" stroke="#fff0cf"/>
    </g>
    <g v-else-if="kind === 'move'" stroke="#a89472" stroke-width="1.1" fill="#decdac">
      <path d="M24 7L18 16H30Z M24 41L18 32H30Z M7 24L16 18V30Z M41 24L32 18V30Z"/>
      <path d="M24 20L28 24L24 28L20 24Z" fill="#b29b71"/>
    </g>
    <g v-else-if="kind === 'interact'" stroke="#504037" stroke-width="1.5">
      <path d="M13 31L11 23Q10 19 13 19L17 25L16 10Q16 7 19 8L21 21L22 7Q23 4 25 7L26 21L29 10Q31 8 32 11L31 24L35 17Q38 16 38 19L35 32Q33 39 28 40H19Z" fill="#d8c29d"/>
      <path d="M16 34L29 35L28 43H17Z" fill="#8f7256"/>
      <path d="M19 27L24 25L29 27M20 38H26" stroke="#f0ddba"/>
    </g>
    <g v-else-if="kind === 'attack' || kind === 'skill'" stroke="#3b3039" stroke-width="1.3">
      <path v-if="kind === 'skill'" d="M7 24Q8 6 29 5M5 32Q3 14 16 9" stroke="#dfc38b" stroke-width="2"/>
      <path d="M18 28L33 8L41 5L39 14L23 33Z" fill="#b7c6c8"/>
      <path d="M20 28L39 7L36 15L23 31Z" fill="#edf0df" stroke="none"/>
      <path d="M14 26L26 36L29 33L17 23Z" fill="#cfad72"/>
      <path d="M16 30L7 39L11 43L21 34Z" fill="#88604c"/>
      <path d="M12 35L16 39M9 38L13 42" stroke="#c5a783"/>
      <path v-if="kind === 'skill'" d="M36 27L38 32L43 34L38 36L36 41L34 36L29 34L34 32Z" fill="#efd69e" stroke="none"/>
    </g>
    <g v-else-if="kind === 'dodge'" stroke="#382b31" stroke-width="1.4">
      <path d="M23 8L36 12L31 28Q33 32 42 34L40 40H22L15 35L21 24Z" fill="#a18159"/>
      <path d="M24 10L33 13L29 26L23 24Z" fill="#d2b488"/>
      <path d="M18 34L24 37H40L39 41H21L15 37Z" fill="#655044"/>
      <path d="M23 18L30 20M22 22L29 24M5 22H15M3 28H12M7 34H11" stroke="#e1c89a" stroke-width="1.8"/>
    </g>
    <g v-else-if="kind === 'cancel'" stroke="#e1b4a5" stroke-width="3"><path d="M14 14L34 34M34 14L14 34"/></g>
    <g v-else-if="kind === 'spell'" stroke="#ad936a" stroke-width="1.5">
      <path d="M17 6L34 9L30 43L13 39Z" fill="#bfa77c" fill-opacity=".25"/>
      <path d="M23 14L28 19L21 23L26 28L20 34M19 12L30 14M17 36L27 38"/>
    </g>
    <g v-else-if="kind === 'pick'" stroke="#b8a484" stroke-width="2.5"><path d="M13 39L30 12M8 15Q25 3 40 22L26 15Z"/></g>
    <g v-else stroke="#ac9675" stroke-width="1.5"><path d="M11 17L24 11L37 17V34L24 40L11 34ZM11 17L24 24L37 17M24 24V40"/><path d="M18 14L31 21V27"/></g>
  </svg>
</template>

<style scoped>
.touch-glyph{display:block;width:32px;height:32px;flex:none;pointer-events:none;filter:drop-shadow(0 1px 1px #09081088)}
</style>
