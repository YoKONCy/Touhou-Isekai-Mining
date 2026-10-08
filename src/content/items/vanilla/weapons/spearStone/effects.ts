import type { WeaponTrailView } from '../../../types'
import { stats } from './stats'

const FRAMES = 14
export const SPEAR_TRAIL_DURATION = .20
let frames: HTMLCanvasElement[] | null = null

/** 突刺只留细长平行风痕和石尖残影，不用挥砍的扇面或整条实心白框。 */
function buildFrames(): HTMLCanvasElement[] {
  return Array.from({ length: FRAMES }, (_, index) => {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64
    const g = canvas.getContext('2d')!; g.translate(8, 32)
    const age = index / (FRAMES - 1)
    const progress = Math.min(1, age * SPEAR_TRAIL_DURATION / stats.melee.active)
    const extension = 1 - Math.pow(1 - progress, 3)
    const scale = stats.melee.reach / 120, start = 54 * scale
    const tip = start + (stats.melee.reach - start) * extension
    const fade = Math.sin(Math.min(1, age / .14) * Math.PI / 2) * Math.pow(1 - age, .8)
    g.lineCap = 'round'
    for (let track = 0; track < 3; track++) {
      const side = track === 0 ? -5 : track === 1 ? 4 : 0
      g.globalAlpha = fade * (track === 2 ? .34 : .52)
      g.strokeStyle = track === 2 ? '#dfdcc6' : '#b8b6a0'; g.lineWidth = track === 2 ? 1.6 : .8
      g.beginPath(); g.moveTo((20 + track * 8) * scale, side)
      g.bezierCurveTo(48 * scale, side + .5, tip - 28 * scale, side - .5, tip - (4 + track * 3) * scale, side); g.stroke()
    }
    // 两片断面残影跟随前冲，不扩展伤害矩形的宽度。
    for (let ghost = 0; ghost < 2; ghost++) {
      const x = tip - ghost * 15 * scale
      g.globalAlpha = fade * (.28 - ghost * .09); g.fillStyle = ghost ? '#8f9985' : '#c5c7b2'
      g.beginPath(); g.moveTo(x - 18 * scale, -4); g.lineTo(x - 10 * scale, -5); g.lineTo(x, 0)
      g.lineTo(x - 13 * scale, 4); g.lineTo(x - 17 * scale, 2); g.closePath(); g.fill()
    }
    g.globalAlpha = fade * .45; g.strokeStyle = '#e0d9b8'; g.lineWidth = .6
    for (let speck = 0; speck < 3; speck++) {
      const x = tip - (16 + speck * 18) * scale, y = (speck % 2 ? 1 : -1) * (7 + age * 4)
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - (5 + age * 4) * scale, y); g.stroke()
    }
    return canvas
  })
}

export function drawSpearTrail(ctx: CanvasRenderingContext2D, view: WeaponTrailView): void {
  frames ??= buildFrames()
  const index = Math.min(FRAMES - 1, Math.max(0, Math.floor(view.age / SPEAR_TRAIL_DURATION * FRAMES)))
  ctx.save(); ctx.translate(view.x, view.y); ctx.rotate(view.angle)
  ctx.drawImage(frames[index], -8, -32); ctx.restore()
}
