import { TILE_ORE,type TileMap } from '../tilemap'
import { propBands,type Prop } from '../art/props'

interface Point {x:number;y:number}
interface Grid {step:number;cols:number;rows:number;blocked:Uint8Array;regions:Int32Array}
interface HeapEntry {node:number;priority:number}
const DIRECTIONS=Object.freeze([[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]] as const)

/** 房间共享的半瓦片导航；障碍变化才重建，路径按起终网格复用，不依赖计时或随机数。 */
export class RoomNavigation {
  private map:TileMap|null=null
  private props:readonly Prop[]=[]
  private revision=-1
  private grids=new Map<string,Grid>()
  private paths=new Map<string,readonly number[]>()

  configure(map:TileMap,props:readonly Prop[]):void {
    if(this.map!==map||this.revision!==map.navigationRevision){this.invalidate();this.map=map;this.revision=map.navigationRevision}
    this.props=props
  }
  invalidate():void {this.grids.clear();this.paths.clear()}

  private grid(radius:number,flying:boolean):Grid {
    const key=`${radius}:${flying}`,cached=this.grids.get(key)
    if(cached)return cached
    const map=this.map!,step=map.tile/2,cols=Math.floor(map.cols*map.tile/step)+1,rows=Math.floor(map.rows*map.tile/step)+1
    const blocked=new Uint8Array(cols*rows),regions=new Int32Array(cols*rows),r=radius+.75
    const stamp=(left:number,top:number,right:number,bottom:number,rounded=false)=>{
      const c0=Math.max(0,Math.ceil((left-r)/step)),c1=Math.min(cols-1,Math.floor((right+r)/step))
      const r0=Math.max(0,Math.ceil((top-r)/step)),r1=Math.min(rows-1,Math.floor((bottom+r)/step))
      for(let row=r0;row<=r1;row++)for(let col=c0;col<=c1;col++){
        const x=col*step,y=row*step
        if(x<=left-r||x>=right+r||y<=top-r||y>=bottom+r)continue
        if(rounded){const dx=x-Math.max(left,Math.min(right,x)),dy=y-Math.max(top,Math.min(bottom,y));if(dx*dx+dy*dy>=r*r)continue}
        blocked[row*cols+col]=1
      }
    }
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const x=col*step,y=row*step,b=map.bounds
      if(x<b.left+r||x>b.right-r||y<b.top+r||y>b.bottom-r)blocked[row*cols+col]=1
    }
    for(let row=0;row<map.rows;row++)for(let col=0;col<map.cols;col++){
      if(map.tileAt(col,row)===TILE_ORE||!map.isSolid(col,row))continue
      stamp(col*map.tile,row*map.tile,(col+1)*map.tile,(row+1)*map.tile)
    }
    if(!flying){
      map.forEachOre(ore=>stamp(ore.col*map.tile+ore.offsetX,ore.row*map.tile+ore.offsetY,(ore.col+1)*map.tile+ore.offsetX,(ore.row+1)*map.tile+ore.offsetY))
      for(const prop of this.props)for(const band of propBands(prop))stamp(band.x0,band.y0,band.x1,band.y1,true)
    }
    // 一次标记所有连通区域，刷怪与路径查询共用，不为每个候选点重复搜索。
    const queue=new Int32Array(blocked.length)
    let region=0
    for(let seed=0;seed<blocked.length;seed++){
      if(blocked[seed]||regions[seed])continue
      region++;let head=0,tail=1;queue[0]=seed;regions[seed]=region
      while(head<tail){
        const node=queue[head++]!,x=node%cols,y=Math.floor(node/cols)
        for(let i=0;i<4;i++){
          const [dx,dy]=DIRECTIONS[i]!,nx=x+dx,ny=y+dy
          if(nx<0||ny<0||nx>=cols||ny>=rows)continue
          const next=ny*cols+nx
          if(!blocked[next]&&!regions[next]){regions[next]=region;queue[tail++]=next}
        }
      }
    }
    const grid={step,cols,rows,blocked,regions}
    // 同房通常只有两种体型；上限避免模组任意半径留下无限导航缓存。
    if(this.grids.size>=6){this.grids.clear();this.paths.clear()}
    this.grids.set(key,grid);return grid
  }

  private nearest(grid:Grid,x:number,y:number,region=0):number {
    const col=Math.round(x/grid.step),row=Math.round(y/grid.step)
    let best=-1,distance=Infinity
    for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){
      const c=col+dx,r=row+dy
      if(c<0||r<0||c>=grid.cols||r>=grid.rows)continue
      const node=r*grid.cols+c
      if(grid.blocked[node]||region&&grid.regions[node]!==region)continue
      const d=(c*grid.step-x)**2+(r*grid.step-y)**2
      if(d<distance){distance=d;best=node}
    }
    return best
  }

  canReach(x:number,y:number,tx:number,ty:number,radius:number,flying=false):boolean {
    const grid=this.grid(radius,flying),start=this.nearest(grid,x,y),goal=this.nearest(grid,tx,ty)
    return start>=0&&goal>=0&&grid.regions[start]===grid.regions[goal]
  }

  private segmentClear(grid:Grid,ax:number,ay:number,bx:number,by:number):boolean {
    const steps=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/(grid.step*.4)))
    let previous=-1
    for(let i=0;i<=steps;i++){
      const x=Math.round((ax+(bx-ax)*i/steps)/grid.step),y=Math.round((ay+(by-ay)*i/steps)/grid.step)
      if(x<0||y<0||x>=grid.cols||y>=grid.rows)return false
      const node=y*grid.cols+x
      if(grid.blocked[node])return false
      if(previous>=0){
        const px=previous%grid.cols,py=Math.floor(previous/grid.cols)
        if(px!==x&&py!==y&&(grid.blocked[py*grid.cols+x]||grid.blocked[y*grid.cols+px]))return false
      }
      previous=node
    }
    return true
  }

  waypoint(x:number,y:number,tx:number,ty:number,radius:number,flying=false):Point|null {
    const grid=this.grid(radius,flying)
    if(this.segmentClear(grid,x,y,tx,ty))return {x:tx,y:ty}
    const start=this.nearest(grid,x,y)
    if(start<0)return null
    const col=Math.round(x/grid.step),row=Math.round(y/grid.step)
    if(col<0||row<0||col>=grid.cols||row>=grid.rows||grid.blocked[row*grid.cols+col]){
      return {x:start%grid.cols*grid.step,y:Math.floor(start/grid.cols)*grid.step}
    }
    const goal=this.nearest(grid,tx,ty,grid.regions[start])
    if(goal<0)return null
    const key=`${radius}:${flying}:${start}:${goal}`
    let route=this.paths.get(key)
    if(!route){
      route=this.search(grid,start,goal)
      if(this.paths.size>=128)this.paths.delete(this.paths.keys().next().value!)
      this.paths.set(key,route)
    }
    if(!route.length)return null
    let next=route[0]!
    for(let i=0;i<Math.min(8,route.length);i++){
      const node=route[i]!,px=node%grid.cols*grid.step,py=Math.floor(node/grid.cols)*grid.step
      if(!this.segmentClear(grid,x,y,px,py))break
      next=node
    }
    return {x:next%grid.cols*grid.step,y:Math.floor(next/grid.cols)*grid.step}
  }

  private search(grid:Grid,start:number,goal:number):readonly number[] {
    if(start===goal)return [goal]
    const scores=new Float64Array(grid.blocked.length);scores.fill(Infinity);scores[start]=0
    const previous=new Int32Array(grid.blocked.length);previous.fill(-1)
    const visited=new Uint8Array(grid.blocked.length),heap:HeapEntry[]=[]
    const gx=goal%grid.cols,gy=Math.floor(goal/grid.cols)
    const heuristic=(node:number)=>{const dx=Math.abs(node%grid.cols-gx),dy=Math.abs(Math.floor(node/grid.cols)-gy);return Math.max(dx,dy)+.41421356237*Math.min(dx,dy)}
    const push=(entry:HeapEntry)=>{
      let i=heap.length;heap.push(entry)
      while(i>0){const p=(i-1)>>1;if(heap[p]!.priority<=entry.priority)break;heap[i]=heap[p]!;i=p}
      heap[i]=entry
    }
    const pop=():HeapEntry=>{
      const first=heap[0]!,last=heap.pop()!
      if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1]!.priority<heap[child]!.priority)child++;if(heap[child]!.priority>=last.priority)break;heap[i]=heap[child]!;i=child}heap[i]=last}
      return first
    }
    push({node:start,priority:heuristic(start)})
    while(heap.length){
      const node=pop().node
      if(visited[node])continue
      if(node===goal){
        const route:number[]=[];let cursor=goal
        while(cursor!==start){route.push(cursor);cursor=previous[cursor]!}
        route.reverse();return route
      }
      visited[node]=1
      const x=node%grid.cols,y=Math.floor(node/grid.cols)
      for(const [dx,dy] of DIRECTIONS){
        const nx=x+dx,ny=y+dy
        if(nx<0||ny<0||nx>=grid.cols||ny>=grid.rows)continue
        const next=ny*grid.cols+nx
        if(grid.blocked[next]||visited[next]||dx&&dy&&(grid.blocked[y*grid.cols+nx]||grid.blocked[ny*grid.cols+x]))continue
        const score=scores[node]!+(dx&&dy?Math.SQRT2:1)
        if(score>=scores[next]!)continue
        scores[next]=score;previous[next]=node;push({node:next,priority:score+heuristic(next)})
      }
    }
    return []
  }
}
