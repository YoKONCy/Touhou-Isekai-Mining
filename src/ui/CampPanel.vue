<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { CharacterProfile } from '../shared/profile'
import type { UIPanelKind } from '../game/gameEvents'
import { repairPot, cookSoupBatch } from '../content/story/mainline/camp-soup/transactions'
import { POT_REPAIR_TREE } from '../content/story/mainline/camp-soup/dialogues'
import { dialogue } from '../game/dialogue/dialogueService'
import { playStory, playNextStory, hasAvailableStory } from '../game/story/storyDirector'
import { questJournals as listQuestJournals, performQuestAction } from '../game/story/questRegistry'
import { saveService } from '../core/save/saveService'
import { t } from '../i18n'
import QuestJournal from './QuestJournal.vue'
import CookingPanel from './CookingPanel.vue'
import StoragePanel from './StoragePanel.vue'
import ProductionPanel from './ProductionPanel.vue'
import type { ModuleActions } from '../shared/moduleActions'

const props=defineProps<{profile:CharacterProfile;actions:ModuleActions;kind:UIPanelKind;tick:number;anchor:{x:number;y:number}}>()
const emit=defineEmits<{close:[];panel:[kind:UIPanelKind];talk:[]}>()
const message=ref(''),selection=ref(0),revision=ref(0)
const done=computed(()=>{void props.tick;void revision.value;return props.profile.flagBool('quest.reimu.cooking.done')})
const repaired=computed(()=>{void props.tick;void revision.value;return props.profile.flagBool('base.pot.repaired')})
const title=computed(()=>t(props.kind==='cooking'&&!repaired.value?'ui.cooking.maintenance_title':{npc:'story.speaker.reimu',quests:'ui.camp.journal',storage:'ui.camp.storage',cooking:'ui.cooking.title',crafting:'ui.production.crafting',furnace:'ui.production.furnace'}[props.kind as 'npc'|'quests'|'storage'|'cooking'|'crafting'|'furnace']))
const questJournals=computed(()=>{void props.tick;void revision.value;return listQuestJournals(props.profile)})
function act(which:'repair'|'cook',id?:string,quantity=1,complete?:(success:boolean)=>void){
  if(dialogue.isActive){complete?.(false);return}
  if(which==='cook'){
    const result=cookSoupBatch(props.profile,id,quantity)
    message.value=result.message;revision.value++
    if(result.ok)void saveService.autosave()
    complete?.(result.ok);return
  }
  const wasRepaired=repaired.value
  message.value=repairPot(props.profile);revision.value++
  if(!wasRepaired&&repaired.value){
    void saveService.autosave();emit('close')
    playStory(POT_REPAIR_TREE,{profile:props.profile})
  }
}
function questAction(id:string):void{
  if(dialogue.isActive)return
  const result=performQuestAction(props.profile,id)
  if(!result)return
  message.value=result.message;revision.value++
  if(result.ok){
    void saveService.autosave()
    if(result.scene){emit('close');playStory(result.scene,{profile:props.profile})}
  }
}
function furnaceRepaired(stage:number){
  revision.value++
  const context={profile:props.profile,data:{repairStage:stage}}
  if(hasAvailableStory('furnace.repaired',context)){
    emit('close');playNextStory('furnace.repaired',context)
  }
}
function furnaceClaimed(){
  const context={profile:props.profile}
  if(hasAvailableStory('furnace.claimed',context)){emit('close');playNextStory('furnace.claimed',context)}
}
function choose(){if(selection.value===0)emit('talk');else emit('panel','quests')}
function key(e:KeyboardEvent){if(props.kind!=='npc')return;if(['ArrowUp','ArrowDown','KeyW','KeyS','Enter','KeyF'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return;if(e.code==='Enter'||e.code==='KeyF')choose();else selection.value=1-selection.value}}
onMounted(()=>window.addEventListener('keydown',key,true));onBeforeUnmount(()=>window.removeEventListener('keydown',key,true))
</script>
<template>
  <div class="camp-mask hud-modal" :class="{'npc-layer':kind==='npc'}" @click="emit('close')">
    <StoragePanel v-if="kind==='storage'" :profile="profile" :actions="actions" :tick="tick" @close="emit('close')"/>
    <section v-else :key="kind" class="camp-panel gpanel-pop hud-panel" :class="{compact:kind==='npc','quest-panel':kind==='quests','cooking-panel':kind==='cooking','production-panel':kind==='crafting'||kind==='furnace'}" :style="kind==='npc'?{left:`${anchor.x}px`,top:`${anchor.y}px`}:undefined" @click.stop>
      <header v-if="kind!=='npc'"><span>{{title}}</span><button class="close-btn" @click="emit('close')" :aria-label="t('ui.camp.close')">×</button></header>
      <template v-if="kind==='npc'">
        <button class="gbtn" :class="{primary:selection===0}" @mouseenter="selection=0" @click="emit('talk')">{{t('ui.camp.talk')}}</button>
        <button class="gbtn" :class="{primary:selection===1}" @mouseenter="selection=1" @click="emit('panel','quests')">{{t('ui.camp.quests')}}</button>
      </template>
      <QuestJournal v-else-if="kind==='quests'" :journals="questJournals" @action="questAction"/>
      <template v-else-if="kind==='cooking'">
        <CookingPanel :profile="profile" :tick="tick" :revision="revision" :repaired="repaired" :done="done" :message="message" @action="act"/>
      </template>
      <ProductionPanel v-else-if="kind==='crafting'||kind==='furnace'" :profile="profile" :tick="tick+revision" :mode="kind" @repaired="furnaceRepaired" @claimed="furnaceClaimed"/>

      <p v-if="message&&kind!=='cooking'" class="feedback" role="status">{{message}}</p>
    </section>
  </div>
</template>
<style scoped>
.production-panel{width:min(940px,94vw);border:1px solid #9c8154;background:repeating-linear-gradient(1deg,transparent 0 28px,#d3aa6806 29px,transparent 30px 57px),linear-gradient(140deg,#423327,#2b211a);box-shadow:0 20px 70px #050812aa,inset 0 0 0 4px #18110855,inset 0 0 0 5px #a0845733}.production-panel>header{color:#e0c99f;border-bottom:1px solid #a084573b;padding-bottom:15px}
.camp-mask{position:fixed;inset:0;z-index:1300;background:#10101c75;display:grid;place-items:center;cursor:auto}.camp-panel{width:min(820px,90vw);max-height:85vh;overflow:auto;padding:24px;color:#e1d0ae}.compact{width:210px;display:flex;flex-direction:column;gap:10px}header{display:flex;justify-content:space-between;align-items:center;font-size:21px;gap:16px;margin-bottom:16px}header button{font-size:12px}p{font-size:14px;line-height:1.8}.muted{color:#ae9d85;font-size:12px}.feedback{color:#e6c68f}button:disabled{opacity:.45;cursor:default}
.close-btn{background:none;border:0;color:inherit;font-size:24px;cursor:pointer;padding:0 5px;line-height:1}.close-btn:hover{color:#c56c57}
.npc-layer{background:transparent;display:block}.npc-layer .compact{position:absolute;width:132px;padding:6px;gap:2px;max-height:none;overflow:visible;background:#20202bd9;border:1px solid #b6a08455;border-radius:5px;box-shadow:0 5px 18px #08091255;transform:translateY(-20%)}
.npc-layer .compact::before{content:'';position:absolute;left:-5px;top:24px;width:8px;height:8px;background:#20202be8;border-left:1px solid #b6a08455;border-bottom:1px solid #b6a08455;transform:rotate(45deg)}
.npc-layer .gbtn{background:transparent;border:0;box-shadow:none;text-align:left;padding:8px 15px;color:#dbd3bf;font-size:14px;letter-spacing:2px;border-radius:3px}.npc-layer .gbtn.primary,.npc-layer .gbtn:hover{background:#b9a17b24;color:#ffe1ac}.npc-layer .gbtn.primary::before{content:'›';position:absolute;left:8px}.npc-layer .gbtn{position:relative}
.quest-panel{width:min(870px,92vw);padding:0;background:#25232b;border:1px solid #726450;border-radius:7px;box-shadow:0 20px 70px #05081299;color:#d8c9ac}
.quest-panel>header{margin:0;padding:17px 24px;border-bottom:1px solid #81715533;font-size:17px;letter-spacing:3px}.quest-panel>.feedback{padding:0 24px 12px;font-size:12px}
@media(max-width:650px){.quest-panel{max-height:90vh}.npc-layer .compact{width:120px}}
/* 手账：皮革封面、装订槽、薄纸叠层和低对比纸纤维。 */
.quest-panel{border:1px solid #80634d;background:repeating-linear-gradient(35deg,#ffffff03 0 1px,transparent 1px 5px),#352a29;box-shadow:0 20px 70px #05081299,inset 0 0 0 3px #281f25,inset 0 0 0 4px #90714b55}
.quest-panel>header{margin:7px 9px 0;border:1px dashed #b3976855;border-bottom:0;border-radius:3px 3px 0 0;color:#d8bf94;text-shadow:0 1px #17131b}
/* 炊事台：墨青柜体、木质包边和黄铜角钉，与营地背包和手账共用材质语言。 */
.cooking-panel{position:relative;isolation:isolate;width:min(840px,94vw);max-height:90vh;box-sizing:border-box;padding:22px 24px 20px;border:7px solid #493d32;border-radius:3px;background:repeating-linear-gradient(0deg,transparent 0 29px,#b2a27404 30px,transparent 31px 62px),linear-gradient(130deg,#3c332e,#2b262d 76%);color:#d9c9a6;box-shadow:0 22px 70px #090812bb,0 0 0 1px #a58b59,0 3px 0 2px #201e24,inset 0 0 0 1px #88725466,inset 0 0 18px #17111f3b;border-image:none}
.cooking-panel::before{content:'';position:absolute;inset:7px;pointer-events:none;background:radial-gradient(circle at 3px 3px,#d4b986 0 1px,#64553c 1px 3px,transparent 4px),radial-gradient(circle at calc(100% - 3px) 3px,#d4b986 0 1px,#64553c 1px 3px,transparent 4px),radial-gradient(circle at 3px calc(100% - 3px),#bba473 0 1px,#64553c 1px 3px,transparent 4px),radial-gradient(circle at calc(100% - 3px) calc(100% - 3px),#bba473 0 1px,#64553c 1px 3px,transparent 4px)}
.cooking-panel>header{margin:0 0 18px;padding:0 2px 15px;border-bottom:1px solid #a58b5940;box-shadow:0 1px #17111f33;font-size:17px;letter-spacing:4px;color:#dac69f;text-shadow:0 1px #241d29}.cooking-panel .close-btn{font-size:24px;color:#a8a087}.cooking-panel .close-btn:hover{color:#e3c999}.cooking-panel .close-btn:focus-visible{outline:1px solid #e3c999;outline-offset:4px}
@media(max-width:720px){.cooking-panel{padding:19px 17px 17px;border-width:5px}}
@media(max-width:530px){.cooking-panel{padding:18px 15px 15px;max-height:92vh}.cooking-panel>header{font-size:15px;margin-bottom:17px}}
.organize-btn{padding:5px 10px;background:#d5b77710;border:1px solid #a68b5c66;border-radius:3px;color:#d8c29d;font:inherit;font-size:11px;cursor:pointer}.organize-btn:hover{background:#d5b77725}
</style>
