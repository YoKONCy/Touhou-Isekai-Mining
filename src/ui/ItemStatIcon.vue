<script lang="ts">
// 图标使用固定的本地矢量图形，铁器、旧铜、木柄与符纸共用物品卡的材质配色。
const metal='#9da6a4',light='#d8ded1',dark='#596463',wood='#9c714b',gold='#bd9c58',paper='#e1cd9d',red='#a76151',blue='#779da8'
const blade=`<path d="M12 24L25 5L29 4L29 9L16 27Z" fill="${metal}"/><path d="M14 24L27 6L26 12Z" fill="${light}"/><path d="M10 22L20 29" stroke="${gold}" stroke-width="3"/><path d="M13 27L7 33" stroke="${wood}" stroke-width="4"/>`
const shield=`<path d="M8 8L19 5L30 8V20Q29 28 19 33Q9 28 8 20Z" fill="${metal}"/><path d="M19 7L10 10V20Q11 26 19 30Z" fill="${light}"/><path d="M8 8L19 5L30 8V20Q29 28 19 33Q9 28 8 20Z" fill="none" stroke="${dark}" stroke-width="2"/>`
const clock=`<circle cx="19" cy="21" r="12" fill="${gold}"/><circle cx="19" cy="21" r="9" fill="${paper}"/><path d="M16 4H22M19 4V8M10 21H12M26 21H28M19 12V14M19 28V30" stroke="${dark}" stroke-width="2"/><path d="M19 15V21L24 24" fill="none" stroke="${wood}" stroke-width="2"/>`
const glass=(fill:number)=>`<path d="M11 8Q11 15 17 19Q11 24 11 30H27Q27 24 21 19Q27 15 27 8Z" fill="${light}" fill-opacity=".48"/><path d="${fill===0?'M13 10H25L20 16H18Z':fill===1?'M17 23L19 19L21 23Z':'M13 28L19 22L25 28Z'}" fill="${gold}"/><path d="M11 8Q11 15 17 19Q11 24 11 30M27 8Q27 15 21 19Q27 24 27 30M19 18V25" stroke="${dark}" fill="none"/><path d="M9 6H29M9 32H29" stroke="${wood}" stroke-width="3"/>`
const icons:Record<string,string>={
  damage:blade,
  mixed:`<path d="M7 20Q11 6 29 9M7 29H29M24 24L29 29L24 34" fill="none" stroke="${gold}" stroke-width="2"/>${blade}`,
  slash:`<path d="M8 22Q12 6 30 9Q25 12 23 18Q13 14 8 22Z" fill="${gold}" fill-opacity=".45"/>${blade}`,
  stab:`<path d="M6 10H17V17H6Z" fill="${gold}" fill-opacity=".38"/><path d="M7 13H22M18 9L23 13L18 17" fill="none" stroke="${gold}" stroke-width="2"/>${blade}`,
  crit:`<path d="M19 5L27 14L24 28L19 33L11 26L9 14Z" fill="${red}"/><path d="M19 5L19 28L9 14Z" fill="#cd9b78"/><path d="M19 9L21 17L28 19L21 21L19 28L17 21L10 19L17 17Z" fill="${paper}"/>`,
  penetration:`${shield}<path d="M6 31L29 7M22 7H29V14" stroke="${wood}" stroke-width="3"/><path d="M8 28L26 9" stroke="${paper}" stroke-width="1"/>`,
  physical:shield,
  magic:`${shield}<path d="M19 11L25 19L19 27L13 19Z" fill="${blue}"/><path d="M19 13V25M15 19H23" stroke="${light}"/>`,
  heal:`<path d="M15 5H23V12L28 17V30Q19 35 10 30V17L15 12Z" fill="${light}"/><path d="M12 21H26V29Q19 32 12 29Z" fill="${red}"/><path d="M14 4H24V8H14Z" fill="${wood}"/><path d="M19 21V28M16 24H22" stroke="${paper}" stroke-width="2"/>`,
  mining:`<path d="M19 13L9 33" stroke="${wood}" stroke-width="5"/><path d="M6 10Q18 3 31 15L32 21L22 14L13 11L5 16Z" fill="${metal}"/><path d="M7 11Q18 5 30 16" stroke="${light}" fill="none"/>`,
  efficiency:`<path d="M10 31L25 11" stroke="${wood}" stroke-width="5"/><path d="M15 9L21 3L32 12L27 18Z" fill="${metal}"/><path d="M17 8L22 5L30 12" stroke="${light}" fill="none"/><path d="M5 15L11 17M7 22H13M18 28L21 33" stroke="${gold}" stroke-width="2"/>`,
  hardness:`<path d="M8 12L22 7L30 18L27 30L12 32L5 24Z" fill="${metal}"/><path d="M8 12L22 7L18 21L5 24Z" fill="${light}"/><path d="M18 21L27 30L30 18" fill="${dark}"/><path d="M22 12L18 21L22 25" fill="none" stroke="${dark}"/>`,
  coefficient:`<path d="M15 12V9Q19 3 23 9V12" fill="none" stroke="${dark}" stroke-width="3"/><path d="M12 12H26L31 31H7Z" fill="${metal}"/><path d="M12 12H18L14 28H9Z" fill="${light}"/><path d="M14 20H24M19 15V26" stroke="${dark}" stroke-width="2"/>`,
  reach:`<path d="M6 27L27 6L33 12L12 33Z" fill="${wood}"/><path d="M7 26L28 5" stroke="${paper}"/><path d="M12 23L15 26M17 18L20 21M22 13L25 16M27 8L30 11" stroke="${paper}"/>`,
  angle:`<path d="M5 29A15 15 0 0 1 33 29Z" fill="${gold}" fill-opacity=".58"/><path d="M5 29A15 15 0 0 1 33 29ZM19 29L29 15M19 29H5" fill="none" stroke="${wood}" stroke-width="1.6"/><path d="M8 23L11 24M13 16L15 19M19 14V18M25 16L23 19M30 23L27 24" stroke="${paper}"/>`,
  width:`<path d="M9 7V30M29 7V30M9 12H29M9 29H14V22M29 29H24V22" stroke="${metal}" stroke-width="3" fill="none"/><path d="M13 16H25M16 13L13 16L16 19M22 13L25 16L22 19" stroke="${wood}" fill="none"/>`,
  knockback:`<path d="M10 11H19L18 23L27 26V31H8L7 25Z" fill="${wood}"/><path d="M8 31H28M11 14H16M11 18H16" stroke="${dark}" stroke-width="2"/><path d="M22 10H32M28 6L32 10L28 14" fill="none" stroke="${gold}" stroke-width="2"/>`,
  stun:`<path d="M19 7Q10 8 11 22L8 26H30L27 22Q28 8 19 7Z" fill="${gold}"/><path d="M16 7V4H22V7M16 30Q19 34 22 30" stroke="${wood}" fill="none" stroke-width="2"/><path d="M12 21Q12 12 17 11" stroke="${paper}" fill="none"/><path d="M5 12L7 18M33 12L31 18" stroke="${wood}"/>`,
  windup:glass(0),active:glass(1),recover:glass(2),cycle:clock,cooldown:clock,
  accuracy:`<circle cx="19" cy="20" r="13" fill="${wood}"/><circle cx="19" cy="20" r="9" fill="${paper}"/><circle cx="19" cy="20" r="5" fill="${red}"/><path d="M18 21L30 7M25 7H30V12" stroke="${dark}" stroke-width="2" fill="none"/>`,
  speed:`<path d="M11 29L30 8M23 7L31 7L30 15" fill="none" stroke="${wood}" stroke-width="3"/><path d="M8 29L8 23L15 24M11 32L17 32L16 25" fill="${metal}"/><path d="M5 17H14M6 11H19" stroke="${gold}" stroke-width="2"/>`,
  aoe:`<circle cx="13" cy="14" r="6" fill="${gold}"/><circle cx="26" cy="16" r="5" fill="${metal}"/><circle cx="20" cy="28" r="4" fill="${wood}"/><path d="M18 13L22 15M16 20L18 24M25 21L23 25" stroke="${dark}"/><path d="M11 10L14 9" stroke="${paper}" stroke-width="2"/>`,
  mana:`<path d="M19 4Q25 14 29 18Q33 31 19 34Q5 31 9 20Q11 15 19 4Z" fill="${blue}"/><path d="M19 12Q22 20 25 23Q27 30 19 31Q11 29 13 23Z" fill="${light}"/><path d="M10 25Q10 30 15 31" fill="none" stroke="${paper}"/>`,
  radius:`<circle cx="19" cy="20" r="13" fill="${gold}" fill-opacity=".25" stroke="${wood}" stroke-dasharray="2 2"/><circle cx="19" cy="20" r="3" fill="${gold}"/><path d="M19 20H30M26 17L30 20L26 23" stroke="${dark}" fill="none" stroke-width="1.8"/>`,
  waves:`<path d="M6 12Q19 4 32 12M6 21Q19 13 32 21M6 30Q19 22 32 30" stroke="${blue}" stroke-width="3" fill="none"/><path d="M8 11Q19 5 29 10M8 20Q19 14 29 19" stroke="${light}" fill="none"/>`,
  purify:`<path d="M11 4L29 8L25 34L7 30Z" fill="${paper}" stroke="${wood}"/><path d="M19 10L23 14L17 17L21 21L15 23L18 29M13 13L25 16M12 24L22 27" stroke="${red}" fill="none" stroke-width="1.8"/>`,
  effect:`<path d="M9 6H29V31H9Z" fill="${paper}" stroke="${wood}"/><path d="M19 10L21 16L27 19L21 22L19 28L17 22L11 19L17 16Z" fill="${gold}"/><circle cx="19" cy="19" r="3" fill="${blue}"/>`
}
</script>

<script setup lang="ts">
defineProps<{ kind: string }>()
</script>

<template><svg class="stat-icon" viewBox="0 0 38 38" aria-hidden="true" v-html="icons[kind] ?? icons.effect"></svg></template>

<style scoped>
.stat-icon{display:block;flex:none;width:30px;height:30px;filter:drop-shadow(0 1px 1px #6e51342b)}
</style>
