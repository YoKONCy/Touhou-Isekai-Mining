import { svgIcon, type ItemDef } from '../../types'

export const FRAGRANT_MUSHROOM_ID = 'touhou:fragrant_mushroom'

/** 厚褐伞、短乳白柄与偏心裂纹；同一造型用于采集点和地面掉落。 */
export function drawFragrantMushroom(g: CanvasRenderingContext2D): void {
  g.save()
  g.lineJoin = 'round'
  g.strokeStyle = '#29232d'; g.lineWidth = 1.1
  g.beginPath(); g.moveTo(-2,-8); g.bezierCurveTo(-3,-4,-5,0,-2,1); g.quadraticCurveTo(3,3,3,0); g.lineTo(2,-9); g.closePath()
  g.fillStyle = '#c9baa0'; g.fill(); g.stroke()
  g.strokeStyle = '#89796b'; g.lineWidth = .7
  g.beginPath(); g.moveTo(0,-7); g.quadraticCurveTo(-1,-3,0,0); g.stroke()
  g.beginPath(); g.ellipse(0,-8,10,3.5,-.08,0,Math.PI*2)
  g.fillStyle = '#b4a18d'; g.fill(); g.strokeStyle = '#29232d'; g.lineWidth = 1.1; g.stroke()
  // 菌褶微带灰紫，偏斜伞沿比普通簇生蘑菇更厚。
  g.strokeStyle = '#76677a'; g.lineWidth = .65
  for(let i=-7;i<=7;i+=2){g.beginPath();g.moveTo(i*.35,-8);g.lineTo(i,-6.5+Math.abs(i)*.06);g.stroke()}
  g.beginPath(); g.moveTo(-11,-8); g.bezierCurveTo(-11,-20,6,-23,10,-13); g.quadraticCurveTo(13,-8,8,-7); g.quadraticCurveTo(-2,-5,-11,-8); g.closePath()
  g.fillStyle = '#674b42'; g.fill(); g.strokeStyle = '#29232d'; g.lineWidth = 1.2; g.stroke()
  g.beginPath();g.moveTo(-9,-10);g.bezierCurveTo(-8,-18,1,-21,6,-16);g.quadraticCurveTo(0,-18,-4,-12);g.closePath();g.fillStyle='#94705b';g.fill()
  // 裂花围着偏心暗斑分叉，带一点不自然的放射感，但不画眼睛或发光。
  g.strokeStyle='#c4af8d';g.lineWidth=.8
  g.beginPath();g.moveTo(2,-15);g.lineTo(-1,-17);g.lineTo(-4,-16);g.moveTo(-1,-17);g.lineTo(-2,-19);g.moveTo(3,-14);g.lineTo(6,-16);g.moveTo(3,-12);g.lineTo(5,-10);g.lineTo(8,-10);g.moveTo(0,-12);g.lineTo(-3,-10);g.stroke()
  g.fillStyle='#473a48';g.beginPath();g.ellipse(2,-14,1.4,1,-.35,0,Math.PI*2);g.fill()
  g.restore()
}

const fragrantMushroom: ItemDef = {
  id: FRAGRANT_MUSHROOM_ID, kind: 'consumable', tier: 1,
  color: '#795a49', hi: '#c4af8d', text: '#d2bfa1', maxStack: 9999,
  consume: { heal: 5 }, material: true, tags: ['food', 'mushroom'],
  icon: svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><g stroke="#29232d" stroke-width="1.5" stroke-linejoin="round">
    <!-- 短柄与微紫菌褶。 -->
    <path d="M21 26Q21 34 17 39Q24 44 30 38L28 25" fill="#c9baa0"/>
    <ellipse cx="24" cy="26" rx="17" ry="6" fill="#b4a18d"/>
    <path d="M12 28L21 25M17 30L23 26M29 26L35 29" stroke="#76677a" stroke-width="1"/>
    <!-- 厚褐伞与偏心裂花，区别于灰紫簇生蘑菇。 -->
    <path d="M6 25Q5 8 23 7Q39 5 42 24Q37 32 6 25Z" fill="#674b42"/>
    <path d="M9 22Q11 9 26 10Q19 10 15 20Z" fill="#94705b" stroke="none"/>
    <path d="M27 17L21 13L16 15M21 13L20 10M29 19L35 14M27 22L32 25L37 24M23 22L18 25" fill="none" stroke="#c4af8d" stroke-width="1.3"/>
    <ellipse cx="27" cy="19" rx="2" ry="1.5" fill="#473a48" stroke="none"/>
  </g></svg>`),
  ground: ({ctx,x,y}) => { ctx.save(); ctx.translate(x,y+6); ctx.scale(.65,.65); drawFragrantMushroom(ctx); ctx.restore() }
}
export default fragrantMushroom
