import { bakeSprite,drawSprite,type RasterSprite } from '../../core/rendering/SpriteCache'
import { radialStamp } from '../../core/rendering/RadialStamp'
import { visible,type Viewport } from '../../core/rendering/Viewport'
import { hash2 } from './artPalette'
import { drawMineSprite,mineAssetsReady } from './mineAssets'
import { drawHellSoil,drawGeothermalCrack,drawHangingLimestone,drawRuinedTimberHouse } from './oldHellArtwork'
import { OldHellLava } from './oldHellLava'
import { OldHellPits } from './oldHellPits'
import { OldHellRocks } from './oldHellRocks'
import { paintOldHellDoorway,renderOldHellDoorState,type OldHellDoor } from './oldHellDoorway'
import { TILE_FLOOR,TILE_WALL,TILE_ORE,TILE_PIT,TILE_DOOR_CLOSED,TILE_DOOR_OPEN, type TileMap } from '../tilemap'
import type { RoomTerrain } from '../cave/dungeon/types'
import type { Player } from '../Player'
import type { LightSource } from './lighting'
import type { Prop } from './props'
import { OLD_HELL_CONTAINERS } from '../../content/props/vanilla/oldHellContainerLayout'
import { OldHellAtmosphere } from './oldHellAtmosphere'

interface Building {
  x:number;y:number;left:number;top:number;width:number;height:number;radius:number
  variant:0|1;seed:number
}
interface Vent {x:number;y:number;seed:number;points:Array<{x:number;y:number}>}
interface CeilingStone {x:number;y:number;width:number;height:number;seed:number}
interface Chunk {image:HTMLCanvasElement;used:number;x:number;y:number;width:number;height:number}
const CHUNK=384,DENSITY=1.5,MAX_CHUNKS=32,GUTTER=6

/** 角色头身到遮挡区域的距离连续渐变，多个玩家取最近者，与钟乳石共用同一曲线。 */
function proximityFade(players:readonly Player[],left:number,top:number,right:number,bottom:number):number {
  let proximity=0
  for(const player of players){
    const dx=Math.max(0,left-player.x,player.x-right)
    const dy=Math.max(0,top-player.y,player.y-34-bottom)
    proximity=Math.max(proximity,Math.max(0,Math.min(1,(60-Math.hypot(dx,dy))/48)))
  }
  return proximity*proximity*(3-2*proximity)
}

/** 旧地狱独立环境：碰撞仍来自普通 TileMap，所有像素缓存均在模拟快照之外。 */
export class OldHellScene {
  readonly buildings:Building[]
  readonly rocks:OldHellRocks
  readonly containerProps:Prop[]=[]
  private readonly reserved:Set<number>
  private readonly buildingCells=new Set<number>()
  private readonly chunks=new Map<number,Chunk>()
  private readonly structures=new Map<Building,RasterSprite>()
  private readonly ceiling:CeilingStone[]=[]
  private readonly stones=new Map<CeilingStone,RasterSprite>()
  private readonly doorFrames=new Map<number,RasterSprite>()
  private readonly vents:Vent[]=[]
  private readonly lava:OldHellLava
  private readonly pits:OldHellPits
  private clock=0
  private assetsReady=false
  private readonly atmosphere:OldHellAtmosphere

  constructor(private readonly map:TileMap,private readonly terrain:RoomTerrain){
    const t=map.tile,seed=terrain.seed
    this.atmosphere=new OldHellAtmosphere(seed,map.cols*t,map.rows*t)
    this.lava=new OldHellLava(map,seed)
    this.pits=new OldHellPits(map,seed)
    this.reserved=new Set(terrain.reserved)
    this.buildings=terrain.buildings.map(b=>({x:(b.col+b.width/2)*t,y:(b.row+b.height)*t,
      left:b.col*t,top:b.row*t,width:b.width*t,height:b.height*t,radius:Math.hypot(b.width*t,b.height*t)+120,variant:b.variant,seed:b.seed}))
    for(const b of terrain.buildings){
      for(let r=b.row;r<b.row+b.height;r++)for(let c=b.col;c<b.col+b.width;c++)this.buildingCells.add(r*map.cols+c)
      b.containers.forEach((box,index)=>{
        const fallback=box.large?OLD_HELL_CONTAINERS.dwelling:OLD_HELL_CONTAINERS.workshop
        const id=box.id??fallback[Math.floor(hash2(b.seed,index+601)*fallback.length)]!
        this.containerProps.push({id,x:(box.col+.5)*t,y:(box.row+.8)*t,s:b.variant===0?.8:.9,seed:b.seed+index*7919,
          artStyle:{wallTint:'#9b775b',tintStrength:.24,dampness:0,vegetation:0,deposits:0,fungi:0,boneFragments:0,fogStrength:1,deepHollow:false}})
      })
    }
    this.rocks=new OldHellRocks(map,terrain,this.buildingCells)
    // 裂缝形状固定于房间种子；热汽与火星只以模拟时间驱动，不消耗战斗随机源。
    for(let i=0;i<55&&this.vents.length<11;i++){
      const x=(10+hash2(seed,i*17+1)*(map.cols-20))*t,y=(8+hash2(seed,i*17+2)*(map.rows-16))*t
      const col=map.worldToCol(x),row=map.worldToRow(y)
      if(map.isSolid(col,row)||this.buildingCells.has(row*map.cols+col)||this.reserved.has(row*map.cols+col))continue
      const length=140+hash2(seed,i*17+3)*180,points:Array<{x:number;y:number}>=[]
      for(let k=0;k<8;k++){
        const px=x+(k/7-.5)*length,py=y+(hash2(seed+i,k*13)-.5)*45
        if(map.solidAtWorld(px,py)){points.length=0;break}
        points.push({x:px,y:py})
      }
      if(points.length&&this.vents.every(v=>Math.hypot(v.x-x,v.y-y)>220))this.vents.push({x,y,seed:i+hash2(seed,i),points})
    }
    // 钟乳石必须附着真实北侧岩顶，不再把无附着物的尖柱散放在房间中央。
    for(let i=0;i<48;i++){
      const col=5+Math.floor(hash2(seed,i*9+701)*(map.cols-10))
      let row=3
      while(row<map.rows-4&&map.tileAt(col,row)!==TILE_FLOOR)row++
      if(row>=map.rows-4)continue
      const k=row*map.cols+col
      if(map.tileAt(col,row)!==TILE_FLOOR||map.tileAt(col,row-1)!==TILE_WALL||map.tileAt(col,row-2)!==TILE_WALL||this.reserved.has(k)||this.buildingCells.has(k)||this.buildingCells.has(k-map.cols))continue
      const x=(col+.5)*t,width=20+hash2(seed,i*9+703)*25
      const anchor=this.rocks.formations.find(rock=>x>rock.x-rock.width*.5&&x<rock.x+rock.width*.5&&Math.abs(rock.y-row*t)<t*1.5)
      const y=anchor?anchor.y-anchor.height-anchor.depth*.2+24:row*t-65
      const height=anchor?Math.min(220,anchor.height*.65+48+hash2(seed,i*9+704)*50):48+hash2(seed,i*9+704)*90
      if(this.ceiling.some(p=>Math.abs(p.x-x)<75&&Math.abs(p.y-y)<100))continue
      this.ceiling.push({x,y,width,height,seed:i+hash2(seed,i+705)})
    }
  }

  get rasterBytes():number {
    let bytes=0
    for(const chunk of this.chunks.values())bytes+=chunk.image.width*chunk.image.height*4
    for(const sprite of this.structures.values())bytes+=sprite.image.width*sprite.image.height*4
    for(const sprite of this.stones.values())bytes+=sprite.image.width*sprite.image.height*4
    for(const sprite of this.doorFrames.values())bytes+=sprite.image.width*sprite.image.height*4
    return bytes+this.rocks.rasterBytes+this.lava.rasterBytes+this.atmosphere.rasterBytes
  }
  releaseRenderResources():void {
    for(const chunk of this.chunks.values())chunk.image.width=chunk.image.height=1
    for(const sprite of this.structures.values())sprite.image.width=sprite.image.height=1
    for(const sprite of this.stones.values())sprite.image.width=sprite.image.height=1
    for(const sprite of this.doorFrames.values())sprite.image.width=sprite.image.height=1
    this.chunks.clear();this.structures.clear();this.stones.clear();this.doorFrames.clear()
    this.rocks.releaseRenderResources()
    this.lava.releaseRenderResources()
    this.atmosphere.releaseRenderResources()
  }

  appendLights(out:LightSource[],time:number,view?:{x:number;y:number;w:number;h:number}):void {
    const phase=Math.floor(time*8)/8
    for(const vent of this.vents){
      if(view&&(vent.x<view.x-220||vent.x>view.x+view.w+220||vent.y<view.y-220||vent.y>view.y+view.h+220))continue
      out.push({x:vent.x,y:vent.y,r:135,power:.18,color:'#d28361',tint:.045*(.8+.2*Math.sin(phase*1.5+vent.seed))})
    }
  }

  /** 仅烘焙当前视野附近的区块，硬性限制缓存数量，避免大房间占用数百兆像素。 */
  renderGround(g:CanvasRenderingContext2D,view:Viewport,time:number):void {
    this.rocks.setViewport(view)
    if(this.assetsReady!==mineAssetsReady()){this.releaseRenderResources();this.assetsReady=mineAssetsReady()}
    const width=this.map.cols*this.map.tile,height=this.map.rows*this.map.tile,columns=Math.ceil(width/CHUNK)
    const left=Math.max(0,Math.floor(view.left/CHUNK)),right=Math.min(columns-1,Math.floor(view.right/CHUNK))
    const top=Math.max(0,Math.floor(view.top/CHUNK)),bottom=Math.min(Math.ceil(height/CHUNK)-1,Math.floor(view.bottom/CHUNK))
    g.save();g.imageSmoothingEnabled=true;g.fillStyle='#1a1410';g.fillRect(0,0,width,height)
    for(let r=top;r<=bottom;r++)for(let c=left;c<=right;c++){
      const key=r*columns+c
      let chunk=this.chunks.get(key)
      if(!chunk){
        const x=c*CHUNK,y=r*CHUNK,w=Math.min(CHUNK,width-x),h=Math.min(CHUNK,height-y)
        const image=document.createElement('canvas');image.width=Math.ceil((w+GUTTER*2)*DENSITY);image.height=Math.ceil((h+GUTTER*2)*DENSITY)
        const ctx=image.getContext('2d')!;ctx.scale(DENSITY,DENSITY);ctx.translate(GUTTER-x,GUTTER-y)
        this.paintChunk(ctx,x-GUTTER,y-GUTTER,w+GUTTER*2,h+GUTTER*2);chunk={image,x,y,width:w,height:h,used:0};this.chunks.set(key,chunk)
      }
      // 采样区四周有真实相邻像素，且边缘轻微重叠；相机缩放时不再混入透明黑边。
      chunk.used=++this.clock;g.drawImage(chunk.image,(GUTTER-.5)*DENSITY,(GUTTER-.5)*DENSITY,(chunk.width+1)*DENSITY,(chunk.height+1)*DENSITY,
        chunk.x-.5,chunk.y-.5,chunk.width+1,chunk.height+1)
    }
    while(this.chunks.size>MAX_CHUNKS){
      let oldest=-1,used=Infinity
      for(const [key,c] of this.chunks){
        const col=key%columns,row=Math.floor(key/columns)
        if(col>=left&&col<=right&&row>=top&&row<=bottom)continue
        if(c.used<used){oldest=key;used=c.used}
      }
      if(oldest<0)break
      const victim=this.chunks.get(oldest)!;victim.image.width=victim.image.height=1;this.chunks.delete(oldest)
    }
    this.lava.render(g,view,time)
    g.restore()
  }

  private paintChunk(g:CanvasRenderingContext2D,x:number,y:number,width:number,height:number):void {
    const t=this.map.tile,seed=this.terrain.seed
    const c0=Math.max(0,Math.floor(x/t)-3),c1=Math.min(this.map.cols-1,Math.ceil((x+width)/t)+3)
    const r0=Math.max(0,Math.floor(y/t)-4),r1=Math.min(this.map.rows-1,Math.ceil((y+height)/t)+4)
    g.fillStyle='#1a1410';g.fillRect(x,y,width,height)
    // 地板沿世界坐标连续铺设，区块接缝不重新抽随机，也不会出现亮度跳变。
    const ground=new Path2D()
    for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++){
      // 地面蒙版读取不可变地形，挖矿和读档都不能把矿格底下变成黑色方洞。
      const type=this.terrain.tiles[r*this.map.cols+c]
      if(type===TILE_FLOOR||type===TILE_ORE||type===TILE_PIT||type===TILE_DOOR_CLOSED||type===TILE_DOOR_OPEN||this.buildingCells.has(r*this.map.cols+c))ground.rect(c*t,r*t,t,t)
    }
    g.save();g.clip(ground)
    drawHellSoil(g,x-150,y-200,width+300,height+400,seed)
    g.restore()
    this.lava.paint(g,{left:x,top:y,right:x+width,bottom:y+height})
    this.pits.paint(g,{left:x,top:y,right:x+width,bottom:y+height})
    for(const b of this.buildings){
      if(b.left>x+width||b.left+b.width<x||b.top>y+height||b.top+b.height<y)continue
      g.fillStyle='#413540';g.fillRect(b.left,b.top,b.width,b.height)
      g.save();g.beginPath();g.rect(b.left,b.top,b.width,b.height);g.clip()
      for(let row=b.top;row<b.top+b.height;row+=23){
        const index=Math.floor((row-b.top)/23)
        drawMineSprite(g,'timber-beam',b.left-4,row,b.width+8,25,'#5d4948',.32)
        if(hash2(b.seed,index)<.3){
          const offset=hash2(index,b.seed)*b.width
          g.fillStyle='#493b4255';g.beginPath();g.moveTo(b.left+offset,row);g.lineTo(b.left+offset+32,row+3);g.lineTo(b.left+offset+27,row+18);g.lineTo(b.left+offset-5,row+22);g.closePath();g.fill()
        }
      }
      g.restore()
    }
    // 岩壁和岩柱改由独立立面参与前后遮挡，地面层不再逐格摆石头。
    for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++){
      const type=this.map.tileAt(c,r),px=c*t,py=r*t,h=hash2(seed+c,r*13)
      if(type===TILE_FLOOR&&!this.buildingCells.has(r*this.map.cols+c)&&!this.reserved.has(r*this.map.cols+c)){
        const chance=hash2(seed+c*7,r*41)
        if(chance<.025){
          g.save();g.globalAlpha=.82;g.translate(px+22,py+24);g.scale(h<.5?-1:1,1)
          drawMineSprite(g,'plant-fern',-18,-29,30+h*15,29+h*14,'#ad8759',.38);g.restore()
        }else if(chance<.046)this.drawBush(g,px+20,py+30,h)
        else if(chance<.057){
          g.save();g.translate(px+20,py+20);g.rotate((h-.5)*1.4);g.globalAlpha=.52
          drawMineSprite(g,'ground-bones',-19,-10,30+h*17,18+h*11,'#937c67',.28);g.restore()
        }else if(chance<.086)drawMineSprite(g,h<.35?'boulder-b':'ground-rubble',px+4,py+8,24+h*20,16+h*15,'#816454',.22)
        else if(chance<.1){
          g.save();g.translate(px+22,py+22);g.scale(1,.42)
          const stain=g.createRadialGradient(0,0,3,0,0,24);stain.addColorStop(0,'#30273355');stain.addColorStop(1,'#30273300')
          g.fillStyle=stain;g.fillRect(-24,-24,48,48);g.restore()
        }
      }
    }
    for(const vent of this.vents){
      if(visible({left:x,top:y,right:x+width,bottom:y+height},vent.x,vent.y,250))drawGeothermalCrack(g,vent.points,vent.seed)
    }
  }

  /** 门框与角色一起排序，站到门前时人物仍处于支护结构前方。 */
  renderDoorway(g:CanvasRenderingContext2D,door:OldHellDoor,time:number,players:readonly Player[]):void {
    let sprite=this.doorFrames.get(door.doorId)
    if(!sprite){
      sprite=bakeSprite(-108,-183,210,245,c=>paintOldHellDoorway(c,this.terrain.seed+door.doorId*37),1.5)
      this.doorFrames.set(door.doorId,sprite)
    }
    const x=(door.col+.5)*this.map.tile,y=(door.row+.5)*this.map.tile
    const fade=proximityFade(players,x-76,y-167,x+76,y+36)
    g.save();g.translate(x,y);g.imageSmoothingEnabled=true
    g.save();g.globalAlpha*=1-fade*.72;drawSprite(g,sprite);g.restore()
    // 封锁状态与通行路标独立于支护结构渐隐，靠近入口时仍清楚可读。
    renderOldHellDoorState(g,door,time);g.restore()
  }

  private drawBush(g:CanvasRenderingContext2D,x:number,y:number,seed:number):void {
    g.save();g.translate(x,y);g.lineCap='round'
    g.fillStyle='#2a232c33';g.beginPath();g.ellipse(0,1,18,4,0,0,Math.PI*2);g.fill()
    for(let i=0;i<5;i++){
      const dx=(i-2)*7,height=14+hash2(i,seed*99)*18
      g.strokeStyle=i%2?'#8f735e':'#66515a';g.lineWidth=1.7;g.beginPath();g.moveTo(0,0);g.lineTo(dx*.45,-height*.45);g.lineTo(dx,-height);g.moveTo(dx*.45,-height*.45);g.lineTo(dx+7,-height*.72);g.lineTo(dx+9,-height*.91);g.stroke()
      if(i%2){g.fillStyle='#a28658';g.beginPath();g.ellipse(dx,-height,3,1.5,-.7,0,Math.PI*2);g.fill()}
    }
    g.restore()
  }

  renderBuilding(g:CanvasRenderingContext2D,b:Building,players:readonly Player[]):void {
    let sprite=this.structures.get(b)
    if(!sprite){
      sprite=bakeSprite(-b.width/2-70,-b.height-210,b.width+150,b.height+280,
        c=>drawRuinedTimberHouse(c,b.width,b.height,this.map.tile,b.variant,b.seed),1.5)
      this.structures.set(b,sprite)
    }
    const fade=proximityFade(players,b.left-15,b.top-20,b.left+b.width+15,b.top+b.height+12)
    g.save();g.translate(b.x,b.y);g.globalAlpha*=1-fade*.62
    g.imageSmoothingEnabled=true;drawSprite(g,sprite);g.restore()
  }

  /** 雾只遮淡环境与角色，弹幕和交互标记在其后绘制，保留近处危险的可读性。 */
  renderAtmosphere(g:CanvasRenderingContext2D,view:Viewport,time:number,players:readonly Player[],clearedAt:number|null):void {
    this.atmosphere.render(g,view,time,players,clearedAt,this.vents)
    g.save()
    this.lava.renderAir(g,view,time)
    // 火星数量固定于可见裂缝，粒子不遍历整张大地图，也不进入战斗实体数组。
    for(const vent of this.vents){
      if(!visible(view,vent.x,vent.y,230))continue
      for(let i=0;i<7;i++){
        const p=(time*(.28+hash2(i,vent.seed)*.18)+i*.143+vent.seed)%1
        const x=vent.x+(i-3)*20+Math.sin(p*5+i)*13,y=vent.y-p*(60+hash2(vent.seed,i)*90)
        g.globalAlpha=Math.sin(p*Math.PI)*.85;g.fillStyle=i%3?'#f5b474':'#ffd6a0';g.fillRect(x,y,1.6,3)
      }
    }
    g.restore()
  }

  renderCeiling(g:CanvasRenderingContext2D,view:Viewport,players:readonly Player[]):void {
    for(const stone of this.ceiling){
      if(!visible(view,stone.x,stone.y,stone.height+stone.width*3))continue
      let sprite=this.stones.get(stone)
      if(!sprite){
        const w=stone.width,h=stone.height
        sprite=bakeSprite(-w*2,-65,w*4,h+85,c=>drawHangingLimestone(c,w,h,stone.seed),1.5)
        this.stones.set(stone,sprite)
      }
      const fade=proximityFade(players,stone.x-stone.width-12,stone.y-12,stone.x+stone.width+12,stone.y+stone.height)
      g.save();g.translate(stone.x,stone.y);g.globalAlpha*=1-fade*.82
      g.imageSmoothingEnabled=true;drawSprite(g,sprite);g.restore()
    }
  }
}
