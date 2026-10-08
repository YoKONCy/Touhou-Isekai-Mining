import type { StoryPack } from '../../types'
import zhCn from './lang/zh_cn.json'
import { reimuCookingTree, reimuConversation } from './dialogues'

export default {
  id:'touhou:reimu',languages:{zh_cn:zhCn},trees:[reimuCookingTree],
  npcs:[reimuConversation]
} satisfies StoryPack
