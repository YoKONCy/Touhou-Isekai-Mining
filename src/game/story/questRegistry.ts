import type { CharacterProfile } from '../../shared/profile'
import type { MaterialCost } from '../../shared/production'
import { materialCount } from '../../shared/production'
import type { QuestDefinition, QuestJournalData, QuestMaterial, QuestActionResult } from '../../shared/quests'

const quests=new Map<string,QuestDefinition>()
export function registerQuest(quest:QuestDefinition):void{quests.set(quest.id,quest)}
export function questMaterials(profile:CharacterProfile,cost:MaterialCost):QuestMaterial[]{
  return cost.map(([id,required])=>({id,required,available:materialCount(profile,id)}))
}
export function questJournals(profile:CharacterProfile):QuestJournalData[]{
  return [...quests.values()].sort((a,b)=>a.order-b.order).filter(quest=>quest.visible(profile)).map(quest=>({...quest.journal(profile),category:quest.category}))
}
/** 重新检查当前状态，拒绝旧界面、已完成任务或尚未开放任务的重复交付。 */
export function performQuestAction(profile:CharacterProfile,id:string):QuestActionResult|null{
  const quest=quests.get(id)
  if(!quest?.action||!quest.visible(profile))return null
  const journal=quest.journal(profile)
  if(journal.completed||!journal.action||journal.action.disabled)return null
  return quest.action(profile)
}
