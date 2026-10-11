<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import type { CharacterProfile } from '../shared/profile'
import { questJournals } from '../game/story/questRegistry'
import { t } from '../i18n'
const props=defineProps<{profile:CharacterProfile;tick:number;visible:boolean}>()
const emit=defineEmits<{open:[]}>()
const journals=computed(()=>{void props.tick;return questJournals(props.profile)})
const tracked=computed(()=>journals.value.find(quest=>quest.id===props.profile.flag('quest.tracked')&&!quest.completed))
const objective=computed(()=>tracked.value?.objectives.find(step=>step.current)??tracked.value?.objectives.find(step=>!step.complete))
const toast=ref('');let timer:ReturnType<typeof setTimeout>|undefined
let initialized=false;const known=new Map<string,boolean>(),goals=new Map<string,Set<string>>()
const pending:string[]=[]
function showNext(){
  if(toast.value||!props.visible||!pending.length)return
  toast.value=pending.shift()!
  clearTimeout(timer);timer=setTimeout(()=>{toast.value='';showNext()},4500)
}
watch(journals,entries=>{
  for(const quest of entries){
    const previous=known.get(quest.id)
    if(initialized&&(previous===undefined&&!quest.completed||previous===false&&quest.completed)){
      pending.push(t(quest.completed?'ui.quests.completed':'ui.quests.new',{name:quest.title}))
    }else if(initialized&&previous===false){
      for(const goal of quest.objectives)if(goal.complete&&!goals.get(quest.id)?.has(goal.id))pending.push(t('ui.quests.objective',{name:goal.title}))
    }
    known.set(quest.id,quest.completed)
    goals.set(quest.id,new Set(quest.objectives.filter(goal=>goal.complete).map(goal=>goal.id)))
  }
  initialized=true;showNext()
},{immediate:true})
watch(()=>props.visible,()=>showNext())
onBeforeUnmount(()=>clearTimeout(timer))
</script>
<template>
  <aside v-if="visible&&journals.length" class="quest-hud"><button class="journal-link" :aria-label="t('ui.quests.journal')" :title="t('ui.quests.journal')" @click="emit('open')"><span aria-hidden="true">▤</span><span class="journal-label">{{t('ui.quests.journal')}}</span></button><button v-if="tracked" class="tracked-quest" @click="emit('open')"><small>{{t(`ui.quests.${tracked.category??'mainline'}`)}}</small><strong>{{tracked.title}}</strong><span>{{objective?.title??tracked.goal}}</span><i v-if="objective?.materials?.length">{{objective.materials.filter(m=>m.available>=m.required).length}} / {{objective.materials.length}}</i></button></aside>
  <Teleport to="body"><Transition name="quest-toast"><p v-if="visible&&toast" class="quest-toast" role="status">✦ {{toast}}</p></Transition></Teleport>
</template>
<style scoped>.quest-hud{position:absolute;left:calc(100% + 12px);bottom:50%;transform:translateY(50%);width:max-content;pointer-events:auto;z-index:7;font-family:zpix,monospace}.journal-link{display:flex;gap:8px;padding:6px 10px;font:inherit;font-size:11px;color:#cdb791;background:#241d26e6;border:1px solid #9f805455;cursor:pointer}.journal-link>span:first-child{color:#d8ba79}.journal-link{white-space:nowrap;min-height:32px;box-shadow:inset 0 1px #d5ba7b22,0 2px #17131e}.journal-link:hover,.journal-link:focus-visible{border-color:#d9bd80;color:#f0ddbb;outline:none}.tracked-quest{position:absolute;right:0;bottom:calc(100% + 10px);display:block;width:230px;max-width:calc(100vw - 24px);margin:0;padding:11px 12px;text-align:left;background:linear-gradient(115deg,#3a2c2be8,#25212ae8);border:1px solid #9d805366;border-left:3px solid #b89b62;color:#dfcca6;font:inherit;cursor:pointer;box-shadow:inset 0 1px #d3ba8c19}.tracked-quest small{display:block;font-size:9px;color:#a89370;letter-spacing:2px}.tracked-quest strong{display:block;font-size:12px;font-weight:normal;margin:6px 0}.tracked-quest>span{display:block;font-size:10px;line-height:1.7;color:#bdaa8c}.tracked-quest i{display:block;margin-top:6px;font-size:10px;color:#abb891;font-style:normal}.quest-toast{position:fixed;top:24%;left:50%;transform:translateX(-50%);padding:12px 22px;border-block:1px solid #c1a26e66;background:linear-gradient(90deg,transparent,#31252cef 14% 86%,transparent);color:#edd3a5;letter-spacing:1px;font-size:13px;z-index:40;pointer-events:none;text-shadow:0 1px #171018;max-width:80%;text-align:center}.quest-toast-enter-active,.quest-toast-leave-active{transition:opacity .25s,margin-top .25s}.quest-toast-enter-from,.quest-toast-leave-to{opacity:0;margin-top:-8px}@media(max-width:740px){.quest-hud{left:calc(100% + 6px)}.journal-link{width:30px;padding:6px;justify-content:center}.journal-label{display:none}.tracked-quest{width:190px;padding:8px}}@media(prefers-reduced-motion:reduce){.quest-toast-enter-active,.quest-toast-leave-active{transition:none}}</style>
