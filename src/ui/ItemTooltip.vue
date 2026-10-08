<script setup lang="ts">
import { computed, shallowRef, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import type { ItemHover } from './useItemHover'
import type { ItemAction } from './inventorySlots'
import type { CharacterProfile } from '../shared/profile'
import { findItemDef } from '../shared/itemDefs'
import { deriveCombat } from '../shared/combat'
import { rarityColor, rarityNameKey } from '../shared/rarity'
import { t, hasKey, itemName, itemDesc } from '../i18n'
import ItemIcon from './ItemIcon.vue'
import ItemStatSheet from './ItemStatSheet.vue'

const props=defineProps<{hover:ItemHover|null;expanded:boolean;interactive:boolean;profile:CharacterProfile;tick:number;action?:ItemAction|null}>()
const emit=defineEmits<{enter:[];leave:[];action:[]}>()
const el=ref<HTMLElement|null>(null),position=ref({x:8,y:8}),heightLimit=ref<number|null>(null)
const display=shallowRef<ItemHover|null>(null),displayExpanded=ref(false)
// 隐藏时保留最近一张卡片的内容，快速穿过空格不会拆掉整组属性图标。
watch(()=>props.hover,h=>{if(h)display.value=h},{immediate:true})
watch([()=>props.hover!==null,()=>props.expanded],()=>{if(props.hover)displayExpanded.value=props.expanded},{immediate:true})
const def=computed(()=>display.value?.id?findItemDef(display.value.id):undefined)
const kindLabel=computed(()=>{const d=def.value;if(!d)return '';return t(`ui.item.kind.${d.consume&&d.material?'edible_material':d.equipSlot==='outfit'?'outfit':d.equipSlot?.startsWith('trinket')?'trinket':d.kind}`)})
const rarity=computed(()=>def.value?.rarity??0)
const ink=computed(()=>rarityColor(def.value?.rarity,'ui')??'#675b49')
const derived=computed(()=>{void props.tick;return deriveCombat(props.profile.combat)})
const flavor=computed(()=>{const key=def.value?.flavorKey??(def.value?`item.${def.value.id}.flavor`:'');return key&&hasKey(key)?t(key):''})
const details=computed(()=>{const d=def.value;return !!d&&!!(d.melee||d.ranged||d.ammunition||d.spell||d.combat||d.mineral||d.miningPower!==undefined||d.miningEfficiency!==undefined||d.consume||d.weapon?.heldEffects?.length||d.weapon?.afterDodgeEffects?.length)})
let frame=0,size:{width:number;height:number}|null=null,measure=true
function scheduleFit(){if(props.hover&&!frame)frame=requestAnimationFrame(()=>{frame=0;fit()})}
function fit(){
  if(!el.value||!props.hover)return
  if(measure||!size){const r=el.value.getBoundingClientRect();size={width:r.width,height:r.height};measure=false}
  const r=size,h=props.hover,px=h.x-17,py=h.y-15
  // 右边空间不足时放到指针左侧，底部不足时上移，不追着卡片内的鼠标移动。
  const horizontalRoom=h.x+r.width<=window.innerWidth-8||px-r.width-15>=8
  heightLimit.value=horizontalRoom?window.innerHeight-16:Math.max(80,Math.max(py-24,window.innerHeight-py-24))
  const height=Math.min(r.height,heightLimit.value),x=h.x+r.width>window.innerWidth-8?h.x-r.width-32:h.x
  const y=!horizontalRoom&&h.y+height>window.innerHeight-8?py-height-15:h.y
  const next={x:Math.max(8,Math.min(x,window.innerWidth-r.width-8)),y:Math.max(8,Math.min(y,window.innerHeight-height-8))}
  if(position.value.x!==next.x||position.value.y!==next.y)position.value=next
}
watch([()=>props.hover?.x,()=>props.hover?.y,()=>props.hover!==null],scheduleFit,{immediate:true})
watch([()=>def.value?.id,displayExpanded],()=>{if(el.value)el.value.scrollTop=0;measure=true;scheduleFit()})
let observer:ResizeObserver|null=null
function resized(){measure=true;scheduleFit()}
/** 指针仍在原物品上时也能翻阅详情，避免滚动背包导致悬浮卡消失。 */
function scrollDetails(e:WheelEvent){
  const card=el.value,h=props.hover
  if(!card||!h||!displayExpanded.value||!details.value||e.ctrlKey||!(e.target instanceof Node))return
  if(!card.contains(e.target)&&!h.anchor?.contains(e.target))return
  const delta=e.deltaY||e.deltaX
  if(!delta)return
  e.preventDefault();e.stopPropagation()
  const unit=e.deltaMode===1?16:e.deltaMode===2?card.clientHeight:1
  card.scrollTop=Math.max(0,Math.min(card.scrollHeight-card.clientHeight,card.scrollTop+delta*unit))
}
onMounted(()=>{observer=new ResizeObserver(entries=>{const box=entries[0]?.borderBoxSize[0];if(box?.inlineSize&&box.blockSize){size={width:box.inlineSize,height:box.blockSize};measure=false;scheduleFit()}});if(el.value)observer.observe(el.value);window.addEventListener('resize',resized);window.addEventListener('wheel',scrollDetails,{capture:true,passive:false})})
watch(el,node=>{observer?.disconnect();if(node)observer?.observe(node)})
onBeforeUnmount(()=>{if(frame)cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener('resize',resized);window.removeEventListener('wheel',scrollDetails,true)})
</script>

<template>
  <Teleport to="body">
    <article v-show="hover" ref="el" class="item-hover-card hud-panel hud-paper" :class="[`rarity-${rarity}`,{'is-expanded':displayExpanded&&details,'is-interactive':interactive}]" :style="{transform:`translate3d(${position.x}px,${position.y}px,0)`,maxHeight:heightLimit===null?undefined:`${heightLimit}px`,'--quality-ink':ink}" @mouseenter="emit('enter')" @mouseleave="emit('leave')" @pointerdown.stop @click.stop @wheel.stop>
      <template v-if="def">
        <header class="item-heading"><ItemIcon :id="def.id" :size="38"/><div><strong class="item-name">{{itemName(def.id)}}</strong><div class="item-meta"><span>{{kindLabel}}</span><span v-if="def.rarity" class="quality-stamp">{{t(rarityNameKey(def.rarity))}}</span></div></div></header>
        <ItemStatSheet :def="def" :expanded="displayExpanded&&details" :ranged-crit="derived.rangedCritChance" :shooting-deviation="derived.shootingDeviation"/>
        <p class="item-description">{{itemDesc(def.id)}}</p><p v-if="flavor" class="item-flavor">{{flavor}}</p>
        <footer><span v-if="details"><kbd>Shift</kbd>{{t(displayExpanded?'ui.item.details_collapse':'ui.item.details_expand')}}</span><span v-if="displayExpanded&&details">{{t('ui.item.scroll_details')}}</span><button v-if="action" @click="emit('action')">{{t(`ui.item.action.${action}`)}}</button></footer>
      </template>
      <strong v-else class="empty-label">{{display?.empty}}</strong>
    </article>
  </Teleport>
</template>

<style scoped>
/* 所有品质沿用同一纸张与排版，差异来自压印、包角与品质墨色。 */
.item-hover-card{left:0;top:0;contain:layout style;will-change:transform;pointer-events:none;overscroll-behavior:contain}.item-hover-card.is-interactive{pointer-events:auto}
.item-hover-card{--quality-ink:#675b49;position:fixed;z-index:1600;width:288px;max-width:calc(100vw - 16px);max-height:calc(100dvh - 16px);overflow-y:auto;box-sizing:border-box;padding:13px 15px 12px;border:1px solid #8f7956;border-radius:2px;background:repeating-linear-gradient(0deg,transparent 0 3px,#6b4d2705 3px 4px),radial-gradient(ellipse at 90% 0,#b79d7126,transparent 65%),linear-gradient(155deg,#f0e5ca,#dfcda7 80%,#d1bb91);box-shadow:0 9px 25px #0b0b1460,inset 0 0 0 3px #fff3ce40,inset 0 0 0 4px #977c4526;color:#675940;font-family:var(--font-body);font-size:11px;line-height:1.65;cursor:default;scrollbar-width:thin;scrollbar-color:#a48a5c #d8c59e}.is-expanded{width:450px}.item-heading{display:flex;align-items:center;gap:11px;padding-bottom:10px;margin-bottom:2px;border-bottom:1px solid #9a7e4933}.item-heading>div{min-width:0;flex:1}.item-name{display:block;color:var(--quality-ink);font-family:var(--font-sign);font-size:18px;font-weight:700;letter-spacing:1px;line-height:1.55;text-shadow:0 1px #fff3d370;overflow-wrap:anywhere}.item-meta{display:flex;align-items:center;flex-wrap:wrap;gap:5px 10px;margin-top:3px;color:#978163;font-size:10px}.quality-stamp{padding:0 6px;border:1px solid currentColor;color:var(--quality-ink);font-weight:600;letter-spacing:1px;box-shadow:inset 0 0 0 1px #ffefd15c}.item-description{margin:9px 0 0;color:#756348;font-size:11px;line-height:1.8;overflow-wrap:anywhere}.item-flavor{margin:9px 0 0;color:#9a8769;font-size:10px;font-style:italic;line-height:1.75}footer{display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid #9a7e4929;margin-top:11px;padding-top:8px;color:#a08b69;font-size:9px}footer>span{display:inline-flex;align-items:center;gap:5px}kbd{padding:0 4px;border:1px solid #a38a5a55;background:#a7885009;color:#8c7654;font:inherit;box-shadow:0 1px #a38a5a44}footer button{margin-left:auto;padding:4px 13px;border:1px solid #8c7551;color:#f0dfb6;background:linear-gradient(#927a54,#705d43);box-shadow:inset 0 1px #fff1ca40,0 1px 2px #6e513c26;font:inherit;font-size:10px;cursor:pointer}footer button:hover{background:linear-gradient(#a68b5b,#837049)}footer button:focus-visible{outline:2px solid #756744;outline-offset:2px}.empty-label{font-size:12px;font-weight:500;line-height:1.8}
.rarity-3,.rarity-4,.rarity-5,.rarity-6{border-color:var(--quality-ink);background:repeating-linear-gradient(0deg,transparent 0 3px,#6b4d2705 3px 4px),radial-gradient(ellipse at 100% 0,color-mix(in srgb,var(--quality-ink) 9%,transparent),transparent 60%),linear-gradient(155deg,#f0e5ca,#dfcda7 80%,#d1bb91)}.rarity-3 .item-heading{border-bottom-style:double;border-bottom-width:3px;border-color:#926ba43b}.rarity-3 .quality-stamp{border-radius:50% 40% 45% 40%;padding:2px 7px;transform:rotate(-4deg)}.rarity-4,.rarity-5,.rarity-6{border-width:2px;padding:12px 14px 11px;box-shadow:0 9px 25px #0b0b1460,inset 0 0 0 3px #fff3ce50,inset 0 0 0 4px #ae925455}.rarity-4 .item-heading,.rarity-5 .item-heading,.rarity-6 .item-heading{border-top:2px solid #b99c5d44;padding-top:4px;border-bottom-style:double;border-bottom-width:3px}.rarity-4 .quality-stamp{background:#ac873410;box-shadow:inset 0 0 0 1px #ffefd1,0 0 0 1px #ac873425}.rarity-5 .quality-stamp{transform:rotate(-3deg);background:#ae658410}.rarity-5 .item-heading{border-top-color:#a3267f33}.rarity-6{border-color:#b3a275;background:repeating-linear-gradient(0deg,transparent 0 3px,#6b4d2705 3px 4px),conic-gradient(from 135deg at 100% 0,#e6dde844,#d1e4d444,#ead7e644,#e0e2c444,#d9deed44),linear-gradient(155deg,#f4ebd5,#e4d6b4 80%,#d6c499)}.rarity-6 .item-name{background:linear-gradient(90deg,#6b5410,#a3267f,#1f6f7a,#6b5410);background-size:300% 100%;background-clip:text;-webkit-background-clip:text;color:transparent;text-shadow:none;animation:quality-ink 5s linear infinite}.rarity-6 .quality-stamp{border-color:#a49674;background:#f6edcf60;color:#827046}
@keyframes quality-ink{to{background-position:300% 0}}@media(prefers-reduced-motion:reduce){.rarity-6 .item-name{animation:none}}
</style>
