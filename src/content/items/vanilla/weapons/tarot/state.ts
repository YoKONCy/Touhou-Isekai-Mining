import type { Enemy } from '../../../../../game/Enemy'
import type { WeaponBodyMotion } from '../../../types'
import { t } from '../../../../../i18n'
import { calculateRangedDamage } from '../../../../../shared/combat'
import { ARCANA, arcanaNameKey, type Arcana } from './arcana'
import { drawTarotBack } from './appearance'
import { TAROT_FOOL_SEAL, TAROT_TOWER_SLOW } from './statuses'
import { getItemDef } from '../../../../../shared/itemDefs'
import { TSUKINAGA_AI_TAROT_ID } from '../../ids'

export interface TarotOwner {
  x: number; y: number; hp: number; maxHp: number; mana: number; maxMana: number; alive: boolean
  attackPower: number; outgoingDamageBonus: number; rangedCritChance: number; knockbackBonus: number
  equipmentCombat: { critChance: number; penetration: number }
  heal(amount: number): number
}
export interface TarotShot {
  x: number; y: number; angle: number; age: number; card: Arcana; raw: number; critical: boolean
  penetration: number; speed: number; hits: Set<Enemy>; bounces: number; seek?: Enemy; dead: boolean
}
interface ExtraDraw { x: number; y: number; angle: number; rng: () => number }
interface Bounds { left: number; top: number; right: number; bottom: number }
export interface TarotHit { damage: number; physical: number; magic: number; trueDamage: number; critical: boolean; card: Arcana }

/** 每位持有者独立保存弹幕、抽牌提示、禁投计时与射击手势，不参与待机握持。 */
export class TarotState {
  readonly shots: TarotShot[] = []
  readonly labels: { card: Arcana; life: number; sequence: number }[] = []
  private readonly extras: ExtraDraw[] = []
  lockT = 0
  gestureT = 0
  private gestureAngle = 0
  private sequence = 0

  tick(dt: number): void {
    this.lockT = Math.max(0, this.lockT - dt)
    this.gestureT = Math.max(0, this.gestureT - dt)
    for (const label of this.labels) label.life -= dt
    for (let i = this.labels.length - 1; i >= 0; i--) if (this.labels[i].life <= 0) this.labels.splice(i, 1)
  }
  get gestureAim(): number | null {
    if (this.gestureT <= 0) return null
    const progress = 1 - this.gestureT / .2
    return this.gestureAngle - .38 * (1 - Math.min(1, progress / .35))
  }
  get gestureBend(): number { return -.75 * this.gestureT / .2 }
  get bodyMotion(): WeaponBodyMotion | undefined {
    return this.gestureT > 0 ? { lean: Math.sin((1 - this.gestureT / .2) * Math.PI) * .035 } : undefined
  }

  /** 命运之轮的追加发射不消费冷却，也不被同一串抽牌中的节制取消。 */
  fire(owner: TarotOwner, angle: number, x = owner.x, y = owner.y - 5, rng: () => number = Math.random): boolean {
    if (!owner.alive || this.lockT > 0) return false
    this.gestureAngle = angle; this.gestureT = .2
    this.extras.push({ x, y, angle, rng })
    this.drainDraws(owner)
    return true
  }
  private drainDraws(owner: TarotOwner): void {
    const attack = getItemDef(TSUKINAGA_AI_TAROT_ID).ranged!
    // 连续抽到轮盘时分帧继续，不截断效果，也不会让一次极端随机结果阻塞游戏线程。
    for (let budget = 0; budget < 32 && this.extras.length; budget++) {
      const request = this.extras.shift()!
      const card = ARCANA[Math.min(21, Math.max(0, Math.floor(request.rng() * 22)))]
      this.labels.push({ card, life: .7, sequence: ++this.sequence })
      if (this.labels.length > 5) this.labels.shift()
      if (['priestess', 'empress', 'emperor', 'hierophant'].includes(card)) owner.mana = Math.min(owner.maxMana, owner.mana + 10)
      if (card === 'temperance') this.lockT = Math.max(this.lockT, .4)
      let raw = calculateRangedDamage({base:attack.damage,damageBonus:owner.outgoingDamageBonus}).damage
      if (card === 'strength') raw *= 3
      if (card === 'hermit') raw += 50
      const critical = card !== 'devil' && request.rng() < Math.max(0, Math.min(1, owner.rangedCritChance + owner.equipmentCombat.critChance))
      if (critical) raw *= 1.5
      // 百分比原描述合计略低于百分之百，以精确二比一概率分配两种结果。
      if (card === 'devil') raw = request.rng() < 1 / 3 ? 666 : 0
      const spread = ['star', 'moon', 'sun'].includes(card) ? [-Math.PI / 6, 0, Math.PI / 6] : [0]
      for (const offset of spread) this.shots.push({ x: request.x, y: request.y, angle: request.angle + offset, age: 0,
        card, raw, critical, penetration: owner.equipmentCombat.penetration, speed: attack.speed, hits: new Set(), bounces: card === 'world' ? 3 : 0, dead: false })
      if (card === 'wheel') this.extras.push(request)
    }
  }

  /** 所有卡牌穿过地图障碍，只在离开当前场景外缘、命中或弹射结束时回收。 */
  updateFlights(dt: number, owner: TarotOwner, enemies: readonly Enemy[], bounds: Bounds, onHit: (enemy: Enemy, result: TarotHit) => void): void {
    if (!owner.alive) { this.clear(); return }
    this.drainDraws(owner)
    for (const shot of this.shots) {
      shot.age += dt
      let budget = shot.speed * dt
      while (budget > 0 && !shot.dead) {
        if (shot.seek && !shot.seek.canBeHit) shot.seek = this.nextTarget(shot, enemies)
        if (shot.seek) shot.angle = Math.atan2(shot.seek.hitY - shot.y, shot.seek.hitX - shot.x)
        const step = Math.min(3, budget)
        shot.x += Math.cos(shot.angle) * step; shot.y += Math.sin(shot.angle) * step; budget -= step
        if (shot.x < bounds.left - 15 || shot.x > bounds.right + 15 || shot.y < bounds.top - 15 || shot.y > bounds.bottom + 15) { shot.dead = true; break }
        const candidates = enemies.filter(enemy => enemy.canBeHit && !shot.hits.has(enemy) && enemy.containsHit(shot.x,shot.y,5))
        candidates.sort((a, b) => Math.hypot(a.hitX - shot.x, a.hitY - shot.y) - Math.hypot(b.hitX - shot.x, b.hitY - shot.y))
        for (const enemy of candidates) {
          if (shot.dead) break
          shot.hits.add(enemy)
          const result = this.hit(shot, owner, enemy)
          onHit(enemy, result)
          if (shot.card === 'chariot') continue
          if (shot.card === 'world' && shot.bounces > 0) {
            shot.bounces--; shot.seek = this.nextTarget(shot, enemies)
            if (!shot.seek) shot.dead = true
          } else shot.dead = true
          break
        }
      }
    }
    for (let i = this.shots.length - 1; i >= 0; i--) if (this.shots[i].dead) this.shots.splice(i, 1)
  }
  private nextTarget(shot: TarotShot, enemies: readonly Enemy[]): Enemy | undefined {
    let next: Enemy | undefined, distance = Infinity
    for (const enemy of enemies) if (enemy.canBeHit && !shot.hits.has(enemy)) {
      const d = Math.hypot(enemy.hitX - shot.x, enemy.hitY - shot.y)
      if (d < distance) { distance = d; next = enemy }
    }
    return next
  }
  private hit(shot: TarotShot, owner: TarotOwner, enemy: Enemy): TarotHit {
    const trueCard = shot.card === 'justice' || shot.card === 'judgement'
    let physical = trueCard ? 0 : calculateRangedDamage({ base: shot.raw, resistance: enemy.def.combat.physicalResist, penetration: shot.penetration }).damage
    let magicRaw = shot.card === 'magician' ? shot.raw : shot.card === 'hanged' ? Math.max(0, owner.maxHp - owner.hp) : shot.card === 'death' ? Math.min(200, Math.max(0, enemy.maxHp - enemy.hp) * .4) : 0
    let magic = calculateRangedDamage({ base: magicRaw, resistance: enemy.def.combat.magicResist, penetration: shot.penetration }).damage
    physical = enemy.effects.modify('damageTaken', enemy.effects.modify('physicalDamageTaken', physical))
    magic = enemy.effects.modify('damageTaken', magic)
    if (shot.card === 'death') magic = Math.min(200, magic)
    const trueDamage = trueCard ? shot.raw : 0, before = enemy.hp
    enemy.takeDamage(physical + magic + trueDamage, shot.angle, (shot.card === 'chariot' ? 200 : 0) + owner.knockbackBonus, 0)
    const damage = Math.max(0, before - enemy.hp)
    if (shot.card === 'lovers') owner.heal(damage * .5)
    if (enemy.alive && shot.card === 'fool') enemy.addStatus(TAROT_FOOL_SEAL, 'tarot:fool')
    if (enemy.alive && shot.card === 'tower') enemy.addStatus(TAROT_TOWER_SLOW, 'tarot:tower')
    return { damage, physical, magic, trueDamage, critical: shot.critical, card: shot.card }
  }

  clear(): void { this.shots.length = 0; this.extras.length = 0; this.labels.length = 0; this.gestureT = 0 }
  render(g: CanvasRenderingContext2D, owner: TarotOwner): void {
    for (const shot of this.shots) {
      g.save(); g.translate(shot.x, shot.y); g.rotate(shot.angle + shot.age * 4)
      drawTarotBack(g); g.restore()
    }
    const labels = this.labels.slice(-3)
    for (const [index, label] of labels.entries()) {
      g.save(); g.font = '10px zpix, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'
      const x = owner.x, y = owner.y - 64 - (labels.length - 1 - index) * 13
      g.globalAlpha = .6 * Math.min(1, label.life / .2)
      g.fillStyle = '#c5b9c7'; g.fillText(t(arcanaNameKey(label.card)), x, y); g.restore()
    }
  }
}
