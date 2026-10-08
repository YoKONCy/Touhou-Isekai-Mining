import { addItemCelStop } from '../../../itemArt'
import { svgIcon, type GroundDropView, type HeldWeaponView } from '../../../types'

const HEAD = 'M59 7L69 8L71-7Q74-12 83-14L82-27Q64-31 43-22L45-12Q53-13 58-7L59 1Z'
const EDGE = 'M43-22Q64-31 82-27L81-23Q64-27 46-18Z'
const FACE = 'M48-17Q63-25 77-22L78-16Q69-14 65-8L61-5L58-10Z'
const EDGE_LINE = 'M44.5-21.5Q64-29.6 81-26.2'
let sprite: HTMLCanvasElement | null = null
let headSprite: HTMLCanvasElement | null = null
/** 斧头横穿柄端：单侧钢刃与对面的短斧背分开，刃口垂直于柄轴。 */
function paintAxeHead(g: CanvasRenderingContext2D): void {
  const steel = g.createLinearGradient(57, -27, 69, 9)
  addItemCelStop(steel, 0, '#d7d9d3'); addItemCelStop(steel, .3, '#a7b6b9'); addItemCelStop(steel, .58, '#728b9b'); addItemCelStop(steel, 1, '#4d6073')
  const head = new Path2D(HEAD)
  g.fillStyle = steel; g.fill(head); g.strokeStyle = '#313d49'; g.lineWidth = 1.15; g.stroke(head)
  g.fillStyle = '#e1e5d0'; g.fill(new Path2D(EDGE))
  g.strokeStyle = '#f4e9cb'; g.lineWidth = .7; g.stroke(new Path2D(EDGE_LINE))
  g.fillStyle = '#597084'; g.fill(new Path2D(FACE))
  g.strokeStyle = '#b9c9ca'; g.lineWidth = .65; g.beginPath(); g.moveTo(49, -16); g.quadraticCurveTo(64, -23, 75, -20); g.stroke()
  // 厚钢侧面压暗，下伸的斧须与握柄之间保留清楚的凹口。
  g.fillStyle = '#3a4c5b'; g.beginPath(); g.moveTo(45, -12); g.quadraticCurveTo(53, -13, 58, -7); g.lineTo(60, -3); g.lineTo(62, -7); g.lineTo(58, -11); g.lineTo(48, -14); g.closePath(); g.fill()
  g.strokeStyle = '#738a8f'; g.lineWidth = .5
  for (let i = 0; i < 4; i++) { const x = 51 + i * 6; g.beginPath(); g.moveTo(x, -20 + i % 2 * 1.8); g.lineTo(x + 1.2, -17 + i % 2); g.stroke() }
  g.fillStyle = '#8d9ea5'; g.beginPath(); g.moveTo(60, -6); g.lineTo(68, -5); g.lineTo(70, 5); g.lineTo(67, 8); g.lineTo(59, 6); g.closePath(); g.fill(); g.strokeStyle = '#35494f'; g.lineWidth = .8; g.stroke()
  g.fillStyle = '#5f6d78'; g.fillRect(60, 5.5, 9, 3); g.strokeStyle = '#bdc9ca'; g.lineWidth = .7; g.beginPath(); g.moveTo(61, -4.6); g.lineTo(67, -3.8); g.moveTo(60.4, 5.1); g.lineTo(66.7, 6.2); g.stroke()
  // 斧眼中央露出木柄的端面和楔钉，区别于套在柄头的铲面。
  g.fillStyle = '#394855'; g.beginPath(); g.roundRect(61.3, -1.9, 5.5, 4.8, .7); g.fill()
  g.fillStyle = '#a6885f'; g.fillRect(62.5, -.8, 3.4, 2.8); g.fillStyle = '#d3c28f'; g.fillRect(63.7, -.4, .65, 2.1)
}
export function drawAxeHead(g: CanvasRenderingContext2D): void {
  if (!headSprite) {
    headSprite = document.createElement('canvas'); headSprite.width = 100; headSprite.height = 88
    const ctx = headSprite.getContext('2d')!; ctx.scale(2, 2); ctx.translate(-40, 32); ctx.lineJoin = 'round'; paintAxeHead(ctx)
  }
  g.drawImage(headSprite, 40, -32, 50, 44)
}
function axeSprite(): HTMLCanvasElement {
  if (sprite) return sprite
  const canvas = document.createElement('canvas'); canvas.width = 216; canvas.height = 120
  const g = canvas.getContext('2d')!; g.scale(2, 2); g.translate(20, 34); g.lineJoin = 'round'; g.lineCap = 'round'
  const wood = g.createLinearGradient(0, -3, 0, 3); addItemCelStop(wood, 0, '#ab8a62'); addItemCelStop(wood, .4, '#7a5942'); addItemCelStop(wood, 1, '#413b3f')
  g.beginPath(); g.moveTo(-17, -2.6); g.lineTo(64, -2.4); g.lineTo(66, 2.2); g.lineTo(-17, 3.2); g.closePath()
  g.fillStyle = wood; g.fill(); g.strokeStyle = '#36363b'; g.lineWidth = .9; g.stroke()
  g.strokeStyle = '#b3956d'; g.lineWidth = .55; g.beginPath(); g.moveTo(9, -1.1); g.lineTo(48, -.8); g.stroke()
  g.fillStyle = '#433f40'; g.beginPath(); g.roundRect(-14, -3, 22, 6, .7); g.fill(); g.strokeStyle = '#35353a'; g.stroke()
  g.strokeStyle = '#877154'; g.lineWidth = .85
  for (let x = -13; x < 7; x += 2.3) { g.beginPath(); g.moveTo(x, -2.5); g.lineTo(x + 1.2, 2.5); g.stroke() }
  for (const x of [-17, 7, 45]) { g.fillStyle = '#94958c'; g.fillRect(x, -2.8, 2, 5.6); g.fillStyle = '#ccbf99'; g.fillRect(x, -2.8, 1.1, 1.2) }
  drawAxeHead(g); sprite = canvas; return canvas
}
export function drawSteelAxe(g: CanvasRenderingContext2D, view?: HeldWeaponView): void {
  g.drawImage(axeSprite(), -20, -34, 108, 60)
  const charge = view?.motion?.charging ? view.motion.chargeProgress ?? 0 : 0
  if (charge >= 1 - 1e-8) {
    g.save(); g.globalAlpha *= .35; g.strokeStyle = '#fae9b8'; g.lineWidth = .9
    g.stroke(new Path2D(EDGE_LINE))
    g.restore()
  }
}
export function drawGroundAxe({ ctx: g, x, y }: GroundDropView): void {
  g.save(); g.translate(x, y); g.rotate(-.55); g.scale(.52, .52); g.translate(-29, 0); drawSteelAxe(g); g.restore()
}
export const STEEL_AXE_ICON = svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<defs><linearGradient id="steel-axe-face" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#cbd3cc"/><stop offset=".3" stop-color="#94a6aa"/><stop offset=".58" stop-color="#647c85"/><stop offset="1" stop-color="#40545e"/></linearGradient></defs>
<g transform="translate(13 49) rotate(-43) scale(.56)" stroke="#27373d" stroke-width="1.5" stroke-linejoin="round">
<path d="M-17-2.6 64-2.4 66 2.2-17 3.2Z" fill="#886545"/><path d="M10-1 48-.8" stroke="#b69c70" stroke-width=".8"/>
<rect x="-14" y="-3" width="22" height="6" rx=".7" fill="#3e3b32"/><path d="m-12-2.5 1.2 5m1.1-5 1.2 5m1.1-5 1.2 5m1.1-5 1.2 5m1.1-5 1.2 5m1.1-5 1.2 5m1.1-5 1.2 5m1.1-5 1.2 5" stroke="#aa9265" stroke-width=".9"/>
<path d="${HEAD}" fill="url(#steel-axe-face)"/><path d="${EDGE}" fill="#e0e4d5" stroke="none"/>
<path d="${FACE}" fill="#526d77" stroke="none"/><path d="${EDGE_LINE}" fill="none" stroke="#f5efda" stroke-width="1"/>
<path d="M60-6 68-5 70 5 67 8 59 6Z" fill="#819398"/><path d="M61-4.6 67-3.8M60.4 5.1 66.7 6.2" stroke="#b5c3c3" stroke-width=".8"/>
<rect x="61.3" y="-1.9" width="5.5" height="4.8" rx=".7" fill="#33484f"/><path d="M63.2-1V2" stroke="#bda773" stroke-width="1.8"/>
</g></svg>`)
