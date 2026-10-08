import { addItemCelStop } from '../../../itemArt'
import type { GroundDropView } from '../../../types'
import { stats } from './stats'

/** 杆身随攻击距离缩短，石尖和握带保持原有厚度。 */
export const SPEAR_LENGTH_SCALE = stats.melee.reach / 120

let sprite: HTMLCanvasElement | null = null

/** 二倍分辨率烘焙木纹、石片断面和麻绳，不在持握绘制时重建材质。 */
function spearSprite(): HTMLCanvasElement {
  if (sprite) return sprite
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 40
  const g = canvas.getContext('2d')!
  g.scale(2, 2); g.translate(32, 10)
  g.lineJoin = 'bevel'; g.lineCap = 'round'
  const wood = g.createLinearGradient(0, -2.4, 0, 2.5)
  addItemCelStop(wood, 0, '#b09269'); addItemCelStop(wood, .35, '#896648')
  addItemCelStop(wood, .7, '#5f4234'); addItemCelStop(wood, 1, '#45342c')
  g.beginPath(); g.moveTo(-28, -1.7); g.lineTo(65, -2.4); g.lineTo(66, 2.3); g.lineTo(-28, 1.8); g.closePath()
  g.fillStyle = wood; g.fill(); g.strokeStyle = '#2b2528'; g.lineWidth = .9; g.stroke()
  g.strokeStyle = '#d2b58b88'; g.lineWidth = .45
  g.beginPath(); g.moveTo(-25, -1.1); g.bezierCurveTo(-6, -.6, 6, -1.4, 22, -1.2)
  g.moveTo(24, -1.2); g.bezierCurveTo(38, -.8, 48, -1.6, 57, -1.5); g.stroke()
  g.strokeStyle = '#4c3830'; g.lineWidth = .55
  g.beginPath(); g.moveTo(20, .9); g.bezierCurveTo(27, .2, 29, 1.8, 38, .9); g.stroke()
  g.beginPath(); g.ellipse(32, .2, 2.8, .75, 0, 0, Math.PI * 2); g.stroke()
  // 手握处的旧皮条、矛尾防裂绕线和石片根部的交叉扎带。
  g.fillStyle = '#574239'; g.fillRect(-8, -2.2, 20, 4.4)
  g.strokeStyle = '#a68a65'; g.lineWidth = .7
  for (let x = -7; x < 12; x += 3) { g.beginPath(); g.moveTo(x, -2); g.lineTo(x + 1.6, 2); g.stroke() }
  for (const start of [-26, 53]) {
    const end = start < 0 ? -20 : 65
    g.strokeStyle = '#4e3b32'; g.lineWidth = 1.6
    for (let x = start; x <= end; x += 1.9) { g.beginPath(); g.moveTo(x, -2.7); g.lineTo(x + 1, 2.7); g.stroke() }
    g.strokeStyle = '#c7ac7f'; g.lineWidth = .75
    for (let x = start; x <= end; x += 1.9) { g.beginPath(); g.moveTo(x - .3, -2.5); g.lineTo(x + .7, 2.3); g.stroke() }
  }
  // 打制石尖由不对称缺口与三片灰绿断面构成，亮边保持石质而非金属刃。
  g.beginPath(); g.moveTo(61, -4.6); g.lineTo(67, -6.2); g.lineTo(72, -4.4)
  g.lineTo(75, -4.7); g.lineTo(84, 0); g.lineTo(76, 3.2); g.lineTo(74, 2.7)
  g.lineTo(68, 6); g.lineTo(62, 4.1); g.lineTo(58, 1.2); g.closePath()
  g.fillStyle = '#878687'; g.fill(); g.strokeStyle = '#35363b'; g.lineWidth = 1.1; g.stroke()
  g.beginPath(); g.moveTo(61, -4.6); g.lineTo(67, -5.4); g.lineTo(72, -3.5)
  g.lineTo(82, -.3); g.lineTo(66, -.7); g.lineTo(60, .3); g.closePath(); g.fillStyle = '#c3bc9b'; g.fill()
  g.beginPath(); g.moveTo(66, -.7); g.lineTo(84, 0); g.lineTo(68, 6); g.lineTo(70, 1.2); g.closePath(); g.fillStyle = '#5d6a6b'; g.fill()
  g.beginPath(); g.moveTo(62, 1); g.lineTo(68, -1.5); g.lineTo(70, 1.2); g.lineTo(66, 3.5); g.closePath(); g.fillStyle = '#989896'; g.fill()
  g.strokeStyle = '#d7cfac'; g.lineWidth = .6
  g.beginPath(); g.moveTo(63, -4.4); g.lineTo(67, -4.9); g.lineTo(73, -3.4); g.moveTo(76, -2.7); g.lineTo(82, -.4); g.stroke()
  g.strokeStyle = '#464a4c'; g.lineWidth = .5
  g.beginPath(); g.moveTo(68, -4.9); g.lineTo(66, -.7); g.lineTo(63, 2.7); g.moveTo(73, 1.5); g.lineTo(77, .7); g.stroke()
  g.strokeStyle = '#c8ac7f'; g.lineWidth = .9
  g.beginPath(); g.moveTo(57, -2.3); g.lineTo(64, 2.3); g.moveTo(59, 2.2); g.lineTo(63, -3); g.stroke()
  sprite = canvas
  return canvas
}

export function drawStoneSpear(ctx: CanvasRenderingContext2D): void {
  ctx.drawImage(spearSprite(), -32 * SPEAR_LENGTH_SCALE, -10, 128 * SPEAR_LENGTH_SCALE, 20)
}

/** 掉落时仍展示完整矛身，避免把武器绘成通用矿石碎块。 */
export function drawGroundStoneSpear({ ctx, x, y }: GroundDropView): void {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-.45); ctx.scale(.55, .55)
  ctx.translate(-28 * SPEAR_LENGTH_SCALE, 0)
  drawStoneSpear(ctx); ctx.restore()
}
