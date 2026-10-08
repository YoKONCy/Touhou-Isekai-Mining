import type { EnemyAppearanceView } from '../types'
import { drawKedamaFur } from '../../../game/art/kedamaFur'

const TAU = Math.PI * 2
const furPaths = new Map<number, Path2D>()
/** 毛束轮廓采用错落卷曲的短绒，长丝毛只放在轮廓，避免满身尖刺。 */
export function furryOutline(r: number): Path2D {
  const cached = furPaths.get(r)
  if (cached) return cached
  const g = new Path2D()
  for (let i = 0; i <= 44; i++) {
    const a = i / 44 * TAU, q = r * (1 + Math.sin(i * 2.7) * .055)
    const x = Math.cos(a) * q, y = Math.sin(a) * q * .84
    if (i === 0) g.moveTo(x, y); else g.quadraticCurveTo(Math.cos(a - .06) * (q + 1.3), Math.sin(a - .06) * (q + 1.3) * .84, x, y)
  }
  g.closePath()
  furPaths.set(r, g)
  return g
}

export function drawKedama(v: EnemyAppearanceView): void {
  const g = v.ctx
  g.save(); g.translate(v.x, v.y - 5 + Math.sin(v.phase * 2) * 1.4)
  g.scale(v.rx / v.r, v.ry / (v.r * .86)); g.lineJoin = 'round'
  const winding = v.windup && v.windup !== 'none'
  drawKedamaFur(g, v.r, { flash: v.flash > 0, mouthOpen: winding ? .7 + v.windupProgress * .3 : .6 })
  if (winding) {
    // 毛团仍保留囧脸，只在脸外画吸气细丝，不把眼睛与嘴盖成普通射手的黑圆。
    const k = v.windupProgress
    g.strokeStyle = v.windup === 'ring' ? '#d4c8e69c' : '#f2eee393'; g.lineWidth = .75
    for (let i = 0; i < 5; i++) {
      const a = v.pounceAngle + (i - 2) * .23, radius = v.r + 8 - k * 4
      g.beginPath(); g.moveTo(Math.cos(a) * (radius + 4), Math.sin(a) * (radius + 4)); g.quadraticCurveTo(Math.cos(a + .08) * radius, Math.sin(a + .08) * radius, Math.cos(a) * (radius - 3), Math.sin(a) * (radius - 3)); g.stroke()
    }
  }
  g.restore()
}

/** 护卫的硬壳是长在胶体内的乳白晶片，侧面留果冻透光，轮廓比普通史莱姆厚重。 */
export function drawGuardian(v: EnemyAppearanceView): void {
  const g = v.ctx
  g.save(); g.translate(v.x, v.y); g.scale(v.rx / v.r, v.ry / (v.r * .86)); g.lineJoin = 'round'
  const body = new Path2D('M-22 12Q-26 3-19-9Q-15-22 0-23Q17-23 21-7Q29 8 20 15Q0 22-22 12Z')
  const grad = g.createLinearGradient(-16, -21, 20, 17)
  grad.addColorStop(0, '#b5d7cc'); grad.addColorStop(.45, '#699b99'); grad.addColorStop(1, '#365d70')
  g.fillStyle = v.flash > 0 ? '#e7eee2' : grad; g.fill(body); g.strokeStyle = '#334450'; g.lineWidth = 1.6; g.stroke(body)
  const plates = [
    ['M-16-9L-7-18L1-13L-2-2L-13 1Z', '#d6d6c0'],
    ['M1-18L12-15L17-5L8 1L0-5Z', '#b7c5bc'],
    ['M-13 3L-2-3L6 4L3 16L-10 13Z', '#c8ccba'],
    ['M8 2L18-3L22 8L15 15L6 14Z', '#98b3b1']
  ]
  for (const [p, color] of plates) { const path = new Path2D(p); g.fillStyle = color; g.fill(path); g.strokeStyle = '#53646a'; g.lineWidth = 1; g.stroke(path) }
  g.strokeStyle = '#f3f0d3aa'; g.lineWidth = 1; g.beginPath(); g.moveTo(-15, -9); g.lineTo(-7, -16); g.moveTo(2, -16); g.lineTo(10, -14); g.moveTo(-11, 4); g.lineTo(-3, 0); g.stroke()
  // 薄壳边缘的层纹、磨损与细裂缝让晶片保留岩质，避免像拼起来的平面色块。
  g.strokeStyle = '#7d92847a'; g.lineWidth = .65; g.beginPath(); g.moveTo(-11, -10); g.lineTo(-6, -8); g.lineTo(-8, -4); g.moveTo(7, -13); g.lineTo(8, -9); g.lineTo(12, -8); g.moveTo(-8, 8); g.lineTo(-4, 6); g.lineTo(-2, 10); g.stroke()
  g.strokeStyle = '#e4e5c87a'; g.lineWidth = .55; g.beginPath(); g.moveTo(-14, -5); g.lineTo(-9, -3); g.moveTo(12, 5); g.lineTo(17, 3); g.moveTo(10, 11); g.lineTo(15, 10); g.stroke()
  g.fillStyle = '#263f4c'; g.beginPath(); g.ellipse(-5, -3, 2.1, 1.25, -.2, 0, TAU); g.ellipse(7, -3, 2.1, 1.25, .2, 0, TAU); g.fill()
  g.fillStyle = '#e6d796'; g.beginPath(); g.arc(-5, -3, .75, 0, TAU); g.arc(7, -3, .75, 0, TAU); g.fill()
  g.strokeStyle = '#385762'; g.lineWidth = .8; g.beginPath(); g.moveTo(-1, 7); g.lineTo(4, 7); g.stroke()
  if (v.pounceState === 'windup') { g.strokeStyle = '#dfc28b'; g.lineWidth = 1.3; g.globalAlpha *= v.pounceProgress; g.stroke(body) }
  g.restore()
}

export function drawGuardianWarning(v: EnemyAppearanceView): void {
  if (!v.alive || v.pounceState !== 'windup') return
  const g = v.ctx, k = v.pounceProgress
  g.save(); g.translate(v.x, v.y); g.rotate(v.pounceAngle)
  // 实心晶光通道和三枚宽折箭从蓄力开始就可见，终点与实际突刺距离一致。
  const start = v.r + 5, end = (v.dashDistance ?? 89.6) + v.r, half = v.r * .65
  g.globalAlpha = .65 + k * .3
  g.fillStyle = '#cb926044'; g.beginPath(); g.moveTo(start, -half); g.lineTo(end - 15, -half); g.lineTo(end, 0); g.lineTo(end - 15, half); g.lineTo(start, half); g.closePath(); g.fill()
  g.lineJoin = 'miter'
  for (const x of [start + 14, (start + end) / 2 + 5, end - 2]) {
    g.beginPath(); g.moveTo(x - 9, -9); g.lineTo(x, 0); g.lineTo(x - 9, 9)
    g.strokeStyle = '#352b39'; g.lineWidth = 5; g.stroke()
    g.strokeStyle = '#f1d593'; g.lineWidth = 2.5; g.stroke()
  }
  g.strokeStyle = '#dba15b'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(start, -half); g.lineTo(end - 15, -half); g.moveTo(start, half); g.lineTo(end - 15, half); g.stroke()
  g.restore()
}
