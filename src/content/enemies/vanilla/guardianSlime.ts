import type { EnemyDef } from '../types'
import { SMALL_CRYSTAL_CORE_ID } from '../../items/vanilla/ids'
import { drawGuardian, drawGuardianWarning } from './fourthFloorAppearance'

export const GUARDIAN_SLIME_ID = 'touhou:slime_guardian'
/** 护卫不替伙伴分摊伤害，实体站位本身构成近战阻挡。 */
const def: EnemyDef = {
  id: GUARDIAN_SLIME_ID, ai: 'guardian', hp: 120, radius: 22, exp: 10,
  combat: { physicalResist: 18, magicResist: 8, contactDamage: 14, attackCd: 1, contactPad: 3, knockback: 210, recoil: 0, knockbackResist: 300, stunResist: 2 },
  palette: { body: '#89b7ae', edge: '#344a53', death: '#a8c4b6', hpBar: '#b6cfb2' }, hitMaterial: 'slime',
  guardian: { speed: 115, sight: 480, guardDistance: 64, interval: 2.3, windup: .45, lungeSpeed: 640, lungeDuration: .14, returnSpeed: 140, bodyContactDamage: 5 },
  // TODO：第五层专属生态尚待设计，现阶段沿用深窟底板及怪池。
  spawn: { weight: 1, minFloor: 4, maxFloor: 5, rooms: ['normal', 'exit'] },
  drops: [{ item: SMALL_CRYSTAL_CORE_ID, chance: .2, qty: 1 }],
  visual: { render: drawGuardian, warning: drawGuardianWarning, fastHop: false, antennae: false }, tags: ['slime', 'guardian', 'melee']
}
export default def
