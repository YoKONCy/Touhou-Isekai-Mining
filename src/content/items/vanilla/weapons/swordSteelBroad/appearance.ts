import { addItemCelStop } from '../../../itemArt'
import { svgIcon, type GroundDropView, type HeldWeaponView } from '../../../types'

let sprite: HTMLCanvasElement | null = null
/** 冷锻钢的中脊、刃面和浅槽分开着色，握柄与短护手保持旧营器物的材质。 */
function broadswordSprite(): HTMLCanvasElement {
  if (sprite) return sprite
  const canvas = document.createElement('canvas'); canvas.width = 188; canvas.height = 48
  const g = canvas.getContext('2d')!; g.scale(2, 2); g.translate(14, 12); g.lineJoin = 'round'
  const steel = g.createLinearGradient(0, -6, 0, 6)
  addItemCelStop(steel, 0, '#d2dad4'); addItemCelStop(steel, .23, '#9cb7c2'); addItemCelStop(steel, .48, '#576f85')
  addItemCelStop(steel, .55, '#d0dbd5'); addItemCelStop(steel, .82, '#acc0c0'); addItemCelStop(steel, 1, '#e2e6d2')
  g.beginPath(); g.moveTo(7, -4.8); g.lineTo(15, -5.7); g.lineTo(63, -4.8); g.lineTo(78, 0)
  g.lineTo(63, 4.8); g.lineTo(15, 5.7); g.lineTo(7, 4.8); g.closePath()
  g.fillStyle = steel; g.fill(); g.strokeStyle = '#313e4c'; g.lineWidth = .9; g.stroke()
  g.beginPath(); g.moveTo(9, .1); g.lineTo(65, .1); g.lineTo(77, 0); g.lineTo(62, 3.8); g.lineTo(15, 4.6); g.lineTo(9, 3.8); g.closePath()
  g.fillStyle = '#b8c9c8'; g.fill()
  g.beginPath(); g.moveTo(15, -2); g.lineTo(58, -1.8); g.lineTo(66, -.3); g.lineTo(17, -.5); g.closePath()
  g.fillStyle = '#51667b'; g.fill()
  g.strokeStyle = '#aec4c7'; g.lineWidth = .45; g.beginPath(); g.moveTo(16, -2.4); g.lineTo(59, -2.2); g.stroke()
  g.strokeStyle = '#f2e9cf'; g.lineWidth = .7; g.beginPath(); g.moveTo(9, 4.2); g.lineTo(15, 5); g.lineTo(63, 4.2); g.lineTo(76.9, .15); g.stroke()
  g.strokeStyle = '#d6e0d0'; g.lineWidth = .55; g.beginPath(); g.moveTo(10, -4.1); g.lineTo(16, -5); g.lineTo(62, -4.2); g.stroke()
  // 短锻纹错开排列，避免整条刀面变成均匀条纹。
  g.strokeStyle = '#829ca0'; g.lineWidth = .4
  for (let i = 0; i < 6; i++) { const x = 21 + i * 7; g.beginPath(); g.moveTo(x, 1.5 + i % 2 * .3); g.lineTo(x + 2.5, 2.1 + i % 2 * .3); g.stroke() }
  g.fillStyle = '#6a7984'; g.fillRect(5.5, -4.7, 3, 9.4); g.strokeStyle = '#303b47'; g.strokeRect(5.5, -4.7, 3, 9.4)
  g.beginPath(); g.moveTo(3, -8.3); g.lineTo(5.4, -9.3); g.lineTo(7.5, -7.8); g.lineTo(6.2, -3.3)
  g.lineTo(6.2, 3.3); g.lineTo(7.5, 7.8); g.lineTo(5.4, 9.3); g.lineTo(3, 8.3); g.closePath()
  g.fillStyle = '#ab9c70'; g.fill(); g.strokeStyle = '#484a49'; g.lineWidth = .8; g.stroke()
  g.strokeStyle = '#d5c492'; g.lineWidth = .6; g.beginPath(); g.moveTo(4, -7.6); g.lineTo(4.8, -3.8); g.moveTo(4, 3.8); g.lineTo(4.8, 7.6); g.stroke()
  g.fillStyle = '#4a3f37'; g.beginPath(); g.roundRect(-9, -2.4, 12, 4.8, .7); g.fill(); g.strokeStyle = '#2a2b2e'; g.stroke()
  g.strokeStyle = '#877855'; g.lineWidth = .75
  for (let x = -8; x < 2; x += 1.9) { g.beginPath(); g.moveTo(x, -2.1); g.lineTo(x + 1.1, 2.1); g.stroke() }
  g.beginPath(); g.moveTo(-12.5, -2.2); g.lineTo(-10.6, -3.5); g.lineTo(-8.8, -2.6)
  g.lineTo(-8.8, 2.6); g.lineTo(-10.6, 3.5); g.lineTo(-12.5, 2.2); g.closePath()
  g.fillStyle = '#88989d'; g.fill(); g.strokeStyle = '#324146'; g.stroke()
  g.strokeStyle = '#c1cdb6'; g.lineWidth = .6; g.beginPath(); g.moveTo(-11.7, -1.9); g.lineTo(-10.6, -2.6); g.stroke()
  sprite = canvas; return canvas
}
export function drawSteelBroadsword(g: CanvasRenderingContext2D, view?: HeldWeaponView): void {
  g.drawImage(broadswordSprite(), -14, -12, 94, 24)
  if (view?.motion?.empowered) {
    g.save(); g.globalAlpha *= .45; g.strokeStyle = '#e1c692'; g.lineWidth = .75
    g.beginPath(); g.moveTo(12, 4.5); g.lineTo(62, 4.3); g.lineTo(77, .2); g.stroke(); g.restore()
  }
}
export function drawGroundBroadsword({ ctx: g, x, y }: GroundDropView): void {
  g.save(); g.translate(x, y); g.rotate(-.58); g.scale(.55, .55); g.translate(-32, 0); drawSteelBroadsword(g); g.restore()
}
export const STEEL_BROADSWORD_ICON = svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><linearGradient id="steel-broadsword-metal" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#d2d9cf"/><stop offset=".28" stop-color="#8ca9b4"/><stop offset=".48" stop-color="#506b79"/><stop offset=".55" stop-color="#c5d4d2"/><stop offset="1" stop-color="#e1e5d8"/></linearGradient></defs>
  <g transform="translate(16 49) rotate(-45) scale(.7)" stroke="#273841" stroke-width="1.3" stroke-linejoin="round">
    <path d="M7-4.8 15-5.7 63-4.8 78 0 63 4.8 15 5.7 7 4.8Z" fill="url(#steel-broadsword-metal)"/>
    <path d="M9 .1 65 .1 77 0 62 3.8 15 4.6 9 3.8Z" fill="#b8c8c6" stroke="none"/>
    <path d="M15-2 58-1.8 66-.3 17-.5Z" fill="#465e69" stroke="none"/>
    <path d="M10 4.3 15 5 63 4.2 77 .15M10-4.1 16-5 62-4.2" fill="none" stroke="#eef0dd" stroke-width=".9"/>
    <path d="m23 1.5 3 .6m10-.8 3 .6m10-.4 3 .5" fill="none" stroke="#7c969b" stroke-width=".6"/>
    <path d="M3-8.3 5.4-9.3 7.5-7.8 6.2-3.3V3.3L7.5 7.8 5.4 9.3 3 8.3Z" fill="#a59972"/>
    <path d="M4-7.6 4.8-3.8M4 3.8 4.8 7.6" stroke="#d4c695" stroke-width=".8"/>
    <rect x="-9" y="-2.4" width="12" height="4.8" rx=".7" fill="#443e33"/>
    <path d="m-8-2.1 1.1 4.2m.8-4.2 1.1 4.2m.8-4.2 1.1 4.2m.8-4.2 1.1 4.2m.8-4.2 1.1 4.2" stroke="#827452" stroke-width=".9"/>
    <path d="M-12.5-2.2-10.6-3.5-8.8-2.6V2.6L-10.6 3.5-12.5 2.2Z" fill="#7a8b8b"/>
  </g>
</svg>`)
