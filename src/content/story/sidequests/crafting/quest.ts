import type { QuestDefinition, QuestJournalData } from '../../../../shared/quests'
import type { CharacterProfile } from '../../../../shared/profile'
import { t } from '../../../../i18n'
import { SPEAR_TETANUS_ID, SPEAR_IRON_ID, SWORD_IRON_ID, PICK_IRON_ID } from '../../../items/vanilla/ids'

function journal(profile:CharacterProfile):QuestJournalData{
  const craftingDone=profile.flagBool('base.crafting.unlocked')
  const giver=t('quest.reimu_cooking.giver'),finished=t('quest.reimu_cooking.finished')
  return {
    id:'crafting',chapter:t('quest.crafting.chapter'),title:t('ui.progress.crafting'),summary:t('ui.progress.table_goal'),giver,completed:craftingDone,
    status:t(craftingDone?'ui.camp.done':'ui.camp.active'),
    objectives:[{id:'worktable',title:t('ui.progress.crafting'),complete:craftingDone,current:!craftingDone,note:t(craftingDone?'ui.progress.crafting_done':'ui.progress.table_goal')}],
    goal:craftingDone?finished:t('ui.camp.goal',{goal:t('ui.progress.crafting')}),rewards:[{kind:'feature',label:t('quest.crafting.reward')}]
  }
}

export const craftingQuest:QuestDefinition={
  id:'crafting',category:'side',order:30,visible:profile=>profile.flagBool('quest.reimu.cooking.done')&&profile.flagBool('quest.saltSoup.done'),journal
}

export const recipeQuests:QuestDefinition[]=[
  {id:'tetanus_recipe',category:'side',order:31,visible:c=>c.flagBool('base.crafting.unlocked')&&(c.flagBool('story.strangeGel.returned')||c.flagBool('recipe.tetanusSpear.unlocked')),journal:c=>{
    const done=c.flagBool('recipe.tetanusSpear.unlocked')
    return {id:'tetanus_recipe',chapter:t('quest.crafting.chapter'),title:t('quest.crafting.tetanus.title'),summary:t('quest.crafting.tetanus.summary'),giver:t('story.speaker.reimu'),completed:done,status:t(done?'ui.camp.done':'ui.camp.active'),objectives:[{id:'talk',title:t('quest.crafting.table'),complete:done,current:!done}],goal:t(done?'quest.culinary.finished':'quest.crafting.table'),rewards:[{kind:'recipe',id:SPEAR_TETANUS_ID}]}
  }},
  {id:'iron_recipe',category:'side',order:32,visible:c=>c.flagBool('base.crafting.unlocked')&&(c.flagBool('story.ironWork.firstSmelt')||c.flagBool('recipe.ironWork.unlocked')),journal:c=>{
    const unlocked=c.flagBool('recipe.ironWork.unlocked'),crafted=c.flagBool('story.ironWork.firstWeaponCrafted'),done=c.flagBool('story.ironWork.commentSeen')
    return {id:'iron_recipe',chapter:t('quest.crafting.chapter'),title:t('quest.crafting.iron.title'),summary:t('quest.crafting.iron.summary'),giver:t('story.speaker.reimu'),completed:done,status:t(done?'ui.camp.done':'ui.camp.active'),objectives:[{id:'unlock',title:t('quest.crafting.table'),complete:unlocked,current:!unlocked},{id:'craft',title:t('quest.crafting.iron.weapon'),complete:crafted,current:unlocked&&!crafted},{id:'talk',title:t('quest.crafting.iron.comment'),complete:done,current:crafted&&!done}],goal:t(done?'quest.culinary.finished':crafted?'quest.crafting.iron.comment':'quest.crafting.table'),rewards:[{kind:'recipe',id:SPEAR_IRON_ID},{kind:'recipe',id:SWORD_IRON_ID},{kind:'recipe',id:PICK_IRON_ID}]}
  }}
]
