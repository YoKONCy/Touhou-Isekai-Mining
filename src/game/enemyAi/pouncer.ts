/**
 * pouncer 模板：来拒去留 + 绕圈圈拉扯，周期性"预判猛扑"。
 *
 * 走位三段（与 kite_shooter 同一套避障导航）：
 * - 玩家太近：弧线后撤（径向 + 切向混合，防直线扎墙角）；
 * - 玩家太远：正面逼近；
 * - 甜区：绕玩家环形横移，周期换向。
 *
 * 猛扑节拍（读宿主 contactCd，与猛扑命中结算共用时钟，普通身体接触独立计时）：
 * CD 到点 → windup 原地蓄力 pounceWindup 秒（站定、可被僵直打断）
 * → 朝玩家"现位 + 速度外推"的预判点锁定角度 → lunge 高速短距猛扑，
 * lunge 期间武装猛扑伤害；其他阶段的身体接触由内容配置决定。扑中立即收扑（实体 recoil 后撤），
 * 扑空在时长耗尽后也重新等满 CD。
 */
import type { EnemyBrain, EnemyAiHost, PlayerLike } from './types'
import type { TileMap } from '../tilemap'

export const pouncerBrain: EnemyBrain = {
  id: 'pouncer',
  think(host: EnemyAiHost, dt: number, map: TileMap, player: PlayerLike, distP: number): void {
    if (player.untargetable && host.pounceState !== 'lunge') {
      host.pendingShots.length = 0; host.approachVelocity(0, 0, 9, dt); return
    }
    const c = host.def.pouncer
    if (!c) return

    // —— 感知：进入视野即永久锁定玩家（拉开不脱战、继续逼近/绕圈；
    //    alerted 剧情警戒怪无视距离出生即索敌；仅玩家死亡才解除仇恨并
    //    取消扑击；loseSight 字段保留备用） ——
    if (player.alive && (host.alerted || distP < c.sight)) {
      if (host.ai !== 'kite') host.ai = 'kite'
    } else if (!player.alive && host.ai === 'kite') {
      host.ai = 'idle'
      host.aiTimer = 0.5 + Math.random() * 0.6
      host.pounceState = 'none'
    }

    let targetVx = 0
    let targetVy = 0

    if (host.ai === 'kite' && player.alive) {
      if (host.pounceState === 'windup') {
        // —— 扑前蓄力：站定读招（打断/作废由 takeDamage 处理） ——
        // 蓄力期间角度持续跟踪玩家当前位置（渲染告警箭头同步转）；
        // 起扑瞬间才叠加速度预判锁定——玩家在最后一刻变向即可晃过
        host.pounceAng = Math.atan2(player.y - host.y, player.x - host.x)
        host.pounceT -= dt
        if (host.pounceT <= 0) {
          // 预判点：玩家现位 + 当前速度 × (扑击时长 × lead 系数)
          const leadT = c.pounceDur * c.lead
          const aimX = player.x + (player.vx ?? 0) * leadT
          const aimY = player.y + (player.vy ?? 0) * leadT
          host.pounceAng = Math.atan2(aimY - host.y, aimX - host.x)
          host.pounceState = 'lunge'
          host.pounceT = c.pounceDur
        }
      } else if (host.pounceState === 'lunge') {
        // —— 猛扑：冲量直写速度（不走指数趋近，保证瞬间爆发） ——
        host.pounceT -= dt
        // 扑中：实体接触结算已把 contactCd 置满并给了 recoil 后撤，立即收扑
        const hit = host.contactCd > 0
        if (hit || host.pounceT <= 0) {
          host.pounceState = 'none'
          if (!hit) host.contactCd = c.attackInterval
          host.vx = 0
          host.vy = 0
          if (player.untargetable) return
        } else {
          host.vx = Math.cos(host.pounceAng) * c.pounceSpeed
          host.vy = Math.sin(host.pounceAng) * c.pounceSpeed
          // 扑击中不走下面的 approachVelocity（冲量不能被衰减）
          return
        }
      }

      if (host.pounceState === 'none') {
        // —— 拉扯走位 ——（蓄力期不移动，绕场节拍也冻结）
        host.strafeTimer -= dt
        if (host.strafeTimer <= 0) {
          host.strafeDir *= -1
          host.avoidBias = host.strafeDir
          host.strafeTimer = 1.2 + Math.random() * 1.1
        }

        const ang = Math.atan2(player.y - host.y, player.x - host.x)
        let wantAng = ang
        let speed = c.kiteSpeed
        if (distP < c.orbitMin) {
          // 太近：以后撤为主，混切向走弧线
          const back = ang + Math.PI
          const tang = ang + (Math.PI / 2) * host.strafeDir
          wantAng = Math.atan2(
            Math.sin(back) * 0.72 + Math.sin(tang) * 0.45,
            Math.cos(back) * 0.72 + Math.cos(tang) * 0.45
          )
        } else if (distP > c.orbitMax) {
          // 太远：逼近
          wantAng = ang
        } else {
          // 甜区：绕圈圈
          wantAng = ang + (Math.PI / 2) * host.strafeDir
          speed = c.kiteSpeed * 0.85
        }
        ;({ x: targetVx, y: targetVy } = host.wantVelocity(map, wantAng, speed))

        // —— CD 到点起蓄力（僵直中节拍冻结，顶层 contactCd 不会递减；双保险） ——
        if (host.canUseSkills && host.contactCd <= 0) {
          host.pounceState = 'windup'
          host.pounceT = c.pounceWindup
          targetVx = 0
          targetVy = 0
        }
      } else if (host.pounceState === 'windup') {
        // 蓄力站定
        targetVx = 0
        targetVy = 0
      }
    } else {
      // —— 未交战：idle/wander ——
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

    // 蓄力时钉在原地；lunge 的速度在分支内直写，不走趋近
    if (host.pounceState === 'windup') {
      host.vx = 0
      host.vy = 0
    } else if (host.pounceState !== 'lunge') {
      host.approachVelocity(targetVx, targetVy, c.accel, dt)
    }
  }
}
