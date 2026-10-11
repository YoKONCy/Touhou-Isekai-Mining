import { captureMotion, interpolatedPosition } from '../../../../../core/simulation/interpolation'
import { randomCombat } from '../../../../../core/simulation/random'
import type { Enemy } from '../../../../../game/Enemy'
import type { TileMap } from '../../../../../game/tilemap'
import { sweepProjectileObstacles, type BulletBlocker } from '../../../../../game/projectileObstacles'
import type { WeaponBodyMotion } from '../../../types'
import { t } from '../../../../../i18n'
import { applyFlatResistance,calculateRangedDamage } from '../../../../../shared/combat'
import { ARCANA, arcanaNameKey, type Arcana } from './arcana'
import { drawTarotBack } from './appearance'
import { TAROT_FOOL_SEAL, TAROT_TOWER_SLOW } from './statuses'
import { enemyCandidates } from '../../../../../game/CombatSpatial'
import { canvasViewport,visible } from '../../../../../core/rendering/Viewport'
import { drawSprite } from '../../../../../core/rendering/SpriteCache'
import { textStamp } from '../../../../../core/rendering/TextStamp'
import { getItemDef } from '../../../../../shared/itemDefs'
import { TSUKINAGA_AI_TAROT_ID } from '../../ids'

export interface TarotOwner {
  x: number; y: number; hp: number; maxHp: number; mana: number; maxMana: number; alive: boolean
  attackPower: number; outgoingDamageBonus: number; rangedCritChance: number; knockbackBonus: number
  equipmentCombat: { critChance: number; penetration: number }
  physicalDamageMultiplier?:number
  heal(amount: number): number
}
export interface TarotShot {
  x: number; y: number; angle: number; age: number; card: Arcana; raw: number; critical: boolean
  penetration: number; speed: number; hits: Set<Enemy>; bounces: number; seek?: Enemy; dead: boolean
  physicalMultiplier?:number
}
interface ExtraDraw { x: number; y: number; angle: number; rng: () => number }
export interface TarotHit { damage: number; physical: number; magic: number; trueDamage: number; critical: boolean; card: Arcana }

/** 每位持有者独立保存弹幕、抽牌提示、禁投计时与射击手势，不参与待机握持。 */
export class TarotState {
  readonly shots: TarotShot[] = []
  readonly labels: { card: Arcana; life: number; sequence: number }[] = []
  private readonly extras: ExtraDraw[] = []
  lockT = 0
  private judgementT = 0
  gestureT = 0
  private gestureAngle = 0
  private sequence = 0

  tick(dt: number): void {
    this.lockT = Math.max(0, this.lockT - dt)
    this.judgementT = Math.max(0, this.judgementT - dt)
    this.gestureT = Math.max(0, this.gestureT - dt)
    for (const label of this.labels) label.life -= dt
    for (let i = this.labels.length - 1; i >= 0; i--) if (this.labels[i].life <= 0) this.labels.splice(i, 1)
  }
  /** 审判只覆盖投牌间隔，节制的独立禁投计时仍然生效。 */
  attackInterval(normal: number): number { return this.judgementT > 0 ? .2 : normal }
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
  fire(owner: TarotOwner, angle: number, x = owner.x, y = owner.y - 5, rng: () => number = randomCombat): boolean {
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
      if (card === 'temperance') this.lockT = Math.max(this.lockT, .8)
      if (card === 'judgement') this.judgementT = 1
      let raw = calculateRangedDamage({base:attack.damage,damageBonus:owner.outgoingDamageBonus}).damage
      if (card === 'strength') raw *= 3
      if (card === 'hermit') raw += 50
      const critical = card !== 'devil' && request.rng() < Math.max(0, Math.min(1, owner.rangedCritChance + owner.equipmentCombat.critChance))
      if (critical) raw *= 1.5
      // 百分比原描述合计略低于百分之百，以精确二比一概率分配两种结果。
      if (card === 'devil') raw = request.rng() < 1 / 3 ? 666 : 0
      const spread = ['star', 'moon', 'sun'].includes(card) ? [-Math.PI / 6, 0, Math.PI / 6] : [0]
      for (const offset of spread) this.shots.push({ x: request.x, y: request.y, angle: request.angle + offset, age: 0,
        card, raw, critical,physicalMultiplier:owner.physicalDamageMultiplier??1, penetration: owner.equipmentCombat.penetration, speed: attack.speed, hits: new Set(), bounces: card === 'world' ? 3 : 0, dead: false })
      if (card === 'wheel') this.extras.push(request)
    }
  }

  /** 所有牌型共用墙体与掩体碰撞，战车穿敌及世界弹射也不能越过障碍物。 */
  updateFlights(dt: number, owner: TarotOwner, enemies: readonly Enemy[], map: TileMap, blockers: readonly BulletBlocker[], onHit: (enemy: Enemy, result: TarotHit) => void): void {
    if (!owner.alive) { this.clear(); return }
    this.drainDraws(owner)
    for (const shot of this.shots) {
      captureMotion(shot)
      if (shot.card === 'world' && shot.hits.size === 0) shot.seek = this.nextTarget(shot, enemies)
      shot.age += dt
      let budget = shot.speed * dt
      while (budget > 0 && !shot.dead) {
        if (shot.seek && !shot.seek.canBeHit) shot.seek = this.nextTarget(shot, enemies)
        if (shot.seek) shot.angle = Math.atan2(shot.seek.hitY - shot.y, shot.seek.hitX - shot.x)
        const step = Math.min(3, budget)
        const x = shot.x + Math.cos(shot.angle) * step, y = shot.y + Math.sin(shot.angle) * step
        const obstacle = sweepProjectileObstacles(map, blockers, shot.x, shot.y, x, y, 3)
        if (obstacle) { shot.x = obstacle.x; shot.y = obstacle.y; shot.dead = true; break }
        shot.x = x; shot.y = y; budget -= step
        if (shot.x < 0 || shot.x >= map.cols * map.tile || shot.y < 0 || shot.y >= map.rows * map.tile) { shot.dead = true; break }
        const candidates = enemyCandidates(enemies,shot.x-5,shot.y-5,shot.x+5,shot.y+5).filter(enemy => enemy.canBeHit && !shot.hits.has(enemy) && enemy.containsHit(shot.x,shot.y,5))
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
    const trueCard = shot.card === 'justice'
    let physical = trueCard ? 0 : enemy.resolveDamage({base:shot.raw*(shot.physicalMultiplier??1),penetration:shot.penetration},'physical').damage
    let magicRaw = shot.card === 'magician' ? shot.raw : shot.card === 'hanged' ? Math.max(0, owner.maxHp - owner.hp) : shot.card === 'death' ? Math.min(200, Math.max(0, enemy.maxHp - enemy.hp) * .4) : 0
    let magic = enemy.resolveDamage({base:magicRaw,penetration:shot.penetration},'magic').damage
    if (shot.card === 'death') magic = Math.min(200, magic)
    // 一张牌的物理、魔法分量分别过双抗，固定远程抵消只对合计扣一次；真实伤害绕过防御。
    const normal=physical+magic
    if(normal>0){const kept=applyFlatResistance(normal,0,0,0,enemy.def.combat.rangedReduction??0)/normal;physical*=kept;magic*=kept}
    const trueDamage = trueCard ? shot.raw : 0, before = enemy.hp
    enemy.takeDamage(physical + magic + trueDamage, shot.angle, (shot.card === 'chariot' ? 200 : 0) + owner.knockbackBonus, 0)
    const damage = Math.max(0, before - enemy.hp)
    if (shot.card === 'lovers') owner.heal(damage * .5)
    if (enemy.alive && shot.card === 'fool') enemy.addStatus(TAROT_FOOL_SEAL, 'tarot:fool')
    if (enemy.alive && shot.card === 'tower') enemy.addStatus(TAROT_TOWER_SLOW, 'tarot:tower')
    return { damage, physical, magic, trueDamage, critical: shot.critical, card: shot.card }
  }

  clear(): void { this.shots.length = 0; this.extras.length = 0; this.labels.length = 0; this.gestureT = 0; this.judgementT = 0 }
  render(g: CanvasRenderingContext2D, owner: TarotOwner): void {
    if (!this.shots.length && !this.labels.length) return
    const view=canvasViewport(g)
    for (const shot of this.shots) {
      const position=interpolatedPosition(shot)
      if(!visible(view,position.x,position.y,25))continue
      g.save(); g.translate(position.x, position.y); g.rotate(shot.angle + shot.age * 4)
      drawTarotBack(g); g.restore()
    }
    const labels = this.labels.slice(-3)
    for (const [index, label] of labels.entries()) {
      g.save(); g.font = '10px zpix, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'
      const x = owner.x, y = owner.y - 64 - (labels.length - 1 - index) * 13
      g.globalAlpha = .6 * Math.min(1, label.life / .2)
      g.translate(x,y+4);drawSprite(g,textStamp(t(arcanaNameKey(label.card)),'10px zpix, monospace','#c5b9c7','#000000',0));g.restore()
    }
  }
}
