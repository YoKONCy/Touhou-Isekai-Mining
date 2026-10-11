import type { WeaponTrailView,WeaponImpactView } from '../../../types'
import { SpriteCache,bakeSprite,drawSprite } from '../../../../../core/rendering/SpriteCache'
import { radialStamp } from '../../../../../core/rendering/RadialStamp'
import { katanaSweep } from '../katanaForged/motion'

const FRAMES=16,DURATION=.25
const sprites=new SpriteCache(72,4*1024*1024)
const variation=(n:number)=>{const value=Math.sin(n*127.1+41.7)*43758.5453;return value-Math.floor(value)}

/** 保留半透明的充盈月弧，色块大小、断口和碎片疏密错开，不画等距齿纹与完整描边。 */
function paintSlash(g:CanvasRenderingContext2D,segment:number,p:number):void {
  g.lineJoin='miter'
  if(segment===2){
    const length=20+75*Math.min(1,p/.62)
    g.fillStyle='#c645566d';g.fill(new Path2D(`M13-5L${length*.38}-9L${length*.64}-5L${length} 0L${length*.75} 4L${length*.43} 3L17 7L25 0Z`))
    g.fillStyle='#21122170';g.fill(new Path2D(`M19-4L${length*.69}-5L${length*.47} 0L${length*.83} 2L27 4Z`))
    g.strokeStyle='#ee909a8a';g.lineWidth=.8;g.beginPath();g.moveTo(length*.6,-3);g.lineTo(length,-1);g.stroke();return
  }
  const direction=segment===1?-1:1,arc=segment===3?Math.PI:Math.PI*.4
  const sweep=katanaSweep(p),tip=direction*(-arc+arc*2*sweep),span=Math.min(arc*2*sweep,segment===3?2.9:1.9)
  if(span<.015)return
  const start=tip-direction*span,radius=95,seed=segment*3.17
  const outer=(u:number)=>radius+Math.sin(u*8+seed)*.9+Math.sin(u*19+seed+.7)*.65
  g.beginPath()
  for(let i=0;i<=28;i++){
    const u=i/28,a=start+(tip-start)*u,r=outer(u)
    if(i===0)g.moveTo(Math.cos(a)*r,Math.sin(a)*r);else g.lineTo(Math.cos(a)*r,Math.sin(a)*r)
  }
  for(let i=28;i>=0;i--){
    const u=i/28,a=start+(tip-start)*u,width=6+Math.sin(Math.PI*u)*(19+6*Math.sin(u*8+seed))+3*Math.sin(u*17+seed+.4)
    const r=outer(u)-width;g.lineTo(Math.cos(a)*r,Math.sin(a)*r)
  }
  g.closePath()
  const fill=g.createRadialGradient(0,0,54,0,0,100);fill.addColorStop(0,'#34132200');fill.addColorStop(.43,'#84253e48');fill.addColorStop(.8,'#c3475b86');fill.addColorStop(1,'#ed87959c')
  g.fillStyle=fill;g.fill()
  for(let i=0;i<4;i++){
    const u=.07+variation(i+segment*11)*.86,a=start+(tip-start)*u,r=79+variation(i+17)*9,d=.025+variation(i+29)*.12
    g.fillStyle=i===1?'#170f1e70':'#4b1b3048'
    g.beginPath();g.moveTo(Math.cos(a-direction*d)*(r-8),Math.sin(a-direction*d)*(r-8));g.lineTo(Math.cos(a+direction*d)*94,Math.sin(a+direction*d)*94);g.lineTo(Math.cos(a+direction*d*.2)*(r-4),Math.sin(a+direction*d*.2)*(r-4));g.closePath();g.fill()
    if(i===1)continue
    const edge=99+variation(i+43)*7,b=a-direction*(.02+variation(i+57)*.12),length=3+variation(i+71)*8
    g.fillStyle=i===0?'#ce58765c':'#8e30484a';g.beginPath();g.moveTo(Math.cos(b)*edge,Math.sin(b)*edge);g.lineTo(Math.cos(b+.025)*(edge+length),Math.sin(b+.025)*(edge+length));g.lineTo(Math.cos(b+.04+variation(i+83)*.06)*edge,Math.sin(b+.04+variation(i+83)*.06)*edge);g.closePath();g.fill()
  }
  g.strokeStyle='#f6abb685';g.lineWidth=.75
  for(const [from,to] of [[.03,.19],[.44,.7],[.87,.98]] as const){
    g.beginPath();for(let i=0;i<=7;i++){const u=from+(to-from)*i/7,a=start+(tip-start)*u,r=outer(u);if(i===0)g.moveTo(Math.cos(a)*r,Math.sin(a)*r);else g.lineTo(Math.cos(a)*r,Math.sin(a)*r)}g.stroke()
  }
}

export function drawSoulTrail(g:CanvasRenderingContext2D,v:WeaponTrailView):void {
  const p=Math.min(1,v.age/Math.max(.001,v.activeDuration??.16)),position=p*(FRAMES-1),frame=Math.floor(position),mix=position-frame
  const fade=Math.min(1,v.age/.018)*Math.pow(Math.max(0,1-v.age/DURATION),.8)
  if(fade<=0)return
  g.save();g.translate(v.x,v.y-3);g.rotate(v.angle)
  const alpha=g.globalAlpha*fade*.58
  const draw=(index:number)=>drawSprite(g,sprites.get(`${v.segment%4}:${index}`,()=>bakeSprite(-112,-112,224,224,c=>paintSlash(c,v.segment%4,index/(FRAMES-1)),1)))
  g.globalAlpha=alpha*(1-mix);draw(frame)
  if(mix>.01){g.globalAlpha=alpha*mix;draw(Math.min(FRAMES-1,frame+1))}
  g.restore()
}

/** 黑色气团从身体四周收拢，缩进命中点后消失；只负责表现，不施加额外状态。 */
export function drawSoulInward(g:CanvasRenderingContext2D,v:WeaponImpactView):void {
  const p=Math.min(1,v.age/.34),fade=Math.sin(Math.PI*p)*.72
  if(fade<=0)return
  const stamp=radialStamp('soul-inward-smoke',0,[[0,'#100b19e0'],[.35,'#160d1eb0'],[.7,'#25112848'],[1,'#10091900']])
  for(let i=0;i<8;i++){
    const a=i*2.399+v.angle,distance=(27+(i%3)*5)*(1-p)**1.7,radius=(6+i%3*2)*(1-p*.55)
    g.save();g.translate(v.x+Math.cos(a)*distance,v.y-7+Math.sin(a)*distance*.72);g.scale(radius/128,radius/128);g.globalAlpha*=fade;drawSprite(g,stamp);g.restore()
  }
}

export const SOUL_TRAIL_DURATION=DURATION
