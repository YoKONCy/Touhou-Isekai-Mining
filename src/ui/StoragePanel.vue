<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import type { CharacterProfile } from '../shared/profile'
import type { ModuleActions } from '../shared/moduleActions'
import type { ItemSlotKey } from './inventorySlots'
import { inventorySlots } from './inventorySlots'
import { inventoryMouse } from './inventoryMouse'
import { useItemHover } from './useItemHover'
import { t, itemName } from '../i18n'
import { ENABLED_SLOTS } from '../shared/equipment'
import ItemIcon from './ItemIcon.vue'
import ItemTooltip from './ItemTooltip.vue'
import { cancelPointerDrag } from './pointerDnd'
import { itemMotion } from './itemMotion'

const props=defineProps<{profile:CharacterProfile;actions:ModuleActions;tick:number}>()
const emit=defineEmits<{close:[]}>()
const revision=ref(0),message=ref(''),hover=useItemHover(),{tip,expanded,interactive}=hover
const panelEl=ref<HTMLElement|null>(null),motion=itemMotion(()=>panelEl.value)
const access=inventorySlots(props.profile,props.actions,true)
const mouse=inventoryMouse({slots:access,containers:'.storage-panel',begin:hover.hide,moved:motion.transfer,notify:key=>{message.value=t(key)},changed:()=>{revision.value++;if(mouse.holding())hover.hide();else if(tip.value?.target){const s=access.get(tip.value.target);if(!s)hover.hide();else tip.value={...tip.value,id:s.id}}}})
const used=(side:'storage'|'inv')=>{void props.tick;void revision.value;return (side==='storage'?props.profile.storage:props.profile.inventory).slots.filter(Boolean).length}
const cells=(side:'storage'|'inv')=>side==='storage'?props.profile.storage.slots:props.profile.inventory.slots
const tipAction=computed(()=>{void revision.value;return tip.value?.target?access.action(tip.value.target):null})
const bar=[{key:'eq:weaponA',hint:'1'},{key:'eq:weaponB',hint:'2'},{key:'eq:pick',hint:'3'},{key:'eq:spellA',hint:'E'},{key:'eq:spellB',hint:'R'},{key:'quick:0',hint:'4'},{key:'quick:1',hint:'5'},{key:'quick:2',hint:'6'}] as const
const slot=(key:ItemSlotKey)=>{void props.tick;void revision.value;return access.get(key)}
const enabled=(key:ItemSlotKey)=>!key.startsWith('eq:')||ENABLED_SLOTS.has(key.slice(3) as Parameters<typeof props.actions.unequip>[0])
function show(e:MouseEvent,key:ItemSlotKey){if(!mouse.holding())hover.show(e,access.get(key)?.id)}
function organize(side?:'storage'|'inv'){mouse.cancel();if(side!=='inv')props.profile.storage.organize();if(side!=='storage')props.profile.inventory.organize();hover.hide();revision.value++}
function act(){if(tip.value?.target&&!mouse.act(tip.value.target))message.value=t('ui.item.action_failed')}
function key(e:KeyboardEvent){
  if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)emit('close')}
  if(e.code==='KeyR'&&!e.ctrlKey&&!e.altKey&&!e.metaKey){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)organize()}
}
onMounted(()=>{cancelPointerDrag();mouse.mount();window.addEventListener('keydown',key,true)})
onBeforeUnmount(()=>{motion.dispose();mouse.dispose();window.removeEventListener('keydown',key,true)})
</script>

<template>
  <section ref="panelEl" class="storage-panel gpanel-pop hud-panel" @click.stop @mousemove="hover.move">
    <header class="storage-head"><div><span>{{t('ui.storage.record')}}</span><h2>{{t('ui.camp.storage')}}</h2></div><button :aria-label="t('ui.camp.close')" @click="emit('close')">×</button></header>
    <div class="container-shelves">
      <section v-for="side in (['storage','inv'] as const)" :key="side" class="container-shelf" :class="side">
        <header class="shelf-head"><h3><svg viewBox="0 0 30 28" aria-hidden="true"><path v-if="side==='storage'" d="M3 9L8 4H23L27 9V25H3Z M3 12H27 M9 5V24 M22 5V24"/><path v-else d="M8 8V5Q15 0 22 5V8 M5 8H25L27 25H3Z M5 13H25 M12 15H18V20H12Z"/></svg>{{t(side==='storage'?'ui.camp.camp_storage':'ui.camp.bag')}}</h3><div class="shelf-tools"><span>{{used(side)}}<small>/{{cells(side).length}}</small></span><button @click="organize(side)">{{t('ui.storage.organize')}}</button></div></header>
        <div class="capacity-track" aria-hidden="true"><i :style="{width:`${used(side)/cells(side).length*100}%`}"></i></div>
        <div class="shelf-viewport" @scroll="hover.hide"><div class="shelf-grid" :class="side">
          <button v-for="(s,i) in cells(side)" :key="i" class="storage-slot" :class="{filled:!!s}" :data-drop="`${side}:${i}`" :aria-label="s?t('ui.camp.slot',{item:itemName(s.id),qty:s.qty}):t('ui.camp.empty')" @mouseenter="show($event,`${side}:${i}`)" @mouseleave="hover.leave"><ItemIcon v-if="s" :id="s.id" :size="36"/><span v-if="s&&s.qty>1" class="slot-count">{{s.qty}}</span></button>
        </div></div>
      </section>
    </div>
    <div class="storage-bar"><span class="bar-label">{{t('ui.storage.quick')}}</span><div class="bar-grid"><button v-for="c in bar" :key="c.key" class="storage-slot" :class="{disabled:!enabled(c.key),filled:!!slot(c.key)}" :data-drop="c.key" :aria-label="slot(c.key)?itemName(slot(c.key)!.id):t('ui.camp.empty')" @mouseenter="show($event,c.key)" @mouseleave="hover.leave"><kbd>{{c.hint}}</kbd><ItemIcon v-if="slot(c.key)" :id="slot(c.key)!.id" :size="32"/><span v-if="(slot(c.key)?.qty??0)>1" class="slot-count">{{slot(c.key)?.qty}}</span></button></div></div>
    <footer class="storage-foot"><span>{{t('ui.storage.gestures')}}</span><small>{{t('ui.storage.keys')}}</small></footer>
    <p v-if="message" class="storage-feedback" role="status">{{message}}</p>
    <ItemTooltip :hover="tip" :expanded="expanded" :interactive="interactive" :profile="profile" :tick="tick+revision" :action="tipAction" @enter="hover.enterCard" @leave="hover.leaveCard" @action="act"/>
  </section>
</template>

<style scoped>
/* 柜体与背包共用烟褐旧金，仓储区用木分格，随身区用深色织物内衬。 */
.storage-panel{position:relative;display:flex;flex-direction:column;width:min(850px,calc(100vw - 32px));max-height:calc(100dvh - 32px);box-sizing:border-box;padding:23px 27px 18px;border:6px solid #48382a;border-radius:3px;background:repeating-linear-gradient(1deg,transparent 0 24px,#e0bb7907 25px,transparent 26px 50px),linear-gradient(135deg,#423327,#2c221b 75%);box-shadow:0 22px 75px #050611b3,0 0 0 1px #a08457,inset 0 0 0 1px #c2a36d33;color:#deccaa;cursor:default}.storage-panel::before{content:'';position:absolute;inset:9px;pointer-events:none;border-top:1px solid #c1a3702e;border-bottom:1px solid #c1a3702e}.storage-head{flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 2px 15px;margin-bottom:15px;border-bottom:1px solid #b498673b}.storage-head>div>span{font-size:9px;letter-spacing:3px;color:#a98d64}.storage-head h2{margin:6px 0 0;color:#ead5ae;font-size:24px;font-weight:600;letter-spacing:4px}.storage-head>button{border:0;background:none;color:#b9a17d;font:inherit;font-size:26px;cursor:pointer}.container-shelves{flex:1;min-height:0;overflow:auto;scrollbar-width:thin;scrollbar-color:#a88c5e66 #20170f55}.container-shelf{margin-bottom:14px}.shelf-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 2px 7px}.shelf-head h3{display:flex;align-items:center;gap:8px;margin:0;font-size:12px;font-weight:normal;letter-spacing:2px;color:#cdb48a}.shelf-head svg{width:23px;height:23px;fill:#8a6d4826;stroke:#aa8c5c;stroke-width:1.2}.shelf-tools{display:flex;align-items:center;gap:16px}.shelf-tools>span{font-size:13px;color:#dbc49a;font-variant-numeric:tabular-nums}.shelf-tools small{margin-left:3px;color:#947e60;font-size:9px}.shelf-tools button{border:1px solid #a98c5c3b;background:#20170f55;padding:3px 9px;color:#bba17a;font:inherit;font-size:9px;cursor:pointer}.capacity-track{height:2px;background:#a88c5e18;margin-bottom:8px}.capacity-track i{display:block;height:100%;background:#a58d61}.inv .capacity-track i{background:#9d9c78}.shelf-viewport{max-height:260px;overflow:auto;padding:10px;border:1px solid #b597623b;border-left:3px solid #7c6243;border-bottom:3px double #806b4c;background:repeating-linear-gradient(90deg,transparent 0 62px,#9a7b4920 63px,transparent 64px 125px),#1a130dbb;box-shadow:inset 0 3px 12px #0005,inset 0 -1px #bfa06e0f;scrollbar-width:thin;scrollbar-color:#a88c5e66 #20170f55}.inv .shelf-viewport{max-height:188px;border-left-color:#69644c;background:radial-gradient(ellipse at 0 100%,#bbb19308,transparent 65%),#17140fd9}.shelf-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:6px}.storage-slot{position:relative;display:grid;place-items:center;min-width:0;height:49px;padding:3px;border:1px solid #b99c6333;border-radius:2px;background:radial-gradient(ellipse at 35% 0,#d8bd880b,transparent 70%),linear-gradient(145deg,#2d2117,#1b130d);box-shadow:inset 0 3px 6px #0006,inset 0 -1px #d4b7820b,0 1px #e8cda311;cursor:pointer;user-select:none}.storage-slot.filled{border-color:#baa07960}.storage-slot:hover{border-color:#d4bc8b99;background:radial-gradient(ellipse at 35% 0,#d8bd881b,transparent 70%),#302317}.slot-count{position:absolute;bottom:2px;right:3px;padding:0 2px;background:#160f09d9;color:#f0e0c3;font-size:10px;line-height:1.4;font-variant-numeric:tabular-nums;pointer-events:none}.storage-bar{flex:none;display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:2px;padding:11px 0;border-top:1px solid #a88c5e2e}.bar-label{font-size:10px;letter-spacing:2px;color:#ac9370}.bar-grid{display:grid;grid-template-columns:repeat(8,48px);gap:6px}.bar-grid .storage-slot{height:43px}.bar-grid .storage-slot:nth-child(4){margin-left:4px}.storage-slot kbd{position:absolute;left:4px;top:2px;color:#bda06c;font:inherit;font-size:9px;pointer-events:none}.storage-slot.disabled{opacity:.3;cursor:default}.storage-foot{flex:none;display:flex;justify-content:space-between;gap:15px;padding-top:9px;border-top:1px solid #b498672e;font-size:9px;color:#a48b67;line-height:1.9}.storage-foot small{font-size:9px;color:#ba9e72;white-space:nowrap}.storage-feedback{flex:none;margin:7px 0 0;color:#c1a77b;font-size:10px}.storage-panel button:focus-visible{outline:2px solid #cfb783;outline-offset:2px}
@media(max-width:800px){.shelf-grid{grid-template-columns:repeat(10,minmax(0,1fr))}.storage-panel{padding:20px 20px 15px}}@media(max-width:650px){.shelf-grid{grid-template-columns:repeat(8,minmax(0,1fr))}.storage-panel{padding:18px 15px 13px}.storage-bar{flex-wrap:wrap;gap:7px}.bar-grid{width:100%;grid-template-columns:repeat(8,minmax(0,1fr));gap:5px}.storage-foot{flex-wrap:wrap;gap:4px}.bar-label{font-size:9px}.storage-head h2{font-size:22px}.shelf-viewport{padding:7px}.storage-slot{height:46px}}@media(max-width:480px){.shelf-grid{grid-template-columns:repeat(6,minmax(0,1fr))}.storage-panel{width:calc(100vw - 20px);max-height:calc(100dvh - 20px);border-width:4px;padding:16px 11px 12px}.bar-grid{gap:3px}.bar-grid .storage-slot{height:38px;padding:0}.shelf-tools{gap:8px}}@media(max-height:700px){.storage-head{padding-bottom:11px;margin-bottom:12px}.shelf-viewport{max-height:205px}.inv .shelf-viewport{max-height:155px}.storage-slot{height:45px}.container-shelf{margin-bottom:11px}}
</style>
