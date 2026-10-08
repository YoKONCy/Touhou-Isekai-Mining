<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue'
import type { CharacterProfile } from '../shared/profile'
import { CRAFT_RECIPES, SMELT_RECIPES, FURNACE_COSTS, SMELT_BATCH_LIMIT, furnaceStage, materialCount, productionStatus, produce, repairFurnace, smeltCost, smeltStatus, startSmelting, claimSmelting, smeltClaimStatus } from '../shared/production'
import { t, itemName, itemDesc } from '../i18n'
import { saveService } from '../core/save/saveService'
import { useItemHover } from './useItemHover'
import ItemTooltip from './ItemTooltip.vue'
import ItemIcon from './ItemIcon.vue'
import { useHorizontalBrowse } from './useHorizontalBrowse'
import ProductionVignette from './ProductionVignette.vue'
import { sfx } from '../game/audio/Sfx'
import { HEMP_THREAD_ID } from '../content/items/vanilla/ids'
import {recipeUnlocked} from '../shared/production'

const props=defineProps<{profile:CharacterProfile;tick:number;mode:'crafting'|'furnace'}>()
const emit=defineEmits<{repaired:[stage:number];claimed:[]}>()
const {strip:ingredientStrip,beginBrowse,moveBrowse,endBrowse,leaveBrowse,browseWheel}=useHorizontalBrowse()
const selected=ref(0),quantity=ref(1),revision=ref(0),message=ref(''),working=ref(false),hover=useItemHover(),{tip,expanded,interactive}=hover
const cue=ref(0),craftResults=ref<{key:number;id:string;qty:number}[]>([])
const repairAnimation=ref<{stage:number;materials:{id:string;n:number;owned:number}[]}|null>(null)
const claimAnimation=ref<{key:number;id:string;qty:number}|null>(null)
const REPAIR_MS=1500,CRAFT_MS=1200,CLAIM_MS=1100,MAX_RESULTS=6
const resultTimers=new Map<number,ReturnType<typeof setTimeout>>()
let timer:ReturnType<typeof setTimeout>|undefined
let repairTimer:ReturnType<typeof setTimeout>|undefined
let claimTimer:ReturnType<typeof setTimeout>|undefined
const stage=computed(()=>{void props.tick;void revision.value;return furnaceStage(props.profile)})
const repairing=computed(()=>props.mode==='furnace'&&stage.value<3)
const showingRepair=computed(()=>repairing.value||!!repairAnimation.value)
const previewStage=computed(()=>repairAnimation.value?.stage??stage.value)
const batch=computed(()=>{void props.tick;void revision.value;return props.mode==='furnace'?props.profile.smelting:null})
const previewOutput=computed(()=>claimAnimation.value??batch.value)
const recipes=computed(()=>{void props.tick;void revision.value;return props.mode==='crafting'?CRAFT_RECIPES.filter(r=>recipeUnlocked(props.profile,r)):SMELT_RECIPES})
const recipe=computed(()=>recipes.value[selected.value]??recipes.value[0]!)
const ingredients=computed(()=>{
  void props.tick;void revision.value
  if(repairAnimation.value)return repairAnimation.value.materials
  const cost=repairing.value?FURNACE_COSTS[stage.value]!:props.mode==='furnace'?smeltCost(recipe.value,quantity.value):recipe.value.cost
  return cost.map(([id,n])=>({id,n,owned:materialCount(props.profile,id)}))
})
const status=computed(()=>{
  void props.tick;void revision.value
  if(repairAnimation.value||claimAnimation.value)return 'busy'
  if(repairing.value)return props.profile.flagBool('base.furnace.inspected')&&ingredients.value.every(m=>m.owned>=m.n)?'ready':'materials'
  if(props.mode==='crafting')return productionStatus(props.profile,recipe.value)
  if(batch.value)return batch.value.state==='ready'?smeltClaimStatus(props.profile):'busy'
  return smeltStatus(props.profile,recipe.value,quantity.value)
})
function setQuantity(e:Event){
  const input=e.target as HTMLInputElement,n=Number(input.value)
  quantity.value=Number.isFinite(n)?Math.max(1,Math.min(SMELT_BATCH_LIMIT,Math.floor(n))):1
  input.value=String(quantity.value)
}
function animateCraft(id:string,qty:number){
  const key=++cue.value
  craftResults.value.push({key,id,qty})
  // 只限制同屏演出数量，连续点击的制作事务始终逐次结算。
  if(craftResults.value.length>MAX_RESULTS){
    const removed=craftResults.value.shift()!
    clearTimeout(resultTimers.get(removed.key));resultTimers.delete(removed.key)
  }
  resultTimers.set(key,setTimeout(()=>{
    craftResults.value=craftResults.value.filter(result=>result.key!==key)
    resultTimers.delete(key)
  },CRAFT_MS))
  sfx.workbenchCraft(id===HEMP_THREAD_ID)
}
function act(){
  if(status.value!=='ready')return
  if(repairing.value){
    const repairedStage=stage.value,materials=ingredients.value.map(m=>({...m}))
    if(!repairFurnace(props.profile))return
    revision.value++;cue.value++;repairAnimation.value={stage:repairedStage,materials}
    message.value=t('ui.production.repairing');sfx.furnaceRepair(repairedStage)
    // 扣料和进度即时保存，剧情通知等演出完成后发出；关闭时由营地剧情检查点接续。
    repairTimer=setTimeout(()=>{
      repairAnimation.value=null;message.value=t('ui.production.stage_done',{n:repairedStage+1})
      emit('repaired',repairedStage+1)
    },REPAIR_MS)
  }else if(props.mode==='furnace'){
    const finished=batch.value
    if(finished){
      if(claimSmelting(props.profile)!=='ready')return
      // 领取即时结算，演出只保留本批快照，不依赖动画结束发放成品。
      claimAnimation.value={key:++cue.value,id:finished.id,qty:finished.qty}
      selected.value=Math.max(0,recipes.value.findIndex(r=>r.id===finished.id))
      hover.hide();sfx.furnaceClaim()
      clearTimeout(claimTimer);claimTimer=setTimeout(()=>{claimAnimation.value=null;emit('claimed')},CLAIM_MS)
      message.value=t('ui.camp.received',{item:itemName(finished.id),qty:finished.qty})
    }else{
      if(!startSmelting(props.profile,recipe.value,quantity.value))return
      message.value=t('ui.production.batch_started',{qty:quantity.value})
    }
    revision.value++
    working.value=true;if(!finished)cue.value++;clearTimeout(timer);timer=setTimeout(()=>working.value=false,500)
  }else{
    const output=recipe.value
    if(produce(props.profile,output)!=='ready')return
    revision.value++;message.value=t('ui.camp.received',{item:itemName(output.id),qty:output.qty})
    animateCraft(output.id,output.qty)
  }
  void saveService.autosave()
}
onBeforeUnmount(()=>{
  clearTimeout(timer);clearTimeout(repairTimer);clearTimeout(claimTimer)
  resultTimers.forEach(timer=>clearTimeout(timer));resultTimers.clear()
})
</script>

<template>
  <div class="production-layout" @mousemove="hover.move">
    <aside class="plans"><span class="plan-caption">{{t(mode==='crafting'?'ui.production.craft_record':'ui.production.furnace_record')}}</span>
      <template v-if="showingRepair"><h2>{{t('ui.production.maintenance')}}</h2><ol><li v-for="i in 3" :key="i" :class="{done:previewStage>=i,current:previewStage===i-1}"><span>{{previewStage>=i?'✓':`0${i}`}}</span><div>{{t(`ui.production.stage${i}`)}}<small>{{t(previewStage>=i?'ui.camp.done':previewStage===i-1?'ui.production.current':'ui.production.later')}}</small></div></li></ol></template>
      <template v-else><h2>{{t(mode==='crafting'?'ui.production.plans':'ui.production.smelting')}}</h2><button v-for="(r,i) in recipes" :key="r.id" class="recipe-choice" :disabled="!!batch||!!claimAnimation" :class="{selected:previewOutput?r.id===previewOutput.id:selected===i}" @click="selected=i" @mouseenter="hover.show($event,r.id)" @mouseleave="hover.leave"><ItemIcon :id="r.id" :size="37"/><span>{{itemName(r.id)}}<small>{{t(mode==='furnace'?'ui.production.batch_limit':'ui.production.yield',{n:mode==='furnace'?SMELT_BATCH_LIMIT:r.qty})}}</small></span></button></template>
      <p>{{t(mode==='crafting'?'ui.production.fiber_hint':showingRepair?'ui.production.furnace_hint':'ui.production.batch_hint')}}</p>
    </aside>
    <main class="production-work" :class="{working}" :aria-busy="!!repairAnimation||!!claimAnimation"><div class="work-heading"><span>{{t(showingRepair?'ui.production.stage_title':mode==='crafting'?'ui.production.handmade':'ui.production.hot_work',{n:previewStage+1})}}</span><small>{{t('ui.production.source')}}</small></div>
      <div class="work-preview">
        <ProductionVignette :kind="showingRepair?'repair':mode==='crafting'?'crafting':'smelting'" :item-id="previewOutput?.id??recipe.id" :cue="cue" :results="craftResults" :repair-stage="previewStage" :repair-running="!!repairAnimation" :repair-duration="REPAIR_MS" :claim-result="claimAnimation" :claim-duration="CLAIM_MS" :batch-state="batch?.state"/>
        <div class="preview-description"><h3>{{showingRepair?t(`ui.production.stage${previewStage+1}`):itemName(previewOutput?.id??recipe.id)}}</h3><p>{{showingRepair?t(`ui.production.stage${previewStage+1}_desc`):previewOutput?t(claimAnimation?'ui.production.claim_output':'ui.production.batch_output',{item:itemName(previewOutput.id),qty:previewOutput.qty}):itemDesc(recipe.id)}}</p></div></div>
      <section v-if="claimAnimation" class="batch-ticket finished claim-ticket" role="status"><div class="batch-status"><span class="ember-seal" aria-hidden="true">✓</span><div><strong>{{t('ui.production.claim_done')}}</strong><p>{{t('ui.production.claim_output',{item:itemName(claimAnimation.id),qty:claimAnimation.qty})}}</p></div></div></section>
      <section v-else-if="batch" class="batch-ticket" :class="{finished:batch.state==='ready'}" role="status"><div class="batch-status"><span class="ember-seal" aria-hidden="true">{{batch.state==='ready'?'✓':'◷'}}</span><div><strong>{{t(batch.state==='ready'?'ui.production.batch_ready':'ui.production.batch_heating')}}</strong><p>{{t(batch.state==='ready'?'ui.production.batch_collect':'ui.production.batch_wait')}}</p></div></div><ol class="batch-route"><li class="passed">{{t('ui.production.batch_step1')}}</li><li :class="{passed:batch.state==='ready',current:batch.state==='heating'}">{{t('ui.production.batch_step2')}}</li><li :class="{current:batch.state==='ready'}">{{t('ui.production.batch_step3')}}</li></ol></section>
      <template v-else><div v-if="mode==='furnace'&&!showingRepair" class="batch-quantity"><label for="smelt-quantity">{{t('ui.production.batch_quantity')}}</label><div class="quantity-controls"><button :disabled="quantity<=1" @click="quantity--" :aria-label="t('ui.production.decrease')">−</button><input id="smelt-quantity" type="number" min="1" :max="SMELT_BATCH_LIMIT" :value="quantity" @change="setQuantity"/><button :disabled="quantity>=SMELT_BATCH_LIMIT" @click="quantity++" :aria-label="t('ui.production.increase')">+</button></div><small>{{t('ui.production.batch_limit',{n:SMELT_BATCH_LIMIT})}}</small></div>
      <h4>{{t('ui.production.materials')}}</h4><div ref="ingredientStrip" class="material-tray" @wheel="browseWheel" @dragstart.prevent @pointerdown="beginBrowse" @pointermove="moveBrowse" @pointerup="endBrowse" @pointercancel="endBrowse" @pointerleave="leaveBrowse" @lostpointercapture="endBrowse"><div v-for="m in ingredients" :key="m.id" :class="{ready:m.owned>=m.n}" @mouseenter="hover.show($event,m.id)" @mouseleave="hover.leave"><ItemIcon :id="m.id" :size="37"/><strong>{{itemName(m.id)}}</strong><span>{{m.owned}}<small>/{{m.n}}</small></span><p>{{t(m.owned>=m.n?'ui.cooking.sufficient':'ui.cooking.short',{qty:Math.max(0,m.n-m.owned)})}}</p></div></div></template>
      <p v-if="showingRepair&&previewStage===2" class="nozzle-hint">{{t('ui.production.nozzle_hint')}}</p>
      <div class="production-actions"><span v-if="!showingRepair&&!batch&&!claimAnimation">{{t('ui.cooking.owned',{qty:materialCount(profile,recipe.id)})}}</span><button :disabled="status!=='ready'" @click="act">{{t(claimAnimation?'ui.production.claim_done':repairAnimation?'ui.production.repairing':showingRepair?previewStage===2?'ui.production.ignite':'ui.production.repair_step':mode==='crafting'?'ui.production.make':batch?batch.state==='heating'?'ui.production.heating':'ui.production.claim':'ui.production.smelt')}}<i>›</i></button></div>
      <p class="production-message" role="status">{{message||t(`ui.production.status.${status}`)}}</p>
    </main>
    <ItemTooltip :hover="tip" :expanded="expanded" :interactive="interactive" :profile="profile" :tick="tick+revision" @enter="hover.enterCard" @leave="hover.leaveCard"/>
  </div>
</template>

<style scoped>
.recipe-choice:disabled{cursor:default}.batch-quantity{display:flex;align-items:center;flex-wrap:wrap;gap:12px;padding:12px 0;border-top:1px solid #b39a6a33;color:#ccb58f;font-size:11px}.batch-quantity small{color:#9b8462;font-size:10px}.quantity-controls{display:flex;align-items:center;border:1px solid #a88b5355;background:#140e0977;box-shadow:inset 0 2px 4px #0003}.quantity-controls button{width:28px;height:30px;border:0;background:#82633d33;color:#d3bc94;font:inherit;cursor:pointer}.quantity-controls button:disabled{opacity:.3;cursor:default}.quantity-controls input{width:48px;border:0;border-inline:1px solid #a88b5333;padding:6px 0;text-align:center;background:transparent;color:#ead5af;font:inherit;font-size:14px;appearance:textfield}.quantity-controls input::-webkit-inner-spin-button,.quantity-controls input::-webkit-outer-spin-button{appearance:none}.batch-ticket{padding:19px 16px 14px;border:1px solid #b5925766;background:radial-gradient(ellipse at 0 0,#bb743021,transparent 75%),#31251a66;box-shadow:inset 0 1px #e6bd7633}.batch-status{display:flex;gap:13px;align-items:center}.ember-seal{display:grid;place-items:center;flex:none;width:42px;height:42px;border:1px double #a38049;border-radius:50%;font-size:25px;color:#d6aa64;box-shadow:inset 0 0 12px #b774251c}.batch-status strong{font-size:15px;letter-spacing:2px;font-weight:500;color:#dbc295}.batch-status p{margin:8px 0 0;color:#a9906a;font-size:11px;line-height:1.8}.batch-route{display:flex;justify-content:space-between;gap:7px;padding:17px 0 0;margin:17px 0 0;border-top:1px solid #ad8c5133;list-style:none;counter-reset:steps}.batch-route li{position:relative;flex:1;text-align:center;font-size:9px;color:#746450;counter-increment:steps}.batch-route li::before{content:counter(steps);display:grid;place-items:center;width:20px;height:20px;margin:0 auto 8px;border:1px solid #8b70434d;background:#2c2117;color:#947b53}.batch-route .passed{color:#a8ac81}.batch-route .passed::before{content:'✓';border-color:#8d946080;color:#b2b88b}.batch-route .current{color:#d4b581}.batch-route .current::before{border-color:#c3a062;background:#6b4d2d66;color:#e0c290}.finished{border-color:#95a07766}.finished .ember-seal{color:#b4bd93;border-color:#8c9568}.nozzle-hint{padding:11px 0 0;margin:0;color:#c2aa82;font-size:10px;line-height:1.8}

.production-layout{display:grid;grid-template-columns:220px minmax(0,1fr);gap:22px}.plans{padding:24px 20px 17px;border:1px solid #9a8057;border-left:7px solid #746044;background:repeating-linear-gradient(0deg,transparent 0 3px,#70573505 3px 4px),linear-gradient(100deg,#c6ae88,#e3d3b4 10%,#d6bf99);color:#725d3e;box-shadow:inset 4px 0 8px #72513426}.plan-caption{font-size:9px;letter-spacing:2px;color:#9e8661}.plans h2{font-size:20px;letter-spacing:2px;font-weight:500;margin:12px 0 20px}.plans>p{font-size:10px;line-height:1.9;color:#a08a66;margin-top:24px}.recipe-choice{display:flex;align-items:center;gap:10px;width:100%;padding:10px 8px;text-align:left;border:1px solid #8c744647;background:#b5996210;color:#8c7654;font:inherit;font-size:12px;margin-bottom:10px;cursor:pointer}.recipe-choice.selected{border-color:#927041;background:#b5996224;box-shadow:inset 2px 0 #977746}.recipe-choice small{display:block;margin-top:5px;font-size:9px;color:#a78d64}.plans ol{list-style:none;padding:0;margin:0}.plans li{display:flex;gap:10px;padding:13px 0;border-bottom:1px solid #8c744629;color:#a18b66;font-size:12px}.plans li>span{font-size:11px}.plans li small{display:block;font-size:9px;margin-top:5px}.plans li.current{color:#6b5032}.plans li.done{color:#79815e}.production-work{min-width:0;padding:19px;border:1px solid #b39a6a33;background:linear-gradient(145deg,#54402b18,transparent),#1a120a55;box-shadow:inset 0 2px 9px #0003}.work-heading{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #b39a6a33;padding-bottom:12px;color:#d4bd93;font-size:12px;letter-spacing:1px}.work-heading small{font-size:9px;letter-spacing:0;color:#a98e67}.work-preview{display:flex;align-items:center;gap:20px;min-height:160px;padding:15px 0}.work-preview svg{flex:none;width:150px;height:130px}.work-preview>div{min-width:0}.work-preview h3{font-size:19px;font-weight:500;color:#e1cda6;margin:0 0 10px}.work-preview p{font-size:11px;line-height:1.9;color:#b29b7a;margin:0}.production-work h4{font-size:11px;letter-spacing:2px;color:#bda57e;font-weight:400;margin:12px 0}.material-tray{display:flex;overflow-x:auto;overscroll-behavior-x:contain;touch-action:pan-y pinch-zoom;scrollbar-width:thin;scrollbar-color:#aa8a5555 #17121b66;user-select:none;cursor:grab;gap:10px}.material-tray.dragging{cursor:grabbing}.material-tray>div{flex:0 0 calc((100% - 20px)/3);min-width:96px;display:flex;flex-direction:column;align-items:center;padding:11px 5px 7px;border:1px solid #a78c5833;background:#0f0b0844;text-align:center}.material-tray strong{font-size:10px;font-weight:400;color:#b8a184;margin-top:7px}.material-tray span{font-size:17px;color:#c38e72;margin-top:9px;font-variant-numeric:tabular-nums}.material-tray small{font-size:10px;color:#977e5b;padding-left:3px}.material-tray p{font-size:9px!important;line-height:1.8;color:#a17c61;margin:5px 0 0}.material-tray .ready span,.material-tray .ready p{color:#a3ae83}.production-actions{display:flex;justify-content:space-between;align-items:center;gap:15px;margin-top:24px;border-top:1px solid #b39a6a33;padding-top:16px;color:#a48b68;font-size:10px}.production-actions button{margin-left:auto;display:flex;align-items:center;gap:25px;padding:10px 20px;border:1px solid #b99d6b80;background:linear-gradient(135deg,#806846,#59432a);color:#f0dcb7;font:inherit;font-size:13px;cursor:pointer;box-shadow:inset 0 1px #f0d6a130,0 2px 3px #0003}.production-actions button:disabled{opacity:.35;cursor:default}.production-actions button:hover:enabled{filter:brightness(1.12)}.production-actions i{font-style:normal}.production-message{font-size:10px!important;color:#b49a74;margin:10px 0 0;min-height:17px}.working .work-preview{animation:working-glow .5s ease-out}@keyframes working-glow{50%{filter:brightness(1.25)}}@media(max-width:700px){.production-layout{grid-template-columns:1fr;gap:15px}.plans{padding:17px}.plans h2{margin-bottom:14px}.plans>p{margin-top:13px}.work-preview{min-height:120px}.production-work{padding:15px}.recipe-choice{display:inline-flex;width:auto;margin-right:8px}.material-tray>div{flex-basis:calc((100% - 10px)/2)}}@media(prefers-reduced-motion:reduce){.working .work-preview{animation:none}}
</style>
