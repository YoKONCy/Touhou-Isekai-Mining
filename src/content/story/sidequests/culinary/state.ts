import type { CharacterProfile } from '../../../../shared/profile'
import { MISO_ID, KEDAMA_TOFU_ID, MISO_TOFU_SOUP_ID } from '../../../items/vanilla/ids'

export const GRILL_INTRO='touhou:grill_intro', GRILL_DONE='touhou:grill_done', MISO_INTRO='touhou:miso_intro', MISO_DONE='touhou:miso_done'
export const grillAvailable=(c:CharacterProfile)=>c.flagBool('base.furnace.ready')&&c.flagBool('story.ironWork.firstSmelt')&&!c.flagBool('quest.grill.accepted')
export const misoCrafted=(c:CharacterProfile)=>c.flagBool('quest.miso.accepted')&&(c.discovery.cooked.get(MISO_TOFU_SOUP_ID)??0)>Number(c.flag('quest.miso.startCount')??0)
/** 达成条件时记下本趟编号；必须再经历一趟矿洞，成功和失败都能开放锅旁剧情。 */
export function refreshCulinaryProgress(c:CharacterProfile,returned=false):void {
  if(c.discovery.dishCount>=3&&c.discovery.items.has(MISO_ID)&&c.discovery.items.has(KEDAMA_TOFU_ID)&&c.flag('quest.miso.armedRound')===undefined)c.setFlag('quest.miso.armedRound',c.round)
  const armed=c.flag('quest.miso.armedRound')
  if(returned&&typeof armed==='number'&&c.round>armed&&!c.flagBool('quest.miso.accepted'))c.setFlag('quest.miso.available',true)
}
