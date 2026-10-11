import { SpatialGrid } from '../core/spatial/SpatialGrid'
import type { Enemy } from './Enemy'
import type { BulletBlocker } from './projectileObstacles'
import { profiler } from '../core/performance/Profiler'
const enemyGrids=new WeakMap<readonly Enemy[],SpatialGrid<Enemy>>()
const blockerGrids=new WeakMap<readonly BulletBlocker[],SpatialGrid<BulletBlocker>>()
const enemyScratch:Enemy[]=[]
const blockerScratch:BulletBlocker[]=[]
/** 玩家攻击前、敌人移动后分别刷新，死亡仍由实体状态实时过滤。 */
export function rebuildEnemyGrid(enemies:readonly Enemy[]):void {
  let grid=enemyGrids.get(enemies);if(!grid){grid=new SpatialGrid();enemyGrids.set(enemies,grid)}
  grid.clear()
  for(const e of enemies)if(e.alive){const r=e.hitRadius,body=e.r+e.def.combat.contactPad;grid.insert(e,Math.min(e.hitX-r,e.x-body),Math.min(e.hitY-r,e.y-body),Math.max(e.hitX+r,e.x+body),Math.max(e.hitY+r,e.y+body))}
}
export function rebuildBlockerGrid(blockers:readonly BulletBlocker[]):void {
  let grid=blockerGrids.get(blockers);if(!grid){grid=new SpatialGrid();blockerGrids.set(blockers,grid)}
  grid.clear();for(const b of blockers)grid.insert(b,b.x0,b.y0,b.x1,b.y1)
}
export function enemyCandidates(enemies:readonly Enemy[],left:number,top:number,right:number,bottom:number):readonly Enemy[] {
  const grid=enemyGrids.get(enemies),result=grid?grid.query(left,top,right,bottom,enemyScratch):enemies
  profiler.increment('enemyCandidates',result.length);return result
}
export function blockerCandidates(blockers:readonly BulletBlocker[],left:number,top:number,right:number,bottom:number):readonly BulletBlocker[] {
  const grid=blockerGrids.get(blockers);return grid?grid.query(left,top,right,bottom,blockerScratch):blockers
}
/** 连续圆扫掠的首次接触比例，起点在圆内返回零。 */
export function segmentCircleEntry(x0:number,y0:number,x1:number,y1:number,cx:number,cy:number,r:number):number|null {
  const dx=x1-x0,dy=y1-y0,fx=x0-cx,fy=y0-cy,c=fx*fx+fy*fy-r*r
  if(c<=0)return 0
  const a=dx*dx+dy*dy;if(a<1e-12)return null
  const b=2*(fx*dx+fy*dy),disc=b*b-4*a*c;if(disc<0)return null
  const t=(-b-Math.sqrt(disc))/(2*a);return t>=0&&t<=1?t:null
}
export function firstEnemyAlong(enemies:readonly Enemy[],x0:number,y0:number,x1:number,y1:number,pad:number,excluded?:ReadonlySet<string>):{enemy:Enemy;fraction:number}|null {
  let enemy:Enemy|null=null,fraction=Infinity
  for(const e of enemyCandidates(enemies,Math.min(x0,x1)-pad,Math.min(y0,y1)-pad,Math.max(x0,x1)+pad,Math.max(y0,y1)+pad)){
    if(!e.canBeHit||excluded?.has(e.entityId))continue
    const t=segmentCircleEntry(x0,y0,x1,y1,e.hitX,e.hitY,e.hitRadius+pad)
    if(t!==null&&t<fraction){enemy=e;fraction=t}
  }
  return enemy?{enemy,fraction}:null
}
