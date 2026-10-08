<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CaveModule, FloorMapView } from '../game/cave/CaveModule'
import type { Dir } from '../game/cave/dungeon/types'
import { t } from '../i18n'

const props=defineProps<{cave:CaveModule;tick:number;depth:number}>()
const emit=defineEmits<{close:[]}>()
type MapRoom=FloorMapView['rooms'][number]
const CELL=118
const view=computed(()=>{void props.tick;return props.cave.getFloorMapView()})
const roomById=computed(()=>new Map(view.value.rooms.map(room=>[room.id,room])))
const knownRooms=computed(()=>view.value.rooms.filter(room=>room.visited))
const currentRoom=computed(()=>roomById.value.get(view.value.currentId))
const selectedId=ref<number|null>(null),hoverId=ref<number|null>(null)
const selectedRoom=computed(()=>knownRooms.value.find(r=>r.id===(selectedId.value??view.value.currentId))??currentRoom.value)
const detailRoom=computed(()=>knownRooms.value.find(r=>r.id===hoverId.value)??selectedRoom.value)
const clearedCount=computed(()=>knownRooms.value.filter(r=>r.cleared).length)
const center=(r:MapRoom)=>({x:r.sx*CELL,y:r.sy*CELL})
const kindName=(kind:string)=>t(`ui.room.${kind}.name`)
const status=(r:MapRoom)=>t(r.enemiesAlive>0?'ui.map.hover.danger':r.cleared?'ui.map.hover.cleared':'ui.map.hover.sealed')

/** 图面只围绕已测绘区域适配，未访房间的坐标不参与视野计算。 */
const bounds=computed(()=>{
  const points=knownRooms.value.map(center)
  if(!points.length)return {cx:0,cy:0,w:480,h:360}
  const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x))
  const minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y))
  return {cx:(minX+maxX)/2,cy:(minY+maxY)/2,w:Math.max(480,maxX-minX+200),h:Math.max(360,maxY-minY+180)}
})
const zoom=ref(1),pan=ref({x:0,y:0}),svg=ref<SVGSVGElement|null>(null),dragging=ref(false)
const viewport=computed(()=>({x:bounds.value.cx+pan.value.x-bounds.value.w/zoom.value/2,y:bounds.value.cy+pan.value.y-bounds.value.h/zoom.value/2,w:bounds.value.w/zoom.value,h:bounds.value.h/zoom.value}))
const viewBox=computed(()=>{const v=viewport.value;return `${v.x} ${v.y} ${v.w} ${v.h}`})
function fit():void{zoom.value=1;pan.value={x:0,y:0}}
function locate():void{if(!currentRoom.value)return;const p=center(currentRoom.value);pan.value={x:p.x-bounds.value.cx,y:p.y-bounds.value.cy};selectedId.value=currentRoom.value.id;hoverId.value=null}
function changeZoom(next:number,anchor?:{x:number;y:number}):void{
  const value=Math.max(1,Math.min(2.6,Math.round(next*100)/100))
  if(anchor){const ratio=zoom.value/value;pan.value={x:anchor.x-(anchor.x-bounds.value.cx-pan.value.x)*ratio-bounds.value.cx,y:anchor.y-(anchor.y-bounds.value.cy-pan.value.y)*ratio-bounds.value.cy}}
  zoom.value=value
}
function wheel(e:WheelEvent):void{
  if(dragging.value||!e.deltaY)return
  const matrix=svg.value?.getScreenCTM()
  const point=matrix?new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse()):undefined
  changeZoom(zoom.value+(e.deltaY<0?.12:-.12),point)
}
let drag:{id:number;x:number;y:number;panX:number;panY:number;scaleX:number;scaleY:number}|null=null
function startPan(e:PointerEvent):void{
  if(e.button!==0||e.target instanceof Element&&e.target.closest('[data-room]'))return
  const matrix=svg.value?.getScreenCTM();if(!matrix||!svg.value)return
  drag={id:e.pointerId,x:e.clientX,y:e.clientY,panX:pan.value.x,panY:pan.value.y,scaleX:matrix.a,scaleY:matrix.d}
  svg.value.setPointerCapture(e.pointerId);dragging.value=true
}
function movePan(e:PointerEvent):void{
  if(!drag||drag.id!==e.pointerId)return
  pan.value={x:Math.max(-bounds.value.w*.65,Math.min(bounds.value.w*.65,drag.panX-(e.clientX-drag.x)/drag.scaleX)),y:Math.max(-bounds.value.h*.65,Math.min(bounds.value.h*.65,drag.panY-(e.clientY-drag.y)/drag.scaleY))}
}
function endPan(e:PointerEvent):void{if(drag?.id!==e.pointerId)return;if(svg.value?.hasPointerCapture(e.pointerId))svg.value.releasePointerCapture(e.pointerId);drag=null;dragging.value=false}
function slab(r:MapRoom,w=82,h=62):string{
  const {x,y}=center(r),j=Math.sin(r.id*37.1)*2
  return `M${x-w/2+3} ${y-h/2+2} L${x+w/2-5} ${y-h/2+j} L${x+w/2+1} ${y+h/2-5} L${x+w/2-5} ${y+h/2+1} L${x-w/2+2} ${y+h/2+j} L${x-w/2-1} ${y-h/2+8} Z`
}

/** 每扇门沿自己的墙边锚点出发，多门按真实墙面顺序分开显示。 */
const connections=computed(()=>{
  const peers=new Map<string,FloorMapView['doors']>()
  const vectors:Record<Dir,[number,number]>={N:[0,-1],S:[0,1],E:[1,0],W:[-1,0]}
  for(const d of view.value.doors)for(const [id,dir] of [[d.a,d.dirA],[d.b,d.dirB]] as const){const key=`${id}:${dir}`;const group=peers.get(key)??[];group.push(d);peers.set(key,group)}
  const anchor=(room:MapRoom,dir:Dir,id:number)=>{
    const group=[...(peers.get(`${room.id}:${dir}`)??[])].sort((a,b)=>{
      const ra=roomById.value.get(a.a===room.id?a.b:a.a)!,rb=roomById.value.get(b.a===room.id?b.b:b.a)!
      return dir==='N'||dir==='S'?ra.sx-rb.sx:ra.sy-rb.sy
    })
    const offset=(group.findIndex(d=>d.id===id)-(group.length-1)/2)*14,p=center(room),[dx,dy]=vectors[dir]
    return {x:p.x+dx*42+(dx?0:offset),y:p.y+dy*32+(dy?0:offset),dx,dy}
  }
  return view.value.doors.filter(d=>d.aVisited||d.bVisited).map(d=>{
    const a=roomById.value.get(d.a)!,b=roomById.value.get(d.b)!
    if(d.aVisited&&d.bVisited){
      const p=anchor(a,d.dirA,d.id),q=anchor(b,d.dirB,d.id),bend=Math.max(30,Math.hypot(q.x-p.x,q.y-p.y)*.42)
      return {...d,frontier:false,path:`M${p.x} ${p.y} C${p.x+p.dx*bend} ${p.y+p.dy*bend} ${q.x+q.dx*bend} ${q.y+q.dy*bend} ${q.x} ${q.y}`,tip:null}
    }
    const p=anchor(d.aVisited?a:b,d.aVisited?d.dirA:d.dirB,d.id),tip={x:p.x+p.dx*29,y:p.y+p.dy*29}
    return {...d,frontier:true,path:`M${p.x} ${p.y} L${tip.x} ${tip.y}`,tip}
  })
})

/** 路线只沿已探索房间计算，优先选择可通行路线；无路时才标出待解封的连接。 */
const route=computed(()=>{
  const target=detailRoom.value?.id,start=view.value.currentId
  if(target===undefined||target===start)return []
  const known=new Set(knownRooms.value.map(r=>r.id)),links=new Map<number,Array<{room:number;door:number;open:boolean}>>()
  for(const d of view.value.doors){if(!known.has(d.a)||!known.has(d.b))continue;for(const [a,b] of [[d.a,d.b],[d.b,d.a]] as const){const list=links.get(a)??[];list.push({room:b,door:d.id,open:d.open});links.set(a,list)}}
  const search=(openOnly:boolean):number[]|null=>{
    const previous=new Map<number,{room:number;door:number}>(),queue=[start],seen=new Set([start])
    for(let i=0;i<queue.length&&!seen.has(target);i++)for(const edge of links.get(queue[i]!)??[]){if(seen.has(edge.room)||openOnly&&!edge.open)continue;seen.add(edge.room);previous.set(edge.room,{room:queue[i]!,door:edge.door});queue.push(edge.room)}
    if(!seen.has(target))return null
    const ids:number[]=[];let cursor=target
    while(cursor!==start){const step=previous.get(cursor)!;ids.unshift(step.door);cursor=step.room}
    return ids
  }
  return search(true)??search(false)??[]
})
const routeIds=computed(()=>new Set(route.value))
const blockedRoute=computed(()=>route.value.some(id=>!view.value.doors.find(d=>d.id===id)?.open))
const adjacentCount=computed(()=>detailRoom.value?view.value.doors.filter(d=>d.a===detailRoom.value!.id||d.b===detailRoom.value!.id).length:0)
</script>

<template>
  <div class="map-mask hud-modal" @click.self="emit('close')">
    <section class="map-panel gpanel-pop hud-panel" role="dialog" aria-modal="true" aria-labelledby="survey-title">
      <header class="map-head"><div><span class="map-kicker">{{t('ui.map.record')}}</span><h2 id="survey-title">{{t('ui.map.title')}}</h2></div><div class="map-head-right"><span class="depth-seal">{{t('ui.map.floor',{n:depth})}}</span><button class="close-nail" :aria-label="t('ui.common.close_m_esc')" @click="emit('close')">×</button></div></header>
      <div class="map-layout">
        <div class="chart-column">
          <div class="chart-toolbar"><span>{{t('ui.map.charted',{n:knownRooms.length})}}</span><div><button :disabled="zoom<=1" :aria-label="t('ui.map.zoom_out')" @click="changeZoom(zoom-.2)">−</button><span class="zoom-readout">{{Math.round(zoom*100)}}%</span><button :disabled="zoom>=2.6" :aria-label="t('ui.map.zoom_in')" @click="changeZoom(zoom+.2)">+</button><button class="text-tool" @click="fit">{{t('ui.map.fit')}}</button><button class="text-tool" @click="locate">{{t('ui.map.locate')}}</button></div></div>
          <div class="map-stage" :class="{dragging}">
            <svg ref="svg" :viewBox="viewBox" class="map-svg" :aria-label="t('ui.map.chart_label')" @wheel.prevent="wheel" @pointerdown="startPan" @pointermove="movePan" @pointerup="endPan" @pointercancel="endPan" @lostpointercapture="endPan">
              <defs><pattern id="mine-survey-grid" width="59" height="59" patternUnits="userSpaceOnUse"><path d="M59 0H0V59" fill="none" stroke="#806b47" stroke-width=".55" opacity=".14"/></pattern></defs>
              <rect :x="viewport.x" :y="viewport.y" :width="viewport.w" :height="viewport.h" fill="url(#mine-survey-grid)"/>
              <g class="map-connections" aria-hidden="true">
                <g v-for="d in connections" :key="d.id"><path v-if="routeIds.has(d.id)" :d="d.path" class="route-underlay"/><path :d="d.path" :class="['doorline',d.open?'open':'sealed',{'frontier':d.frontier}]"/><g v-if="d.tip" class="frontier-mark"><circle :cx="d.tip.x" :cy="d.tip.y" r="10"/><text :x="d.tip.x" :y="d.tip.y+4">?</text></g></g>
              </g>
              <g v-for="r in knownRooms" :key="r.id" class="room" :class="{inspected:detailRoom?.id===r.id}" :data-room="r.id" role="button" tabindex="0" :aria-label="t('ui.map.room_label',{name:kindName(r.kind),status:status(r)})" :aria-pressed="selectedRoom?.id===r.id" @mouseenter="hoverId=r.id" @mouseleave="hoverId=null" @focus="hoverId=r.id" @blur="hoverId=null" @click="selectedId=r.id" @keydown.enter.stop.prevent="selectedId=r.id" @keydown.space.stop.prevent="selectedId=r.id">
                <path v-if="r.current" :d="slab(r,96,78)" class="current-outline"/>
                <path :d="slab(r)" :class="['slab',r.cleared?'cleared':'seen',{'is-current':r.current}]"/>
                <path :d="slab(r,71,51)" class="slab-inset"/>
                <text :x="center(r).x" :y="center(r).y+7" class="tag">{{t(`ui.room.${r.kind}.tag`)}}</text>
                <path v-if="r.current" :d="`M${center(r).x-7} ${center(r).y-46}h14l-7 10Z`" class="current-arrow"/>
                <path v-if="r.cleared" :d="`M${center(r).x+23} ${center(r).y+13}l4 4 8-10`" class="clear-check"/>
                <circle v-if="r.enemiesAlive>0" :cx="center(r).x+29" :cy="center(r).y-19" r="4" class="enemy-dot"/>
                <g v-if="r.oresLeft>0" class="ore-count" aria-hidden="true"><path :d="`M${center(r).x-13} ${center(r).y+46}l9-10m-12 2q7-7 13-1`"/><text :x="center(r).x+3" :y="center(r).y+47">{{r.oresLeft}}</text></g>
              </g>
            </svg>
            <div class="map-compass" aria-hidden="true"><svg viewBox="0 0 46 54"><path d="M23 20L14 43L23 37L32 43Z" fill="#8f7350"/><path d="M23 20V37L32 43Z" fill="#c1a87a"/><path d="M9 33H37M23 15V47" stroke="#8d78513b"/></svg><span>{{t('ui.map.north')}}</span></div>
            <span class="chart-note">{{t('ui.map.chart_note')}}</span>
          </div>
          <div class="chart-hint">{{t('ui.map.controls')}}</div>
        </div>
        <aside class="survey-record">
          <span class="record-tab">{{t('ui.map.room_record')}}</span>
          <template v-if="detailRoom"><div class="record-heading"><span>{{detailRoom.current?t('ui.map.legend.current'):t('ui.map.inspected')}}</span><h3>{{kindName(detailRoom.kind)}}</h3><span class="room-status" :class="{danger:detailRoom.enemiesAlive>0}">{{status(detailRoom)}}</span></div>
            <dl class="room-stats"><div><dt>{{t('ui.map.enemies')}}</dt><dd :class="{danger:detailRoom.enemiesAlive>0}">{{detailRoom.enemiesAlive}}</dd></div><div><dt>{{t('ui.map.ores')}}</dt><dd>{{detailRoom.oresLeft}}</dd></div><div><dt>{{t('ui.map.passages')}}</dt><dd>{{adjacentCount}}</dd></div></dl>
            <div class="route-record"><span>{{t('ui.map.route')}}</span><strong>{{detailRoom.current?t('ui.map.here'):route.length?t('ui.map.route_length',{n:route.length}):t('ui.map.route_unknown')}}</strong><small v-if="!detailRoom.current&&route.length" :class="{danger:blockedRoute}">{{t(blockedRoute?'ui.map.route_sealed':'ui.map.route_open')}}</small></div>
          </template>
          <div class="survey-progress"><span>{{t('ui.map.cleared_count',{n:clearedCount})}}</span><div class="progress-track" aria-hidden="true"><i :style="{width:`${knownRooms.length?clearedCount/knownRooms.length*100:0}%`}"></i></div><small>{{t('ui.map.record_hint')}}</small></div>
        </aside>
      </div>
      <footer class="map-legend"><span><i class="lg cur"></i>{{t('ui.map.legend.current')}}</span><span><i class="lg clear"></i>{{t('ui.map.legend.cleared')}}</span><span><i class="lg seen"></i>{{t('ui.map.legend.seen')}}</span><span><i class="lg fog">?</i>{{t('ui.map.unexplored')}}</span><span><i class="lg dl-open"></i>{{t('ui.map.legend.door_open')}}</span><span><i class="lg dl-seal"></i>{{t('ui.map.legend.door_sealed')}}</span><span class="close-hint">{{t('ui.map.legend.hint')}}</span></footer>
    </section>
  </div>
</template>

<style scoped>
/* 木质图板、测绘纸与夹扣；颜色与营地手账和选层页保持一致。 */
.map-mask{position:absolute;inset:0;display:grid;place-items:center;padding:22px;box-sizing:border-box;z-index:1300;background:#15101bb3;cursor:default}.map-panel{width:min(1130px,96vw);max-height:calc(100dvh - 44px);overflow:auto;box-sizing:border-box;padding:23px 25px 18px;border:7px solid #4f3d30;border-radius:3px;background:repeating-linear-gradient(2deg,transparent 0 25px,#c6a27006 26px,transparent 27px 51px),linear-gradient(135deg,#42362f,#29252d);box-shadow:0 22px 70px #080912a6,0 0 0 1px #ad8e5a,inset 0 0 0 1px #8a74524d;color:#d9c5a1}
.map-head{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:0 2px 17px;border-bottom:1px solid #a98c593b;margin-bottom:18px}.map-kicker{font-size:10px;color:#a79170;letter-spacing:3px}.map-head h2{margin:7px 0 0;font-size:24px;font-weight:normal;letter-spacing:4px}.map-head-right{display:flex;align-items:center;gap:22px}.depth-seal{padding:7px 12px;border:1px solid #ba9a644d;background:#b28f510b;color:#d6bb8c;font-size:12px;letter-spacing:2px}.close-nail{padding:0 4px;background:none;border:none;color:#b5a184;font:inherit;font-size:25px;cursor:pointer}.close-nail:hover{color:#f0d4a3}
.map-layout{display:grid;grid-template-columns:minmax(0,1fr) 215px;gap:18px}.chart-column{min-width:0}.chart-toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 2px 10px;font-size:10px;color:#b29a76}.chart-toolbar>div{display:flex;align-items:center;gap:4px}.chart-toolbar button{height:25px;min-width:25px;padding:2px 6px;border:1px solid #92744866;background:#332b2a;color:#d6bc8f;font:inherit;font-size:15px;cursor:pointer;box-shadow:inset 0 1px #d2b47b1c}.chart-toolbar .text-tool{font-size:10px;min-width:38px;letter-spacing:1px;margin-left:3px}.chart-toolbar button:disabled{opacity:.35;cursor:default}.chart-toolbar button:hover:enabled{background:#5c4831}.zoom-readout{font-size:9px;min-width:38px;text-align:center;color:#ad9a7b;font-variant-numeric:tabular-nums}
.map-stage{position:relative;isolation:isolate;height:clamp(300px,54dvh,565px);overflow:hidden;border:1px solid #9b845f;border-left:4px solid #8c7655;border-bottom:3px double #9c835b;background:repeating-linear-gradient(0deg,transparent 0 3px,#795a3605 3px 4px),radial-gradient(ellipse at 100% 0,#b8976026,transparent 60%),linear-gradient(110deg,#cbbb98,#e0d2b2 10%,#d8c6a2);box-shadow:inset 3px 0 7px #6d51312b,inset 0 0 25px #80653812}.map-stage::after{content:'';position:absolute;inset:9px;border:1px solid #997e4b2b;pointer-events:none;background:linear-gradient(90deg,transparent 49.6%,#9072450b 49.9%,#ffefcc38 50.2%,transparent 50.5%)}.map-svg{display:block;width:100%;height:100%;touch-action:none;cursor:grab;user-select:none}.dragging .map-svg{cursor:grabbing}.map-compass{position:absolute;right:17px;top:11px;width:38px;height:50px;pointer-events:none;color:#917956}.map-compass svg{width:100%;height:100%;display:block}.map-compass span{position:absolute;top:0;left:0;width:100%;text-align:center;font-size:10px}.chart-note{position:absolute;left:16px;bottom:12px;font-size:9px;letter-spacing:1px;color:#9b815a;pointer-events:none}.chart-hint{padding:9px 1px 0;font-size:10px;color:#a89271;line-height:1.7}
.doorline{fill:none;stroke-width:2.6;stroke-linecap:round;pointer-events:none}.doorline.open{stroke:#7f8b66;stroke-dasharray:7 5}.doorline.sealed{stroke:#a17263}.doorline.frontier{stroke-dasharray:3 4;opacity:.7}.route-underlay{fill:none;stroke:#cba454;stroke-width:8;stroke-linecap:round;opacity:.42}.frontier-mark circle{fill:#d9caa9;stroke:#9b8967;stroke-width:.8}.frontier-mark text{font-size:12px;fill:#927e5b;text-anchor:middle;font-family:var(--font-body)}
.room{cursor:pointer;outline:none}.slab{fill:#d0bd99;stroke:#806b4b;stroke-width:1.6;filter:drop-shadow(1px 3px 1px #71552d33)}.slab.cleared{fill:#d5d2ae;stroke:#85916c}.slab.is-current{fill:#e5cdab;stroke:#a2654f;stroke-width:2.6}.slab-inset{fill:none;stroke:#9479514f;stroke-width:.8;pointer-events:none}.current-outline{fill:#bd856911;stroke:#a8705b77;stroke-width:1.2;stroke-dasharray:4 5;pointer-events:none}.current-arrow{fill:#a05d49;stroke:#704731;stroke-width:.8;pointer-events:none}.clear-check{fill:none;stroke:#788857;stroke-width:2;stroke-linecap:round;pointer-events:none}.enemy-dot{fill:#b06153;stroke:#8c4b3e;stroke-width:.8;pointer-events:none}.tag{text-anchor:middle;font-family:var(--font-body);font-size:23px;fill:#69563b;pointer-events:none}.is-current~.tag{fill:#8b5942}.room.inspected .slab,.room:focus-visible .slab{stroke:#b48b42;stroke-width:3;filter:drop-shadow(1px 3px 2px #8058294d)}.room:hover .slab{fill:#e9d8b4}.ore-count{pointer-events:none}.ore-count path{fill:none;stroke:#8b805f;stroke-width:1.2}.ore-count text{font-size:11px;fill:#817256;font-family:var(--font-body)}
.survey-record{position:relative;display:flex;flex-direction:column;min-width:0;padding:25px 19px 17px;border:1px solid #a08b66;border-left:5px solid #887358;border-bottom:3px double #9b835d;background:repeating-linear-gradient(0deg,transparent 0 3px,#6d532b05 3px 4px),linear-gradient(105deg,#c7b492,#e2d2b1 8%,#d6c19b);box-shadow:inset 3px 0 7px #6d51312b;color:#5b4b34}.record-tab{position:absolute;right:15px;top:-5px;font-size:10px;letter-spacing:2px;padding:6px 10px;border:1px solid #977649;background:linear-gradient(#8c704b,#66523b);color:#e8d1a4;box-shadow:0 2px 3px #4c382e33}.record-heading>span:first-child{font-size:10px;letter-spacing:1px;color:#95805c}.record-heading h3{font-size:23px;font-weight:normal;letter-spacing:2px;margin:13px 0 12px}.room-status{display:inline-block;padding:4px 8px;border:1px solid #8c916f4d;font-size:10px;color:#71805a;background:#78925809}.danger{color:#a26751!important}.room-status.danger{border-color:#a9775640;background:#a5725108}.room-stats{margin:22px 0 20px;padding:13px 0;border-top:1px solid #92795433;border-bottom:1px solid #92795433}.room-stats>div{display:flex;align-items:center;justify-content:space-between;padding:7px 0}.room-stats dt{font-size:11px;color:#8b7755}.room-stats dd{margin:0;font-size:20px;font-variant-numeric:tabular-nums;color:#685b42}.route-record>span{display:block;font-size:10px;color:#95805d;letter-spacing:1px}.route-record strong{display:block;margin-top:9px;font-size:12px;font-weight:normal;line-height:1.8;color:#776043}.route-record small{display:block;margin-top:6px;font-size:10px;color:#8b9270}.survey-progress{margin-top:auto;padding-top:24px}.survey-progress>span{font-size:10px;color:#8a7654}.progress-track{height:3px;background:#8d754926;margin:9px 0 15px}.progress-track i{display:block;height:100%;background:#8c9a71}.survey-progress small{font-size:10px;line-height:1.9;display:block;color:#a18a63}
.map-legend{display:flex;align-items:center;flex-wrap:wrap;gap:10px 16px;border-top:1px solid #ab8b5633;margin-top:17px;padding-top:13px;font-size:10px;color:#b8a17f}.map-legend>span{display:inline-flex;align-items:center;gap:6px}.lg{display:inline-block;box-sizing:border-box;width:11px;height:11px;border:1px solid #a4885b}.lg.cur{clip-path:polygon(0 0,100% 0,50% 100%);background:#c28a6a;border:0}.lg.clear{background:#929a71;border-color:#b4bf8f}.lg.seen{background:#8b714e}.lg.fog{font-style:normal;text-align:center;font-size:10px;line-height:10px;border-style:dashed;color:#b7a17a}.lg.dl-open,.lg.dl-seal{width:18px;height:3px;border:0}.lg.dl-open{background:repeating-linear-gradient(90deg,#a3b087 0 5px,transparent 5px 8px)}.lg.dl-seal{background:#b18572}.close-hint{margin-left:auto;color:#978267}.chart-toolbar button:focus-visible,.close-nail:focus-visible{outline:2px solid #d5b47b;outline-offset:3px}
@media(max-width:900px){.map-panel{padding:20px 18px 16px}.map-layout{grid-template-columns:minmax(0,1fr) 185px;gap:12px}.survey-record{padding:23px 14px 15px}.map-legend{gap:9px 12px;font-size:9px}}
@media(max-width:680px){.map-mask{padding:15px}.map-panel{padding:18px 15px 15px;max-height:calc(100dvh - 30px);border-width:5px}.map-layout{grid-template-columns:1fr}.map-head h2{font-size:21px}.map-head-right{gap:12px}.map-stage{height:clamp(300px,48dvh,450px)}.survey-record{display:grid;grid-template-columns:1fr 1fr;gap:13px 20px;padding:20px 16px 15px}.record-heading{grid-column:1}.room-stats{grid-column:2;grid-row:1;margin:0;padding:0;border:0}.route-record{grid-column:1}.survey-progress{grid-column:2;padding-top:0;margin:0}.record-heading h3{font-size:20px}.record-tab{font-size:9px}.close-hint{margin-left:0}.map-head{margin-bottom:15px}}
@media(max-width:420px){.chart-toolbar{flex-wrap:wrap}.map-stage{height:300px}.map-head-right{gap:8px}.depth-seal{padding:6px 8px;font-size:10px}.map-head h2{font-size:19px;letter-spacing:2px}.survey-record{gap:13px}.chart-hint{font-size:9px}.map-legend{font-size:9px}}
@media(prefers-reduced-motion:reduce){.room .slab{filter:none}}
</style>
