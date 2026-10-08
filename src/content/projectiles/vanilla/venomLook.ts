/** 毒液弹共享湿润材质：直射梭滴与环射囊珠分别构图，不增加粒子实体。 */
import type { BulletRenderer } from '../types'

export interface VenomLookColors {
  /** 外缘透光颜色 */
  glow: string
  /** 毒液本体色 */
  body: string
  /** 内核与描边色 */
  edge: string
}

export function venomBulletLook(colors: VenomLookColors, shape: 'drop' | 'pearl' = 'pearl'): BulletRenderer {
  return ({ ctx, x, y, r, phase, angle }) => {
    ctx.save(); ctx.translate(x, y)
    const wobble = Math.sin(phase) * .055
    if (shape === 'drop') ctx.rotate(angle)
    // 碰撞中心始终留在饱满头部；拖滴只是视觉尾迹。
    if (shape === 'drop') {
      for (let i = 0; i < 2; i++) {
        ctx.fillStyle = i ? colors.glow : 'rgba(131,193,70,.42)'
        ctx.beginPath(); ctx.ellipse(-r * (1.65 + i * .75), Math.sin(phase + i) * .7, r * (.23 - i * .06), r * (.17 - i * .04), 0, 0, Math.PI * 2); ctx.fill()
      }
    }
    const outline = (): void => {
      ctx.beginPath()
      if (shape === 'drop') {
        ctx.moveTo(-r * 1.55, 0)
        ctx.bezierCurveTo(-r * .45, -r * .32, -r * .55, -r * .92, r * .15, -r * .88)
        ctx.bezierCurveTo(r * 1.24, -r * .81, r * 1.24, r * .78, r * .18, r * .9)
        ctx.bezierCurveTo(-r * .55, r * .95, -r * .65, r * .27, -r * 1.55, 0)
      } else {
        for (let i = 0; i < 20; i++) {
          const a = i / 20 * Math.PI * 2
          const radius = r * (1 + .035 * Math.sin(a * 3 + phase))
          const px = Math.cos(a) * radius * (1 + wobble), py = Math.sin(a) * radius / (1 + wobble)
          if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py)
        }
      }
      ctx.closePath()
    }
    outline(); ctx.strokeStyle = colors.glow; ctx.lineWidth = 3.2; ctx.stroke()
    ctx.fillStyle = colors.body; ctx.fill(); ctx.strokeStyle = colors.edge; ctx.lineWidth = 1.1; ctx.stroke()
    ctx.save(); outline(); ctx.clip()
    ctx.fillStyle = 'rgba(29,78,23,.42)'
    ctx.beginPath(); ctx.ellipse(r * .16, r * .22, r * .65, r * .57, .3, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(200,242,111,.56)'
    ctx.beginPath(); ctx.ellipse(-r * .24, -r * .27, r * .47, r * .3, -.5, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#d6f399'; ctx.lineWidth = .9
    ctx.beginPath(); ctx.ellipse(0, 0, r * .85, r * .81, 0, -.7, .9); ctx.stroke()
    ctx.fillStyle = 'rgba(245,255,204,.85)'
    ctx.beginPath(); ctx.ellipse(-r * .3, -r * .4, r * .22, r * .1, -.5, 0, Math.PI * 2); ctx.fill()
    if (shape === 'pearl') {
      ctx.fillStyle = 'rgba(34,85,21,.48)'; ctx.beginPath(); ctx.arc(r * .14, r * .15, r * .24, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore(); ctx.restore()
  }
}
