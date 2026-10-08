import type { ItemDef, GroundRenderer } from '../../types'
import { supplyIcon } from './supplyAppearance'
import { MISO_ID, KEDAMA_TOFU_ID, FORGET_ME_NOT_ID } from '../ids'

/** 五瓣蓝花与黄色花心，采集态和掉落态复用同一绘制器。 */
export function drawForgetMeNot(g: CanvasRenderingContext2D, time = 0): void {
  g.lineJoin = 'round'; g.lineCap = 'round'
  const sway = Math.sin(time * 1.6) * .9
  g.strokeStyle = '#657e58'; g.lineWidth = 1.15
  g.beginPath(); g.moveTo(-2, 2); g.bezierCurveTo(-1, -7, 2 + sway, -12, 1 + sway, -24); g.moveTo(-1, -5); g.quadraticCurveTo(-9, -11, -9, -18); g.moveTo(0, -12); g.quadraticCurveTo(8, -14, 9, -20); g.stroke()
  for (const [x, y, a] of [[-4, -8, -1], [3, -13, .7], [-6, -14, -1.3]]) {
    g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = '#80946a'; g.strokeStyle = '#455c44'; g.lineWidth = .55
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(5, -6, 0, -9); g.quadraticCurveTo(-3, -3, 0, 0); g.fill(); g.stroke(); g.restore()
  }
  for (const [x, y, s] of [[1 + sway, -25, 1], [-9 + sway * .6, -18, .76], [9 + sway * .7, -20, .82]]) {
    g.save(); g.translate(x, y); g.scale(s, s)
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; g.fillStyle = i < 2 ? '#a6c3df' : '#749bbf'; g.strokeStyle = '#526987'; g.lineWidth = .55; g.beginPath(); g.ellipse(Math.cos(a) * 2.35, Math.sin(a) * 2.35, 2.6, 1.95, a, 0, Math.PI * 2); g.fill(); g.stroke() }
    g.fillStyle = '#e7cd7e'; g.beginPath(); g.arc(0, 0, 1.25, 0, Math.PI * 2); g.fill(); g.fillStyle = '#faf0be'; g.beginPath(); g.arc(-.3, -.4, .45, 0, Math.PI * 2); g.fill(); g.restore()
  }
}

const flowerSvg = '<path d="M18 44Q27 29 23 9M23 30L11 20M24 23L37 16" fill="none" stroke="#657e58" stroke-width="1.8"/><path d="M20 32Q9 32 9 24Q19 22 20 32M25 27Q38 29 38 21Q29 19 25 27" fill="#81996e" stroke="#455c44"/>'
  + [[23, 10, 1], [11, 20, .78], [37, 16, .86]].map(([x, y, s]) => `<g transform="translate(${x} ${y}) scale(${s})">${Array.from({ length: 5 }, (_, i) => `<ellipse cx="4" cy="0" rx="4.1" ry="3.1" transform="rotate(${i * 72})" fill="${i < 2 ? '#a6c3df' : '#749bbf'}" stroke="#526987" stroke-width=".8"/>`).join('')}<circle r="2" fill="#e7cd7e" stroke="#ab9862" stroke-width=".6"/><circle cx="-.5" cy="-.6" r=".65" fill="#faf0be" stroke="none"/></g>`).join('')
const tofuShape = '<path d="M7 16L30 10L42 18L42 34L18 41L7 32Z" fill="#d7d2bc"/><path d="M7 16L30 10L42 18L18 25Z" fill="#f3e9cd"/><path d="M18 25L42 18L42 34L18 41Z" fill="#b7b7aa"/><path d="M7 16L18 25L18 41L7 32Z" fill="#ddd6c0"/><path d="M10 17L19 22L38 18" fill="none" stroke="#fff7df" stroke-width="1"/><g fill="#9e9988" stroke="none" opacity=".6"><circle cx="12" cy="24" r=".9"/><circle cx="15" cy="32" r="1.1"/><circle cx="24" cy="28" r=".8"/><circle cx="36" cy="25" r="1"/><circle cx="31" cy="35" r=".7"/><circle cx="24" cy="17" r=".8"/></g><path d="M11 15Q12 12 14 14M32 13Q34 10 36 13M38 33Q42 34 40 37" fill="none" stroke="#e5dbc6" stroke-width=".8"/>'
const misoShape = '<path d="M7 23L11 17L38 17L42 24L39 40L11 40Z" fill="#80644b"/><ellipse cx="24" cy="22" rx="17" ry="8" fill="#b4a17c"/><ellipse cx="24" cy="22" rx="13.6" ry="5.6" fill="#81502f"/><path d="M12 22Q15 13 23 17Q32 10 36 20Q37 26 25 27Q14 28 12 22" fill="#b18147" stroke="#704b36" stroke-width=".9"/><path d="M15 19Q20 15 25 19M23 21Q29 16 33 21" fill="none" stroke="#d0a466" stroke-width="1.2"/><path d="M11 28L39 28M10 34L40 34" stroke="#4c4039" stroke-width="1.2"/><path d="M14 27L15 38M33 27L32 38" stroke="#bd9d70" stroke-width="2"/><g fill="#e0bd86" stroke="none"><circle cx="19" cy="22" r="1.1"/><circle cx="29" cy="19" r=".9"/><circle cx="30" cy="24" r=".8"/></g>'

const misoGround: GroundRenderer = ({ ctx: g, x, y }) => {
  g.save(); g.translate(x, y); g.lineJoin = 'round'; g.strokeStyle = '#382f38'; g.lineWidth = .9
  g.fillStyle = '#876d50'; g.beginPath(); g.moveTo(-8, -2); g.lineTo(8, -2); g.lineTo(6, 6); g.lineTo(-6, 6); g.closePath(); g.fill(); g.stroke()
  g.fillStyle = '#c1ab85'; g.beginPath(); g.ellipse(0, -2, 8, 3.5, 0, 0, Math.PI * 2); g.fill(); g.stroke()
  g.fillStyle = '#ae7a44'; g.beginPath(); g.ellipse(0, -3, 6, 2.5, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#d4ae75'; g.beginPath(); g.moveTo(-4, -3); g.quadraticCurveTo(0, -6, 4, -3); g.stroke(); g.restore()
}
const tofuGround: GroundRenderer = ({ ctx: g, x, y }) => {
  g.save(); g.translate(x, y); g.strokeStyle = '#443c47'; g.lineWidth = .8; g.lineJoin = 'round'
  for (const [path, color] of [['M-8-4L3-7L9-3L-2 1Z', '#f0e6cd'], ['M-8-4L-2 1L-2 8L-8 4Z', '#d8cfb8'], ['M-2 1L9-3L9 4L-2 8Z', '#b2b3a6']]) { const p = new Path2D(path); g.fillStyle = color; g.fill(p); g.stroke(p) }
  g.fillStyle = '#a09e90'; g.fillRect(3, 1, 1, 1); g.fillRect(-6, 1, 1, 1); g.restore()
}

const miso: ItemDef = { id: MISO_ID, kind: 'material', tier: 1, maxStack: 9999, color: '#b3844e', hi: '#ddbd84', text: '#d1b68a', icon: supplyIcon(misoShape), ground: misoGround, tags: ['food', 'ingredient'] }
const tofu: ItemDef = { id: KEDAMA_TOFU_ID, kind: 'material', tier: 1, maxStack: 9999, color: '#dbd5bd', hi: '#fff0d1', text: '#dfd8bf', icon: supplyIcon(tofuShape), ground: tofuGround, tags: ['food', 'ingredient', 'kedama'] }
const flower: ItemDef = { id: FORGET_ME_NOT_ID, kind: 'material', tier: 1, maxStack: 9999, color: '#83aaca', hi: '#c0d9e9', text: '#b3cce0', icon: supplyIcon(flowerSvg), ground: ({ ctx, x, y }) => { ctx.save(); ctx.translate(x, y + 7); ctx.scale(.6, .6); drawForgetMeNot(ctx); ctx.restore() }, tags: ['plant', 'flower'] }
export const fourthFloorMaterials = [miso, tofu, flower]
