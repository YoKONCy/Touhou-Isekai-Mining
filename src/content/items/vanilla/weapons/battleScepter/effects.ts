import type { WeaponTrailView, WeaponImpactView } from '../../../types'
import { drawBattleScepter } from './appearance'
import { clamp, scepterSpinAngle, scepterSlamDrop, scepterSlamAngle } from './motion'
import { staffSweep } from '../staffWood/motion'
import { stats } from './stats'

/** 薄风痕和实体棍影共用四段节拍，不使用遮住人物的大块发光扇面。 */
export function drawScepterTrail(g: CanvasRenderingContext2D, v: WeaponTrailView): void {
  const p = clamp(v.age / Math.max(.001, v.activeDuration ?? .12))
  const fade = Math.min(1, v.age / .012) * Math.pow(Math.max(0, 1 - v.age / .22), 1.4)
  if (fade <= 0) return
  g.save(); g.translate(v.x, v.y - 6); g.lineCap = 'round'
  if (v.segment === 3) {
    const angle = scepterSlamAngle(v.angle, scepterSlamDrop(p))
    const before = scepterSlamAngle(v.angle, scepterSlamDrop(Math.max(0, p - .3)))
    g.globalAlpha = fade * .52; g.strokeStyle = '#b3a4a0'; g.lineWidth = 1.6
    g.beginPath(); g.arc(0, 0, 82, before, angle, angle < before); g.stroke()
    for (let i = 1; i <= 2; i++) {
      if (p < i * .07) continue
      const prior = scepterSlamAngle(v.angle, scepterSlamDrop(p - i * .07))
      g.save(); g.rotate(prior); g.translate(26, 0); g.globalAlpha = fade * (.21 - i * .055)
      drawBattleScepter(g, {}); g.restore()
    }
  } else if (v.segment === 2) {
    const start = scepterSpinAngle(v.angle, (v.strikeIndex ?? 0) / 6)
    const tip = scepterSpinAngle(v.angle, ((v.strikeIndex ?? 0) + p) / 6)
    for (let end = 0; end < 2; end++) {
      const offset = end * Math.PI
      g.globalAlpha = fade * .42; g.strokeStyle = end ? '#8e7e86' : '#c2b0a3'; g.lineWidth = 1.4
      g.beginPath(); g.arc(0, 0, 60 + end * 3, Math.max(start, tip - 1.8) + offset, tip + offset); g.stroke()
    }
    for (let i = 1; i <= 2; i++) {
      g.save(); g.rotate(tip - i * .22); g.globalAlpha = fade * (.17 - i * .04)
      drawBattleScepter(g, {}); g.restore()
    }
  } else {
    const direction = v.segment === 0 ? 1 : -1, arc = stats.melee.arc ?? 0
    const tip = v.angle + direction * (-arc + arc * 2 * staffSweep(v.segment, p))
    const span = Math.min(arc * 2 * staffSweep(v.segment, p), 1.5)
    for (let track = 0; track < 2; track++) {
      g.globalAlpha = fade * (track ? .23 : .4); g.strokeStyle = track ? '#806d68' : '#c6b4a3'; g.lineWidth = track ? 1 : 1.8
      g.beginPath(); g.arc(0, 0, 80 - track * 13, tip - direction * span, tip, direction < 0); g.stroke()
    }
    for (let i = 1; i <= 2; i++) {
      if (p < i * .08) continue
      const angle = v.angle + direction * (-arc + arc * 2 * staffSweep(v.segment, p - i * .08))
      g.save(); g.rotate(angle); g.globalAlpha = fade * (.2 - i * .055)
      drawBattleScepter(g, {}); g.restore()
    }
  }
  g.restore()
}

let crater: HTMLCanvasElement | null = null
/** 裂纹与碎石静态烘焙，触地后的短尘浪另绘；不会向战场追加实体。 */
function craterSprite(): HTMLCanvasElement {
  if (crater) return crater
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 80
  const g = canvas.getContext('2d')!; g.scale(2, 2); g.translate(32, 20); g.lineCap = 'round'
  g.fillStyle = '#211d254d'; g.beginPath(); g.ellipse(0, 0, 14, 5, 0, 0, Math.PI * 2); g.fill()
  for (let i = 0; i < 9; i++) {
    const angle = i * Math.PI * 2 / 9, length = 10 + i % 3 * 4
    const x = Math.cos(angle) * length, y = Math.sin(angle) * length * .43
    g.strokeStyle = '#29232b'; g.lineWidth = 1.5
    g.beginPath(); g.moveTo(Math.cos(angle) * 3, Math.sin(angle) * 1.2)
    g.lineTo(x * .55 + (i % 2 ? 1.5 : -1.5), y * .55); g.lineTo(x, y); g.stroke()
    g.strokeStyle = '#b4a08b88'; g.lineWidth = .45
    g.beginPath(); g.moveTo(x * .55, y * .55 + 1); g.lineTo(x, y + .7); g.stroke()
    g.fillStyle = i % 2 ? '#7d7169' : '#514851'; g.fillRect(x - 1.4, y - .6, 2.8, 1.7)
  }
  crater = canvas
  return canvas
}

export function drawScepterImpact(g: CanvasRenderingContext2D, v: WeaponImpactView): void {
  const age = Math.max(0, v.age), distance = v.move.reach - 10, fade = Math.pow(Math.max(0, 1 - age / .7), 1.3)
  g.save(); g.translate(v.x + Math.cos(v.angle) * distance, v.y + Math.sin(v.angle) * distance)
  g.globalAlpha = fade; g.drawImage(craterSprite(), -32, -20, 64, 40)
  if (age < .3) {
    const p = age / .3, radius = 8 + 24 * p
    g.globalAlpha = (1 - p) * .32; g.strokeStyle = '#c8b49a'; g.lineWidth = 1.5 * (1 - p) + .3
    g.beginPath(); g.ellipse(0, 0, radius, radius * .4, 0, 0, Math.PI * 2); g.stroke()
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI / 5, r = (6 + i % 3 * 3) + p * 18
      const x = Math.cos(angle) * r, y = Math.sin(angle) * r * .43 - Math.sin(p * Math.PI) * (4 + i % 3 * 2)
      g.globalAlpha = (1 - p) * .55; g.fillStyle = i % 2 ? '#b09b81' : '#7e7066'; g.fillRect(x, y, 2 + i % 2, 1.5)
    }
  }
  if (age < .055) {
    g.globalAlpha = (1 - age / .055) * .4; g.fillStyle = '#e2d0b4'
    g.beginPath(); g.ellipse(0, 0, 11, 3.7, 0, 0, Math.PI * 2); g.fill()
  }
  g.restore()
}
