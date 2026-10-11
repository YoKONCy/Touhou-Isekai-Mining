<script setup lang="ts">
import { computed,ref,watch } from 'vue'
import type { SearchView,SearchPlacement } from '../shared/search'
import { getItemDef } from '../shared/itemDefs'
import { itemQualityColor,gradeNameKey } from '../shared/itemQuality'
import { t,itemName } from '../i18n'
import ItemIcon from './ItemIcon.vue'
import KeyCap from './KeyCap.vue'
import { touchControls } from '../browser/display'

const props=defineProps<{view:SearchView}>()
const emit=defineEmits<{take:[slot:number];close:[]}>()
const hovered=ref<number|null>(null)
watch(()=>props.view.id,()=>{hovered.value=null})
const available=computed(()=>props.view.slots.filter(slot=>slot.revealed&&slot.item).length)
const found=computed(()=>props.view.slots.filter(slot=>slot.revealed).length)
// 布局从打开时就可见，物品身份仍只由揭示状态提供；拿走的物品不再占用视觉轮廓。
const visibleItems=computed(()=>props.view.slots.map((slot,index)=>({slot,index})).filter(entry=>!entry.slot.revealed||entry.slot.item))
const inspected=computed(()=>{
  const selected=hovered.value===null?null:props.view.slots[hovered.value]
  if(selected?.item)return selected.item
  for(let i=props.view.slots.length-1;i>=0;i--)if(props.view.slots[i]?.item)return props.view.slots[i]!.item
  return null
})
const state=computed(()=>t(props.view.blocked?'game.search.busy_other':props.view.complete?'ui.search.complete':!props.view.searching?'ui.search.interrupted':props.view.opening<1?'ui.search.opening':'ui.search.working'))
const gridStyle=(slot:SearchPlacement)=>({gridColumn:(slot.x+1)+' / span '+slot.width,gridRow:(slot.y+1)+' / span '+slot.height})
const color=(id:string|undefined)=>id?itemQualityColor(getItemDef(id)):'#c1a06c'
const qualityLabel=(id:string)=>{const def=getItemDef(id);return def.grade?t(gradeNameKey(def.grade)):t('ui.item.rarity',{n:def.rarity??1})}
</script>

<template>
  <aside :key="view.id" class="search-panel gpanel-mini hud-panel" :class="{blocked:view.blocked}" :style="{'--search-cols':view.cols,'--search-rows':view.rows}" :aria-label="t('ui.search.title')" @pointerdown.stop @mousedown.stop @click.stop @contextmenu.prevent>
    <header class="search-header">
      <span class="header-symbol" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M4 11L16 5L28 11V25L16 30L4 25ZM4 11L16 17L28 11M16 17V30M10 8L22 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></span>
      <div class="search-heading"><small>{{t('ui.search.caption')}}</small><h2>{{t(view.nameKey)}}</h2></div>
      <span class="grid-size">{{view.cols}}×{{view.rows}}</span>
      <button class="search-close" :aria-label="t('ui.search.close')" @click="emit('close')">×</button>
    </header>

    <div class="search-grid" role="group" :aria-label="t('ui.search.contents')">
      <div v-for="n in view.cols*view.rows" :key="'cell:'+n" class="grid-cell"
        :style="{gridColumn:(n-1)%view.cols+1,gridRow:Math.floor((n-1)/view.cols)+1}" aria-hidden="true"></div>
      <button v-for="{slot,index} in visibleItems" :key="view.id+':'+index" class="search-item"
        :class="[slot.feedback,{revealed:slot.revealed,fresh:slot.revealed&&slot.age<.45,active:view.active===index,prismatic:slot.prismatic}]"
        :style="{...gridStyle(slot),'--discovery-color':color(slot.item?.id),'--reveal-delay':-Math.max(0,slot.age)+'s'}"
        :disabled="view.blocked||!slot.revealed||!slot.item"
        :aria-label="slot.item?t('ui.search.take_named',{name:itemName(slot.item.id)}):t('ui.search.covered')"
        @mouseenter="hovered=index" @mouseleave="hovered=null" @focus="hovered=index" @blur="hovered=null" @click="emit('take',index)">
        <span v-if="slot.item" class="discovered-item"><ItemIcon :id="slot.item.id" :size="Math.min(slot.width,slot.height)>1?98:52" :durability="slot.item.durability" show-durability/></span>
        <span v-if="slot.item" class="item-label">{{itemName(slot.item.id)}}</span>
        <span v-if="slot.item" class="quality-mark" :aria-label="qualityLabel(slot.item.id)">{{slot.quality}}</span>
        <span v-if="slot.item&&slot.item.qty>1" class="search-qty">×{{slot.item.qty}}</span>
        <span v-if="slot.item" class="quality-stripe" aria-hidden="true"></span>
        <span v-if="slot.revealed&&slot.age<.45" class="discovery-rays" aria-hidden="true">✦</span>
        <span v-if="!slot.revealed||slot.age<.22" class="search-veil" :class="{opened:slot.revealed}" aria-hidden="true"><span v-if="!slot.revealed" class="unknown-mark">?</span></span>
        <span v-if="view.active===index" class="search-lens" aria-hidden="true">
          <svg class="lens-progress" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="none" stroke="#e7ca9138" stroke-width="1.5"/><circle cx="32" cy="32" r="28" fill="none" stroke="#f0cd7e" stroke-width="2" pathLength="100" stroke-dasharray="100" :stroke-dashoffset="100-view.progress*100" stroke-linecap="round" transform="rotate(-90 32 32)"/></svg>
          <svg class="lens-glass" viewBox="0 0 40 40"><path d="M25 26L35 36" stroke="#261c20" stroke-width="7" stroke-linecap="round"/><path d="M25 26L35 36" stroke="#c1a06c" stroke-width="4" stroke-linecap="round"/><circle cx="17" cy="18" r="12" fill="#241c2780" stroke="#35282a" stroke-width="4"/><circle cx="17" cy="18" r="12" fill="none" stroke="#e7ca91" stroke-width="1.8"/><path d="M10 16Q11 10 18 10" fill="none" stroke="#fff0d0" stroke-width="1.5" stroke-linecap="round"/></svg>
        </span>
      </button>
    </div>

    <div class="search-legend" aria-hidden="true"><span><i class="unknown-key"></i>{{t('ui.search.covered')}}</span><span><i class="revealed-key"></i>{{t('ui.search.revealed')}}</span></div>
    <div class="search-status" role="status" aria-live="polite"><span class="status-dot" :class="{working:view.searching&&!view.blocked,done:view.complete}"></span><span>{{state}}</span><small>{{t('ui.search.found',{n:found})}}</small></div>
    <div class="search-inspect">
      <template v-if="inspected"><strong :style="{color:color(inspected.id)}">{{itemName(inspected.id)}}</strong><span>{{getItemDef(inspected.id).unlockReward?t('ui.search.unlock_on_extract'):qualityLabel(inspected.id)}}</span></template>
      <span v-else class="inspect-hint">{{t('ui.search.inspect_hint')}}</span>
    </div>
    <footer>
      <button class="search-take gbtn primary" :disabled="view.blocked||!available" @click="emit('take',-1)"><KeyCap action="interact"/><span>{{t('ui.search.take_all')}}</span><small v-if="available">{{available}}</small></button>
      <button v-if="!view.complete&&!view.searching" class="search-resume gbtn" :disabled="view.blocked" @click="emit('take',-3)">{{t('ui.search.resume')}}</button>
    </footer>
    <p class="search-help"><template v-if="touchControls">{{t('ui.mobile.search_hint')}}</template><template v-else>{{t('ui.search.action_hint')}}<span>{{t('ui.search.escape_hint')}}</span></template></p>
  </aside>
</template>

<style scoped>
/* 沿用背包的皮革、绒布和黄铜；格子共用托盘边界，物品跨格时遮住内部格线。 */
.search-panel {
  --cell: clamp(58px, 9vh, 84px);
  position: absolute;
  right: clamp(16px, 2vw, 32px);
  top: 50%;
  transform: translateY(-50%);
  width: max(320px, calc(var(--search-cols) * var(--cell) + 36px));
  max-width: calc(100vw - 24px);
  max-height: calc(100% - 150px);
  overflow: auto;
  padding: 17px;
  border: 1px solid #8f7450;
  border-radius: 0;
  color: var(--text);
  background:
    radial-gradient(ellipse at 0 0, #d6b57513, transparent 55%),
    repeating-linear-gradient(35deg, #e0c99d04 0 1px, transparent 1px 5px),
    linear-gradient(135deg, #40343a, #2d252d 70%, #332a30);
  box-shadow: inset 0 2px 0 #c1a06c77, inset 0 0 0 4px #20192166, 0 12px 30px #0007;
  font-family: var(--font-body);
  z-index: 20;
  pointer-events: auto;
  cursor: auto;
  animation: panel-arrive .3s cubic-bezier(.2,.7,.3,1) both;
}
.search-header { display:flex; align-items:center; gap:10px; margin-bottom:16px; min-height:39px; }
.header-symbol { width:31px; height:34px; color:var(--brass); flex:none; }
.header-symbol svg { width:100%; height:100%; }
.search-heading { min-width:0; flex:1; }
.search-heading small { display:block; color:var(--text-dim); font-size:11px; letter-spacing:2px; line-height:1.6; }
.search-heading h2 { color:var(--brass-hi); font-size:18px; font-weight:normal; letter-spacing:2px; margin:3px 0 0; line-height:1.35; overflow-wrap:anywhere; }
.grid-size { font-size:12px; letter-spacing:1px; color:var(--text-dim); white-space:nowrap; }
.search-close { width:32px; height:32px; flex:none; padding:0; border:1px solid #8f745055; background:#241c27; color:var(--text-dim); font:25px/1 sans-serif; cursor:pointer; transition:color .15s,background .15s; }
.search-close:hover { background:#534038; color:var(--brass-hi); }

/* 空格始终是深色凹槽，未搜物件用整块不透明布面遮住，内部不再切成单格。 */
.search-grid {
  position:relative;
  display:grid;
  grid-template-columns:repeat(var(--search-cols),var(--cell));
  grid-template-rows:repeat(var(--search-rows),var(--cell));
  gap:0;
  width:max-content;
  margin:0 auto;
  isolation:isolate;
  border:1px solid #a98a5e;
  background:#1d171f;
  box-shadow:0 0 0 3px #201921, 0 0 0 4px #8f745040;
}
.grid-cell { position:relative; min-width:0; min-height:0; background:#1d171f; box-shadow:inset -1px -1px #8f745066, inset 0 2px 5px #0003; }
.grid-cell::after { content:""; position:absolute; left:50%; top:50%; width:4px; height:4px; transform:translate(-50%,-50%) rotate(45deg); background:#8f745066; }
.search-item {
  position:relative; min-width:0; min-height:0; padding:0; isolation:isolate; z-index:1; overflow:visible;
  border:0; border-radius:0;
  background:radial-gradient(ellipse at 50% 15%,#d4b87b18,transparent 75%),linear-gradient(145deg,#3d3035,#292029);
  box-shadow:inset 0 0 0 1px #a0886366;
  color:var(--text); font:inherit; cursor:pointer;
  transition:background .15s,box-shadow .15s;
}
.search-item:disabled { opacity:1; cursor:auto; }
.search-item:not(.revealed){margin:2px;}
.search-item.revealed:not(:disabled):hover { background:radial-gradient(ellipse at 50% 15%,#e1c58b25,transparent 75%),#48363b; box-shadow:inset 0 0 0 2px var(--brass-hi); z-index:3; }
.search-item.revealed:not(:disabled):hover .discovered-item { transform:scale(1.06); }
.search-item:focus-visible,.search-take:focus-visible,.search-resume:focus-visible,.search-close:focus-visible { outline:2px solid var(--brass-hi); outline-offset:2px; z-index:3; }
.discovered-item { position:absolute; inset:9px 6px 23px; display:grid; place-items:center; pointer-events:none; transition:transform .15s; }
.discovered-item :deep(.item-icon) { max-width:100%; max-height:100%; }
.item-label { position:absolute; bottom:7px; left:5px; right:5px; font-size:12px; line-height:1.2; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; pointer-events:none; text-shadow:0 1px 2px #000; }
.quality-mark { position:absolute; left:7px; top:5px; z-index:2; color:var(--discovery-color); font-size:12px; font-variant-numeric:tabular-nums; pointer-events:none; }
.search-qty { position:absolute; right:6px; top:5px; z-index:2; font-size:13px; color:#f5e6c9; text-shadow:0 1px 2px #171018; pointer-events:none; }
.quality-stripe { position:absolute; bottom:0; left:1px; right:1px; height:2px; background:var(--discovery-color); opacity:.9; pointer-events:none; }
.prismatic .quality-stripe { background:linear-gradient(90deg,#e8a1ae,#e6ce87,#9ed6b6,#9bc8ef,#c0a4e8); }
.search-veil {
  position:absolute; inset:0; z-index:3; pointer-events:none;
  background:repeating-linear-gradient(45deg,#e8cfad0c 0 1px,transparent 1px 6px),repeating-linear-gradient(-45deg,#21171d12 0 1px,transparent 1px 6px),linear-gradient(135deg,#715c4d,#57443e);
  box-shadow:inset 0 0 0 2px #c5aa7ca8,inset 0 0 0 4px #33252b88;
}
.search-veil::after { content:""; position:absolute; inset:8px; border:1px dashed #dcc29a66; }
.unknown-mark{position:absolute;inset:0;display:grid;place-items:center;font:28px var(--font-body);color:#ead4af;text-shadow:0 2px 2px #291b16;}
.search-item.active .unknown-mark{visibility:hidden;}
.search-item.active { z-index:2; box-shadow:inset 0 0 0 2px var(--brass-hi); }
.search-item.active .search-veil { box-shadow:inset 0 0 0 2px var(--brass-hi); }
.search-veil.opened { animation:veil-away .18s ease-out both; animation-delay:var(--reveal-delay); }
.search-lens { position:absolute; left:50%; top:50%; width:64px; height:64px; transform:translate(-50%,-50%); z-index:4; pointer-events:none; }
.lens-progress { position:absolute; inset:0; width:64px; height:64px; }
.lens-progress circle { transition:stroke-dashoffset .1s linear; }
.lens-glass { position:absolute; left:11px; top:11px; width:42px; height:42px; animation:lens-turn 1.3s linear infinite; transform-origin:50% 52%; }
.fresh .discovered-item { animation:item-find .4s cubic-bezier(.18,.75,.3,1) both; animation-delay:var(--reveal-delay); }
.discovery-rays { position:absolute; left:50%; top:44%; width:110px; height:110px; line-height:110px; margin:-55px 0 0 -55px; color:var(--discovery-color); font-size:105px; opacity:0; z-index:0; pointer-events:none; animation:find-rays .42s ease-out both; animation-delay:var(--reveal-delay); }
.ordinary .discovery-rays { font-size:55px; }
.rare.fresh,.legendary.fresh { animation:rare-find .45s ease-out both; animation-delay:var(--reveal-delay); }
.legendary .discovery-rays { font-size:135px; }

.search-legend { display:flex; gap:16px; margin-top:11px; color:var(--text-dim); font-size:11px; line-height:1.5; }
.search-legend span { display:flex; align-items:center; gap:6px; }
.search-legend i { width:11px; height:11px; border:1px solid #b99c7180; flex:none; }
.unknown-key { background:repeating-linear-gradient(45deg,#e8cfad22 0 1px,transparent 1px 4px),#715c4d; }
.revealed-key { background:#292029; box-shadow:inset 0 -2px #c1a06c; }
.search-status { display:flex; align-items:center; gap:7px; margin:12px 0 0; font-size:13px; color:var(--text); min-height:20px; line-height:1.5; }
.search-status>span:nth-child(2) { flex:1; }
.search-status small { font-size:11px; color:var(--text-dim); white-space:nowrap; }
.status-dot { width:6px; height:6px; flex:none; transform:rotate(45deg); background:#a08d79; }
.status-dot.working { background:var(--brass-hi); animation:search-breath 1.3s ease-in-out infinite; }
.status-dot.done { background:#9ecb92; }
.search-inspect { min-height:22px; display:flex; align-items:center; gap:9px; margin:6px 0 13px; font-size:12px; line-height:1.5; }
.search-inspect strong { font-weight:normal; flex:1; }
.search-inspect>span { color:var(--text-dim); font-size:11px; }
.search-inspect .inspect-hint { font-size:12px; }
footer { display:flex; gap:8px; }
.search-take,.search-resume { display:flex; align-items:center; justify-content:center; gap:9px; min-height:40px; padding:8px 12px; font:14px var(--font-body); letter-spacing:1px; }
.search-take { flex:1; }
.search-take small { min-width:18px; padding:1px 3px; background:#261c2070; color:var(--brass-hi); font-size:12px; }
.search-resume { font-size:12px; }
.search-take:disabled,.search-resume:disabled { cursor:auto; color:#b6a38a; background:#352a2e; border-color:#79614a55; box-shadow:inset 0 1px #b99c7120; filter:none; transform:none; }
.search-help { display:flex; justify-content:space-between; gap:12px; margin:13px 0 0; color:var(--text-dim); font-size:11px; line-height:1.5; }
.search-help span { white-space:nowrap; }
@keyframes panel-arrive { from{opacity:0;transform:translate(16px,-50%) scale(.98)}to{opacity:1;transform:translate(0,-50%) scale(1)} }
@keyframes veil-away { from{opacity:1}to{opacity:0} }
@keyframes item-find { 0%{transform:scale(.58);opacity:0}45%{transform:scale(1.18);opacity:1}74%{transform:scale(.97)}100%{transform:scale(1)} }
@keyframes find-rays { 0%{opacity:0;transform:scale(.25) rotate(-18deg)}30%{opacity:.42}100%{opacity:0;transform:scale(1.12) rotate(16deg)} }
@keyframes rare-find { 0%,100%{box-shadow:inset 0 0 0 1px #a0886366}35%{box-shadow:inset 0 0 0 2px var(--discovery-color),0 0 15px color-mix(in srgb,var(--discovery-color) 35%,transparent)} }
@keyframes lens-turn { from{transform:rotate(-18deg)}to{transform:rotate(342deg)} }
@keyframes search-breath { 0%,100%{opacity:.45}50%{opacity:1} }
@media(max-width:760px) {
  .search-panel { right:12px; --cell:clamp(52px,10vw,72px); padding:14px; width:max(290px,calc(var(--search-cols)*var(--cell) + 30px)); }
  .search-heading h2 { font-size:16px; }
  .search-header { gap:8px; margin-bottom:13px; }
  .header-symbol { width:25px; }
  .search-help { flex-wrap:wrap; gap:4px 12px; }
  .search-inspect { margin-bottom:10px; }
}
@media(max-height:650px) {
  .search-panel { --cell:54px; max-height:calc(100% - 110px); padding:13px; }
  .search-header { margin-bottom:11px; }
  .search-heading h2 { font-size:16px; }
  .search-legend { margin-top:8px; }
  .search-status { margin-top:8px; }
  .search-inspect { margin:3px 0 9px; }
  .discovered-item { inset:6px 5px 19px; }
  .item-label { font-size:11px; bottom:5px; }
  .search-lens,.lens-progress { width:46px; height:46px; }
  .lens-glass { left:8px; top:8px; width:30px; height:30px; }
  .search-help { margin-top:8px; }
}
@media(prefers-reduced-motion:reduce) {
  .search-panel,.lens-glass,.status-dot.working,.fresh .discovered-item,.discovery-rays,.rare.fresh,.legendary.fresh { animation:none; }
  .search-veil.opened { opacity:0; animation:none; }
  .search-item,.discovered-item,.lens-progress circle { transition:none; }
}
</style>
