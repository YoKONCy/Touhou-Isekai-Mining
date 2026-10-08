import { addItemCelStop } from '../../../itemArt'
import type { HeldWeaponView, WeaponMotionView } from '../../../types'
import { NUNCHAKU_VISUAL_SCALE } from './stats'

const clamp = (x: number): number => Math.max(0, Math.min(1, x))
const mix = (a: number, b: number, t: number): number => a + (b - a) * t
// 三段主手略加宽后引和扫出幅度，配合 90 度攻击域；自由棍仍由物理牵引。
const arms = [
  [-.38, -1.48, 1.00, -.38],
  [.34, 1.34, -1.04, .34],
  [-.42, -1.92, .84, -.42]
]
export function nunchakuArm(v: WeaponMotionView): number {
  const arm = arms[v.segment % 3]
  const phase = v.phase === 'windup' ? 0 : v.phase === 'active' ? 1 : 2
  const duration = phase === 0 ? v.move.windup : phase === 1 ? v.move.active : v.move.recover
  const p = clamp(1 - v.timer / duration)
  const t = phase === 1 ? 1 - Math.pow(1 - p, 2) : p * p * (3 - 2 * p)
  // 收招时保留轻微的腕部回弹，让链棍自然带出余势。
  const recoil = phase === 2 ? Math.sign(arm[2] - arm[1]) * .06 * Math.sin(p * Math.PI) : 0
  return v.aim + mix(arm[phase], arm[phase + 1], t) + recoil
}

export function drawNunchakuRod(ctx: CanvasRenderingContext2D): void {
  ctx.save(); ctx.scale(NUNCHAKU_VISUAL_SCALE, NUNCHAKU_VISUAL_SCALE)
  const g = ctx.createLinearGradient(0, -2.1, 0, 2.1)
  addItemCelStop(g, 0, '#b1936d'); addItemCelStop(g, .3, '#7c5a41'); addItemCelStop(g, .65, '#51382e'); addItemCelStop(g, 1, '#2c2223')
  ctx.fillStyle = g; ctx.strokeStyle = '#271e1f'; ctx.lineWidth = .7
  ctx.beginPath(); ctx.roundRect(0, -2.1, 19, 4.2, .8); ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#6c6f71'; ctx.fillRect(0, -2.1, 2, 4.2); ctx.fillRect(17, -2.1, 2, 4.2)
  ctx.fillStyle = '#c5ba95'; ctx.fillRect(.3, -2, 1.4, .6); ctx.fillRect(17.3, -2, 1.4, .6)
  ctx.strokeStyle = '#b0926b'; ctx.lineWidth = .5
  for (let i = 6; i <= 12; i += 2) { ctx.beginPath(); ctx.moveTo(i, -1.8); ctx.lineTo(i + .7, 1.8); ctx.stroke() }
  ctx.restore()
}

/** 近棍固定在手心，链根与放大后的物理端点一致。 */
export function drawNunchaku(ctx: CanvasRenderingContext2D, _v: HeldWeaponView): void {
  ctx.save(); ctx.translate(-9 * NUNCHAKU_VISUAL_SCALE, 0); drawNunchakuRod(ctx); ctx.restore()
}
