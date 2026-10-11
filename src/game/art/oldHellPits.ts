import { TILE_PIT,type TileMap } from '../tilemap'
import { hash2 } from './artPalette'
import { paintHellStoneGrain } from './oldHellStoneMaterial'
import { visible,type Viewport } from '../../core/rendering/Viewport'

interface Point {x:number;y:number}
interface Pit {x:number;y:number;radius:number;seed:number;edge:Point[]}
function path(points:readonly Point[]):Path2D {
  const result=new Path2D();points.forEach((p,i)=>i?result.lineTo(p.x,p.y):result.moveTo(p.x,p.y));result.closePath();return result
}

/** 相邻深坑共用一圈塌岸，碰撞仍复用原来的坑格，外观不再按格画圆孔。 */
export class OldHellPits {
  private readonly pits:Pit[]=[]
  constructor(map:TileMap,seed:number){
    const pending=new Set<number>(),cols=map.cols,t=map.tile
    for(let r=0;r<map.rows;r++)for(let c=0;c<cols;c++)if(map.tileAt(c,r)===TILE_PIT)pending.add(r*cols+c)
    while(pending.size){
      const first=pending.values().next().value as number,cells=[first];pending.delete(first)
      for(let i=0;i<cells.length;i++){
        const k=cells[i]!,c=k%cols,r=Math.floor(k/cols)
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const){
          if(c+dx<0||r+dy<0||c+dx>=cols||r+dy>=map.rows)continue
          const next=(r+dy)*cols+c+dx;if(pending.delete(next))cells.push(next)
        }
      }
      const occupied=new Set(cells),edges=new Map<string,Point>(),key=(p:Point)=>`${p.x}:${p.y}`
      const add=(a:Point,b:Point)=>edges.set(key(a),b)
      for(const k of cells){
        const c=k%cols,r=Math.floor(k/cols),x=c*t,y=r*t
        if(!occupied.has(k-cols))add({x,y},{x:x+t,y})
        if(c===cols-1||!occupied.has(k+1))add({x:x+t,y},{x:x+t,y:y+t})
        if(!occupied.has(k+cols))add({x:x+t,y:y+t},{x,y:y+t})
        if(c===0||!occupied.has(k-1))add({x,y:y+t},{x,y})
      }
      const start=edges.keys().next().value as string,[sx,sy]=start.split(':').map(Number),outline:Point[]=[]
      let p:Point={x:sx!,y:sy!}
      while(edges.has(key(p))){const next=edges.get(key(p))!;edges.delete(key(p));outline.push(p);p=next;if(key(p)===start)break}
      if(outline.length<3)continue
      const left=Math.min(...outline.map(p=>p.x)),right=Math.max(...outline.map(p=>p.x)),top=Math.min(...outline.map(p=>p.y)),bottom=Math.max(...outline.map(p=>p.y))
      const x=(left+right)/2,y=(top+bottom)/2,edge:Point[]=[]
      for(let i=0;i<outline.length;i++){
        const a=outline[i]!,b=outline[(i+1)%outline.length]!,dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)
        for(let k=0;k<3;k++){
          const u=(k+.12)/3,jitter=(hash2(seed+first,i*7+k)-.5)*9
          edge.push({x:a.x+dx*u+dy/length*jitter-x,y:a.y+dy*u-dx/length*jitter-y})
        }
      }
      this.pits.push({x,y,edge,seed:seed+first,radius:Math.hypot(right-left,bottom-top)+30})
    }
  }
  paint(g:CanvasRenderingContext2D,view:Viewport):void {
    for(const pit of this.pits){
      if(!visible(view,pit.x,pit.y,pit.radius))continue
      const {edge,seed}=pit,outer=edge.map((p,i)=>({x:p.x*1.16+(hash2(seed,i)-.5)*5,y:p.y*1.18+(hash2(i,seed)-.5)*4}))
      const inner=edge.map(p=>({x:p.x*.76,y:p.y*.66+8})),depth=Math.max(...edge.map(p=>Math.abs(p.y)))
      g.save();g.translate(pit.x,pit.y)
      g.fillStyle='#27190f';g.fill(path(outer))
      const voidShade=g.createLinearGradient(0,-depth,0,depth)
      voidShade.addColorStop(0,'#070605');voidShade.addColorStop(.55,'#0e0906');voidShade.addColorStop(1,'#21140c')
      g.fillStyle=voidShade;g.fill(path(edge))
      // 坑缘断面的高低与厚度随机变化，上沿露土，下沿积灰，不画一圈等宽亮线。
      for(let i=0;i<edge.length;i++){
        const j=(i+1)%edge.length,a=edge[i]!,b=edge[j]!,front=(a.y+b.y)/2>0
        g.fillStyle=front?'#29190f':i%3?'#52351f':'#69462b';g.fill(path([outer[i]!,outer[j]!,b,a]))
        if(!front){g.fillStyle=i%2?'#362315':'#412b1b';g.fill(path([a,b,inner[j]!,inner[i]!]))}
        if(hash2(seed,i+43)<.32){
          const p=outer[i]!,w=3+hash2(seed,i+71)*6
          g.fillStyle=i%2?'#725137':'#47372a';g.fill(path([{x:p.x-w,y:p.y},{x:p.x+2,y:p.y-3},{x:p.x+w,y:p.y+1},{x:p.x+1,y:p.y+4}]))
        }
      }
      const rim=path(outer);rim.addPath(path(edge));g.save();g.clip(rim,'evenodd')
      paintHellStoneGrain(g,-pit.radius,-pit.radius,pit.radius*2,pit.radius*2,seed,.8);g.restore()
      g.restore()
    }
  }
}
