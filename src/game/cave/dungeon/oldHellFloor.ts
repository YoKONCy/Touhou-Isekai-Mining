import { randomGeneration } from '../../../core/simulation/random'
import { BIOME_OLD_HELL_ID } from '../../../content/biomes/vanilla/ids'
import { biomeOldHell } from '../../../content/biomes/vanilla/oldHell'
import { OLD_HELL_CONTAINERS } from '../../../content/props/vanilla/oldHellContainerLayout'
import { searchDensity } from '../../../content/search/rules'
import { CONFIG } from '../../config'
import { TILE_FLOOR,TILE_WALL,TILE_LAVA,TILE_PIT,TILE_DOOR_CLOSED } from '../../tilemap'
import { hash2 } from '../../art/artPalette'
import { generateFloorPlan } from './bsp'
import type { RoomDef,RoomTerrain,FloorPlan } from './types'

/** 大尺度轮廓先成形，再附着门口；通路与装饰选址均复用这份地形。 */
function makeTerrain(room:RoomDef,seed:number):RoomTerrain {
  const cols=90,rows=36,tiles:number[]=Array(cols*rows).fill(TILE_WALL),reserved=new Set<number>()
  let counter=0
  const rand=()=>hash2(seed,++counter),integer=(lo:number,hi:number)=>lo+Math.floor(rand()*(hi-lo+1))
  const key=(c:number,r:number)=>r*cols+c,inside=(c:number,r:number)=>c>=2&&r>=2&&c<cols-2&&r<rows-2
  const set=(c:number,r:number,t:number)=>{if(inside(c,r))tiles[key(c,r)]=t}
  const curve=(size:number,low:number,high:number,span:number)=>{
    const knots=Array.from({length:Math.ceil(size/span)+2},()=>low+rand()*(high-low))
    return Array.from({length:size},(_,i)=>{
      const k=Math.floor(i/span),u=i/span-k,s=u*u*(3-2*u)
      return Math.round(knots[k]!*(1-s)+knots[k+1]!*s)
    })
  }
  const north=curve(cols,2,8,9),south=curve(cols,2,8,11),west=curve(rows,2,9,7),east=curve(rows,2,9,8)
  for(let r=2;r<rows-2;r++)for(let c=2;c<cols-2;c++){
    if(r>=north[c]!&&r<rows-south[c]!&&c>=west[r]!&&c<cols-east[r]!)tiles[key(c,r)]=TILE_FLOOR
  }
  // 湖面从外岸侵入，多个椭圆叠成不规则连片，大小及侵入深度每房独立。
  const lakes=rand()<.18?0:integer(1,5)
  for(let i=0;i<lakes;i++){
    const edge=integer(0,3),cx=edge===2?3:edge===3?cols-4:integer(13,cols-14)
    const cy=edge===0?3:edge===1?rows-4:integer(9,rows-10),rx=integer(5,14),ry=integer(3,7)
    for(let r=Math.max(2,cy-ry-1);r<=Math.min(rows-3,cy+ry+1);r++)for(let c=Math.max(2,cx-rx-1);c<=Math.min(cols-3,cx+rx+1);c++){
      const edgeNoise=.86+hash2(seed+c*7,r*3+i)*.25
      if(((c-cx)/rx)**2+((r-cy)/ry)**2<edgeNoise)tiles[key(c,r)]=TILE_LAVA
    }
  }
  const centerC=Math.floor(cols/2),centerR=Math.floor(rows/2)
  const clear=(c:number,r:number,radius=1)=>{
    for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
      if(inside(c+dx,r+dy)){set(c+dx,r+dy,TILE_FLOOR);reserved.add(key(c+dx,r+dy))}
    }
  }
  clear(centerC,centerR,3)
  // 保留横向主路；支路连接实际岩岸门口，不依赖矩形包围盒。
  for(let c=10;c<cols-10;c++)clear(c,centerR)
  const doors:RoomTerrain['doors']=[]
  for(const dir of ['N','S','W','E'] as const){
    const refs=room.doors.filter(ref=>ref.dir===dir)
    refs.forEach((ref,i)=>{
      const vertical=dir==='N'||dir==='S',length=vertical?cols:rows
      const low=vertical?12:6,high=length-low-1
      const target=Math.round(low+(high-low)*(i+1)/(refs.length+1))
      const spacing=Math.max(3,Math.min(5,Math.floor((high-low)/(refs.length+1))))
      const dx=dir==='W'?1:dir==='E'?-1:0,dy=dir==='N'?1:dir==='S'?-1:0
      let col=vertical?target:dir==='W'?2:cols-3,row=vertical?(dir==='N'?2:rows-3):target,best=Infinity
      // 在预期方位附近评估多个真实岸段，同墙门保持距离，避开尖角和深湖。
      for(let axis=low;axis<=high;axis++){
        if(doors.some(d=>room.doors.find(ref=>ref.doorId===d.doorId)?.dir===dir&&Math.abs((vertical?d.col:d.row)-axis)<spacing))continue
        const startC=vertical?axis:dir==='W'?2:cols-3,startR=vertical?(dir==='N'?2:rows-3):axis
        for(let step=1;step<length;step++){
          const c=startC+dx*step,r=startR+dy*step
          if(!inside(c+dx*3,r+dy*3))break
          if(tiles[key(c,r)]!==TILE_FLOOR||tiles[key(c+dx*3,r+dy*3)]!==TILE_FLOOR)continue
          const score=Math.abs(axis-target)*4+step*.25
          if(score<best){best=score;col=c-dx;row=r-dy}
          break
        }
      }
      const arrivalCol=col+dx*2,arrivalRow=row+dy*2
      doors.push({doorId:ref.doorId,col,row,arrivalCol,arrivalRow})
    })
  }
  // 先把全部通道打通，再安置门框，后生成的通道不能擦掉先前的门格。
  for(const door of doors){
      const {col,row,arrivalCol,arrivalRow}=door,dir=room.doors.find(ref=>ref.doorId===door.doorId)!.dir
      const dx=dir==='W'?1:dir==='E'?-1:0,dy=dir==='N'?1:dir==='S'?-1:0
      clear(arrivalCol,arrivalRow,2)
      let c=arrivalCol,r=arrivalRow
      while(c!==centerC){clear(c,r);c+=Math.sign(centerC-c)}
      while(r!==centerR){clear(c,r);r+=Math.sign(centerR-r)}
      clear(c,r)
  }
  for(const door of doors){
      const {col,row}=door,dir=room.doors.find(ref=>ref.doorId===door.doorId)!.dir,vertical=dir==='N'||dir==='S'
      const dx=dir==='W'?1:dir==='E'?-1:0,dy=dir==='N'?1:dir==='S'?-1:0
      // 门道两侧立岩，门格后侧封闭，角色只能从预留的内侧通道抵达。
      for(let side=-1;side<=1;side++){
        const sc=col+(vertical?side:0),sr=row+(vertical?0:side)
        set(sc-dx,sr-dy,TILE_WALL);reserved.add(key(sc-dx,sr-dy))
        if(side!==0)set(sc,sr,TILE_WALL)
      }
      set(col+dx,row+dy,TILE_FLOOR);set(col,row,TILE_DOOR_CLOSED)
      reserved.add(key(col,row));reserved.add(key(col+dx,row+dy))
  }
  // 清除被岩浆切离的孤立陆地，保证可探索区域属于入口所在的连通分量。
  const steps=[[1,0],[-1,0],[0,1],[0,-1]] as const
  const connected=()=>{
    const reached=new Set<number>([key(centerC,centerR)]),queue=[key(centerC,centerR)]
    for(let i=0;i<queue.length;i++){
      const k=queue[i]!,c=k%cols,r=Math.floor(k/cols)
      for(const [dc,dr] of steps){
        if(!inside(c+dc,r+dr))continue
        const next=key(c+dc,r+dr)
        if(tiles[next]===TILE_FLOOR&&!reached.has(next)){reached.add(next);queue.push(next)}
      }
    }
    return reached
  }
  let reached=connected()
  // 极端同墙多门会让门框切到另一条预留路；在生成阶段修复，而不是把玩家推出到别处。
  const gateWalls=new Set<number>()
  for(const door of doors){
    const dir=room.doors.find(ref=>ref.doorId===door.doorId)!.dir,vertical=dir==='N'||dir==='S'
    const dx=dir==='W'?1:dir==='E'?-1:0,dy=dir==='N'?1:dir==='S'?-1:0
    for(let side=-1;side<=1;side++){
      const c=door.col+(vertical?side:0),r=door.row+(vertical?0:side)
      gateWalls.add(key(c,r));gateWalls.add(key(c-dx,r-dy))
    }
  }
  for(const door of doors){
    const start=key(door.arrivalCol,door.arrivalRow)
    if(reached.has(start))continue
    const previous=new Map<number,number>([[start,-1]]),queue=[start]
    let end=-1
    for(let i=0;i<queue.length&&end<0;i++){
      const k=queue[i]!,c=k%cols,r=Math.floor(k/cols)
      if(reached.has(k)){end=k;break}
      for(const [dc,dr] of steps){
        if(!inside(c+dc,r+dr))continue
        const next=key(c+dc,r+dr)
        if(!gateWalls.has(next)&&!previous.has(next)){previous.set(next,k);queue.push(next)}
      }
    }
    while(end>=0){
      const c=end%cols,r=Math.floor(end/cols)
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const next=key(c+dx,r+dy)
        if(inside(c+dx,r+dy)&&!gateWalls.has(next)){tiles[next]=TILE_FLOOR;reserved.add(next)}
      }
      end=previous.get(end)??-1
    }
    reached=connected()
  }
  for(let k=0;k<tiles.length;k++)if(tiles[k]===TILE_FLOOR&&!reached.has(k))tiles[k]=TILE_WALL
  const buildings:RoomTerrain['buildings']=[]
  const desired=integer(2,4)
  for(let i=0;i<desired;i++){
    const variant=(i%2) as 0|1,width=variant?10:6,height=variant?6:4
    for(let attempt=0;attempt<220;attempt++){
      const col=integer(10,cols-width-10),row=integer(7,rows-height-6)
      let free=true
      for(let r=row-1;r<=row+height;r++)for(let c=col-1;c<=col+width;c++){
        if(tiles[key(c,r)]!==TILE_FLOOR||reserved.has(key(c,r)))free=false
      }
      if(!free||buildings.some(b=>col<b.col+b.width+3&&col+width+3>b.col&&row<b.row+b.height+3&&row+height+3>b.row))continue
      const entrance=Math.floor(width/2)
      for(let r=0;r<height;r++)for(let c=0;c<width;c++){
        if(r===0||c===0||c===width-1||r===height-1&&Math.abs(c-entrance)>1)set(col+c,row+r,TILE_WALL)
      }
      const containers:RoomTerrain['buildings'][number]['containers']=[]
      const config=OLD_HELL_CONTAINERS,pool:string[]=[...(variant?config.dwelling:config.workshop)]
      const slots=variant?[[2,1],[width-3,1],[2,height-2]] as const:[[1,1],[width-2,1]] as const
      const bounds=variant?config.largeCount:config.smallCount
      const density=searchDensity({floor:5,biomeId:BIOME_OLD_HELL_ID,regionId:room.searchRegion,roomKind:room.kind},variant?'large':'small')
      const target=rand()<config.emptyChance?0:integer(bounds[0],bounds[1])*density
      const count=Math.min(slots.length,Math.floor(target)+(rand()<target-Math.floor(target)?1:0))
      const selected:string[]=[]
      for(let j=0;j<count;j++)selected.push(pool.splice(integer(0,pool.length-1),1)[0]!)
      // 每栋只判定一次，铁柜替换普通点，不额外增加建筑内的物品点数量。
      const sealed=rand()<config.sealedChance
      if(sealed&&density>0){if(selected.length)selected[integer(0,selected.length-1)]=config.sealed;else selected.push(config.sealed)}
      selected.forEach((id,j)=>{const [dc,dr]=slots[j]!;containers.push({id,col:col+dc,row:row+dr,large:config.large.has(id)})})
      buildings.push({col,row,width,height,variant,seed:integer(0,0x3fffffff),containers})
      break
    }
  }
  // 岩柱有真实的连片占地；高差由外观数据表达，不能靠拉长单块石头模拟承重结构。
  const rockFormations:NonNullable<RoomTerrain['rockFormations']>=[]
  const kinds=['pillar','pillar','broken','broken','terrace','terrace','terrace'] as const
  for(const kind of kinds){
    for(let attempt=0;attempt<150;attempt++){
      const c=integer(9,cols-10),r=integer(6,rows-7)
      const rx=kind==='pillar'?2.1+rand()*.65:kind==='broken'?1.25+rand()*.6:1.5+rand()*1.4
      const ry=kind==='pillar'?1.35+rand()*.35:kind==='broken' ? .9+rand()*.5 : .85+rand()*.65
      const cells:number[]=[],radiusX=Math.ceil(rx),radiusY=Math.ceil(ry)
      let free=true
      for(let dy=-radiusY-1;dy<=radiusY+1;dy++)for(let dx=-radiusX-1;dx<=radiusX+1;dx++){
        const k=key(c+dx,r+dy)
        if(!inside(c+dx,r+dy)||tiles[k]!==TILE_FLOOR||reserved.has(k))free=false
        if((dx/rx)**2+(dy/ry)**2<.94+hash2(seed+k,attempt)*.12)cells.push(k)
      }
      if(!free||cells.length<3)continue
      for(const k of cells)tiles[k]=TILE_WALL
      // 随机柱体不许封死区域；不连通时撤销本次摆放，保留原来的门与搜索路线。
      const reachable=connected()
      if(tiles.some((tile,k)=>tile===TILE_FLOOR&&!reachable.has(k))){for(const k of cells)tiles[k]=TILE_FLOOR;continue}
      const height=kind==='pillar'?integer(360,490):kind==='broken'?integer(125,220):integer(38,82)
      rockFormations.push({kind,cells,height,seed:integer(0,0x3fffffff)})
      break
    }
  }
  // 少量深坑具有真实碰撞；仅在完整净空区域出现，不破坏门路与建筑入口。
  const pits=integer(2,4)
  for(let i=0;i<pits;i++){
    const c=integer(12,cols-13),r=integer(8,rows-9)
    let free=true
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(tiles[key(c+dx,r+dy)]!==TILE_FLOOR||reserved.has(key(c+dx,r+dy)))free=false
    if(free){set(c,r,TILE_PIT);if(rand()<.5)set(c+1,r,TILE_PIT)}
  }
  return {cols,rows,seed,tiles,doors,reserved:[...reserved],buildings,rockFormations}
}

export function buildOldHellFloorPlan():FloorPlan {
  const reduction=1+Math.floor(randomGeneration()*2)
  const plan=generateFloorPlan({roomsMin:CONFIG.dungeon.roomsMin-reduction,roomsMax:CONFIG.dungeon.roomsMax-reduction,rewardRooms:false})
  const survival = biomeOldHell.survivalEncounter, candidates = plan.rooms.filter(room => room.kind === 'normal')
  if (survival && candidates.length && randomGeneration() < survival.roomChance) {
    candidates[Math.floor(randomGeneration() * candidates.length)]!.encounter = 'survival'
  }
  for(const room of plan.rooms){
    room.floor=5;room.biomeId=BIOME_OLD_HELL_ID;room.searchRegion='old_hell_ruins'
    room.terrain=makeTerrain(room,Math.floor(randomGeneration()*0xffffffff))
    if (room.encounter === 'survival' && survival?.guaranteedContainer) {
      ensureTrapContainer(room.terrain, survival.guaranteedContainer)
    }
  }
  const elite=biomeOldHell.eliteEncounter
  if(elite){
    let remaining=elite.maxPerFloor
    for(const room of plan.rooms)if(room.kind===elite.guaranteedRoom&&remaining>0){room.extraEnemies=[elite.enemyId];remaining--}
    const candidates=plan.rooms.filter(room=>room.kind!==elite.guaranteedRoom)
    // 随机排列后逐间判定，避免固定由先生成的房间抢走全层剩余名额。
    for(let i=candidates.length-1;i>0;i--){const j=Math.floor(randomGeneration()*(i+1));[candidates[i],candidates[j]]=[candidates[j]!,candidates[i]!]}
    for(const room of candidates)if(remaining>0&&randomGeneration()<elite.roomChance){room.extraEnemies=[elite.enemyId];remaining--}
  }
  return plan
}

/** 保底奖励在楼层生成时固定；优先替换屋内普通点，无建筑时落在受保护的中央净空。 */
function ensureTrapContainer(terrain: RoomTerrain, id: string): void {
  if (terrain.buildings.some(building => building.containers.some(box => box.id === id))) return
  const building = terrain.buildings[0]
  if (building) {
    const existing = building.containers[0]
    if (existing) { existing.id = id; existing.large = true }
    else building.containers.push({ id, col: building.col + Math.floor(building.width / 2), row: building.row + 1, large: true })
    return
  }
  // 中央七格净空在地形生成时已保留，岩柱、深坑与建筑均不会占用。
  terrain.containers = [{ id, col: Math.floor(terrain.cols / 2) + 2, row: Math.floor(terrain.rows / 2) - 2, large: true }]
}
