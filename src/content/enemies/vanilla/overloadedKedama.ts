import type { EnemyDef } from '../types'

/** 主线末间专属，不能混入普通房或挖矿爆怪。 */
export const OVERLOADED_KEDAMA_ID = 'touhou:overloaded_kedama'
export default {
  id: OVERLOADED_KEDAMA_ID, ai: 'chaser', hp: 1600, radius: 24, hurtbox: { offsetY: -22, radius: 42 }, exp: 0, movement: 'flying',
  combat: { physicalResist: 20, magicResist: 10, contactDamage: 8, attackCd: .9, contactPad: 0, knockback: 0, recoil: 0, knockbackResist: 300, stunResist: .6 },
  palette: { body: '#ddd0e8', edge: '#55425f', death: '#e7e1ee', hpBar: '#bd92c8' },
  hitMaterial: 'bat', visual: { fastHop: false, antennae: false }, tags: ['boss', 'kedama', 'story_restore']
} satisfies EnemyDef
