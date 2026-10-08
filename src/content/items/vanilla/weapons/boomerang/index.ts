import { addItemCelStop } from '../../../itemArt'
import { BOOMERANG_ID } from '../../ids'
import { stats } from './stats'
import { svgIcon, type ItemDef } from '../../../types'

/** 弯曲硬木翼面、磨亮铁箍与斜向木纹；飞行和握持共用器型。 */
export function drawBoomerang(ctx: CanvasRenderingContext2D): void {
  ctx.save()
  const shape = new Path2D('M-12-11Q-10-14-7-12L8-3Q12 0 8 3L-7 12Q-10 14-12 11L1 0Z')
  const wood = ctx.createLinearGradient(-12,-10,8,9)
  addItemCelStop(wood, 0,'#ba9568'); addItemCelStop(wood, .28,'#816048'); addItemCelStop(wood, .52,'#b08a5d'); addItemCelStop(wood, 1,'#4e3930')
  ctx.fillStyle=wood; ctx.fill(shape); ctx.strokeStyle='#2b2324'; ctx.lineWidth=1.3; ctx.stroke(shape)
  ctx.save(); ctx.clip(shape)
  ctx.strokeStyle='#4c362d99'; ctx.lineWidth=.6
  for(let i=0;i<5;i++){ ctx.beginPath(); ctx.moveTo(-13,-9+i*4); ctx.quadraticCurveTo(-2,-6+i*3,9,-2+i*2); ctx.stroke() }
  ctx.strokeStyle='#c1b699'; ctx.lineWidth=2.5
  for(const s of [-1,1]) {ctx.beginPath();ctx.moveTo(-8,s*8);ctx.lineTo(-5,s*11);ctx.stroke()}
  ctx.restore()
  ctx.strokeStyle='#d9be95';ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(-10,-11);ctx.lineTo(7,-2);ctx.stroke()
  ctx.fillStyle='#4b3830';ctx.fillRect(2,-1,2,2);ctx.restore()
}
const def: ItemDef = {
  ...stats,
  id: BOOMERANG_ID,
  kind: 'weapon',
  color: '#a87739',
  hi: '#e0b76c',
  text: '#e0b76c',
  icon: svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="boomWood" x2=".7" y2="1"><stop stop-color="#d3b284"/><stop offset=".25" stop-color="#78553b"/><stop offset=".5" stop-color="#ac8555"/><stop offset="1" stop-color="#423027"/></linearGradient><linearGradient id="boomIron"><stop stop-color="#484846"/><stop offset=".5" stop-color="#b5b5a3"/><stop offset="1" stop-color="#64635a"/></linearGradient></defs><path d="M10 9Q12 5 17 8L51 26Q59 32 51 38L17 56Q12 59 10 55L35 32Z" fill="url(#boomWood)" stroke="#261e19" stroke-width="2"/><path d="M13 10 49 29M16 52 39 35" stroke="#e0c397" fill="none" stroke-width="1"/><path d="m19 15 24 13m-25-9 17 10m-14 19 17-12m-23 8 15-10" stroke="#4f3527" stroke-width=".8" opacity=".7"/><path d="m15 12 6 3-4 7-5-5Zm-3 35 5-5 4 7-6 3Z" fill="url(#boomIron)" stroke="#34332d"/><path d="m40 27 8 5-8 5-3-5Z" fill="#513a2b"/><circle cx="43" cy="32" r="1.3" fill="#c5b78e"/><path d="m27 20 3 3m-4 22 4-2m-12-3 3-1" stroke="#d1b58c" stroke-width=".8"/></svg>`),
  weapon: { combo: false, drawHeld: drawBoomerang },
  tags: ['weapon', 'ranged']
}
export default def
