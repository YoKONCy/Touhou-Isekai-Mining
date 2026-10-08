<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import type { CharacterProfile } from '../shared/profile'
import { visibleMineFloors, canEnterMineFloor, chosenMineFloor, hasEnteredMineFloor } from '../shared/mineFloors'
import { mineRelayAttention } from '../content/story/mainline/mine-relay/state'
import { mineFloorResourceIds } from '../shared/mineResources'
import { t, itemName } from '../i18n'
import ItemIcon from './ItemIcon.vue'

const props=defineProps<{profile:CharacterProfile}>()
const emit=defineEmits<{close:[];enter:[floor:number]}>()
const selected=ref(chosenMineFloor(props.profile))
const entering=ref(false)
const displayedFloors=computed(()=>visibleMineFloors(props.profile))
const floorResources=computed(()=>new Map(displayedFloors.value.map(floor=>[floor,mineFloorResourceIds(floor)])))
const availableFloors=computed(()=>displayedFloors.value.filter(floor=>canEnterMineFloor(props.profile,floor)))
function enter():void{if(entering.value||!canEnterMineFloor(props.profile,selected.value))return;entering.value=true;emit('enter',selected.value)}
function key(e:KeyboardEvent):void{
  if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter','KeyF','Escape'].includes(e.code))return
  e.preventDefault();e.stopImmediatePropagation();if(e.repeat||entering.value)return
  if(e.code==='Escape')emit('close')
  else if(e.code==='Enter'||e.code==='KeyF')enter()
  else{
    const floors=availableFloors.value,index=floors.findIndex(floor=>floor===selected.value)
    const step=e.code==='ArrowUp'||e.code==='ArrowLeft'?-1:1
    selected.value=floors[(index+step+floors.length)%floors.length]??1
  }
}
onMounted(()=>window.addEventListener('keydown',key,true))
onBeforeUnmount(()=>window.removeEventListener('keydown',key,true))
</script>
<template>
  <div v-if="availableFloors.length>1" class="floor-mask hud-modal" @click.self="emit('close')">
    <section class="floor-board gpanel-pop hud-panel" role="dialog" aria-modal="true" aria-labelledby="floor-select-title">
      <header><div><small>{{t('ui.floors.record')}}</small><h2 id="floor-select-title">{{t('ui.floors.title')}}</h2></div><button class="close" @click="emit('close')" :aria-label="t('ui.camp.close')">×</button></header>
      <div class="floor-cards" :class="{'three-floors':displayedFloors.length===3,'four-floors':displayedFloors.length>=4}">
        <button v-for="floor in displayedFloors" :key="floor" class="floor-card" :class="{selected:selected===floor,collapsed:!canEnterMineFloor(profile,floor)}" :disabled="!canEnterMineFloor(profile,floor)" :aria-pressed="selected===floor" @click="selected=floor">
          <span class="card-clip" aria-hidden="true"></span><span class="floor-number">0{{floor}}</span><span v-if="floor===3&&mineRelayAttention(profile)" class="floor-attention" role="img" :aria-label="t('ui.floors.attention')">!</span><span class="floor-status"><span v-if="selected===floor" aria-hidden="true">✓ </span>{{t(!canEnterMineFloor(profile,floor)?'ui.floors.collapsed':selected===floor?'ui.floors.selected':'ui.floors.available')}}</span>
          <svg viewBox="0 0 240 115" aria-hidden="true" class="mine-sketch" fill="none" stroke-linejoin="round"><path d="M25 98L39 49L69 19L157 14L203 47L222 99" fill="#7a73683b" stroke="#8c795c" stroke-width="2"/><path d="M64 98L67 50L84 32H162L183 49L188 98" fill="#625b5040" stroke="#78674f"/><path d="M80 96L84 50L94 42H153L169 56L174 96" fill="#4d49414d"/><path d="M70 99V46H181V99M59 45H190M79 95L159 47M170 96L91 47" stroke="#a48b65" stroke-width="5"/><path d="M103 109L112 65M150 109L137 65M106 87H143M101 102H148" stroke="#6b604e" stroke-width="2"/><path v-if="floor===2" d="M23 101L38 91L51 101M193 100L201 82L211 101M88 31L98 21L109 27" stroke="#d6c9a77d" stroke-width="2"/></svg>
          <strong>{{t(`ui.floors.floor${floor}`)}}</strong><span class="floor-description">{{t(!canEnterMineFloor(profile,floor)?'ui.floors.collapsed_description':`ui.floors.description${floor}`)}}</span>
          <span class="resource-row"><span v-if="!hasEnteredMineFloor(profile,floor)" class="unknown-minerals" role="img" :aria-label="t('ui.floors.unknown_resources')">?</span><template v-else><span v-for="id in floorResources.get(floor)??[]" :key="id" :title="itemName(id)"><ItemIcon :id="id" :size="22"/>{{itemName(id)}}</span></template></span>
        </button>
      </div>
      <p class="entry-note"><span class="chosen-destination">{{t(`ui.floors.floor${selected}`)}}</span>{{t('ui.floors.hint')}}</p>
      <footer><span>{{t('ui.floors.keys')}}</span><button class="enter-button" :disabled="entering||!canEnterMineFloor(profile,selected)" @click="enter">{{t('ui.floors.enter')}}<b aria-hidden="true">›</b></button></footer>
    </section>
  </div>
</template>
<style scoped>
.floor-board:has(.four-floors){width:min(820px,100%)}.floor-attention{display:inline-grid;place-items:center;margin-left:8px;width:17px;height:23px;border:1px solid #88683e;border-radius:3px;background:linear-gradient(#e5c98c,#cda86a);color:#654720;font-size:17px;font-weight:700;box-shadow:0 2px 3px #76522a33;animation:floor-attention 1.5s ease-in-out infinite}.floor-card.collapsed{opacity:.48;filter:grayscale(.65);cursor:default}.floor-card.collapsed:hover{opacity:.48}.collapsed .mine-sketch{opacity:.55}.four-floors .mine-sketch{height:78px}.four-floors .floor-description{min-height:0}.four-floors .floor-card strong{font-size:19px}@keyframes floor-attention{50%{transform:translateY(-2px);filter:brightness(1.08)}}@media(prefers-reduced-motion:reduce){.floor-attention{animation:none}}
.floor-board:has(.three-floors){width:min(920px,100%)}.floor-cards.three-floors{grid-template-columns:repeat(3,minmax(0,1fr))}@media(max-width:650px){.floor-cards.three-floors{grid-template-columns:1fr}.three-floors .mine-sketch{height:68px}.three-floors .floor-description{min-height:0}}
.floor-mask{position:fixed;inset:0;z-index:1300;display:grid;place-items:center;background:#15101c99;padding:22px;cursor:auto}.floor-board{width:min(680px,100%);box-sizing:border-box;max-height:90dvh;overflow:auto;padding:26px;border:7px solid #514033;background:repeating-linear-gradient(2deg,transparent 0 23px,#bf995d08 24px,transparent 25px 51px),linear-gradient(130deg,#43362e,#29252b);box-shadow:0 20px 70px #08081099,0 0 0 1px #ad8c59,inset 0 0 0 1px #8e745044;color:#dcc6a0}
header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;border-bottom:1px solid #b0925738;padding-bottom:16px}header small{font-size:10px;letter-spacing:3px;color:#a59070}h2{font-size:23px;letter-spacing:4px;font-weight:normal;margin:8px 0 0}.close{background:none;border:0;color:#bca583;font-size:25px;cursor:pointer}.floor-cards{display:grid;grid-template-columns:1fr 1fr;gap:18px}.floor-card{position:relative;padding:19px 18px 17px;text-align:left;color:#64503a;background:repeating-linear-gradient(0deg,transparent 0 3px,#6f542c06 3px 4px),linear-gradient(110deg,#cbb48d,#dfcfae 12%,#d6c39f);box-sizing:border-box;border:3px solid #85765c;box-shadow:inset 0 -3px #b49b72,0 4px 5px #110d1c44;font:inherit;cursor:pointer;opacity:.82;filter:saturate(.75);transition:transform .15s,border-color .15s,opacity .15s}.floor-card.selected{opacity:1;filter:none;border-color:#e3c27c;transform:translateY(-5px) scale(1.015);background:repeating-linear-gradient(0deg,transparent 0 3px,#6f542c06 3px 4px),linear-gradient(110deg,#d8bf96,#eee0bd 12%,#dfcba5);box-shadow:0 0 0 1px #4b3723,0 0 0 3px #bf98596b,inset 0 0 0 2px #f5e6bd99,inset 0 -3px #b49b72,0 8px 12px #110d1c77}.floor-card:not(.selected):hover{opacity:.94}.card-clip{position:absolute;top:-7px;left:calc(50% - 20px);width:40px;height:11px;background:linear-gradient(#b9a37c,#726149,#ad956f);border:1px solid #5c4b35;box-shadow:0 3px 3px #3a2c2433}.floor-number{font-size:11px;color:#9c815b;letter-spacing:2px}.floor-status{float:right;font-size:10px;color:#827554}.mine-sketch{display:block;width:100%;height:119px;margin:8px 0}.floor-card strong{font-size:21px;letter-spacing:2px;font-weight:normal;display:block}.floor-description{display:block;min-height:44px;margin:12px 0 15px;font-size:11px;line-height:1.9;color:#8b7555}.resource-row{display:flex;gap:12px;border-top:1px solid #92764c33;padding-top:12px;flex-wrap:wrap}.resource-row>span{display:flex;align-items:center;gap:5px;font-size:10px}.entry-note{font-size:11px;line-height:1.8;color:#b6a180;margin:19px 0}footer{display:flex;justify-content:space-between;align-items:center;gap:14px}footer>span{font-size:10px;color:#948367}.enter-button{min-width:168px;display:flex;justify-content:center;gap:24px;align-items:center;padding:12px 20px;background:linear-gradient(#8b6e4a,#644f37);border:1px solid #b4945e;color:#f0ddb4;box-shadow:inset 0 1px #dbc08c66,inset 0 -2px #382d2599;font:inherit;font-size:13px;letter-spacing:2px;cursor:pointer}.enter-button b{font-size:20px;font-weight:normal}.enter-button:disabled{opacity:.45;cursor:default}.floor-card:focus-visible,.close:focus-visible,.enter-button:focus-visible{outline:2px solid #ebcb91;outline-offset:3px}
.floor-card.selected::before{content:'';position:absolute;left:-12px;top:50%;width:11px;height:18px;transform:translateY(-50%);clip-path:polygon(0 0,100% 50%,0 100%);background:#e3c27c;pointer-events:none}
.floor-card.selected .floor-status{padding:4px 7px;margin-top:-4px;color:#f0ddb4;border:1px solid #b28b50;background:linear-gradient(#8b6f49,#685336);box-shadow:inset 0 1px #e4c89055;letter-spacing:1px}.floor-card.selected strong{color:#49351f;text-shadow:0 1px #fff0c266}.floor-card.selected .card-clip{border-color:#a78042;background:linear-gradient(#e3c791,#a18550,#c4a66c)}
.resource-row{min-height:32px;align-items:center}.resource-row>.unknown-minerals{width:30px;height:30px;display:grid;place-items:center;box-sizing:border-box;font-size:21px;color:#8b785a;border:1px dashed #957c514f;background:#88704a0a;line-height:1}
.chosen-destination{display:inline-block;padding:4px 9px;margin-right:10px;border:1px solid #b2915944;background:#c3a3650b;color:#dec190;font-size:12px;letter-spacing:1px}
.resource-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));column-gap:10px;row-gap:8px;align-content:start}.resource-row>span{min-width:0;white-space:nowrap}
@media(max-width:520px){.floor-board{padding:20px 16px;border-width:5px}.floor-cards{gap:12px}.floor-card{padding:17px 12px}.floor-card strong{font-size:17px}.mine-sketch{height:95px}footer{flex-wrap:wrap}.enter-button{margin-left:auto}.resource-row{gap:7px}}
@media(max-width:380px){.floor-cards{grid-template-columns:1fr}.mine-sketch{height:75px}.floor-description{min-height:0}}
@media(prefers-reduced-motion:reduce){.floor-card{transition:none}}
</style>
