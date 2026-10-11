<script setup lang="ts">
import { computed } from 'vue'
import type { CharacterProfile } from '../shared/profile'
import { GRILL_COST } from '../shared/cookingRecipes'
import type { CookingMethod } from '../shared/cookingRecipes'
import { materialCount, buildGrill } from '../shared/production'
import { saveService } from '../core/save/saveService'
import { t,itemName } from '../i18n'
import { sfx } from '../game/audio/Sfx'
import CookingPanel from './CookingPanel.vue'
import GrillVignette from './GrillVignette.vue'
import ItemIcon from './ItemIcon.vue'
const props=defineProps<{profile:CharacterProfile;tick:number;revision:number;message:string}>()
const emit=defineEmits<{built:[];action:[kind:'repair'|'cook',id?:string,quantity?:number,complete?:(success:boolean)=>void,method?:CookingMethod]}>()
const built=computed(()=>{void props.tick;void props.revision;return props.profile.flagBool('base.grill.built')})
const materials=computed(()=>{void props.tick;return GRILL_COST.map(([id,n])=>({id,n,owned:materialCount(props.profile,id)}))})
const ready=computed(()=>props.profile.flagBool('quest.grill.accepted')&&materials.value.every(m=>m.owned>=m.n))
function build(){if(buildGrill(props.profile)){sfx.workbenchCraft(false);void saveService.autosave();emit('built')}}
</script>
<template>
  <CookingPanel v-if="built" :profile="profile" :tick="tick" :revision="revision" repaired done :message="message" station="grill" @action="(kind,id,quantity,complete,method)=>emit('action',kind,id,quantity,complete,method)"/>
  <div v-else class="grill-plan"><div class="grill-drawing"><span>{{t('ui.cooking.grill_plan')}}</span><GrillVignette/></div><section><h2>{{t('quest.grill.title')}}</h2><p>{{t('ui.cooking.grill_desc')}}</p><div class="grill-cost"><div v-for="m in materials" :key="m.id" :class="{enough:m.owned>=m.n}"><ItemIcon :id="m.id" :size="38"/><span>{{itemName(m.id)}}</span><b>{{m.owned}} / {{m.n}}</b></div></div><button :disabled="!ready" @click="build">{{t('ui.cooking.grill_build')}}</button><p>{{t(profile.flagBool('quest.grill.accepted')?'ui.cooking.source':'ui.cooking.grill_locked')}}</p></section></div>
</template>
<style scoped>.grill-plan{display:grid;grid-template-columns:1fr 1fr;gap:25px;align-items:center}.grill-drawing{padding:18px;background:#d6c09a;border:1px solid #9d825e;color:#756047}.grill-drawing>span{font-size:13px;letter-spacing:3px}.grill-plan h2{font-size:21px;color:#e6cea6;font-weight:normal}.grill-plan p{font-size:12px;line-height:1.9;color:#b9a789}.grill-cost{display:flex;gap:8px;margin:22px 0}.grill-cost>div{flex:1;text-align:center;padding:10px 3px;border:1px solid #9c805344;background:#19141c66}.grill-cost span,.grill-cost b{display:block;font-size:11px;margin-top:7px}.grill-cost b{color:#c89977;font-weight:normal}.grill-cost .enough b{color:#b0c191}.grill-plan button{padding:11px 18px;border:1px solid #ad8a58;color:#efdabb;background:linear-gradient(#7b6242,#4c392a);font:inherit;font-size:13px;cursor:pointer}.grill-plan button:disabled{opacity:.4;cursor:default}@media(max-width:650px){.grill-plan{grid-template-columns:1fr}.grill-drawing{max-height:220px}.grill-drawing svg{height:180px}}</style>
