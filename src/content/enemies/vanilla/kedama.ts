import type { EnemyDef } from '../types'
import { MISO_ID, KEDAMA_TOFU_ID } from '../../items/vanilla/ids'
import { FURRY_WAVE_ID, FURRY_SEED_ID } from '../../projectiles/vanilla/furryBullets'
import { drawKedama } from './fourthFloorAppearance'
import venomGreen from './venomGreen'

export const KEDAMA_ID = 'touhou:kedama'
/** 数值为第四层首版调校；移动严格按绿史莱姆拉扯速度的零点八倍。 */
const def: EnemyDef = {
  id: KEDAMA_ID, ai: 'kedama_shooter', movement: 'flying', hp: 70, radius: 17, exp: 8,
  combat: { contactDamage: 8, attackCd: 1, contactPad: 3, knockback: 180, recoil: 110, stunResist: .1 },
  palette: { body: '#f0eee7', edge: '#534858', death: '#f4efe3', hpBar: '#cfbe9d' }, hitMaterial: 'bat',
  kedama: { speed: venomGreen.kite!.kiteSpeed * .8, sight: 480, retreatRange: 200, interval: 1.6, waveGap: .1, waveProjectileId: FURRY_WAVE_ID, seedProjectileId: FURRY_SEED_ID },
  // TODO：第五层专属生态尚待设计，现阶段沿用深窟底板及怪池。
  spawn: { weight: 1, minFloor: 4, maxFloor: 5, rooms: ['normal', 'exit'] },
  drops: [{ item: MISO_ID, chance: .08, qty: 1 }, { item: KEDAMA_TOFU_ID, chance: .06, qty: 1 }],
  visual: { render: drawKedama, fastHop: false, antennae: false }, tags: ['kedama', 'flying', 'ranged']
}
export default def
