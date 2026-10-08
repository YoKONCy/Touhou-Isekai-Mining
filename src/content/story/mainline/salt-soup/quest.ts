import type { QuestDefinition, QuestJournalData } from '../../../../shared/quests'
import type { CharacterProfile } from '../../../../shared/profile'
import { t } from '../../../../i18n'
import { questMaterials } from '../../../../game/story/questRegistry'
import { materialCount, SALT_SOUP_RECIPE } from '../../../../shared/production'
import { SALT_SOUP_ID, ROCK_SALT_ID } from '../../../items/vanilla/ids'
import { deliverSaltSoup } from './transactions'
import { SALT_DELIVERY_TREE } from './dialogues'

function journal(profile:CharacterProfile):QuestJournalData{
  const saltDone=profile.flagBool('quest.saltSoup.done'),saltUnlocked=profile.flagBool('recipe.saltSoup.unlocked')
  const count=(id:string)=>materialCount(profile,id),requirements=(cost:ReadonlyArray<readonly [string,number]>)=>questMaterials(profile,cost)
  const giver=t('quest.reimu_cooking.giver'),finished=t('quest.reimu_cooking.finished')
  const saltReady=saltDone||count(SALT_SOUP_ID)>0,saltStep=saltDone?3:!saltUnlocked?0:saltReady?2:1
  const saltGoal=t(saltStep===0?'ui.progress.find_salt':saltStep===1?'ui.progress.salt_cook_step':'ui.progress.deliver_salt')
  return {
    id:'salt-soup',chapter:t('ui.progress.chapter'),title:t('ui.progress.salt_soup'),summary:t('ui.progress.salt_summary'),giver,completed:saltDone,
    status:t(saltDone?'ui.camp.done':saltUnlocked&&saltReady?'ui.camp.deliverable':'ui.camp.active'),
    objectives:[
      {id:'salt',title:t('ui.progress.find_salt'),complete:saltDone||saltUnlocked,current:saltStep===0,
        note:saltStep===0?t('ui.progress.salt_goal'):undefined,materials:!saltDone&&!saltUnlocked?requirements([[ROCK_SALT_ID,1]]):undefined},
      {id:'cook',title:t('ui.progress.salt_cook_step'),complete:saltDone||saltUnlocked&&saltReady,current:saltStep===1,locked:!saltDone&&!saltUnlocked,
        note:saltStep===1?t('ui.progress.cook_salt'):undefined,materials:!saltReady?requirements(SALT_SOUP_RECIPE.cost):undefined},
      {id:'deliver',title:t('quest.reimu_cooking.deliver'),complete:saltDone,current:saltStep===2,locked:saltStep<2,materials:!saltDone?requirements([[SALT_SOUP_ID,1]]):undefined}
    ],
    goal:saltDone?finished:t('ui.camp.goal',{goal:saltGoal}),
    action:!saltDone?{label:t('ui.progress.deliver_salt'),disabled:!saltUnlocked||!saltReady}:undefined
  }
}

export const saltSoupQuest:QuestDefinition={
  id:'salt-soup',category:'mainline',order:20,visible:profile=>profile.flagBool('quest.reimu.cooking.done'),journal,
  action(profile){
    const wasDone=profile.flagBool('quest.saltSoup.done'),message=deliverSaltSoup(profile)
    const ok=!wasDone&&profile.flagBool('quest.saltSoup.done')
    return {ok,message,scene:ok?SALT_DELIVERY_TREE:undefined}
  }
}
