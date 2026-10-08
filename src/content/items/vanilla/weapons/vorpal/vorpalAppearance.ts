import { addItemCelStop } from '../../../itemArt'
import type { HeldWeaponView } from '../../../types'

/** 主角版沃柏尔：腐蚀黑钢、破损回刃与黑雾；不与格林的完好器型共用材质。 */
export function drawVorpal(ctx: CanvasRenderingContext2D, opts: HeldWeaponView): void {
  const time = opts.time ?? 0
  // 黑雾先画在剑后；固定相位连续运动，避免每帧随机抖动。
  ctx.save()
  for (let i = 0; i < 16; i++) {
    const phase = (time * .27 + i * .137) % 1
    const x = 16 + (i % 8) * 8 + Math.sin(time * .8 + i * 1.7) * 6
    const y = Math.sin(time * .7 + i * 2.1) * 10 - phase * 19 + (i > 7 ? 15 : -3)
    const radius = 11 + phase * 13 + (i % 3) * 2
    const fog = ctx.createRadialGradient(x, y, 0, x, y, radius)
    const alpha = Math.sin(phase * Math.PI) * .76
    fog.addColorStop(0, `rgba(3,2,6,${alpha})`)
    fog.addColorStop(.38, `rgba(7,3,10,${alpha * .9})`)
    fog.addColorStop(.72, `rgba(28,9,19,${alpha * .36})`)
    fog.addColorStop(1, '#13131a00')
    ctx.fillStyle = fog; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }
  ctx.restore()
  const blade = new Path2D('M7 -5 L24 -6 27 -4 30 -6 48 -7 51 -5 55 -8 61 -6 65 -10 70 -8 76 -3 80 3 Q83 19 70 29 L66 28 63 33 Q50 39 40 38 Q55 31 59 20 L57 14 53 9 45 8 42 6 38 8 24 6 21 4 18 6 7 5Z')
  const metal = ctx.createLinearGradient(0, -10, 0, 38)
  addItemCelStop(metal, 0, '#212328'); addItemCelStop(metal, .22, '#5d5a5c'); addItemCelStop(metal, .34, '#35383f'); addItemCelStop(metal, .64, '#75706e'); addItemCelStop(metal, .8, '#464648'); addItemCelStop(metal, 1, '#22252a')
  ctx.fillStyle = metal; ctx.fill(blade); ctx.strokeStyle = '#1a1c22'; ctx.lineWidth = 1.5; ctx.stroke(blade)
  ctx.save(); ctx.clip(blade)
  // 狭窄脊面与宽暗侧面，摒弃覆盖整把剑的光滑亮带。
  ctx.fillStyle = '#aea180'; ctx.fill(new Path2D('M8 -1 L27 -2 30 -1 52 -2 65 0 54 2 29 1 8 2Z'))
  ctx.fillStyle = '#1f2328'; ctx.fill(new Path2D('M8 3 L37 4 55 5 66 13 62 24 48 35 56 22 52 12 36 7 8 6Z'))
  // 确定性腐蚀斑片与点蚀，沿刃根和回弯接合处集中分布。
  for (let i = 0; i < 24; i++) {
    const x = 12 + ((i * 19) % 66)
    const y = i < 16 ? -6 + ((i * 7) % 13) : 10 + ((i * 11) % 25)
    ctx.fillStyle = i % 3 === 0 ? '#81604788' : i % 3 === 1 ? '#1b2026aa' : '#72684d55'
    ctx.fill(new Path2D(`M${x} ${y}l3 -1 2 2 -2 2 -4 -1Z`))
  }
  ctx.strokeStyle = '#161a20'; ctx.lineWidth = 1.2
  ctx.stroke(new Path2D('M29 -6 L32 -2 29 1 34 5 M49 -6 L47 -3 52 1 M68 15 L73 19 68 23 69 28'))
  ctx.strokeStyle = '#c6b89588'; ctx.lineWidth = .65
  ctx.stroke(new Path2D('M14 -4 L18 -2 M36 2 L40 -1 M54 -4 L57 -2 M72 22 L68 26 M53 32 L57 29'))
  ctx.restore()
  // 回刃外缘只留断续磨亮面，缺口与黑钢包片形成不对称轮廓。
  ctx.strokeStyle = '#c0b28c'; ctx.lineWidth = .85
  ctx.stroke(new Path2D('M78 6 Q79 14 74 21 M71 25 L68 27 M62 33 Q51 37 44 37'))
  ctx.fillStyle = '#292b31'; ctx.fill(new Path2D('M64 -7 L73 -5 79 3 76 15 70 19 68 9 61 2Z'))
  ctx.strokeStyle = '#7a6044'; ctx.stroke(new Path2D('M65 -6 L72 -4 76 2 M71 18 L75 14'))
  ctx.fillStyle = '#7b6247'; ctx.beginPath(); ctx.arc(72, 5, 2.7, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#1e2126'; ctx.beginPath(); ctx.arc(72, 5, 1.6, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#261f24'; ctx.fill(new Path2D('M-11 -2 L5 -3 5 3-11 2Z'))
  ctx.strokeStyle = '#705646'; ctx.lineWidth = 1.5
  for (let x = -8; x < 3; x += 3) { ctx.beginPath(); ctx.moveTo(x, -2); ctx.lineTo(x + 1, 2); ctx.stroke() }
  const guard = new Path2D('M3 -3 Q-1 -9 6 -15 L9 -14 8 -10 6 -10 9 -5 L10 5 7 9 9 12 6 15 Q-1 10 3 3Z')
  ctx.fillStyle = '#524337'; ctx.fill(guard); ctx.strokeStyle = '#1e2026'; ctx.stroke(guard)
  ctx.strokeStyle = '#a2835866'; ctx.lineWidth = .7; ctx.stroke(new Path2D('M5 -12 L4 -8 6 -5 M5 6 L4 10'))
  ctx.fillStyle = '#6a5641'; ctx.beginPath(); ctx.arc(-12, 0, 3, 0, Math.PI * 2); ctx.fill()
  // 极弱的暗红裂缝与细雾丝覆在剑上，不把黑钢变成发光玩具。
  ctx.save(); ctx.globalAlpha = .18 + .08 * Math.sin(time * 1.9)
  ctx.strokeStyle = '#9a3a50'; ctx.lineWidth = .8
  ctx.stroke(new Path2D('M29 -5 L32 -2 29 1 M69 16 L73 19 69 23'))
  ctx.restore()
  ctx.save(); ctx.strokeStyle = '#17151e66'; ctx.lineWidth = 1.8
  for (let i = 0; i < 3; i++) {
    const x = 28 + i * 19, drift = Math.sin(time * .9 + i * 2) * 5
    ctx.beginPath(); ctx.moveTo(x, 3); ctx.bezierCurveTo(x - 8, -7 + drift, x + 10, -12 - drift, x - 2, -23 + drift); ctx.stroke()
  }
  ctx.restore()
}

