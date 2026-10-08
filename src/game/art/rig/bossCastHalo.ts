/** Boss 引导光轮：统一断环、反转刻纹和暗体积语言，主题只调整颜色与几何阶数。 */
export interface BossHaloStyle { blood:string; edge:string; sides:number }
export const GRIMM_HALO:BossHaloStyle={blood:'#a51632',edge:'#ff8370',sides:3}
const textures=new Map<BossHaloStyle,HTMLCanvasElement>()

function texture(style:BossHaloStyle):HTMLCanvasElement {
  const cached=textures.get(style)
  if(cached)return cached
  const cv=document.createElement('canvas');cv.width=cv.height=320
  const g=cv.getContext('2d')!;g.translate(160,160)
  // 泛光一次烘焙，运行时不做阴影模糊或重新建立渐变。
  const bloom=g.createRadialGradient(0,0,44,0,0,158)
  bloom.addColorStop(0,'rgba(10,0,4,0)');bloom.addColorStop(.42,'rgba(80,2,22,.08)')
  bloom.addColorStop(.7,'rgba(150,8,36,.25)');bloom.addColorStop(1,'rgba(80,2,20,0)')
  g.fillStyle=bloom;g.fillRect(-160,-160,320,320)
  const noise=(i:number)=>{const s=Math.sin(i*127.1+4.7)*43758.5453;return s-Math.floor(s)}
  for(let layer=0;layer<3;layer++)for(let i=0;i<13;i++){
    const a=i*Math.PI*2/13+layer*.19,rad=104+layer*13+(noise(i+layer*31)-.5)*5
    const len=.15+noise(i*3+layer)*.27
    g.beginPath()
    for(let q=0;q<=8;q++){
      const ang=a+len*q/8,r=rad+Math.sin(ang*17+layer)*1.5
      q?g.lineTo(Math.cos(ang)*r,Math.sin(ang)*r):g.moveTo(Math.cos(ang)*r,Math.sin(ang)*r)
    }
    g.strokeStyle=style.blood;g.globalAlpha=.2;g.lineWidth=7-layer;g.stroke()
    g.strokeStyle=style.edge;g.globalAlpha=.65;g.lineWidth=layer===1?1.2:2;g.stroke()
  }
  // 蚀刻符片不是文字：错长刻线、裂口与偏心小菱形，不采用整齐等分的刻度盘。
  g.strokeStyle=style.edge;g.lineWidth=1
  for(let i=0;i<35;i++){
    const a=i*Math.PI*2/35+(noise(i+9)-.5)*.06,r=85+noise(i+51)*10
    g.save();g.rotate(a);g.globalAlpha=.25+noise(i)*.4
    g.beginPath();g.moveTo(r,-3);g.lineTo(r+5+noise(i+6)*9,-1);g.lineTo(r+4,4)
    if(i%3===0){g.moveTo(r+9,-6);g.lineTo(r+13,-2);g.lineTo(r+9,2)}
    g.stroke();g.restore()
  }
  g.globalAlpha=1;textures.set(style,cv);return cv
}

/** 绘制在角色本体之前；progress 控制展开，opacity 控制结束后的余光消散。 */
export function drawBossCastHalo(g:CanvasRenderingContext2D,x:number,y:number,time:number,progress:number,opacity:number,style:BossHaloStyle=GRIMM_HALO):void {
  if(opacity<=0)return
  const p=Math.max(0,Math.min(1,progress)),grow=1-Math.pow(1-p,3)
  const radius=26+112*grow
  g.save()
  try {
    g.translate(x,y);g.scale(radius/138,radius/138)
    // 近黑仪式场压住背景，让纹理有实体纵深而不是贴一张亮圆图。
    g.globalAlpha=opacity*.26;g.fillStyle='#0a0107'
    g.beginPath();g.ellipse(0,0,110,119,0,0,Math.PI*2);g.fill()
    g.globalCompositeOperation='lighter';g.globalAlpha=opacity
    g.save();g.rotate(time*.38);g.drawImage(texture(style),-160,-160);g.restore()
    g.save();g.rotate(-time*.57)
    // 两层错位多边符框：断裂边、轻微径向起伏、宽暗辉到细亮棱。
    for(let layer=0;layer<2;layer++){
      const n=style.sides*2,r=layer?71:99
      g.beginPath()
      for(let i=0;i<n;i++){
        const a=i*Math.PI*2/n+layer*.2,b=(i+1)*Math.PI*2/n+layer*.2
        const ax=Math.cos(a)*r,ay=Math.sin(a)*r,bx=Math.cos(b)*r,by=Math.sin(b)*r
        g.moveTo(ax,ay);g.lineTo(ax+(bx-ax)*.82,ay+(by-ay)*.82)
      }
      g.strokeStyle=style.blood;g.globalAlpha=opacity*.25;g.lineWidth=6;g.stroke()
      g.strokeStyle=style.edge;g.globalAlpha=opacity*(layer?.35:.65);g.lineWidth=1.3;g.stroke()
    }
    g.restore()
    // 内层逆卷的不规则纹脉，频率不同于外环，不堆满中心的人物轮廓。
    g.globalAlpha=opacity*.4;g.strokeStyle=style.blood;g.lineWidth=1.4
    for(let j=0;j<3;j++){
      g.beginPath()
      for(let i=0;i<=20;i++){
        const a=j*Math.PI*2/3-time*.3+i*.045,r=48+i*1.5+Math.sin(i*.8+time*2+j)*2
        i?g.lineTo(Math.cos(a)*r,Math.sin(a)*r):g.moveTo(Math.cos(a)*r,Math.sin(a)*r)
      }
      g.stroke()
    }
  } finally { g.restore() }
}
