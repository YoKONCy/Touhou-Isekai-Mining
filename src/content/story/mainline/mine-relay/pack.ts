import type { StoryPack } from '../../types'
import zhCn from './lang/zh_cn.json'
import { mineRelayTrees } from './dialogues'
import { mineRelayScenes } from './scenes'
import { mineRelayQuest } from './quest'

export default { id: 'touhou:mine-relay', languages: { zh_cn: zhCn }, trees: mineRelayTrees,
  scenes: mineRelayScenes, quests: [mineRelayQuest] } satisfies StoryPack
