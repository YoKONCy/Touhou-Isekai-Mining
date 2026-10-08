import { CONFIG } from './config'
import { findItemDef, type ItemId } from '../shared/itemDefs'
import type { Collider, TileMap } from './tilemap'

/**
 * 地面掉落物
 * 生命周期：burst 崩落抛射（受瓦片碰撞）→ rest 落地浮动+光柱
 *          → magnet 玩家靠近被吸走 → 贴身请求拾取
 *
 * 拾取两步确认（批次 C）：贴身时 update 返回 true 只代表"请求入包"，
 * 背包满了由房间层调用 reject() 把物品弹回，杜绝凭空吞物。
 */

type DropPhase = 'burst' | 'rest' | 'magnet'

interface CollectorLike {
  x: number
  y: number
  half: number
  alive: boolean
}

export class Drop implements Collider {
  readonly itemId: ItemId
  x: number
  y: number
  vx: number
  vy: number
  readonly r = CONFIG.drop.radius

  private phase: DropPhase = 'burst'
  private age = 0
  /** 满包弹开后的短暂冷却（期间不再磁吸，避免物品贴着玩家疯狂抖动） */
  private rejectCd = 0
  /** 浮动动画相位（每个掉落物错峰） */
  private bob: number
  private collected = false

  constructor(x: number, y: number, itemId: ItemId) {
    this.x = x
    this.y = y
    this.itemId = itemId
    // 崩落瞬间随机方向散开
    const a = Math.random() * Math.PI * 2
    const sp = CONFIG.drop.burstSpeed * (0.4 + Math.random() * 0.6)
    this.vx = Math.cos(a) * sp
    this.vy = Math.sin(a) * sp
    this.bob = Math.random() * Math.PI * 2
  }

  get isCollected(): boolean {
    return this.collected
  }

  /** 房间层确认入包成功 */
  confirm(): void {
    this.collected = true
  }

  /** 背包已满：从玩家身边弹开，短暂拒绝磁吸 */
  reject(fromX: number, fromY: number): void {
    const a = Math.atan2(this.y - fromY, this.x - fromX)
    this.vx = Math.cos(a) * 220
    this.vy = Math.sin(a) * 220
    this.phase = 'burst'
    this.age = 0
    this.rejectCd = 0.6
  }

  /**
   * @returns true 表示本帧贴身请求拾取（场景查背包后 confirm/reject）
   */
  update(dt: number, map: TileMap, player: CollectorLike): boolean {
    const d = CONFIG.drop
    this.age += dt
    this.bob += dt * 4
    this.rejectCd = Math.max(0, this.rejectCd - dt)

    if (this.phase === 'burst') {
      // 抛射段：摩擦减速 + 瓦片碰撞，防止碎块飞出矿洞/穿进墙里
      const k = Math.exp(-d.friction * dt)
      this.vx *= k
      this.vy *= k
      const moved: Collider = { x: this.x, y: this.y, vx: this.vx, vy: this.vy, r: this.r }
      map.moveEntity(moved, dt)
      this.x = moved.x
      this.y = moved.y
      if (this.age >= d.burstTime) this.phase = 'rest'
      return false
    }

    // 落定后才允许磁吸（短延迟，让玩家看清掉了什么；弹回冷却内不吸）
    const canMagnet = this.age >= d.burstTime + d.magnetDelay && this.rejectCd <= 0
    const distP = Math.hypot(player.x - this.x, player.y - this.y)
    if (this.phase === 'rest' && canMagnet && player.alive && distP < d.magnetRange) {
      this.phase = 'magnet'
    }

    if (this.phase === 'magnet') {
      // 玩家死亡或主动拉开距离（被击退等）掉落物停下等待
      if (!player.alive || distP > d.magnetRange * 1.6) {
        this.phase = 'rest'
        return false
      }
      const a = Math.atan2(player.y - this.y, player.x - this.x)
      this.x += Math.cos(a) * d.magnetSpeed * dt
      this.y += Math.sin(a) * d.magnetSpeed * dt
      // 磁吸段短距离无视瓦片（矿碎在原地，最近的障碍只隔半格）
      if (distP < d.collectRange + player.half * 0.4) {
        return true
      }
    }
    return false
  }

  render(ctx: CanvasRenderingContext2D): void {
    // 物品可能来自已卸载 MOD：查表失败时用灰石占位外观，绝不炸
    const def = findItemDef(this.itemId)
    const color = def?.color ?? '#7d838c'
    const hi = def?.hi ?? '#aeb4bc'
    const tier = def?.tier ?? 1

    // 落定后的上下浮动；抛射/磁吸段不浮动
    const floating = this.phase === 'rest' ? Math.sin(this.bob) * 2.2 : 0
    const y = this.y + floating

    // 影子始终贴地
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.beginPath()
    ctx.ellipse(this.x, this.y + 6, this.r * 0.9, this.r * 0.36, 0, 0, Math.PI * 2)
    ctx.fill()

    // —— 光柱（落定后可见；tier 越高越亮越长） ——
    if (this.phase !== 'burst') {
      const beamH = 18 + tier * 6
      const grad = ctx.createLinearGradient(0, y - beamH, 0, y)
      grad.addColorStop(0, 'rgba(255,255,255,0)')
      grad.addColorStop(1, hi + '55')
      ctx.fillStyle = grad
      ctx.fillRect(this.x - 3, y - beamH, 6, beamH)
    }

    // —— 磁吸拖尾 ——
    if (this.phase === 'magnet') {
      ctx.fillStyle = hi + '66'
      ctx.beginPath()
      ctx.arc(this.x, this.y, this.r * 0.7, 0, Math.PI * 2)
      ctx.fill()
    }

    // 外观分派：物品自带地面绘制器（饭团等）优先，缺省走通用原石碎晶
    if (def?.ground) {
      def.ground({ ctx, x: this.x, y, r: this.r, phase: this.phase, bob: this.bob })
    } else {
      this.drawOreShard(ctx, y, color, hi, tier)
    }
  }

  /** 原石碎晶（材料类通用外观）：ink 描边 + 左暗右亮硬边切面 + 高档星芒 */
  private drawOreShard(
    ctx: CanvasRenderingContext2D,
    y: number,
    color: string,
    hi: string,
    tier: number
  ): void {
    const s = this.r
    ctx.save()
    ctx.translate(this.x, y)
    // 落定浮动时轻微摇摆（磁吸/抛射不转）
    if (this.phase === 'rest') ctx.rotate(Math.sin(this.bob * 0.5) * 0.12)
    ctx.lineJoin = 'round'
    // 原石轮廓（不规则六边形碎块）
    ctx.beginPath()
    ctx.moveTo(0, -s)
    ctx.lineTo(s * 0.75, -s * 0.25)
    ctx.lineTo(s * 0.7, s * 0.55)
    ctx.lineTo(0, s)
    ctx.lineTo(-s * 0.75, s * 0.4)
    ctx.lineTo(-s * 0.7, -s * 0.35)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
    // 左暗面（硬边色阶）
    ctx.save()
    ctx.clip()
    ctx.fillStyle = 'rgba(10,6,12,0.22)'
    ctx.beginPath()
    ctx.moveTo(0, -s)
    ctx.lineTo(-s * 0.7, -s * 0.35)
    ctx.lineTo(-s * 0.75, s * 0.4)
    ctx.lineTo(0, s)
    ctx.closePath()
    ctx.fill()
    // 右上迎光切面
    ctx.fillStyle = hi
    ctx.beginPath()
    ctx.moveTo(0, -s)
    ctx.lineTo(s * 0.75, -s * 0.25)
    ctx.lineTo(s * 0.32, -s * 0.02)
    ctx.lineTo(0, -s * 0.18)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    // ink 描边收口
    ctx.strokeStyle = '#241a12'
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.moveTo(0, -s)
    ctx.lineTo(s * 0.75, -s * 0.25)
    ctx.lineTo(s * 0.7, s * 0.55)
    ctx.lineTo(0, s)
    ctx.lineTo(-s * 0.75, s * 0.4)
    ctx.lineTo(-s * 0.7, -s * 0.35)
    ctx.closePath()
    ctx.stroke()

    // 高档矿的闪烁星芒（带柔光）
    if (tier >= 3) {
      const tw = 0.5 + 0.5 * Math.sin(this.bob * 1.7)
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      const g = ctx.createRadialGradient(2, -2, 0, 2, -2, 5)
      g.addColorStop(0, `rgba(255,248,200,${0.35 + tw * 0.3})`)
      g.addColorStop(1, 'rgba(255,248,200,0)')
      ctx.fillStyle = g
      ctx.fillRect(-3, -7, 10, 10)
      ctx.restore()
      ctx.fillStyle = `rgba(255,255,220,${0.6 + tw * 0.4})`
      ctx.fillRect(2, -2, 1.6, 1.6)
    }
    ctx.restore()
  }
}
