import type { WeaponTrailView } from '../../../types'
import { stats as ironSword } from '../swordIron/stats'

/** 窄月牙刀光随左右斩反向展开，不使用逐帧阴影模糊。 */
export function drawUchigatanaTrail(g: CanvasRenderingContext2D, v: WeaponTrailView): void {
  const p = Math.max(0, Math.min(1, v.age / Math.max(.001, v.activeDuration ?? .15)))
  const fade = Math.min(1, v.age / .008) * Math.max(0, 1 - v.age / .22)
  if (fade <= 0) return
  const direction = v.segment % 2 === 0 ? 1 : -1, arc = ironSword.melee.arc ?? 1.25
  const swept = arc * 2 * p, tip = -direction * arc + direction * swept
  const tail = tip - direction * Math.min(.65, swept)
  g.save(); g.translate(v.x, v.y - 5); g.rotate(v.angle); g.globalAlpha *= fade
  g.fillStyle = '#bacbd34a'; g.beginPath(); g.arc(0, 0, 82, tail, tip, direction < 0)
  g.arc(0, 0, 77, tip, tail, direction > 0); g.closePath(); g.fill()
  g.strokeStyle = '#edf0df'; g.lineWidth = 1.1; g.beginPath(); g.arc(0, 0, 82, tail, tip, direction < 0); g.stroke()
  g.restore()
}
