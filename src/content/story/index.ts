/** 官方剧情统一注册：章节、NPC、事件的内容包自动发现，语言文件来源随注册记录。 */
import commonZhCn from './lang/zh_cn.json'
import baseZhCn from '../base/lang/zh_cn.json'
import { registerLang, hasKey } from '../../i18n'
import { dialogue } from '../../game/dialogue/dialogueService'
import { registerDialogueAction } from '../../game/dialogue/effects'
import { registerQuest } from '../../game/story/questRegistry'
import { registerStoryScene } from '../../game/story/storyDirector'
import { registerNpcConversation } from '../../game/story/npcDialogue'
import { sfx } from '../../game/audio/Sfx'
import type { StoryPack } from './types'

registerLang('zh_cn',commonZhCn,'src/content/story/lang/zh_cn.json')
registerLang('zh_cn',baseZhCn,'src/content/base/lang/zh_cn.json')
const interfaceLanguages=import.meta.glob<Record<string,string>>('../../ui/lang/*_zh_cn.json',{eager:true,import:'default'})
for(const [path,entries]of Object.entries(interfaceLanguages))registerLang('zh_cn',entries,path.replace('../../','src/'))
const packs=import.meta.glob<StoryPack>('./**/pack.ts',{eager:true,import:'default'})
for(const [path,pack]of Object.entries(packs).sort(([a],[b])=>a.localeCompare(b))){
  const directory=path.replace('./','src/content/story/').replace('/pack.ts','')
  for(const [language,entries]of Object.entries(pack.languages))registerLang(language,entries,`${directory}/lang/${language}.json`)
  pack.trees.forEach(tree=>dialogue.registerTree(tree))
  pack.quests?.forEach(registerQuest)
  pack.scenes?.forEach(registerStoryScene)
  pack.npcs?.forEach(registerNpcConversation)
}
// 所有内容包完成注册后检查台词引用，避免把跨包说话人误判为缺键。
if(import.meta.env.DEV)for(const pack of Object.values(packs))for(const tree of pack.trees)for(const node of Object.values(tree.nodes)){
  for(const key of [node.text,node.speaker,...(node.choices??[]).map(choice=>choice.text)])
    if(key&&!hasKey(key))console.warn(`[剧情] 对话树「${tree.id}」节点「${node.id}」缺少文案：${key}`)
}
registerDialogueAction('sfx.stomachGrowl',()=>sfx.stomachGrowl())
registerDialogueAction('sfx.ropeClimb',()=>sfx.ropeClimb())
registerDialogueAction('sfx.chestOpen',()=>sfx.chestOpen())
registerDialogueAction('sfx.radioStatic',()=>sfx.radioStatic())
