import type { FloorPlan, RoomDef } from '../../../../game/cave/dungeon/types'
import type { ScriptedRoomSpec } from '../../../../game/cave/dungeon/script'

export const RELAY_ROOM_COUNT = 4
/** 途中场景只有相邻连接；房间数量、刷怪和撤离不沿用普通三层生成。 */
export function buildMineRelayPlan(): FloorPlan {
  const rooms: RoomDef[] = Array.from({ length: RELAY_ROOM_COUNT }, (_, id) => ({
    id, sx: id, sy: 0, kind: 'normal', floor: 3, depth: id, exitDist: RELAY_ROOM_COUNT - 1 - id, doors: []
  }))
  const doors: FloorPlan['doors'] = []
  for (let id = 0; id < RELAY_ROOM_COUNT - 1; id++) {
    doors.push({ id, a: id, b: id + 1, dirA: 'E', dirB: 'W' })
    rooms[id]!.doors.push({ doorId: id, dir: 'E' }); rooms[id + 1]!.doors.push({ doorId: id, dir: 'W' })
  }
  return { rooms, doors, slotCols: RELAY_ROOM_COUNT, slotRows: 1, slots: Int16Array.from(rooms.map(r => r.id + 1)), startId: 0, exitId: RELAY_ROOM_COUNT - 1 }
}
export const mineRelayRoomSpec: ScriptedRoomSpec = {
  enemyRange: [2, 3], oreRange: [26, 32], noMonsterBurst: true, noChest: true, noProps: true,
  ambient: { dimCenter: .62, dimEdge: .82, litCenter: .29, litEdge: .56 }
}
