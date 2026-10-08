import { addItemCelStop } from '../../../itemArt'
import type { GroundDropView, HeldWeaponView } from '../../../types'
import { stats } from './stats'

/** 原始杆身按 100 距离设计；只缩短纵向，保留木棍厚度和握带辨识度。 */
export const STAFF_LENGTH_SCALE = stats.melee.reach / 100

let sprite: HTMLCanvasElement | null = null

/** 长棍材质一次烘焙：细木纹、磨亮棱线、两端旧箍与交错握带。 */
function staffSprite(): HTMLCanvasElement {
  if (sprite) return sprite
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 32
  const g = canvas.getContext('2d')!
  g.scale(2, 2); g.translate(34, 8); g.lineJoin = 'round'; g.lineCap = 'round'
  const wood = g.createLinearGradient(0, -3.1, 0, 3.1)
  addItemCelStop(wood, 0, '#d0b183'); addItemCelStop(wood, .25, '#a97f53')
  addItemCelStop(wood, .55, '#81583b'); addItemCelStop(wood, 1, '#4a362d')
  g.beginPath(); g.moveTo(-29, -2.6); g.lineTo(81, -3.1); g.lineTo(85, -1.8)
  g.lineTo(85, 1.9); g.lineTo(80, 3); g.lineTo(-29, 2.6); g.closePath()
  g.fillStyle = wood; g.fill(); g.strokeStyle = '#322726'; g.lineWidth = 1; g.stroke()
  g.strokeStyle = '#dbbd8faa'; g.lineWidth = .55
  g.beginPath(); g.moveTo(-24, -1.9); g.bezierCurveTo(-12, -1.6, -8, -2.1, 0, -1.6)
  g.moveTo(20, -2); g.bezierCurveTo(38, -1.4, 47, -2.5, 76, -2.1); g.stroke()
  g.strokeStyle = '#523b2c'; g.lineWidth = .55
  g.beginPath(); g.moveTo(25, .8); g.bezierCurveTo(35, -.3, 43, 2.1, 55, .7)
  g.moveTo(57, .7); g.bezierCurveTo(64, .1, 70, 1.1, 79, .5); g.stroke()
  g.beginPath(); g.ellipse(44, .3, 3.3, .85, -.04, 0, Math.PI * 2); g.stroke()
  g.strokeStyle = '#b9926455'; g.lineWidth = .4
  g.beginPath(); g.moveTo(25, 1.8); g.bezierCurveTo(37, 1.3, 44, 2.7, 56, 1.7); g.stroke()
  // 末端保留圆木断面，只用窄铁箍防裂，避免变成双头金属棒。
  for (const x of [-25, 78]) {
    g.fillStyle = '#484849'; g.fillRect(x, -3, 3.5, 6)
    g.fillStyle = '#98958d'; g.fillRect(x + .3, -2.8, 2.8, .9)
    g.fillStyle = '#37383b'; g.fillRect(x + .2, 1.8, 3, .9)
    g.fillStyle = '#c9b98c'; g.fillRect(x + 1.3, -.5, .7, .7)
  }
  g.strokeStyle = '#a98962'; g.lineWidth = .7
  g.beginPath(); g.moveTo(84, -1.7); g.lineTo(84, 1.5); g.stroke()
  g.fillStyle = '#715746'; g.fillRect(-10, -3.1, 28, 6.2)
  g.strokeStyle = '#46362e'; g.lineWidth = 1.2
  for (let x = -9; x < 17; x += 3) { g.beginPath(); g.moveTo(x, -2.8); g.lineTo(x + 1.8, 2.8); g.stroke() }
  g.strokeStyle = '#b89872'; g.lineWidth = .65
  for (let x = -9; x < 17; x += 3) { g.beginPath(); g.moveTo(x - .3, -2.7); g.lineTo(x + 1.5, 2.6); g.stroke() }
  g.strokeStyle = '#d0b78b'; g.lineWidth = .65
  g.beginPath(); g.moveTo(-10, -2.4); g.lineTo(18, -2.4); g.stroke()
  sprite = canvas
  return canvas
}

export function drawWoodStaff(ctx: CanvasRenderingContext2D, view: HeldWeaponView): void {
  ctx.save()
  // 两套握法有不同的腕部偏置，横扫与回抽的棍身依然沿小臂方向伸出。
  const motion = view.motion
  if (motion && motion.phase !== 'none') {
    const phase = motion.phase === 'active' ? 1 - motion.timer / motion.move.active : 0
    ctx.translate(0, (motion.segment === 0 ? -.7 : .7) * Math.sin(Math.max(0, phase) * Math.PI))
  }
  ctx.drawImage(staffSprite(), -34 * STAFF_LENGTH_SCALE, -8, 128 * STAFF_LENGTH_SCALE, 16)
  ctx.restore()
}

export function drawGroundWoodStaff({ ctx, x, y }: GroundDropView): void {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-.35); ctx.scale(.55, .55)
  ctx.translate(-28 * STAFF_LENGTH_SCALE, 0)
  drawWoodStaff(ctx, {}); ctx.restore()
}
