/**
 * 楼层平面数据结构（BSP 生成产物，纯数据，无任何运行时实体）
 *
 * 房间之间是【逻辑连接图】：每个房间是独立瓦片网格，
 * 门只表示"A 房某面墙 ↔ B 房某面墙"的切换关系，与槽位距离无关
 * （元气骑士式房间级切换，而非连续大地图）。
 */

/** 房间四面墙朝向（屏幕坐标：N 上 S 下 W 左 E 右） */
export type Dir = 'N' | 'S' | 'W' | 'E'

export type RoomKind = 'start' | 'normal' | 'reward' | 'exit'

/** 一扇门（连接两个房间） */
export interface DoorDef {
  id: number
  a: number
  b: number
  /** 门在 A / B 各自房间的哪面墙（互为相反方向） */
  dirA: Dir
  dirB: Dir
}

/** 房间上的门引用 */
export interface RoomDoorRef {
  doorId: number
  /** 本房视角的门朝向 */
  dir: Dir
}

export interface RoomDef {
  id: number
  /** 在楼层槽位网格上的坐标（小地图/门朝向用） */
  sx: number
  sy: number
  kind: RoomKind
  /** 限时怪物房独立于基础房型，计时结束即可通行。 */
  encounter?: 'survival'
  /** 炉骸分配在整层生成时固定，每房最多两座。 */
  furnaceWrecks?: Array<{variant:0|1|2;parts:boolean}>
  /** 距入口的 BFS 深度 */
  depth: number
  /** 楼层号（正式下矿第 1 层＝1；序章＝0。缺省按第 1 层处理，矿种楼层门控用） */
  floor?: number
  /** 群系负责地貌色板、采矿预算与刷怪数量，缺省沿用旧矿洞。 */
  biomeId?: import('../../../content/biomes/types').BiomeId
  /** 专属房间地标只影响布景，不代替房型和门控。 */
  landmark?: 'kedama_arena'
  /** 距撤离点（裂隙房）的 BFS 步数——越接近撤离点刷怪权重范围越大 */
  exitDist: number
  doors: RoomDoorRef[]
}

export interface FloorPlan {
  slotCols: number
  slotRows: number
  /** 槽位 → 房间 id 的映射（0 = 空槽；读取到的 id 需 -1） */
  slots: Int16Array
  rooms: RoomDef[]
  doors: DoorDef[]
  startId: number
  exitId: number
}

/** 取反向方位 */
export function oppositeDir(d: Dir): Dir {
  return d === 'N' ? 'S' : d === 'S' ? 'N' : d === 'W' ? 'E' : 'W'
}
