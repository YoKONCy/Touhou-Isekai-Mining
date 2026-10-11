import { captureMotion, interpolatedPosition } from '../../core/simulation/interpolation'
import { emitSimulationEvent } from '../../core/simulation/events'
import { SnapshotCodec, type StateFields } from '../../core/simulation/snapshot'
import { randomCombat, randomStory } from '../../core/simulation/random'
import type { CharacterProfile } from '../../shared/profile'
import type { LivingGunReserve } from '../../shared/livingGun'
import type { WeaponBodyMotion, WeaponGrip } from '../../content/items/types'
import type { Enemy } from '../Enemy'
import type { TileMap } from '../tilemap'
import { getItemDef } from '../../shared/itemDefs'
import { calculateRangedDamage } from '../../shared/combat'
import { SCP127_ID } from '../../content/items/vanilla/ids'
import { drawTooth, LIVING_GUN_GEOMETRY } from '../../content/items/vanilla/weapons/scp127/appearance'
import { armShoulders, ARM_RIG, rigPalmOffset } from '../art/rig/handGrip'
import { quantizeDir4 } from '../art/rig/skeleton'
import { sweepProjectileObstacles, type BulletBlocker } from '../projectileObstacles'
import { sfx } from '../audio/Sfx'
import { firstEnemyAlong } from '../CombatSpatial'
import { canvasViewport,visible } from '../../core/rendering/Viewport'
import { t } from '../../i18n'
import { bakeSprite,drawSprite,SpriteCache } from '../../core/rendering/SpriteCache'
import { textStamp,fontCacheKey } from '../../core/rendering/TextStamp'
const reserveHud=new SpriteCache(128,1024*1024)

type Remark = 'equip' | 'held_idle' | 'bag_idle' | 'overheat' | 'empty' | 'regen' | 'low_hp' | 'clear' | 'extract' | 'down'
const PRIORITY: Record<Remark, number> = { equip: 25, held_idle: 10, bag_idle: 10, overheat: 35, empty: 75, regen: 20, low_hp: 85, clear: 45, extract: 65, down: 100 }
interface Owner {
  entityId?: string
  activeToolId: string | null
  x: number; y: number; vx: number; vy: number; hp: number; maxHp: number; alive: boolean; facing: number
  shootingDeviation: number; rangedCritChance: number; outgoingDamageBonus: number; knockbackBonus: number
  equipmentCombat: { critChance: number; penetration: number }
  physicalDamageMultiplier?:number
}
interface ToothShot { x: number; y: number; angle: number; speed: number; launch: number; launchAngle: number; raw: number; critical: boolean; penetration: number; knockback: number; dead: boolean }
interface Speech { kind: Remark; letters: string[]; age: number; sounded: number }
const clamp = (n: number) => Math.max(0, Math.min(1, n))

/** 连射、双手姿态和拌嘴属于当前角色，备弹唯一真值保存在角色档案中。 */
export class Scp127State {
  readonly shots: ToothShot[] = []
  private profile: CharacterProfile | null = null
  private speech: Speech | null = null
  private pending: Remark | null = null
  private muted = false
  private held = false
  private idleAge = 0
  private nextIdle = 48 + randomStory() * 35
  private burstShots = 0
  private burstWarned = false
  private lastShotAt = -Infinity
  private recoilT = 0
  private lift = 0
  private gunSide = 1
  private gunFlipVertical = false
  private arenaKey: string | number | null = null
  private arenaCleared = false
  private readonly lastRemarks = new Map<Remark, number>()
  captureSimulation(codec: SnapshotCodec): StateFields { return codec.capture(this, ['profile']) }
  restoreSimulation(state: StateFields, codec: SnapshotCodec): void { codec.restore(this, state) }
  bind(profile: CharacterProfile): void { this.profile = profile }
  private get reserve(): LivingGunReserve | undefined { return this.profile?.livingGun }
  private get owned(): boolean {
    const p = this.profile
    return !!p && (p.inventory.count(SCP127_ID) > 0 || p.trash.count(SCP127_ID) > 0 || p.equipment.get('weaponA') === SCP127_ID || p.equipment.get('weaponB') === SCP127_ID)
  }
  /** 非手持时仍会长牙；面板暂停由统一时钟冻结，剧情锁定时也不推进备弹。 */
  observe(dt: number, owner: Owner, quiet = false): void {
    const reserve = this.reserve; if (!reserve) return
    const held = owner.activeToolId === SCP127_ID
    const recovering = reserve.tick(quiet ? 0 : dt)
    this.held = held; this.muted = quiet
    if (!this.owned) { this.speech = null; this.pending = null; reserve.wasHeld = false; this.idleAge = 0; return }
    if (held && !reserve.wasHeld && !quiet) this.say('equip')
    if (!quiet) reserve.wasHeld = held
    if (owner.alive && owner.hp / owner.maxHp <= .3 && !reserve.lowHealth) { reserve.lowHealth = true; this.say('low_hp') }
    else if (owner.hp / owner.maxHp >= .45) reserve.lowHealth = false
    if (recovering && owner.alive) this.say('regen')
    if (!quiet && this.pending) { const kind = this.pending; this.pending = null; this.say(kind) }
    if (quiet) {
      if (this.speech && PRIORITY[this.speech.kind] < 65) this.speech = null
      return
    }
    if (this.speech) {
      const speech = this.speech
      speech.age += dt
      const shown = Math.min(speech.letters.length, Math.floor(speech.age / .045))
      if (shown >= speech.sounded + 2) {
        speech.sounded = shown
        const char = speech.letters[shown - 1]
        if (char && !/[，。！、…？\s]/.test(char)) sfx.scp127Voice(shown, PRIORITY[speech.kind] >= 75)
      }
      if (speech.age > speech.letters.length * .045 + 3.3) this.speech = null
    }
    const still = Math.hypot(owner.vx, owner.vy) < 10 && reserve.clock - this.lastShotAt > 5
    this.idleAge = owner.alive && (!held || still) ? this.idleAge + dt : 0
    if (this.idleAge >= this.nextIdle) { this.say(held ? 'held_idle' : 'bag_idle'); this.idleAge = 0; this.nextIdle = 45 + randomStory() * 45 }
  }
  noteArena(key: string | number, cleared: boolean): void {
    if (this.arenaKey === key && !this.arenaCleared && cleared) this.say('clear')
    this.arenaKey = key; this.arenaCleared = cleared
  }
  say(kind: Remark): void {
    const reserve = this.reserve
    if (!reserve || !this.owned) return
    if (reserve.clock - (this.lastRemarks.get(kind) ?? -Infinity) < (kind === 'down' ? 1 : kind === 'empty' ? 12 : kind === 'low_hp' ? 15 : 8)) return
    if (this.muted) { if (PRIORITY[kind] >= 65 && (!this.pending || PRIORITY[kind] > PRIORITY[this.pending])) this.pending = kind; return }
    if (this.speech && PRIORITY[kind] <= PRIORITY[this.speech.kind]) return
    if (PRIORITY[kind] < 65 && reserve.clock - reserve.lastSpokeAt < 8) return
    this.speech = { kind, letters: Array.from(t(`scp127.remark.${kind}`)), age: 0, sounded: 0 }
    reserve.lastSpokeAt = reserve.clock
    this.lastRemarks.set(kind, reserve.clock)
  }
  /** 抬枪接握与短后坐独立于整个人物位置，停火后稍作停留再垂下枪口。 */
  tickPose(dt: number, held: boolean): void {
    this.recoilT = Math.max(0, this.recoilT - dt)
    const target = held || (this.reserve?.clock ?? 0) - this.lastShotAt < .25 ? 1 : 0
    this.lift += (target - this.lift) * Math.min(1, dt * 16)
  }
  get recoil(): number { return Math.sin(clamp(this.recoilT / .09) * Math.PI) }
  get flipVertical(): boolean { return this.gunFlipVertical }
  private angle(aim: number, facing: number): number {
    const dir = quantizeDir4(facing)
    // 正背面也采用横置低待机，避免竖枪把后握把挤到脸边；左右侧身保持对称。
    const lowered = dir === 'left' || dir === 'up' ? Math.PI - .35 : .35
    return lowered + Math.atan2(Math.sin(aim - lowered), Math.cos(aim - lowered)) * this.lift
  }
  bodyMotion(): WeaponBodyMotion {
    return { lean: -.025 * this.recoil }
  }
  /** 沿用身体已有四向，按双臂可达范围分配扳机手与托枪手，不更改角色朝向。 */
  grip(aim: number, facing: number): WeaponGrip {
    const dir = quantizeDir4(facing), worldAngle = this.angle(aim, facing)
    const angle = dir === 'right' ? Math.PI - worldAngle : worldAngle
    const u = { x: Math.cos(angle), y: Math.sin(angle) }, n = { x: -u.y, y: u.x }
    // 弹匣朝下的翻转取决于枪口朝向，再抵消人物镜像；近竖直时保留上一侧防止抖翻。
    const horizontal = Math.cos(worldAngle)
    if (Math.abs(horizontal) > .08) this.gunSide = horizontal > 0 ? 1 : -1
    const localSide = this.gunSide * (dir === 'right' ? -1 : 1)
    this.gunFlipVertical = localSide < 0
    const { rear, front, scale } = LIVING_GUN_GEOMETRY
    const along = (front.x - rear.x) * scale, across = (front.y - rear.y) * scale * localSide
    const offset = { x: u.x * along + n.x * across, y: u.y * along + n.y * across }
    const palmOffset = rigPalmOffset()
    const { near, far } = armShoulders(dir), radius = ARM_RIG.upper + ARM_RIG.lower + palmOffset - .08
    const nearDistance = Math.hypot(far.x - offset.x - near.x, far.y - offset.y - near.y)
    const farDistance = Math.hypot(near.x - offset.x - far.x, near.y - offset.y - far.y)
    const farTrigger = farDistance < nearDistance, primary = farTrigger ? far : near, other = farTrigger ? near : far
    const q = { x: other.x - offset.x, y: other.y - offset.y }
    const dx = q.x - primary.x, dy = q.y - primary.y, distance = Math.hypot(dx, dy) || 1
    const height = Math.sqrt(Math.max(0, radius * radius - distance * distance / 4))
    const center = { x: (primary.x + q.x) / 2, y: (primary.y + q.y) / 2 }
    // 双手连同枪械向身前伸展，后握把靠胸前、前握把由伸出的手臂托住。
    const extension = 6 + 2 * this.lift - this.recoil * .5
    const preferred = { x: center.x + u.x * extension, y: -3.5 - 1.5 * this.lift - offset.y / 2 + u.y * extension }
    const apart = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
    const inside = (p: { x: number; y: number }) => apart(p, primary) <= radius + .0001 && apart(p, q) <= radius + .0001
    const candidates = [center]
    if (inside(preferred)) candidates.push(preferred)
    for (const c of [primary, q]) {
      const scale = Math.min(1, radius / (apart(preferred, c) || 1))
      const p = { x: c.x + (preferred.x - c.x) * scale, y: c.y + (preferred.y - c.y) * scale }
      if (inside(p)) candidates.push(p)
    }
    for (const sign of [-1, 1]) candidates.push({ x: center.x - sign * dy / distance * height, y: center.y + sign * dx / distance * height })
    const trigger = candidates.sort((a, b) => apart(a, preferred) - apart(b, preferred))[0]!
    const fore = { x: trigger.x + offset.x, y: trigger.y + offset.y }
    const inFront = dir !== 'up' && Math.cos(worldAngle - facing) > -.15
    return { offset: 0, weight: 1, main: farTrigger ? fore : trigger, support: farTrigger ? trigger : fore,
      weaponHand: farTrigger ? 'far' : 'near', palmOffset, weaponAngle: worldAngle, supportWeaponAngle: worldAngle,
      nearBend: dir === 'up' ? 1 : -1, farBend: dir === 'up' ? -1 : 1, inFront }
  }
  fire(owner: Owner, hand: { x: number; y: number; angle: number }, rng: () => number = randomCombat): boolean {
    const reserve = this.reserve
    if (!reserve || !owner.alive || !this.owned || this.lift < .82 || !reserve.consume()) return false
    const def = getItemDef(SCP127_ID), attack = def.ranged!
    const angle = owner.facing + (rng() * 2 - 1) * Math.max(0, owner.shootingDeviation + attack.accuracyPenalty) * Math.PI / 180
    const damage = calculateRangedDamage({ base: attack.damage*(owner.physicalDamageMultiplier??1), damageBonus: owner.outgoingDamageBonus, critChance: (def.combat?.critChance ?? 0) + owner.rangedCritChance + owner.equipmentCombat.critChance }, rng)
    const { chamber, muzzle, rear, scale } = LIVING_GUN_GEOMETRY
    const along = (chamber.x - rear.x) * scale, across = (chamber.y - rear.y) * scale * this.gunSide
    // 首帧连同枪口前的短段一起扫掠，贴脸目标或紧贴掩体时不能凭空越过碰撞。
    this.shots.push({ x: hand.x + Math.cos(hand.angle) * along - Math.sin(hand.angle) * across, y: hand.y + Math.sin(hand.angle) * along + Math.cos(hand.angle) * across,
      angle, speed: attack.speed, launch: (muzzle.x - chamber.x) * scale, launchAngle: hand.angle, raw: damage.damage, critical: damage.critical, penetration: (def.combat?.penetration ?? 0) + owner.equipmentCombat.penetration, knockback: (attack.knockback ?? 0) + owner.knockbackBonus, dead: false })
    if (reserve.clock - this.lastShotAt > .4) { this.burstShots = 0; this.burstWarned = false }
    this.lastShotAt = reserve.clock; this.burstShots++; this.recoilT = .09
    if (reserve.ammo === 0) this.say('empty')
    else if (this.burstShots >= 18 && !this.burstWarned) { this.burstWarned = true; this.say('overheat') }
    emitSimulationEvent({type:'shot',source:owner.entityId??'player',weapon:SCP127_ID})
    sfx.scp127Shot()
    return true
  }
  updateFlights(dt: number, map: TileMap, blockers: readonly BulletBlocker[], enemies: readonly Enemy[], onHit: (enemy: Enemy, damage: number, critical: boolean) => void): void {
    for (const shot of this.shots) {
      captureMotion(shot)
      let budget = shot.speed * dt + (dt > 0 ? shot.launch : 0)
      while (budget > 0 && !shot.dead) {
        const launching = shot.launch > 0, angle = launching ? shot.launchAngle : shot.angle
        const step = Math.min(budget, launching ? shot.launch : Infinity), x = shot.x + Math.cos(angle) * step, y = shot.y + Math.sin(angle) * step
        const obstacle=sweepProjectileObstacles(map,blockers,shot.x,shot.y,x,y,1.8),target=firstEnemyAlong(enemies,shot.x,shot.y,x,y,2.4)
        if(obstacle&&(!target||obstacle.fraction<=target.fraction)){shot.x=obstacle.x;shot.y=obstacle.y;shot.dead=true;break}
        const fraction=target?.fraction??1
        shot.x+=(x-shot.x)*fraction;shot.y+=(y-shot.y)*fraction;budget-=step
        if (launching) shot.launch = Math.max(0, shot.launch - step)
        if(target) {
          const enemy=target.enemy
          const damage = enemy.resolveDamage({base:shot.raw,penetration:shot.penetration},'physical',true).damage, before = enemy.hp
          enemy.takeDamage(damage, shot.angle, shot.knockback, 0,'physical'); shot.dead = true
          onHit(enemy, Math.max(0, before - enemy.hp), shot.critical)
        }
      }
    }
    let write = 0
    for (const shot of this.shots) if (!shot.dead) this.shots[write++] = shot
    this.shots.length = write
  }
  clearFlights(): void { this.shots.length = 0; this.recoilT = 0; this.lift = 0 }
  renderFlights(g: CanvasRenderingContext2D): void {
    if (!this.shots.length) return
    const view=canvasViewport(g)
    for (const shot of this.shots) { const position=interpolatedPosition(shot);if(!visible(view,position.x,position.y,18))continue;g.save(); g.translate(position.x, position.y); g.rotate(shot.angle); drawTooth(g); g.restore() }
  }
  /** 玩家脚下是弹匣观察窗；发言不画框，逐字错落冒出、错落下坠。 */
  renderOverlay(g: CanvasRenderingContext2D, owner: Owner): void {
    if (this.muted || !this.owned) return
    const reserve = this.reserve!
    if (this.held && owner.alive) {
      g.save(); g.translate(Math.round(owner.x), Math.round(owner.y + 28))
      g.font = '9px zpix, monospace'
      const stamp=reserveHud.get(`${reserve.ammo}:${fontCacheKey()}`,()=>{
        const label=`${reserve.ammo}/60`,width=46+Math.ceil(g.measureText(label).width),half=width/2,slotX=-half+4
        return bakeSprite(-half-2,-9,width+4,21,c=>{
          c.font='9px zpix, monospace';c.fillStyle='#252b34';c.strokeStyle='#868579';c.lineWidth=.7;c.fillRect(-half,-7,width,17);c.strokeRect(-half,-7,width,17)
          c.fillStyle='#59616a';c.fillRect(-half+1,-6,width-2,1);c.fillStyle='#111923';c.fillRect(slotX,-3,32,9)
          const count=Math.ceil(reserve.ammo/5)
          for(let i=0;i<12;i++){c.fillStyle=i<count?reserve.ammo<=12?'#cc8d74':'#d7ccab':'#414750';c.fillRect(slotX+2+i*2.5,-1,1.5,5)}
          c.textAlign='right';c.fillStyle=reserve.ammo<=12?'#ecc29b':'#eee1c3';c.fillText(label,half-4,4)
          for(const x of [-half+3,half-4]){c.fillStyle='#a8987c';c.fillRect(x,7,1,1)}
        })
      })
      drawSprite(g,stamp);const width=stamp.width-4,half=width/2
      if (reserve.ammo < 60) { g.fillStyle = '#87a396'; g.fillRect(-half+4, 8, (width-8) * (1 - clamp(reserve.untilRegen / reserve.recoveryInterval)), 1) }
      g.restore()
    }
    const speech = this.speech; if (!speech) return
    const cols = Math.min(14, speech.letters.length), rows = Math.ceil(speech.letters.length / cols), width = cols * 12
    const transform = g.getTransform()
    const left = transform.a > 0 ? -transform.e / transform.a + 8 : -Infinity
    const right = transform.a > 0 ? (g.canvas.width - transform.e) / transform.a - 8 : Infinity
    const center = Math.max(left + width / 2, Math.min(right - width / 2, owner.x))
    g.save(); g.font = '12px zpix, "DotGothic16", sans-serif'; g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = 2.7
    for (let i = 0; i < speech.letters.length; i++) {
      const age = speech.age - i * .045; if (age < 0) continue
      const seed = Math.sin(i * 9.7 + speech.letters[i].codePointAt(0)!)
      const fall = Math.max(0, speech.age - (speech.letters.length * .045 + 2.05) - ((i * 7) % 13) * .035)
      const alpha = Math.min(1, age * 12) * (1 - clamp(fall / .85)); if (alpha <= 0) continue
      const pop = 5 * Math.exp(-age * 12), x = center - width / 2 + (i % cols) * 12 + 6 + seed * 1.4 + fall * seed * 8
      const y = owner.y - 73 - (rows - 1) * 16 + Math.floor(i / cols) * 16 + seed * 2.4 + pop + fall * fall * 85
      g.save(); g.globalAlpha *= alpha; g.translate(x, y); g.rotate(seed * .11 + fall * seed * .6)
      drawSprite(g,textStamp(speech.letters[i],'12px zpix, "DotGothic16", sans-serif',PRIORITY[speech.kind]>=75?'#ffe2b5':'#ece1c7','#161523',2.7));g.restore()
    }
    g.restore()
  }
}
