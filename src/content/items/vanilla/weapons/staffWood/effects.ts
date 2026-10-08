import type { WeaponTrailView } from '../../../types'
import { staffSweep } from './motion'
import { stats } from './stats'
import { drawWoodStaff } from './appearance'

const SIZE = 192
const FRAMES = 18
export const STAFF_TRAIL_DURATION = .20
const frames: HTMLCanvasElement[][] = []

/** 两套短寿命拖尾独立缓存：淡棍身残影加两道细风痕，不盖住钝器轮廓。 */
function buildFrames(segment: number): HTMLCanvasElement[] {
  return Array.from({ length: FRAMES }, (_, index) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE
    const g = canvas.getContext('2d')!; g.translate(SIZE / 2, SIZE / 2)
    const age = index / (FRAMES - 1)
    const progress = Math.min(1, age * STAFF_TRAIL_DURATION / stats.melee.active)
    const sweep = staffSweep(segment, progress), direction = segment === 0 ? 1 : -1
    const arc = stats.melee.arc ?? 0
    const tip = direction * (-arc + arc * 2 * sweep)
    const span = Math.min(arc * 2, (segment === 0 ? .28 : .24) + sweep * .90)
    const fade = Math.sin(Math.min(1, age / .12) * Math.PI / 2) * Math.pow(1 - age, 1.35)
    const start = tip - direction * Math.min(span, arc * 2 * sweep)
    // 分层窄带不填满扇形中心，棍身与敌人轮廓仍然可见。
    for (let track = 0; track < 2; track++) {
      const radius = stats.melee.reach - 3 - track * 14
      const thickness = (track === 0 ? 3.5 : 2) * (segment === 0 ? 1 : .8)
      g.beginPath()
      for (let step = 0; step <= 12; step++) {
        const p = step / 12, angle = start + (tip - start) * p
        const r = radius + Math.sin(p * Math.PI) * thickness
        const x = Math.cos(angle) * r, y = Math.sin(angle) * r
        if (step === 0) g.moveTo(x, y); else g.lineTo(x, y)
      }
      for (let step = 12; step >= 0; step--) {
        const angle = start + (tip - start) * step / 12
        g.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
      }
      g.closePath(); g.globalAlpha = fade * (track === 0 ? .13 : .07)
      g.fillStyle = track === 0 ? '#dac69a' : '#ac997b'; g.fill()
      g.beginPath(); g.arc(0, 0, radius, start, tip, direction < 0)
      g.globalAlpha = fade * (track === 0 ? .38 : .18); g.strokeStyle = '#d5c29b'; g.lineWidth = track === 0 ? .8 : .5; g.stroke()
    }
    // 残影使用实际缩短后的棍身，并采样之前的挥动位置，不画虚假的长杆线。
    for (let ghost = 0; ghost < 2; ghost++) {
      const lag = ghost === 0 ? .12 : .24
      if (progress <= lag) continue
      const angle = direction * (-arc + arc * 2 * staffSweep(segment, progress - lag))
      g.save(); g.rotate(angle); g.translate(12, -4)
      g.globalAlpha = fade * (ghost === 0 ? .12 : .065)
      drawWoodStaff(g, {}); g.restore()
    }
    g.globalAlpha = fade * .22; g.strokeStyle = '#c7b38b'; g.lineWidth = .5
    for (let mark = 0; mark < 2; mark++) {
      const angle = tip - direction * (.10 + mark * .13), r = stats.melee.reach + 1 + age * 3
      g.beginPath(); g.moveTo(Math.cos(angle) * r, Math.sin(angle) * r)
      g.lineTo(Math.cos(angle - direction * .035) * (r + 3), Math.sin(angle - direction * .035) * (r + 3)); g.stroke()
    }
    return canvas
  })
}

export function drawStaffTrail(ctx: CanvasRenderingContext2D, view: WeaponTrailView): void {
  const segment = view.segment % 2
  frames[segment] ??= buildFrames(segment)
  const index = Math.min(FRAMES - 1, Math.max(0, Math.floor(view.age / STAFF_TRAIL_DURATION * FRAMES)))
  ctx.save(); ctx.translate(view.x, view.y); ctx.rotate(view.angle)
  ctx.drawImage(frames[segment][index], -SIZE / 2, -SIZE / 2); ctx.restore()
}
