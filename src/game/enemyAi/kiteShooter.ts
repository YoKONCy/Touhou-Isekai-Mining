/**
 * kite_shooter 模板：保持距离 + 两种弹幕节拍
 * 走位全部经过 wantVelocity 的前瞻避障：
 * 后撤走弧线（径向+切向混合）防直线扎墙角，贴墙自动沿墙滑。
 * 开火到点不立即吐，进入可被僵直打断的前摇（环弹优先）。
 * （迁自原 Enemy.updateVenom，数值读 Def.kite，逻辑零改动）
 */
import type { EnemyBrain, EnemyAiHost, PlayerLike } from './types'
import type { TileMap } from '../tilemap'

export const kiteShooterBrain: EnemyBrain = {
  id: 'kite_shooter',
  think(host: EnemyAiHost, dt: number, map: TileMap, player: PlayerLike, distP: number): void {
    if (player.untargetable) {
      host.pendingShots.length = 0
      host.windup = 'none'
      host.approachVelocity(0, 0, 9, dt); return
    }
    const c = host.def.kite
    if (!c) return
    // —— 感知：进入视野即永久锁定玩家（拉开不脱战，仅玩家死亡才解除；
    //    alerted 剧情警戒怪无视距离出生即索敌；loseSight 字段保留供后续
    //    嘲讽/脱战机制复用） ——
    if (player.alive && (host.alerted || distP < c.sight)) {
      if (host.ai !== 'kite') host.ai = 'kite'
    } else if (!player.alive && host.ai === 'kite') {
      host.ai = 'idle'
      host.aiTimer = 0.5 + Math.random() * 0.6
    }

    let targetVx = 0
    let targetVy = 0
    if (host.ai === 'kite' && player.alive) {
      if (host.windup !== 'none') {
        // —— 吐弹前摇：站定蓄力给玩家读招/冲脸打断的窗口 ——
        host.windupT -= dt
        if (host.windupT <= 0) {
          const kind = host.windup === 'ring' ? 'ring' : 'straight'
          host.pendingShots.push({
            kind,
            projectileId: kind === 'ring' ? c.ringProjectileId : c.straightProjectileId
          })
          if (kind === 'ring') host.ringCd = c.ringInterval
          else host.straightCd = c.straightInterval
          host.windup = 'none'
        }
      } else {
        // 横移/侧弯方向三种距离段共用一个节拍：后撤弧线也周期换向，
        // 不会一路弯去同侧墙根，玩家预判直线弹也更难
        host.strafeTimer -= dt
        if (host.strafeTimer <= 0) {
          host.strafeDir *= -1
          // 绕障偏转偏好跟随横移方向，绕墙与绕人走位一致
          host.avoidBias = host.strafeDir
          host.strafeTimer = 1.4 + Math.random() * 1.2
        }

        const ang = Math.atan2(player.y - host.y, player.x - host.x)
        let wantAng = ang
        let speed = c.kiteSpeed
        if (distP < c.kiteMin) {
          // 太近：以后撤为主，但混入切向分量走弧线
          // （纯径向倒退只会一条直线扎进墙角/矿堆，弧线天然绕过障碍）
          const back = ang + Math.PI
          const tang = ang + (Math.PI / 2) * host.strafeDir
          wantAng = Math.atan2(
            Math.sin(back) * 0.7 + Math.sin(tang) * 0.5,
            Math.cos(back) * 0.7 + Math.cos(tang) * 0.5
          )
        } else if (distP > c.kiteMax) {
          // 太远：逼近
          wantAng = ang
        } else {
          // 甜区：绕玩家横移
          wantAng = ang + (Math.PI / 2) * host.strafeDir
          speed = c.kiteSpeed * 0.8
        }
        // 僵直中走位照常（风筝步伐不停），这正是"僵直只封出招不封移动"
        ;({ x: targetVx, y: targetVy } = host.wantVelocity(map, wantAng, speed))

        // —— 开火节拍：到点不立即吐，进入可被打断的前摇（环弹优先）。
        //    僵直中节拍冻结、不能起新前摇（stun 结束后从剩余 CD 继续等） ——
        if (host.canUseSkills) {
          host.ringCd -= dt
          host.straightCd -= dt
          if (host.ringCd <= 0) {
            host.windup = 'ring'
            host.windupT = c.ringWindup
          } else if (host.straightCd <= 0) {
            host.windup = 'straight'
            host.windupT = c.straightWindup
          }
        }
      }
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
        ;({ x: targetVx, y: targetVy } = host.wantVelocity(map, a, c.wanderSpeed))
        if (host.aiTimer <= 0) {
          host.ai = 'idle'
          host.aiTimer = 0.5 + Math.random() * 0.8
        }
      }
    }
    // 仅吐弹前摇站定蓄力；僵直不再清零速度（移动自由，出招被封）
    if (host.windup !== 'none') {
      targetVx = 0
      targetVy = 0
    }
    host.approachVelocity(targetVx, targetVy, c.accel, dt)
  }
}
