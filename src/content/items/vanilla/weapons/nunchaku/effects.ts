import type { WeaponTrailView } from '../../../types'
import { stats } from './stats'
import { drawNunchakuRod } from './motion'

/** 左右短棍各留窄风痕，脚踢仅在脚前保留短促气流，不再出现甩棍的假残影。 */
export function drawNunchakuTrail(g: CanvasRenderingContext2D, v: WeaponTrailView): void {
  const p = Math.max(0, Math.min(1, v.age / Math.max(.001, v.activeDuration ?? .18)))
  const fade = Math.min(1, v.age / .012) * Math.pow(Math.max(0, 1 - v.age / .2), 1.4)
  if (fade <= 0) return
  g.save(); g.translate(v.x, v.y + (v.segment === 2 ? 8 : -5)); g.rotate(v.angle); g.lineCap = 'round'
  if (v.segment === 2) {
    if (p >= .12 && p <= .92) {
      const kick = Math.min(1, p / .24)
      for (let i = 0; i < 3; i++) {
        const offset = (i - 1) * 2.6
        g.globalAlpha = fade * .5 * (1 - Math.abs(p - .4))
        g.strokeStyle = i === 1 ? '#e0d7c1' : '#a99e8e'; g.lineWidth = i === 1 ? 1.15 : .6
        g.beginPath(); g.moveTo(11 + kick * 5, offset); g.lineTo(21 + kick * 10 - i, offset * .6); g.stroke()
      }
    }
  } else {
    const direction = v.segment === 0 ? 1 : -1, arc = stats.melee.arc ?? Math.PI / 3
    const sweep = p * p * (3 - 2 * p), tip = direction * (-arc + arc * 2 * sweep)
    const tail = tip - direction * Math.min(1, arc * 2 * sweep)
    g.globalAlpha = fade * .42; g.strokeStyle = '#cdb68c'; g.lineWidth = 1.1
    g.beginPath(); g.arc(0, 0, 46, tail, tip, direction < 0); g.stroke()
    for (let i = 1; i <= 2; i++) {
      if (p < i * .07) continue
      g.save(); g.rotate(tip - direction * i * .16); g.translate(17, 0)
      g.globalAlpha = fade * (.18 - i * .045); drawNunchakuRod(g); g.restore()
    }
  }
  g.restore()
}
