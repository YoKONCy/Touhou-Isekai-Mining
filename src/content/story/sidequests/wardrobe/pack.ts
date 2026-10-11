import type { StoryPack } from '../../types'
import { sequence } from '../../sequence'
import { items } from '../../../items/registry'
import zhCn from './lang/zh_cn.json'
import { WARDROBE_BUILT } from './state'

const INTRO='touhou:first_outfit_wardrobe'
/** 判断永久带回的时装，不把皮甲等功能装备或未撤离的奖励当成首次换装。 */
export default {
  id:'touhou:wardrobe',languages:{zh_cn:zhCn},
  trees:[sequence(INTRO,'story.wardrobe',['hero','reimu','hero','reimu','narration'])],
  scenes:[{
    id:INTRO,event:'camp.wardrobe',
    when:({profile})=>!profile.flagBool(WARDROBE_BUILT)&&items.all().some(item=>item.unlockReward?.kind==='outfit'&&profile.flagBool(item.unlockReward.flag)),
    completeFlags:[WARDROBE_BUILT],notification:'story.wardrobe.completed'
  }]
} satisfies StoryPack
