import type { WeaponTrailView } from '../../../types'
import { BROADSWORD_ARC, BROADSWORD_REACH } from './stats'
import { broadswordDirection, broadswordSweep } from './motion'
import { drawSteelBroadsword } from './appearance'

export const BROADSWORD_TRAIL_DURATION = .42
/** 宽而低饱和的扫刃弧配合三道实体刀影，强化翻滚的一击呈现淡暖色刃沿。 */
export function drawBroadswordTrail(g: CanvasRenderingContext2D, view: WeaponTrailView): void {
  const p = Math.max(0, Math.min(1, view.age / Math.max(.001, view.activeDuration ?? .3)))
  const fade = Math.min(1, view.age / .025) * Math.pow(Math.max(0, 1 - view.age / BROADSWORD_TRAIL_DURATION), 1.4)
  if (fade <= 0) return
  const dir = broadswordDirection(view.segment), progress = broadswordSweep(p)
  const tip = dir * (-BROADSWORD_ARC + BROADSWORD_ARC * 2 * progress)
  const begin = tip - dir * Math.min(BROADSWORD_ARC * 2 * progress, 1.4)
  g.save(); g.translate(view.x, view.y - 5); g.rotate(view.angle)
  for (let layer = 0; layer < 2; layer++) {
    const radius = BROADSWORD_REACH - 4 - layer * 12, width = layer === 0 ? 11 : 5
    g.beginPath(); g.arc(0, 0, radius, begin, tip, dir < 0); g.arc(0, 0, radius - width, tip, begin, dir > 0); g.closePath()
    g.globalAlpha = fade * (layer === 0 ? .2 : .075); g.fillStyle = view.empowered ? '#c9bd95' : '#99b0b8'; g.fill()
    g.beginPath(); g.arc(0, 0, radius, begin, tip, dir < 0); g.globalAlpha = fade * (layer === 0 ? .6 : .2)
    g.strokeStyle = view.empowered ? '#f0dab0' : '#e1e7df'; g.lineWidth = layer === 0 ? 1.1 : .65; g.stroke()
  }
  for (let i = 0; i < 3; i++) {
    const lag = .06 + i * .07, previous = Math.max(0, p - lag)
    if (p <= lag) continue
    g.save(); g.rotate(dir * (-BROADSWORD_ARC + BROADSWORD_ARC * 2 * broadswordSweep(previous))); g.translate(5, -2)
    g.globalAlpha = fade * (.16 - i * .04); drawSteelBroadsword(g); g.restore()
  }
  g.restore()
}
