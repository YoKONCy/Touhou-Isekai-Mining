import type { BiomeDef } from '../types'
import { biomeCave } from './cave'
import { BIOME_DEEP_HOLLOW_ID } from './ids'

/** 第四层初始预算独立配置，距离曲线继续复用；正式战斗数值后续调整。 */
export const biomeDeepHollow: BiomeDef = {
  id: BIOME_DEEP_HOLLOW_ID,
  floorStyle: { base: '#424b50', dark: '#242c36', light: '#808c94', dust: '#929b96', detailDensity: .85 },
  sceneStyle: { wallTint: '#66888c', tintStrength: .19, dampness: .5, vegetation: .36, deposits: .65, fungi: .46, boneFragments: 3, fogStrength: .7, deepHollow: true },
  enemyBudget: { ...biomeCave.enemyBudget, normalAverage: 5, exit: [6, 8] },
  floorEnemyAverages: { 4: 5 },
  oreRange: { start: [5, 7], normal: [10, 14], reward: [18, 22], exit: [4, 6] },
  tags: ['vanilla', 'underground', 'deep_hollow']
}
