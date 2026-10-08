import { addItemCelStop } from '../../../itemArt'
import { svgIcon, type GroundDropView } from '../../../types'

let sprite: HTMLCanvasElement | null = null
/** 两手各握一把轻薄短刀，护手与皮柄保留清晰的材质分界。 */
function bladeSprite(): HTMLCanvasElement {
  if (sprite) return sprite
  const canvas = document.createElement('canvas'); canvas.width = 112; canvas.height = 28
  const g = canvas.getContext('2d')!; g.scale(2, 2); g.translate(8, 7); g.lineJoin = 'round'
  const steel = g.createLinearGradient(0, -3, 0, 3)
  addItemCelStop(steel, 0, '#e5e8d5'); addItemCelStop(steel, .35, '#a7bdc1')
  addItemCelStop(steel, .55, '#597085'); addItemCelStop(steel, 1, '#d1dbca')
  g.beginPath(); g.moveTo(4, -2); g.lineTo(32, -2.5); g.quadraticCurveTo(40, -3.6, 45, -4.7)
  g.quadraticCurveTo(41, 1.2, 34, 2.5); g.lineTo(4, 2.1); g.closePath()
  g.fillStyle = steel; g.fill(); g.strokeStyle = '#323d4d'; g.lineWidth = .8; g.stroke()
  g.beginPath(); g.moveTo(5, .3); g.lineTo(34, .4); g.lineTo(44, -4); g.quadraticCurveTo(40, 1.2, 34, 2); g.lineTo(5, 1.7); g.closePath()
  g.fillStyle = '#e4e8d2'; g.fill()
  g.strokeStyle = '#758e9f'; g.lineWidth = .5; g.beginPath(); g.moveTo(8, -1.1); g.lineTo(31, -1.4); g.stroke()
  for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(10 + i * 8, -1.8); g.lineTo(11 + i * 8, -.6); g.stroke() }
  g.fillStyle = '#a68a62'; g.strokeStyle = '#434244'; g.beginPath(); g.roundRect(2.4, -4.2, 2, 8.1, .7); g.fill(); g.stroke()
  g.fillStyle = '#3b4957'; g.beginPath(); g.roundRect(-5.4, -2.1, 8, 4.2, .65); g.fill(); g.strokeStyle = '#303946'; g.stroke()
  g.strokeStyle = '#96a8a4'; g.lineWidth = .7
  for (let x = -4.5; x < 2; x += 1.7) { g.beginPath(); g.moveTo(x, -1.7); g.lineTo(x + .9, 1.7); g.stroke() }
  g.fillStyle = '#b5a375'; g.fillRect(-6.4, -2.3, 1.5, 4.6)
  sprite = canvas; return canvas
}
export function drawDualBlade(g: CanvasRenderingContext2D): void { g.drawImage(bladeSprite(), -8, -7, 56, 14) }
export function drawGroundDualBlades({ ctx: g, x, y }: GroundDropView): void {
  g.save(); g.translate(x - 8, y); g.rotate(-.65); g.scale(.57, .57); drawDualBlade(g); g.restore()
  g.save(); g.translate(x + 8, y + 2); g.rotate(-2.5); g.scale(.57, -.57); drawDualBlade(g); g.restore()
}
export const DUAL_BLADES_ICON = svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><linearGradient id="dual-steel" x2="0" y2="1"><stop stop-color="#dce5da"/><stop offset=".5" stop-color="#5e7c89"/><stop offset="1" stop-color="#b6ccca"/></linearGradient>
  <g id="dual-blade" stroke="#293742" stroke-width=".85" stroke-linejoin="round"><path d="M4-2 30-2.5Q38-3.6 44-5Q40 1.2 33 2.5L4 2Z" fill="url(#dual-steel)"/><path d="M5 .3 33 .4 43-4Q39 1.2 33 2L5 1.7Z" fill="#e5e8d8" stroke="none"/><path d="M8-1.1 29-1.4" stroke="#67818c"/><rect x="2.4" y="-4.2" width="2" height="8.1" rx=".7" fill="#a18b60"/><rect x="-5.4" y="-2.1" width="8" height="4.2" rx=".6" fill="#364952"/><path d="m-4.5-1.7 .9 3.4m.8-3.4 .9 3.4m.8-3.4 .9 3.4m.8-3.4 .9 3.4" stroke="#8fa397"/><path d="M-6-2.3V2.3" stroke="#b5a479" stroke-width="1.5"/></g></defs>
  <use href="#dual-blade" transform="translate(14 50) rotate(-49)"/><use href="#dual-blade" transform="translate(48 50) rotate(-131) scale(1 -1)"/>
</svg>`)
