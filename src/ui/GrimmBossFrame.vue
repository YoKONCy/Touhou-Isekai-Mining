<template>
  <!-- 左侧面具与披风压住血槽，右侧只有破碎尖翼；轮廓不做镜像复制。 -->
  <svg class="boss-frame grimm-frame" viewBox="0 0 640 100" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="grimm-metal" x1="60" y1="19" x2="93" y2="78" gradientUnits="userSpaceOnUse"><stop stop-color="#cfb0a0"/><stop offset=".3" stop-color="#645159"/><stop offset=".58" stop-color="#30252e"/><stop offset="1" stop-color="#9c726b"/></linearGradient>
      <linearGradient id="grimm-cape" x1="17" y1="33" x2="119" y2="78" gradientUnits="userSpaceOnUse"><stop stop-color="#110e17"/><stop offset=".6" stop-color="#34202c"/><stop offset="1" stop-color="#841d39"/></linearGradient>
      <linearGradient id="grimm-rim" x1="103" y1="40" x2="582" y2="67" gradientUnits="userSpaceOnUse"><stop stop-color="#af7666"/><stop offset=".45" stop-color="#5b3c46"/><stop offset="1" stop-color="#b58770"/></linearGradient>
    </defs>
    <path d="M104 42 129 38 565 38 597 45 583 67 125 67 101 61ZM118 46H574V60H118Z" fill-rule="evenodd" fill="#100c15"/>
    <path d="M104 42 129 38 565 38 597 45 583 67 125 67 101 61Z" stroke="#1c121b" stroke-width="5"/>
    <path d="M111 43 133 41H562L587 47 576 63H129L109 58" stroke="url(#grimm-rim)" stroke-width="2"/>
    <path d="m118 71 119 1 31 4 251-3 49-6" stroke="#7b424a" stroke-opacity=".65"/>
    <path d="m121 31 67-3 16-5M210 29h119" stroke="#9e7069" stroke-opacity=".5"/>
    <path d="m563 41 36-22-7 21 37-11-22 22 21 5-43 12-18-8" fill="#21151f" stroke="#6e4048" stroke-width="1.4"/>
    <path d="m591 42 20-7-22 19 18 2-27 9" fill="#681d33"/>
    <path d="M102 37 75 10 72 31 44 17 50 38 13 27 37 49 17 59 52 62 46 79 78 70 102 88 112 61Z" fill="url(#grimm-cape)" stroke="#73505a" stroke-width="1.4"/>
    <path d="m31 38 36 14-22 3 29 9M84 31l15 19 1 23" stroke="#b44558" stroke-opacity=".55"/>
    <g class="grimm-mask">
      <path d="m63 28 10 8 11-17 1 17 16-7-9 20-3 18-11 10-12-14-3-18Z" fill="url(#grimm-metal)" stroke="#d6b9a0" stroke-width="1.2"/>
      <path d="m67 44 9 7-6 9-4-10Zm18-1-6 9 6 7 5-13Z" fill="#140d17"/>
      <path d="m70 48 4 3-3 4m13-7-3 4 3 2" stroke="#ff4962" stroke-width="1.4"/>
      <path d="m76 59 2 11 4-12" fill="#24131f"/><path d="m68 37 7 3m11-3-5 3" stroke="#f0d5b4" stroke-opacity=".7"/>
    </g>
    <path class="grimm-seal" d="m367 38 5 7-5 7-5-7Zm0 14v12" stroke="#d1977c" fill="#3d1826"/>
    <g class="grimm-embers" fill="#e78a6c"><path d="m38 19 2-7 2 4-1 5Z"/><path d="m111 23 3-6 1 5-3 4Z"/><path d="m601 73 5-3-2 5-3 1Z"/></g>
  </svg>
</template>
