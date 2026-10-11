import { svgIcon,type HeldWeaponView,type GroundRenderer,type WeaponMotionView } from '../../../types'
import { katanaBladeReveal,katanaReadyPose,katanaSheathing } from '../katanaForged/motion'
import { quantizeDir4 } from '../../../../../game/art/rig/skeleton'
import { SpriteCache,bakeSprite,drawSprite } from '../../../../../core/rendering/SpriteCache'
import { radialStamp } from '../../../../../core/rendering/RadialStamp'

const auraSprites=new SpriteCache(24,256*1024)
const TAU=Math.PI*2

/** 赤红游焰依附刀面向刀尖流动；薄雾烘焙为小贴图，零星光粒使用连续坐标。 */
function drawBladeAura(g:CanvasRenderingContext2D,time:number):void {
  const cycle=((time*.9)%1+1)%1*16,frame=Math.floor(cycle),mix=cycle-frame
  const draw=(index:number)=>drawSprite(g,auraSprites.get(String(index),()=>bakeSprite(2,-18,68,32,c=>{
    const phase=index/16*TAU,wave=Math.sin(phase)*2.4
    const ribbon=new Path2D(`M8-1Q20 ${-3+wave} 29-6Q36 ${-3-wave} 44-9Q48-15 60-12Q52-9 49-5Q38 0 25-1Q16 1 8-1Z`)
    c.strokeStyle='#d6186740';c.lineWidth=5;c.stroke(ribbon)
    c.fillStyle='#d8215a32';c.fill(ribbon)
    c.fillStyle='#ff39727d';c.fill(new Path2D(`M14-1Q27 ${-5-wave} 35-6Q29-5 25-1Q38-1 46-7Q44-10 52-13Q49-7 44-4Q30 2 14-1Z`))
    c.strokeStyle='#ff759974';c.lineWidth=.65;c.stroke(new Path2D(`M20-2Q32 ${-5+wave} 42-6M48-7Q52-11 59-12`))
  },1.5)))
  g.save();g.globalCompositeOperation='lighter'
  const alpha=g.globalAlpha
  g.globalAlpha=alpha*(1-mix);draw(frame)
  if(mix>.01){g.globalAlpha=alpha*mix;draw((frame+1)%16)}
  const spark=radialStamp('soul-blade-spark',0,[[0,'#ffb5c5b3'],[.2,'#f83f7b70'],[.55,'#ce175a21'],[1,'#ce175a00']])
  for(let i=0;i<5;i++){
    const age=((time*(.7+i*.09)+i*.237)%1+1)%1,x=13+((i*19)%43)+age*7,side=i%2?1:-1
    const y=-1.1-((x-5)/57)**2*4.8+side*(1.8+age*6),radius=2+(1-age)*2
    g.save();g.translate(x,y);g.scale(radius/128,radius/128);g.globalAlpha=alpha*(1-age)*.7;drawSprite(g,spark);g.restore()
    g.globalAlpha=alpha*(1-age)*.8;g.fillStyle=i%2?'#f85b8b':'#ff9aad';g.beginPath();g.ellipse(x,y,.35,.65,-.4,0,TAU);g.fill()
  }
  g.restore()
}

/** 长弧刀身占满对角线，短而细的缠柄与小刀镡保留太刀比例。 */
export const SOULSLAYER_ICON=svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <defs>
    <linearGradient id="soulMetal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#4b2639"/><stop offset=".4" stop-color="#191723"/><stop offset="1" stop-color="#0b0e18"/></linearGradient>
    <linearGradient id="soulRed" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#7b193c"/><stop offset=".55" stop-color="#e62e64"/><stop offset="1" stop-color="#ff7c9b"/></linearGradient>
    <path id="soulBlade" d="M12 33Q29.5 20 43.5 1.3Q31.8 23 14.1 35.2Z"/>
    <clipPath id="soulBladeClip"><use href="#soulBlade"/></clipPath>
  </defs>
  <path d="M13 33Q30 20 43 2" fill="none" stroke="#ee2d6b" stroke-width="3" opacity=".13"/>
  <path d="M5 44L11.6 34.3L13.9 36.1L7.2 45.7Z" fill="#211e2a" stroke="#10121b" stroke-width=".65"/>
  <path d="M6.1 42.7L8.5 43.5M7.8 40.3L10.1 41.1M9.5 37.9L11.8 38.8" stroke="#ae7685" stroke-width=".8"/>
  <path d="M4.8 44L7.5 45.9" stroke="#a58d64" stroke-width="1.15"/>
  <use href="#soulBlade" fill="url(#soulMetal)" stroke="#171520" stroke-width=".65"/>
  <g clip-path="url(#soulBladeClip)">
    <path d="M12 34Q21 27 28 19Q24 25 23 28Q34 18 43.5 1.3Q32 23 14.1 35.2Z" fill="url(#soulRed)"/>
    <path d="M15 33Q23 26 26 23Q25 27 20 31Q32 22 36 14Q33 22 27 27Z" fill="#161320"/>
    <path d="M17 32Q26 24 30 20M32 18Q38 10 42 4" fill="none" stroke="#ff6e92" stroke-width=".65"/>
    <path d="M14.1 35.2Q31.8 23 43.5 1.3" fill="none" stroke="#e9eded" stroke-width="1.15"/>
    <path d="M15 34.6Q32 22.9 42.8 2.5" fill="none" stroke="#fff7e7" stroke-width=".35"/>
  </g>
  <ellipse cx="12.7" cy="34.3" rx="3.3" ry="1.05" transform="rotate(38 12.7 34.3)" fill="#7e6242" stroke="#2e2430" stroke-width=".65"/>
  <path d="M10.6 32.8L14.9 35.9" stroke="#ccaf7b" stroke-width=".6"/>
  <path d="M26 22Q29 15 33 12Q30 19 30 21" fill="none" stroke="#e83a74" stroke-width="1" opacity=".35"/>
  <g fill="#ff7da2"><circle cx="33.5" cy="9.5" r=".55" opacity=".7"/><circle cx="23" cy="26" r=".4"/><circle cx="40" cy="18" r=".45" opacity=".55"/></g>
</svg>`)

/** 乌黑刀面内流过赤红焰脉，亮银刃口与外侧游焰分层，保留实体钢刃的轮廓。 */
export function drawSoulSlayer(g:CanvasRenderingContext2D,view:HeldWeaponView={}):void {
  g.save();g.lineJoin='round';g.strokeStyle='#211923';g.lineWidth=.8
  g.fillStyle='#27212c';g.beginPath();g.roundRect(-7.8,-1.55,10.8,3.1,.6);g.fill();g.stroke()
  g.strokeStyle='#80505a';g.lineWidth=.55;g.stroke(new Path2D('M-6-1L-4 .9M-2-1L0 .9'))
  g.fillStyle='#80684b';g.fillRect(-8.4,-1.65,1.3,3.3)
  g.beginPath();g.moveTo(2,-3.3);g.quadraticCurveTo(4,-4,5,-1.6);g.lineTo(4.5,2.3);g.quadraticCurveTo(2.5,4,1.4,1.4);g.closePath();g.fillStyle='#81623c';g.fill();g.stroke()
  g.strokeStyle='#c2a77a';g.lineWidth=.55;g.stroke(new Path2D('M2.3-2.5Q3.7-2.7 4.1-1.3'))
  const reveal=katanaBladeReveal(view.motion)
  if(reveal>0){
    g.save();g.beginPath();g.rect(4,-19,59*reveal,35);g.clip();drawBladeAura(g,view.motion?.time??view.time??0);g.restore()
    g.save();g.beginPath();g.rect(4,-8,59*reveal,13);g.clip()
    const blade=new Path2D('M5-1.5Q35-1.8 62-6.2Q59-1.2 52 .2Q27 3 5 1.5Z')
    const steel=g.createLinearGradient(0,-3,0,3);steel.addColorStop(0,'#482232');steel.addColorStop(.4,'#201724');steel.addColorStop(1,'#0c0e18')
    g.fillStyle=steel;g.fill(blade);g.strokeStyle='#16121d';g.lineWidth=.65;g.stroke(blade)
    g.save();g.clip(blade)
    const red=g.createLinearGradient(10,-3,44,3);red.addColorStop(0,'#ef3d70');red.addColorStop(.3,'#a21546');red.addColorStop(.7,'#6c1738');red.addColorStop(1,'#d13060')
    g.fillStyle=red;g.fill(new Path2D('M6 .6Q15-1 25-1.3Q21 .3 19 1Q30 .2 38-2.8Q45-2.3 52-4.2L61-5.7Q54-.6 42 .1Q24 3 6 1.2Z'))
    g.fillStyle='#17121e';g.fill(new Path2D('M8-1.8Q20-1.4 30-2.2Q25-.4 28 .2Q21 1.1 12 .6Q22-.4 8-1.8ZM38-3Q48-3.9 54-4.6Q49-1.7 43-1Q47-2.8 38-3Z'))
    g.strokeStyle='#f554879c';g.lineWidth=.65;g.stroke(new Path2D('M10 .3Q19-1.2 26-1M28 .7Q37-1 42-2.3M48-2.4Q55-3.1 60-5.2'))
    g.fillStyle='#d7dfdf';g.fill(new Path2D('M5 .9Q29 2.4 52-.4Q57-1.2 62-6.2Q59-1.2 52 .2Q27 3 5 1.5Z'))
    g.strokeStyle='#fff6e9';g.lineWidth=.5;g.beginPath();g.moveTo(6,1.3);g.quadraticCurveTo(30,2.8,52,-.1);g.quadraticCurveTo(58,-1.5,61,-5);g.stroke();g.restore();g.restore()
  }
  g.restore()
}
export const drawSoulGround:GroundRenderer=({ctx,x,y})=>{ctx.save();ctx.translate(x,y);ctx.rotate(-.72);ctx.scale(.42,.42);ctx.translate(-32,0);drawSoulSlayer(ctx);ctx.restore()}

/** 纯黑漆鞘只留细窄反光与深色金属包口，不在鞘身铺红色纹样或粒子。 */
export function drawSoulSheath(g:CanvasRenderingContext2D,v:WeaponMotionView&{x:number;y:number;bodyFacing:number;hand:{x:number;y:number;angle:number};supportHand:{x:number;y:number}}):void {
  const layout=katanaReadyPose(v,v.bodyFacing),angle=v.phase==='none'?v.hand.angle:layout.angle
  let x:number,y:number
  if(v.phase==='none'){x=v.hand.x+Math.cos(angle)*3;y=v.hand.y+Math.sin(angle)*3}
  else if(v.segment<2||katanaSheathing(v)>0){x=v.supportHand.x-Math.cos(angle)*3;y=v.supportHand.y-Math.sin(angle)*3}
  else{const mirror=quantizeDir4(v.bodyFacing)==='right'?-1:1;x=v.x+layout.main.x*mirror+Math.cos(angle)*3;y=v.y+layout.main.y+Math.sin(angle)*3}
  g.save();g.translate(x,y);g.rotate(angle);if(quantizeDir4(v.bodyFacing)==='right')g.scale(1,-1)
  const sheath=new Path2D('M0-1.45Q31-1 58-4.8L59-2.2Q31 1.9 0 1.45Z')
  const lacquer=g.createLinearGradient(0,-2,0,2);lacquer.addColorStop(0,'#3b3b43');lacquer.addColorStop(.22,'#17181f');lacquer.addColorStop(.65,'#080a10');lacquer.addColorStop(1,'#202129')
  g.fillStyle=lacquer;g.fill(sheath);g.strokeStyle='#090a10';g.lineWidth=.65;g.stroke(sheath)
  g.save();g.clip(sheath)
  g.strokeStyle='#a7aab34f';g.lineWidth=.45;g.stroke(new Path2D('M4-.7Q23-.4 39-2.2M45-2.9L54-4'))
  g.strokeStyle='#55596345';g.lineWidth=.35;g.stroke(new Path2D('M9 1Q31 1.2 51-1.7'));g.restore()
  g.fillStyle='#45464e';g.fillRect(-.5,-1.7,2,3.4);g.fillRect(56.4,-4.3,1.8,2.2);g.restore()
}
