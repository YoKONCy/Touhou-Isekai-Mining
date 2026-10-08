import type { StoryPack } from '../../types'
import zhCn from './lang/zh_cn.json'
import { furnaceTrees } from './dialogues'
import { furnaceQuest } from './quest'
import { furnaceScenes } from './scenes'

export default {
  id:'touhou:furnace',languages:{zh_cn:zhCn},trees:[...furnaceTrees],
  quests:[furnaceQuest],
  scenes:furnaceScenes
} satisfies StoryPack
