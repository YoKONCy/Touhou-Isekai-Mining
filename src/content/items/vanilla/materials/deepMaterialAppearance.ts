import type { GroundRenderer } from '../../types'

/** 蝙蝠翼保留关节断口、扇状翼骨、柔韧翼膜和不规则薄边。 */
export const batWingIconShape='<ellipse cx="24" cy="41" rx="18" ry="3" fill="#241d2c" opacity=".18" stroke="none"/><path d="M10 36L9 20Q12 9 26 8L43 11Q39 15 43 23Q35 20 33 31Q25 26 21 38L14 41Z" fill="#756074" stroke="#322b3c" stroke-width="1.7"/><path d="M11 33L13 19Q17 11 27 11L39 12L31 25L21 34Z" fill="#a1828b" opacity=".38" stroke="none"/><path d="M13 34L13 20L26 9L42 11M13 22L41 22M13 26L32 30M13 29L21 37" fill="none" stroke="#c1a69d" stroke-width="1.25"/><path d="M13 21L27 16M14 26L27 26M13 31L20 32" fill="none" stroke="#3a30484d" stroke-width=".7"/><path d="M12 20L16 21L13 25L10 23Z" fill="#8d7389" stroke="#4a3b52" stroke-width=".8"/><path d="M11 34L16 36L15 41L10 42L8 38Z" fill="#b2a092" stroke="#493a46" stroke-width="1"/><path d="M9 37L14 38M14 12L24 9M29 9L38 11" fill="none" stroke="#e0c3ad" stroke-width=".75"/><path d="M35 21L38 22M24 30L25 33" stroke="#bc959e" stroke-width=".8"/>'

export const drawBatWingGround:GroundRenderer=({ctx:g,x,y})=>{
  g.save();g.translate(x,y);g.lineJoin='round'
  g.beginPath();g.moveTo(-8,6);g.lineTo(-9,-3);g.quadraticCurveTo(-3,-10,8,-5);g.quadraticCurveTo(4,-2,9,2);g.quadraticCurveTo(3,0,1,7);g.quadraticCurveTo(-2,3,-4,8);g.closePath()
  g.fillStyle='#776373';g.strokeStyle='#302739';g.lineWidth=1.1;g.fill();g.stroke()
  g.strokeStyle='#b8a094';g.lineWidth=.7;g.beginPath();g.moveTo(-7,6);g.lineTo(-6,-3);g.lineTo(7,-5);g.moveTo(-6,-2);g.lineTo(7,1);g.moveTo(-6,1);g.lineTo(0,6);g.stroke()
  g.fillStyle='#bba799';g.fillRect(-8,5,3,2);g.restore()
}

const spectrum=Array.from({length:18},(_,i)=>`hsl(${i*20},65%,80%)`)
const spectrumStops=spectrum.map((color,i)=>`<stop offset="${i/(spectrum.length-1)}" stop-color="${color}"/>`).join('')
const coreOutline='M24 5L34 11L39 26L32 38L23 43L12 33L9 19L16 10Z'

/** 煤块的紧密黑色断面、薄层劈理与少量冷灰亮棱。 */
export const coalIconShape='<ellipse cx="24" cy="41" rx="19" ry="3" fill="#181a1f" opacity=".22" stroke="none"/><path d="M5 32L9 21L18 17L26 23L22 38L10 39Z" fill="#282c30"/><path d="M25 30L32 20L41 22L44 34L35 41L26 38Z" fill="#202428"/><path d="M12 24L15 12L28 8L37 16L36 29L27 37L15 34Z" fill="#22272d"/><path d="M15 12L28 8L37 16L28 22L12 24Z" fill="#4a5056"/><path d="M28 22L37 16L36 29L27 37Z" fill="#30363d"/><path d="M15 12L27 9L34 14M14 22L25 19M15 28L23 26M29 26L35 23" fill="none" stroke="#899197" stroke-opacity=".65" stroke-width="1"/><path d="M19 13L22 19L19 24L24 28L22 34M29 13L27 17L31 20M10 29L17 27M32 33L38 30" fill="none" stroke="#11161c" stroke-width="1.2"/>'

/** 白色主体只在棱线和外缘出现很淡的多色光谱，不在内部涂三块颜色。 */
export const crystalCoreIconShape=`<defs><linearGradient id="crystal-core-spectrum" x1="0" y1="0" x2="1" y2="1">${spectrumStops}</linearGradient></defs><path d="${coreOutline}" fill="none" stroke="url(#crystal-core-spectrum)" stroke-width="7" opacity=".09"/><path d="${coreOutline}" fill="#dedee2" stroke="#76777f" stroke-width="1.2"/><path d="M24 5L27 22L16 10L9 19L23 43L27 22L34 11Z" fill="#f5f3ee" stroke="none"/><path d="M27 22L39 26L32 38L23 43Z" fill="#c6c9d1" stroke="none"/><path d="M16 10L27 22L12 33L9 19Z" fill="#e6e8e8" stroke="none"/><path d="M27 22L34 11L39 26Z" fill="#eeeff0" stroke="none"/><path d="M24 7L27 22L23 40M12 20L27 22L36 27M16 12L12 31" fill="none" stroke="#fffdf4" stroke-width="1.1"/><path d="${coreOutline}" fill="none" stroke="url(#crystal-core-spectrum)" stroke-width="1.8" opacity=".28"/><path d="M17 15L20 11M29 31L33 28" stroke="#ffffff" stroke-width="1.5"/>`

/** 天然块体共享同一组分面，尺寸缩小时用于地面煤素材。 */
export function drawCoalFormation(g:CanvasRenderingContext2D,x:number,y:number,seed:number,scale=1,flash=0,variant:0|1|2=0):void{
  const noise=(n:number)=>{let v=Math.imul(seed+n*97,2246822519);v=Math.imul(v^(v>>>13),3266489917);return (v>>>0)/4294967296}
  g.save();g.translate(x,y);g.scale(scale,scale);g.lineJoin='round'
  // 三套独立构形：紧密碎块堆、横卧薄层煤板、直立劈裂块体。
  const pieces=variant===1?[[-9,7,.85],[11,5,.7],[-1,-3,.78]] as const:variant===2?[[-10,9,.52],[10,8,.48],[0,-3,1]] as const:[[-12,6,.72],[12,7,.58],[-1,1,1]] as const
  for(let i=0;i<pieces.length;i++){
    const [px,py,size]=pieces[i]!
    g.save();g.translate(px,py);g.scale(size*(variant===1?1.4:variant===2?.87:1),size*(variant===1?.52:variant===2?1.35:1))
    const h=10+noise(i)*4,left=-13-noise(i+4)*2,right=12+noise(i+9)*2
    const path=()=>{g.beginPath();g.moveTo(left,0);g.lineTo(-10,-h);g.lineTo(1,-h-4);g.lineTo(right,-h*.55);g.lineTo(right-1,6);g.lineTo(4,11);g.lineTo(-11,7);g.closePath()}
    path();g.fillStyle=flash>0?'#b8bbc0':'#20262b';g.fill();g.strokeStyle='#131820';g.lineWidth=1.7;g.stroke()
    g.save();path();g.clip()
    g.fillStyle=flash>0?'#e3e2df':'#474e55';g.beginPath();g.moveTo(left,0);g.lineTo(-10,-h);g.lineTo(1,-h-4);g.lineTo(right,-h*.55);g.lineTo(2,-2);g.closePath();g.fill()
    g.fillStyle='#30373e';g.beginPath();g.moveTo(2,-2);g.lineTo(right,-h*.55);g.lineTo(right-1,6);g.lineTo(4,11);g.closePath();g.fill()
    // 几道不平行的煤层细纹与断裂，避免整齐的积木拼块。
    for(let j=0;j<5;j++){
      const yy=-h+3+j*3.8,start=-10+noise(i*8+j)*4,end=5+noise(j+22)*8
      g.strokeStyle=j%2?'#747d8552':'#10161cab';g.lineWidth=j%2?.65:1
      g.beginPath();g.moveTo(start,yy);g.lineTo(-1,yy-2);g.lineTo(end,yy-4+noise(j+55)*2);g.stroke()
    }
    g.strokeStyle='#0e141bd4';g.lineWidth=1.2;g.beginPath();g.moveTo(-4,-h);g.lineTo(-1,-6);g.lineTo(-4,-1);g.lineTo(2,4);g.lineTo(0,10);g.stroke()
    g.restore();g.strokeStyle='#a4a9aa82';g.lineWidth=.8;g.beginPath();g.moveTo(-9,-h+.3);g.lineTo(1,-h-3);g.lineTo(9,-h*.7);g.stroke();g.restore()
  }
  g.restore()
}

export const drawCoalGround:GroundRenderer=({ctx,x,y})=>drawCoalFormation(ctx,x,y,43,.38)
let spectrumGlow:HTMLCanvasElement|undefined
function coreGlow():HTMLCanvasElement{
  if(spectrumGlow)return spectrumGlow
  spectrumGlow=document.createElement('canvas');spectrumGlow.width=64;spectrumGlow.height=64
  const g=spectrumGlow.getContext('2d')!
  // 不同色相错位交叠，光谱光晕烘焙一次，地面浮动时只贴图。
  for(let i=0;i<spectrum.length;i++){
    const a=i/spectrum.length*Math.PI*2,x=32+Math.cos(a)*6,y=32+Math.sin(a)*8
    const glow=g.createRadialGradient(x,y,1,x,y,21)
    glow.addColorStop(0,`hsla(${i*20},65%,80%,.035)`);glow.addColorStop(1,`hsla(${i*20},65%,80%,0)`)
    g.fillStyle=glow;g.fillRect(0,0,64,64)
  }
  return spectrumGlow
}

export const drawCrystalCoreGround:GroundRenderer=({ctx,x,y,bob})=>{
  ctx.save();ctx.globalAlpha*=.7+Math.sin(bob*.2)*.08;ctx.drawImage(coreGlow(),x-18,y-21,36,42);ctx.restore()
  ctx.save();ctx.translate(x,y);ctx.lineJoin='round';ctx.lineWidth=1
  ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(6,-5);ctx.lineTo(8,2);ctx.lineTo(2,9);ctx.lineTo(-5,5);ctx.lineTo(-7,-3);ctx.closePath();ctx.fillStyle='#e7e7e3';ctx.fill();ctx.strokeStyle='#81858c';ctx.stroke()
  ctx.fillStyle='#faf7ee';ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(1,0);ctx.lineTo(-5,5);ctx.lineTo(-7,-3);ctx.closePath();ctx.fill()
  ctx.fillStyle='#bdc3cd';ctx.beginPath();ctx.moveTo(1,0);ctx.lineTo(8,2);ctx.lineTo(2,9);ctx.lineTo(-5,5);ctx.closePath();ctx.fill()
  ctx.strokeStyle='#fffdf5';ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(1,0);ctx.lineTo(2,7);ctx.stroke()
  for(let i=0;i<12;i++){
    const a=i/12*Math.PI*2;ctx.strokeStyle=`hsla(${i*30+bob*2},60%,80%,.35)`;ctx.lineWidth=.7
    ctx.beginPath();ctx.moveTo(Math.cos(a)*6,Math.sin(a)*8);ctx.lineTo(Math.cos(a+.24)*6,Math.sin(a+.24)*8);ctx.stroke()
  }
  ctx.restore()
}
