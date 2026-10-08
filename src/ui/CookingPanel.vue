<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import type { CharacterProfile } from '../shared/profile'
import { POT_REPAIR_COST } from '../content/story/mainline/camp-soup/transactions'
import { SOUP_ID, SALT_SOUP_ID, WOOD_ID } from '../content/items/vanilla/ids'
import { SOUP_RECIPE, SALT_SOUP_RECIPE, productionStatus, materialCount, scaleRecipe } from '../shared/production'
import { getItemDef } from '../shared/itemDefs'
import { itemName, itemDesc, t } from '../i18n'
import { sfx } from '../game/audio/Sfx'
import ItemIcon from './ItemIcon.vue'
import { useHorizontalBrowse } from './useHorizontalBrowse'

const props=defineProps<{profile:CharacterProfile;tick:number;revision:number;repaired:boolean;done:boolean;message:string}>()
const emit=defineEmits<{action:[kind:'repair'|'cook',id?:string,quantity?:number,complete?:(success:boolean)=>void]}>()
const selected=ref(SOUP_ID),preset=ref<number|'custom'>(1),customValue=ref('1'),customInput=ref<HTMLInputElement|null>(null)
const phase=ref<'idle'|'stirring'|'reveal'|'success'>('idle')
const cooked=ref<{id:string;qty:number}|null>(null)
const STIR_MS=1500,REVEAL_MS=850,SUCCESS_MS=1400
let animationTimer:ReturnType<typeof setTimeout>|undefined
let mounted=true
const busy=computed(()=>phase.value!=='idle')
const simmering=computed(()=>phase.value==='stirring')
const {strip:ingredientStrip,beginBrowse,moveBrowse,endBrowse,leaveBrowse,browseWheel}=useHorizontalBrowse()
const saltUnlocked=computed(()=>{void props.tick;void props.revision;return props.profile.flagBool('recipe.saltSoup.unlocked')})
const browseRecipes=computed(()=>saltUnlocked.value?[SOUP_ID,SALT_SOUP_ID]:[SOUP_ID])
const recipe=computed(()=>selected.value===SALT_SOUP_ID&&saltUnlocked.value?SALT_SOUP_RECIPE:SOUP_RECIPE)
const quantity=computed(()=>preset.value==='custom'?Number(customValue.value):preset.value)
const batch=computed(()=>scaleRecipe(recipe.value,quantity.value))
const quantityValid=computed(()=>!!batch.value)
async function chooseCustom(){
  if(busy.value)return
  if(preset.value!=='custom')customValue.value=String(quantity.value)
  preset.value='custom';await nextTick();customInput.value?.focus();customInput.value?.select()
}
const materials=computed(()=>{
  void props.tick;void props.revision
  return (props.repaired?batch.value?.cost??recipe.value.cost:POT_REPAIR_COST).map(([id,required])=>{
    const available=materialCount(props.profile,id)
    return {id,required,available,ready:available>=required&&(!props.repaired||quantityValid.value)}
  })
})
const supplied=computed(()=>materials.value.every(m=>m.ready))
const bagFull=computed(()=>{void props.tick;void props.revision;return props.repaired&&!!batch.value&&productionStatus(props.profile,batch.value)==='space'})
const soupCount=computed(()=>{void props.tick;void props.revision;return materialCount(props.profile,recipe.value.id)})
const heal=computed(()=>getItemDef(recipe.value.id).consume?.heal??0)
const status=computed(()=>t(!props.repaired?supplied.value?'ui.cooking.repair_ready':'ui.camp.materials_missing'
  :!quantityValid.value?'ui.cooking.quantity_invalid':bagFull.value?'ui.camp.bag_full':!supplied.value?'ui.camp.materials_missing':'ui.cooking.ready'))
function animateResult(id:string,qty:number){
  if(!mounted)return
  clearTimeout(animationTimer);cooked.value={id,qty};phase.value='stirring'
  sfx.ensure()
  // 制作事务已成功并保存，计时只负责表现；关闭面板不会损失成品。
  animationTimer=setTimeout(()=>{
    if(!mounted)return
    phase.value='reveal'
    animationTimer=setTimeout(()=>{
      if(!mounted)return
      phase.value='success';sfx.cookingSuccess()
      animationTimer=setTimeout(()=>{if(mounted){phase.value='idle';cooked.value=null}},SUCCESS_MS)
    },REVEAL_MS)
  },STIR_MS)
}
function perform(){
  if(busy.value||!supplied.value||bagFull.value)return
  if(!props.repaired){emit('action','repair');return}
  const output=batch.value
  if(!output)return
  emit('action','cook',output.id,quantity.value,success=>{if(success)animateResult(output.id,output.qty)})
}
onBeforeUnmount(()=>{mounted=false;clearTimeout(animationTimer)})
</script>

<template>
  <div class="cook-layout">
    <aside class="recipe-book" :class="{'has-recipes':repaired&&saltUnlocked}">
      <div class="book-binding" aria-hidden="true"></div>
      <div class="paper-tab">{{ t(repaired ? 'ui.cooking.recipes' : 'ui.camp.maintenance') }}</div>
      <span class="folio">{{ t('ui.cooking.camp_record') }} · {{recipe.id===SALT_SOUP_ID?'02':'01'}}</span>
      <nav v-if="repaired&&saltUnlocked" class="soup-recipes" :aria-label="t('ui.cooking.recipes')"><button v-for="id in browseRecipes" :key="id" :class="{selected:recipe.id===id}" :aria-pressed="recipe.id===id" :disabled="busy" @click="selected=id"><ItemIcon :id="id" :size="24"/><span>{{itemName(id)}}</span></button></nav>
      <div class="recipe-illustration" aria-hidden="true">
        <ItemIcon v-if="repaired" :id="recipe.id" :size="128"/>
        <svg v-else viewBox="0 0 160 136">
          <ellipse cx="80" cy="113" rx="52" ry="5" fill="#6f5c40" opacity=".12"/>
          <g fill="none" stroke="#796c54" stroke-linejoin="round">
            <path d="M42 55 L47 93 Q51 111 81 111 Q109 111 114 93 L119 55" fill="#a49a81" stroke-width="2"/>
            <ellipse cx="80" cy="55" rx="39" ry="12" fill="#6d7161" stroke-width="2"/>
            <ellipse cx="80" cy="55" rx="30" ry="7" fill="#343d36"/>
            <path d="M42 64 Q20 52 25 75 Q28 85 46 80 M118 64 Q140 52 135 75 Q132 85 114 80" stroke-width="5"/>
            <path d="M88 61 L81 74 L91 83 L83 97 L87 110" stroke="#534e40" stroke-width="2"/>
            <path d="M68 22 L93 22 L89 28 L66 28 Z M102 27 L107 32 L68 91 L60 90 L64 82 Z" fill="#998166"/>
            <path d="M53 97 L70 104 M51 77 L54 93" stroke="#dad0ad" stroke-width="3"/>
          </g>
        </svg>
      </div>
      <span class="recipe-category">{{ t(repaired ? 'ui.cooking.soup_category' : 'ui.cooking.repair_category') }}</span>
      <h2>{{ repaired ? itemName(recipe.id) : t('base.pot.name') }}</h2>
      <div class="recipe-rule" aria-hidden="true"><span>◆</span></div>
      <p class="recipe-note">{{ repaired&&recipe.id===SALT_SOUP_ID?itemDesc(recipe.id):t(!repaired ? 'ui.cooking.repair_description' : done ? 'ui.cooking.soup_description' : 'ui.cooking.trial_description') }}</p>
      <div v-if="repaired" class="health-label">
        <span class="health-cross" aria-hidden="true">✚</span>
        <div><strong>{{ t('ui.cooking.heal', { amount: heal }) }}</strong><small>{{ t('ui.cooking.consume_hint') }}</small></div>
      </div>
      <div v-else class="repair-seal">{{ t('ui.camp.need_repair') }}</div>
      <footer class="paper-foot">{{ t(repaired ? 'ui.cooking.yield' : 'ui.cooking.repair_result') }}</footer>
    </aside>

    <main class="cook-workbench" :class="{ simmering, presenting:phase==='reveal'||phase==='success', broken: !repaired }">
      <div class="station-heading">
        <div><span class="station-light" :class="{ lit: repaired }"></span>{{ t(!repaired ? 'ui.cooking.station_repair' : done ? 'ui.cooking.station_cook' : 'ui.cooking.station_trial') }}</div>
        <span class="station-state">{{ t(repaired ? 'ui.cooking.pot_ready' : 'ui.cooking.pot_broken') }}</span>
      </div>
      <div class="hearth" aria-hidden="true">
        <div class="hearth-glow" v-if="repaired"></div>
        <svg class="cauldron" viewBox="0 0 360 225">
          <defs>
            <linearGradient id="cooking-iron" x1="0" y1="0" x2="1" y2=".7"><stop stop-color="#797b77"/><stop offset=".32" stop-color="#535957"/><stop offset="1" stop-color="#323338"/></linearGradient>
            <linearGradient id="cooking-rim" x2="0" y2="1"><stop stop-color="#b7b59b"/><stop offset=".4" stop-color="#7a807a"/><stop offset="1" stop-color="#414747"/></linearGradient>
            <linearGradient id="cooking-flame" x2="0" y2="1"><stop stop-color="#ffe5a2"/><stop offset=".48" stop-color="#e7a85e"/><stop offset="1" stop-color="#a94e38"/></linearGradient>
          </defs>
          <ellipse cx="180" cy="202" rx="111" ry="12" fill="#17111f" opacity=".5"/>
          <path d="M85 188 L102 165 L256 165 L278 188 L266 206 L96 206 Z" fill="#4a4640" stroke="#6c6250"/>
          <path d="M93 188 L267 188 M127 171 L123 186 M219 171 L225 186 M105 193 L129 195 M234 196 L255 195" stroke="#8c8068" fill="none" opacity=".45"/>
          <path d="M121 189 L225 172 L231 181 L127 200 Z" fill="#71543b" stroke="#362f2d" stroke-width="2"/>
          <path d="M139 172 L237 188 L235 201 L135 182 Z" fill="#8a6641" stroke="#362f2d" stroke-width="2"/>
          <path d="M140 177 L219 192 M137 193 L210 181" stroke="#bb8a51" opacity=".55"/>
          <g v-if="repaired" class="flames">
            <path d="M148 187 Q122 168 143 142 Q145 156 154 161 Q167 139 166 123 Q194 148 187 164 Q201 156 205 138 Q229 173 212 188 Z" fill="url(#cooking-flame)"/>
            <path d="M163 186 Q147 173 165 150 Q166 164 178 169 Q190 159 194 153 Q208 176 194 187 Z" fill="#ffe1a0"/>
          </g>
          <path d="M110 95 L115 139 Q120 163 179 163 Q240 162 245 139 L250 95" fill="url(#cooking-iron)" stroke="#2f3036" stroke-width="3"/>
          <path d="M123 110 L128 140 Q138 154 166 154" stroke="#a7aaa0" stroke-width="4" fill="none" opacity=".32"/>
          <path d="M201 158 Q229 154 239 140 L242 108" stroke="#211c26" stroke-width="3" fill="none" opacity=".5"/>
          <path d="M112 108 Q78 91 81 115 Q84 137 117 123 M249 108 Q281 91 279 115 Q277 137 244 123" stroke="#373b3f" stroke-width="10" fill="none"/>
          <path d="M109 108 Q80 95 84 115 Q89 130 114 122 M251 107 Q279 94 276 114" stroke="#93998f" stroke-width="3" fill="none"/>
          <ellipse cx="180" cy="95" rx="71" ry="20" fill="url(#cooking-rim)" stroke="#a8ae99" stroke-width="2"/>
          <ellipse cx="180" cy="95" rx="60" ry="14" :fill="repaired ? '#a08b59' : '#292c32'" stroke="#3b403f" stroke-width="2"/>
          <g v-if="repaired">
            <path d="M147 97 Q144 83 159 85 L165 93 L159 101 Z M201 93 Q205 81 216 92 L213 101 L202 100 Z" fill="#d5c4a0" stroke="#756945"/>
            <path d="M175 92 L189 88 M171 101 L180 103 M222 95 L233 93" stroke="#748357" stroke-width="3"/>
            <ellipse cx="143" cy="92" rx="4" ry="1" fill="#e6ce8f" opacity=".7"/>
            <ellipse class="bubble" cx="189" cy="97" rx="3" ry="1.4" fill="none" stroke="#dcc795"/>
            <ellipse class="bubble second" cx="165" cy="91" rx="2" ry="1" fill="none" stroke="#dcc795"/>
          </g>
          <g v-if="simmering" class="soup-swirl" fill="none" stroke="#dcc28a" stroke-width="1">
            <ellipse cx="180" cy="95" rx="29" ry="6" stroke-dasharray="12 9 5 7"/>
            <ellipse cx="180" cy="95" rx="39" ry="9" stroke-dasharray="6 16 13 10" opacity=".45"/>
          </g>
          <g v-if="simmering" class="ladle-motion">
            <ellipse cx="178" cy="98" rx="12" ry="3" fill="#605635" opacity=".35"/>
            <path d="M177 96Q184 83 193 65L207 28" fill="none" stroke="#493b30" stroke-width="8" stroke-linecap="round"/>
            <path d="M177 94Q184 81 193 64L207 28" fill="none" stroke="#a2855c" stroke-width="5" stroke-linecap="round"/>
            <path d="M180 88L190 66L204 30" fill="none" stroke="#d1b587" stroke-width="1.3" stroke-linecap="round"/>
            <path d="M168 92Q171 104 179 102Q189 98 187 91" fill="#736343" stroke="#483c31" stroke-width="1.2"/>
            <ellipse cx="177.5" cy="92" rx="10" ry="4" fill="#c2ac7d" stroke="#776347" stroke-width="1"/>
            <ellipse cx="177.5" cy="92" rx="7.3" ry="2.5" fill="#a78d56"/>
            <path d="M171 91Q176 89 181 91" fill="none" stroke="#e1cd9b" stroke-width=".8"/>
          </g>
          <g fill="#9b9a7e" stroke="#404242"><circle cx="126" cy="113" r="3"/><circle cx="236" cy="113" r="3"/></g>
          <path v-if="!repaired" d="M185 113 L180 125 L188 132 L180 145 L184 161" stroke="#211c26" stroke-width="3" fill="none"/>
          <g v-if="!repaired" class="repair-annotations" stroke="#ad9574" stroke-width="1" fill="none">
            <path d="M180 129 L184 61 L216 61 M267 120 L291 138 L309 138" stroke-dasharray="3 3"/>
            <circle cx="180" cy="129" r="3"/><circle cx="267" cy="120" r="3"/>
            <text x="196" y="52" stroke="none" fill="#b3a181">{{ t('ui.cooking.repair_body') }}</text>
            <text x="290" y="155" stroke="none" fill="#b3a181">{{ t('ui.cooking.repair_handle') }}</text>
          </g>
          <g v-else class="steam" fill="none" stroke="#d0cbb1" stroke-width="3" stroke-linecap="round">
            <path d="M152 71 Q141 57 153 44 Q162 34 152 20"/>
            <path d="M181 66 Q197 53 183 40 Q174 31 186 14"/>
            <path d="M213 73 Q224 58 215 48 Q207 38 215 30"/>
          </g>
          <path d="M130 139 L144 141 M209 146 L222 142 M135 117 L157 119" stroke="#a6b0a0" opacity=".13"/>
        </svg>
        <div v-if="cooked&&(phase==='reveal'||phase==='success')" class="cook-result" :class="{celebrating:phase==='success'}" :style="{'--reveal-duration':REVEAL_MS+'ms'}" role="status" aria-live="polite">
          <div class="result-halo" aria-hidden="true"></div>
          <div class="result-portrait"><ItemIcon :id="cooked.id" :size="112"/><b>×{{cooked.qty}}</b></div>
          <strong v-if="phase==='success'" class="success-word" :aria-label="t('ui.cooking.success')"><span v-for="(char,i) in t('ui.cooking.success')" :key="i" :style="{'--letter-delay':i*65+'ms'}" aria-hidden="true">{{char}}</span></strong>
          <small class="result-name">{{itemName(cooked.id)}}</small>
        </div>
        <span class="hearth-caption">{{ t(repaired ? 'ui.cooking.hearth_note' : 'ui.cooking.repair_plan') }}</span>
      </div>
      <fieldset v-if="repaired" class="cook-quantity" :disabled="busy"><legend>{{t('ui.cooking.quantity')}}</legend><div class="quantity-options"><button v-for="n in [1,3,5,10]" :key="n" type="button" :class="{chosen:preset===n}" :aria-pressed="preset===n" @click="preset=n">{{n}}×</button><button type="button" :class="{chosen:preset==='custom'}" :aria-pressed="preset==='custom'" @click="chooseCustom">{{t('ui.cooking.custom')}}</button><input v-if="preset==='custom'" ref="customInput" v-model="customValue" type="number" min="1" step="1" inputmode="numeric" :aria-label="t('ui.cooking.custom_quantity')" @keydown.enter.prevent="perform"/></div></fieldset>
      <div class="materials-heading"><h3>{{ t(repaired ? 'ui.cooking.materials' : 'ui.cooking.repair_list') }}</h3><span>{{ t('ui.cooking.source') }}</span></div>
      <div ref="ingredientStrip" class="ingredient-tray" :class="{ 'repair-tray': !repaired }" :aria-label="t(repaired?'ui.cooking.materials':'ui.cooking.repair_list')" @wheel="browseWheel" @dragstart.prevent @pointerdown="beginBrowse" @pointermove="moveBrowse" @pointerup="endBrowse" @pointercancel="endBrowse" @pointerleave="leaveBrowse" @lostpointercapture="endBrowse">
        <div v-for="m in materials" :key="m.id" class="ingredient" :class="{ ready: m.ready }">
          <div class="ingredient-icon"><ItemIcon :id="m.id" :size="36"/><span v-if="m.ready" aria-hidden="true">✓</span></div>
          <strong>{{ itemName(m.id) }}</strong>
          <small class="ingredient-role">{{ t(!repaired ? 'ui.cooking.repair_material' : m.id === WOOD_ID ? 'ui.cooking.fuel' : 'ui.cooking.ingredient') }}</small>
          <div class="ingredient-count"><b>{{ m.available }}</b><span>/ {{ !repaired||quantityValid?m.required:'—' }}</span></div>
          <span class="ingredient-status">{{repaired&&!quantityValid?'—':t(m.ready?'ui.cooking.sufficient':'ui.cooking.short',{qty:Math.max(0,m.required-m.available)})}}</span>
        </div>
      </div>
      <small v-if="repaired" class="ingredient-browse-hint">{{t('ui.cooking.browse_hint')}}</small>
      <div class="production-row">
        <div v-if="repaired" class="output"><div class="output-slot"><ItemIcon :id="recipe.id" :size="34"/><b>{{quantityValid?batch?.qty:'—'}}</b></div><div><span>{{t('ui.cooking.batch_output',{qty:quantityValid?batch?.qty??1:'—'})}}</span><small>{{ t('ui.cooking.owned', { qty: soupCount }) }}</small></div></div>
        <div v-else class="repair-output">{{ t('ui.cooking.repair_result') }}</div>
        <button class="cook-button" :disabled="busy || !supplied || bagFull" @click="perform">{{t(!repaired?'ui.cooking.repair_button':busy?'ui.cooking.in_progress':'ui.cooking.cook_batch',{qty:quantityValid?quantity:'—'})}}<span aria-hidden="true">›</span></button>
      </div>
      <p class="cook-feedback" :class="{ success: !!message }" role="status" aria-live="polite">{{busy?t(phase==='success'?'ui.cooking.success':phase==='reveal'?'ui.cooking.serving':'ui.cooking.stirring'):message||status}}</p>
    </main>
  </div>
</template>

<style scoped>
.quantity-options input[type='number']{appearance:textfield;-moz-appearance:textfield}
.quantity-options input[type='number']::-webkit-inner-spin-button,
.quantity-options input[type='number']::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.cook-quantity{padding:7px 0 13px;margin:0 0 13px;border:0;border-bottom:1px solid #9781592b}.cook-quantity legend{font-size:10px;letter-spacing:2px;color:#bfa986;padding:0;margin-bottom:3px}.quantity-options{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.quantity-options button{min-width:43px;min-height:30px;padding:5px 11px;border:1px solid #92764c66;background:linear-gradient(#59493266,#352c2566);box-shadow:inset 0 1px #ccb48016,0 1px 2px #100b1633;color:#b4a282;font:inherit;font-size:11px;cursor:pointer}.quantity-options button.chosen{border-color:#c6a56c;background:linear-gradient(#97774e,#6b5035);color:#f3dfb9;box-shadow:inset 0 1px #e7c98f66,inset 0 -2px #45362955}.quantity-options button:disabled{opacity:.5;cursor:default}.quantity-options input{width:75px;min-width:0;box-sizing:border-box;height:30px;padding:4px 7px;border:1px solid #b6935c99;background:#221c1d;color:#e2c99e;font:inherit;font-size:12px;text-align:center;font-variant-numeric:tabular-nums}.quantity-options button:focus-visible,.quantity-options input:focus-visible{outline:2px solid #d9bd86;outline-offset:2px}
.ladle-motion{transform-box:view-box;transform-origin:180px 95px;animation:ladle-stir .75s ease-in-out infinite}.soup-swirl{opacity:.55;animation:soup-circles .75s linear infinite}.presenting .cauldron{opacity:.18;filter:blur(.6px)}.cauldron{transition:opacity .25s,filter .25s}.cook-result{position:absolute;inset:-3px 0 13px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;pointer-events:none;isolation:isolate}.result-halo{position:absolute;inset:0;z-index:-1;background:radial-gradient(ellipse at 50% 43%,#d9b56630,transparent 60%)}.result-portrait{position:relative;filter:drop-shadow(0 7px 7px #110b1755);animation:soup-reveal var(--reveal-duration) cubic-bezier(.18,.7,.25,1) both}.result-portrait b{position:absolute;right:-15px;bottom:7px;padding:3px 8px;border:1px solid #c5a56777;background:linear-gradient(#6b563d,#403127);color:#f0d6a4;font-size:12px;font-weight:500;font-variant-numeric:tabular-nums;box-shadow:inset 0 1px #e0c68d33}.success-word{font-size:clamp(30px,4vw,42px);letter-spacing:4px;line-height:1.3;font-weight:700;color:#f2d698;text-shadow:0 2px #705332,0 4px #31202b,0 0 18px #dbaf4c2b}.success-word span{display:inline-block;animation:success-stamp .42s cubic-bezier(.15,.7,.2,1.35) var(--letter-delay) both}.result-name{font-size:11px;letter-spacing:2px;color:#d0ba94;animation:result-caption var(--reveal-duration) ease-out both}.cook-result.celebrating .result-halo{background:radial-gradient(ellipse at 50% 43%,#e0ba6b3d,transparent 65%)}
@keyframes ladle-stir{0%,100%{transform:translate(-16px,0) rotate(-9deg)}25%{transform:translate(0,-4px) rotate(4deg)}50%{transform:translate(16px,0) rotate(12deg)}75%{transform:translate(0,4px) rotate(-2deg)}}
@keyframes soup-circles{from{stroke-dashoffset:0}to{stroke-dashoffset:-33}}
@keyframes soup-reveal{0%{opacity:0;transform:translateY(22px) scale(.35)}100%{opacity:1;transform:translateY(0) scale(1)}}
@keyframes success-stamp{0%{opacity:0;transform:translateY(8px) scale(.7)}65%{opacity:1;transform:translateY(-2px) scale(1.08)}100%{opacity:1;transform:none}}
@keyframes result-caption{0%,45%{opacity:0}100%{opacity:1}}
@media(prefers-reduced-motion:reduce){.ladle-motion,.soup-swirl,.result-portrait,.success-word span,.result-name{animation:none}.cauldron{transition:none}}

.soup-recipes{display:grid;gap:5px;margin:13px 0 0}.soup-recipes button{display:flex;align-items:center;gap:7px;padding:5px 6px;border:1px solid #92795455;background:#9279540a;color:#8b7554;font:inherit;font-size:10px;cursor:pointer}.soup-recipes button.selected{border-color:#8f7148;background:#92795420;color:#5d492e}.soup-recipes button.selected span{font-weight:700}.ingredient-browse-hint{display:block;margin-top:7px;color:#90816b;font-size:9px;letter-spacing:1px;text-align:right}
.recipe-illustration{display:flex;justify-content:center;align-items:center;min-height:153px;filter:drop-shadow(0 7px 5px #70583626)}.recipe-illustration :deep(.item-icon){pointer-events:none}
.repair-annotations text{font-family:var(--font-body);font-size:10px;letter-spacing:2px}
.cook-layout{display:grid;grid-template-columns:248px minmax(0,1fr);gap:20px;padding:8px 4px 4px}
.recipe-book{position:relative;display:flex;flex-direction:column;padding:28px 23px 18px 28px;color:#4b4437;border:1px solid #a38d67;border-left:8px solid #6c5841;background:repeating-linear-gradient(0deg,transparent 0 3px,#72592f07 3px 4px),radial-gradient(ellipse at 100% 0,#ac89532b,transparent 60%),linear-gradient(95deg,#c1aa84,#dfd1b6 9%,#d5c5a7 96%,#baa17b);box-shadow:-4px 4px 0 #30262a,0 0 0 1px #302c28,inset 3px 0 7px #694d3326,inset -2px 0 #f0dfba,inset 0 -3px #ad9673;transform:rotate(-.7deg)}
.book-binding{position:absolute;left:-7px;top:26px;bottom:25px;width:8px;background:repeating-linear-gradient(0deg,transparent 0 39px,#2e302c 39px 43px,#b7a783 43px 45px,transparent 45px 57px);pointer-events:none}
.paper-tab{position:absolute;top:-7px;right:20px;padding:7px 12px;background:linear-gradient(#72604a,#594a3c);border:1px solid #a4875c;color:#e4cca0;font-size:11px;letter-spacing:2px;box-shadow:0 3px 5px #47372344}
.folio{font-size:10px;letter-spacing:2px;color:#96815f}.recipe-illustration{margin:14px -4px 4px}.recipe-illustration svg{display:block;width:100%;height:153px}.recipe-category{font-size:10px;letter-spacing:3px;color:#8e7755}.recipe-book h2{font-size:25px;letter-spacing:2px;font-weight:normal;margin:10px 0 15px}
.recipe-rule{height:1px;background:#89714b44;position:relative;text-align:center;margin-bottom:15px}.recipe-rule span{position:relative;top:-9px;display:inline-block;padding:0 8px;background:#d9c9ac;color:#9d835c;font-size:10px}.recipe-note{font-size:12px;line-height:1.9;margin:0 0 18px;color:#79694f;min-height:46px}
.health-label{display:flex;gap:11px;align-items:center;padding:11px 0;border-top:1px solid #91795033;border-bottom:1px solid #91795033}.health-cross{font-size:24px;color:#747957;text-shadow:0 1px #f4e0b8}.health-label strong{font-size:13px;font-weight:normal;color:#5c664d}.health-label small{display:block;font-size:10px;color:#93825f;margin-top:6px}.repair-seal{padding:11px;border:2px double #9d66558a;color:#9c6656;font-size:13px;text-align:center;transform:rotate(-4deg);letter-spacing:3px}
.paper-foot{margin-top:auto;padding-top:22px;font-size:10px;letter-spacing:1px;color:#927c58}
.cook-workbench{min-width:0;padding:4px 2px 0}.station-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#d9c9a6;font-size:13px;letter-spacing:2px}.station-heading>div{display:flex;align-items:center;gap:9px}.station-light{width:5px;height:5px;transform:rotate(45deg);background:#7c6b57;border:1px solid #b29a70}.station-light.lit{background:#bea367;box-shadow:0 0 7px #c6a36155}.station-state{font-size:10px;color:#938b78;letter-spacing:0}
.hearth{position:relative;isolation:isolate;display:flex;flex-direction:column;align-items:center;padding-top:0;margin:10px 0 19px;background:radial-gradient(ellipse at 50% 75%,#b5884b0a,transparent 65%);border-bottom:1px solid #9781592b}.cauldron{display:block;width:min(100%,330px);height:193px;overflow:visible}.hearth-glow{position:absolute;z-index:-1;bottom:17px;left:20%;width:60%;height:90px;background:radial-gradient(ellipse,#d69b4e1c,transparent 70%);pointer-events:none}.hearth-caption{font-size:10px;letter-spacing:2px;color:#8c8270;margin:2px 0 13px}.steam{opacity:.3;animation:steam-rise 4s ease-in-out infinite}.flames{transform-origin:180px 188px;animation:fire-breathe 2.2s ease-in-out infinite}.bubble{opacity:.55;animation:bubble-rise 3s ease-in-out infinite}.bubble.second{animation-delay:1.3s}.simmering .steam{opacity:.7;animation-duration:1s}.simmering .flames{animation-duration:.35s}.broken .hearth{filter:saturate(.55)}
.materials-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}.materials-heading h3{font-size:12px;font-weight:normal;letter-spacing:2px;color:#c2b292;margin:0}.materials-heading>span{font-size:10px;color:#847d6e}
.ingredient-tray{display:flex;overflow-x:auto;overscroll-behavior-x:contain;touch-action:pan-y pinch-zoom;scrollbar-width:thin;scrollbar-color:#aa8a5555 #17121b66;user-select:none;cursor:grab;gap:8px;padding:9px;background:linear-gradient(150deg,#211c23,#252128);border:1px solid #665b44;box-shadow:inset 0 2px 8px #100b164f,0 1px #b49b5522}.ingredient-tray.dragging{cursor:grabbing}.repair-tray .ingredient{flex-basis:calc((100% - 8px)/2)}.ingredient{flex:0 0 calc((100% - 16px)/3);min-width:100px;position:relative;padding:12px 4px 10px;text-align:center;background:linear-gradient(150deg,#40372f,#302a2c);border:1px solid #6e654844;box-shadow:inset 0 1px #b7a57115}.ingredient-icon{position:relative;display:flex;justify-content:center;margin-bottom:8px}.ingredient-icon>span{position:absolute;right:4px;bottom:-2px;color:#9baf84;font-size:10px}.ingredient strong{display:block;font-size:12px;font-weight:normal;color:#d0c1a0;overflow-wrap:anywhere}.ingredient-role{display:block;margin-top:5px;color:#898876;font-size:9px}.ingredient-count{margin:9px 0 4px;font-size:14px;font-variant-numeric:tabular-nums;color:#c0b397}.ingredient-count b{font-weight:normal;color:#c89175}.ingredient-count span{font-size:11px;color:#8d8777;margin-left:5px}.ingredient.ready .ingredient-count b{color:#aabe91}.ingredient-status{font-size:9px;color:#bd8c73}.ingredient.ready .ingredient-status{color:#84917a}
.production-row{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:20px}.output{display:flex;gap:10px;align-items:center;min-width:0}.output-slot{position:relative;display:grid;place-items:center;width:44px;height:44px;flex:none;border:1px solid #a78d5566;background:linear-gradient(140deg,#44392d,#2f282b);box-shadow:inset 0 2px 5px #17111d66,inset 0 -1px #c3ab5622}.output-slot b{position:absolute;right:3px;bottom:0;font-size:10px;color:#dac8a6;font-weight:normal;text-shadow:0 1px #211927}.output>div>span{font-size:11px;color:#cbb792}.output small{display:block;font-size:10px;color:#8e8776;margin-top:6px}.repair-output{font-size:11px;color:#a89b80;line-height:1.8;max-width:140px}
.cook-button{display:flex;align-items:center;justify-content:center;gap:18px;min-height:44px;min-width:164px;padding:10px 17px;border:1px solid #ba9a62;background:linear-gradient(#8a7150,#6b563e);box-shadow:inset 0 1px #d9bd8577,inset 0 -3px #3d362b66,0 3px 4px #16101f55;color:#f0dfb8;font:inherit;font-size:14px;letter-spacing:2px;cursor:pointer;transition:filter .15s,transform .1s}.cook-button>span{font-size:22px;line-height:1;color:#d6b77c}.cook-button:hover:enabled{filter:brightness(1.16)}.cook-button:active:enabled{transform:translateY(1px);box-shadow:inset 0 2px 5px #342d2866}.cook-button:focus-visible{outline:2px solid #e2c997;outline-offset:3px}.cook-button:disabled{background:linear-gradient(#4c4237,#3c3430);border-color:#6a6b554d;color:#868677;cursor:default;box-shadow:inset 0 1px #abab7322}.cook-button:disabled>span{color:#747a67}
.cook-feedback{min-height:16px;margin:11px 0 0;font-size:11px;line-height:1.6;text-align:right;color:#9b927e}.cook-feedback.success{color:#c3bf99}
@keyframes steam-rise{0%,100%{transform:translateY(2px);opacity:.18}50%{transform:translateY(-4px);opacity:.36}}
@keyframes fire-breathe{0%,100%{transform:scale(1,.97);opacity:.85}50%{transform:scale(1.025,1.04);opacity:1}}
@keyframes bubble-rise{0%,100%{opacity:.15}50%{opacity:.7}}
@media(max-width:720px){.cook-layout{grid-template-columns:195px minmax(0,1fr);gap:14px}.recipe-book{padding:28px 16px 17px 19px}.recipe-book h2{font-size:21px}.recipe-illustration svg{height:126px}.cauldron{height:174px}.production-row{flex-wrap:wrap}.cook-button{flex:1;min-width:135px}.materials-heading{flex-wrap:wrap}.station-heading{flex-wrap:wrap}.ingredient-tray{padding:6px;gap:5px}.ingredient{padding:10px 2px}.ingredient strong{font-size:11px}}
@media(max-width:530px){.cook-layout{grid-template-columns:1fr;gap:20px}.recipe-book{padding:22px 20px 15px 23px;display:grid;grid-template-columns:105px 1fr;column-gap:17px;transform:none}.folio{grid-column:1/-1}.recipe-illustration{grid-column:1;grid-row:2/7;margin:12px 0 0}.recipe-illustration svg{height:115px}.recipe-category{margin-top:18px}.recipe-book h2{font-size:20px;margin:8px 0 12px}.recipe-rule{display:none}.recipe-note{min-height:0;margin-bottom:12px;font-size:11px}.health-label{padding:8px 0}.paper-foot{padding-top:13px;font-size:9px;grid-column:1/-1}.repair-seal{padding:8px;font-size:11px}.cook-workbench{padding:0 2px}.hearth{margin-top:0;margin-bottom:16px}.cauldron{height:158px}.hearth-caption{margin-top:-4px}.production-row{flex-wrap:nowrap}.cook-button{flex:none}}
@media(max-width:530px){.has-recipes .soup-recipes{grid-column:1/-1}.has-recipes .recipe-illustration{grid-row:3/8;min-height:115px}.has-recipes .recipe-category,.has-recipes h2,.has-recipes .recipe-note,.has-recipes .health-label{grid-column:2}.has-recipes .recipe-category{margin-top:10px}.has-recipes .soup-recipes{margin-top:12px}}
@media(prefers-reduced-motion:reduce){.steam,.flames,.bubble{animation:none}.cook-button{transition:none}}
</style>
