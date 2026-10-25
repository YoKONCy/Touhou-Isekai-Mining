import { bakeSprite, drawSprite, type RasterSprite } from '../../../core/rendering/SpriteCache'

const clouds:RasterSprite[]=[]
const BODY_ANCHORS= [[-35,-119],[28,-104],[-18,-77],[10,-48],[-3,-143]] as const
const BLADE_ANCHORS= [[0,29],[1,55],[-2,82],[9,107],[-15,129],[-42,119]] as const
const unit=(value:number)=>value-Math.floor(value)

/** 小团云纹只烘焙四张；黑核与紫红薄缘共用贴图，不逐帧建立阴影或滤镜。 */
function cloud(index:number):RasterSprite {
  if(clouds[index])return clouds[index]!
  return clouds[index]=bakeSprite(-32,-32,64,64,g=>{
    for(let i=0;i<5;i++){
      const angle=i*2.399+index*.8,x=Math.cos(angle)*(i?9:0),y=Math.sin(angle)*(i?7:0),radius=18+(i+index)%4
      const shade=g.createRadialGradient(x-2,y-3,2,x,y,radius)
      shade.addColorStop(0,'rgba(8,5,15,.78)')
      shade.addColorStop(.4,'rgba(17,9,26,.63)')
      shade.addColorStop(.7,index%2?'rgba(71,26,58,.23)':'rgba(49,28,67,.25)')
      shade.addColorStop(1,'rgba(23,6,28,0)')
      g.fillStyle=shade;g.fillRect(-32,-32,64,64)
    }
  },1)
}

/** 在身体或武器的局部骨架内绘制，暂停时钟即冻结；前景浓度低于背后，握点保持清楚。 */
export function drawGrimmMiasma(g:CanvasRenderingContext2D,time:number,stage:number,source:'body'|'blade',front=false,force=1):void {
  const blade=source==='blade',anchors=blade?BLADE_ANCHORS:BODY_ANCHORS
  const count=blade?(front?11:21):(front?5:11)
  g.save()
  g.globalCompositeOperation='source-over'
  for(let i=0;i<count;i++){
    const seed=i*1.618+(front?7.3:0)+(blade?2.7:0),life=unit(time/(blade?1.9:2.8)+seed)
    const envelope=Math.sin(life*Math.PI)**1.3
    const anchor=anchors[i%anchors.length]!,spread=(blade?10:15)+life*(blade?19:22)
    const drift=Math.sin(seed*4.3+life*4.8)*spread
    const x=anchor[0]+drift,y=anchor[1]-life*(blade?49:34)+Math.cos(seed*3.1+life*6)*5
    const size=(blade?14:16)+life*(blade?32:26),alpha=(blade?.44:.2)*(front?.48:1)*(1+(stage-1)*.12)*force
    g.save();g.translate(x,y);g.rotate(Math.sin(seed+life*2)*.6)
    g.scale(size/32,size*(.62+life*.3)/32);g.globalAlpha*=envelope*alpha
    drawSprite(g,cloud(i%4));g.restore()
  }
  // 武器多一层贴着刃口逸出的细雾，深色中留少量暗红折光，不能整把染成亮紫。
  if(blade){
    g.lineCap='round'
    for(let i=0;i<(front?2:4);i++){
      const anchor=BLADE_ANCHORS[(i*2+(front?1:0))%BLADE_ANCHORS.length]!
      const life=unit(time*.48+i*.27),fade=Math.sin(life*Math.PI),offset=Math.sin(time*1.7+i*2.1)*5
      g.save();g.globalAlpha*=fade*(front?.28:.5)*force
      for(const [width,color] of [[5,'#100916'],[1.2,i%2?'#743047':'#56324f']] as const){
        g.strokeStyle=color;g.lineWidth=width;g.beginPath();g.moveTo(anchor[0],anchor[1])
        g.bezierCurveTo(anchor[0]+15+offset,anchor[1]-14,anchor[0]-13+offset,anchor[1]-28-life*19,anchor[0]+offset*2,anchor[1]-36-life*24)
        g.stroke()
      }
      g.restore()
    }
  }
  g.restore()
}
