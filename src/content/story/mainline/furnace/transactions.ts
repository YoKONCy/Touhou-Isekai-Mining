import type { CharacterProfile } from '../../../../shared/profile'
import { furnaceStage, materialCount, spendMaterials } from '../../../../shared/production'
import { HEAT_NOZZLE_ID, OLD_FURNACE_PARTS_ID } from '../../../items/vanilla/ids'

/** 找到旧炉零件后停止搜取；交付完成与熔炉修好都永久关闭炉骸交互。 */
export function canSearchFurnace(profile:CharacterProfile):boolean{
  return furnaceStage(profile)===2&&profile.flagBool('story.furnaceKey.seen')&&!profile.flagBool('quest.furnaceParts.done')
    &&materialCount(profile,OLD_FURNACE_PARTS_ID)===0&&materialCount(profile,HEAT_NOZZLE_ID)===0
}
/** 先在副本检查空间，确认能收风嘴再换走整包旧零件。 */
export function deliverFurnaceParts(profile:CharacterProfile):boolean{
  if(furnaceStage(profile)!==2||profile.flagBool('quest.furnaceParts.done')||materialCount(profile,OLD_FURNACE_PARTS_ID)<1)return false
  const existing=materialCount(profile,HEAT_NOZZLE_ID)>0
  // 零件默认占一格背包，取走后可原格换成风嘴。
  if(!existing&&!profile.inventory.canAdd(HEAT_NOZZLE_ID)&&!profile.inventory.slots.some(s=>s?.id===OLD_FURNACE_PARTS_ID&&s.qty===1))return false
  if(!spendMaterials(profile,[[OLD_FURNACE_PARTS_ID,1]]))return false
  if(!existing)profile.inventory.add(HEAT_NOZZLE_ID,1)
  profile.setFlag('quest.furnaceParts.done',true)
  return true
}

