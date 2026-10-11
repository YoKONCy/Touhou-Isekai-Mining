import type { EnemyAppearanceView } from '../types'
import { SpriteCache,bakeSprite,drawSprite } from '../../../core/rendering/SpriteCache'
import { drawLivingFire,paintMagmaShell,drawMagmaHeat } from '../../../game/art/oldHellFire'

const TAU=Math.PI*2
const sprites=new SpriteCache(32,512*1024)

function shape(g:CanvasRenderingContext2D,d:string,fill:string|CanvasGradient,stroke?:string,width=1):void {
  const path=new Path2D(d);g.fillStyle=fill;g.fill(path)
  if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke(path)}
}

/** 胶体内嵌大小错落的黄铁色矿片，缩石后收成暗色小矿块。 */
export function drawMineralSlime(v:EnemyAppearanceView):void {
  const g=v.ctx,stone=v.stoneGuard===true
  g.save();g.translate(v.x,v.y);g.scale(v.rx/v.r,v.ry/(v.r*.86))
  if(stone)g.scale(.65,.65)
  drawSprite(g,sprites.get(`mineral:${stone}:${v.flash>0}`,()=>bakeSprite(-24,-26,48,48,c=>{
    const base=c.createLinearGradient(-10,-20,8,17);base.addColorStop(0,'#b8ad82');base.addColorStop(.4,'#82765c');base.addColorStop(1,'#4e4541')
    shape(c,stone?'M-17 8L-16-7L-5-19L11-16L20-1L14 13L-5 16Z':'M-19 9Q-22-5-13-13Q-6-23 5-19Q19-16 21 1Q23 16 8 17L-8 17Q-17 17-19 9Z',v.flash>0?'#eee9d6':base,'#39333a',1.4)
    shape(c,'M-15-7L-6-17L2-10L-3 0L-15 1Z','#c2b388','#65584b',.7)
    shape(c,'M2-10L9-16L16-5L10 2L1-2Z','#a7956f','#65584b',.7)
    shape(c,'M-15 6L-6 1L1 8L-2 15L-12 13Z','#8f8060','#5c5147',.7)
    shape(c,'M10 5L18 1L17 10L9 14L5 10Z','#9a8862','#5c5147',.7)
    shape(c,'M-12-8L-6-13L-4-9L-8-4Z','#eadba477')
    shape(c,'M5-10L9-13L12-8L8-7Z','#e5cf9b88')
    c.strokeStyle='#dccca86b';c.lineWidth=.7;c.beginPath();c.moveTo(-15,9);c.lineTo(-8,6);c.moveTo(11,7);c.lineTo(15,5);c.stroke()
    if(!stone){c.fillStyle='#28282e';c.beginPath();c.ellipse(-6,2,2,2.7,0,0,TAU);c.ellipse(6,1,2,2.7,0,0,TAU);c.fill();c.fillStyle='#f9dfa1';c.fillRect(-6.6,.8,1.1,1.2);c.fillRect(5.4,-.2,1.1,1.2);c.strokeStyle='#30292f';c.beginPath();c.moveTo(-2,9);c.lineTo(3,9);c.stroke()}
  })))
  g.restore()
}

/** 厚玄武岩冷壳与内部热流分层，亮缝反射在粗糙断面上。 */
export function drawMagmaCreature(v:EnemyAppearanceView):void {
  const g=v.ctx;g.save();g.translate(v.x,v.y);g.scale(v.rx/v.r,v.ry/(v.r*.86))
  drawSprite(g,sprites.get(`magma-shell:${v.flash>0}`,()=>bakeSprite(-25,-25,50,49,c=>paintMagmaShell(c,v.flash>0))))
  drawMagmaHeat(g,v.phase,v.windup==='straight'?v.windupProgress:0)
  g.restore()
}

/** 小内核完全包在前后两层火幕中，辉光与上升火星随火势连续变化。 */
export function drawWispFire(g:CanvasRenderingContext2D,x:number,y:number,phase:number,scale=1):void {
  drawLivingFire(g,x,y,phase,scale)
}

export function drawFireWisp(v:EnemyAppearanceView):void {
  drawWispFire(v.ctx,v.x,v.y-3+Math.sin(v.phase*1.6)*2,v.phase)
}

export function drawWispBurstWarning(g:CanvasRenderingContext2D,x:number,y:number,k:number,angle:number,time:number):void {
  g.save();g.translate(x,y);g.strokeStyle='#ffce83';g.lineWidth=1.2;g.globalAlpha*=.55+k*.4
  g.beginPath();g.ellipse(0,4,21+k*7,10+k*3,0,0,TAU);g.stroke()
  for(let i=0;i<20;i++){const a=angle+i*TAU/20,r=24+k*6;g.beginPath();g.moveTo(Math.cos(a)*r,Math.sin(a)*r);g.lineTo(Math.cos(a)*(r+5),Math.sin(a)*(r+5));g.stroke()}
  // 临爆以收紧后膨胀的火冠告警，保留完整火幕，避免重新露出大白球。
  drawWispFire(g,0,-4,time*2.6,1+k*.65)
  g.restore()
}
