<template>
  <!-- 左侧团绒较低，右侧羽翼向上挑起；三颗悬坠的体积、高度各不相同。 -->
  <svg class="boss-frame kedama-frame" viewBox="0 0 640 100" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="kedama-feather" x1="548" y1="14" x2="589" y2="70" gradientUnits="userSpaceOnUse"><stop stop-color="#f2e7ef"/><stop offset=".4" stop-color="#c6b4d3"/><stop offset="1" stop-color="#6a507b"/></linearGradient>
      <linearGradient id="kedama-fur" x1="43" y1="35" x2="99" y2="71" gradientUnits="userSpaceOnUse"><stop stop-color="#efe7df"/><stop offset=".45" stop-color="#c5b7cf"/><stop offset="1" stop-color="#786386"/></linearGradient>
      <linearGradient id="kedama-rim" x1="96" y1="42" x2="564" y2="62" gradientUnits="userSpaceOnUse"><stop stop-color="#d8bfda"/><stop offset=".6" stop-color="#94749f"/><stop offset="1" stop-color="#e5d6d9"/></linearGradient>
    </defs>
    <path d="m91 42 33-5 394 3 42-8 21 15-16 18-43-2-389 3-36-7ZM121 47H564V59H121Z" fill-rule="evenodd" fill="#211a2c"/>
    <path d="m91 42 33-5 394 3 42-8 21 15-16 18-43-2-389 3-36-7Z" stroke="#433448" stroke-width="4"/>
    <path d="m104 43 25-2 386 3 39-7 16 11-12 12-40-1-383 4-28-7" stroke="url(#kedama-rim)" stroke-width="2"/>
    <path d="m126 69 48-1 19 4 103-2M379 68l111 1 24-4" stroke="#ab8fbb" stroke-opacity=".55"/>
    <path d="M95 48 77 35 55 34 61 40 41 38 47 46 28 47 39 54 24 61 43 65 40 73 60 69 76 77 83 66 106 62Z" fill="url(#kedama-fur)" stroke="#4f405e" stroke-width="1.4"/>
    <path d="m43 51 14 2-7 7 18-4-3 10 17-8M79 43l12 10" stroke="#f8e8e8" stroke-opacity=".7" stroke-width="1.7"/>
    <path d="m94 42-8-17 14 9 6-17 6 21 17-7-13 18" fill="#ad94c4" stroke="#5b456b" stroke-width="1.2"/>
    <g class="kedama-wing">
      <path d="M544 45 554 27 574 12 573 28 596 15 587 34 614 29 598 46 620 46 603 57 610 63 584 65 567 60 550 63Z" fill="url(#kedama-feather)" stroke="#57425f" stroke-width="1.4"/>
      <path d="m559 48 26-18-10 17 25-9-17 15 20-2-15 7-23-2" fill="#dfd0e6" fill-opacity=".72"/>
      <path d="m555 53 25-18m-14 21 27-12" stroke="#785c90" stroke-width="1.2"/>
    </g>
    <g class="kedama-charms" stroke="#a58aaf" stroke-width="1.2">
      <path d="m98 64-2 12m19-12 5 18m405-19 2 10"/>
      <path d="m90 76 5-3 6 2 2 6-4 5-6-1-4-5Z" fill="#e2d5df"/>
      <path d="m115 83 5-3 6 3 1 6-6 4-7-4Z" fill="#ac8fc1"/>
      <path d="m522 74 4-3 5 2 1 5-5 4-5-3Z" fill="#c6b2cf"/>
    </g>
    <path class="kedama-knot" d="m326 38 8 6-6 5 6 9-11-5-9 6 3-10-6-6 11-1Z" fill="#dbc5de" stroke="#745380" stroke-width="1.2"/>
    <g class="kedama-flecks" fill="#efdde8"><path d="m142 30 5-4-1 7Z"/><path d="m506 23 4-3-1 7Z"/><path d="m586 76 5-1-2 5Z"/></g>
  </svg>
</template>
