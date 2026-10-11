import { readonly, shallowRef } from 'vue'

export type PlayerAppearance = 'brother' | 'sister'
export type PlayerCostume = 'default' | 'old_miner'
let activeCostume:PlayerCostume='default'
export const simulationCostume=():PlayerCostume=>activeCostume
/** 换装只影响当前绘制者，不能把其他本地玩家的衣服一起切换。 */
export function withPlayerCostume<T>(costume:PlayerCostume,work:()=>T):T {
  const previous=activeCostume;activeCostume=costume
  try{return work()}finally{activeCostume=previous}
}
const selectedAppearance = shallowRef<PlayerAppearance>('brother')
let simulationOverride:PlayerAppearance|null=null
export const simulationAppearance=():PlayerAppearance=>simulationOverride??selectedAppearance.value
/** 独立模拟只切换几何参数，不修改玩家界面中的角色选择。 */
export function withSimulationAppearance<T>(appearance:PlayerAppearance,work:()=>T):T{
  const previous=simulationOverride;simulationOverride=appearance
  try{return work()}finally{simulationOverride=previous}
}

/** 当前档案的视觉选择；入场时恢复，控制台切换由存档服务独立落盘。 */
export const playerAppearance = readonly(selectedAppearance)
export function setPlayerAppearance(appearance: PlayerAppearance): void {
  selectedAppearance.value = appearance
}
export function playerPortraitSource(): string {
  return `${import.meta.env.BASE_URL}${playerAppearance.value === 'sister' ? 'characters/sister/portrait.png' : 'hero-base.png'}`
}
