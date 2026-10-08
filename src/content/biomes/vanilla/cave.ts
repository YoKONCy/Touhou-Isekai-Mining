/**
 * 官方群系：旧矿洞，各层共用数量曲线，分层配置平均预算。
 */
import type { BiomeDef } from '../types'
import { BIOME_CAVE_ID } from './ids'

export const biomeCave: BiomeDef = {
  id: BIOME_CAVE_ID,
  floorStyle: {
    base: '#514b55',
    dark: '#2d2c3a',
    light: '#807887',
    dust: '#a18b73',
    detailDensity: .8
  },
  floorArt: {
    2: { floorStyle: { base: '#454a51', light: '#75848a', dust: '#8e9991' }, sceneStyle: { dampness: .55, deposits: .48, vegetation: .2, fogStrength: .65, wallTint: '#68808a', tintStrength: .13 } },
    3: { sceneStyle: { dampness: .28, vegetation: .55, fungi: .18, boneFragments: 3, wallTint: '#747b70', tintStrength: .09 } }
  },
  enemyBudget: {
    // 安全房零怪
    start: [0, 0],
    reward: [0, 0],
    // 撤离点峰值：9~11 只（旧固定 9，区间化）
    exit: [9, 11],
    normalAverage: 6,
    // 各层从入口附近到深处都用同一套倍率。
    depthMultipliers: [0.625, 0.875, 1.125, 1.375]
  },
  floorEnemyAverages: {1:4,2:6,3:7},
  floorExitBudgets: { 1: [5, 6] },
  oreRange: {
    start: [6, 8],
    normal: [14, 18],
    reward: [26, 30],
    exit: [10, 12]
  },
  tags: ['vanilla', 'underground']
}
