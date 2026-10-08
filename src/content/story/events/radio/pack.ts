import type { StoryPack } from '../../types'
import zhCn from './lang/zh_cn.json'
import { radioFindTree, RADIO_FIND_TREE } from './dialogues'

export default {
  id:'touhou:radio',languages:{zh_cn:zhCn},trees:[radioFindTree],
  scenes:[{id:RADIO_FIND_TREE,event:'camp.extracted',when:({profile})=>!profile.flagBool('base.radio.unlocked')}]
} satisfies StoryPack
