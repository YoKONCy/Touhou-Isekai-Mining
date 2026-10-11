import type { WeaponBodyMotion,WeaponMotionView,WeaponChargeView,WeaponImpactView } from '../../../types'
import { katanaBodyMotion } from '../katanaForged/motion'
import { radialStamp } from '../../../../../core/rendering/RadialStamp'
import { SpriteCache,bakeSprite,drawSprite } from '../../../../../core/rendering/SpriteCache'

export function soulBodyMotion(v:WeaponMotionView):WeaponBodyMotion|undefined {
  if(!v.charging&&!v.burst)return katanaBodyMotion(v)
  const lower=v.burst?1:Math.min(1,.3+(v.chargeProgress??0)*.7)
  return {facing:v.aim,rootY:lower*4.5,lean:lower*.11,tilt:lower*.035,
    legs:{near:{thigh:Math.PI/2-lower*.44,shin:Math.PI/2+lower*.5},far:{thigh:Math.PI/2+lower*.4,shin:Math.PI/2-lower*.42}}}
}

const noise=(seed:number,n:number)=>{const value=Math.sin(seed*.031+n*127.1+43.7)*43758.5453;return value-Math.floor(value)}
const slashSprites=new SpriteCache(1,32*1024)

/** 直而薄的双尖刃光只烘焙一次，光晕紧贴刃口，不使用弯曲粗带或椭圆光斑。 */
function sharpSlashSprite(){
  return slashSprites.get('hundred-sharp-slash',()=>bakeSprite(-2,-6,164,12,g=>{
    g.lineCap='butt'
    g.strokeStyle='#e8e4f323';g.lineWidth=5;g.beginPath();g.moveTo(8,0);g.lineTo(153,0);g.stroke()
    g.strokeStyle='#fff6ee4d';g.lineWidth=2.3;g.beginPath();g.moveTo(14,0);g.lineTo(151,0);g.stroke()
    const light=g.createLinearGradient(0,0,160,0)
    light.addColorStop(0,'#d4b9cf00');light.addColorStop(.15,'#e4d5e0a6');light.addColorStop(.47,'#fffaf4');light.addColorStop(.82,'#ffffff');light.addColorStop(1,'#fff9f100')
    g.fillStyle=light;g.beginPath();g.moveTo(0,0);g.lineTo(53,-.35);g.lineTo(124,-1);g.lineTo(160,0);g.lineTo(125,.7);g.lineTo(43,.25);g.closePath();g.fill()
    g.strokeStyle='#ffffffd9';g.lineWidth=.45;g.beginPath();g.moveTo(52,0);g.lineTo(151,0);g.stroke()
  },1.5))
}

/** 刃光横向面对玩家，沿矩形长边掠过；双刀倾角交错，长度与厚度各自变化。 */
export function drawHundredSlashes(g:CanvasRenderingContext2D,v:WeaponImpactView):void {
  const a=v.area
  if(!a)return
  const interval=a.duration/a.count,life=.078,sprite=sharpSlashSprite()
  g.save();g.translate(v.x,v.y);g.rotate(v.angle);g.beginPath();g.rect(0,-a.width/2,a.range,a.width);g.clip()
  for(let i=0;i<a.count*2;i++){
    const age=v.age-Math.floor(i/2)*interval
    if(age<0||age>=life)continue
    const tilt=(i%2?1:-1)*(.12+noise(a.seed,i*5+1)*.42),sine=Math.abs(Math.sin(tilt)),cosine=Math.cos(tilt)
    // 朝玩家的长边决定刀影长度，按倾角留下移动余量，让长刀尖完整留在判定范围内。
    const length=Math.min(a.width*(.80+noise(a.seed,i*5)*.25),(a.range-24)/Math.max(.001,sine),(a.width-24)/cosine)
    const depthMargin=sine*length/2+12,sideMargin=cosine*length/2+12
    const x=a.range/2+(noise(a.seed,i*5+2)-.5)*Math.max(0,a.range-depthMargin*2)
    const y=(noise(a.seed,i*5+3)-.5)*Math.max(0,a.width-sideMargin*2),thickness=.55+noise(a.seed,i*5+4)*1.55
    const fade=Math.min(1,age/.004)*Math.pow(1-age/life,1.6),direction=i%2?1:-1
    g.save();g.translate(x,y);g.rotate(Math.PI/2+tilt);g.globalCompositeOperation='lighter'
    // 残痕沿同一条直线向后拖，避免平行偏移把细刀影糊成粗虫状条带。
    for(let echo=2;echo>=0;echo--){
      const sampled=age-echo*.012
      if(sampled<=0)continue
      const sweep=Math.min(1,sampled/.018),travel=Math.min(1,sampled/.028)
      g.save();g.translate(direction*(-9+travel*16-echo*3),0)
      g.scale(length/160*(.70+sweep*.30),thickness);g.translate(-80,0)
      g.globalAlpha*=fade*(echo===0?1:.10);drawSprite(g,sprite);g.restore()
    }
    g.restore()
  }
  g.restore()
}

/** 蓄满后持续吸入气流与亮点，胸前凝聚白红光核，满蓄力瞬间另有一圈扩散闪光。 */
function drawGathering(g:CanvasRenderingContext2D,v:WeaponChargeView):void {
  const full=v.progress>=1-1e-8,pulse=.75+.25*Math.sin(v.time*10),strength=full?1:.15+v.progress*.3
  if(v.layer==='behind'){
    const aura=radialStamp('hundred-gather-body',0,[[0,'#f7d0dc75'],[.22,'#e0477970'],[.6,'#9d184331'],[1,'#4c122900']])
    g.save();g.translate(v.x,v.y-14);g.scale(full ? .36 : .23,full ? .43 : .28);g.globalAlpha*=strength*pulse;drawSprite(g,aura);g.restore()
    g.save();g.translate(v.x,v.y+5)
    for(let i=0;i<3;i++){
      const phase=(v.time*(full?1.8:1)+i/3)%1,r=8+(1-phase)*(full?27:17)
      g.save();g.globalAlpha*=strength*Math.sin(phase*Math.PI)*.7;g.strokeStyle=full?'#ffc9dc':'#b44366';g.lineWidth=full ? .9 : .6
      g.beginPath();g.ellipse(0,0,r,r*.30,0,0,Math.PI*2);g.stroke();g.restore()
    }
    g.restore();return
  }
  const cx=v.x+Math.cos(v.angle)*7,cy=v.y-12+Math.sin(v.angle)*3
  g.save();g.translate(cx,cy)
  const core=radialStamp('hundred-gather-core',0,[[0,'#fffaf4ed'],[.13,'#ffe5e1bd'],[.35,'#ef527d75'],[.7,'#b31a4324'],[1,'#80133000']])
  g.save();const radius=full?12+pulse*2:3+v.progress*4;g.scale(radius/128,radius/128);g.globalAlpha*=strength*pulse;drawSprite(g,core);g.restore()
  const count=full?18:8
  for(let i=0;i<count;i++){
    const phase=(v.time*(full?2.2:1.2)+i/count)%1,angle=i*2.399963+Math.sin(v.time*1.5+i)*.12
    const r=2+(1-phase)**1.3*(full?36:23),tail=full?4+(1-phase)*5:3
    const cos=Math.cos(angle),sin=Math.sin(angle),opacity=Math.sin(phase*Math.PI)*strength
    g.save();g.globalAlpha*=opacity;g.strokeStyle=full?'#ffedef':'#d96a85';g.lineWidth=full ? .8 : .55
    g.beginPath();g.moveTo(cos*(r+tail),sin*(r+tail)*.8);g.lineTo(cos*r,sin*r*.8);g.stroke()
    if(full){g.fillStyle='#fffaf1';g.fillRect(cos*r-.6,sin*r*.8-.6,1.2,1.2)}g.restore()
  }
  if(full){
    g.save();g.globalCompositeOperation='lighter';g.globalAlpha*=pulse
    g.strokeStyle='#fff5ed';g.lineWidth=.7;g.beginPath();g.moveTo(-4,0);g.lineTo(4,0);g.moveTo(0,-6);g.lineTo(0,6);g.stroke()
    if(v.readyAge>=0&&v.readyAge<.18){const r=5+v.readyAge*125;g.globalAlpha*=1-v.readyAge/.18;g.strokeStyle='#ffd5e1';g.lineWidth=1;g.beginPath();g.ellipse(0,0,r,r*.8,0,0,Math.PI*2);g.stroke()}
    g.restore()
  }
  g.restore()
}

/** 蓄势与六秒冷却共用黑红小条，红光由模拟时钟驱动，暂停时不会继续闪动。 */
export function drawHundredCharge(g:CanvasRenderingContext2D,v:WeaponChargeView):void {
  if(v.charging)drawGathering(g,v)
  if(v.layer==='behind')return
  if(!v.charging&&(v.cooldown??0)<=0)return
  const x=v.x-23,y=v.y+26,progress=v.charging?v.progress:1-(v.cooldown??0)/Math.max(.001,v.maxCooldown??6)
  const pulse=.5+.5*Math.sin(v.time*13),full=v.charging&&v.progress>=1-1e-8
  g.save();g.fillStyle='#100e17e8';g.strokeStyle=full?'#e67587':'#773043';g.lineWidth=.65;g.fillRect(x-1,y-1,48,6);g.strokeRect(x-1,y-1,48,6)
  g.fillStyle='#3b1724';g.fillRect(x,y,46,4)
  g.fillStyle=full?'#f3a2ae':'#b52d4d';g.fillRect(x,y,46*Math.max(0,Math.min(1,progress)),4)
  g.fillStyle=`rgba(255,94,123,${.25+pulse*.4})`;g.fillRect(x,y,46*Math.max(0,Math.min(1,progress)),1)
  const glow=radialStamp('hundred-cd-glow',0,[[0,'#ee3b6459'],[.45,'#a721451e'],[1,'#81153500']])
  g.translate(v.x,y+1);g.scale(.23,.035);g.globalAlpha*=.25+pulse*.4;drawSprite(g,glow);g.restore()
}
