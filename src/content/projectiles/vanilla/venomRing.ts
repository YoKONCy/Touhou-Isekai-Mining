/**
 * 官方弹种：毒液环弹（kite_shooter 每 4 秒 16 向圆形扩散，慢弹墙）
 * 数值迁自原 CONFIG.projectile.ringSpeed；半径/伤害/寿命与直线弹一致。
 */
import { vanilla } from '../../core/ids'
import type { ProjectileDef } from '../types'
import { venomBulletLook } from './venomLook'

export const VENOM_RING_ID = vanilla('bullet_venom_ring')

const def: ProjectileDef = {
  id: VENOM_RING_ID,
  speed: 92,
  radius: 7,
  damage: 8,
  render: venomBulletLook({ glow: 'rgba(180, 232, 104, 0.32)', body: '#91bd48', edge: '#426326' }, 'pearl'),
  tags: ['venom', 'ring']
}

export default def
