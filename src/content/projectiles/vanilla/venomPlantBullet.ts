import type { ProjectileDef } from '../types'
import venomStraight from './venomStraight'
import { PARALYSIS_TOXIN } from '../../statuses/paralysis'

export const VENOM_PLANT_BULLET_ID='touhou:bullet_venom_plant'
/** 复用毒液直线弹外观，速度略快，实际命中才施加麻痹毒素。 */
const def:ProjectileDef={...venomStraight,id:VENOM_PLANT_BULLET_ID,speed:venomStraight.speed*1.1,damage:8,onHitStatus:PARALYSIS_TOXIN}
export default def
