import { TILE_FLOOR,TILE_DOOR_OPEN,TILE_ORE,TileMap } from './tilemap'
import { blockerCandidates,segmentCircleEntry } from './CombatSpatial'

/** 弹幕掩体段，与摆件碰撞段兼容。 */
export interface BulletBlocker { x0: number; x1: number; y0: number; y1: number }

/** 圆扫掠矩形的边与四角，避免扩张矩形把圆角之外也判作命中。 */
function circleBoxEntry(x0:number,y0:number,x1:number,y1:number,r:number,left:number,top:number,right:number,bottom:number):number|null {
  const ox=x0-Math.max(left,Math.min(right,x0)),oy=y0-Math.max(top,Math.min(bottom,y0))
  if(ox*ox+oy*oy<=r*r)return 0
  const dx=x1-x0,dy=y1-y0;let best=Infinity
  if(dx!==0)for(let side=0;side<2;side++){const edge=side?right+r:left-r,t=(edge-x0)/dx,y=y0+t*dy;if(t>=0&&t<=1&&y>=top&&y<=bottom&&t<best)best=t}
  if(dy!==0)for(let side=0;side<2;side++){const edge=side?bottom+r:top-r,t=(edge-y0)/dy,x=x0+t*dx;if(t>=0&&t<=1&&x>=left&&x<=right&&t<best)best=t}
  if(r>0)for(let ix=0;ix<2;ix++)for(let iy=0;iy<2;iy++){const t=segmentCircleEntry(x0,y0,x1,y1,ix?right:left,iy?bottom:top,r);if(t!==null&&t<best)best=t}
  return best===Infinity?null:best
}
/** 整段连续检测，同时比较墙体与掩体的最早接触，不按像素反复扫描全房。 */
export function sweepProjectileObstacles(map:TileMap,blockers:readonly BulletBlocker[],x0:number,y0:number,x1:number,y1:number,r:number,ignoreOre=false):{x:number;y:number;prop:boolean;fraction:number}|null {
  if(!Number.isFinite(x0)||!Number.isFinite(y0)||!Number.isFinite(x1)||!Number.isFinite(y1)||!Number.isFinite(r)||r<0)return null
  const tiled=map.solidAtWorld===TileMap.prototype.solidAtWorld&&map.isSolid===TileMap.prototype.isSolid
  if(tiled&&(x0<0||y0<0||x0>=map.cols*map.tile||y0>=map.rows*map.tile))return {x:x0,y:y0,prop:false,fraction:0}
  const left=Math.min(x0,x1)-r,right=Math.max(x0,x1)+r,top=Math.min(y0,y1)-r,bottom=Math.max(y0,y1)+r
  let fraction=Infinity,prop=false
  const cell=map.tile,minX=Math.max(-1,Math.floor(left/cell)),maxX=Math.min(map.cols,Math.floor(right/cell)),minY=Math.max(-1,Math.floor(top/cell)),maxY=Math.min(map.rows,Math.floor(bottom/cell))
  if(tiled)for(let row=minY;row<=maxY;row++)for(let col=minX;col<=maxX;col++){
    if(!map.blocksProjectiles(col,row,ignoreOre))continue
    const t=circleBoxEntry(x0,y0,x1,y1,r,col*cell,row*cell,(col+1)*cell,(row+1)*cell)
    if(t!==null&&t<fraction){fraction=t;prop=false}
  }
  else {
    // 自定义地图可以覆盖实体地形查询，保留该契约，不把它强行当作规则瓦片。
    const steps=Math.max(1,Math.ceil(Math.hypot(x1-x0,y1-y0)/4))
    for(let i=1;i<=steps;i++){
      const t=i/steps,x=x0+(x1-x0)*t,y=y0+(y1-y0)*t
      if(map.solidAtWorld(x,y,ignoreOre)||map.solidAtWorld(x-r,y,ignoreOre)||map.solidAtWorld(x+r,y,ignoreOre)||map.solidAtWorld(x,y-r,ignoreOre)||map.solidAtWorld(x,y+r,ignoreOre)){fraction=t;break}
    }
  }
  for(const b of blockerCandidates(blockers,left,top,right,bottom)){
    const t=circleBoxEntry(x0,y0,x1,y1,r,b.x0,b.y0,b.x1,b.y1)
    if(t!==null&&t<fraction){fraction=t;prop=true}
  }
  return fraction===Infinity?null:{x:x0+(x1-x0)*fraction,y:y0+(y1-y0)*fraction,prop,fraction}
}
