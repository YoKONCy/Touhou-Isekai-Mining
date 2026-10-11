import { bakeSprite,drawSprite,type RasterSprite } from '../../core/rendering/SpriteCache'
import { radialStamp } from '../../core/rendering/RadialStamp'
import type { Viewport } from '../../core/rendering/Viewport'
import { hash2 } from './artPalette'
import { hellStonePalette,paintHellStoneGrain } from './oldHellStoneMaterial'
import { addOldHellDoorCutout } from './oldHellDoorway'
import { TILE_WALL,type TileMap } from '../tilemap'
import type { RoomTerrain } from '../cave/dungeon/types'
import type { Player } from '../Player'

interface Point {x:number;y:number}
interface Edge {a:Point;b:Point;used:boolean}
export interface HellRockMass {
  x:number;y:number;width:number;depth:number;height:number;radius:number;seed:number
  kind:'wall'|'terrace'|'broken'|'pillar'
  footprint:Point[]
}
interface CachedRock {sprite:RasterSprite;used:number;pixels:number}

/** 合并连片占地后再抬升整个岩体，不沿每格边缘摆一颗圆石。 */
function groundContour(cells:readonly number[],cols:number,tile:number):Point[] {
  const occupied=new Set(cells),edges:Edge[]=[],outgoing=new Map<string,Edge[]>()
  const key=(p:Point)=>`${p.x}:${p.y}`
  const add=(a:Point,b:Point)=>{
    const edge:Edge={a,b,used:false};edges.push(edge)
    const list=outgoing.get(key(a))??[];list.push(edge);outgoing.set(key(a),list)
  }
  for(const cell of cells){
    const c=cell%cols,r=Math.floor(cell/cols),x=c*tile,y=r*tile
    if(!occupied.has(cell-cols))add({x,y},{x:x+tile,y})
    if(c===cols-1||!occupied.has(cell+1))add({x:x+tile,y},{x:x+tile,y:y+tile})
    if(!occupied.has(cell+cols))add({x:x+tile,y:y+tile},{x,y:y+tile})
    if(c===0||!occupied.has(cell-1))add({x,y:y+tile},{x,y})
  }
  let outer:Point[]=[],area=0
  for(const start of edges){
    if(start.used)continue
    const points:Point[]=[];let edge:Edge|undefined=start
    while(edge&&!edge.used){
      edge.used=true;points.push(edge.a)
      if(key(edge.b)===key(start.a))break
      const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y
      const options:Edge[]=(outgoing.get(key(edge.b))??[]).filter(next=>!next.used)
      options.sort((a,b)=>dx*(b.b.y-b.a.y)-dy*(b.b.x-b.a.x)-(dx*(a.b.y-a.a.y)-dy*(a.b.x-a.a.x)))
      edge=options[0]
    }
    const signed=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length]!;return sum+p.x*q.y-q.x*p.y},0)
    if(signed>area){outer=points;area=signed}
  }
  if(outer.length<3)return []
  const corners=outer.filter((p,i)=>{
    const a=outer[(i+outer.length-1)%outer.length]!,b=outer[(i+1)%outer.length]!
    return (p.x-a.x)*(b.y-p.y)!==(p.y-a.y)*(b.x-p.x)
  })
  // 网格只负责脚下碰撞；轮廓削去直角，长岸面增加参差断口。
  const contour:Point[]=[]
  for(let i=0;i<corners.length;i++){
    const a=corners[(i+corners.length-1)%corners.length]!,p=corners[i]!,b=corners[(i+1)%corners.length]!
    const before=Math.hypot(p.x-a.x,p.y-a.y),after=Math.hypot(b.x-p.x,b.y-p.y),bevel=Math.min(12,before*.18,after*.18)
    contour.push({x:p.x+(a.x-p.x)*bevel/before,y:p.y+(a.y-p.y)*bevel/before})
    contour.push({x:p.x+(b.x-p.x)*bevel/after,y:p.y+(b.y-p.y)*bevel/after})
  }
  const rough:Point[]=[]
  for(let i=0;i<contour.length;i++){
    const a=contour[i]!,b=contour[(i+1)%contour.length]!,dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)
    const pieces=Math.max(1,Math.ceil(length/44))
    for(let k=0;k<pieces;k++){
      const t=k/pieces,jitter=k?(hash2(a.x+k*13,a.y)-.5)*9:0
      rough.push({x:a.x+dx*t-dy/length*jitter,y:a.y+dy*t+dx/length*jitter})
    }
  }
  return rough
}

function makeMass(map:TileMap,cells:readonly number[],height:number,seed:number,kind:HellRockMass['kind']):HellRockMass|null {
  const contour=groundContour(cells,map.cols,map.tile)
  if(contour.length<3)return null
  const left=Math.min(...contour.map(p=>p.x)),right=Math.max(...contour.map(p=>p.x))
  const top=Math.min(...contour.map(p=>p.y)),bottom=Math.max(...contour.map(p=>p.y)),x=(left+right)/2
  const width=right-left,depth=bottom-top
  return {x,y:bottom,width,depth,height,seed,kind,radius:Math.hypot(width,depth+height)+60,footprint:contour.map(p=>({x:p.x-x,y:p.y-bottom}))}
}

function fillPolygon(g:CanvasRenderingContext2D,points:readonly Point[],fill:string|CanvasGradient):Path2D {
  const path=new Path2D();points.forEach((p,i)=>i?path.lineTo(p.x,p.y):path.moveTo(p.x,p.y));path.closePath()
  g.fillStyle=fill;g.fill(path);return path
}

/** 宽岩台、陡壁和巨柱共享岩层光向；竖向断面与顶面构成真实高差。 */
function paintMass(g:CanvasRenderingContext2D,mass:HellRockMass):void {
  const {footprint,height,width,depth,seed,kind}=mass,palette=hellStonePalette(seed)
  const at=(p:Point,i:number,f:number):Point=>{
    const taper=kind==='pillar'?1.04-Math.sin(f*Math.PI)*.12+Math.max(0,f-.82)*.5:1-f*.07
    const offset=(hash2(seed,i+31)-.5)*Math.min(22,width*.08)
    return {x:p.x*taper+offset*f,y:p.y*(1-f*.12)-height*f*(.94+hash2(seed,i+71)*.11)}
  }
  g.save();g.lineJoin='round'
  const shadow=radialStamp('old-hell-rock-contact',.1,[[0,'rgba(20,20,16,.44)'],[.65,'rgba(20,20,16,.22)'],[1,'rgba(20,20,16,0)']])
  g.save();g.translate(6,-depth*.32+5);g.scale((width*.65+20)/128,(depth*.62+18)/128);drawSprite(g,shadow);g.restore()
  const levels=[0,.16,.38,.64,.84,1]
  for(let i=0;i<footprint.length;i++){
    const a=footprint[i]!,j=(i+1)%footprint.length,b=footprint[j]!,dx=b.x-a.x,dy=b.y-a.y
    if(dx>.1)continue
    const points=[...levels.map(f=>at(a,i,f)),...levels.slice().reverse().map(f=>at(b,j,f))]
    const side=dy>Math.abs(dx)*.65,light=dy<-Math.abs(dx)*.65
    const gradient=g.createLinearGradient(-width*.4,-height-depth,width*.4,0)
    gradient.addColorStop(0,light?palette.light:side?palette.base:palette.light)
    gradient.addColorStop(.55,side?palette.dark:palette.base)
    gradient.addColorStop(1,palette.dark)
    const face=fillPolygon(g,points,gradient)
    g.save();g.clip(face)
    const point=(u:number,f:number):Point=>{const pa=at(a,i,f),pb=at(b,j,f);return {x:pa.x+(pb.x-pa.x)*u,y:pa.y+(pb.y-pa.y)*u}}
    // 大块剥落面决定明暗，不再给每个小折面重复横纹和竖线。
    const h=hash2(seed,i+201)
    if(Math.abs(dx)>14&&h<.65){
      const f=.25+hash2(seed+i,213)*.5,extent=Math.min(.32,65/height)
      fillPolygon(g,[point(.04,f+extent),point(.42,f+extent*.78),point(.92,f+extent*.26),point(.78,f-extent*.6),point(.3,f-extent)],`${h<.27?palette.dark:palette.light}${h<.27?'50':'3b'}`)
      fillPolygon(g,[point(.04,f+extent),point(.42,f+extent*.78),point(.92,f+extent*.26),point(.8,f+extent*.17),point(.34,f+extent*.65)],`${palette.edge}30`)
    }
    if(h>.88){
      const f=.3+hash2(seed+i,225)*.38
      fillPolygon(g,[point(.14,f+.08),point(.31,f+.15),point(.82,f+.11),point(.61,f-.04),point(.29,f-.07)],`${palette.vein}42`)
    }
    paintHellStoneGrain(g,-width,-height*1.12-depth,width*2,height*1.12+depth+25,seed,.72)
    // 少数深裂隙以有宽度的楔形暗面表达，长度与位置不重复贯穿整根柱体。
    if(Math.abs(dx)>18&&hash2(seed,i+311)<.14){
      const f=.23+hash2(seed,i+319)*.42,p0=point(.48,f+.17),p1=point(.38,f+.07),p2=point(.57,f),p3=point(.42,f-.12)
      fillPolygon(g,[p0,{x:p1.x-2.5,y:p1.y},{x:p2.x-3,y:p2.y},p3,{x:p2.x+1,y:p2.y-1},{x:p1.x+1.5,y:p1.y}],`${palette.dark}da`)
      fillPolygon(g,[{x:p1.x+1.5,y:p1.y},{x:p2.x+1,y:p2.y-1},p3,{x:p2.x+2,y:p2.y}],`${palette.edge}44`)
    }
    g.restore()
  }
  const capPoints=footprint.map((p,i)=>at(p,i,1))
  const top=g.createLinearGradient(-width*.45,-height-depth,width*.4,-height)
  top.addColorStop(0,palette.top);top.addColorStop(.65,palette.light);top.addColorStop(1,palette.base)
  const cap=fillPolygon(g,capPoints,top)
  g.save();g.clip(cap)
  // 顶面只保留几块不闭合的剥蚀色面，移除所有汇向中心的放射状裂纹。
  for(let k=0;k<3;k++){
    const start=Math.floor(k*capPoints.length/3),span=Math.max(2,Math.floor(capPoints.length/4))
    const patch=Array.from({length:span},(_,i)=>capPoints[(start+i)%capPoints.length]!)
    const a=patch[0]!,b=patch[patch.length-1]!
    patch.push({x:b.x*.5+(hash2(seed,k+401)-.5)*width*.2,y:b.y+depth*.22},{x:a.x*.6,y:a.y+depth*.31})
    fillPolygon(g,patch,`${k===1?palette.dark:palette.edge}${k===1?'24':'20'}`)
  }
  paintHellStoneGrain(g,-width,-height*1.12-depth,width*2,height*.22+depth+25,seed,.8)
  g.restore()
  for(let i=0;i<capPoints.length;i++){
    const a=capPoints[i]!,b=capPoints[(i+1)%capPoints.length]!
    if(b.x>a.x)continue
    // 厚薄变化的崩口面替代等宽描边；受光只停留在少数凸出的断口。
    const lip=2+hash2(seed,i+451)*5
    fillPolygon(g,[a,b,{x:b.x-1,y:b.y+lip},{x:a.x+1,y:a.y+lip*.65}],`${palette.dark}aa`)
    if(hash2(seed,i+459)<.38)fillPolygon(g,[a,b,{x:b.x-1,y:b.y+1},{x:a.x+1,y:a.y+1.7}],`${palette.edge}77`)
  }
  g.restore()
}

/** 岩体几何由房间种子决定；只缓存视野中用到的独立立面，不扩大地板区块的尺寸。 */
export class OldHellRocks {
  readonly formations:HellRockMass[]=[]
  private readonly cache=new Map<HellRockMass,CachedRock>()
  private pixels=0
  private clock=0
  private view:Viewport|null=null
  private readonly visibleMasses=new Set<HellRockMass>()
  constructor(private readonly map:TileMap,private readonly terrain:RoomTerrain,buildings:ReadonlySet<number>){
    const excluded=new Set<number>()
    for(const rock of terrain.rockFormations??[]){
      for(const cell of rock.cells)excluded.add(cell)
      const mass=makeMass(map,rock.cells,rock.height,rock.seed,rock.kind)
      if(mass)this.formations.push(mass)
    }
    const boundary=new Set<number>(),buckets=new Map<string,number[]>()
    const valid=(c:number,r:number)=>c>=0&&r>=0&&c<map.cols&&r<map.rows
    const usable=(c:number,r:number)=>valid(c,r)&&map.tileAt(c,r)===TILE_WALL&&!buildings.has(r*map.cols+c)&&!excluded.has(r*map.cols+c)
    for(let r=0;r<map.rows;r++)for(let c=0;c<map.cols;c++){
      if(!usable(c,r))continue
      if([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>valid(c+dx!,r+dy!)&&map.tileAt(c+dx!,r+dy!)!==TILE_WALL))boundary.add(r*map.cols+c)
    }
    // 岩岸向后延伸一层厚度，连续宽台面承接高墙，而不是一排薄石片。
    const thickened=new Set(boundary)
    for(const cell of boundary){
      const c=cell%map.cols,r=Math.floor(cell/map.cols)
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const)if(usable(c+dx,r+dy))thickened.add((r+dy)*map.cols+c+dx)
    }
    for(const cell of thickened){
      const c=cell%map.cols,r=Math.floor(cell/map.cols),key=`${Math.floor(c/5)}:${Math.floor(r/3)}`
      const cells=buckets.get(key)??[];cells.push(cell);buckets.set(key,cells)
    }
    for(const cells of buckets.values()){
      const pending=new Set(cells)
      while(pending.size){
        const first=pending.values().next().value as number,group=[first];pending.delete(first)
        for(let i=0;i<group.length;i++){
          const cell=group[i]!,c=cell%map.cols,r=Math.floor(cell/map.cols)
          for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const){
            if(!valid(c+dx,r+dy))continue
            const next=(r+dy)*map.cols+c+dx
            if(pending.delete(next))group.push(next)
          }
        }
        const seed=terrain.seed+first*37,h=hash2(seed,513)
        const pillar=group.length>=7&&h>.79
        const height=pillar?300+hash2(seed,91)*165:h<.2?45+h*110:100+hash2(seed,97)*135
        const mass=makeMass(map,group,height,seed,pillar?'pillar':'wall')
        if(mass)this.formations.push(mass)
      }
    }
    this.formations.sort((a,b)=>a.y-b.y)
  }
  get rasterBytes():number{return this.pixels*4}
  setViewport(view:Viewport):void {
    this.view=view;this.visibleMasses.clear()
    for(const mass of this.formations)if(this.inView(mass,view))this.visibleMasses.add(mass)
    this.trimCache()
  }
  private inView(mass:HellRockMass,view:Viewport):boolean {
    return mass.x+mass.width*.67+24>=view.left&&mass.x-mass.width*.67-24<=view.right
      &&mass.y+44>=view.top&&mass.y-mass.height*1.15-mass.depth-28<=view.bottom
  }
  /** 当前可见立面必须常驻；预算只淘汰屏外对象，避免一帧内循环烘焙。 */
  private trimCache():void {
    while(this.cache.size>24||this.pixels>6*1024*1024){
      let oldest:HellRockMass|undefined,used=Infinity
      for(const [rock,entry] of this.cache)if(!this.visibleMasses.has(rock)&&entry.used<used){oldest=rock;used=entry.used}
      if(!oldest)break
      const entry=this.cache.get(oldest)!;this.pixels-=entry.pixels;entry.sprite.image.width=entry.sprite.image.height=1;this.cache.delete(oldest)
    }
  }
  releaseRenderResources():void {
    for(const {sprite} of this.cache.values())sprite.image.width=sprite.image.height=1
    this.cache.clear();this.pixels=0
  }
  render(g:CanvasRenderingContext2D,mass:HellRockMass,players:readonly Player[]):void {
    // 高柱的包围圆较大，再按实际贴图矩形剔除，避免烘焙看不见的远处立面。
    if(this.view&&!this.visibleMasses.has(mass))return
    if(!this.view)this.visibleMasses.add(mass)
    let cached=this.cache.get(mass)
    if(!cached){
      const left=-mass.width*.67-24,top=-mass.height*1.15-mass.depth-28,width=mass.width*1.34+48,height=mass.height*1.15+mass.depth+72
      const sprite=bakeSprite(left,top,width,height,c=>{
        paintMass(c,mass)
        // 门口孔洞一次性抠进贴图；远处的门不扩大本立面的裁切范围。
        const holes=new Path2D();let count=0
        for(const door of this.terrain.doors){
          const x=(door.col+.5)*this.map.tile-mass.x,y=(door.row+.5)*this.map.tile-mass.y
          if(x+76<left||x-76>left+width||y+36<top||y-167>top+height)continue
          addOldHellDoorCutout(holes,x,y);count++
        }
        if(count){c.save();c.globalCompositeOperation='destination-out';c.fill(holes);c.restore()}
      },1.5)
      cached={sprite,pixels:sprite.image.width*sprite.image.height,used:0}
      this.cache.set(mass,cached);this.pixels+=cached.pixels
      this.trimCache()
    }
    cached.used=++this.clock
    let proximity=0
    for(const player of players){
      const behind=Math.max(0,Math.min(1,(mass.y-player.y)/30))
      if(behind===0)continue
      const dx=Math.max(0,Math.abs(player.x-mass.x)-mass.width*.6-10)
      const dy=Math.max(0,mass.y-mass.depth-mass.height-30-player.y,player.y-35-mass.y)
      proximity=Math.max(proximity,behind*Math.max(0,Math.min(1,(62-Math.hypot(dx,dy))/52)))
    }
    const fade=proximity*proximity*(3-2*proximity)
    g.save();g.translate(mass.x,mass.y);g.globalAlpha*=1-fade*.72
    // 门洞按实际门格裁切，超高立面也不能把可通行入口遮成实墙。
    g.imageSmoothingEnabled=true;drawSprite(g,cached.sprite);g.restore()
  }
}
