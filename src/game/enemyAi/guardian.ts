import type { EnemyBrain, EnemyAiHost, EnemyAlly } from './types'

interface GuardMemory { stage: 'guard' | 'windup' | 'lunge' | 'return'; originX: number; originY: number; returnT: number; returnDuration: number; ally?: EnemyAlly }
const memories = new WeakMap<EnemyAiHost, GuardMemory>()

/** 站位、扑出和弹回独立于普通追击；伙伴阵亡后重新选择，独处时仍会迎击。 */
export const guardianBrain: EnemyBrain = { id: 'guardian', think(h, dt, map, p, dist) {
  const c = h.def.guardian
  if (!c) return
  let m = memories.get(h)
  if (!m) { m = { stage: 'guard', originX: h.x, originY: h.y, returnT: 0, returnDuration: .5 }; memories.set(h, m) }
  if (!p.alive) { m.stage = 'guard'; h.guardianReboundProgress = -1; h.pounceState = 'none'; h.approachVelocity(0, 0, 12, dt); return }
  if (m.stage === 'return') {
    const dx = m.originX - h.x, dy = m.originY - h.y, d = Math.hypot(dx, dy)
    m.returnT += dt
    h.guardianReboundProgress = Math.min(1, m.returnT / m.returnDuration)
    if ((d < 1 && m.returnT >= m.returnDuration) || m.returnT > m.returnDuration + .4) {
      m.stage = 'guard'; h.guardianReboundProgress = -1; h.vx = h.vy = 0; return
    }
    if (d < .1) { h.vx = h.vy = 0; return }
    const remaining = Math.max(dt, m.returnDuration - m.returnT + dt)
    const v = h.wantVelocity(map, Math.atan2(dy, dx), Math.min(c.returnSpeed, d / remaining))
    h.vx = v.x; h.vy = v.y; return
  }
  if (m.stage === 'lunge') {
    h.pounceT -= dt
    if (h.chargeHit || h.pounceT <= 0 || h.pounceState !== 'lunge') {
      m.stage = 'return'; m.returnT = 0
      m.returnDuration = Math.max(.5, Math.hypot(m.originX - h.x, m.originY - h.y) / c.returnSpeed)
      h.guardianReboundProgress = 0; h.pounceState = 'none'; h.vx = h.vy = 0; return
    }
    h.vx = Math.cos(h.pounceAng) * c.lungeSpeed; h.vy = Math.sin(h.pounceAng) * c.lungeSpeed; return
  }
  h.guardianReboundProgress = -1
  if (p.untargetable) { m.stage = 'guard'; h.pounceState = 'none'; h.approachVelocity(0, 0, 14, dt); return }
  if (!h.alerted && h.ai !== 'kite' && dist > c.sight) { h.approachVelocity(0, 0, 12, dt); return }
  h.ai = 'kite'
  if (m.stage === 'windup') {
    if (h.pounceState !== 'windup' || !h.canUseSkills) { m.stage = 'guard'; h.pounceState = 'none'; return }
    h.pounceAng = Math.atan2(p.y - h.y, p.x - h.x); h.pounceT -= dt; h.vx = h.vy = 0
    if (h.pounceT <= 0) { m.stage = 'lunge'; h.pounceState = 'lunge'; h.pounceT = c.lungeDuration; h.chargeHit = false; h.guardianDashCd = c.interval }
    return
  }
  if (!m.ally?.alive || m.ally.def.guardian || Math.hypot(m.ally.x - h.x, m.ally.y - h.y) > 320) {
    m.ally = undefined
    let best = Infinity
    for (const ally of h.allies) {
      if (!ally.alive || ally.def.guardian) continue
      const d = Math.hypot(ally.x - h.x, ally.y - h.y)
      if (d < best) { m.ally = ally; best = d }
    }
  }
  const a = m.ally, angle = Math.atan2(p.y - (a?.y ?? h.y), p.x - (a?.x ?? h.x))
  const gap = a ? Math.min(c.guardDistance, Math.hypot(p.x - a.x, p.y - a.y) * .55) : 0
  const tx = a ? a.x + Math.cos(angle) * gap : p.x, ty = a ? a.y + Math.sin(angle) * gap : p.y
  const targetDistance = Math.hypot(tx - h.x, ty - h.y)
  const v = targetDistance > 8 ? h.wantVelocity(map, Math.atan2(ty - h.y, tx - h.x), Math.min(c.speed, targetDistance * 4)) : { x: 0, y: 0 }
  h.approachVelocity(v.x, v.y, 10, dt)
  if (dist < 145 && h.guardianDashCd <= 0 && h.canUseSkills) {
    m.stage = 'windup'; m.originX = h.x; m.originY = h.y
    h.pounceState = 'windup'; h.pounceT = c.windup; h.pounceAng = Math.atan2(p.y - h.y, p.x - h.x); h.vx = h.vy = 0
  }
} }
