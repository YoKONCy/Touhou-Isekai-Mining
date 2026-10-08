import type { StoryPack } from '../../types'
import zhCn from './lang/zh_cn.json'
import { potRepairTree, soupDeliveryTree } from './dialogues'
import { soupQuest } from './quest'
import { campSoupScenes } from './scenes'

export default {
  id:'touhou:camp_soup',languages:{zh_cn:zhCn},trees:[potRepairTree,soupDeliveryTree],
  quests:[soupQuest],
  scenes:campSoupScenes
} satisfies StoryPack
