<script setup lang="ts">
import { computed } from 'vue'
import type { CaveModule } from '../game/cave/CaveModule'
import type { Dir } from '../game/cave/dungeon/types'
import { t } from '../i18n'
const props=defineProps<{cave:CaveModule;tick:number}>()
const view=computed(()=>{void props.tick;return props.cave.getNeighborView()})
// 每扇门独立一个邻块，同方向按墙上门序展开，不再混合房型和敌人数。
const nodes=computed(()=>view.value.neighbors.map((n,index)=>{
  const group=view.value.neighbors.filter(p=>p.dir===n.dir),i=group.indexOf(n),offset=(i-(group.length-1)/2)*35
  const pos:Record<Dir,[number,number]>={N:[90+offset,25],S:[90+offset,133],W:[25,79+offset],E:[155,79+offset]}
  return {...n,index,x:pos[n.dir][0],y:pos[n.dir][1]}
}))
</script>
<template>
  <div class="nmap hud-surface">
    <header><span>{{t('ui.nmap.title')}}</span><small>{{t('ui.nmap.key')}}</small></header>
    <svg viewBox="0 0 180 158" aria-hidden="true">
      <g v-for="n in nodes" :key="n.index">
        <path :d="`M90 79 Q${n.x} 79 ${n.x} ${n.y}`" :class="n.open?'open':'sealed'" fill="none" stroke-width="2"/>
        <rect :x="n.x-14" :y="n.y-10" width="28" height="20" rx="2" :class="['room',n.visited?'visited':'fog']"/>
        <text :x="n.x" :y="n.y+4">{{n.visited?t(`ui.room.${n.kind}.tag`):'?'}}</text>
        <circle v-if="n.visited&&n.enemies>0" :cx="n.x+12" :cy="n.y-9" r="2.5" class="enemy"/>
      </g>
      <rect x="74" y="67" width="32" height="24" rx="2" class="current"/>
      <text x="90" y="83">{{t(`ui.room.${view.kind}.tag`)}}</text>
    </svg>
    <footer><span class="open-key">{{t('ui.nmap.legend.open')}}</span><span class="sealed-key">{{t('ui.nmap.legend.sealed')}}</span></footer>
  </div>
</template>
<style scoped>
.nmap{width:164px;padding:7px 8px 6px;box-sizing:border-box;pointer-events:none;background:linear-gradient(145deg,#15192324,#15192308);border:1px solid #c4ae791f;border-radius:5px;box-shadow:none}
header{display:flex;justify-content:space-between;align-items:center;color:#ceb589aa;font-size:10px;letter-spacing:1px}header small{font-size:8px;color:#b1a68c80;border:1px solid #c4ae7926;border-radius:2px;padding:0 3px}
svg{width:100%;display:block}.room{fill:#26273340;stroke:#b09b7080;stroke-width:.8}.fog{fill:#25263120;stroke:#aba4b04d;stroke-dasharray:2 2}.visited{fill:#79634430}.current{fill:#a489512e;stroke:#ead09acc;stroke-width:1.3}
text{font-size:10px;fill:#e0cfb1c9;text-anchor:middle;font-family:var(--font-body);paint-order:stroke;stroke:#10141b88;stroke-width:1.5}.open{stroke:#a1b38188}.sealed{stroke:#bf857a99}.enemy{fill:#e18b7acc}
footer{display:flex;justify-content:space-between;font-size:8px;color:#a99a8080}.open-key{color:#a9ba8d99}.sealed-key{color:#d0998a99}
</style>
