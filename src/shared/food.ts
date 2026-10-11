import type { SavedStatus } from './statusEffects'

/** 食物的默认饱腹时长；实际限制由通用状态系统维护。 */
export const FOOD_COOLDOWN_SECONDS = 40
export const SATIETY_ID = 'touhou:satiety'
/** remaining 仅为状态剩余时间的界面投影，不单独倒计时。 */
export interface FoodState { remaining:number; duration:number; effects:SavedStatus[] }
