/**
 * 序章固定楼层：五个矿洞房间，末尾保留旧基地房间编号用于兼容。
 *
 * 纯手工 FloorPlan（不走 BSP），坐标按 CONFIG 30×20 格 × 48px 排布；
 * 每房的 ScriptedRoomSpec 决定刷怪/火把/门控，导演按房间 id 推进剧情。
 * 基地演出统一由 BaseModule 使用正式新基地；旧 R5 入口直接转交，不绘制旧基地。
 */
import { CONFIG } from '../../config'
import { SLIME_BLUE_ID, SLIME_RED_ID, VENOM_GREEN_ID } from '../../../content/enemies/vanilla/ids'
import type { Dir, DoorDef, FloorPlan, RoomDef, RoomDoorRef } from '../dungeon/types'
import type { ScriptedRoomSpec, ScriptedSpawn } from '../dungeon/script'

/** 序章房间 id（直线链顺序；导演按名引用防漂移） */
export const PROOT = {
  WAKE: 0,
  BATTLE: 1,
  MINE: 2,
  HINT_1: 3,
  REIMU: 4,
  BASE: 5
} as const

/** 序章房间总数（buildProloguePlan/规格表共用，防漂移） */
export const PROLOGUE_ROOMS = 6

const T = CONFIG.tile
const CX = (CONFIG.roomCols * T) / 2
const CY = (CONFIG.roomRows * T) / 2

/** S2 破门蓝史莱姆出场点（东门内侧） */
export const BREAK_IN = { x: CONFIG.roomCols * T - (CONFIG.wallThickness + 2) * T, y: CY }
/** R4 灵梦站位（房间中央偏北） */
export const REIMU_POS = { x: CX, y: CY - 20 }

// —— R5 基地：篝火/装饰坐标与主角脚本走位路径（导演按表演出） ——
/** 篝火（房间主光源，灵梦与主角围聚于此） */
export const CAMPFIRE_POS = { x: CX, y: CY - 40 }
/** 基地灵梦站位（篝火东北侧） */
export const BASE_REIMU_POS = { x: CX + 78, y: CY - 96 }
/** 旧锅（架在篝火北侧） */
export const BASE_POT_POS = { x: CX - 4, y: CY - 108 }
/** 破提灯（篝火西侧地上） */
export const BASE_LANTERN_POS = { x: CX - 92, y: CY - 18 }
/** 木箱两只（东南角杂物堆） */
export const BASE_CRATE_A = { x: CX + 300, y: CY + 150 }
export const BASE_CRATE_B = { x: CX + 352, y: CY + 118 }
/** 草铺（西北角的铺盖卷） */
export const BASE_BED_POS = { x: CX - 360, y: CY - 170 }
/**
 * 主角脚本走位路径（黑场淡出后从西门一路走到篝火南侧；末点停留朝向＝朝灵梦）。
 * 每段秒数由导演按段长自行分配，约 4 秒走完，与开场两句对白并行。
 */
export const BASE_WALK_PATH: Array<{ x: number; y: number }> = [
  { x: CX - 190, y: CY + 40 },
  { x: CX - 70, y: CY - 130 },
  { x: CX - 26, y: CY + 78 }
]

/**
 * 序章后续房间（R1~R4）专属压暗档：
 * 常规战斗暗档为 0.50/0.74、醒来房漆黑为 0.96/1.00；
 * 这里取中间偏黑的一档——"越深入矿洞越黑"，但远没到醒来房那种伸手不见五指，
 * 清场后也比常规清场房暗一档（0.24/0.54 vs 0.14/0.42）。
 */
const PROLOGUE_DARK = {
  dimCenter: 0.72,
  dimEdge: 0.9,
  litCenter: 0.24,
  litEdge: 0.54
} as const

/** 构造 5 房直线 plan */
export function buildProloguePlan(): FloorPlan {
  const slotCols = PROLOGUE_ROOMS + 2
  const slotRows = CONFIG.dungeon.slotRows
  const rooms: RoomDef[] = []
  const doors: DoorDef[] = []
  const roomDoors: RoomDoorRef[][] = Array.from({ length: PROLOGUE_ROOMS }, () => [])

  for (let i = 0; i < PROLOGUE_ROOMS; i++) {
    rooms.push({
      id: i,
      sx: i,
      sy: 2,
      // R0 用 normal 拿到正常矿脉密度（教学要敲岩石）；不用 start/exit，全程无裂隙
      kind: 'normal',
      depth: i,
      // 序章视为第 0 层：金矿/红玉等 minFloor≥2 的稀有矿种一律不刷，只剩铜铁
      floor: 0,
      exitDist: PROLOGUE_ROOMS - 1 - i,
      doors: []
    })
  }
  for (let i = 0; i < PROLOGUE_ROOMS - 1; i++) {
    const id = i
    const def: DoorDef = { id, a: i, b: i + 1, dirA: 'E' as Dir, dirB: 'W' as Dir }
    doors.push(def)
    roomDoors[i].push({ doorId: id, dir: 'E' })
    roomDoors[i + 1].push({ doorId: id, dir: 'W' })
  }
  rooms.forEach((r, i) => (r.doors = roomDoors[i]))

  const slots = new Int16Array(slotCols * slotRows)
  for (const r of rooms) slots[r.sy * slotCols + r.sx] = r.id + 1

  return { slotCols, slotRows, slots, rooms, doors, startId: 0, exitId: PROOT.BASE }
}

/** 各房脚本规格（除醒来房外怪物全部出生即索敌：序章不等玩家凑近才激活） */
export function prologueRoomSpecs(): Map<number, ScriptedRoomSpec> {
  const map = new Map<number, ScriptedRoomSpec>()

  // R0 醒来房：全锁，火把手点，无爆怪/宝箱；怪由导演手动破门刷入
  // 岩包/矿脉要够多（12~16 格）：显矿簇一眼能被看到，玩家才知道"这玩意儿能敲"
  map.set(PROOT.WAKE, {
    startLocked: true,
    manualTorches: true,
    suppressAutoClear: true,
    noMonsterBurst: true,
    noChest: true,
    oreRange: [12, 16],
    spawns: []
  })

  // R1 战斗教学房：5 蓝史莱姆 + 1 毒液绿（绿的放后排，进门先撞见蓝群）
  // manualClear：清场后先让主角念"继续向前探探吧"，念完导演才 storyClear 亮灯开门
  map.set(PROOT.BATTLE, {
    aggressive: true,
    // 战斗房也撒少量矿脉（3~5 格）：不喧宾夺主，但不是光秃秃一间房
    oreRange: [3, 5],
    noChest: true,
    noMonsterBurst: true,
    manualClear: true,
    ambient: PROLOGUE_DARK,
    spawns: [
      { id: SLIME_BLUE_ID, x: CX + 140, y: CY - 120 },
      { id: SLIME_BLUE_ID, x: CX + 260, y: CY - 180 },
      { id: SLIME_BLUE_ID, x: CX + 360, y: CY - 60 },
      { id: SLIME_BLUE_ID, x: CX + 230, y: CY + 80 },
      { id: SLIME_BLUE_ID, x: CX + 100, y: CY + 40 },
      { id: VENOM_GREEN_ID, x: CX + 410, y: CY - 150 }
    ]
  })

  // R2 矿房：序章唯一正经矿点——6~9 格极少量铜/铁矿脉（金/红玉被楼层门控过滤；岩石 1% 宝箱仍生效）
  map.set(PROOT.MINE, {
    aggressive: true,
    noMonsterBurst: true,
    ambient: PROLOGUE_DARK,
    oreRange: [6, 9],
    spawns: [
      { id: SLIME_BLUE_ID, x: CX + 200, y: CY - 150 },
      { id: SLIME_BLUE_ID, x: CX + 320, y: CY + 120 },
      { id: SLIME_BLUE_ID, x: CX + 120, y: CY + 150 }
    ]
  })
  // R3 动静过场房：3 蓝 + 1 毒液绿，清场才能继续深入（s7/s8 旁述在进门时播）
  map.set(PROOT.HINT_1, {
    aggressive: true,
    oreRange: [3, 5],
    noMonsterBurst: true,
    noChest: true,
    ambient: PROLOGUE_DARK,
    spawns: [
      { id: SLIME_BLUE_ID, x: CX + 180, y: CY - 140 },
      { id: SLIME_BLUE_ID, x: CX + 320, y: CY - 40 },
      { id: SLIME_BLUE_ID, x: CX + 220, y: CY + 130 },
      { id: VENOM_GREEN_ID, x: CX + 400, y: CY - 160 }
    ]
  })

  // R4 灵梦房：5 蓝内圈紧围灵梦 + 5 红中圈 + 5 绿外圈远处（敌人铺天盖地的压迫感）
  const ring: ScriptedSpawn[] = []
  // 蓝史莱姆：内圈 5 只
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    ring.push({ id: SLIME_BLUE_ID, x: REIMU_POS.x + Math.cos(a) * 112, y: REIMU_POS.y + Math.sin(a) * 85 })
  }
  // 红史莱姆：中圈 5 只，错角排布
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 5
    ring.push({ id: SLIME_RED_ID, x: REIMU_POS.x + Math.cos(a) * 178, y: REIMU_POS.y + Math.sin(a) * 130 })
  }
  // 毒液绿：外圈 5 只放最远，再错角（玩家从西门进来，先撞见蓝红、绿的远程施压）
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    ring.push({ id: VENOM_GREEN_ID, x: REIMU_POS.x + Math.cos(a) * 248, y: REIMU_POS.y + Math.sin(a) * 178 })
  }
  map.set(PROOT.REIMU, {
    aggressive: true,
    suppressAutoClear: true,
    oreRange: [3, 5],
    noMonsterBurst: true,
    noChest: true,
    ambient: PROLOGUE_DARK,
    spawns: ring
  })

  // R5 基地：无怪无矿的常亮安全房。西门由 startLocked 永久封印，
  // 东墙挂剧情出口（红色封印态，营地对白结束导演才 openStoryExit）
  map.set(PROOT.BASE, {
    noOre: true,
    noChest: true,
    noMonsterBurst: true,
    startLocked: true,
    litRoom: true,
    storyExit: { dir: 'E', ref: 'base_east' },
    spawns: []
  })

  return map
}
