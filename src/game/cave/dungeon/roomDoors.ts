import { CONFIG } from '../../config'
import type { Dir, RoomDef } from './types'

export interface RoomDoorPlacement {
  doorId:number;dir:Dir;col:number;row:number;open:boolean
  arrivalCol?:number;arrivalRow?:number
}
export function roomDimensions(def:RoomDef):{cols:number;rows:number} {
  return {cols:def.terrain?.cols??CONFIG.roomCols,rows:def.terrain?.rows??CONFIG.roomRows}
}
export function slotOnWall(size:number,count:number,index:number):number {
  const mid=Math.floor(size/2)
  if(count===1)return mid
  if(count===2)return mid+(index===0?-4:4)
  if(count===3)return mid+[-6,0,6][index]!
  const low=CONFIG.wallThickness+2,high=size-CONFIG.wallThickness-3
  return Math.round(low+(high-low)*index/(count-1))
}
/** 矩形房保留原布局；异形房直接使用生成时确定的门口和安全落点。 */
export function layoutRoomDoors(def:RoomDef):RoomDoorPlacement[] {
  const {cols:C,rows:R}=roomDimensions(def),W=CONFIG.wallThickness
  const out:RoomDoorPlacement[]=[]
  for(const dir of ['N','S','W','E'] as const){
    const refs=def.doors.filter(ref=>ref.dir===dir)
    refs.forEach((ref,i)=>{
      const anchor=def.terrain?.doors.find(door=>door.doorId===ref.doorId)
      if(anchor){out.push({...anchor,dir,open:false});return}
      out.push({doorId:ref.doorId,dir,open:false,
        col:dir==='W'?W-1:dir==='E'?C-W:slotOnWall(C,refs.length,i),
        row:dir==='N'?W-1:dir==='S'?R-W:slotOnWall(R,refs.length,i)})
    })
  }
  return out
}
export function doorArrival(door:RoomDoorPlacement):{x:number;y:number;facing:number} {
  const dx=door.dir==='W'?1:door.dir==='E'?-1:0,dy=door.dir==='N'?1:door.dir==='S'?-1:0
  return {x:((door.arrivalCol??door.col+dx)+.5)*CONFIG.tile,
    y:((door.arrivalRow??door.row+dy)+.5)*CONFIG.tile,facing:Math.atan2(dy,dx)}
}
