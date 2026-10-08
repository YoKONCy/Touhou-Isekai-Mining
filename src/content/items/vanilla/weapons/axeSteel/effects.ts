import type { WeaponTrailView, WeaponChargeView } from '../../../types'
import { AXE_ARC, AXE_REACH } from './stats'
import { axeDirection, axeSweep, axeSpin } from './motion'
import { drawAxeHead } from './appearance'

export const AXE_TRAIL_DURATION = .42
/** 残影仅取斧头端；内圈的柄和握柄不复制，也不铺满整个攻击扇面。 */
export function drawAxeTrail(g: CanvasRenderingContext2D, v: WeaponTrailView): void {
  const p = Math.max(0, Math.min(1, v.age / Math.max(.001, v.activeDuration ?? .3)))
  const fade = Math.min(1, v.age / .025) * Math.pow(Math.max(0, 1 - v.age / AXE_TRAIL_DURATION), 1.5)
  if (fade <= 0) return
  const dir = axeDirection(v.segment), spin = (v.chargePower ?? 1) > 1
  const base = spin ? (v.startAngle ?? v.angle) - v.angle : -dir * AXE_ARC
  const sweep = (spin ? Math.PI * 2 * axeSpin(p) : AXE_ARC * 2 * axeSweep(p))
  const tip = base + dir * sweep, start = tip - dir * Math.min(sweep, spin ? 2.05 : 1.05)
  g.save(); g.translate(v.x, v.y - 5); g.rotate(v.angle)
  g.beginPath(); g.arc(0, 0, AXE_REACH - 1, start, tip, dir < 0); g.arc(0, 0, 67, tip, start, dir > 0); g.closePath()
  g.globalAlpha *= fade * (v.empowered ? .24 : .15); g.fillStyle = v.empowered ? '#dcc28a' : '#a9bec3'; g.fill()
  g.restore(); g.save(); g.translate(v.x, v.y - 5); g.rotate(v.angle)
  g.globalAlpha *= fade * .48; g.strokeStyle = v.empowered ? '#f7d998' : '#e1e4d7'; g.lineWidth = v.empowered ? 1.5 : 1
  g.beginPath(); g.arc(0, 0, AXE_REACH - 1, start, tip, dir < 0); g.stroke()
  for (let i = 0; i < 3; i++) {
    const lag = .045 + i * .06
    if (p <= lag) continue
    const previous = spin ? Math.PI * 2 * axeSpin(p - lag) : AXE_ARC * 2 * axeSweep(p - lag)
    g.save(); g.rotate(base + dir * previous); g.translate(4, 0)
    g.globalAlpha *= .36 - i * .08; drawAxeHead(g); g.restore()
  }
  g.restore()
}

/** 体侧白气从外向躯干收束，短促一次，不用整屏闪光替代蓄满反馈。 */
export function drawAxeCharge(g: CanvasRenderingContext2D, v: WeaponChargeView): void {
  if (v.layer === 'behind') {
    if (v.readyAge < 0 || v.readyAge >= .55) return
    g.save(); g.translate(v.x, v.y - 7); g.lineCap = 'round'
    for (let i = 0; i < 9; i++) {
      const age = v.readyAge - i % 3 * .014
      if (age < 0) continue
      const p = Math.min(1, age / .46), fade = Math.sin(p * Math.PI) * .53
      const angle = i * Math.PI * 2 / 9 + i % 2 * .16
      const radius = 4 + (36 + i % 3 * 4) * Math.pow(1 - p, 1.4), tail = radius + (12 + i % 2 * 4) * (1 - p)
      g.globalAlpha = fade; g.strokeStyle = '#edf6f4'; g.lineWidth = 1 + (1 - p) * 1.6
      g.beginPath(); g.moveTo(Math.cos(angle + .025) * tail, Math.sin(angle + .025) * tail * .76)
      g.quadraticCurveTo(Math.cos(angle - .045) * (radius + 7), Math.sin(angle - .045) * (radius + 7) * .76, Math.cos(angle) * radius, Math.sin(angle) * radius * .76); g.stroke()
      g.globalAlpha = fade * .22; g.lineWidth = 4.5; g.stroke()
    }
    g.restore(); return
  }
  if (!v.charging) return
  const full = v.progress >= 1 - 1e-8, x = v.x - 21, y = v.y + 23
  g.save(); g.fillStyle = '#201d20e8'; g.strokeStyle = full ? '#eee5c1' : '#95815a'; g.lineWidth = .65
  g.beginPath(); g.roundRect(x - 2, y - 2, 44, 9, 1.5); g.fill(); g.stroke()
  // 两段各占半档，中央留缝，跨过第一段便可发动旋斩。
  for (let i = 0; i < 2; i++) {
    const bx = x + i * 21, fill = Math.max(0, Math.min(1, v.progress * 2 - i))
    g.fillStyle = '#66513f66'; g.fillRect(bx, y, 19, 5)
    if (fill > 0) {
      g.fillStyle = full ? '#f2edce' : i === 0 ? '#c3a15f' : '#ddd09c'; g.fillRect(bx, y, 19 * fill, 5)
      g.fillStyle = '#fff8d180'; g.fillRect(bx, y, 19 * fill, 1)
    }
  }
  g.restore()
}
