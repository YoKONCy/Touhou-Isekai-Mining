import { hash2 } from './artPalette'

export interface HellStonePalette {dark:string;base:string;light:string;top:string;edge:string;vein:string}
const PALETTES:readonly HellStonePalette[]=[
  {dark:'#211710',base:'#483020',light:'#6d4c31',top:'#806044',edge:'#ab8254',vein:'#b18b50'},
  {dark:'#151311',base:'#2e2924',light:'#494138',top:'#5d5143',edge:'#82705a',vein:'#7f694b'},
  {dark:'#20201e',base:'#403e38',light:'#5a574d',top:'#70695a',edge:'#9a8b72',vein:'#a38a58'},
  {dark:'#2c1d11',base:'#5b3d22',light:'#826039',top:'#977448',edge:'#bf985e',vein:'#c49a49'}
]
const grain=new Map<number,HTMLCanvasElement>()

/** 深棕为主体，少量炭黑、暖灰和土黄岩层穿插，避免整片岩壁偏浅灰绿。 */
export function hellStonePalette(seed:number):HellStonePalette {
  const h=hash2(seed,919)
  return PALETTES[h<.64?0:h<.8?1:h<.94?2:3]!
}

/** 可平铺的低对比矿物颗粒；色团和细小剥落共同给出粗糙面，不使用规则网状描线。 */
export function paintHellStoneGrain(g:CanvasRenderingContext2D,left:number,top:number,width:number,height:number,seed:number,opacity=.6):void {
  const variant=Math.floor(hash2(seed,71)*4)
  let image=grain.get(variant)
  if(!image){
    image=document.createElement('canvas');image.width=image.height=256
    const c=image.getContext('2d')!,colors=['#180e09','#978575','#c29345','#574b3e']
    for(let i=0;i<24;i++){
      const x=hash2(i+variant*31,3)*256,y=hash2(i,variant+13)*256,r=24+hash2(i,51)*66,color=colors[i%4]!
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const px=x+dx*256,py=y+dy*256,brush=c.createRadialGradient(px,py,0,px,py,r)
        brush.addColorStop(0,`${color}24`);brush.addColorStop(.55,`${color}12`);brush.addColorStop(1,`${color}00`)
        c.fillStyle=brush;c.fillRect(px-r,py-r,r*2,r*2)
      }
    }
    for(let i=0;i<105;i++){
      const x=hash2(i+variant*17,81)*256,y=hash2(i,variant+121)*256,w=2+hash2(i,181)*12,h=1+hash2(i,191)*7
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const px=x+dx*256,py=y+dy*256
        c.fillStyle=i%3?'#d3ad7912':'#150e0a1e';c.beginPath();c.moveTo(px,py);c.lineTo(px+w*.6,py-h*.3);c.lineTo(px+w,py+h*.4);c.lineTo(px+w*.35,py+h);c.closePath();c.fill()
      }
    }
    for(let i=0;i<2100;i++){
      const x=hash2(i+variant*13,241)*256,y=hash2(i,variant+251)*256
      c.fillStyle=i%3?'#110c0828':'#ddbb8625';c.fillRect(x,y,.45+hash2(i,271)*.8,.45+hash2(i,281)*.65)
    }
    grain.set(variant,image)
  }
  g.save();g.globalAlpha*=opacity;g.fillStyle=g.createPattern(image,'repeat')!;g.fillRect(left,top,width,height);g.restore()
}
