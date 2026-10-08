/**
 * 官方敌人：毒液绿史莱姆（kite_shooter 模板——保持距离放风筝）
 * 每秒 1 发瞄准直线毒液弹，每 4 秒 1 次 16 向环弹（K 批次 5s→4s）。
 * 数值迁自原 CONFIG.venom。
 */
import { vanilla } from '../../core/ids'
import { VENOM_STRAIGHT_ID, VENOM_RING_ID } from '../../projectiles/vanilla/ids'
import type { EnemyDef } from '../types'
import { slimeBodyPath } from './slimeShape'
import { drawSlime } from './slimeAppearance'
import { drawSlimeWarning, drawSlimeMotion } from './slimeSignals'

export const VENOM_GREEN_ID = vanilla('venom_green')

const def: EnemyDef = {
  id: VENOM_GREEN_ID,
  ai: 'kite_shooter',
  hp: 50,
  radius: 14,
  exp: 5,
  combat: {
    physicalResist: 12,
    magicResist: 5,
    contactDamage: 10,
    attackCd: 1.0,
    contactPad: 6,
    knockback: 230,
    recoil: 150,
    stunResist: 0
  },
  palette: {
    body: '#74c24a',
    edge: '#376b22',
    death: '#8de05f',
    hpBar: '#9be05f'
  },
  hitMaterial: 'venom',
  kite: {
    wanderSpeed: 48,
    kiteSpeed: 120,
    accel: 8,
    sight: 300,
    loseSight: 380,
    kiteMin: 170,
    kiteMax: 270,
    straightInterval: 1.0,
    ringInterval: 4.0,
    ringCount: 16,
    straightWindup: 0.32,
    ringWindup: 0.6,
    firstFireJitter: 1.2,
    straightProjectileId: VENOM_STRAIGHT_ID,
    ringProjectileId: VENOM_RING_ID
  },
  // 一层降低远程怪占比，其他楼层沿用基础混编权重。
  spawn: { maxFloor: 3, weight: 1, floorWeights: {1: 0.5}, rooms: ['normal', 'exit'] },
  visual: { render: drawSlime, warning: drawSlimeWarning, motion: drawSlimeMotion, bodyPath: slimeBodyPath('venom'), fastHop: false, antennae: true },
  tags: ['slime', 'ranged', 'venom']
}

export default def
