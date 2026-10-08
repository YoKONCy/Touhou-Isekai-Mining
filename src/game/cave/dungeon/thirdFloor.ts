import type { FloorPlan } from './types'

/** 炉骸和怪物房只在生成整趟三层时分配，重访房间不重新摇号。 */
export function configureThirdFloor(plan:FloorPlan):void{
  const rooms=plan.rooms.filter(r=>r.kind!=='start')
  for(const room of rooms){
    if(Math.random()>=0.4)continue
    room.furnaceWrecks=Array.from({length:Math.random()<0.6?1:2},()=>({variant:Math.floor(Math.random()*3) as 0|1|2,parts:false}))
  }
  if(rooms.length&&!rooms.some(r=>r.furnaceWrecks?.length))rooms[Math.floor(Math.random()*rooms.length)]!.furnaceWrecks=[{variant:Math.floor(Math.random()*3) as 0|1|2,parts:false}]
  const wrecks=rooms.flatMap(r=>r.furnaceWrecks??[])
  if(wrecks.length)wrecks[Math.floor(Math.random()*wrecks.length)]!.parts=true
  const candidates=rooms.filter(r=>r.kind==='normal')
  if(candidates.length&&Math.random()<0.3)candidates[Math.floor(Math.random()*candidates.length)]!.encounter='survival'
}
