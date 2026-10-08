import type { QuestDefinition, QuestJournalData } from '../../../../shared/quests'
import type { CharacterProfile } from '../../../../shared/profile'
import { t } from '../../../../i18n'
import { questMaterials } from '../../../../game/story/questRegistry'
import { furnaceStage, FURNACE_COSTS } from '../../../../shared/production'

function journal(profile:CharacterProfile):QuestJournalData{
  const forgeStage=furnaceStage(profile),giver=t('quest.reimu_cooking.giver')
  const requirements=(cost:ReadonlyArray<readonly [string,number]>)=>questMaterials(profile,cost)
  const furnaceDone=forgeStage===3,inspected=profile.flagBool('base.furnace.inspected')
  return {
    id:'furnace',chapter:t('ui.progress.chapter'),title:t('ui.production.furnace'),summary:t('ui.progress.furnace_summary'),giver,completed:furnaceDone,
    status:t(furnaceDone?'ui.camp.done':'ui.camp.active'),
    objectives:FURNACE_COSTS.map((cost,index)=>({
      id:`furnace-${index}`,title:t(`ui.production.stage${index+1}`),complete:forgeStage>index,
      current:inspected&&forgeStage===index,locked:!furnaceDone&&(!inspected||forgeStage<index),
      note:forgeStage>index?t('ui.production.stage_done',{n:index+1}):!inspected&&index===0?t('ui.progress.inspect_goal'):
        index===2&&forgeStage===2?t('ui.production.stage3_desc')+'　'+t('ui.progress.find_nozzle'):t(`ui.production.stage${index+1}_desc`),
      materials:inspected&&forgeStage===index?requirements(cost):undefined
    })),
    goal:furnaceDone?t('ui.progress.furnace_done'):t('ui.camp.goal',{goal:t(inspected?`ui.production.stage${forgeStage+1}`:'ui.progress.inspect_goal')})
  }
}

export const furnaceQuest:QuestDefinition={
  id:'furnace',category:'mainline',order:40,visible:profile=>profile.flagBool('quest.reimu.cooking.done')&&profile.flagBool('quest.saltSoup.done'),journal
}
