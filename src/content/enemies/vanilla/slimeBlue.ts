/**
 * 官方敌人：蓝史莱姆（chaser 模板——游荡/追脸近战，咬人后后撤）
 * 数值迁自原 CONFIG.enemy；K 批次完成粉红→蓝换色。
 * 强化轮：100 血 + 250 击退抗性（铁剑 215 击退打上去原地硬扛）+
 * 周期性两档变速（每 3~5s 升一次 1.3×、持续 1s，升速带果冻拖尾）。
 */
import { vanilla } from '../../core/ids'
import type { EnemyDef } from '../types'
import { slimeBodyPath } from './slimeShape'
import { drawSlime } from './slimeAppearance'
import { drawSlimeWarning, drawSlimeMotion } from './slimeSignals'

export const SLIME_BLUE_ID = vanilla('slime_blue')

const def: EnemyDef = {
  id: SLIME_BLUE_ID,
  ai: 'chaser',
  hp: 100,
  radius: 15,
  exp: 5,
  combat: {
    physicalResist: 10,
    magicResist: 5,
    contactDamage: 10,
    attackCd: 1.0,
    contactPad: 6,
    knockback: 230,
    knockbackResist: 30,
    recoil: 170,
    stunResist: 0
  },
  palette: {
    body: '#5fa8e8',
    edge: '#2e5a8f',
    death: '#8fc8f5',
    hpBar: '#7fc4ff'
  },
  hitMaterial: 'slime',
  chaser: {
    wanderSpeed: 52,
    chaseSpeed: 134,
    accel: 9,
    sight: 250,
    loseSight: 330,
    // 两档变速：间隔 3~5s 随机，爆发 1s ×1.3 速（游荡/追击同倍率），带拖尾
    surge: {
      minInterval: 3,
      maxInterval: 5,
      duration: 1,
      speedMult: 1.3
    }
  },
  // 蓝史莱姆基础混编权重为一，一层以它作为主力。
  spawn: { maxFloor: 3, weight: 1, rooms: ['normal', 'exit'] },
  visual: { render: drawSlime, warning: drawSlimeWarning, motion: drawSlimeMotion, bodyPath: slimeBodyPath('blue'), fastHop: true, antennae: false },
  tags: ['slime', 'melee']
}

export default def
