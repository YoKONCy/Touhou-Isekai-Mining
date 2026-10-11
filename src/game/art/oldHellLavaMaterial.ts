import { hash2 } from './artPalette'
import { paintHellStoneGrain } from './oldHellStoneMaterial'

type Point={x:number;y:number}
function shape(points:readonly Point[]):Path2D {
  const p=new Path2D();points.forEach((q,i)=>i?p.lineTo(q.x,q.y):p.moveTo(q.x,q.y));p.closePath();return p
}
function polygon(g:CanvasRenderingContext2D,points:readonly Point[],color:string):void {g.fillStyle=color;g.fill(shape(points))}

/** 冷却壳是有薄断面的焦黑片层，熔光只沿部分边缘和裂口透出。 */
export function paintLavaCrust(g:CanvasRenderingContext2D,seed:number,emission:boolean):void {
  const points:Point[]=[],count=10+Math.floor(hash2(seed,3)*4)
  for(let i=0;i<count;i++){
    const a=i/count*Math.PI*2,r=.63+hash2(seed,i+17)*.37
    points.push({x:Math.cos(a)*65*r,y:Math.sin(a)*37*r})
  }
  const path=shape(points)
  if(!emission){
    polygon(g,points.map(p=>({x:p.x,y:p.y+4})),'#27120c')
    const top=g.createLinearGradient(-45,-34,35,40)
    top.addColorStop(0,'#4b3b2d');top.addColorStop(.42,seed%3?'#292724':'#352b24');top.addColorStop(1,'#171817')
    g.fillStyle=top;g.fill(path);g.save();g.clip(path)
    for(let i=0;i<3;i++){
      const x=-37+hash2(seed,i+51)*62,y=-17+hash2(seed,i+61)*27
      polygon(g,[{x:x-18,y},{x:x-5,y:y-9},{x:x+23,y:y-5},{x:x+17,y:y+6},{x:x-7,y:y+10}],i%2?'#75604421':'#0e141333')
    }
    paintHellStoneGrain(g,-75,-45,150,90,seed,.75);g.restore()
  }else{
    for(let i=0;i<points.length;i++){
      if(hash2(seed,i+81)>.45)continue
      const a=points[i]!,b=points[(i+1)%points.length]!,mid={x:(a.x+b.x)*.48,y:(a.y+b.y)*.48}
      polygon(g,[a,b,{x:b.x*.91,y:b.y*.91},mid,{x:a.x*.92,y:a.y*.92}],i%3?'#f0782a91':'#ffb74e9c')
    }
    if(seed%3!==0){
      const x=(hash2(seed,113)-.5)*20
      polygon(g,[{x:x-21,y:-20},{x:x-8,y:-7},{x:x-13,y:2},{x:x+4,y:9},{x:x+20,y:22},{x:x+3,y:5},{x:x-8,y:0},{x:x-4,y:-9}],'#c64c1c8a')
      polygon(g,[{x:x-8,y:-7},{x:x-13,y:2},{x:x+4,y:9},{x:x+1,y:6},{x:x-10,y:1}],'#ffad3970')
    }
  }
}

/** 宽窄不一的熔流色带，与缓慢移动和交替显隐结合，不按每块浮壳重复画亮线。 */
export function paintLavaFlow(g:CanvasRenderingContext2D,seed:number):void {
  const upper:Point[]=[],lower:Point[]=[]
  for(let i=0;i<=14;i++){
    const t=i/14,x=(t-.5)*280,y=Math.sin(t*6+seed)*11+Math.sin(t*12+seed*.7)*4
    const w=Math.sin(t*Math.PI)*(7+hash2(seed,i)*12)
    upper.push({x,y:y-w});lower.push({x,y:y+w*.6})
  }
  const path=shape([...upper,...lower.reverse()]),color=g.createLinearGradient(0,-24,0,24)
  color.addColorStop(0,'#ee731800');color.addColorStop(.35,'#f8a62d40');color.addColorStop(.55,'#ffd06690');color.addColorStop(1,'#eb631100')
  g.fillStyle=color;g.fill(path)
}

/** 焦化岸岩采用棕灰断面，避免沿湖摆一圈蓝紫色的小圆石。 */
export function paintLavaBank(g:CanvasRenderingContext2D,seed:number):void {
  const points:Point[]=[{x:-30,y:4},{x:-25,y:-9},{x:-8,y:-15},{x:8,y:-12},{x:25,y:-7},{x:32,y:5},{x:13,y:14},{x:-13,y:13}]
  for(let i=0;i<points.length;i++){points[i]!.x+=(hash2(seed,i)-.5)*9;points[i]!.y+=(hash2(i,seed)-.5)*6}
  const path=shape(points),color=g.createLinearGradient(-20,-14,10,18)
  color.addColorStop(0,seed%3?'#6b5140':'#625b4b');color.addColorStop(.48,'#42352a');color.addColorStop(1,'#221d18')
  g.fillStyle=color;g.fill(path);g.save();g.clip(path)
  polygon(g,[points[0]!,points[1]!,points[2]!,{x:2,y:0},{x:-15,y:4}],'#b3976533')
  polygon(g,[{x:-3,y:-12},points[3]!,points[4]!,points[5]!,{x:7,y:5}],'#191c183b')
  paintHellStoneGrain(g,-40,-24,80,50,seed,.8);g.restore()
}
