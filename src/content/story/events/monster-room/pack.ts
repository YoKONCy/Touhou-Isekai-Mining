import type { StoryPack } from '../../types'
import zhCn from './lang/zh_cn.json'
import { monsterRoomTrees } from './dialogues'
import { monsterRoomScenes } from './scenes'

export default {
  id:'touhou:monster_room',languages:{zh_cn:zhCn},trees:[...monsterRoomTrees],
  scenes:monsterRoomScenes
} satisfies StoryPack
