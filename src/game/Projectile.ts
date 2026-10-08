/**
 * 敌方弹幕实体（工程化 L3 后纯机制）：
 * - 弹种差异（速度/伤害/半径/寿命/外观）全部在 ProjectileDef 里，构造只吃弹种 id；
 * - 直线匀速，默认一直飞到墙体或障碍；特殊弹种可以显式配置寿命或穿障碍；
 * - 可被符卡"消弹"：外部直接标记 dead = true；
 * - 大型摆件（blockBullets 的矿业设施）作为掩体：命中其碰撞段即湮灭。
 */
import type { StatusDefinition } from '../shared/statusEffects'
import { getProjectileDef } from '../content/projectiles/registry'
import type { BulletRenderer, ProjectileId } from '../content/projectiles/types'
import type { TileMap } from './tilemap'
import { sweepProjectileObstacles, type BulletBlocker } from './projectileObstacles'
export type { BulletBlocker } from './projectileObstacles'
const NO_BLOCKERS: readonly BulletBlocker[] = []

export class Projectile {
  x: number
  y: number
  private vx: number
  private vy: number
  readonly r: number
  readonly damage: number
  readonly onHitStatus?: StatusDefinition
  /** 剩余寿命（秒） */
  private life: number
  dead = false
  /** 本弹是否撞在摆件掩体上（湮灭特效区分撞墙） */
  hitProp = false
  /** 蠕动相位（毒液滴造型用） */
  private phase = Math.random() * Math.PI * 2
  /** 本弹外观绘制器（来自 ProjectileDef，随实体落字段避免每帧查表） */
  private readonly renderer: BulletRenderer
  private readonly renderRadius: number
  private readonly pierceObstacles: boolean
  private readonly ignoreRoomObstacles: boolean
  private readonly split?: import('../content/projectiles/types').ProjectileDef['split']
  private travelled = 0
  private splitReady = false
  private age = 0
  private readonly spiral?: import('../content/projectiles/types').ProjectileDef['spiral']
  private readonly lingering?: import('../content/projectiles/types').ProjectileDef['lingering']
  private readonly spawnX: number
  private readonly spawnY: number
  private readonly initialAngle: number
  private readonly speed: number
  // 复用轨迹缓冲，连续弹幕不再每帧分配数组和坐标对象。
  private contactPath = new Float64Array(8)
  private contactLength = 0
  private pathLeft = 0
  private pathRight = 0
  private pathTop = 0
  private pathBottom = 0

  constructor(x: number, y: number, angle: number, projectileId: ProjectileId) {
    const def = getProjectileDef(projectileId)
    this.x = x
    this.y = y
    this.vx = Math.cos(angle) * def.speed
    this.vy = Math.sin(angle) * def.speed
    this.r = def.radius
    this.damage = def.damage
    this.onHitStatus = def.onHitStatus
    this.life = def.life ?? Infinity
    this.renderer = def.render
    this.renderRadius = def.renderRadius ?? Infinity
    this.pierceObstacles = def.pierceObstacles === true
    this.ignoreRoomObstacles = def.ignoreRoomObstacles === true
    this.split = def.split
    this.spiral = def.spiral; this.lingering = def.lingering
    this.spawnX = x; this.spawnY = y; this.initialAngle = angle; this.speed = def.speed
    if (this.spiral) { this.x += Math.cos(angle) * this.spiral.initialRadius; this.y += Math.sin(angle) * this.spiral.initialRadius }
  }

  update(dt: number, map: TileMap, blockers: readonly BulletBlocker[] = NO_BLOCKERS): void {
    this.contactLength = 0
    if (this.dead) return
    this.age += dt
    this.life -= dt
    if (this.life <= 0) {
      this.dead = true
      return
    }
    this.phase += dt * 10
    this.pathLeft = this.pathRight = this.x
    this.pathTop = this.pathBottom = this.y
    this.appendContact(this.x, this.y)
    // 弯曲弹道分段采样，掉帧也不能从弧线内侧抄近路穿墙或漏判玩家。
    const steps = this.spiral ? Math.max(1, Math.ceil(dt / .02)) : 1
    for (let i = 1; i <= steps; i++) {
      const prevX = this.x, prevY = this.y
      if (this.spiral) {
        const age = this.age - dt + dt * i / steps,decay=this.spiral.angularDecay
        // 后段逐渐展开，保留起手螺旋曲线，但不围着出生点持续高速转圈。
        const turning=decay===undefined?1:Math.exp(-age/Math.max(.001,decay))
        const angle = this.initialAngle + this.spiral.angularSpeed*(decay===undefined?age:decay*(1-turning))
        const radius = this.spiral.initialRadius + this.speed * age
        this.x = this.spawnX + Math.cos(angle) * radius; this.y = this.spawnY + Math.sin(angle) * radius
        this.vx = Math.cos(angle) * this.speed - Math.sin(angle) * radius * this.spiral.angularSpeed*turning
        this.vy = Math.sin(angle) * this.speed + Math.cos(angle) * radius * this.spiral.angularSpeed*turning
      } else { this.x += this.vx * dt; this.y += this.vy * dt }
      const hit = this.pierceObstacles ? null : sweepProjectileObstacles(map, this.ignoreRoomObstacles?NO_BLOCKERS:blockers, prevX, prevY, this.x, this.y, this.r,this.ignoreRoomObstacles)
      if (hit) { this.x = hit.x; this.y = hit.y; this.dead = true; this.hitProp = hit.prop }
      if (this.pierceObstacles && (this.x < 0 || this.y < 0 || this.x >= map.cols * map.tile || this.y >= map.rows * map.tile)) this.dead = true
      this.appendContact(this.x, this.y)
      if (this.split) this.travelled += Math.hypot(this.x - prevX, this.y - prevY)
      if (this.dead) return
    }
    this.prepareSplit()
  }

  private appendContact(x: number, y: number): void {
    if (this.contactLength + 2 > this.contactPath.length) {
      const grown = new Float64Array(this.contactPath.length * 2)
      grown.set(this.contactPath); this.contactPath = grown
    }
    this.contactPath[this.contactLength++] = x
    this.contactPath[this.contactLength++] = y
    this.pathLeft = Math.min(this.pathLeft, x); this.pathRight = Math.max(this.pathRight, x)
    this.pathTop = Math.min(this.pathTop, y); this.pathBottom = Math.max(this.pathBottom, y)
  }

  private prepareSplit(): void {
    if (!this.dead && this.split && this.travelled >= this.split.distance) this.splitReady = true
  }

  /** 房间先检查消弹和玩家命中，再消费分裂，避免已经被斩掉的毛球复活。 */
  drainSplit(): Projectile[] {
    if (this.dead || !this.splitReady || !this.split) return []
    this.splitReady = false; this.dead = true
    return Array.from({ length: this.split.count }, (_, i) => new Projectile(this.x, this.y, this.angle + i * Math.PI * 2 / this.split!.count, this.split!.projectileId))
  }

  get hasPendingSplit(): boolean { return !this.dead && this.splitReady }

  get removed(): boolean {
    return this.dead
  }
  get canTouch(): boolean { return this.contactLength > 0 && (!this.lingering || this.age >= this.lingering.riseTime) }
  /** 伤害扫掠和撞墙共享实际轨迹，墙后的路径不会参与触碰判定。 */
  touchesCircle(x: number, y: number, radius: number): boolean {
    const reach = this.r + radius
    if (x < this.pathLeft - reach || x > this.pathRight + reach || y < this.pathTop - reach || y > this.pathBottom + reach) return false
    for (let i = 2; i < this.contactLength; i += 2) {
      const ax = this.contactPath[i - 2], ay = this.contactPath[i - 1], dx = this.contactPath[i] - ax, dy = this.contactPath[i + 1] - ay
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / Math.max(1e-9, dx * dx + dy * dy)))
      const ex = x - ax - dx * t, ey = y - ay - dy * t
      if (ex * ex + ey * ey <= reach * reach) return true
    }
    return false
  }

  /** 不参与屏外绘制的弹幕仍继续运动、撞墙、分裂和命中，绝不缩短存活时间。 */
  visibleIn(left: number, top: number, right: number, bottom: number): boolean {
    return this.x + this.renderRadius >= left && this.x - this.renderRadius <= right
      && this.y + this.renderRadius >= top && this.y - this.renderRadius <= bottom
  }

  /** 飞行方向角（命中玩家时的击退方向） */
  get angle(): number {
    return Math.atan2(this.vy, this.vx)
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.renderer({ ctx, x: this.x, y: this.y, r: this.r, phase: this.phase, angle: this.angle, age: this.age, splitProgress: this.split ? Math.min(1, this.travelled / this.split.distance) : undefined })
  }
}
