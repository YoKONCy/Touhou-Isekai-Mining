import type { NpcConversation } from '../../../../game/story/npcDialogue'
import type { CharacterProfile } from '../../../../shared/profile'
import { furnaceStage, materialCount } from '../../../../shared/production'
import { RELAY_FLAGS } from '../../mainline/mine-relay/state'
import { HEAT_NOZZLE_ID, OLD_FURNACE_PARTS_ID } from '../../../items/vanilla/ids'
import type { DialogueTree, DialogueNode } from '../../../../game/dialogue/types'

/** 营地闲聊随主线、修缮与炉内批次变化，同阶段尽量先播新话题。 */
export const CAMP_REIMU_TREE = 'touhou:camp_reimu'

/** 话题 A/B 各自的已播 flag（链尾落档，下次不再抽中） */
export const TALK_A_FLAG = 'quest.reimu.talkA.done'
export const TALK_B_FLAG = 'quest.reimu.talkB.done'

const dailyPools={
  salt:['salt_rocks','salt_return'], soup:['soup_pinch','soup_taste'],
  table:['table_cleared','table_fiber'], craft:['craft_grip','craft_flax'],
  masonry:['masonry_cracks','masonry_wood'], bellows:['bellows_air','bellows_seam'],
  parts:['parts_found'], key:['key_equipment','key_patience'], found:['found_fit','found_coal'],
  idle:['idle_ore','idle_smoke'], heating:['heating_wait','heating_safe'], ready:['ready_collect','ready_next'],
  metal:['metal_hot','metal_tools'], deep:['deep_rest','deep_supplies']
} as const
function dailyPhase(profile:CharacterProfile):keyof typeof dailyPools|null{
  const stage=furnaceStage(profile)
  if(!profile.smelting&&profile.flagBool(RELAY_FLAGS.reported))return 'deep'
  if(!profile.smelting&&profile.flagBool(RELAY_FLAGS.metalSeen))return 'metal'
  if(stage===3)return profile.smelting?.state==='ready'?'ready':profile.smelting?'heating':'idle'
  if(stage===2&&materialCount(profile,OLD_FURNACE_PARTS_ID)>0)return 'parts'
  if(stage===2)return materialCount(profile,HEAT_NOZZLE_ID)>0?'found':'key'
  if(stage===1)return 'bellows'
  if(profile.flagBool('base.furnace.inspected'))return 'masonry'
  if(profile.flagBool('quest.saltSoup.done'))return profile.flagBool('base.crafting.unlocked')?'craft':'table'
  if(profile.flagBool('recipe.saltSoup.unlocked'))return 'soup'
  return profile.flagBool('quest.reimu.cooking.done')?'salt':null
}
function dailyNodes():Record<string,DialogueNode>{
  const nodes:Record<string,DialogueNode>={}
  for(const topics of Object.values(dailyPools))for(const topic of topics){
    for(let i=1;i<=3;i++){
      const id=`${topic}_${i}`
      nodes[id]={id,speaker:i===2?'story.speaker.hero':'story.speaker.reimu',text:`quest.reimu_daily.${topic}.${i}`,...(i<3?{next:`${topic}_${i+1}`}:{effects:[{type:'flagSet' as const,key:`quest.reimu.daily.${topic}.seen`}]})}
    }
  }
  return nodes
}

/** 完播后的话题记忆可单独落盘，不改写死亡回档所用的下矿前检查点。 */
export function reimuConversationFlags(entry:string):string[]{
  const topic=Object.values(dailyPools).flat().find(topic=>entry===`${topic}_1`)
  return ['quest.reimu.lastTopic',...(topic?[`quest.reimu.daily.${topic}.seen`]:entry==='ta1'?[TALK_A_FLAG]:entry==='tb1'?[TALK_B_FLAG]:[])]
}

export function pickReimuEntry(profile: CharacterProfile): string {
  const phase=dailyPhase(profile)
  if(phase){
    const topics=dailyPools[phase]
    const unseen=topics.filter(topic=>!profile.flagBool(`quest.reimu.daily.${topic}.seen`))
    const pool=(unseen.length?unseen:topics).map(topic=>`${topic}_1`)
    const candidates=pool.filter(entry=>entry!==profile.flag('quest.reimu.lastTopic'))
    const choices=candidates.length?candidates:pool,entry=choices[Math.floor(Math.random()*choices.length)]!
    profile.setFlag('quest.reimu.lastTopic',entry)
    return entry
  }
  const unseen: string[] = []
  if (!profile.flagBool(TALK_A_FLAG)) unseen.push('ta1')
  if (!profile.flagBool(TALK_B_FLAG)) unseen.push('tb1')
  const last = profile.flags['quest.reimu.lastTopic']
  const pool = unseen.length ? unseen : ['ta1', 'tb1', ...(profile.flagBool('quest.reimu.cooking.done') ? [] : ['hello'])]
  const candidates = pool.filter(entry => entry !== last)
  const entry = (candidates.length ? candidates : pool)[Math.floor(Math.random() * (candidates.length || pool.length))]
  profile.setFlag('quest.reimu.lastTopic', entry)
  return entry
}

export const reimuCookingTree: DialogueTree = {
  id: CAMP_REIMU_TREE,
  start: 'hello',
  nodes: {
    ...dailyNodes(),
    // —— 催饭三连（话题播完后的兜底） ——
    hello: { id: 'hello', speaker: 'story.speaker.reimu', text: 'quest.reimu_cooking.reimu.hello', next: 'food' },
    food: { id: 'food', speaker: 'story.speaker.hero', text: 'quest.reimu_cooking.hero.food', next: 'answer' },
    answer: { id: 'answer', speaker: 'story.speaker.reimu', text: 'quest.reimu_cooking.reimu.answer' },

    // —— 话题 A：史莱姆围殴的真相 + 符卡「梦想封印」 ——
    ta1: { id: 'ta1', speaker: 'story.speaker.hero', text: 'quest.reimu_cooking.ta1', next: 'ta2' },
    ta2: { id: 'ta2', speaker: 'story.speaker.reimu', text: 'quest.reimu_cooking.ta2', next: 'ta3' },
    ta3: { id: 'ta3', speaker: 'story.speaker.reimu', text: 'quest.reimu_cooking.ta3', next: 'ta4' },
    ta4: { id: 'ta4', speaker: 'story.speaker.hero', text: 'quest.reimu_cooking.ta4', next: 'ta5' },
    ta5: { id: 'ta5', speaker: 'story.speaker.reimu', text: 'quest.reimu_cooking.ta5', next: 'ta6' },
    ta6: { id: 'ta6', speaker: 'story.speaker.reimu', text: 'quest.reimu_cooking.ta6', next: 'ta7' },
    ta7: {
      id: 'ta7',
      speaker: 'story.speaker.reimu',
      text: 'quest.reimu_cooking.ta7',
      effects: [{ type: 'flagSet', key: TALK_A_FLAG }]
    },

    // —— 话题 B：主角的来历 ——
    tb1: { id: 'tb1', speaker: 'story.speaker.reimu', text: 'quest.reimu_cooking.tb1', next: 'tb2' },
    tb2: {
      id: 'tb2',
      speaker: 'story.speaker.hero',
      text: 'quest.reimu_cooking.tb2',
      effects: [{ type: 'flagSet', key: TALK_B_FLAG }]
    }
  }
}

export const reimuConversation:NpcConversation={id:'touhou:reimu',treeId:CAMP_REIMU_TREE,pickEntry:pickReimuEntry,persistFlags:reimuConversationFlags}
