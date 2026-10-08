import type { StoryPack } from '../../types'
import zhCn from './lang/zh_cn.json'
import { craftingTrees } from './dialogues'
import { craftingQuest } from './quest'
import { craftingScenes } from './scenes'

export default {
  id:'touhou:crafting',languages:{zh_cn:zhCn},trees:[...craftingTrees],
  quests:[craftingQuest],
  scenes:craftingScenes
} satisfies StoryPack
