import type { CharacterProfile } from './profile'
import { findItemDef } from './itemDefs'
import { items } from '../content/items/registry'
import type { SearchEffectContext } from '../content/search/types'

/** 已解锁或本趟已拿取的独占奖励从候选池移除，不用空格替代。 */
export function searchRewardEffects(profile:CharacterProfile):SearchEffectContext {
  const weights:Record<string,number>={}
  for(const item of items.all())if(item.unlockReward&&(profile.flagBool(item.unlockReward.flag)||profile.pendingSearchUnlocks.has(item.id)))weights[item.id]=0
  return {modifiers:[{id:'touhou:unique_search_rewards',itemWeights:weights}]}
}
/** 返回未定义表示普通物品；独占奖励不占背包，同趟重复奖励直接忽略。 */
export function collectSearchReward(profile:CharacterProfile,id:string):boolean|undefined {
  const reward=findItemDef(id)?.unlockReward
  if(!reward)return undefined
  if(profile.flagBool(reward.flag)||profile.pendingSearchUnlocks.has(id))return false
  profile.pendingSearchUnlocks.add(id)
  return true
}
/** 只有成功撤离才永久获得；失败、放弃和安全回营清除本趟待带回记录。 */
export function settleSearchRewards(profile:CharacterProfile,success:boolean):void {
  if(success)for(const id of profile.pendingSearchUnlocks){
    const reward=findItemDef(id)?.unlockReward
    if(reward){profile.setFlag(reward.flag,true);profile.discovery.unlock(id)}
  }
  profile.pendingSearchUnlocks.clear()
}
