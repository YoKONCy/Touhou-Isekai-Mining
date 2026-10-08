import type { WeaponTrailView, WeaponChargeView } from '../../../types'
import { DUAL_REACH, DUAL_ARC } from './stats'
import { dualSweep, dualSpin } from './motion'
import { drawDualBlade } from './appearance'

export const DUAL_TRAIL_DURATION = .2
/** 刺击留纵向刀影，旋斩留下两条错位的整圈轨迹，单挥保留急促窄亮边。 */
export function drawDualTrail(g: CanvasRenderingContext2D, v: WeaponTrailView): void {
  const p = Math.min(1, Math.max(0, v.age / Math.max(.001, v.activeDuration ?? .12)))
  const fade = Math.min(1, v.age / .008) * Math.pow(Math.max(0, 1 - v.age / DUAL_TRAIL_DURATION), 1.4)
  if (fade <= 0) return
  g.save(); g.translate(v.x, v.y - 5); g.rotate(v.angle)
  if (v.burst) {
    const side = v.segment % 2 === 0 ? -4 : 4, push = Math.sin(Math.min(1, p / .82) * Math.PI)
    for (let i = 0; i < 3; i++) {
      g.save(); g.translate(8 + push * 11 - i * 5, side); g.globalAlpha *= fade * (.27 - i * .06); drawDualBlade(g); g.restore()
    }
    g.globalAlpha *= fade * .7; g.strokeStyle = '#edf1da'; g.lineWidth = .9
    g.beginPath(); g.moveTo(28, side); g.lineTo(60 + push * 8, side); g.stroke(); g.restore(); return
  }
  const seg = v.segment % 3, spin = seg === 2, blades = spin ? 2 : 1, direction = seg === 1 ? -1 : 1
  for (let blade = 0; blade < blades; blade++) {
    const start = spin ? .48 + blade * Math.PI : -direction * DUAL_ARC * 1.12
    const swept = spin ? Math.PI * 2 * dualSpin(p) : DUAL_ARC * 2.24 * dualSweep(p)
    const tip = start + direction * swept, begin = tip - direction * Math.min(spin ? 1.65 : .85, swept), radius = DUAL_REACH - 2 - blade * 5
    g.save(); g.globalAlpha *= fade * (spin ? .2 : .23); g.fillStyle = '#a9c8ca'
    g.beginPath(); g.arc(0, 0, radius, begin, tip, direction < 0); g.arc(0, 0, radius - 6, tip, begin, direction > 0); g.closePath(); g.fill()
    g.globalAlpha = fade * .7; g.strokeStyle = '#eff0da'; g.lineWidth = 1
    g.beginPath(); g.arc(0, 0, radius, begin, tip, direction < 0); g.stroke(); g.restore()
    for (let i = 0; i < 3; i++) {
      const lag = .045 + i * .075
      if (p <= lag) continue
      const prior = start + direction * (spin ? Math.PI * 2 * dualSpin(p - lag) : DUAL_ARC * 2.24 * dualSweep(p - lag))
      g.save(); g.rotate(prior); g.translate(16, blade ? -4 : 4); g.globalAlpha *= fade * (.25 - i * .06); drawDualBlade(g); g.restore()
    }
  }
  g.restore()
}
/** 聚气围绕身侧收拢，进度条挂在脚下，冷却条使用更暗的青灰色。 */
export function drawDualCharge(g: CanvasRenderingContext2D, v: WeaponChargeView): void {
  if (v.layer === 'behind') {
    if (!v.charging && (v.readyAge < 0 || v.readyAge > .5)) return
    const full = v.progress >= 1 - 1e-8 || !v.charging && v.readyAge >= 0
    const pulse = v.charging && full ? (v.time * 1.4) % 1 : v.readyAge >= 0 ? Math.min(1, v.readyAge / .5) : v.progress
    g.save(); g.translate(v.x, v.y - 6); g.strokeStyle = '#dfeee5'; g.lineCap = 'round'
    for (let i = 0; i < 8; i++) {
      const phase = (pulse + i * .127) % 1, radius = 7 + 24 * (1 - phase), angle = i * Math.PI / 4 + phase * .18
      g.globalAlpha = Math.sin(phase * Math.PI) * (full ? .42 : .18 * v.progress); g.lineWidth = full ? 1.4 : .8
      g.beginPath(); g.moveTo(Math.cos(angle + .04) * (radius + 8), Math.sin(angle + .04) * (radius + 8) * .8)
      g.quadraticCurveTo(Math.cos(angle) * (radius + 3), Math.sin(angle) * (radius + 3) * .8, Math.cos(angle) * radius, Math.sin(angle) * radius * .8); g.stroke()
    }
    g.restore(); return
  }
  const cooldown = v.cooldown ?? 0
  if (!v.charging && cooldown <= 0) return
  g.save(); const x = v.x - 21, y = v.y + 23
  const bar = (by: number, progress: number, color: string) => {
    g.fillStyle = '#1d2327ed'; g.strokeStyle = '#91a7a0'; g.lineWidth = .6
    g.beginPath(); g.roundRect(x - 1.5, by - 1.5, 43, 7, 1.5); g.fill(); g.stroke()
    g.fillStyle = color; g.fillRect(x, by, 40 * Math.max(0, Math.min(1, progress)), 4)
    g.fillStyle = '#edf4df55'; g.fillRect(x, by, 40 * Math.max(0, Math.min(1, progress)), 1)
  }
  if (v.charging) bar(y, v.progress, v.progress >= 1 - 1e-8 ? '#f1eed8' : '#9bbdab')
  if (cooldown > 0) {
    bar(y + (v.charging ? 10 : 0), 1 - cooldown / (v.maxCooldown ?? 2.5), '#6c939a')
  }
  g.restore()
}
