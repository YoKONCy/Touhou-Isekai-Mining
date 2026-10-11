<script setup lang="ts">
defineProps<{working?:boolean}>()
</script>
<template><svg class="grill-art" :class="{working}" viewBox="0 0 300 220" aria-hidden="true">
  <ellipse cx="153" cy="194" rx="105" ry="12" fill="#100d18" opacity=".4"/>
  <path d="M62 179L88 156L210 156L242 182L219 201L81 201Z" fill="#74665e" stroke="#332c32" stroke-width="3"/>
  <path d="M91 184L204 166L211 182L101 198M121 164L218 185L211 199L116 179" fill="#88603d" stroke="#362b29" stroke-width="2"/>
  <g class="fire"><path d="M124 181Q100 156 128 134Q128 150 141 143Q146 112 152 106Q184 137 177 149Q194 140 192 125Q222 164 200 184Z" fill="#d88948"/><path d="M143 183Q128 165 147 146Q150 159 161 152Q168 136 171 133Q194 163 179 184Z" fill="#f5c574"/></g>
  <g stroke="#34303b" stroke-width="8" fill="none"><path d="M71 92L58 190M71 92L92 188M219 91L203 190M219 91L241 188"/></g>
  <g stroke="#9e9286" stroke-width="3" fill="none"><path d="M71 92L58 190M71 92L92 188M219 91L203 190M219 91L241 188"/></g>
  <path d="M50 90L192 61L249 103L103 136Z" fill="#49414a" stroke="#c2ac8a" stroke-width="3"/>
  <g stroke="#b6a18b" stroke-width="1.5"><path v-for="i in 9" :key="i" :d="`M${50+i*14.2} ${90-i*2.9}L${103+i*14.6} ${136-i*3.3}`"/><path v-for="i in 4" :key="`r${i}`" :d="`M${50+i*10.6} ${90+i*9.2}L${192+i*11.4} ${61+i*8.4}`"/></g>
  <g class="skewers"><path d="M95 119L193 80M122 130L220 91" stroke="#d7b782" stroke-width="3"/><path d="M100 94L122 84L142 94L120 106Z M145 82L166 73L186 84L164 95Z" fill="#c3a06b" stroke="#594331" stroke-width="2"/><path d="M135 110Q136 92 153 96Q175 104 160 117Z M177 98Q179 83 194 87Q216 95 201 108Z" fill="#a56d48" stroke="#50382e" stroke-width="2"/><path d="M110 92L123 99M119 88L132 95M154 82L167 89M162 78L175 85M147 103L155 109M187 94L196 101" stroke="#63412d" stroke-width="2"/></g>
  <g class="smoke" stroke="#d9cfb5" opacity=".5" stroke-width="2" fill="none"><path d="M130 73Q114 52 132 38Q143 27 133 13M174 65Q189 45 176 32Q167 23 178 10M204 78Q218 61 207 47"/></g>
</svg></template>
<style scoped>.grill-art{width:100%;height:100%;max-height:240px}.working .skewers{animation:turn-skewer .7s ease-in-out infinite}.working .smoke{animation:grill-smoke 1.1s ease-in-out infinite}.fire{transform-origin:160px 185px;animation:grill-fire 1s ease-in-out infinite alternate}@keyframes grill-fire{to{transform:scaleY(.91);opacity:.85}}@keyframes turn-skewer{50%{transform:translateY(-4px)}}@keyframes grill-smoke{50%{opacity:.2;transform:translateY(-6px)}}@media(prefers-reduced-motion:reduce){.working .skewers,.working .smoke,.fire{animation:none}}</style>
