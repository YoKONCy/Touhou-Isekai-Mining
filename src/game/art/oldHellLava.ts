import type { TileMap } from '../tilemap'
import { TILE_LAVA } from '../tilemap'
import { hash2 } from './artPalette'
import { radialStamp } from '../../core/rendering/RadialStamp'
import { bakeSprite,drawSprite,type RasterSprite } from '../../core/rendering/SpriteCache'
import { visible,type Viewport } from '../../core/rendering/Viewport'
import { paintLavaCrust,paintLavaFlow,paintLavaBank } from './oldHellLavaMaterial'

interface Point {x:number;y:number}
interface Edge {a:Point;b:Point;used:boolean}
interface Bank extends Point {nx:number;ny:number;seed:number}
interface Crust extends Point {rx:number;ry:number;seed:number;angle:number}
interface Current extends Point {seed:number;angle:number}

/** 碰撞仍沿用地形网格；美术从整片湖面的轮廓生成，隐藏逐格描边和重复贴片。 */
export class OldHellLava {
  private readonly loops:Point[][]=[]
  private readonly banks:Bank[]=[]
  private readonly bubbles:Point[]=[]
  private readonly crusts:Crust[]=[]
  private readonly currents:Current[]=[]
  private readonly plumes:Current[]=[]
  private readonly crustArt=new Map<number,{base:RasterSprite;hot:RasterSprite}>()
  private readonly flowArt=new Map<number,RasterSprite>()
  private readonly bankArt=new Map<number,RasterSprite>()
  private surface:Path2D|null=null
  private bed:Path2D|null=null

  constructor(private readonly map:TileMap,private readonly seed:number){
    const t=map.tile,edges:Edge[]=[],outgoing=new Map<string,Edge[]>()
    const key=(p:Point)=>`${p.x}:${p.y}`
    const edge=(x0:number,y0:number,x1:number,y1:number)=>{
      const e:Edge={a:{x:x0,y:y0},b:{x:x1,y:y1},used:false};edges.push(e)
      const at=outgoing.get(key(e.a))??[];at.push(e);outgoing.set(key(e.a),at)
    }
    for(let r=0;r<map.rows;r++)for(let c=0;c<map.cols;c++){
      if(map.tileAt(c,r)!==TILE_LAVA)continue
      const x=c*t,y=r*t
      if(map.tileAt(c,r-1)!==TILE_LAVA)edge(x,y,x+t,y)
      if(map.tileAt(c+1,r)!==TILE_LAVA)edge(x+t,y,x+t,y+t)
      if(map.tileAt(c,r+1)!==TILE_LAVA)edge(x+t,y+t,x,y+t)
      if(map.tileAt(c-1,r)!==TILE_LAVA)edge(x,y+t,x,y)
      if(hash2(seed+c,r)<.075&&map.tileAt(c+1,r)===TILE_LAVA&&map.tileAt(c,r+1)===TILE_LAVA)this.bubbles.push({x:x+t*.6,y:y+t*.6})
    }
    for(const start of edges){
      if(start.used)continue
      const points:Point[]=[];let current:Edge|undefined=start
      while(current&&!current.used){
        current.used=true;points.push(current.a)
        if(key(current.b)===key(start.a))break
        const dx=current.b.x-current.a.x,dy=current.b.y-current.a.y
        const options:Edge[]=(outgoing.get(key(current.b))??[]).filter(e=>!e.used)
        // 对角接触的两片湖面各自闭合，不能从共享顶点抄到另一片轮廓。
        options.sort((a,b)=>{
          const turn=(e:Edge)=>dx*(e.b.y-e.a.y)-dy*(e.b.x-e.a.x)
          return turn(b)-turn(a)
        })
        current=options[0]
      }
      if(points.length<4)continue
      const simplified=points.filter((p,i)=>{
        const a=points[(i+points.length-1)%points.length]!,b=points[(i+1)%points.length]!
        return (p.x-a.x)*(b.y-p.y)!==(p.y-a.y)*(b.x-p.x)
      })
      if(simplified.length<3)continue
      this.loops.push(simplified)
      for(let i=0;i<simplified.length;i++){
        const a=simplified[i]!,b=simplified[(i+1)%simplified.length]!,dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)
        const count=Math.max(1,Math.ceil(length/23))
        for(let k=0;k<count;k++){
          const u=(k+.5)/count,jitter=(hash2(seed+edges.length,i*31+k)-.5)*12
          this.banks.push({x:a.x+dx*u-dy/length*jitter,y:a.y+dy*u+dx/length*jitter,nx:-dy/length,ny:dx/length,seed:this.banks.length})
        }
      }
    }
    // 浮壳的尺寸、间距与初相位独立抽样，保留宽窄不一的热流通道。
    const isLava=(x:number,y:number)=>map.tileAt(map.worldToCol(x),map.worldToRow(y))===TILE_LAVA
    for(let row=0;row<map.rows;row++)for(let col=0;col<map.cols;col++){
      if(map.tileAt(col,row)!==TILE_LAVA)continue
      const h=hash2(seed+col*31,row*13),x=(col+.3+hash2(seed+row,col)*.4)*t,y=(row+.3+h*.4)*t
      if(h<.16){
        const rx=19+Math.pow(hash2(seed+row,col+301),1.5)*60,ry=rx*(.38+hash2(seed+col,row+311)*.28)
        if([[0,0],[rx+17,0],[-rx-17,0],[0,ry+17],[0,-ry-17]].every(([dx,dy])=>isLava(x+dx!,y+dy!))&&
          this.crusts.every(p=>Math.abs(p.x-x)>(p.rx+rx)*.65||Math.abs(p.y-y)>(p.ry+ry)*.7)){
          this.crusts.push({x,y,rx,ry,seed:Math.floor(hash2(seed+col,row+321)*0xffff),angle:(hash2(seed+row,col+331)-.5)*.65})
        }
      }
      if(col%4===0&&row%3===0){
        const current={x,y,seed:Math.floor(hash2(seed+col,row+341)*0xffff),angle:(hash2(seed+row,col+351)-.5)*.8}
        this.currents.push(current)
        if(hash2(seed+col,row+361)<.3)this.plumes.push(current)
      }
    }
    // 沸点避开浮壳，气泡不会从完整黑壳的中央凭空穿出来。
    for(let i=this.bubbles.length-1;i>=0;i--){
      const bubble=this.bubbles[i]!
      if(this.crusts.some(p=>((p.x-bubble.x)/(p.rx+20))**2+((p.y-bubble.y)/(p.ry+20))**2<1.4))this.bubbles.splice(i,1)
    }
    // 很小的湖面也保留一处缓慢热流；热汽按种子选点，避免全部挤在扫描到的第一片岸边。
    if(!this.currents.length&&edges[0])this.currents.push({x:edges[0].a.x+t*.5,y:edges[0].a.y+t*.5,seed:seed&0xffff,angle:0})
    this.plumes.sort((a,b)=>hash2(a.seed,379)-hash2(b.seed,379));this.plumes.length=Math.min(9,this.plumes.length)
    if(!this.plumes.length&&this.currents[0])this.plumes.push(this.currents[0])
  }

  get rasterBytes():number {
    let bytes=0
    for(const {base,hot} of this.crustArt.values())bytes+=(base.image.width*base.image.height+hot.image.width*hot.image.height)*4
    for(const sprite of [...this.flowArt.values(),...this.bankArt.values()])bytes+=sprite.image.width*sprite.image.height*4
    return bytes
  }
  releaseRenderResources():void {
    for(const {base,hot} of this.crustArt.values()){base.image.width=base.image.height=1;hot.image.width=hot.image.height=1}
    for(const sprite of [...this.flowArt.values(),...this.bankArt.values()])sprite.image.width=sprite.image.height=1
    this.crustArt.clear();this.flowArt.clear();this.bankArt.clear()
  }
  private crustSprite(seed:number):{base:RasterSprite;hot:RasterSprite} {
    const key=seed%12
    let art=this.crustArt.get(key)
    if(!art){art={base:bakeSprite(-78,-49,156,102,g=>paintLavaCrust(g,key*17+13,false),1.5),hot:bakeSprite(-78,-49,156,102,g=>paintLavaCrust(g,key*17+13,true),1.5)};this.crustArt.set(key,art)}
    return art
  }
  private flowSprite(seed:number):RasterSprite {
    const key=seed%4
    let sprite=this.flowArt.get(key)
    if(!sprite){sprite=bakeSprite(-145,-42,290,84,g=>paintLavaFlow(g,key*3+2),1);this.flowArt.set(key,sprite)}
    return sprite
  }
  private bankSprite(seed:number):RasterSprite {
    const key=seed%8
    let sprite=this.bankArt.get(key)
    if(!sprite){sprite=bakeSprite(-42,-26,84,52,g=>paintLavaBank(g,key*13+7),1.5);this.bankArt.set(key,sprite)}
    return sprite
  }

  private paths():{surface:Path2D;bed:Path2D} {
    if(this.surface&&this.bed)return {surface:this.surface,bed:this.bed}
    const surface=new Path2D(),bed=new Path2D(),t=this.map.tile
    for(let row=0;row<this.map.rows;row++)for(let col=0;col<this.map.cols;col++)if(this.map.tileAt(col,row)===TILE_LAVA)bed.rect(col*t,row*t,t,t)
    for(const loop of this.loops){
      const before:Point[]=[],after:Point[]=[]
      for(let i=0;i<loop.length;i++){
        const a=loop[(i+loop.length-1)%loop.length]!,p=loop[i]!,b=loop[(i+1)%loop.length]!
        const da=Math.hypot(p.x-a.x,p.y-a.y),db=Math.hypot(b.x-p.x,b.y-p.y),r=Math.min(da*.42,db*.42,16+hash2(this.seed,i)*9)
        before.push({x:p.x+(a.x-p.x)*r/da,y:p.y+(a.y-p.y)*r/da})
        after.push({x:p.x+(b.x-p.x)*r/db,y:p.y+(b.y-p.y)*r/db})
      }
      surface.moveTo(before[0]!.x,before[0]!.y)
      for(let i=0;i<loop.length;i++){
        if(i)surface.lineTo(before[i]!.x,before[i]!.y)
        surface.quadraticCurveTo(loop[i]!.x,loop[i]!.y,after[i]!.x,after[i]!.y)
      }
      surface.closePath()
    }
    this.surface=surface;this.bed=bed;return {surface,bed}
  }

  paint(g:CanvasRenderingContext2D,view:Viewport):void {
    if(!this.loops.length)return
    const {surface,bed}=this.paths(),seed=this.seed
    g.save();g.fillStyle='#3c2115';g.fill(bed)
    g.strokeStyle='#382719';g.lineWidth=30;g.lineJoin='round';g.stroke(surface)
    g.strokeStyle='#1c1712';g.lineWidth=17;g.stroke(surface)
    g.save();g.clip(surface,'evenodd')
    g.fillStyle='#862b14';g.fillRect(view.left,view.top,view.right-view.left,view.bottom-view.top)
    // 深红黏稠底层与不等大的高温色团形成深浅关系，亮部留给后续移动热流。
    for(let row=Math.floor((view.top-220)/160);row<=Math.ceil((view.bottom+220)/160);row++)for(let col=Math.floor((view.left-220)/210);col<=Math.ceil((view.right+220)/210);col++){
      const h=hash2(seed+col,row),x=col*210+h*130,y=row*160+hash2(row,seed+col)*95,r=100+h*110
      const glow=g.createRadialGradient(x,y,3,x,y,r)
      glow.addColorStop(0,h<.3?'#e99127':'#da681c');glow.addColorStop(.45,'#bc4918a6');glow.addColorStop(1,'#a0371600')
      g.fillStyle=glow;g.fillRect(x-r,y-r,r*2,r*2)
    }
    // 岸壁向下落入熔浆，焦化的冷却壳在岸边形成连续暗缘。
    g.strokeStyle='#532b17';g.lineWidth=21;g.stroke(surface)
    g.strokeStyle='#281d14';g.lineWidth=9;g.stroke(surface)
    g.restore()
    g.restore()
  }

  render(g:CanvasRenderingContext2D,view:Viewport,time:number):void {
    if(!this.loops.length)return
    const {surface}=this.paths()
    g.save();g.clip(surface,'evenodd')
    const glow=radialStamp('old-hell-lava-convection',0,[[0,'#ffb742b0'],[.35,'#f1842870'],[1,'#e3591400']])
    // 热流从浮壳下面经过，亮带缓慢移动且错峰显隐，不发生循环接头跳变。
    g.save();g.globalCompositeOperation='screen'
    for(const current of this.currents){
      if(!visible(view,current.x,current.y,220))continue
      const phase=(time*(.055+hash2(current.seed,1)*.025)+hash2(current.seed,3))%1
      const strength=Math.sin(phase*Math.PI),dx=(phase-.5)*90,dy=Math.sin(time*.16+current.seed)*15
      g.save();g.translate(current.x+dx,current.y+dy);g.rotate(current.angle)
      g.save();g.scale(1.05+hash2(current.seed,5)*.65,.35+hash2(current.seed,7)*.2);g.globalAlpha*=strength*.22;drawSprite(g,glow);g.restore()
      g.scale(.7+hash2(current.seed,9)*.5,.8+hash2(current.seed,11)*.5);g.globalAlpha*=strength*.55;drawSprite(g,this.flowSprite(current.seed));g.restore()
    }
    g.restore()
    const dome=radialStamp('old-hell-lava-bubble',.1,[[0,'#a53710'],[.55,'#bd4916'],[.82,'#f5a336b8'],[1,'#df611800']])
    for(let i=0;i<this.bubbles.length;i++){
      const p=this.bubbles[i]!;if(!visible(view,p.x,p.y,65))continue
      g.save();const opacity=g.globalAlpha
      const cycle=4.5+hash2(this.seed,i+71)*3,phase=(time/cycle+hash2(this.seed,i))%1
      if(phase<.48){
        const grow=phase/.48,r=2+grow*7
        g.save();g.translate(p.x,p.y-grow*2);g.scale(r/128,r*.55/128);g.globalAlpha*=Math.min(1,grow*3);drawSprite(g,dome);g.restore()
        g.strokeStyle=`rgba(255,189,81,${grow*.55})`;g.lineWidth=1;g.beginPath();g.ellipse(p.x-1,p.y-grow*2,r*.68,r*.31,0,Math.PI*1.06,Math.PI*1.85);g.stroke()
      }else{
        const burst=(phase-.48)/.52,r=5+burst*26
        g.strokeStyle=`rgba(255,164,63,${(1-burst)*.6})`;g.lineWidth=1.7-burst;g.beginPath();g.ellipse(p.x,p.y,r,r*.42,0,0,Math.PI*2);g.stroke()
        if(burst>.14){g.strokeStyle=`rgba(239,112,33,${(1-burst)*.28})`;g.beginPath();g.ellipse(p.x,p.y,r*.7,r*.3,0,.4,4.8);g.stroke()}
        if(burst<.42)for(let k=0;k<5;k++){
          const flight=burst/.42,angle=k*Math.PI*.4+hash2(this.seed,i+91)*2,distance=flight*(16+hash2(i,k+101)*15)
          const x=p.x+Math.cos(angle)*distance,y=p.y+Math.sin(angle)*distance*.4-Math.sin(flight*Math.PI)*19
          g.fillStyle=k%2?'#ffc15c':'#e76e21';g.globalAlpha=opacity*(1-flight)*.9;g.beginPath();g.ellipse(x,y,1.2,2.1,angle*.3,0,Math.PI*2);g.fill()
        }
      }
      g.restore()
    }
    // 冷壳与红热裂口分两张小贴图，漂移、轻转和脉动只改变合成参数。
    for(const crust of this.crusts){
      if(!visible(view,crust.x,crust.y,crust.rx+35))continue
      const phase=time*(.12+hash2(crust.seed,17)*.07)+crust.seed
      const art=this.crustSprite(crust.seed)
      g.save();g.translate(crust.x+Math.sin(phase)*10,crust.y+Math.cos(phase*.83)*7)
      g.rotate(crust.angle+Math.sin(phase*.7)*.035);g.scale(crust.rx/65,crust.ry/37)
      drawSprite(g,art.base);g.globalAlpha*=.48+Math.sin(phase*.71)*.23;drawSprite(g,art.hot);g.restore()
    }
    g.restore()
    // 岸岩最后绘制，水面动效不会盖住焦化断面；用稀疏大碎岩打断连续暗岸。
    const reflected=radialStamp('old-hell-lava-bank-reflection',0,[[0,'#f18c3540'],[.4,'#da611520'],[1,'#ba4e1500']])
    for(const bank of this.banks){
      if(bank.seed%3!==0||!visible(view,bank.x,bank.y,95))continue
      const h=hash2(this.seed,bank.seed),warm=.62+Math.sin(time*.65+bank.seed)*.2
      g.save();g.translate(bank.x-bank.nx*2,bank.y-bank.ny*2)
      g.save();g.rotate(Math.atan2(bank.nx,-bank.ny)+(h-.5)*.22);g.scale(.85+h*.4,.85+hash2(bank.seed,this.seed)*.3);drawSprite(g,this.bankSprite(bank.seed));g.restore()
      g.save();g.translate(bank.nx*15,bank.ny*15);g.scale(.57,.35);g.globalCompositeOperation='screen';g.globalAlpha*=warm;drawSprite(g,reflected);g.restore();g.restore()
    }
  }

  /** 湖面上升的热汽与火星单独盖在实体上方，均按模拟时间驱动并限定数量。 */
  renderAir(g:CanvasRenderingContext2D,view:Viewport,time:number):void {
    if(!this.plumes.length)return
    const haze=radialStamp('old-hell-lava-heat-haze',0,[[0,'#caa27e24'],[.45,'#99745713'],[1,'#9b705200']])
    g.save()
    for(const plume of this.plumes){
      if(!visible(view,plume.x,plume.y,190))continue
      g.save();const opacity=g.globalAlpha
      for(let i=0;i<3;i++){
        const phase=(time*.14+i/3+hash2(plume.seed,13))%1
        g.save();g.translate(plume.x+Math.sin(time*.27+plume.seed+i)*27,plume.y-phase*120)
        g.scale(.45+phase*.7,.18+phase*.3);g.globalAlpha*=Math.sin(phase*Math.PI)*.8;drawSprite(g,haze);g.restore()
      }
      for(let i=0;i<3;i++){
        const phase=(time*(.23+hash2(plume.seed,i+21)*.1)+i/3+hash2(plume.seed,31))%1
        const x=plume.x+(hash2(plume.seed,i+41)-.5)*55+Math.sin(phase*4+i)*10,y=plume.y-phase*(55+hash2(plume.seed,i+51)*55)
        g.globalAlpha=opacity*Math.sin(phase*Math.PI)*.75;g.fillStyle=i%2?'#f5a94c':'#ffd27e';g.fillRect(x,y,1.3,2.6)
      }
      g.restore()
    }
    g.restore()
  }
}
