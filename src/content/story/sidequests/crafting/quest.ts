import type { QuestDefinition, QuestJournalData } from '../../../../shared/quests'
import type { CharacterProfile } from '../../../../shared/profile'
import { t } from '../../../../i18n'

function journal(profile:CharacterProfile):QuestJournalData{
  const craftingDone=profile.flagBool('base.crafting.unlocked')
  const giver=t('quest.reimu_cooking.giver'),finished=t('quest.reimu_cooking.finished')
  return {
    id:'crafting',chapter:t('quest.crafting.chapter'),title:t('ui.progress.crafting'),summary:t('ui.progress.table_goal'),giver,completed:craftingDone,
    status:t(craftingDone?'ui.camp.done':'ui.camp.active'),
    objectives:[{id:'worktable',title:t('ui.progress.crafting'),complete:craftingDone,current:!craftingDone,note:t(craftingDone?'ui.progress.crafting_done':'ui.progress.table_goal')}],
    goal:craftingDone?finished:t('ui.camp.goal',{goal:t('ui.progress.crafting')})
  }
}

export const craftingQuest:QuestDefinition={
  id:'crafting',category:'side',order:30,visible:profile=>profile.flagBool('quest.reimu.cooking.done')&&profile.flagBool('quest.saltSoup.done'),journal
}
