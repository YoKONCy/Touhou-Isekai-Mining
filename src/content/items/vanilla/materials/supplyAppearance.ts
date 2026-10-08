import { svgIcon, type GroundRenderer } from '../../types'

/** 营地物资共享图标外框，具体形状由各资源提供。 */
export function supplyIcon(shape: string) {
  return svgIcon(`<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><g stroke="#302b38" stroke-width="1.6" stroke-linejoin="round">${shape}</g></svg>`)
}

export function supplyGround(color: string, shape: 'bundle' | 'mushroom' | 'gel' = 'bundle'): GroundRenderer {
  return ({ctx,x,y}) => {
    ctx.save();ctx.translate(x,y);ctx.fillStyle=color;ctx.strokeStyle='#302b38';ctx.lineWidth=1.2;ctx.beginPath()
    if(shape==='gel')ctx.ellipse(0,0,7,5,0,0,Math.PI*2)
    else if(shape==='mushroom'){ctx.moveTo(-6,0);ctx.quadraticCurveTo(0,-12,6,0);ctx.lineTo(2,1);ctx.lineTo(2,6);ctx.lineTo(-2,6);ctx.lineTo(-2,1)}
    else ctx.roundRect(-6,-4,12,8,2)
    ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#d5c6a4';ctx.fillRect(-3,-3,3,1);ctx.restore()
  }
}
