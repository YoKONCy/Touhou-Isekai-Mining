import { svgIcon, type ItemDef } from '../../types'

export const SALTPETER_ID = 'touhou:saltpeter'

/** 灰白结晶附着在浅色石基上，不使用贵重矿物的发光表现。 */
const saltpeter: ItemDef = {
  id: SALTPETER_ID, kind: 'material', tier: 1,
  color: '#b5b8ac', hi: '#e4e1cb', text: '#d4d5c2', maxStack: 9999,
  tags: ['material', 'mineral'],
  icon: svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><g stroke="#41434b" stroke-width="1.4" stroke-linejoin="round">
    <path d="M6 33L14 23L31 22L42 33L34 41L15 40Z" fill="#93968b"/>
    <path d="M12 30L14 16L19 10L24 17L22 32Z" fill="#d5d7c6"/>
    <path d="M24 33L25 14L31 8L35 15L33 34Z" fill="#c2c7bc"/>
    <path d="M32 34L37 22L41 20L43 27L38 36Z" fill="#e4e1cb"/>
    <path d="M14 16L19 19L24 17M25 14L30 18L35 15M19 19L18 30M30 18L29 32" fill="none" stroke="#f0edd8" stroke-width="1"/>
  </g></svg>`),
  ground: ({ctx,x,y}) => {
    ctx.save();ctx.translate(x,y);ctx.strokeStyle='#41434b';ctx.lineWidth=1
    ctx.beginPath();ctx.moveTo(-7,3);ctx.lineTo(-3,-5);ctx.lineTo(0,-7);ctx.lineTo(3,-3);ctx.lineTo(7,-4);ctx.lineTo(8,3);ctx.lineTo(2,6);ctx.closePath();ctx.fillStyle='#b5b8ac';ctx.fill();ctx.stroke()
    ctx.strokeStyle='#e4e1cb';ctx.beginPath();ctx.moveTo(-2,-4);ctx.lineTo(-3,2);ctx.moveTo(3,-2);ctx.lineTo(3,3);ctx.stroke();ctx.restore()
  }
}
export default saltpeter
