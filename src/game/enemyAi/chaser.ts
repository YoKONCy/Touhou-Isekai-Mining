/**
 * chaser 模板：追脸近战怪
 * idle/wander 随机游荡 → 视野内 chase 扑脸 → 拉开到丢失距离才放弃（迟滞防抖）。
 * 走位全部走宿主 wantVelocity 的前瞻避障；僵直只封出招，移动照常。
 * （迁自原 Enemy.updateSlime，数值读 Def.chaser，逻辑零改动）
 */
import type { EnemyBrain, EnemyAiHost, PlayerLike } from './types'
import type { TileMap } from '../tilemap'

export const chaserBrain: EnemyBrain = {
  id: 'chaser',
  think(host: EnemyAiHost, dt: number, map: TileMap, player: PlayerLike, distP: number): void {
    if (player.untargetable) {
      host.pendingShots.length = 0
      
      host.approachVelocity(0, 0, 9, dt); return
    }
    const c = host.def.chaser
    if (!c) return
    // —— 感知：进入视野即永久锁定玩家 ——
    // 一旦发现目标，拉开多远都不会丢失、不再回游荡（房间切换会重建实体）；
    // alerted（剧情警戒怪）无视距离出生即索敌；仅玩家死亡才解除仇恨
    // （loseSight 字段保留供后续做"嘲讽/脱战机制"时复用）。
    if (player.alive && (host.alerted || distP < c.sight)) {
      if (host.ai !== 'chase') host.ai = 'chase'
    } else if (!player.alive && host.ai === 'chase') {
      host.ai = 'idle'
      host.aiTimer = 0.5 + Math.random() * 0.6
    }

    // —— 周期升速节拍（Def.chaser.surge 可选；缺省恒速） ——
    // 加速档中两档速度同乘 speedMult；结束后重新摇一个 3~5s 间隔。
    let speedMult = 1
    const su = c.surge
    if (su) {
      if (host.surgeT > 0) {
        host.surgeT -= dt
        speedMult = su.speedMult
        if (host.surgeT <= 0) {
          host.surgeCd = su.minInterval + Math.random() * (su.maxInterval - su.minInterval)
        }
      } else {
        host.surgeCd -= dt
        if (host.surgeCd <= 0 && host.canUseSkills) host.surgeT = su.duration
      }
    }

    let targetVx = 0
    let targetVy = 0
    if (host.ai === 'chase' && player.alive) {
      const a = Math.atan2(player.y - host.y, player.x - host.x)
      ;({ x: targetVx, y: targetVy } = host.wantVelocity(map, a, c.chaseSpeed * speedMult))
    } else {
      host.aiTimer -= dt
      if (host.ai === 'idle' && host.aiTimer <= 0) {
        const a = Math.random() * Math.PI * 2
        host.wanderX = Math.cos(a)
        host.wanderY = Math.sin(a)
        host.ai = 'wander'
        host.aiTimer = 1 + Math.random() * 1.4
      } else if (host.ai === 'wander') {
        const a = Math.atan2(host.wanderY, host.wanderX)
        ;({ x: targetVx, y: targetVy } = host.wantVelocity(map, a, c.wanderSpeed * speedMult))
        if (host.aiTimer <= 0) {
          host.ai = 'idle'
          host.aiTimer = 0.5 + Math.random() * 0.8
        }
      }
    }
    host.approachVelocity(targetVx, targetVy, c.accel, dt)
  }
}
