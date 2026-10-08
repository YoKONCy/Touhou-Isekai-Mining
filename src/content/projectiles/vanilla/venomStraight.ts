/**
 * 官方弹种：毒液直线弹（kite_shooter 每秒 1 发、瞄准玩家）
 * 数值迁自原 CONFIG.projectile.straightSpeed 等。
 */
import { vanilla } from '../../core/ids'
import type { ProjectileDef } from '../types'
import { venomBulletLook } from './venomLook'

export const VENOM_STRAIGHT_ID = vanilla('bullet_venom_straight')

const def: ProjectileDef = {
  id: VENOM_STRAIGHT_ID,
  speed: 200,
  radius: 7,
  damage: 8,
  render: venomBulletLook({ glow: 'rgba(180, 232, 104, 0.32)', body: '#76b83c', edge: '#315b23' }, 'drop'),
  tags: ['venom', 'straight']
}

export default def
