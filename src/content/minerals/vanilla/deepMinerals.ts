import type { MineralDef } from '../types'
import { COAL_ID, ROCK_SALT_ID } from '../../items/vanilla/ids'
import { MINERAL_COAL_ID, MINERAL_SALT_ROCK_ID } from './ids'

export const coal: MineralDef = {
  id: MINERAL_COAL_ID, dropItemId: COAL_ID, hp: [80, 100], requiredMiningPower: 1,
  palette: { base: '#353b40', baseDark: '#161c23', crystal: '#262d33', crystalDark: '#131a21', hi: '#89949b', light: '#8d9198' },
  text: '#b1abb4', spawn: { weight: .3, minFloor: 2 }, visual: { glowPower: 0, form: 'coal' }, tags: ['fuel']
}
/** 盐石不参加矿脉权重池，由普通岩石生成时按独立概率替换。 */
export const saltRock: MineralDef = {
  id: MINERAL_SALT_ROCK_ID, dropItemId: ROCK_SALT_ID, hp: [80, 100], requiredMiningPower: 1,
  palette: { base: '#8c9097', baseDark: '#50515d', crystal: '#d3d0bf', crystalDark: '#989e9a', hi: '#f0e8d4', light: '#c5c8b7' },
  text: '#dfdbc8', spawn: { weight: 0, minFloor: 2, rockReplacementChance: .10 }, visual: { glowPower: 0, form: 'salt' }, tags: ['salt']
}
