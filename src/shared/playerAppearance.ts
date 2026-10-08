import { readonly, shallowRef } from 'vue'

export type PlayerAppearance = 'brother' | 'sister'
const selectedAppearance = shallowRef<PlayerAppearance>('brother')

/** 当前档案的视觉选择；入场时恢复，控制台切换由存档服务独立落盘。 */
export const playerAppearance = readonly(selectedAppearance)
export function setPlayerAppearance(appearance: PlayerAppearance): void {
  selectedAppearance.value = appearance
}
export function playerPortraitSource(): string {
  return `${import.meta.env.BASE_URL}${playerAppearance.value === 'sister' ? 'characters/sister/portrait.png' : 'hero-base.png'}`
}
