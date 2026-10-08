/**
 * 官方敌人：红史莱姆（pouncer 模板——来拒去留绕圈拉扯 + 周期预判猛扑）
 *
 * 打法：平时以略快于蓝史莱姆的步伐与玩家保持环形距离（近了撤、远了追、
 * 甜区绕圈），身体接触造成 10 点伤害；每 2 秒原地蓄力 0.5 秒（红圈+箭头读招、
 * 可被僵直打断），随后朝玩家"现位+速度外推"的预判点短距猛扑，
 * 猛扑命中同样造成 10 点伤害，两者不叠加。头顶一对尖角是辨识标志，蓄力时角尖聚气发红。
 */
import { vanilla } from '../../core/ids'
import type { EnemyDef } from '../types'
import { slimeBodyPath } from './slimeShape'
import { drawSlime } from './slimeAppearance'
import { drawSlimeWarning, drawSlimeMotion } from './slimeSignals'

export const SLIME_RED_ID = vanilla('slime_red')

const def: EnemyDef = {
  id: SLIME_RED_ID,
  ai: 'pouncer',
  hp: 80,
  radius: 14,
  exp: 5,
  combat: {
    physicalResist: 8,
    magicResist: 5,
    contactDamage: 10,
    // 攻击节拍与 pouncer.attackInterval 对齐：扑中/扑空都是 2 秒一轮
    attackCd: 2.0,
    contactPad: 6,
    knockback: 230,
    // 咬中后自身后撤幅度更大，扑完即刻拉开距离重新绕圈
    recoil: 200,
    stunResist: 0
  },
  palette: {
    body: '#e05a6e',
    edge: '#8f2e3f',
    death: '#f593a4',
    hpBar: '#ff7f96'
  },
  hitMaterial: 'slime',
  pouncer: {
    bodyContactDamage: 10,
    wanderSpeed: 58,
    // 蓝史莱姆 chaseSpeed=134；红的走位 146，敏捷一线
    kiteSpeed: 146,
    accel: 10,
    sight: 270,
    loseSight: 350,
    // 拉扯甜区：<112 后撤 / >188 逼近 / 区间绕圈
    orbitMin: 112,
    orbitMax: 188,
    attackInterval: 2.0,
    pounceWindup: 0.5,
    // 390px/s × 0.28s ≈ 109px 短距猛扑
    pounceSpeed: 390,
    pounceDur: 0.28,
    // 瞄准玩家 0.15 秒后的位置（适度预判，末刻变向可晃开）
    lead: 0.55
  },
  // 一层减少猛扑怪，其他楼层沿用基础混编权重。
  spawn: { maxFloor: 3, weight: 1, floorWeights: {1: 0.4}, rooms: ['normal', 'exit'] },
  visual: { render: drawSlime, warning: drawSlimeWarning, motion: drawSlimeMotion, bodyPath: slimeBodyPath('red'), fastHop: true, antennae: false, horns: true },
  tags: ['slime', 'melee', 'pouncer']
}

export default def
