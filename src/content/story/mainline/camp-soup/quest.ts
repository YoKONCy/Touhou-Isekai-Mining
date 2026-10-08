import type { QuestDefinition, QuestJournalData } from '../../../../shared/quests'
import type { CharacterProfile } from '../../../../shared/profile'
import { t } from '../../../../i18n'
import { questMaterials } from '../../../../game/story/questRegistry'
import { materialCount } from '../../../../shared/production'
import { SOUP_ID } from '../../../items/vanilla/ids'
import { POT_REPAIR_COST as REPAIR_COST, SOUP_COOK_COST as COOK_COST, deliverSoup } from './transactions'
import { SOUP_DELIVERY_TREE } from './dialogues'

function journal(profile:CharacterProfile):QuestJournalData{
  const done=profile.flagBool('quest.reimu.cooking.done'),repaired=profile.flagBool('base.pot.repaired')
  const count=(id:string)=>materialCount(profile,id),requirements=(cost:ReadonlyArray<readonly [string,number]>)=>questMaterials(profile,cost)
  const giver=t('quest.reimu_cooking.giver'),finished=t('quest.reimu_cooking.finished')
  const soupReady=done||count(SOUP_ID)>0,step=done?3:!repaired?0:soupReady?2:1
  const repairMaterials=requirements(REPAIR_COST),repairReady=repairMaterials.every(m=>m.available>=m.required)
  const soupGoal=t(!repaired?'quest.reimu_cooking.repair':soupReady?'quest.reimu_cooking.action_deliver':'quest.reimu_cooking.cook')
  return {
    id:'soup',chapter:t('quest.reimu_cooking.chapter'),title:t('quest.reimu_cooking.name'),summary:t('quest.reimu_cooking.summary'),giver,completed:done,
    status:t(done?'ui.camp.done':repaired&&soupReady?'ui.camp.deliverable':'ui.camp.active'),
    objectives:[
      {id:'repair',title:t('quest.reimu_cooking.repair'),complete:done||repaired,current:step===0,
        note:!done&&!repaired?t('quest.reimu_cooking.repair_note'):undefined,materials:!done&&!repaired?repairMaterials:undefined,metered:true,
        location:!done&&!repaired?{text:t('quest.reimu_cooking.repair_location'),status:t(repairReady?'quest.reimu_cooking.repair_ready':'quest.reimu_cooking.repair_collect'),ready:repairReady}:undefined},
      {id:'cook',title:t('quest.reimu_cooking.cook'),complete:soupReady,current:step===1,locked:!done&&!repaired,
        note:step===1?t('quest.reimu_cooking.cook_location'):undefined,materials:!soupReady?requirements(COOK_COST):undefined},
      {id:'deliver',title:t('quest.reimu_cooking.deliver'),complete:done,current:step===2,locked:step<2,materials:!done?requirements([[SOUP_ID,1]]):undefined}
    ],
    goal:done?finished:t('ui.camp.goal',{goal:soupGoal}),
    action:!done?{label:t('quest.reimu_cooking.action_deliver'),disabled:!repaired||!soupReady}:undefined
  }
}

export const soupQuest:QuestDefinition={
  id:'soup',category:'mainline',order:10,visible:()=>true,journal,
  action(profile){
    const wasDone=profile.flagBool('quest.reimu.cooking.done'),message=deliverSoup(profile)
    const ok=!wasDone&&profile.flagBool('quest.reimu.cooking.done')
    return {ok,message,scene:ok?SOUP_DELIVERY_TREE:undefined}
  }
}
