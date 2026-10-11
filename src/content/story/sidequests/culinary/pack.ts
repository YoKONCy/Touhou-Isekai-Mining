import type { StoryPack } from '../../types'
import type { QuestDefinition, QuestJournalData } from '../../../../shared/quests'
import { sequence } from '../../sequence'
import { GRILL_INTRO, GRILL_DONE, MISO_INTRO, MISO_DONE, grillAvailable, misoCrafted } from './state'
import { GRILL_COST } from '../../../../shared/cookingRecipes'
import { questMaterials } from '../../../../game/story/questRegistry'
import { t } from '../../../../i18n'
import { MISO_TOFU_SOUP_ID, BITTER_HERB_SOUP_ID, KEDAMA_JELLY_ID, GRILLED_MUSHROOM_ID, GRILLED_TOFU_ID } from '../../../items/vanilla/ids'
import zhCn from './lang/zh_cn.json'

const grillQuest:QuestDefinition={id:'grill',category:'side',order:60,visible:c=>c.flagBool('quest.grill.accepted'),journal:c=>{
  const built=c.flagBool('base.grill.built'),done=c.flagBool('quest.grill.done')
  return {id:'grill',chapter:t('quest.culinary.chapter'),title:t('quest.grill.title'),summary:t('quest.grill.summary'),giver:t('story.speaker.reimu'),completed:done,status:t(done?'ui.camp.done':built?'quest.culinary.finish':'ui.camp.active'),
    objectives:[{id:'build',title:t('quest.grill.build'),complete:built,current:!built,materials:questMaterials(c,GRILL_COST),metered:true,note:t('quest.grill.location')},{id:'talk',title:t('quest.culinary.finish'),complete:done,current:built&&!done}],
    goal:t(done?'quest.culinary.finished':'quest.grill.location'),rewards:[{kind:'feature',label:t('quest.grill.methods')},{kind:'recipe',id:GRILLED_MUSHROOM_ID},{kind:'recipe',id:GRILLED_TOFU_ID}] } satisfies QuestJournalData
}}
const misoQuest:QuestDefinition={id:'miso_soup',category:'side',order:70,visible:c=>c.flagBool('quest.miso.accepted'),journal:c=>{
  const cooked=misoCrafted(c),done=c.flagBool('quest.miso.done')
  return {id:'miso_soup',chapter:t('quest.culinary.chapter'),title:t('quest.miso.title'),summary:t('quest.miso.summary'),giver:t('story.speaker.reimu'),completed:done,status:t(done?'ui.camp.done':cooked?'quest.culinary.finish':'ui.camp.active'),
    objectives:[{id:'cook',title:t('quest.miso.cook'),complete:cooked,current:!cooked},{id:'talk',title:t('quest.culinary.finish'),complete:done,current:cooked&&!done}],
    goal:t(done?'quest.culinary.finished':'quest.miso.location'),rewards:[{kind:'recipe',id:BITTER_HERB_SOUP_ID},{kind:'recipe',id:KEDAMA_JELLY_ID}]} satisfies QuestJournalData
}}
export default {
  id:'touhou:culinary_sidequests',languages:{zh_cn:zhCn},quests:[grillQuest,misoQuest],
  trees:[sequence(GRILL_INTRO,'quest.grill.intro',['reimu','hero','reimu','hero','reimu']),sequence(GRILL_DONE,'quest.grill.done',['narration','hero','reimu']),sequence(MISO_INTRO,'quest.miso.intro',['reimu','hero','reimu','hero','reimu']),sequence(MISO_DONE,'quest.miso.done',['narration','reimu','hero','reimu'])],
  scenes:[
    {id:GRILL_INTRO,event:'camp.fire',when:({profile})=>grillAvailable(profile),completeFlags:['quest.grill.accepted'],notification:'quest.grill.accepted'},
    {id:GRILL_DONE,event:'camp.fire',priority:20,when:({profile})=>profile.flagBool('base.grill.built')&&!profile.flagBool('quest.grill.done'),completeFlags:['quest.grill.done'],notification:'quest.grill.completed'},
    {id:MISO_INTRO,event:'camp.pot',when:({profile})=>profile.flagBool('quest.miso.available')&&!profile.flagBool('quest.miso.accepted'),prepare:({profile})=>{profile.setFlag('quest.miso.startCount',profile.discovery.cooked.get(MISO_TOFU_SOUP_ID)??0);return true},completeFlags:['quest.miso.accepted','recipe.misoSoup.unlocked'],notification:'quest.miso.accepted'},
    {id:MISO_DONE,event:'camp.pot',priority:20,when:({profile})=>misoCrafted(profile)&&!profile.flagBool('quest.miso.done'),completeFlags:['quest.miso.done','recipe.culinaryRewards.unlocked'],notification:'quest.miso.completed'}
  ]
} satisfies StoryPack
