import type { DialogueNode, DialoguePortrait } from './types'
import { portraitForActor, type DialogueActor } from './portraitCatalog'
import { emotionForDialogue } from './portraitEmotions'

export interface PresentedPortrait extends DialoguePortrait { active: boolean; actor?:DialogueActor }
/** 剧情展示策略独立于 Vue 渲染；显式节点配置优先于角色默认素材。 */
export function resolvePortraits(node?: DialogueNode): PresentedPortrait[] {
  if (!node || node.narration || node.text?.startsWith('story.prologue.walk_') || node.text === 'story.first_death.wake') return []
  const presented=(actor:DialogueActor,active=true):PresentedPortrait=>({...portraitForActor(actor,emotionForDialogue(node,actor,active)),active,actor})
  if (node.portrait) {
    if(/(?:^|\/)hero-base\.png$/.test(node.portrait.src))return [presented('hero')]
    if(/(?:^|\/)reimu-base\.png$/.test(node.portrait.src))return [presented('reimu')]
    if(node.portrait.src.endsWith('/characters/kedama-girl/portrait-boss.png'))return [presented('kedamaBoss')]
    return [{ ...node.portrait,active:true }]
  }
  if (node.speaker === 'story.speaker.rumia' || node.speaker === 'story.speaker.girl') return [presented('rumia')]
  if (node.speaker === 'story.speaker.kedamaGirl') return [presented('kedama')]
  const text = node.text ?? ''
  const unknownReimu = node.speaker === 'story.speaker.unknown'
    && (text.startsWith('story.prologue.s9_') || text.startsWith('story.prologue.s10_'))
  const hero = node.speaker === 'story.speaker.hero'
  if (!hero && node.speaker !== 'story.speaker.reimu' && !unknownReimu) return []
  const paired = text.startsWith('story.prologue.s10_') || text.startsWith('story.prologue.base_')
    || /^quest\.reimu_cooking\.t[ab]\d+$/.test(text) || text.startsWith('quest.radio.') || text.startsWith('quest.pot.')
    || text.startsWith('quest.soup_delivery.') || text.startsWith('quest.reimu_daily.')
    || /^quest\.(salt_found|salt_missing|salt_delivery|craft_intro|tetanus_intro|iron_work|first_iron_weapon|farewell|furnace_inspect|furnace_ready|furnace_key|furnace_parts)\./.test(text)
    || /^story\.mineRelay\.(metal|report)\./.test(text)
  const reimu=presented('reimu',!hero)
  const player=presented('hero',hero)
  return paired ? [reimu, player] : [{ ...(hero ? player : reimu), active: true }]
}
