import type { TileMap } from '../tilemap'
import { circleHitsProp, type Prop } from './props'
import { drawCraftMarker } from './workshopScene'
import { drawMineSprite } from './mineAssets'

export interface FurnaceWreck {x:number;y:number;variant:0|1|2;parts:boolean;done:boolean}
const sprites=new Map<number,HTMLCanvasElement>()

/** 三种倒塌炉体共用炉口语汇，各自保留石砌、砖拱与锈铁壳的破损结构。 */
function sprite(variant:number):HTMLCanvasElement{
  const saved=sprites.get(variant);if(saved)return saved
  const image=document.createElement('canvas');image.width=240;image.height=190
  const g=image.getContext('2d')!;g.scale(2,2);g.translate(60,77);g.lineJoin='round'
  const face=(points:number[][],color:string)=>{g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x!,y!):g.moveTo(x!,y!));g.closePath();g.fillStyle=color;g.fill();g.strokeStyle='#302d2a';g.lineWidth=1.2;g.stroke()}
  g.fillStyle='#211d1966';g.beginPath();g.ellipse(0,1,43,10,0,0,Math.PI*2);g.fill()
  if(variant===0){
    face([[-34,-3],[-35,-36],[-26,-55],[-8,-58],[3,-47],[20,-50],[32,-34],[27,-3]],'#716d60')
    face([[-35,-36],[-26,-55],[-8,-58],[3,-47],[-18,-38]],'#a19a80')
    face([[3,-47],[20,-50],[32,-34],[27,-3],[15,-9],[18,-35]],'#4f524b')
    g.strokeStyle='#3b3c35';g.lineWidth=1.5;g.beginPath();g.moveTo(-34,-23);g.lineTo(-21,-24);g.moveTo(-31,-38);g.lineTo(-16,-35);g.moveTo(-24,-51);g.lineTo(-18,-38);g.moveTo(13,-34);g.lineTo(28,-29);g.stroke()
  }else if(variant===1){
    face([[-33,-2],[-35,-31],[-25,-51],[-10,-56],[1,-50],[6,-42],[23,-42],[34,-27],[31,-2]],'#866b56')
    g.strokeStyle='#403830';g.lineWidth=2;for(let i=0;i<4;i++){g.beginPath();g.moveTo(-31,-8-i*9);g.lineTo(i<3?31:14,-8-i*9);g.stroke()}
    g.strokeStyle='#b49b76';g.lineWidth=.8;for(let i=0;i<7;i++){const x=-27+i*8;g.beginPath();g.moveTo(x,-38+i%2*9);g.lineTo(x+2,-29+i%2*9);g.stroke()}
    face([[-15,-54],[-3,-58],[4,-52],[0,-45],[-10,-47]],'#ab8b66')
  }else{
    face([[-33,-4],[-38,-38],[-24,-56],[10,-52],[33,-38],[29,-3]],'#5c5f58')
    face([[-38,-38],[-24,-56],[10,-52],[7,-39],[-14,-32]],'#8b8972')
    face([[7,-39],[10,-52],[33,-38],[29,-3],[15,-8]],'#414c48')
    g.strokeStyle='#ad9367';g.lineWidth=1;g.beginPath();g.moveTo(-28,-39);g.lineTo(-13,-47);g.moveTo(18,-29);g.lineTo(23,-23);g.stroke()
    for(let i=0;i<7;i++){g.fillStyle=i%2?'#92674780':'#b9865066';g.beginPath();g.ellipse(-26+i*7,-34+Math.sin(i*3)*8,2.5,4,i,0,Math.PI*2);g.fill()}
  }
  g.fillStyle='#242925';g.beginPath();g.moveTo(-21,-2);g.lineTo(-21,-20);g.quadraticCurveTo(-7,-44,11,-23);g.lineTo(16,-2);g.closePath();g.fill()
  g.strokeStyle='#4a4137';g.lineWidth=3;g.beginPath();g.moveTo(-21,-1);g.lineTo(-21,-20);g.quadraticCurveTo(-7,-44,11,-23);g.stroke()
  face([[-30,-7],[-14,-12],[-3,-5],[-9,3],[-25,4]],variant===1?'#9f8061':'#8a8872')
  face([[13,-11],[28,-16],[39,-6],[31,2],[18,3]],variant===2?'#676958':'#777668')
  face([[-12,-2],[1,-8],[14,-4],[9,7],[-5,6]],'#504e44')
  face([[34,-19],[42,-18],[47,-10],[40,-6],[36,-10]],'#7b6c53')
  g.strokeStyle='#9e967c';g.lineWidth=1;g.beginPath();g.moveTo(-26,-6);g.lineTo(-15,-8);g.moveTo(20,-7);g.lineTo(29,-10);g.stroke()
  g.strokeStyle='#474844';g.lineWidth=3;g.beginPath();g.moveTo(-8,-14);g.lineTo(7,-6);g.moveTo(-2,-18);g.lineTo(16,-10);g.stroke()
  g.fillStyle='#26282255';for(let i=0;i<14;i++){g.beginPath();g.ellipse(-36+i*5.5,4+Math.sin(i*1.7)*4,2+i%2,1,0,0,Math.PI*2);g.fill()}
  sprites.set(variant,image);return image
}

/** 先筛出玩家能到达的地面，再放炉骸，确保保底不会藏在不可采红玉后。 */
export class FurnaceWrecks{
  readonly all:FurnaceWreck[]=[]
  readonly colliders:Prop[]=[]
  constructor(map:TileMap,props:readonly Prop[],spawn:{x:number;y:number},specs:readonly {variant:0|1|2;parts:boolean}[],occupied:readonly {x:number;y:number}[]){
    const t=map.tile,seen=new Set<number>(),queue=[{col:Math.floor(spawn.x/t),row:Math.floor(spawn.y/t)}],spots:Array<{x:number;y:number}>=[]
    for(let i=0;i<queue.length;i++){
      const q=queue[i]!,key=q.row*map.cols+q.col
      if(seen.has(key)||q.col<0||q.row<0||q.col>=map.cols||q.row>=map.rows)continue
      seen.add(key);const x=(q.col+.5)*t,y=(q.row+.5)*t
      if(map.solidAtWorld(x,y)||props.some(p=>circleHitsProp(x,y,14,p)))continue
      spots.push({x,y});for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])queue.push({col:q.col+dx!,row:q.row+dy!})
    }
    for(const spec of specs){
      const valid=spots.filter(p=>Math.hypot(p.x-spawn.x,p.y-spawn.y)>110&&this.all.every(w=>Math.hypot(w.x-p.x,w.y-p.y)>110)&&occupied.every(w=>Math.hypot(w.x-p.x,w.y-p.y)>55)&&[[-35,0],[35,0],[0,-36],[0,18]].every(([dx,dy])=>!map.solidAtWorld(p.x+dx!,p.y+dy!))&&!props.some(w=>circleHitsProp(p.x,p.y,42,w)))
      const fallback=spots.filter(p=>this.all.every(w=>Math.hypot(w.x-p.x,w.y-p.y)>65))
      const pool=valid.length?valid:fallback,position=pool[Math.floor(Math.random()*pool.length)]??spawn
      this.all.push({...position,...spec,done:false})
      this.colliders.push({id:'touhou:furnace_wreck',x:position.x,y:position.y,s:1,seed:spec.variant,halfWidth:30,halfThick:7,blockBullets:false})
    }
  }
  render(g:CanvasRenderingContext2D,w:FurnaceWreck,time:number,enabled:boolean):void{
    if(!drawMineSprite(g,(['furnace-wreck-0','furnace-wreck-1','furnace-wreck-2'] as const)[w.variant],w.x-60,w.y-77,120,95)){const image=sprite(w.variant);g.drawImage(image,w.x-60,w.y-77,120,95)}
    if(enabled&&!w.done)drawCraftMarker(g,w.x,w.y+15,time)
  }
}
