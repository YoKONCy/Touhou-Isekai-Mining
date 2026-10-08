import type { StoryPack } from '../../types'
import zhCn from './lang/zh_cn.json'
import { saltSoupTrees } from './dialogues'
import { saltSoupQuest } from './quest'
import { saltSoupScenes } from './scenes'

export default {
  id:'touhou:salt_soup',languages:{zh_cn:zhCn},trees:[...saltSoupTrees],
  quests:[saltSoupQuest],
  scenes:saltSoupScenes
} satisfies StoryPack
