import type { StoryPack } from '../../types'
import zhCn from './lang/zh_cn.json'
import { craftingTrees } from './dialogues'
import { craftingQuest, recipeQuests } from './quest'
import { craftingScenes } from './scenes'

export default {
  id:'touhou:crafting',languages:{zh_cn:zhCn},trees:[...craftingTrees],
  quests:[craftingQuest,...recipeQuests],
  scenes:craftingScenes
} satisfies StoryPack
