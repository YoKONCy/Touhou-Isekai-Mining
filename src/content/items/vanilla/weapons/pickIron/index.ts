import { addItemCelStop } from '../../../itemArt'
import { PICK_IRON_ID } from '../../ids'
import { svgIcon, type ItemDef } from '../../../types'
import { stats } from './stats'

const def: ItemDef = {
  ...stats,
  id: PICK_IRON_ID,
  kind: 'pick',
  color: '#8595a3',
  hi: '#d9e5e9',
  text: '#d9e5e9',
  icon: svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="pickHandle"><stop stop-color="#b69463"/><stop offset=".35" stop-color="#785538"/><stop offset=".7" stop-color="#a17b4e"/><stop offset="1" stop-color="#423126"/></linearGradient><linearGradient id="pickSteel" x2=".3" y2="1"><stop stop-color="#c4cbc2"/><stop offset=".3" stop-color="#7a8788"/><stop offset=".55" stop-color="#465359"/><stop offset=".8" stop-color="#909b97"/><stop offset="1" stop-color="#303c40"/></linearGradient></defs><path d="m13 55 6 3 24-41-7-4Z" fill="url(#pickHandle)" stroke="#29221c" stroke-width="1.8"/><path d="m16 54 21-36" stroke="#d2b78b" stroke-width=".9"/><path d="m21 43 5 3m-7 1 5 3m5-13 4 3" stroke="#493529" stroke-width="1.3"/><path d="M5 24Q19 7 36 9Q47 11 58 26L46 20 37 18 25 18Z" fill="url(#pickSteel)" stroke="#263238" stroke-width="1.8"/><path d="M8 22Q24 11 37 12Q47 15 54 23" fill="none" stroke="#d0d3be" stroke-width="1"/><path d="m24 18 10-6 9 6-4 7-10-4Z" fill="#465356" stroke="#293436"/><path d="m29 15 5-1 5 4-4 4-5-3Z" fill="#97a29b"/><circle cx="34" cy="18" r="1.6" fill="#323b3b"/><path d="m14 20 5-2m24-3 4 3m-7 3 3 2" stroke="#c2c6b6" stroke-width=".7"/><path d="m21 16 3 1m22 1 3 3" stroke="#39494b" stroke-width="1"/></svg>`),
  weapon: { autoRepeat: true, legacyHeld: true, drawHeld(ctx) {
    ctx.save()
    // 有厚度的锻铁双尖镐头，嵌套木柄与楔钉，不用单片弧线冒充铁器。
    const wood=ctx.createLinearGradient(0,-2,0,2)
    addItemCelStop(wood, 0,'#b5936b');addItemCelStop(wood, .4,'#896444');addItemCelStop(wood, 1,'#4e382e')
    ctx.fillStyle=wood;ctx.strokeStyle='#2d2626';ctx.lineWidth=1
    ctx.beginPath();ctx.roundRect(-5,-2,27,4,1);ctx.fill();ctx.stroke()
    ctx.strokeStyle='#5b4133';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(-3,.6);ctx.lineTo(19,.3);ctx.stroke()
    const head=new Path2D('M17-15Q28-7 27 0Q27 9 16 15L21 5 22 0 20-6Z')
    const steel=ctx.createLinearGradient(17,-12,27,10)
    addItemCelStop(steel, 0,'#c7c8c3');addItemCelStop(steel, .25,'#8b999d');addItemCelStop(steel, .5,'#404c58');addItemCelStop(steel, .8,'#929fa0');addItemCelStop(steel, 1,'#394450')
    ctx.fillStyle=steel;ctx.fill(head);ctx.strokeStyle='#303944';ctx.stroke(head)
    ctx.fillStyle='#637178';ctx.fillRect(18,-3.5,7,7);ctx.strokeRect(18,-3.5,7,7)
    ctx.fillStyle='#b4b6ad';ctx.fillRect(19,-3.3,5,.8);ctx.fillStyle='#3b4347';ctx.fillRect(21,-1.5,1.6,3)
    ctx.strokeStyle='#dfd9bc';ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(18,-13);ctx.quadraticCurveTo(27,-2,24,5);ctx.moveTo(23,8);ctx.lineTo(18,13);ctx.stroke()
    ctx.strokeStyle='#424d52';ctx.beginPath();ctx.moveTo(22,-8);ctx.lineTo(24,-6);ctx.moveTo(23,6);ctx.lineTo(21,8);ctx.stroke();ctx.restore()
  } }, tags: ['tool', 'pick']
}
export default def
