import { randomGeneration } from '../../../core/simulation/random'
import type { FloorPlan } from './types'

/** 炉骸和怪物房只在生成整趟三层时分配，重访房间不重新摇号。 */
export function configureThirdFloor(plan:FloorPlan):void{
  const rooms=plan.rooms.filter(r=>r.kind!=='start')
  for(const room of rooms){
    if(randomGeneration()>=0.4)continue
    room.furnaceWrecks=Array.from({length:randomGeneration()<0.6?1:2},()=>({variant:Math.floor(randomGeneration()*3) as 0|1|2,parts:false}))
  }
  if(rooms.length&&!rooms.some(r=>r.furnaceWrecks?.length))rooms[Math.floor(randomGeneration()*rooms.length)]!.furnaceWrecks=[{variant:Math.floor(randomGeneration()*3) as 0|1|2,parts:false}]
  const wrecks=rooms.flatMap(r=>r.furnaceWrecks??[])
  if(wrecks.length)wrecks[Math.floor(randomGeneration()*wrecks.length)]!.parts=true
  const candidates=rooms.filter(r=>r.kind==='normal')
  if(candidates.length&&randomGeneration()<0.3)candidates[Math.floor(randomGeneration()*candidates.length)]!.encounter='survival'
}
