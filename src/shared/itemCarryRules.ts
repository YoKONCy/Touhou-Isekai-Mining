import { findItemDef, type ItemId } from './itemDefs'

const kept=Object.freeze({loseOnDeath:false,autoStore:false})
const material=Object.freeze({loseOnDeath:true,autoStore:true})

/** 素材与兼具素材身份的道具共用规则；杂项始终保留在身上。 */
export function itemCarryRules(id:ItemId):Readonly<{loseOnDeath:boolean;autoStore:boolean}>{
  const def=findItemDef(id)
  if(def?.kind==='misc'||def?.kind==='ammunition')return kept
  return def?.kind==='material'||def?.material?material:kept
}
