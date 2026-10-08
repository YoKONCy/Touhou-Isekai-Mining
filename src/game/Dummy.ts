import { CONFIG } from './config'

/**
 * 训练假人（史莱姆形态）：
 * 不会攻击，只用来验证挥击判定、击退、受击闪白、伤害飘字与重生循环。
 * 后续会进化为真正敌人的基类（接 AI 状态机）。
 */
export class Dummy {
  x: number
  y: number
  vx = 0
  vy = 0
  hp: number
  readonly maxHp = CONFIG.dummy.hp
  readonly radius = 16

  /** 受击闪白计时 */
  private flash = 0
  /** 死亡重生计时（>0 表示已死亡） */
  deadTimer = 0
  /** 呼吸动画相位 */
  private phase: number

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
    this.hp = this.maxHp
    this.phase = Math.random() * Math.PI * 2
  }

  get alive(): boolean {
    return this.deadTimer <= 0
  }

  /** 受到伤害：扣血 + 闪白 + 沿攻击方向击退 */
  takeDamage(amount: number, dirAngle: number): void {
    if (!this.alive) return
    this.hp -= amount
    this.flash = 0.12
    this.vx += Math.cos(dirAngle) * CONFIG.dummy.knockback
    this.vy += Math.sin(dirAngle) * CONFIG.dummy.knockback
    if (this.hp <= 0) {
      this.hp = 0
      this.deadTimer = CONFIG.dummy.respawn
    }
  }

  reset(): void {
    this.hp = this.maxHp
    this.deadTimer = 0
    this.vx = this.vy = 0
    this.flash = 0
  }

  update(
    dt: number,
    bounds: { left: number; top: number; right: number; bottom: number }
  ): void {
    this.phase += dt * 2.4
    this.flash = Math.max(0, this.flash - dt)

    if (this.deadTimer > 0) {
      this.deadTimer -= dt
      if (this.deadTimer <= 0) this.reset()
      return
    }

    // 击退摩擦（指数衰减）
    const k = Math.exp(-9 * dt)
    this.vx *= k
    this.vy *= k
    this.x += this.vx * dt
    this.y += this.vy * dt

    this.x = Math.max(bounds.left + this.radius, Math.min(this.x, bounds.right - this.radius))
    this.y = Math.max(bounds.top + this.radius, Math.min(this.y, bounds.bottom - this.radius))
  }

  render(ctx: CanvasRenderingContext2D): void {
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.beginPath()
    ctx.ellipse(this.x, this.y + this.radius - 2, this.radius, this.radius * 0.4, 0, 0, Math.PI * 2)
    ctx.fill()

    if (!this.alive) {
      // 死亡：画半透明"灵"与重生倒计时圈
      const ratio = 1 - this.deadTimer / CONFIG.dummy.respawn
      ctx.strokeStyle = 'rgba(120,220,140,0.6)'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.arc(this.x, this.y, this.radius + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio)
      ctx.stroke()
      ctx.fillStyle = 'rgba(120,220,140,0.35)'
      ctx.beginPath()
      ctx.arc(this.x, this.y, 6, 0, Math.PI * 2)
      ctx.fill()
      return
    }

    // 史莱姆呼吸挤压
    const squish = Math.sin(this.phase) * 0.06
    const rx = this.radius * (1 + squish)
    const ry = this.radius * (1 - squish) * 0.86

    // 身体
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#55c25e'
    ctx.strokeStyle = '#2f7a38'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(this.x, this.y, rx, ry, 0, Math.PI, 0) // 上半穹顶
    ctx.lineTo(this.x + rx, this.y + ry * 0.35)
    ctx.ellipse(this.x, this.y + ry * 0.35, rx, ry * 0.45, 0, 0, Math.PI, true) // 软底
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // 高光
    if (this.flash <= 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.beginPath()
      ctx.ellipse(this.x - 5, this.y - 7, 4, 2.6, -0.5, 0, Math.PI * 2)
      ctx.fill()
    }

    // 眼睛
    ctx.fillStyle = '#152018'
    ctx.beginPath()
    ctx.arc(this.x - 5, this.y - 1, 2.4, 0, Math.PI * 2)
    ctx.arc(this.x + 5, this.y - 1, 2.4, 0, Math.PI * 2)
    ctx.fill()

    // 血条
    const w = 34
    const ratio = this.hp / this.maxHp
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(this.x - w / 2, this.y - this.radius - 12, w, 5)
    ctx.fillStyle = ratio > 0.35 ? '#6be07a' : '#ff6b5e'
    ctx.fillRect(this.x - w / 2 + 1, this.y - this.radius - 11, (w - 2) * ratio, 3)
  }
}
