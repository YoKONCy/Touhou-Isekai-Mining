import { randomCombat } from '../../core/simulation/random'
import type { EnemyBrain, EnemyAiHost } from './types'

interface FurryMemory { left: number; gap: number; timer: number; mode: 'wave' | 'seed'; ready: boolean }

/** 毛玉边飞边拉开距离，六发逐发跟踪并叠加波浪偏移，不使用史莱姆的环弹节拍。 */
export const kedamaShooterBrain: EnemyBrain = { id: 'kedama_shooter', think(h, dt, map, p, dist) {
  const c = h.def.kedama
  if (!c) return
  let m = h.aiMemory.kedama as FurryMemory | undefined
  if (!m) { m = { left: 0, gap: 0, timer: .7 + randomCombat(), mode: 'wave', ready: false }; h.aiMemory.kedama = m }
  if (!p.alive || p.untargetable) { m.left = 0; m.ready = false; h.windup = 'none'; h.approachVelocity(0, 0, 10, dt); return }
  if (!h.alerted && h.ai !== 'kite' && dist > c.sight) { h.approachVelocity(0, 0, 10, dt); return }
  h.ai = 'kite'
  const a = Math.atan2(p.y - h.y, p.x - h.x)
  h.pounceAng = a
  h.strafeTimer -= dt
  if (h.strafeTimer <= 0) { h.strafeDir *= -1; h.avoidBias = h.strafeDir; h.strafeTimer = 1.8 + randomCombat() }
  const away = a + Math.PI, tang = a + h.strafeDir * Math.PI / 2
  const movementAngle = dist < c.retreatRange ? Math.atan2(Math.sin(away) * .85 + Math.sin(tang) * .3, Math.cos(away) * .85 + Math.cos(tang) * .3) : tang
  const v = h.wantVelocity(map, movementAngle, dist < c.retreatRange ? c.speed : c.speed * .35)
  h.approachVelocity(v.x, v.y, 8, dt)
  if (!h.canUseSkills) { m.left = 0; m.ready = false; m.timer = c.interval; h.windup = 'none'; return }
  if (m.ready) {
    if (h.windup === 'none') { m.ready = false; m.timer = c.interval; return }
    h.windupT -= dt
    if (h.windupT > 0) return
    h.windup = 'none'; m.ready = false
    if (m.mode === 'seed') { h.pendingShots.push({ kind: 'straight', projectileId: c.seedProjectileId }); m.timer = c.interval; return }
    m.left = 6; m.gap = 0
  }
  if (m.left > 0) {
    m.gap -= dt
    while (m.left > 0 && m.gap <= 0) {
      const index = 6 - m.left, offset = Math.sin(index * 1.25 - .7) * .2 + (randomCombat() - .5) * .12
      h.pendingShots.push({ kind: 'straight', projectileId: c.waveProjectileId, angle: a + offset })
      m.left--; m.gap += c.waveGap
    }
    if (m.left === 0) m.timer = c.interval
    return
  }
  m.timer -= dt
  if (m.timer <= 0) { m.mode = randomCombat() < .5 ? 'wave' : 'seed'; m.ready = true; h.windup = m.mode === 'wave' ? 'straight' : 'ring'; h.windupT = m.mode === 'wave' ? .32 : .6 }
} }
