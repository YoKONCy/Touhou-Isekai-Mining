import type { EnemyAppearanceView } from '../types'
import { SpriteCache,bakeSprite,drawSprite } from '../../../core/rendering/SpriteCache'
import { drawBoarFire } from '../../../game/art/oldHellFire'

const sprites=new SpriteCache(8,256*1024)
const TAU=Math.PI*2

function shape(g:CanvasRenderingContext2D,d:string,fill:string|CanvasGradient,stroke?:string,width=1):void {
  const path=new Path2D(d);g.fillStyle=fill;g.fill(path)
  if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke(path)}
}

/** 厚颈、塌鼻吻和短壮四蹄形成猪的轮廓，皮肉明暗与烧焦细纹只烘焙一次。 */
function paintBody(g:CanvasRenderingContext2D,flash:boolean):void {
  g.lineJoin=g.lineCap='round'
  // 卷尾与远侧耳先画，保持前后遮挡关系。
  g.strokeStyle='#674344';g.lineWidth=3.2;g.beginPath();g.moveTo(-40,-12);g.bezierCurveTo(-57,-17,-59,-29,-51,-31);g.bezierCurveTo(-41,-34,-45,-20,-52,-25);g.stroke()
  g.strokeStyle='#d5a38c';g.lineWidth=1.3;g.stroke()
  shape(g,'M28-36Q28-58 40-61L45-44L39-31Z','#99685f','#49333a',1.4)
  const skin=g.createLinearGradient(-15,-51,16,24)
  skin.addColorStop(0,'#edbba1');skin.addColorStop(.3,'#d39987');skin.addColorStop(.65,'#b9786c');skin.addColorStop(1,'#784e4e')
  const outline='M-48-13Q-52-35-30-45Q-9-56 14-43Q30-44 41-30L46-17Q61-18 63-8L61 6Q49 16 37 12Q25 28-2 23Q-31 26-44 10Q-50 2-48-13Z'
  shape(g,outline,flash?'#fff0dc':skin,'#463137',1.8)
  const body=new Path2D(outline);g.save();g.clip(body)
  shape(g,'M-43-26Q-26-46-4-43Q13-39 21-26Q0-35-18-27Q-32-16-43-26Z','#f2c0a34b')
  shape(g,'M-46 1Q-27 17-8 14Q17 18 33 2L40 12Q23 29-4 24Q-34 26-46 10Z','#67494e58')
  shape(g,'M14-36Q21-39 29-31Q38-23 36-7Q34 6 25 11Q32-5 24-21Z','#8a514f65')
  shape(g,'M-31-17Q-26-26-14-29Q-2-31 7-25Q-14-27-25-12Z','#e3ab9252')
  // 烧焦纹顺着躯干弧面变化，只有局部缝隙透红，避免整身规则条纹。
  for(const d of ['M-30-40L-25-31L-27-22L-21-16','M-12-46L-6-37L-9-29L-4-25','M8-41L14-34L12-25L18-20','M-41-11L-34-7L-31 2L-23 6','M-7-14L-3-8L-6-2L-1 5','M18 6L22 0L20-5','M33-24L36-18L34-13']){
    g.strokeStyle='#49363b';g.lineWidth=2.2;g.stroke(new Path2D(d))
  }
  g.strokeStyle='#9b3933';g.lineWidth=1.05
  g.stroke(new Path2D('M-24-29L-26-22L-22-18M-7-36L-8-30M13-33L13-27M-33-6L-30 1M-4-7L-5-2M34-21L35-17'))
  for(let i=0;i<47;i++){
    const x=Math.sin(i*17.3)*43,y=-11+Math.cos(i*21.7)*29
    g.fillStyle=i%3?'#6d494330':'#f4cbb348';g.beginPath();g.ellipse(x,y,.45+(i%3)*.16,.35,0,0,TAU);g.fill()
  }
  g.restore()
  // 前耳、颊肉与鼻盘分开表现厚度，獠牙留在最前景。
  shape(g,'M24-35Q17-55 31-60Q42-54 40-35L34-26Z','#d6a18c','#533a40',1.3)
  shape(g,'M27-38Q24-51 31-55Q36-49 35-38Z','#9b615b')
  shape(g,'M36-22Q46-27 49-16L47 2Q39 9 33 2Q40-7 36-22Z','#bd8275')
  const snout=g.createLinearGradient(48,-15,62,10);snout.addColorStop(0,'#d9a08b');snout.addColorStop(.5,'#b7776c');snout.addColorStop(1,'#8b5656')
  shape(g,'M51-16Q63-18 65-7L63 5Q58 12 49 7L47-3Z',snout,'#654047',1.2)
  shape(g,'M54-7Q57-10 58-5L57 1L54 0ZM61-6Q63-8 63-4L62 1L60 0Z','#53343a')
  shape(g,'M34-19L43-20L41-14L35-13Z','#362b33')
  shape(g,'M38-18L41-18L40-15L38-15Z','#f1c575')
  g.strokeStyle='#754945';g.lineWidth=1.3;g.stroke(new Path2D('M32-23L43-25M42 5Q48 8 53 5'))
  shape(g,'M43 8Q54 4 54-6Q61 9 45 15Z','#e6ddba','#71594c',1)
  shape(g,'M45 10Q53 7 55 2L51 10Z','#fff0cf')
  g.strokeStyle='#f6c8ac70';g.lineWidth=.8;g.stroke(new Path2D('M-35-36Q-15-47 1-40M49-12Q57-17 61-10'))
}

function drawLeg(g:CanvasRenderingContext2D,x:number,y:number,angle:number,far:boolean):void {
  g.save();g.translate(x,y);g.rotate(angle)
  drawSprite(g,sprites.get(`leg:${far}`,()=>bakeSprite(-10,-8,22,32,c=>{
    shape(c,'M-7-7Q0-11 7-6L6 10L10 16L8 22L-7 22L-9 17L-6 9Z',far?'#885a54':'#c08a77','#50363b',1.2)
    shape(c,'M-6-5L0-7L1 10L-3 14L-6 10Z',far?'#a77b68':'#e0af91')
    shape(c,'M-9 17L1 15L9 17L8 23L-8 23Z','#383038','#201f29',1)
    c.strokeStyle='#79625b';c.lineWidth=.8;c.stroke(new Path2D('M-6 18L6 18M1 17L1 22'))
  })))
  g.restore()
}

export function drawBurningBoar(v:EnemyAppearanceView):void {
  const g=v.ctx,windup=v.pounceState==='windup',dash=v.pounceState==='lunge'
  const moving=Math.min(1,Math.hypot(v.vx,v.vy)/130),step=v.phase*(dash?5:3.2)
  const scrape=windup?Math.max(0,Math.sin(v.pounceProgress*TAU*2)):0
  g.save();g.translate(v.x,v.y+1);g.scale(v.facing==='left'?-1:1,1)
  g.scale(v.r/32,v.r/32)
  if(v.alive)drawBoarFire(g,v.phase)
  drawLeg(g,-27,8,Math.sin(step+Math.PI)*.3*moving,true)
  drawLeg(g,24,7,Math.sin(step)*.3*moving,true)
  g.save();g.translate(0,(windup?1.5:Math.sin(step*2)*moving)-scrape)
  g.scale(1+(v.alive?0:(1-v.alpha)*.14),1-(v.alive?0:(1-v.alpha)*.45))
  drawSprite(g,sprites.get(`body:${v.flash>0}`,()=>bakeSprite(-62,-64,132,94,c=>paintBody(c,v.flash>0))))
  g.restore()
  drawLeg(g,-32,13,Math.sin(step)*.3*moving,false)
  drawLeg(g,25+scrape*8,14-scrape*5,windup?-.25-scrape*.35:Math.sin(step+Math.PI)*.35*moving,false)
  if(v.alive)drawBoarFire(g,v.phase,true)
  g.restore()
}

/** 两次前蹄磨地留下短灰痕，鼻吻前的暖色尖角提示即将直冲的方向。 */
export function drawBoarWarning(v:EnemyAppearanceView):void {
  if(v.pounceState!=='windup'||!v.alive)return
  const g=v.ctx,k=v.pounceProgress,scrape=Math.max(0,Math.sin(k*TAU*2))
  g.save();g.translate(v.x,v.y);g.scale(Math.cos(v.pounceAngle)<0?-1:1,1)
  g.strokeStyle=`rgba(213,164,111,${scrape*.65})`;g.lineWidth=1.4
  g.stroke(new Path2D('M19 35L33 34M17 38L28 37'))
  for(let i=0;i<4;i++){g.fillStyle=`rgba(190,151,109,${scrape*.5})`;g.fillRect(15-i*6-scrape*8,31-i%2*3,2,1.5)}
  g.restore();g.save();g.translate(v.x,v.y);g.rotate(v.pounceAngle)
  g.globalAlpha*=.35+k*.45;g.strokeStyle='#ffc379';g.lineWidth=1.6;g.beginPath();g.moveTo(57,-9);g.lineTo(67,0);g.lineTo(57,9);g.stroke();g.restore()
}
