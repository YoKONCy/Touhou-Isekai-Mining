import { SpriteCache,bakeSprite,drawSprite,type RasterSprite } from '../../core/rendering/SpriteCache'
import { radialStamp } from '../../core/rendering/RadialStamp'

const TAU=Math.PI*2,FRAMES=24
const sprites=new SpriteCache(192,4*1024*1024)

/** 火焰轮廓、热流和辉光分别绘制；昂贵的渐变只在小贴图首次烘焙时创建。 */
function path(g:CanvasRenderingContext2D,d:string,fill:string|CanvasGradient):void {
  g.fillStyle=fill;g.fill(new Path2D(d))
}

function gradient(g:CanvasRenderingContext2D,x0:number,y0:number,x1:number,y1:number,stops:readonly [number,string][]):CanvasGradient {
  const fill=g.createLinearGradient(x0,y0,x1,y1)
  for(const [at,color] of stops)fill.addColorStop(at,color)
  return fill
}

function haze(g:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,power:number):void {
  g.save();g.translate(x,y);g.scale(rx/128,ry/128);g.globalCompositeOperation='lighter';g.globalAlpha*=power
  drawSprite(g,radialStamp('old-hell-fire-bloom',0,[[0,'#ffc86f9c'],[.2,'#ef98385e'],[.5,'#d15b2627'],[1,'#ba3b1800']]))
  g.restore()
}

/** 相邻轮廓交叠过渡，细火舌不再按八张贴图跳变；底层始终保持完整亮度。 */
function animated(g:CanvasRenderingContext2D,key:string,phase:number,bake:(phase:number)=>RasterSprite):void {
  const position=((phase/TAU%1)+1)%1*FRAMES,index=Math.floor(position),mix=position-index
  const alpha=g.globalAlpha,additive=g.globalCompositeOperation==='lighter'
  if(additive)g.globalAlpha=alpha*(1-mix)
  drawSprite(g,sprites.get(`${key}:${index}`,()=>bake(index/FRAMES*TAU)))
  g.globalAlpha=alpha
  if(mix>.01){
    g.save();g.globalAlpha*=mix
    drawSprite(g,sprites.get(`${key}:${(index+1)%FRAMES}`,()=>bake((index+1)/FRAMES*TAU)))
    g.restore()
  }
}

/** 一片由宽根收束到卷曲尖端的火舌，弯曲量取连续周期函数。 */
function tongue(g:CanvasRenderingContext2D,x:number,y:number,width:number,height:number,bend:number,fill:string|CanvasGradient):void {
  const tipX=x+bend,tipY=y-height
  g.beginPath();g.moveTo(x-width*.55,y)
  g.bezierCurveTo(x-width*.95,y-height*.3,tipX-width*.4,tipY+height*.35,tipX,tipY)
  g.bezierCurveTo(tipX-width*.15,tipY+height*.25,x+width*.9,y-height*.35,x+width*.5,y)
  g.quadraticCurveTo(x,y+width*.2,x-width*.55,y);g.closePath();g.fillStyle=fill;g.fill()
}

function paintWisp(g:CanvasRenderingContext2D,t:number):void {
  const outer=gradient(g,-10,15,6,-39,[[0,'#b64524'],[.24,'#ed7e26'],[.6,'#e9691deb'],[1,'#b83f2633']])
  // 后侧火冠先包围身体，宽根彼此交叠，避免独立几根线条插在球上。
  for(let i=0;i<7;i++){
    const a=i*1.83,x=(i-3)*4.3,height=25+7*Math.sin(t+a)+8*(1-Math.abs(i-3)/4)
    tongue(g,x,7+Math.abs(i-3)*.3,12-Math.abs(i-3),height,Math.sin(t+a)*7,outer)
  }
  const body=g.createRadialGradient(-3,-5,1,0,1,18)
  body.addColorStop(0,'#ffc76c');body.addColorStop(.42,'#f9a83b');body.addColorStop(.77,'#e47126');body.addColorStop(1,'#913628b3')
  path(g,'M-16 0Q-20 12-7 16Q4 20 14 11Q21 3 13-8Q7-17-4-13Q-14-13-16 0Z',body)
  // 苍白核缩到原来的约三分之一，随后再被前景火幕盖住，没有裸露白球轮廓。
  const core=g.createRadialGradient(-1,0,.4,0,1,5)
  core.addColorStop(0,'#fff4cf');core.addColorStop(.65,'#f8dda4');core.addColorStop(1,'#f6ba5477')
  g.fillStyle=core;g.beginPath();g.ellipse(0,1,4.5,4.8,-.2,0,TAU);g.fill()
  const middle=gradient(g,0,15,0,-28,[[0,'#ed7d22'],[.3,'#ffd06acb'],[.62,'#ffc045e8'],[1,'#e56d2455']])
  for(let i=0;i<6;i++){
    const a=i*2.13,x=(i-2.5)*4.8
    tongue(g,x,12,10.5,22+8*Math.sin(t+a),Math.sin(t+a+.8)*8,middle)
  }
  // 前侧卷流遮住内核，并留少量浅金高温薄边；颜色沿火舌高度连续过渡。
  const front=gradient(g,-9,14,8,-20,[[0,'#d75e20'],[.3,'#f39425ed'],[.65,'#ffda76cc'],[1,'#ffe2a140']])
  tongue(g,-5,13,16,25+3*Math.sin(t+1),11+3*Math.cos(t),front)
  tongue(g,7,12,13,29+5*Math.sin(t+3),-13+4*Math.sin(t+1),front)
  g.save();g.globalCompositeOperation='lighter'
  const fine=gradient(g,0,8,0,-20,[[0,'#ffe1a000'],[.45,'#ffdf9a70'],[1,'#fff4c800']])
  tongue(g,-4,9,2.5,22+3*Math.sin(t),6+3*Math.cos(t),fine)
  tongue(g,5,6,2,23+2*Math.sin(t+2),-5+3*Math.sin(t),fine)
  g.restore()
}

export function drawLivingFire(g:CanvasRenderingContext2D,x:number,y:number,phase:number,scale=1):void {
  const t=phase*2.4
  g.save();g.translate(x,y);g.scale(scale,scale)
  haze(g,0,-5,39,43,.76+.05*Math.sin(t*2))
  g.rotate(Math.sin(t)*.025)
  animated(g,'wisp',t,p=>bakeSprite(-25,-44,50,66,c=>paintWisp(c,p)))
  // 上升火星保持连续坐标，不依赖贴图切帧，也不进入模拟随机源。
  g.globalCompositeOperation='lighter'
  const alpha=g.globalAlpha
  for(let i=0;i<4;i++){
    const age=((t/TAU+i*.27)%1+1)%1,side=i%2?1:-1
    const px=side*(11+Math.sin(age*4+i)*5),py=6-age*42
    g.globalAlpha=alpha*(1-age);g.fillStyle=i%2?'#ffc263':'#f8df9a';g.beginPath();g.ellipse(px,py,.65,1.2-age*.5,-side*.3,0,TAU);g.fill()
  }
  g.restore()
}

/** 浅地火没有熔岩底坑；火舌与暖光共用缓存，短寿命路径只更新透明度与相位。 */
export function drawGroundFire(g:CanvasRenderingContext2D,x:number,y:number,phase:number,scale=1):void {
  g.save();g.translate(x,y);g.scale(scale,scale)
  haze(g,0,-2,30,23,.32)
  animated(g,'ground-fire',phase*2,t=>bakeSprite(-25,-27,50,38,c=>{
    const outer=gradient(c,0,6,0,-25,[[0,'#cd582654'],[.3,'#ed8a36aa'],[.65,'#ffc869a3'],[1,'#e9862a00']])
    const inner=gradient(c,0,5,0,-18,[[0,'#e5822b55'],[.45,'#ffe09baa'],[1,'#ffc16000']])
    for(let i=0;i<5;i++){
      const seed=i*1.91,x=(i-2)*7,height=12+Math.sin(t+seed)*5
      tongue(c,x,3+Math.sin(seed)*2,12,height,Math.sin(t+seed)*5,outer)
      tongue(c,x,4,5,height*.7,Math.sin(t+seed+.7)*3,inner)
    }
  }))
  g.restore()
}

/** 野猪火冠沿宽背分布，前后火幕分层包裹皮肉，不遮住鼻吻和蹄子的读形。 */
export function drawBoarFire(g:CanvasRenderingContext2D,phase:number,front=false):void {
  if(!front)haze(g,-3,-18,91,72,.67)
  animated(g,front?'boar-fire-front':'boar-fire-back',phase*2,t=>bakeSprite(-70,-90,140,125,c=>{
    const fill=gradient(c,0,18,0,-85,front?[[0,'#f0842711'],[.35,'#ffbc564b'],[.65,'#ffd58f7b'],[1,'#e1742a00']]:[[0,'#a936262e'],[.35,'#e87b29c4'],[.72,'#f8aa3baf'],[1,'#cc5b2300']])
    for(let i=0;i<(front?6:10);i++){
      const x=front?(i-2.5)*15:(i-4.5)*11.5,seed=i*1.73
      const base=front?14:-12-Math.max(0,1-Math.abs(x)/65)*20
      const height=(front?25:38)+Math.sin(t+seed)*(front?7:13)
      tongue(c,x,base,front?19:24,height,Math.sin(t+seed)*11,fill)
    }
  },1.5))
}

/** 熔岩怪的粗糙冷壳：厚度、断面、孔洞与受热边缘都属于静态材质。 */
export function paintMagmaShell(g:CanvasRenderingContext2D,flash:boolean):void {
  const outline=new Path2D('M-19-15L-12-20L11-20L19-14L21 9L15 17L-14 18L-21 10L-22-8Z')
  g.fillStyle=gradient(g,-15,-20,16,18,[[0,'#85624b'],[.25,'#493d39'],[.6,'#30292d'],[1,'#1c1c24']]);g.fill(outline)
  g.strokeStyle='#211e24';g.lineWidth=1.2;g.stroke(outline)
  g.save();g.clip(outline)
  path(g,'M-21-13L-11-20L-4-17L-6-7L-18-3L-22-6Z',gradient(g,-16,-18,-8,-2,[[0,'#a08260'],[.22,'#78654f'],[1,'#483b36']]))
  path(g,'M-1-18L9-19L18-13L14-5L6-2L-5-7Z',gradient(g,0,-19,10,-3,[[0,'#7d6d5d'],[.4,'#514740'],[1,'#352c2f']]))
  path(g,'M-21 1L-17-2L-7-4L-2 6L-6 14L-15 16L-21 9Z',gradient(g,-17,-1,-2,15,[[0,'#574841'],[.5,'#3a3033'],[1,'#25242b']]))
  path(g,'M5 1L16-3L20-10L20 8L14 16L2 14L0 9Z',gradient(g,9,0,18,15,[[0,'#4c3b37'],[.6,'#30262b'],[1,'#201f27']]))
  path(g,'M-9 16L-5 10L2 13L11 16L5 19L-9 19Z','#1f1f27')
  // 孔隙散布在岩片内部，疏密与大小不齐；缓存生成不消耗游戏随机数。
  for(let i=0;i<85;i++){
    const x=Math.sin(i*27.1+2)*19,y=Math.sin(i*17.7+7)*18,r=.25+(Math.sin(i*13.9)+1)*.45
    g.fillStyle=i%4?'#16171c35':'#c9a5772f';g.beginPath();g.ellipse(x,y,r,r*.6,i,0,TAU);g.fill()
  }
  g.strokeStyle='#b4936e65';g.lineWidth=.65;g.beginPath();g.moveTo(-20,-12);g.lineTo(-12,-18);g.lineTo(-7,-16);g.moveTo(1,-17);g.lineTo(9,-17);g.lineTo(15,-12);g.stroke()
  // 眼窝是壳内凹陷，发光只保留底部一条细线，不做贴在脸上的亮色方块。
  path(g,'M-13-3L-6-2L-5 2L-11 3L-14 0Z','#17151c')
  path(g,'M6-3L13-5L15-1L11 2L5 1Z','#17151c')
  path(g,'M-5 8L1 6L7 8L5 12L-3 13L-6 11Z','#17151c')
  if(flash){g.globalCompositeOperation='screen';g.globalAlpha=.55;g.fillStyle='#ffe2ab';g.fill(outline)}
  g.restore()
}

const SEAMS='M-5-18L-7-11L-6-5L-2 1L-3 7L-6 14M-6-5L3-3L9-4L16-9M-2 1L6 4L13 2L19 4M-18-1L-13 0M-3 7L1 10L8 13'

export function drawMagmaHeat(g:CanvasRenderingContext2D,phase:number,windup:number):void {
  haze(g,0,2,29,26,.23+windup*.25)
  g.save();g.globalCompositeOperation='lighter';g.globalAlpha*=.75+windup*.25
  animated(g,'magma-heat',phase*1.5,t=>bakeSprite(-27,-27,54,53,c=>{
    const seam=new Path2D(SEAMS),heat=.74+.12*Math.sin(t)+.1*Math.sin(t*2+.7)
    c.lineJoin=c.lineCap='round'
    c.strokeStyle=`rgba(211,73,23,${heat*.33})`;c.lineWidth=7;c.stroke(seam)
    c.strokeStyle=`rgba(249,126,35,${heat*.7})`;c.lineWidth=2.7;c.stroke(seam)
    c.strokeStyle='#ffd175';c.lineWidth=.85;c.stroke(seam)
    c.strokeStyle='#ffe6a3b0';c.lineWidth=.4;c.beginPath();c.moveTo(-5,-17);c.lineTo(-7,-11);c.moveTo(3,-3);c.lineTo(9,-4);c.moveTo(-2,2);c.lineTo(-3,6);c.stroke()
    c.strokeStyle='#ffbc68';c.lineWidth=1;c.beginPath();c.moveTo(-11,1);c.lineTo(-7,1);c.moveTo(7,0);c.lineTo(12,-1);c.stroke()
    const mouth=c.createRadialGradient(1,9,.5,1,9,6);mouth.addColorStop(0,'#ffca8177');mouth.addColorStop(1,'#db6d2700');c.fillStyle=mouth;c.fillRect(-6,3,14,14)
  }))
  if(windup>0){haze(g,1,9,12,9,windup*.7);g.fillStyle='#ffd491';g.beginPath();g.ellipse(1,10,2+windup*2,1.5,0,0,TAU);g.fill()}
  g.restore()
}

function paintMagmaBall(g:CanvasRenderingContext2D,t:number):void {
  const tail=gradient(g,-38,0,8,0,[[0,'#d5531e00'],[.25,'#c74b1c50'],[.7,'#f48d2ccd'],[1,'#ffd27a']])
  path(g,`M9-4Q-3-10-14-4Q-23 ${-7+Math.sin(t)*2}-37-2Q-20 1-27 7Q-13 1-5 6Q8 11 11 2Z`,tail)
  const body=g.createRadialGradient(-2,-3,1,0,0,10)
  body.addColorStop(0,'#ffde8a');body.addColorStop(.32,'#ffba4a');body.addColorStop(.72,'#e57726');body.addColorStop(1,'#84352a')
  g.fillStyle=body;g.beginPath();g.ellipse(0,0,9,8.3,-.12,0,TAU);g.fill()
  // 冷却的小片玄武岩随熔体缓慢转动，破碎边缘透出细窄热缝。
  g.save();g.rotate(t)
  path(g,'M-7-5L-2-7L0-3L-2 0L-6-1Z',gradient(g,-6,-6,0,0,[[0,'#79604b'],[1,'#3e3030']]))
  path(g,'M3-5L7-2L7 2L4 3L2 0Z','#54352d')
  path(g,'M-6 3L-3 1L1 4L0 7L-4 6Z','#633b2e')
  g.strokeStyle='#ffd381a0';g.lineWidth=.5;g.beginPath();g.moveTo(-6,-5);g.lineTo(-2,-6);g.moveTo(4,4);g.lineTo(3,6);g.stroke();g.restore()
  path(g,'M-18-1Q-10-4-5-1Q-1 1 4-2Q0 3-6 1Q-11-1-18-1Z','#ffcf6e90')
}

function paintFlameBolt(g:CanvasRenderingContext2D,t:number):void {
  const fill=gradient(g,-39,0,8,0,[[0,'#c8432300'],[.25,'#df64243d'],[.65,'#f4982cda'],[1,'#ffd77b']])
  path(g,`M9 0Q4-10-8-6Q-15 ${-12+Math.sin(t)*3}-30-6Q-20-4-39 1Q-20 3-28 8Q-13 3-7 7Q5 10 9 0Z`,fill)
  const middle=gradient(g,-27,0,8,0,[[0,'#ffca6100'],[.5,'#ffc452bf'],[1,'#fff0b4']])
  path(g,`M7 0Q0-5-10-2Q-17 ${-5+Math.sin(t+1)*2}-28 0Q-18-1-14 3Q-3 1 2 4Q7 3 7 0Z`,middle)
  path(g,'M5-1Q2-3-2-1L-8 0Q0 2 5-1Z','#fff1baae')
}

export function drawMoltenProjectile(g:CanvasRenderingContext2D,x:number,y:number,angle:number,phase:number,magma:boolean):void {
  g.save();g.translate(x,y);g.rotate(angle)
  haze(g,-2,0,magma?27:25,magma?22:16,magma ? .58 : .48)
  animated(g,magma?'magma-ball':'flame-bolt',phase,t=>bakeSprite(-43,-15,60,30,c=>(magma?paintMagmaBall:paintFlameBolt)(c,t)))
  g.restore()
}
