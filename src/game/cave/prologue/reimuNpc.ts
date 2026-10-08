/**
 * 灵梦 NPC 实体（序章 S9 灵梦房 / 基地）
 *
 * 形象：drawReimuRig 像素赛璐璐部件绘制器（与主角共用 PlayerAnimator），
 *   常态正面 idle（呼吸/眨眼/发摆）；charge 0→1 驱动梦想封印聚气演出：
 *   双臂向两侧斜上张开（宽白袖张开）＋身边红白结界环与绕身光粒。
 *
 * 注：本实体目前只播放 idle/施法；走路动画由 rig+animator 天然支持，
 *   未来灵梦作为同伴移动时喂 speed/moveAngle 即可，无需改绘制层。
 */
import { PlayerAnimator, type AnimInput } from '../../art/rig/playerAnims'
import { drawReimuRig } from '../../art/rig/reimuRig'

/** NPC 运行时句柄（导演持有；charge 0~1 驱动封印聚气演出） */
export interface ReimuNpc {
  readonly x: number
  readonly y: number
  /** 0=常态；>0=聚气进度（导演在封印段推进到 1） */
  charge: number
  /** 供 RoomRuntime y-sort 调用的绘制函数 */
  draw: (ctx: CanvasRenderingContext2D, time: number) => void
}

export function createReimuNpc(x: number, y: number): ReimuNpc {
  const animator = new PlayerAnimator()
  const npc: ReimuNpc = { x, y, charge: 0, draw: () => {} }
  let lastT: number | null = null
  let chargeGlow: HTMLCanvasElement | null = null

  const draw = (ctx: CanvasRenderingContext2D, time: number): void => {
    // 房间动画时钟差驱动动画机（首帧/切房回房时钟跳变时夹一下，防止姿态炸）
    const dt = lastT === null ? 0 : Math.max(0, Math.min(0.05, time - lastT))
    lastT = time

    // 灵梦序章固定正面朝镜头（红瞳+蝴蝶结正面最好辨认）；徒手不抱武器
    const input: AnimInput = { speed: 0, moveAngle: Math.PI / 2, aim: Math.PI / 2, armed: false }
    animator.update(dt, input)
    const pose = animator.build(Math.PI / 2)
    const c = npc.charge

    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.32)'
    ctx.beginPath()
    ctx.ellipse(x, y + 7, 13, 4.6, 0, 0, Math.PI * 2)
    ctx.fill()

    // 朱红结界在人物背后展开；暖白纸札与五色灵珠区别于黑血系施法。
    if (c > 0) {
      if (!chargeGlow) {
        chargeGlow = document.createElement('canvas')
        chargeGlow.width = chargeGlow.height = 192
        const g = chargeGlow.getContext('2d')!
        const glow = g.createRadialGradient(96, 96, 4, 96, 96, 94)
        glow.addColorStop(0, 'rgba(255,237,190,.65)')
        glow.addColorStop(.25, 'rgba(255,133,128,.3)')
        glow.addColorStop(.6, 'rgba(226,47,77,.12)')
        glow.addColorStop(1, 'rgba(226,47,77,0)')
        g.fillStyle = glow; g.fillRect(0, 0, 192, 192)
      }
      ctx.save()
      try {
        ctx.translate(x, y - 14)
        const radius = 30 + c * 78
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .35 + c * .4
        ctx.drawImage(chargeGlow, -radius * 1.4, -radius * 1.4, radius * 2.8, radius * 2.8)
        // 双向转动的破片结界，宽度、缺口与边缘起伏都不重复。
        for (let layer = 0; layer < 2; layer++) {
          for (let i = 0; i < 18; i++) {
            const a = i * Math.PI * 2 / 18 + time * (layer ? -.22 : .32)
            const r = radius * (layer ? .74 : 1) + Math.sin(i * 2.1) * 3
            const span = .16 + .055 * Math.sin(i * 1.7) ** 2
            ctx.beginPath()
            ctx.arc(0, 0, r, a, a + span)
            ctx.arc(0, 0, r - (layer ? 3 : 7), a + span, a, true)
            ctx.closePath(); ctx.fillStyle = layer ? '#ffe5b0' : '#d93754'; ctx.fill()
          }
        }
        // 交错方形封印骨架与破片环反向转动，形成分离的几何层次。
        ctx.strokeStyle = '#ffd7b1'; ctx.lineWidth = 1; ctx.globalAlpha = .3 + c * .35
        for (let layer = 0; layer < 2; layer++) {
          ctx.save(); ctx.rotate(time * (layer ? .16 : -.12) + layer * Math.PI / 4)
          const rr = radius * .52
          ctx.strokeRect(-rr, -rr, rr * 2, rr * 2); ctx.restore()
        }
        const colors = ['#ff7892', '#ffd786', '#91e9ed', '#bfa2ff', '#b7ed91']
        for (let i = 0; i < 10; i++) {
          const a = time * .65 + i * Math.PI * 2 / 10
          const rr = radius * (.82 + .04 * Math.sin(time * 2 + i))
          ctx.save(); ctx.translate(Math.cos(a) * rr, Math.sin(a) * rr * .82)
          ctx.rotate(a + Math.PI / 2)
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = .45 + c * .5
          if (i % 2 === 0) {
            ctx.fillStyle = '#f4e9ce'; ctx.fillRect(-3.5, -8, 7, 16)
            ctx.fillStyle = '#a92b42'; ctx.fillRect(-2, -5, 4, 2); ctx.fillRect(-1, -1, 2, 6)
          } else {
            const size = 5 + c * 5
            ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= .65
            ctx.drawImage(chargeGlow, -size * 3, -size * 3, size * 6, size * 6)
            ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = .9
            ctx.fillStyle = colors[(i - 1) / 2]
            ctx.beginPath(); ctx.ellipse(0, 0, size, size * .8, 0, 0, Math.PI * 2); ctx.fill()
            ctx.fillStyle = '#fff7e1'; ctx.beginPath(); ctx.ellipse(-size * .22, -size * .25, size * .32, size * .18, -.4, 0, Math.PI * 2); ctx.fill()
          }
          ctx.restore()
        }
      } finally { ctx.restore() }
    }

    // 聚气时身体轻微上浮（气息托起感）
    const lift = c * 1.6 + Math.sin(time * 2.2) * 0.4 * c
    drawReimuRig(ctx, x, y - lift, pose, { cast: c })
  }
  npc.draw = draw
  return npc
}
