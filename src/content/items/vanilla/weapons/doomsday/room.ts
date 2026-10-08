import type { EngineContext } from '../../../../../core/types'
import type { Player } from '../../../../../game/Player'
import type { Enemy } from '../../../../../game/Enemy'
import type { FxLayer } from '../../../../../game/FxLayer'
import type { RoomHost } from '../../../../../game/cave/RoomRuntime'
import { CONFIG } from '../../../../../game/config'
import { sfx } from '../../../../../game/audio/Sfx'
import { getItemDef } from '../../../registry'
import { DOOMSDAY_ID } from '../../ids'
import { calculateDamage, damageLabel } from '../../../../../shared/combat'
import { t } from '../../../../../i18n'
import { doomsdayBurst, doomsdayBeamHit } from './audio'

/** 每个房间独立持有资源效果，不把光刺、光束和专属 HUD 塞进房间类。 */
export class DoomsdayRoom {
  constructor(private readonly room: { fx: FxLayer; enemies: () => readonly Enemy[]; time: () => number; onEnemyKilled: (enemy: Enemy, host: RoomHost) => void }) {}
  remove(enemy: Enemy): void { this.doomsdayMarks.delete(enemy) }
  /** 光刺保存入射方向与局部偏移，随宿主移动；离房全部清除。 */
  private doomsdayMarks = new Map<Enemy, Array<{ angle: number; offset: number }>>()
  private doomBeams: Array<{ x: number; y: number; angle: number; life: number }> = []
  private doomBursts: Array<{ x: number; y: number; life: number }> = []
  private doomLastSerial = 0

  clear(player: Player): void {
    this.doomsdayMarks.clear()
    this.doomBeams = []
    this.doomBursts = []
    this.doomLastSerial = player.doomSwingSerial
    if (player.isDoomsday || player.activeToolId === DOOMSDAY_ID) player.cancelDoomsdayAction()
  }

  private doomDamage(e: Enemy, base: number, p: Player, host: RoomHost, area = false): void {
    if (!e.canBeHit) return
    const equipment = getItemDef(DOOMSDAY_ID).combat
    const result = calculateDamage({ base, attackPower: p.attackPower, coefficient: 0.5,damageBonus:p.outgoingDamageBonus,
      resistance: e.def.combat.physicalResist,
      penetration: (equipment?.penetration ?? 0) + p.equipmentCombat.penetration,
      critChance: (equipment?.critChance ?? 0) + p.equipmentCombat.critChance,
      area, aoeReduction: e.def.combat.aoeReduction })
    e.takeDamage(result.damage, Math.atan2(e.y - p.y, e.x - p.x), 520, 0.3)
    this.room.fx.combatDamage(e.x, e.y - 18, result.damage, 'physical', result.critical)
    if (!e.alive) { this.doomsdayMarks.delete(e); this.room.onEnemyKilled(e, host) }
  }

  update(dt: number, p: Player, special: boolean, engine: EngineContext, host: RoomHost): void {
    for (const e of this.doomsdayMarks.keys()) if (!e.alive) this.doomsdayMarks.delete(e)
    for (const b of this.doomBursts) b.life -= dt
    this.doomBursts = this.doomBursts.filter(b => b.life > 0)
    // 起手序号保证每次普通挥砍只发一束，方向锁定在起手瞬间。
    if (p.doomSwingSerial !== this.doomLastSerial) {
      this.doomLastSerial = p.doomSwingSerial
      const swing = p.getSwing()
      if (swing && p.activeToolId === DOOMSDAY_ID && !p.doomSwingEmpowered)
        this.doomBeams.push({ x: p.x, y: p.y, angle: swing.baseAngle, life: 2 })
    }
    if (special && p.alive && p.doomsdayCanActivate) {
      const hosts = [...this.doomsdayMarks].filter(([e]) => e.canBeHit)
        .map(([e, marks]) => ({ e, count: marks.length, x: e.x, y: e.y }))
      const total = hosts.reduce((n, h) => n + h.count, 0)
      p.startDoomsday(6 + Math.min(2, Math.floor(total / 6)))
      this.doomsdayMarks.clear()
      if (total > 0) {
        // 先快照，再结算；宿主死亡不影响奖励与其范围冲击。
        for (const h of hosts) {
          for (let i = 0; i < h.count && h.e.alive; i++) this.doomDamage(h.e, 666, p, host)
          for (const e of this.room.enemies()) {
            if (e !== h.e && e.alive && e.containsHit(h.x,h.y,110))
              this.doomDamage(e, 333 * h.count, p, host, true)
          }
          this.doomBursts.push({ x: h.x, y: h.y, life: 0.45 })
        }
        doomsdayBurst(sfx)
        engine.shake(0.4)
      }
    }
    for (const b of this.doomBeams) {
      b.life -= dt
      const ux = Math.cos(b.angle), uy = Math.sin(b.angle), length = 1400 * dt
      let first: Enemy | null = null, firstDistance = Infinity
      // 射线与圆的入口交点排序，避免高速穿漏或错误命中后方敌人。
      for (const e of this.room.enemies()) {
        if (!e.canBeHit) continue
        const dx = e.hitX - b.x, dy = e.hitY - b.y
        const forward = dx * ux + dy * uy, side = dx * uy - dy * ux
        const radius = e.hitRadius + 4
        if (Math.abs(side) > radius) continue
        const half = Math.sqrt(radius * radius - side * side)
        const entry = Math.max(0, forward - half)
        if (forward + half >= 0 && entry <= length && entry < firstDistance) { first = e; firstDistance = entry }
      }
      if (first) {
        doomsdayBeamHit(sfx)
        this.doomDamage(first, 333, p, host)
        if (first.canBeHit) {
          const marks = this.doomsdayMarks.get(first) ?? []
          if (marks.length < 6) {
            marks.push({ angle: b.angle, offset: (marks.length - 2.5) * 3 })
            this.doomsdayMarks.set(first, marks)
            // 同一实体插满六根：杀戮冷却 -2s（引爆清空后可再次积攒，每轮周期最多奖励一次）
            if (marks.length === 6 && p.reduceDoomCooldown(2)) {
              this.room.fx.damageText(first.x, first.y - first.r - 12, t('game.notify.doom_cd_cut', { n: 2 }), '#ff8fe0', true)
            }
          }
        }
        b.life = 0
      } else { b.x += ux * length; b.y += uy * length }
      if (b.x < 0 || b.y < 0 || b.x > CONFIG.roomCols * CONFIG.tile || b.y > CONFIG.roomRows * CONFIG.tile) b.life = 0
    }
    this.doomBeams = this.doomBeams.filter(b => b.life > 0)
  }

  render(ctx: CanvasRenderingContext2D, p: Player): void {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const blade = (x: number, y: number, angle: number, length: number): void => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle)
      for (const [width, color] of [[9, '#8a225c66'], [4, '#ee58cdaa'], [1.5, '#fff1fd']] as const) {
        ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(-length, 0); ctx.lineTo(4, 0); ctx.stroke()
      }
      ctx.restore()
    }
    for (const b of this.doomBeams) {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.angle)
      // 短柱状光团：实心厚核、圆钝前端、向后散开的微光，不再用细直线。
      const halo = ctx.createRadialGradient(-12, 0, 2, -12, 0, 40)
      halo.addColorStop(0, '#f793e888'); halo.addColorStop(0.45, '#d240b94c'); halo.addColorStop(1, '#7d24d000')
      ctx.fillStyle = halo; ctx.save(); ctx.scale(1, 0.55); ctx.fillRect(-53, -40, 82, 80); ctx.restore()
      const body = ctx.createLinearGradient(-40, 0, 8, 0)
      body.addColorStop(0, '#8d29b000'); body.addColorStop(0.2, '#bd46ba88'); body.addColorStop(0.55, '#f18bbfe0'); body.addColorStop(0.85, '#ffe3dc'); body.addColorStop(1, '#ffb2d6a0')
      ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-38, -4); ctx.quadraticCurveTo(-20, -11, 2, -7); ctx.quadraticCurveTo(13, 0, 2, 7); ctx.quadraticCurveTo(-20, 11, -38, 4); ctx.closePath(); ctx.fill()
      ctx.fillStyle = '#fff4e7'; ctx.beginPath(); ctx.ellipse(-6, 0, 13, 3.4, 0, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#f48dd5a0'; ctx.lineWidth = 1.5
      const shimmer = this.room.time() * 22 + b.life * 4
      for (let i = 0; i < 3; i++) {
        const y = Math.sin(shimmer + i * 2) * 6
        ctx.beginPath(); ctx.moveTo(-39 - i * 5, y); ctx.quadraticCurveTo(-25, y * 1.5, -15, y * 0.6); ctx.stroke()
      }
      ctx.restore()
    }
    for (const [e, marks] of this.doomsdayMarks) if (e.canBeHit) for (const m of marks)
      blade(e.x - Math.sin(m.angle) * m.offset, e.y + Math.cos(m.angle) * m.offset, m.angle, 26)
    for (const b of this.doomBursts) {
      const progress = 1 - b.life / 0.45
      ctx.globalAlpha = 1 - progress; ctx.strokeStyle = '#f774df'; ctx.lineWidth = 7 * (1 - progress) + 1
      ctx.beginPath(); ctx.arc(b.x, b.y, 110 * progress, 0, Math.PI * 2); ctx.stroke()
    }
    ctx.restore()
    if (p.isDoomsday) this.renderDoomHud(ctx, p)
  }

  /** 纯图形神器状态：冷却长条或最多八瓣的不规则花瓣环。 */
  private renderDoomHud(ctx: CanvasRenderingContext2D, p: Player): void {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'
    if (p.doomsdayMode) {
      // 花瓣环挂在角色 sprite 右上方，缩小后不遮挡血条和世界交互提示。
      ctx.translate(p.x + 23, p.y - 25)
      const remaining = p.doomsdayStrikes
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 4 + Math.sin(i * 2.7) * 0.075 + (i % 3 - 1) * 0.035
        const radius = 8.5
        const bright = i < remaining
        const wobble = 0.86 + (i % 3) * 0.08
        ctx.save(); ctx.rotate(a); ctx.translate(0, -radius)
        ctx.rotate(Math.sin(i * 4.1) * 0.18)
        const skew = Math.sin(i * 5.13) * 1.2
        ctx.beginPath(); ctx.moveTo(skew, -6.2 * wobble); ctx.lineTo(3.2 + (i % 2) * 1.4, -2.1 + skew * 0.3)
        ctx.lineTo(1.6 + skew, 3.7 + (i % 3) * 0.8); ctx.lineTo(-3.3 - (i % 3) * 0.7, 2.2 - skew * 0.4); ctx.lineTo(-3.4 + skew * 0.5, -3.1); ctx.closePath()
        ctx.fillStyle = bright ? '#f77bd8' : '#351c4a'
        ctx.strokeStyle = bright ? '#ffe4fb' : '#67366f'; ctx.lineWidth = bright ? 1.1 : 0.8
        if (bright) { ctx.shadowColor = '#f04fc4'; ctx.shadowBlur = 8 }
        ctx.fill(); ctx.stroke(); ctx.restore()
      }
      ctx.strokeStyle = '#ffb7ec88'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(0, 0, 5.8, 0, Math.PI * 2); ctx.stroke()
      const width = 48, height = 3, left = -width / 2, top = 15
      ctx.fillStyle = '#26152f'; ctx.fillRect(left - 1, top - 1, width + 2, height + 2)
      const durationBar = ctx.createLinearGradient(left, 0, left + width, 0)
      durationBar.addColorStop(0, '#ffe6f7'); durationBar.addColorStop(0.45, '#ff9bda'); durationBar.addColorStop(1, '#6b238e')
      ctx.fillStyle = durationBar; ctx.shadowColor = '#dd55cb'; ctx.shadowBlur = 5
      ctx.fillRect(left, top, width * p.doomsdayDurationRatio, height)
      ctx.shadowBlur = 0; ctx.strokeStyle = '#f5b4edaa'; ctx.lineWidth = 0.6; ctx.strokeRect(left, top, width, height)
    } else {
      // 冷却能量条固定在角色正下方；需让开左下闪避圆环（其脉冲底沿约到 p.y+26）。
      ctx.translate(p.x, p.y + 33)
      // 冷却条按已充能比例从空到满；杀戮条则反向从满到空。
      const ratio = p.doomsdayCooldown > 0 ? 1 - p.doomsdayCooldownRatio : 1
      // 插满六根减免冷却时：条体纵向脉冲放大 + 粉白闪辉
      const pulse = p.doomsdayCdPulse
      if (pulse > 0) ctx.scale(1, 1 + 0.7 * pulse)
      const width = 72, height = 5, left = -width / 2, top = -height / 2
      ctx.fillStyle = '#26152f'; ctx.fillRect(left - 2, top - 2, width + 4, height + 4)
      const bar = ctx.createLinearGradient(left, 0, left + width, 0)
      bar.addColorStop(0, '#6b238e'); bar.addColorStop(0.45, '#d63cae'); bar.addColorStop(0.75, '#ff9bda'); bar.addColorStop(1, '#ffe6f7')
      ctx.fillStyle = bar; ctx.shadowColor = '#ff7de4'; ctx.shadowBlur = 7 + 14 * pulse
      ctx.fillRect(left, top, width * ratio, height)
      ctx.shadowBlur = 0; ctx.strokeStyle = pulse > 0 ? `rgba(255,236,250,${0.67 + 0.33 * pulse})` : '#f5b4edaa'; ctx.lineWidth = 0.8; ctx.strokeRect(left, top, width, height)
    }
    ctx.restore()
  }
}
