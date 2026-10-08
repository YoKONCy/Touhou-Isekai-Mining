import type { EnemyAppearanceView } from '../types'

const WIDTH=76,HEIGHT=64,FRAMES=8
const sprites=new Map<string,HTMLCanvasElement>()

/** 下向和右向各八张扑翼帧；左向镜像右向，精灵本体不随移动角度旋转。 */
export function drawBatSprite(v:EnemyAppearanceView):void{
  const facing=v.facing??'down'
  const frame=v.alive?Math.floor(v.phase*16/(Math.PI*2)*FRAMES)%FRAMES:6
  const side=facing!=='down',lit=v.flash>0
  const key=`${side?'side':'down'}:${frame}:${lit?1:0}`
  let sprite=sprites.get(key)
  if(!sprite){
    sprite=document.createElement('canvas');sprite.width=WIDTH*2;sprite.height=HEIGHT*2
    const g=sprite.getContext('2d')!;g.scale(2,2);g.translate(WIDTH/2,HEIGHT/2)
    g.lineJoin='round';g.lineCap='round'
    const flap=Math.sin(frame/FRAMES*Math.PI*2)
    if(side)paintSide(g,flap,lit);else paintDown(g,flap,lit)
    sprites.set(key,sprite)
  }
  const bob=v.alive?Math.sin(v.phase*2)*1.1:0
  v.ctx.save();v.ctx.translate(v.x,v.y-6+bob)
  if(facing==='left')v.ctx.scale(-1,1)
  v.ctx.drawImage(sprite,-WIDTH/2,-HEIGHT/2,WIDTH,HEIGHT);v.ctx.restore()
}

function paintWing(g:CanvasRenderingContext2D,flap:number,lit:boolean):void{
  const span=24+flap*5,tipY=-4-flap*9
  g.beginPath();g.moveTo(4,-4);g.quadraticCurveTo(13,-10-flap*3,span,tipY)
  g.lineTo(span-4,tipY+8);g.quadraticCurveTo(16,3,14,10);g.quadraticCurveTo(9,5,7,11);g.lineTo(3,4);g.closePath()
  g.fillStyle=lit?'#ece2e8':'#6d5c72';g.strokeStyle='#2b2535';g.lineWidth=1.7;g.fill();g.stroke()
  g.strokeStyle=lit?'#fff6ee':'#b097a4';g.lineWidth=.8
  g.beginPath();g.moveTo(5,-3);g.lineTo(span,tipY);g.moveTo(5,-3);g.lineTo(14,10);g.moveTo(5,-3);g.lineTo(7,11);g.stroke()
  g.strokeStyle='#95829766';g.lineWidth=.6;g.beginPath();g.moveTo(9,-2);g.quadraticCurveTo(15,0,span-4,tipY+5);g.stroke()
}

/** 正面：两翼对称扑腾，圆润胸毛、耳廓和小爪维持稳定朝向。 */
function paintDown(g:CanvasRenderingContext2D,flap:number,lit:boolean):void{
  for(const side of [-1,1]){g.save();g.scale(side,1);paintWing(g,flap,lit);g.restore()}
  g.fillStyle=lit?'#f4e9e7':'#817584';g.strokeStyle='#302837';g.lineWidth=1.7
  g.beginPath();g.moveTo(-7,-6);g.quadraticCurveTo(-10,8,-4,11);g.quadraticCurveTo(0,14,4,11);g.quadraticCurveTo(10,8,7,-6);g.closePath();g.fill();g.stroke()
  for(const side of [-1,1]){
    g.beginPath();g.moveTo(side*2,-7);g.lineTo(side*7,-18);g.quadraticCurveTo(side*10,-9,side*6,-5);g.closePath();g.fillStyle=lit?'#eee4df':'#65516d';g.fill();g.stroke()
    g.fillStyle='#b18e9f';g.beginPath();g.moveTo(side*4,-8);g.lineTo(side*7,-14);g.lineTo(side*7,-7);g.closePath();g.fill()
  }
  g.fillStyle=lit?'#fff3df':'#c0afaa';g.beginPath();g.ellipse(0,4,4.5,5.5,0,0,Math.PI*2);g.fill()
  g.fillStyle='#32293d';g.beginPath();g.ellipse(0,-3,7.5,6.5,0,0,Math.PI*2);g.fill()
  for(const side of [-1,1]){
    g.fillStyle='#d7c4a0';g.beginPath();g.ellipse(side*3,-4,1.5,1.8,0,0,Math.PI*2);g.fill()
    g.fillStyle='#302936';g.fillRect(side*3-.4,-4.7,.8,1.3)
    g.strokeStyle='#ada6a4';g.lineWidth=1;g.beginPath();g.moveTo(side*3,10);g.lineTo(side*4,13);g.lineTo(side*5,12);g.stroke()
  }
  g.fillStyle='#b69098';g.beginPath();g.moveTo(-1.5,-.7);g.lineTo(1.5,-.7);g.lineTo(0,1);g.closePath();g.fill()
}

/** 侧面单独绘制：窄头吻、单眼与前后两层翼膜，不将正面图旋转成侧面。 */
function paintSide(g:CanvasRenderingContext2D,flap:number,lit:boolean):void{
  g.save();g.translate(-3,-1);g.scale(-.75,.72);paintWing(g,-flap*.55,lit);g.restore()
  g.fillStyle=lit?'#f4e9e7':'#796b7e';g.strokeStyle='#302837';g.lineWidth=1.7
  g.beginPath();g.ellipse(-1,2,8,10,.08,0,Math.PI*2);g.fill();g.stroke()
  g.save();g.translate(-3,-1);g.scale(-1,.9);paintWing(g,flap,lit);g.restore()
  g.beginPath();g.moveTo(0,-6);g.lineTo(2,-18);g.quadraticCurveTo(8,-12,6,-6);g.closePath();g.fillStyle=lit?'#eee4df':'#685371';g.fill();g.stroke()
  g.fillStyle='#b18e9f';g.beginPath();g.moveTo(2,-8);g.lineTo(3,-14);g.lineTo(5,-8);g.fill()
  g.fillStyle=lit?'#e8dbd9':'#7d7281';g.beginPath();g.moveTo(1,-8);g.quadraticCurveTo(10,-9,12,-3);g.lineTo(16,-.5);g.lineTo(11,3);g.quadraticCurveTo(3,6,0,1);g.closePath();g.fill();g.stroke()
  g.fillStyle='#cab8ad';g.beginPath();g.ellipse(10,1,4,2.5,0,0,Math.PI*2);g.fill()
  g.fillStyle='#e0caa1';g.beginPath();g.ellipse(7,-4,1.7,1.8,0,0,Math.PI*2);g.fill();g.fillStyle='#302837';g.fillRect(7,-4.7,.8,1.4)
  g.fillStyle='#b5939e';g.beginPath();g.arc(14,0,1.2,0,Math.PI*2);g.fill()
  g.strokeStyle='#b7ada8';g.lineWidth=1;g.beginPath();g.moveTo(-3,10);g.lineTo(-6,13);g.lineTo(-3,13);g.stroke()
}

/** 蝙蝠使用淡紫色蓄力圈与指针，方向标继续准确指向实际冲刺方向。 */
export function drawBatWarning(v:EnemyAppearanceView):void{
  if(!v.alive||v.pounceState!=='windup')return
  const g=v.ctx,k=v.pounceProgress,a=v.pounceAngle,d=v.r+14
  g.save();g.strokeStyle=`rgba(177,157,231,${.3+.5*k})`;g.lineWidth=1.7
  g.beginPath();g.arc(v.x,v.y,v.r+11-7*k,0,Math.PI*2);g.stroke()
  const x=v.x+Math.cos(a)*d,y=v.y+Math.sin(a)*d
  g.beginPath();g.moveTo(x+Math.cos(a)*(11+5*k),y+Math.sin(a)*(11+5*k))
  g.lineTo(x+Math.cos(a+2.5)*7,y+Math.sin(a+2.5)*7);g.lineTo(x+Math.cos(a-2.5)*7,y+Math.sin(a-2.5)*7);g.closePath()
  g.fillStyle=`rgba(185,165,238,${.6+.35*k})`;g.fill();g.strokeStyle='#e4daf1c4';g.lineWidth=.8;g.stroke();g.restore()
}
