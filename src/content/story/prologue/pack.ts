import type { StoryPack } from '../types'
import zhCn from './lang/zh_cn.json'
import { prologueTree } from './dialogues'

export default {
  id:'touhou:prologue',languages:{zh_cn:zhCn},trees:[prologueTree]
} satisfies StoryPack
