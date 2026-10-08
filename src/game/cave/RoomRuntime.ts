/**
 * 单个房间的运行时：瓦片地图 + 门 + 敌人 + 掉落物 + 矿脉 + 裂隙
 *
 * 从 v0.2 的 FeelTestScene 抽出全部"房间内"玩法逻辑，
 * 新增：清场解封门、踩门切换、末间裂隙交互。
 * 房间可被缓存重访——已清房间保持空场、矿脉破坏状态与掉落物全部保留。
 */
import type { EngineContext } from '../../core/types'
import { compactInPlace } from '../../core/collections'
import { bladeErasesProjectile } from '../weaponProjectileSweep'
import type { WeaponImpactInstance } from '../../content/items/types'
import { aoeMultiplier, meleeImpact } from '../../content/items/combatComponents'
import { CavePlants } from '../art/cavePlants'
import { getItemDef, findItemDef, type ItemId, type SpellCardDef, type SpellFxColors } from '../../shared/itemDefs'
import { t, hasKey, itemName, mineralName } from '../../i18n'
import { ROCK_STONE_ID, PICK_RUSTY_ID, SWORD_IRON_ID, DOOMSDAY_ID } from '../../content/items/vanilla/ids'
import { rollEnemyId, fixedEnemyIds, enemies } from '../../content/enemies/registry'
import { SLIME_BLUE_ID } from '../../content/enemies/vanilla/ids'
import { findMineralDef } from '../../content/minerals/registry'
import { DEFAULT_BIOME_ID, biomeDefs, rollEnemyCount, oreRangeForRoom } from '../../content/biomes/registry'
import type { Inventory } from '../../shared/inventory'
import { CONFIG } from '../config'
import { sfx } from '../audio/Sfx'
import { doomsdayHit } from '../../content/items/vanilla/weapons/doomsday/audio'
import { DoomsdayRoom } from '../../content/items/vanilla/weapons/doomsday/room'
import { Drop } from '../Drop'
import { Enemy } from '../Enemy'
import { FxLayer } from '../FxLayer'
import { Player } from '../Player'
import { Projectile } from '../Projectile'
import { createRoomTexture } from '../roomTexture'
import { createRoomTextureTrial } from '../art/roomTextureTrial'
import {
  createRoomTextureE,
  layoutTorches,
  drawTorchFlame,
  torchProgress,
  torchFlicker,
  torchLightPos,
  layoutSteamVents,
  emberPulse,
  type TorchSlot,
  type SteamVent
} from '../art/roomTextureE'
import { SteamVents } from '../art/steamVents'
import { layoutProps, renderProp, propBands, propBlocksBullets, circleHitsProp, type Prop, type PropBand } from '../art/props'
import { drawOreCrystals, oreLight } from '../art/oreVein'
import { WarpField } from '../art/warpField'
import { FogField } from '../art/fogField'
import type { AmbientLevel, LightSource } from '../art/lighting'
import { TileMap, type DoorSlot, type OreTile } from '../tilemap'
import type { Dir, RoomDef } from './dungeon/types'
import type { ScriptedRoomSpec, ScriptedSpawn } from './dungeon/script'
import type { Interactable, ItemInteractData, ChestInteractData } from './interactables'
import { rollLoot } from '../../content/loot/registry'
import { CaveNature, type NatureGather } from '../art/caveNature'
import { WOOD_ID, SLIME_BALL_ID } from '../../content/items/vanilla/ids'
import { calculateDamage, damageLabel } from '../../shared/combat'
import { SALTPETER_ID } from '../../content/items/vanilla/materials/saltpeter'
import { PROP_LOGS_ID } from '../../content/props/vanilla/ids'
import { propDefs } from '../../content/props/registry'
import { updateBoomerang } from '../../content/items/vanilla/weapons/boomerang/flight'
import { FurnaceWrecks } from '../art/furnaceWrecks'
import { OLD_FURNACE_PARTS_ID } from '../../content/items/vanilla/ids'
import { CHEST_BASIC_TABLE } from '../../content/loot/vanilla/chestBasic'
import { resolveCaveArt } from '../art/caveStyle'
import { drawMineSprite } from '../art/mineAssets'

/** '#rrggbb'（或 '#rgb'）+ alpha → rgba 字符串（符卡光波配色用） */
function hexRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

/** 梦想封印·棱镜连爆：相邻两爆间隔（秒）与单个光团半径（大范围） */
const PRISMA_GAP = 0.3
const PRISMA_R = 235
/** 五爆各一组三色混色调色板（五颜六色；每组内三色错位叠加成"混色大光团"） */
const PRISMA_PALETTES: Array<[string, string, string]> = [
  ['#ff6b8b', '#ffd166', '#7afcff'],
  ['#9b7bff', '#7afcff', '#b6ff8a'],
  ['#ff9f43', '#ff6b8b', '#c08bff'],
  ['#7afcff', '#a6ff70', '#ffe66d'],
  ['#ff5e7e', '#8ab4ff', '#ffffff']
]

/** 玩家操作输入（模块在房间切换冻结期会传零值） */
export interface RoomInput {
  moveX: number
  moveY: number
  dodgePressed: boolean
  dodgeHeld: boolean
  dodgeReleased: boolean
  /** 攻击键本帧刚按下（边沿；武器逐点击打用） */
  attackPressed: boolean
  /** 右键特殊攻击本帧刚按下 */
  specialPressed: boolean
  specialHeld?: boolean
  specialReleased?: boolean
  /** 攻击键当前按住（电平；镐类工具长按自动连挥用） */
  attackHeld: boolean
  attackReleased?: boolean
  pointerX: number
  pointerY: number
  /** F 键（裂隙交互；E/R 已让给符卡） */
  interactPressed: boolean
}

/** 房间向模块（CaveModule）请求的外部动作 */
export interface RoomHost {
  inventory: Inventory
  furnaceSearchAllowed?():boolean
  onFurnaceSearch?(found:boolean):void
  claimMiningChest?(): boolean
  /** 仅在敲碎纯普通岩石时调用，剧情宿主负责整趟探索的保底名额。 */
  claimGuaranteedMiningChest?(): boolean
  /** 外部技能弹幕同步参与符卡每一波净化，普通矿洞可省略。 */
  clearEnemyBullets?(x:number,y:number,radius:number):void
  /** 击杀一只怪（整层统计 + 经验结算；exp 为该敌人基础经验，吃深层倍率） */
  onKill(exp: number): void
  /** 敲碎一处矿点（'rock' 普通岩石 / 'ore' 显矿矿脉；经验结算用） */
  onMine(kind: 'rock' | 'ore'): void
  /** 仅在物品成功入包后报告发现，满背包弹回不算获得。 */
  onItemFound?(id: ItemId): void
  /** 玩家踩上开启的门 → 请求切换到对端房间 */
  requestDoor(doorId: number): void
  /** 玩家踏入已解封的剧情出口（序章基地东门 → 转正式第一层） */
  requestStoryExit?(ref: string): void
  /** 在激活的裂隙按 F → 请求撤离结算 */
  requestExtract(): void
  /** 玩家倒下（边沿触发一次） */
  onPlayerDied(): void
  /**
   * 玩家倒下时先给剧情层接管机会（序章教学期独白 + 半血复活）。
   * 返回 true = 已接管，不走正常死亡结算；返回 false/缺省 = 正常死亡。
   */
  onPlayerDowned?(): boolean
  /** 交互物被成功触发（导演推进剧情用；火把/拾取/宝箱均回调） */
  onInteract?(it: Interactable): void
  /** 地面物请求直接装备到槽位（序章发镐/剑；返回是否成功） */
  equipItem?(slot: NonNullable<ItemInteractData['slot']>, item: ItemId): boolean
}

interface RuntimeDoor {
  doorId: number
  dir: Dir
  col: number
  row: number
  open: boolean
  /** 剧情出口门（无对端房间；踏入回调 requestStoryExit 而非 requestDoor） */
  storyExit?: boolean
  /** 剧情出口标识（storyExit 门用，转交导演） */
  exitRef?: string
}

/** 相机视口（世界坐标矩形）；矿簇等小光源屏外剔除用 */
interface ViewBounds {
  x: number
  y: number
  w: number
  h: number
}

/** 同方位多门时在墙上的格位排布（中点优先，多门对称错开） */
function slotOnWall(size: number, count: number, index: number): number {
  const mid = Math.floor(size / 2)
  if (count === 1) return mid
  if (count === 2) return mid + (index === 0 ? -4 : 4)
  if (count === 3) return mid + [-6, 0, 6][index]
  const low=CONFIG.wallThickness+2,high=size-CONFIG.wallThickness-3
  return Math.round(low+(high-low)*index/(count-1))
}

/** 房间可指定独立群系，未指定时仍沿用旧矿洞的数量与矿量配置。 */
const currentBiome = (def: RoomDef) => biomeDefs.require(def.biomeId ?? DEFAULT_BIOME_ID)

export class RoomRuntime {
  private readonly artStyle: ReturnType<typeof resolveCaveArt>
  readonly def: RoomDef
  readonly map: TileMap
  readonly texture: HTMLCanvasElement
  /** 批次 E：北墙拔高立面层（每帧盖在实体上做遮挡；旧纹理为 null） */
  readonly textureNorth: HTMLCanvasElement | null
  /** 批次 E：墙上火把布局（旧纹理为空数组） */
  readonly torches: readonly TorchSlot[]
  /** 批次 E：冒热气的地缝（余烬微光 + 热气粒子；旧纹理为空数组） */
  private readonly vents: readonly SteamVent[]
  private readonly steam: SteamVents
  /** 批次 E：立体摆件（纯视觉，参与 y-sort） */
  private readonly props: readonly Prop[]
  private nature: CaveNature | null = null
  private plants: CavePlants | null = null
  private wrecks:FurnaceWrecks|null=null
  private wreckSearchAllowed=false
  private survivalElapsed=0
  private survivalWave=0
  private survivalComplete=false
  /** 复用碰撞工作区及动态资源实体，避免每帧生成数组和临时摆件。 */
  private readonly collisionProps: Prop[] = []
  private readonly bulletBlockers: PropBand[] = []
  /** 首领弹幕与普通弹幕使用同一份掩体缓存。 */
  get projectileBlockers(): readonly PropBand[] { return this.bulletBlockers }
  private readonly resourceColliders = new WeakMap<object, Prop>()
  readonly doors: RuntimeDoor[]
  readonly fx = new FxLayer()
  /** 批次 F⑤：时空乱流氛围浮层（地面之上、实体之下） */
  private readonly warp = new WarpField()
  /** 批次 F⑦追加：漂浮动态雾气（实体之上、弹幕之下的柔遮罩） */
  private readonly fog = new FogField()

  readonly fissure: { x: number; y: number; active: boolean } | null

  private enemies: Enemy[] = []
  private readonly doomsday = new DoomsdayRoom({
    fx: this.fx, enemies: () => this.enemies, time: () => this.time,
    onEnemyKilled: (enemy, host) => this.onEnemyKilled(enemy, host)
  })

  clearDoomsday(player: Player): void { this.doomsday.clear(player) }
  renderDoomsday(ctx: CanvasRenderingContext2D, player: Player): void { this.doomsday.render(ctx, player) }

  private enemyTotal: number
  private drops: Drop[] = []
  /** 敌方弹幕（毒液史莱姆） */
  private bullets: Projectile[] = []
  private weaponImpacts: WeaponImpactInstance[] = []
  /** 符卡光脉演出（每波一条；colors 缺省=旧单色金环，seed=光芒旋转种子）
   *  follow=true 时中心实时跟随玩家（祓除光脉是"绕身绽开"而非原地爆炸） */
  private spellFx: Array<{
    x: number
    y: number
    radius: number
    t: number
    dur: number
    color: string
    colors?: SpellFxColors
    seed: number
    follow: boolean
  }> = []
  /** 延迟符卡脉冲（多波次符卡：第二波及以后排期；触发时以玩家当前位置为中心） */
  private pendingSpellPulses: Array<{
    delay: number
    spellId: ItemId
    def: SpellCardDef
    pulse: number
    damageBonus:number
  }> = []
  private cleared: boolean
  /** 批次 E：火把开始点燃时刻；null=从未点燃，负值=建房前已亮（空房） */
  private litStart: number | null = null
  /** 脚本模式：火把需手动点；每根火把的点燃时刻（未在表中 = 熄灭） */
  private manualTorch = false
  /**
   * 火把是否允许 F 点燃（默认关）。
   * 序章醒来房必须先击杀破门史莱姆、走到 S3 点火教学时导演才打开——
   * 否则玩家可以在战斗前就把房间点亮，跳过"太黑了"的整段节拍。
   */
  private torchesEnabled = false
  private readonly litTorchAt = new Map<number, number>()
  /** 是否已访问过（HUD/小地图用） */
  visited = true
  private deathNotified = false
  private time = 0

  // —— B2：地面交互物（站立物 + F；与磁吸 Drop 区分） ——
  private interactables: Interactable[] = []
  private interactSeq = 0
  /** 当前站在触发范围内的交互物（HUD 提示用；每帧刷新） */
  private nearbyInteractable: Interactable | null = null
  /** 本房脚本规格（序章房；普通随机房为 null） */
  readonly script: ScriptedRoomSpec | null
  /** 延迟刷怪队列（脚本怪 delay > 0；未出场也算在 enemyTotal 内，阻止提前清场） */
  private pendingSpawns: ScriptedSpawn[] = []
  private roomAlerted=false

  // —— B2：剧情实体追加（序章灵梦等），参与全屋 y-sort —— //
  private extraSortables: Array<{ y: number; draw: (ctx: CanvasRenderingContext2D, time: number) => void }> = []

  // —— 序章基地：剧情自定义光源（篝火等，每帧按闪烁系数输出） —— //
  private customLights: Array<{ x: number; y: number; r: number; power: number; color: string; tint: number; flicker: boolean }> = []

  // —— B2：梦想封印演出 —— //
  /** 剧情冻结（封印对白/聚气期间怪群完全静止） */
  private enemiesFrozen = false
  /** 棱镜五连爆：每个在爆光团状态（加色混色光球 + 冲击环） */
  private prismaBlasts: Array<{
    x: number
    y: number
    r: number
    t: number
    dur: number
    colors: [string, string, string]
    seed: number
    glow?: HTMLCanvasElement
  }> = []
  /** 五连爆序列时钟（-1＝未启动；首爆当帧引爆，之后每 PRISMA_GAP 秒一爆） */
  private prismaClock = -1
  /** request 当帧置位：update 首帧立即引爆第 0 爆 */
  private prismaArmed = false
  /** 预先采样好的 5 个随机爆点 */
  private prismaPoints: Array<{ x: number; y: number }> = []
  /** 全屏白闪剩余时间 / 总时长（五连爆每爆轻闪一次） */
  private sealFlash = 0
  private sealFlashDur = 1

  /**
   * @param script 固定脚本房间规格（序章；普通房省略）
   */
  constructor(def: RoomDef, spawnX: number, spawnY: number, script?: ScriptedRoomSpec) {
    this.def = def
    this.script = script ?? null
    if (script?.manualTorches) this.manualTorch = true
    const biome = currentBiome(def)
    this.artStyle = resolveCaveArt(biome, def.floor ?? 1)
    let backgroundRocks:readonly import('../art/floorDecorations').BackgroundRock[]=[]
    // 脚本房按固定表计数；普通房和陷阱房共用楼层预算，陷阱房选择偏多的一档。
    this.enemyTotal = script?.spawns ? script.spawns.length : script?.enemyRange
      ? script.enemyRange[0]+Math.floor(Math.random()*(script.enemyRange[1]-script.enemyRange[0]+1))
      : rollEnemyCount(biome, def)+(!script?fixedEnemyIds(def.kind,def.floor??1).length:0)
    this.doors = layoutDoors(def)
    // 剧情出口：追加一扇无对端房间的单向门（构造即红色封印态，openStoryExit 解封）
    if (script?.storyExit) {
      const { roomCols: C, roomRows: R, wallThickness: W } = CONFIG
      const sd = script.storyExit.dir
      const col = sd === 'W' ? W - 1 : sd === 'E' ? C - W : slotOnWall(C, 1, 0)
      const row = sd === 'N' ? W - 1 : sd === 'S' ? R - W : slotOnWall(R, 1, 0)
      this.doors.push({ doorId: -1, dir: sd, col, row, open: false, storyExit: true, exitRef: script.storyExit.ref })
    }
    const doorSlots: DoorSlot[] = this.doors.map((d) => ({ col: d.col, row: d.row }))

    this.map = new TileMap({
      spawnCol: Math.floor(spawnX / CONFIG.tile),
      spawnRow: Math.floor(spawnY / CONFIG.tile),
      // 矿量：noOre 清零 → spec.oreRange 脚本定量（序章极少量）→ 群系按房型随机
      oreRange: script?.noOre ? [0, 0] : script?.oreRange ?? oreRangeForRoom(biome, def.kind),
      roomKind: def.kind,
      depth: def.depth ?? 0,
      // 楼层门控：def.floor 缺省按正式第 1 层；序章 plan 显式写 0
      floor: def.floor ?? 1,
      doors: doorSlots
    })
    // K 批次：矿脉先生成、摆件后选址——收集全部矿格（晶簇+未敲岩包）中心供摆件避让
    const orePoints: Array<{ x: number; y: number }> = []
    this.map.forEachOre((o) => {
      orePoints.push({ x: (o.col + 0.5) * CONFIG.tile, y: (o.row + 0.5) * CONFIG.tile })
    })
    if (CONFIG.art.slice) {
      if (script?.theme === 'grimm') {
        // 猩红圣堂斗场：黑石砖地 + 仪式法阵 + 黑石裙墙 + 帷幔立面 + 落地火盆（无矿洞杂物）
        const layers = createRoomTextureTrial(doorSlots, def.id)
        this.texture = layers.base
        this.textureNorth = layers.northFace
        this.torches = []
        this.vents = []
      } else {
        // 批次 E：石板地 + 岩壁立面 + 坑木支架（双层）+ 墙上火把 + 苔藓地缝
        const art = this.artStyle
        const layers = createRoomTextureE(doorSlots, def.id, art.floor, def.floor ?? 1, def.landmark, art.scene)
        backgroundRocks=layers.backgroundRocks ?? []
        this.texture = layers.base
        this.textureNorth = layers.northFace
        this.torches = layoutTorches(doorSlots)
        this.vents = layoutSteamVents(doorSlots, def.id)
      }
      const art = this.artStyle
      this.props = script?.noProps ? [] : layoutProps(doorSlots, def.id, spawnX, spawnY, this.vents, orePoints).map(p=>({...p,artStyle:art.scene}))
    } else {
      this.texture = createRoomTexture(doorSlots)
      this.textureNorth = null
      this.torches = []
      this.vents = []
      this.props = []
    }
    this.steam = new SteamVents(this.vents)
    if (!script?.noNature && !script) {
      // 非采矿的背景岩块与石质摆件均逐块判定，TileMap 中可挖的岩石不在此表。
      const gatherRocks=[...backgroundRocks,...this.props.filter(p=>propDefs.get(p.id)?.tags?.includes('rock')).map(p=>({x:p.x,y:p.y,radius:(propDefs.get(p.id)?.halfWidth??18)*p.s+18}))]
      this.nature = new CaveNature(this.map, this.props, spawnX, spawnY, def.floor ?? 1, gatherRocks)
      this.plants = new CavePlants(this.map, doorSlots, def.id, this.nature.waterBanks)
    }

    if (script?.spawns) {
      // 脚本房：固定点位刷怪（delay>0 的进延迟队列，update 中到期出场）
      // aggressive：剧情房怪物出生即索敌，不等玩家走进视野
      for (const sp of script.spawns) {
        if ((sp.delay ?? 0) > 0) this.pendingSpawns.push(sp)
        else this.spawnEnemyAt(sp.id, sp.x, sp.y, sp.burrow === true, script.aggressive === true)
      }
    } else {
      this.spawnEnemies(spawnX, spawnY)
    }

    // 优先正中央；被矿脉、摆件或采集实体占用时，逐圈随机寻找空位。
    if (def.kind === 'exit' && !script?.noFissure) {
      const { left, right, top, bottom } = this.map.bounds
      const cx = (left + right) / 2, cy = (top + bottom) / 2, clearance = CONFIG.fissure.radius + 18
      const valid = (x: number, y: number): boolean => {
        if (x-clearance<left || x+clearance>right || y-clearance<top || y+clearance>bottom) return false
        for (let dy=-clearance;dy<=clearance;dy+=12) for (let dx=-clearance;dx<=clearance;dx+=12) {
          if (dx*dx+dy*dy<=clearance*clearance && this.map.solidAtWorld(x+dx,y+dy)) return false
        }
        return !this.props.some(p=>propBands(p).some(b=>x+clearance>b.x0&&x-clearance<b.x1&&y+clearance>b.y0&&y-clearance<b.y1))
          && !orePoints.some(p=>Math.hypot(p.x-x,p.y-y)<clearance+CONFIG.tile*.72)
          && !this.vents.some(v=>v.pts.some(p=>Math.hypot(p.x-x,p.y-y)<clearance+16))
          && !this.nature?.gathers.some(p=>Math.hypot(p.x-x,p.y-y)<clearance+20)
          && !this.nature?.wood.some(p=>Math.hypot(p.x-x,p.y-y)<clearance+45)
          && !this.enemies.some(p=>Math.hypot(p.x-x,p.y-y)<clearance+30)
      }
      let spot: {x:number;y:number} | null = valid(cx,cy)?{x:cx,y:cy}:null
      for (let radius=CONFIG.tile;!spot&&radius<Math.hypot(right-left,bottom-top);radius+=CONFIG.tile) {
        const phase=Math.random()*Math.PI*2, count=Math.max(16,Math.ceil(radius*2*Math.PI/24))
        for (let i=0;i<count;i++) {
          const a=phase+i/count*Math.PI*2,x=cx+Math.cos(a)*radius,y=cy+Math.sin(a)*radius
          if(valid(x,y)){spot={x,y};break}
        }
      }
      // 极端密集房不强行把撤离点塞进实体；最近空格作为最后检查。
      if(!spot) for(let y=top+clearance;y<bottom-clearance&&!spot;y+=12) for(let x=left+clearance;x<right-clearance;x+=12) {
        if(valid(x,y)){spot={x,y};break}
      }
      this.fissure = spot ? {...spot,active:false} : {x:cx,y:cy,active:false}
    } else {
      this.fissure = null
    }

    if(def.furnaceWrecks?.length)this.wrecks=new FurnaceWrecks(this.map,this.props,{x:spawnX,y:spawnY},def.furnaceWrecks,[...(this.nature?.gathers??[]),...(this.nature?.wood??[]),...(this.fissure?[this.fissure]:[]),...this.enemies])
    // 无怪房间（入口/奖励）默认解封；末间/普通房清场后解封
    // 脚本房在有延迟怪时 enemyTotal 已计入，不会误入此分支；startLocked 强制初始锁门
    this.cleared = this.enemyTotal === 0 && !script?.startLocked && def.encounter!=='survival'
    if (this.cleared) {
      for (const d of this.doors) {
        d.open = true
        this.map.openDoor(d.col, d.row)
      }
      // 空房进房即灯火通明（手动火把房除外：序章黑房要玩家自己点）
      if (!this.manualTorch) this.litStart = -10
    }

    // 手动火把模式：每根墙上火把都是 F 交互点（未点燃时可交互）
    if (this.manualTorch) {
      for (const tr of this.torches) {
        const p = torchLightPos(tr)
        this.interactables.push({
          id: this.interactSeq++,
          kind: 'torch',
          x: p.x,
          y: p.y,
          range: 58,
          hint: t('game.interact.torch_hint'),
          oneShot: true,
          done: false,
          data: { index: tr.index }
        })
      }
    }

    // 常亮安全房（序章基地）：墙上火把视为早已燃着，无需清场/点火流程
    if (script?.litRoom) this.litStart = -10
  }

  /** 房间光源（本帧） */
  getRoomLights(view?: ViewBounds): LightSource[] {
    if (!CONFIG.art.slice) return []
    const T = CONFIG.art.torch
    const out: LightSource[] = []
    // 手动火把黑房且一根未点：漆黑态——地缝/矿簇等杂光全部压下，
    // 全场只留火把座的一豆余烬指路（点火后一切恢复）
    const pitchBlack = this.manualTorch && this.litTorchAt.size === 0 || this.def.encounter==='survival'&&!this.survivalComplete
    // 火把：清场后才逐根点亮（手动模式只亮玩家点过的）
    for (const tr of this.torches) {
      const p = this.torchLitProgress(tr)
      const pos = torchLightPos(tr)
      if (p <= 0) {
        // 手动火把黑房：未点燃的火把座留一豆余烬微光，帽灯扫到之前先给玩家一个方向
        if (this.manualTorch) {
          out.push({
            x: pos.x,
            y: pos.y,
            r: 38,
            power: 0.05 + 0.015 * Math.sin(this.time * 2.4 + tr.seed),
            color: '#ff8a3a',
            tint: 0.04
          })
        }
        continue
      }
      // 光随火动：闪烁系数同时驱动火苗外形与光源强度
      const fl = Math.min(1, torchFlicker(this.time, tr.seed))
      out.push({
        x: pos.x,
        y: pos.y,
        r: T.radius,
        power: 0.95 * p * fl,
        color: '#ff9a3c',
        tint: 0.17 * p
      })
    }
    // 地缝余烬微光（常亮；暗房里幽幽地呼吸，清场后被火光淹没也无妨）
    // 漆黑态压下：星星点点的地缝光会把黑房撒成"花着亮"，破坏醒来的压迫感
    if (!pitchBlack) for (const v of this.vents) {
      out.push({
        x: v.x,
        y: v.y,
        r: 78,
        power: 0.26 * emberPulse(this.time, v.seed),
        color: '#ff7a2a',
        tint: 0.1
      })
    }
    // 矿簇微光（屏外剔除；金矿最亮，镐击命中当帧爆闪）
    // 岩包态（普通灰岩）不发光——暗房里只有露出的晶簇能指引矿点
    // 漆黑态同样压下（点火后矿点才在火光里显形）
    const pad = CONFIG.art.oreGlow.radius + 30
    if (!pitchBlack) this.map.forEachOre((ore) => {
      if (ore.vein === 'rock') return
      const cx = (ore.col + 0.5) * CONFIG.tile
      const cy = (ore.row + 0.5) * CONFIG.tile
      if (view && (cx < view.x - pad || cx > view.x + view.w + pad || cy < view.y - pad || cy > view.y + view.h + pad)) {
        return
      }
      out.push(oreLight(ore, this.time))
    })
    // 下行裂隙：未激活暗红幽光（标出撤离点），激活后金紫门户双层光
    if (this.fissure) {
      const f = this.fissure
      const fpad = CONFIG.fissure.radius + 90
      if (!view || !(f.x < view.x - fpad || f.x > view.x + view.w + fpad || f.y < view.y - fpad || f.y > view.y + view.h + fpad)) {
        if (f.active) {
          out.push({
            x: f.x,
            y: f.y,
            r: 128,
            power: 0.52 * (0.75 + 0.25 * Math.sin(this.time * 3)),
            color: '#b46cff',
            tint: 0.16
          })
          out.push({
            x: f.x,
            y: f.y,
            r: 82,
            power: 0.46 * (0.8 + 0.2 * Math.sin(this.time * 3 + 1)),
            color: '#ffd25e',
            tint: 0.1
          })
        } else {
          out.push({
            x: f.x,
            y: f.y,
            r: 64,
            power: 0.12 * (0.7 + 0.3 * Math.sin(this.time * 1.7)),
            color: '#c05060',
            tint: 0.06
          })
        }
      }
    }
    // 符卡光脉：跟随玩家移动的暖金动态光源——光波真实照亮洞壁/矿簇/摆件
    for (const s of this.spellFx) {
      if (s.t < 0) continue // 错峰排期未启动的光环不发光
      const k = Math.min(1, s.t / s.dur)
      const ease = 1 - Math.pow(1 - k, 3)
      const life = Math.pow(1 - k, 1.2)
      const lpad = s.radius + 120
      if (view && (s.x < view.x - lpad || s.x > view.x + view.w + lpad || s.y < view.y - lpad || s.y > view.y + view.h + lpad)) {
        continue
      }
      const lightColor = s.colors?.ring ?? s.color
      // 波锋光：半径随波扩散，扫到哪里亮到哪里
      out.push({
        x: s.x,
        y: s.y,
        r: s.radius * (0.4 + 0.85 * ease),
        power: 0.8 * life,
        color: lightColor,
        tint: 0.32 * life
      })
      // 中心核：贴身的白热强光源（前半段最亮，给角色/近景染色）
      if (k < 0.6) {
        out.push({
          x: s.x,
          y: s.y,
          r: s.radius * 0.5,
          power: 0.55 * (1 - k / 0.6),
          color: s.colors?.core ?? '#fff7d8',
          tint: 0.22 * (1 - k / 0.6)
        })
      }
    }
    // 梦想封印·棱镜连爆：彩色光团即强光源，爆到哪里哪里亮如白昼
    for (const b of this.prismaBlasts) {
      const k = Math.min(1, b.t / b.dur)
      const ease = 1 - Math.pow(1 - k, 2.2)
      const life = Math.pow(1 - k, 1.15)
      out.push({
        x: b.x,
        y: b.y,
        r: b.r * (0.35 + 0.95 * ease),
        power: 0.95 * life,
        color: b.colors[2],
        tint: 0.4 * life
      })
    }
    // 剧情自定义光源（基地篝火）：暖焰呼吸
    for (const l of this.customLights) {
      const fl = l.flicker ? 0.9 + 0.1 * Math.sin(this.time * 9 + l.x * 0.7) : 1
      out.push({ x: l.x, y: l.y, r: l.r, power: l.power * fl, color: l.color, tint: l.tint })
    }
    return out
  }

  get isCleared(): boolean {
    return this.cleared
  }

  /**
   * 脚本房间专属环境档：
   * - manualTorch 黑房：未点任何火把时近乎全黑、点起部分回到战斗暗档、全亮才到清场亮档；
   * - 其余脚本房若声明了 script.ambient（序章后续房间逐房加暗）：按清场状态取 dim/lit；
   * @returns null 表示调用方按 cleared 走 CONFIG 常规两档
   */
  get survivalSeconds():number|null{return this.def.encounter==='survival'&&!this.survivalComplete?Math.max(0,Math.ceil(30-this.survivalElapsed)):null}
  get ambientLevel(): AmbientLevel | null {
    if(this.def.encounter==='survival'){
      if(!this.survivalComplete)return {center:.8,edge:.95}
      const k=Math.min(1,(this.time-(this.litStart??this.time))/.8)
      return {center:.8-(.8-CONFIG.art.normalAmbient.litCenter)*k,edge:.95-(.95-CONFIG.art.normalAmbient.litEdge)*k}
    }
    // 常亮安全房（序章基地）：恒为明亮暖档，与清场/火把流程无关
    if (this.script?.litRoom) return { center: 0.1, edge: 0.32 }
    if (this.manualTorch) {
      const A = CONFIG.art.ambient
      const lit = this.litTorchAt.size
      if (lit === 0) return { center: 0.96, edge: 1 }
      if (lit >= this.torches.length) return { center: A.litCenter, edge: A.litEdge }
      return { center: A.dimCenter, edge: A.dimEdge }
    }
    // 脚本房专属压暗档（比常规战斗档黑，但远不及醒来房 0.96/1 的漆黑）
    const sa = this.script?.ambient
    if (sa) {
      return this.cleared
        ? { center: sa.litCenter, edge: sa.litEdge }
        : { center: sa.dimCenter, edge: sa.dimEdge }
    }
    if (!this.script) {
      const A = CONFIG.art.normalAmbient
      if (this.artStyle.scene.deepHollow) return this.cleared ? { center: .34, edge: .63 } : { center: .58, edge: .83 }
      return this.cleared ? { center: A.litCenter, edge: A.litEdge } : { center: A.dimCenter, edge: A.dimEdge }
    }
    return null
  }

  /** 漆黑态：手动火把房一根未点（CaveModule 据此收紧帽灯视域） */
  get pitchBlack(): boolean {
    return this.manualTorch && this.litTorchAt.size === 0
  }

  get aliveEnemies(): number {
    return this.enemies.filter((e) => e.alive).length
  }

  get totalEnemies(): number {
    return this.enemyTotal
  }

  get oreLeft(): number {
    return this.map.oreCount
  }

  get dropsCount(): number {
    return this.drops.length
  }

  /** 注入外部脚本实体，复用近战、符卡、神器光刺与伤害结算。 */
  addEnemy(enemy: Enemy): void { this.enemies.push(enemy) }
  /** 转阶段、战败或救援时清理双方未完成的攻击，不让对白结束后补发旧弹幕。 */
  clearCombatProjectiles(player: Player): void {
    this.bullets.length = 0; this.pendingSpellPulses.length = 0; this.weaponImpacts.length = 0
    for (const enemy of this.enemies) enemy.clearPendingAttacks()
    player.tarot.clear(); player.bow.clear(); player.rangedFlight = null; player.cancelCharge(); this.clearDoomsday(player)
  }
  /** 剧情退场不算击杀，不触发额外掉落和经验。 */
  removeStoryEnemy(enemy: Enemy): void { this.enemies = this.enemies.filter(candidate => candidate !== enemy) }

  /** 当前房间敌人剩余/总数（HUD 用） */
  get aliveCount(): number {
    return this.aliveEnemies
  }

  // ———————————————————— B2：脚本/交互公共 API ————————————————————

  /**
   * 调试控制台专用：秒杀本房所有存活敌人。
   * 走与正常击杀完全相同的结算（onEnemyKilled：碎粒、凝液掉落、经验、
   * 清场开门/裂隙激活由后续 update 自然驱动），保证不出现"怪没了门没开"。
   * @returns 本次击杀数
   */
  debugKillAll(host: RoomHost): number {
    let killed = 0
    for (const e of this.enemies) {
      if (!e.alive) continue
      // 0 击退 0 眩晕：尸体原地播放消亡，避免满房乱飞
      e.takeDamage(99999, 0, 0, 0)
      if (!e.alive) {
        this.onEnemyKilled(e, host)
        killed++
      }
    }
    return killed
  }

  /** 当前站在触发范围内的交互提示（无则 null；HUD 每帧读） */
  get interactHint(): string | null {
    return this.nearbyInteractable && !this.nearbyInteractable.done ? this.nearbyInteractable.hint : null
  }

  /** 当前交互物列表（只读；导演查询用） */
  get interactableList(): readonly Interactable[] {
    return this.interactables
  }

  /** 进入房间即广播警戒，后续刷怪继承同一状态，不依赖各自视野半径。 */
  onPlayerEnter():void{
    this.roomAlerted=true
    for(const enemy of this.enemies)if(enemy.alive)enemy.alert()
  }

  /** 在指定坐标刷怪；房间已警戒或显式指定 alert 时立即锁定玩家。 */
  spawnEnemyAt(id: ScriptedSpawn['id'], x: number, y: number, burrow = false, alert = false): void {
    const e = new Enemy(x, y, id)
    if (burrow) e.startBurrowSpawn()
    if (alert||this.roomAlerted) e.alert()
    this.enemies.push(e)
  }

  /**
   * 调试专用：在指定坐标生成一只 100000 血蓝史莱姆（伤害测试靶子）。
   * 不计入 enemyTotal，已清场房间不会因它重新锁门；只允许开发者控制台调用。
   */
  debugSpawnDummy(x: number, y: number): void {
    const e = new Enemy(x, y, SLIME_BLUE_ID)
    e.debugSetMaxHp(100000)
    e.alert()
    this.enemies.push(e)
    this.fx.chips(x, y, '#8fc8f5', 12, 200)
    this.fx.damageText(x, y - 30, '调试史莱姆 · 100000', '#9fd6ff')
  }

  /** 注册地面物品站立物（F 拾取：slot 给出则直接装备，否则入背包；extras 同次一并入手） */
  addItemInteractable(
    x: number,
    y: number,
    item: ItemInteractData['item'],
    opts: {
      qty?: number
      slot?: ItemInteractData['slot']
      range?: number
      hint?: string
      ref?: string
      extras?: Array<{ item: ItemInteractData['item']; qty?: number; slot?: ItemInteractData['slot'] }>
    } = {}
  ): Interactable {
    const qty = opts.qty ?? 1
    const it: Interactable = {
      id: this.interactSeq++,
      kind: 'item',
      x,
      y,
      range: opts.range ?? 46,
      hint: opts.hint ?? t('game.interact.pick_hint', { name: itemName(item) }),
      oneShot: true,
      done: false,
      ref: opts.ref,
      data: {
        item,
        qty,
        slot: opts.slot,
        extras: opts.extras?.map((e) => ({ item: e.item, qty: e.qty ?? 1, slot: e.slot }))
      } satisfies ItemInteractData
    }
    this.interactables.push(it)
    return it
  }

  /** 注册宝箱（F 开启 → 按战利品表掉出磁吸物；开过的箱子留开盖外形） */
  addChestInteractable(x: number, y: number, table: string = CHEST_BASIC_TABLE): Interactable {
    const it: Interactable = {
      id: this.interactSeq++,
      kind: 'chest',
      x,
      y,
      range: 46,
      hint: t('game.interact.chest_hint'),
      oneShot: false,
      done: false,
      data: { table } satisfies ChestInteractData
    }
    this.interactables.push(it)
    return it
  }

  /** 注册导演专用交互点（行为完全由 RoomHost.onInteract 回调决定） */
  addSpecialInteractable(x: number, y: number, range: number, ref: string, hint: string | null = null): Interactable {
    const it: Interactable = { id: this.interactSeq++, kind: 'special', x, y, range, hint, oneShot: true, done: false, ref }
    this.interactables.push(it)
    return it
  }

  /** 开放/关闭手动火把的 F 点火（序章导演在清怪后的 S3 教学开放） */
  setTorchesEnabled(v: boolean): void {
    this.torchesEnabled = v
  }

  /** 追加参与全屋 y-sort 的剧情实体（灵梦 NPC 等；每帧 draw(ctx, time)） */
  addSortable(y: number, draw: (ctx: CanvasRenderingContext2D, time: number) => void): void {
    this.extraSortables.push({ y, draw })
  }

  /**
   * 追加剧情自定义光源（序章基地篝火）：
   * flicker=true 时功率随时间 ±10% 暖焰呼吸；光源在房间存活期常驻。
   */
  addCustomLight(x: number, y: number, r: number, power: number, color = '#ff9a3c', tint = 0.18, flicker = true): void {
    this.customLights.push({ x, y, r, power, color, tint, flicker })
  }

  /**
   * 解封剧情出口（序章基地东门）：封印红门转绿色旋涡、打开门洞供玩家踏入。
   * 由导演在营地对白全部结束后调用。
   */
  openStoryExit(): void {
    const d = this.doors.find((x) => x.storyExit)
    if (!d || d.open) return
    d.open = true
    if (this.map.openDoor(d.col, d.row)) {
      sfx.doorOpen()
      const cx = d.col * CONFIG.tile + CONFIG.tile / 2
      const cy = d.row * CONFIG.tile + CONFIG.tile / 2
      this.fx.burst(cx, cy, -Math.PI / 2, 10)
    }
  }

  /**
   * 导演手动宣告清场（spec.manualClear 房间用）：
   * 翻 cleared 牌（环境档 dim→lit 渐变亮起来）+ 火把错峰点燃 + 解封各门 + 净化弹幕。
   * 节拍由导演掌控——清场台词念完再调用，"先说话、后亮灯开门"。
   */
  storyClear(): void {
    if (this.cleared) return
    this.cleared = true
    this.bullets = []
    if (!this.manualTorch) {
      this.litStart = this.time
      sfx.torchIgnite()
    }
    this.setDoorsOpen(true)
    if (this.enemyTotal > 0) sfx.roomClear()
  }

  /** 门控：强制开/关全部门（剧情锁门/解封；关门用于"进房即锁"演出） */
  setDoorsOpen(open: boolean, quiet = false): void {
    for (const d of this.doors) {
      if (open) {
        if (this.map.openDoor(d.col, d.row)) {
          d.open = true
          if (!quiet) {
            sfx.doorOpen()
            const cx = d.col * CONFIG.tile + CONFIG.tile / 2
            const cy = d.row * CONFIG.tile + CONFIG.tile / 2
            this.fx.burst(cx, cy, -Math.PI / 2, 10)
          }
        }
      } else {
        if (d.open && this.map.closeDoor(d.col, d.row)) d.open = false
      }
    }
  }

  /**
   * 梦想封印·棱镜五连爆请求：房间内随机采 5 个互不重叠的大范围爆点，
   * 首爆在下次 update 当帧引爆，其后每 0.3 秒一爆；爆点 AOE 静默灭怪，
   * 末爆兜底全屏残血怪。震屏/灭怪在 update 内取 engine 执行。
   */
  requestPrismaticSeal(): void {
    const { bounds, tile } = this.map
    const pad = tile * 2.5
    const pts: Array<{ x: number; y: number }> = []
    for (let i = 0; i < 5; i++) {
      let p: { x: number; y: number } | null = null
      for (let tries = 0; tries < 60; tries++) {
        const x = bounds.left + pad + Math.random() * (bounds.right - bounds.left - pad * 2)
        const y = bounds.top + pad + Math.random() * (bounds.bottom - bounds.top - pad * 2)
        if (this.map.solidAtWorld(x, y)) continue
        if (pts.some((q) => Math.hypot(q.x - x, q.y - y) < PRISMA_R * 1.05)) continue
        p = { x, y }
        break
      }
      // 兜底：房间内椭圆均布（极端采样失败也保证五点均匀炸开）
      if (!p) {
        const a = (i / 5) * Math.PI * 2
        p = {
          x: (bounds.left + bounds.right) / 2 + Math.cos(a) * 260,
          y: (bounds.top + bounds.bottom) / 2 + Math.sin(a) * 190
        }
      }
      pts.push(p)
    }
    this.prismaPoints = pts
    this.prismaBlasts = []
    this.prismaClock = 0
    this.prismaArmed = true
  }

  /** 引爆第 i 个棱镜爆点：混色光团 + AOE 静默灭怪 + 轻震屏 + 按方位的爆破音 */
  private detonatePrisma(i: number, engine: EngineContext): void {
    const p = this.prismaPoints[i]
    if (!p) return
    const palette = PRISMA_PALETTES[i % PRISMA_PALETTES.length]
    this.prismaBlasts.push({
      x: p.x,
      y: p.y,
      r: PRISMA_R,
      t: 0,
      dur: 0.85,
      colors: palette,
      seed: Math.random() * Math.PI * 2
    })
    // AOE 内静默灭怪（碎粒反馈，但不掉饭团/不走击杀经验/不计数）
    for (const e of this.enemies) {
      if (!e.canBeHit) continue
      if (Math.hypot(e.x - p.x, e.y - p.y) > PRISMA_R * 0.92) continue
      const ang = Math.atan2(e.y - p.y, e.x - p.x)
      e.takeDamage(99999, ang, 240, 0.35)
      this.fx.chips(e.x, e.y, palette[0], 7, 210)
      this.fx.chips(e.x, e.y, palette[2], 6, 190)
      this.fx.chips(e.x, e.y, '#ffffff', 5, 160)
    }
    // 末爆兜底：残余怪在各自位置湮灭（防止边缘漏网怪拖慢剧情）
    if (i === 4) {
      for (const e of this.enemies) {
        if (!e.canBeHit) continue
        e.takeDamage(99999, 0, 120, 0.2)
        this.fx.chips(e.x, e.y, '#ffffff', 8, 180)
        this.fx.chips(e.x, e.y, palette[1], 6, 160)
      }
    }
    // 光团位置的彩色碎粒花
    this.fx.chips(p.x, p.y, palette[0], 8, 260)
    this.fx.chips(p.x, p.y, palette[1], 8, 230)
    this.fx.chips(p.x, p.y, palette[2], 8, 200)
    this.bullets = []
    // 轻白闪（五爆各自一闪，幅度小、不盖过彩色光团本体）
    this.sealFlash = 0.26
    this.sealFlashDur = 0.26
    engine.shake(0.22)
    // I 版完整五连爆由首爆统一调度，音频时钟保持 0.3 秒间隔，避免重复叠播旧音。
    if (i === 0) {
      const cx = (this.map.bounds.left + this.map.bounds.right) / 2
      sfx.dreamSeal(this.prismaPoints.map(point => Math.max(-1, Math.min(1, (point.x - cx) / 360))))
    }
  }

  /** 导演复活玩家后复位死亡边沿（否则再次倒下不再通知） */
  reviveReset(): void {
    this.deathNotified = false
  }

  /** 剧情冻结开关（灵梦聚气对白期间：怪群不行动/无接触伤害；玩家输入由模块层冻结） */
  freezeEnemies(on: boolean): void {
    this.enemiesFrozen = on
  }

  /** 剧情用世界坐标火花（破门演出等） */
  fxBurstDoor(x: number, y: number): void {
    this.fx.burst(x, y, -Math.PI / 2, 14)
    this.fx.chips(x, y, '#8a7a6b', 8, 160)
  }

  /** 单根火把点燃进度 0~1（手动模式查点燃时刻表；自动模式走全局 litStart） */
  private torchLitProgress(tr: TorchSlot): number {
    if (this.manualTorch) {
      const at = this.litTorchAt.get(tr.index)
      if (at === undefined) return 0
      const p = (this.time - at) / CONFIG.art.torch.igniteDur
      return Math.max(0, Math.min(1, p))
    }
    return torchProgress(this.time, this.litStart, tr.index)
  }

  /** 点燃指定序号火把（已点燃返回 false）；同步光源/火苗即刻生效 */
  private lightTorch(index: number): boolean {
    if (this.litTorchAt.has(index)) return false
    this.litTorchAt.set(index, this.time)
    const tr = this.torches.find((x) => x.index === index)
    if (tr) {
      const p = torchLightPos(tr)
      this.fx.burst(p.x, p.y - 6, -Math.PI / 2, 10)
    }
    sfx.torchIgnite()
    return true
  }

  /** 每帧刷新最近交互物提示，并在 F 按下时结算（item/torch/chest 内置；special 回调导演） */
  private updateInteractables(player: Player, input: RoomInput, host: RoomHost): void {
    let nearest: Interactable | null = null
    let nearestDistanceSq = Infinity
    for (const it of this.interactables) {
      if (it.done) continue
      // 已点燃的火把不再可交互（视觉提示也消失）
      if (it.kind === 'torch') {
        const idx = (it.data as { index: number }).index
        if (this.litTorchAt.has(idx)) {
          it.done = true
          continue
        }
        // 剧情门控：导演未开放点火前，火把不进可选目标（也不显示提示）
        if (!this.torchesEnabled) continue
      }
      const dx = it.x - player.x, dy = it.y - player.y
      const distanceSq = dx * dx + dy * dy
      if (it.range >= 0 && distanceSq <= it.range * it.range && distanceSq < nearestDistanceSq) {
        nearest = it
        nearestDistanceSq = distanceSq
      }
    }
    let gather: NatureGather | null = null
    let gatherDistanceSq = 65 * 65
    if (this.nature) for (const point of this.nature.gathers) {
      if (point.done) continue
      const dx = point.x - player.x, dy = point.y - player.y
      const distanceSq = dx * dx + dy * dy
      if (distanceSq < gatherDistanceSq) { gather = point; gatherDistanceSq = distanceSq }
    }
    if(this.wrecks&&this.wreckSearchAllowed){
      const wreck=this.wrecks.all.filter(w=>!w.done&&Math.hypot(w.x-player.x,w.y-player.y)<74).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y))[0]
      if(wreck&&Math.hypot(wreck.x-player.x,wreck.y-player.y)**2<Math.min(nearestDistanceSq,gather?gatherDistanceSq:Infinity)){
        this.nearbyInteractable={id:-2,kind:'special',x:wreck.x,y:wreck.y,range:74,hint:t('game.interact.wreck_hint'),oneShot:true,done:false}
        if(input.interactPressed){
          if(wreck.parts&&host.inventory.add(OLD_FURNACE_PARTS_ID,1)===0){this.fx.damageText(player.x,player.y-24,t('game.notify.bag_full'),'#d2cba2');return}
          wreck.done=true;sfx.pickup();host.onFurnaceSearch?.(wreck.parts)
          this.wreckSearchAllowed=host.furnaceSearchAllowed?.()??false
        }
        return
      }
    }
    if(gather && gatherDistanceSq < nearestDistanceSq){
      this.nearbyInteractable={id:-1,kind:'special',x:gather.x,y:gather.y,range:65,hint:t('game.interact.gather_hint',{name:itemName(gather.item)}),oneShot:false,done:false}
      if(input.interactPressed){const added=host.inventory.add(gather.item,gather.qty);gather.qty-=added;gather.done=gather.qty===0;if(added){this.fx.pickupText(gather.item,added,'#d2cba2');sfx.pickup()}else this.fx.damageText(player.x,player.y-24,t('game.notify.bag_full'),'#d2cba2')}
      return
    }
    this.nearbyInteractable = nearest
    if (!input.interactPressed || !nearest) return

    const it = nearest
    if (it.kind === 'item') {
      const data = it.data as ItemInteractData
      let grantedQty = 0
      // 单件结算：slot 直装，否则入背包；返回是否成功（静默＝不弹满包提示，附带件用）
      const grant = (g: { item: ItemInteractData['item']; qty: number; slot?: ItemInteractData['slot'] }, silent: boolean): boolean => {
        if (g.slot) {
          const equipped = host.equipItem?.(g.slot, g.item) ?? false
          if (!silent && equipped) grantedQty = 1
          return equipped
        }
        const added = host.inventory.add(g.item, g.qty)
        if (!silent) grantedQty = added
        if (added > 0) return true
        if (!silent) this.fx.damageText(player.x, player.y - 26, t('game.notify.bag_full'), '#ff9a7a')
        return false
      }
      if (!grant(data, false)) return
      // 附带件安静入包（序章火柴：叙事物品，不抢飘字）
      for (const e of data.extras ?? []) grant(e, true)
      it.done = true
      sfx.pickup()
      this.fx.burst(it.x, it.y, -Math.PI / 2, 6)
      this.fx.pickupText(data.item, grantedQty, '#ffe9a8')
      host.onInteract?.(it)
    } else if (it.kind === 'torch') {
      const idx = (it.data as { index: number }).index
      if (this.lightTorch(idx)) {
        it.done = true
        host.onInteract?.(it)
      }
    } else if (it.kind === 'chest') {
      if (this.openChest(it, player, host)) host.onInteract?.(it)
    } else {
      // special：只回调，行为（对话/开门/转阶段）完全由导演定义
      if (it.oneShot) it.done = true
      host.onInteract?.(it)
    }
  }

  /** 开宝箱：按战利品表 roll 产物并从箱口抛为磁吸掉落；返回是否成功开启 */
  private openChest(it: Interactable, _player: Player, _host: RoomHost): boolean {
    if (it.done) return false
    it.done = true
    const data = it.data as ChestInteractData
    const loot = rollLoot(data.table)
    if (loot.length === 0) {
      this.fx.damageText(it.x, it.y - 24, t('game.notify.chest_empty'), '#c2c8d0')
      return true
    }
    for (const drop of loot) {
      // 构造即自带随机崩落抛射；随后走普通磁吸拾取（满包会弹回，不会丢奖励）
      for (let i = 0; i < drop.qty; i++) this.drops.push(new Drop(it.x, it.y, drop.item))
    }
    sfx.pickup()
    this.fx.burst(it.x, it.y - 8, -Math.PI / 2, 14)
    this.fx.damageText(it.x, it.y - 28, t('game.notify.chest'), '#ffd76a')
    return true
  }

  /** 五秒一批增援；三十秒只解封和点灯，不清理敌人或弹幕。 */
  private updateSurvival(dt:number,player:Player):void{
    this.survivalElapsed=Math.min(30,this.survivalElapsed+dt)
    while(this.survivalWave<5&&this.survivalElapsed>=(this.survivalWave+1)*5){
      this.survivalWave++
      const count=Math.random()<1/3?1:2,{left,right,top,bottom}=this.map.bounds
      for(let n=0;n<count;n++){
        const id=rollEnemyId('normal',this.def.depth,this.def.floor??1);if(!id)continue
        const definition=enemies.require(id),radius=definition.radius+3
        let point:{x:number;y:number}|null=null
        for(let tries=0;tries<160;tries++){
          const x=left+radius+Math.random()*(right-left-radius*2),y=top+radius+Math.random()*(bottom-top-radius*2)
          if(Math.hypot(x-player.x,y-player.y)<110||this.enemies.some(e=>e.alive&&Math.hypot(e.x-x,e.y-y)<e.r+radius+12)||this.props.some(p=>circleHitsProp(x,y,radius,p))||this.wrecks?.colliders.some(p=>circleHitsProp(x,y,radius,p)))continue
          if([[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]].some(([dx,dy])=>this.map.solidAtWorld(x+dx!,y+dy!)))continue
          point={x,y};break
        }
        if(!point)continue
        const kind=definition.movement==='stationary'?'burrow':definition.movement==='flying'?'ceiling':Math.random()<.5?'burrow':'ceiling'
        const enemy=new Enemy(point.x,point.y,id);enemy.startEncounterSpawn(kind);enemy.alert();this.enemies.push(enemy);this.enemyTotal++
        if(kind==='burrow')sfx.burrowWarn(Math.max(-.7,Math.min(.7,(point.x-player.x)/430)))
      }
    }
    if(this.survivalElapsed>=30){
      this.survivalComplete=true;this.litStart=this.time;sfx.torchIgnite();sfx.roomClear()
      for(const door of this.doors){this.map.openDoor(door.col,door.row);door.open=true}
      sfx.doorOpen();this.fx.damageText(player.x,player.y-45,t('game.survival.open'),'#dfc897')
    }
  }

  /** 敌人落位（避开实心瓦片、出生点、彼此重叠）；种类按注册表权重混编 */
  private spawnEnemies(spawnX: number, spawnY: number): void {
    const { bounds, tile } = this.map
    // 刷怪只认内容注册表：加新怪在 Def 写 spawn.weight 即可，本函数零改动
    const depth = this.def.depth ?? 0
    const fixed=this.script?[]:fixedEnemyIds(this.def.kind,this.def.floor??1)
    const valid=(x:number,y:number):boolean=>{
      if(Math.hypot(x-spawnX,y-spawnY)<180||this.props.some(p=>circleHitsProp(x,y,24,p)))return false
      if(this.enemies.some(e=>Math.hypot(e.x-x,e.y-y)<50))return false
      return [[0,0],[-24,-24],[-24,24],[24,-24],[24,24]].every(([dx,dy])=>!this.map.solidAtWorld(x+dx!,y+dy!))
    }
    for (let n = 0; n < this.enemyTotal; n++) {
      let x = spawnX
      let y = spawnY
      let ok = false
      for (let tries = 0; tries < 300; tries++) {
        x = bounds.left + tile + Math.random() * (bounds.right - bounds.left - tile * 2)
        y = bounds.top + tile + Math.random() * (bounds.bottom - bounds.top - tile * 2)
        if(!valid(x,y))continue
        ok = true
        break
      }
      if (!ok) {
        // 随机落位失败时遍历内部地面，固定精英也不能卡在矿石或大型摆件里。
        search:for(let yy=bounds.top+tile;yy<bounds.bottom-tile;yy+=tile)for(let xx=bounds.left+tile;xx<bounds.right-tile;xx+=tile){
          if(valid(xx,yy)){x=xx;y=yy;ok=true;break search}
        }
      }
      const enemyId = n<fixed.length?fixed[n]:rollEnemyId(this.def.kind, depth,this.def.floor??1)
      if (enemyId) this.enemies.push(new Enemy(x, y, enemyId))
    }
  }

  /**
   * 矿脉崩落 → 碎块掉落物。
   * - 岩包态（普通灰岩）：保底 1 个石料，33% 额外 1 个；真藏矿保底 1 个矿，11% 额外 1 个。
   * - 显矿态：必掉 1 个矿，33% 概率额外掉 1 个，所有矿种共用配置。
   */
  private spawnOreDrops(
    col: number,
    row: number,
    ore: Pick<OreTile, 'kind' | 'vein' | 'hasOre' | 'offsetX' | 'offsetY'>
  ): void {
    const cx = col * CONFIG.tile + CONFIG.tile / 2 + ore.offsetX
    const cy = row * CONFIG.tile + CONFIG.tile / 2 + ore.offsetY
    // 矿物包被移除等异常情况下容错：没有 Def 就不掉矿（石料是独立物品不受影响）
    const mineral = findMineralDef(ore.kind)
    if(mineral?.visual.form==='salt'){
      this.drops.push(new Drop(cx,cy,ROCK_STONE_ID),new Drop(cx,cy,mineral.dropItemId))
      if(Math.random()<.2)this.drops.push(new Drop(cx,cy,mineral.dropItemId))
      return
    }
    if (ore.vein === 'rock') {
      const rockN = CONFIG.mine.rockDrop + (Math.random() < CONFIG.mine.rockBonusChance ? 1 : 0)
      for (let i = 0; i < rockN; i++) {
        this.drops.push(new Drop(cx, cy, ROCK_STONE_ID))
      }
      if (ore.hasOre && mineral && findItemDef(mineral.dropItemId)) {
        const oreN = 1 + (Math.random() < CONFIG.mine.rockOreBonusChance ? 1 : 0)
        for (let i = 0; i < oreN; i++) {
          this.drops.push(new Drop(cx, cy, mineral.dropItemId))
        }
      }
      return
    }
    if (!mineral || !findItemDef(mineral.dropItemId)) return
    // 显矿数量按共用权重表摇号：1 个 67% / 2 个 33%。
    let n = CONFIG.mine.veinYield[0]?.[0] ?? 1
    const roll = Math.random()
    let acc = 0
    for (const [count, weight] of CONFIG.mine.veinYield) {
      acc += weight
      if (roll < acc) { n = count; break }
    }
    for (let i = 0; i < n; i++) {
      this.drops.push(new Drop(cx, cy, mineral.dropItemId))
    }
  }

  /**
   * 敲碎矿脉低概率惊动土里的怪：
   * 落点以矿格为中心 5×5 格内选可通行点，且强制距玩家 ≥ burstMinPlayerDist
   * （绝不爆在玩家脚下）；出生先走裂土预警 + 钻出流程（Enemy.emergeT，
   * 期间不造成接触伤害/不行动），杜绝零帧起手。
   */
  private burstEnemyFromOre(col: number, row: number, player: { x: number; y: number }): void {
    const t = CONFIG.tile
    // 矿格碎后本身已是 floor，一并纳入候选
    const cand: { x: number; y: number; d: number }[] = []
    for (let dc = -2; dc <= 2; dc++) {
      for (let dr = -2; dr <= 2; dr++) {
        const x = (col + dc + 0.5) * t
        const y = (row + dr + 0.5) * t
        if (this.map.solidAtWorld(x, y)) continue
        cand.push({ x, y, d: Math.hypot(x - player.x, y - player.y) })
      }
    }
    if (cand.length === 0) return
    const far = cand.filter((c) => c.d >= CONFIG.mine.burstMinPlayerDist)
    const pick =
      far.length > 0
        ? far[Math.floor(Math.random() * far.length)] // 合格池随机取，落点不可预判
        : cand.reduce((a, b) => (b.d > a.d ? b : a)) // 兜底（贴脸挖矿）：取离玩家最远的点
    // 种类混编同样走注册表权重（房型/深度门控由 Def.spawn 声明）
    const enemyId = rollEnemyId(this.def.kind, this.def.depth ?? 0,this.def.floor??1)
    if (!enemyId) return
    const e = new Enemy(pick.x, pick.y, enemyId)
    e.startBurrowSpawn()
    if(this.roomAlerted)e.alert()
    this.enemies.push(e)
    this.fx.chips(pick.x, pick.y, '#8a7a6b', 12, 200)
    this.fx.damageText(pick.x, pick.y - 16, '！', '#ffd28a')
    // 碎矿声尾后再起裂土预警（声像＝怪点相对玩家方位）；破土音由 Enemy 钻出边沿播
    const warnPan = Math.max(-1, Math.min(1, (pick.x - player.x) / 300)) * 0.7
    sfx.burrowWarn(warnPan, 0.1)
  }

  private pushOutCircle(e: {x:number;y:number;vx:number;vy:number}, cx: number, cy: number, minDist: number): void {
    if (!Number.isFinite(minDist) || !Number.isFinite(cx) || !Number.isFinite(cy)) return
    let dx = e.x - cx
    let dy = e.y - cy
    const d = Math.hypot(dx, dy)
    let nx: number
    let ny: number
    if (d > 0.0001) {
      nx = dx / d
      ny = dy / d
    } else {
      const sp = Math.hypot(e.vx, e.vy)
      if (sp > 1) {
        nx = -e.vx / sp
        ny = -e.vy / sp
      } else {
        nx = 1
        ny = 0
      }
    }
    if (d >= minDist) return
    const tx = e.x + nx * (minDist - d)
    const ty = e.y + ny * (minDist - d)
    if (this.map.solidAtWorld(tx, ty)) return
    e.x = tx
    e.y = ty
    const vn = e.vx * nx + e.vy * ny
    if (vn < 0) {
      e.vx -= vn * nx
      e.vy -= vn * ny
    }
  }

  /** 动态木材与宝箱保留同一个碰撞对象；移动时同步锚点，破坏后不再加入工作区。 */
  private resourceCollider(source: { x: number; y: number }, chest: boolean): Prop {
    let collider = this.resourceColliders.get(source)
    if (!collider) {
      collider = {
        id: PROP_LOGS_ID, x: source.x, y: source.y, s: 1, seed: 0,
        halfWidth: chest ? 17 : 25, halfThick: chest ? 4 : 5, blockBullets: false
      }
      this.resourceColliders.set(source, collider)
    }
    collider.x = source.x; collider.y = source.y + (chest ? 10 : 0)
    return collider
  }

  private refreshCollisionProps(): void {
    this.collisionProps.length = 0
    this.bulletBlockers.length = 0
    for (const prop of this.props) this.collisionProps.push(prop)
    if(this.wrecks)for(const collider of this.wrecks.colliders)this.collisionProps.push(collider)
    if (this.nature) for (const wood of this.nature.wood) {
      if (wood.hp > 0) this.collisionProps.push(this.resourceCollider(wood, false))
    }
    // 已开盖的宝箱仍有实体占地，沿用原有碰撞规则。
    for (const item of this.interactables) {
      if (item.kind === 'chest') this.collisionProps.push(this.resourceCollider(item, true))
    }
    for (const prop of this.collisionProps) {
      if (propBlocksBullets(prop)) for (const band of propBands(prop)) this.bulletBlockers.push(band)
    }
  }

  /**
   * @param dt 世界逻辑 dt（命中顿帧期间为 0：敌人/弹幕/掉落/特效/环境全部冻结）
   * @param playerDt 玩家时钟 dt（顿帧期间仍为真实帧时间：攻速、移动、闪避不被冻结）
   */
  update(dt: number, engine: EngineContext, player: Player, input: RoomInput, host: RoomHost, playerDt: number = dt): void {
    this.time += dt
    for (const effect of this.weaponImpacts) effect.age += dt
    this.weaponImpacts = this.weaponImpacts.filter(effect => effect.age < effect.duration)
    this.wreckSearchAllowed=host.furnaceSearchAllowed?.()??false
    if(this.def.encounter==='survival'&&!this.survivalComplete&&player.alive)this.updateSurvival(dt,player)
    this.warp.update(dt)
    this.fog.update(dt)
    const map = this.map
    this.steam.update(dt)

    // 脚本延迟刷怪到期（破门怪演出）
    if (this.pendingSpawns.length) {
      const rest: ScriptedSpawn[] = []
      for (const sp of this.pendingSpawns) {
        const left = (sp.delay ?? 0) - dt
        if (left <= 0) {
          this.spawnEnemyAt(sp.id, sp.x, sp.y, sp.burrow === true, this.script?.aggressive === true)
          this.fx.chips(sp.x, sp.y, '#8a7a6b', 10, 180)
        } else {
          rest.push({ ...sp, delay: left })
        }
      }
      this.pendingSpawns = rest
    }

    // 梦想封印·棱镜五连爆：首爆当帧引爆，其后每 0.3s 一爆，末爆后留 1 秒尾光
    if (this.prismaArmed) {
      this.prismaArmed = false
      this.detonatePrisma(0, engine)
    }
    if (this.prismaClock >= 0) {
      const before = this.prismaClock
      this.prismaClock += dt
      const from = Math.floor(before / PRISMA_GAP) + 1
      const to = Math.min(4, Math.floor(this.prismaClock / PRISMA_GAP))
      for (let i = from; i <= to; i++) this.detonatePrisma(i, engine)
      if (this.prismaClock > PRISMA_GAP * 4 + 1) this.prismaClock = -1
    }
    for (const b of this.prismaBlasts) b.t += dt
    this.prismaBlasts = this.prismaBlasts.filter((b) => b.t < b.dur)
    if (this.sealFlash > 0) this.sealFlash = Math.max(0, this.sealFlash - dt)

    // J 批次：玩家/敌人均受摆件薄横线阻挡（弹幕 b.update 与掉落物 drop.update 不接 props）
    // 自然环境废木（存活时）与未回收宝箱复用同一套薄胶囊：halfWidth/halfThick 按实际外观给值
    this.refreshCollisionProps()
    const solidProps = this.collisionProps
    // 弹幕掩体仅包含声明挡弹的大件，动态资源点显式保持不挡弹。
    const bulletBlockers = this.bulletBlockers
    // 玩家时钟独立：命中顿帧冻结世界时，玩家的攻速/移动/闪避照常推进
    player.update(playerDt, input, map, solidProps)
    for (const effect of player.drainWeaponImpacts()) {
      this.weaponImpacts.push(effect)
      if (effect.shake) engine.shake(effect.shake)
    }
    updateBoomerang(player, playerDt, map, solidProps, this.enemies, (enemy, damage, critical) => {
      this.fx.burst(enemy.x, enemy.y, player.rangedFlight?.angle ?? 0)
      this.fx.combatDamage(enemy.x, enemy.y-18, damage, 'physical', critical)
      sfx.meleeHit(enemy.hitMaterial)
      if (!enemy.alive) this.onEnemyKilled(enemy, host)
    })
    player.tarot.updateFlights(playerDt, player, this.enemies, { left: 0, top: 0, right: map.cols * map.tile, bottom: map.rows * map.tile }, (enemy, result) => {
      this.fx.burst(enemy.x, enemy.y, player.facing, 5)
      // 混合攻击分别展示分量，合计等于实际扣血，过量伤害不冒出虚高数字。
      const total = result.physical + result.magic + result.trueDamage
      const parts = [{ kind: 'physical' as const, amount: result.physical }, { kind: 'magic' as const, amount: result.magic }, { kind: 'true' as const, amount: result.trueDamage }].filter(part => part.amount > 0)
      if (!parts.length) this.fx.combatDamage(enemy.x, enemy.y - 18, 0, 'physical')
      parts.forEach((part, i) => this.fx.combatDamage(enemy.x, enemy.y - 18 - i * 22, part.amount * result.damage / total, part.kind, result.critical))
      sfx.meleeHit(enemy.hitMaterial)
      if (!enemy.alive) this.onEnemyKilled(enemy, host)
    })
    player.bow.updateFlights(playerDt,map,this.bulletBlockers,this.enemies,(enemy,damage,critical)=>{
      this.fx.burst(enemy.x,enemy.y,player.facing,5);this.fx.combatDamage(enemy.x,enemy.y-18,damage,'physical',critical);sfx.meleeHit(enemy.hitMaterial)
      if(!enemy.alive)this.onEnemyKilled(enemy,host)
    })
    this.doomsday.update(dt, player, input.specialPressed, engine, host)

    // 敌人 AI + 收集开火请求（毒液史莱姆两种弹幕节拍）
    // 封印聚气/剧情冻结期间全体停止行动（不开火，为灵梦争取那一瞬）
    for (const e of this.enemies) {
      // 剧情冻结（封印对白/连爆演出）期间全体停止行动（不开火）
      if (this.enemiesFrozen && e.alive) continue
      e.update(dt, map, player, solidProps, this.enemies)
      if (!e.alive) continue
      for (const shot of e.drainShots()) {
        // 吐弹声像跟随怪相对玩家方位（暗房里能"听声辨位"）
        const shotPan = Math.max(-1, Math.min(1, (e.x - player.x) / 300)) * 0.7
        if (shot.kind === 'straight') {
          // 瞄准玩家当前位置的直线弹（弹种由 AI 请求携带）
          const ang = shot.angle ?? Math.atan2(player.y - e.y, player.x - e.x)
          this.bullets.push(
            new Projectile(
              shot.origin?.x ?? e.x + Math.cos(ang) * (e.r + 4),
              shot.origin?.y ?? e.y + Math.sin(ang) * (e.r + 4),
              ang,
              shot.projectileId
            )
          )
          sfx.enemyShoot('straight', shotPan)
        } else {
          // N 向圆形扩散（慢弹墙，数量由该怪 Def 声明）
          const n = e.ringCount
          for (let i = 0; i < n; i++) {
            const ang = (i / n) * Math.PI * 2 + this.time * 0.07
            this.bullets.push(new Projectile(e.x, e.y, ang, shot.projectileId))
          }
          sfx.enemyShoot('ring', shotPan)
        }
      }
    }

    // 怪 ↔ 玩家圆分离（出土中的怪钉在出生点，坑影不滑动；钻出后才参与推挤）
    // 间隔按玩家精瘦碰撞圆，敌人可以逼得更近（受击判定也同步缩小）
    if (player.alive) {
      for (const e of this.enemies) {
        if (!e.alive || e.emerging || e.def.tags?.includes('boss') || e.def.chargeCycle&&e.pounceState==='lunge') continue
        if(e.def.movement==='stationary'){this.pushOutCircle(player,e.x,e.y,e.r+player.collisionR);continue}
        this.pushOutCircle(e, player.x, player.y, e.r + player.collisionR)
      }
    }
    // 怪间分离
    for (let i = 0; i < this.enemies.length; i++) {
      const a = this.enemies[i]
      if (!a.alive || a.emerging) continue
      for (let j = i + 1; j < this.enemies.length; j++) {
        const b = this.enemies[j]
        if (!b.alive || b.emerging) continue
        if(a.def.movement==='stationary'){if(b.def.movement!=='flying')this.pushOutCircle(b,a.x,a.y,a.r+b.r);continue}
        if(b.def.movement==='stationary'){if(a.def.movement!=='flying')this.pushOutCircle(a,b.x,b.y,a.r+b.r);continue}
        if(a.def.movement!==b.def.movement||a.def.chargeCycle&&a.pounceState==='lunge'||b.def.chargeCycle&&b.pounceState==='lunge')continue
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        const min = a.r + b.r
        if (d < min && d > 0.0001) {
          const half = (min - d) / 2
          const nx = (a.x - b.x) / d
          const ny = (a.y - b.y) / d
          if (!map.solidAtWorld(a.x + nx * half, a.y + ny * half)) {
            a.x += nx * half
            a.y += ny * half
          }
          if (!map.solidAtWorld(b.x - nx * half, b.y - ny * half)) {
            b.x -= nx * half
            b.y -= ny * half
          }
        }
      }
    }

    // 接触伤害（倒下通知统一在弹幕结算后做边沿检查；冻结/聚气中怪无伤害）
    if (player.alive && !this.enemiesFrozen) {
      for (const e of this.enemies) {
        if (!e.tryHitPlayer(player, player.isInvincible)) continue
        const ang = Math.atan2(player.y - e.y, player.x - e.x)
        const dmg = e.contactDamage
        const hpBefore = player.hp
        player.takeHit(dmg, ang)
        const dealt = hpBefore - player.hp
        this.fx.chips(player.x, player.y, '#ff5a6e', 10, 150)
        this.fx.damageText(player.x, player.y - 20, `-${damageLabel(dealt)}`, '#ff7a8a')
        engine.shake(0.14)
        engine.hitStop(0.045)
      }
    }

    // 弹幕：位移/撞墙/撞大件掩体 + 命中玩家（无敌帧可穿弹）
    const bladeSweep = player.alive ? player.getProjectileErasure() : []
    const splitBullets: Projectile[] = []
    for (const b of this.bullets) {
      const prevBulletX = b.x, prevBulletY = b.y
      b.update(dt, map, bulletBlockers)
      if (!b.dead && bladeSweep.length && bladeErasesProjectile(bladeSweep, b.x, b.y, b.r, prevBulletX, prevBulletY)) {
        b.dead = true; this.fx.chips(b.x, b.y, '#ddc5bc', 4, 70); continue
      }
      // 高速弹与曲线弹按整段实际轨迹判定，撞到玩家后方墙壁也不能漏掉途中命中。
      let hitPlayer = false
      if (player.alive && !player.isInvincible && b.canTouch && b.touchesCircle(player.x, player.y, player.collisionR)) {
        hitPlayer = true
        b.dead = true
        const hpBefore = player.hp
        player.takeHit(b.damage, b.angle, 'magic', true)
        if(player.alive&&player.hp<hpBefore&&b.onHitStatus)player.effects.add(b.onHitStatus,b.onHitStatus.id)
        this.fx.chips(player.x, player.y, '#8de05f', 10, 160)
        this.fx.damageText(player.x, player.y - 20, `-${damageLabel(hpBefore-player.hp)}`, '#a8ec78')
        engine.shake(0.12)
      }
      if (b.dead) {
        if (hitPlayer) continue
        if (b.hitProp) {
          // 撞在掩体上：一小簇锈色火花，不播湿溅声
          this.fx.chips(b.x, b.y, '#c08a4e', 5, 120)
        } else {
          // 撞墙/寿终湮灭：一声湿溅（命中玩家的湮灭走下方分支，不重复）
          const splatPan = Math.max(-1, Math.min(1, (b.x - player.x) / 300)) * 0.7
          sfx.bulletSplat(splatPan)
        }
        continue
      }
      if (b.hasPendingSplit) splitBullets.push(...b.drainSplit())
    }
    compactInPlace(this.bullets, b => !b.removed)
    this.bullets.push(...splitBullets)

    // 玩家倒下（接触/弹幕两路都可能造成）→ 先问剧情层是否接管，否则边沿通知一次
    if (!player.alive && !this.deathNotified) {
      this.deathNotified = true
      if (host.onPlayerDowned?.() !== true) {
        host.onPlayerDied()
        return // 归零当帧也不再拾取或继续结算战斗。
      }
    }

    // 尸体清理
    compactInPlace(this.enemies, e => !e.removed)

    // 掉落物：贴身请求拾取 → 背包确认入包 / 满包弹回
    for (const drop of this.drops) {
      if (!drop.update(dt, map, player)) continue
      if (host.inventory.add(drop.itemId, 1) > 0) {
        drop.confirm()
        host.onItemFound?.(drop.itemId)
        sfx.pickup()
        const def = getItemDef(drop.itemId)
        this.fx.burst(drop.x, drop.y, -Math.PI / 2, 5)
        this.fx.pickupText(drop.itemId, 1, def.text)
      } else {
        // 背包已满：从玩家身边弹开并给提示
        drop.reject(player.x, player.y)
        this.fx.damageText(player.x, player.y - 26, t('game.notify.bag_full'), '#ff9a7a')
      }
    }
    compactInPlace(this.drops, d => !d.isCollected)

    // 挥镐双目标判定
    const swing = player.getSwing()
    if (swing && player.swingPhase === 'active') {
      this.resolveSwingHits(engine, player, host)
    }

    if(this.def.encounter==='survival'&&this.survivalComplete&&this.aliveEnemies===0)this.cleared=true
    // 清场 → 解封所有门 + 激活裂隙（延迟刷怪未出场不算清场；脚本房可禁止自动开门/点火）
    // startLocked 房（序章醒来黑房）的清场状态只能由脚本流程解除：初始 0 怪也不许在
    // 第一帧自动翻牌，否则光照会误切亮档——亮房里帽灯光圈消失、"好黑"的演出全毁
    if (
      !this.cleared &&
      this.def.encounter!=='survival' &&
      !this.script?.startLocked &&
      !this.script?.manualClear &&
      this.aliveEnemies === 0 &&
      this.pendingSpawns.length === 0
    ) {
      this.cleared = true
      // 手动火把房 / 显式抑制的脚本房：火把与门都交给导演
      if (!this.manualTorch && !this.script?.suppressAutoClear) {
        // 批次 E：火把从此刻起逐根错峰点燃（火星在下方统一检测）
        this.litStart = this.time
      }
      // 有怪的房间才播清场音（出生空房/奖励房进门不打扰）
      if (this.enemyTotal > 0) {
        sfx.roomClear()
        if (!this.manualTorch && !this.script?.suppressAutoClear) sfx.torchIgnite()
      }
      // 清场净化：场上残余毒液弹全部湮灭（安心捡矿/过门）
      this.bullets = []
      if (!this.script?.suppressAutoClear) {
        for (const d of this.doors) {
          if (this.map.openDoor(d.col, d.row)) {
            sfx.doorOpen()
            d.open = true
            const cx = d.col * CONFIG.tile + CONFIG.tile / 2
            const cy = d.row * CONFIG.tile + CONFIG.tile / 2
            this.fx.burst(cx, cy, -Math.PI / 2, 10)
          }
        }
      }
      if (this.fissure) {
        this.fissure.active = true
        this.fx.burst(this.fissure.x, this.fissure.y, -Math.PI / 2, 16)
        this.fx.damageText(this.fissure.x, this.fissure.y - 34, t('game.notify.fissure_active'), '#ffe27a')
      }
    }

    // 火把点燃仪式：每根跨过各自点燃时刻的当帧迸一簇火星
    if (this.litStart !== null && this.torches.length) {
      for (const tr of this.torches) {
        const at = this.litStart + tr.index * CONFIG.art.torch.stagger
        if (this.time - dt < at && this.time >= at) {
          const p = torchLightPos(tr)
          this.fx.burst(p.x, p.y - 6, -Math.PI / 2, 8)
        }
      }
    }

    // 踩门 → 切换房间
    if (player.alive) {
      const pc = map.worldToCol(player.x)
      const pr = map.worldToRow(player.y)
      for (const d of this.doors) {
        if (d.open && pc === d.col && pr === d.row) {
          // 剧情出口无对端房间：交导演转场（序章基地东门 → 正式第一层）
          if (d.storyExit) host.requestStoryExit?.(d.exitRef ?? 'storyExit')
          else host.requestDoor(d.doorId)
          break
        }
      }
      // 地面交互物：每帧选最近的可交互物给 HUD 提示，F 触发
      this.updateInteractables(player, input, host)
      // 裂隙交互
      if (
        input.interactPressed &&
        this.fissure?.active &&
        Math.hypot(this.fissure.x - player.x, this.fissure.y - player.y) < CONFIG.fissure.interactRange
      ) {
        host.requestExtract()
      }
    }

    // 符卡光脉演出推进（follow 的光波中心实时跟随玩家）+ 多波次到期触发
    for (const s of this.spellFx) {
      s.t += dt
      if (s.follow) {
        s.x = player.x
        s.y = player.y
      }
    }
    this.spellFx = this.spellFx.filter((s) => s.t < s.dur)
    for (const q of this.pendingSpellPulses) q.delay -= dt
    const duePulses = this.pendingSpellPulses.filter((q) => q.delay <= 0)
    this.pendingSpellPulses = this.pendingSpellPulses.filter((q) => q.delay > 0)
    // 第二波也以玩家当前位置为中心——光波始终绕身绽开
    for (const q of duePulses) this.fireSpellPulse(player.x, player.y, q.spellId, q.def, q.pulse, engine, host,q.damageBonus)

    map.update(dt)
    this.fx.setPickupAnchor(player.x, player.y)
    this.fx.update(dt)
  }

  /**
   * 挥击 active 窗口命中结算（数据驱动双形态）：
   * slash = 扇形扫掠；stab = 沿挥出方向的窄矩形长刺。敌人与矿脉各结算一次。
   */
  private resolveSwingHits(engine: EngineContext, p: Player, host: RoomHost): void {
    const swing = p.getSwing()
    if (!swing) return
    const { tile } = CONFIG
    const m = p.meleeMove
    if (!m) return
    const resource = p.activeToolId ? getItemDef(p.activeToolId).weapon : undefined
    const weaponHit = p.getWeaponHitTest()

    /** 角度差归一到 -π~π */
    const angleDiff = (dx: number, dy: number, base: number): number => {
      let d = Math.atan2(dy, dx) - base
      while (d > Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      return d
    }
    /** 戳刺胶囊段：把点投影到挥出方向坐标系，fwd 纵深 + side 横向加宽目标半径 */
    const inStab = (
      dx: number,
      dy: number,
      half: number,
      pad: number
    ): boolean => {
      const cos = Math.cos(swing.baseAngle)
      const sin = Math.sin(swing.baseAngle)
      const fwd = dx * cos + dy * sin
      const side = -dx * sin + dy * cos
      return fwd >= -pad && fwd <= m.reach + pad && Math.abs(side) <= half + pad
    }
    /** 目标是否落在本次挥击判定内 */
    const isHit = (dx: number, dy: number, dist: number, radius: number): boolean => {
      if (weaponHit) return weaponHit(p.x + dx, p.y + dy, radius)
      if (swing.shape === 'slash') {
        // 挥砍以实时 facing 为扇心（0.12s 判定窗内可微转追目标）
        return dist <= swing.reach + radius && Math.abs(angleDiff(dx, dy, resource?.lockAim ? swing.baseAngle : p.facing)) <= (m.arc ?? 0)
      }
      // 戳刺以起手瞬间方向为准，吃瞄准精度，换更远更窄
      return inStab(dx, dy, swing.stabWidth / 2, radius)
    }

    // 同一次挥击只播第一声命中（多目标时不连成机关枪）；击杀音由 onEnemyKilled 播
    let hitSounded = false
    // AOE 衰减：先收集本帧新命中的敌人，同帧受伤者按距玩家由近到远排序
    // （跨帧的先后由 p.swingHitCount 记录，天然排在前面）
    const frameHits: Array<{ e: Enemy; ang: number; dist: number }> = []
    for (const e of this.enemies) {
      // 埋在地下预警期刀砍不入；钻出中可被先手攻击
      if (!e.canBeHit || p.hitSet.has(e)) continue
      const dx = e.hitX - p.x
      const dy = e.hitY - p.y
      const dist = Math.hypot(dx, dy)
      if (!isHit(dx, dy, dist, e.hitRadius)) continue
      frameHits.push({ e, ang: Math.atan2(dy, dx), dist })
    }
    frameHits.sort((a, b) => a.dist - b.dist)
    if (frameHits.length > 0 && p.activeToolId === DOOMSDAY_ID && p.doomSwingEmpowered && !p.doomsdaySwingHit) {
      doomsdayHit(sfx, p.doomHitIndex)
      p.consumeDoomsdayStrike()
    }

    for (const { e, ang, dist } of frameHits) {
      // 单体攻击已命中后停止结算，跨帧也不能再次伤害、击退或僵直其他目标。
      if (m.aoe?.mode === 'none' && p.swingHitCount > 0) break
      // 伤害倍率由通用AOE组件计算，模式与保留比例集中在数值资源。
      const dmgMult = aoeMultiplier(m.aoe, p.swingHitCount)
      // 力量属性乘区先作用于招式基础伤害，再做 AOE 衰减
      const equipment = p.activeToolId ? getItemDef(p.activeToolId).combat : undefined
      const impact = meleeImpact(m, dist, equipment?.penetration ?? 0)
      const result = calculateDamage({base:impact.damage,attackPower:p.attackPower,damageBonus:p.outgoingDamageBonus+p.swingDamageBonus,
        coefficient:m.powerCoefficient ?? (m.windup+m.active+m.recover),
        resistance:m.damageKind === 'magic' ? e.def.combat.magicResist : e.def.combat.physicalResist,
        penetration:impact.penetration+p.equipmentCombat.penetration,critChance:(equipment?.critChance??0)+p.equipmentCombat.critChance,
        critMultiplier:resource?.criticalPassive?.multiplier,
        area:m.aoe?.mode!=='none'&&(m.shape==='slash'||!!m.aoe),aoeReduction:e.def.combat.aoeReduction,falloff:dmgMult*p.swingChargeMultiplier})
      const damage = result.damage
      p.hitSet.add(e)
      p.swingHitCount++
      e.takeDamage(damage, ang, (m.knockback ?? e.def.combat.knockback) + p.knockbackBonus, m.stun)
      if (e.alive) for (const effect of p.swingHitEffects) e.addStatus(effect, 'weapon:hit')
      if (e.alive && result.critical) for (const effect of resource?.criticalPassive?.effects ?? []) e.addStatus(effect, 'weapon:critical')
      this.fx.burst(e.x, e.y, ang)
      this.fx.combatDamage(e.x, e.y - 18, damage, m.damageKind ?? 'physical', result.critical)
      // 武器专属冲击仅在首个实际命中上播放，跨帧扫入多个目标也不重复叠音。
      if (resource?.hitSound && p.swingHitCount === 1) resource.hitSound(e.hitMaterial)
      if (!e.alive) {
        engine.shake(0.2)
        this.onEnemyKilled(e, host)
      } else {
        engine.shake(CONFIG.shakeOnHit)
        if (!hitSounded && !(p.activeToolId === DOOMSDAY_ID && p.doomSwingEmpowered)) {
          if (!resource?.hitSound) sfx.meleeHit(e.hitMaterial)
          hitSounded = true
        }
      }
      // 每次挥击只在首次命中时顿帧一次：后续目标与跨帧扫入的怪不再追加冻结
      if (!p.swingHitStopFired) {
        p.swingHitStopFired = true
        engine.hitStop(CONFIG.hitStopOnHit)
      }
    }

    // 矿脉门控：只有 kind='pick' 的手持物能挖矿（铁剑砍矿只磕碰不掉耐久）
    const toolId = p.activeToolId
    const canMine = toolId !== null && getItemDef(toolId).kind === 'pick'
    const efficiency = toolId ? getItemDef(toolId).miningEfficiency ?? 0 : 0

    for(const wood of this.nature?.wood ?? []){
      if(wood.hp<=0||p.hitSet.has(wood))continue
      const dx=wood.x-p.x,dy=wood.y-p.y
      if(!isHit(dx,dy,Math.hypot(dx,dy),23))continue
      p.hitSet.add(wood)
      if(!canMine){sfx.pickSpark();continue}
      wood.hp = Math.max(0, wood.hp - efficiency)
      this.fx.chips(wood.x,wood.y,'#a47c50',wood.hp?4:14,150);engine.hitStop(0.025)
      if(wood.hp===0){for(let i=0,n=1+Math.floor(Math.random()*2);i<n;i++)this.drops.push(new Drop(wood.x,wood.y,WOOD_ID));sfx.pickBreak()}else sfx.pickHit(wood.hp/30)
    }
    const pc = this.map.worldToCol(p.x)
    const pr = this.map.worldToRow(p.y)
    for (let cc = pc - 2; cc <= pc + 2; cc++) {
      for (let rr = pr - 2; rr <= pr + 2; rr++) {
        const ore = this.map.oreAt(cc, rr)
        if (!ore) continue
        const key = `ore:${cc}:${rr}`
        if (p.hitSet.has(key)) continue

        const cx = cc * tile + tile / 2 + ore.offsetX
        const cy = rr * tile + tile / 2 + ore.offsetY
        const dx = cx - p.x
        const dy = cy - p.y
        const dist = Math.hypot(dx, dy)
        if (swing.shape === 'slash') {
          if (dist > m.reach + tile * 0.62) continue
          if (Math.abs(angleDiff(dx, dy, p.facing)) > (m.arc ?? 0) + 0.28) continue
        } else {
          if (!inStab(dx, dy, swing.stabWidth / 2, tile * 0.42)) continue
        }

        p.hitSet.add(key)
        // 非镐工具（铁剑等）砍在矿脉上：钝锵弹开音 + 灰石磕碰火花，不计敲击进度
        const requiredPower = ore.hasOre ? findMineralDef(ore.kind)?.requiredMiningPower ?? 1 : 1
        if (!canMine || (toolId ? getItemDef(toolId).miningPower ?? 0 : 0) < requiredPower) {
          sfx.pickSpark()
          this.fx.chips(cx, cy, '#9aa0a8', 3, 110)
          continue
        }
        const result = this.map.hitOre(cc, rr, efficiency)
        if (!result) continue
        // 矿种 Def 缺失（内容包被移除）时退化为纯灰石反馈，不炸
        const mineral = findMineralDef(result.kind)
        const crystalColor = mineral?.palette.crystal ?? '#8b929c'
        const hiColor = mineral?.palette.hi ?? '#a6adb7'
        if (result.broken) {
          if (result.vein === 'rock') {
            // 岩包崩落：灰石碎粒为主；真藏矿才补几粒矿色 + 矿名揭晓飘字
            this.fx.chips(cx, cy, '#8b929c', 15, 230)
            this.fx.chips(cx, cy, '#a6adb7', 6, 170)
            this.fx.damageText(cx, cy - 10, mineral?.visual.form==='salt'?mineralName(result.kind):t('game.notify.rock'), '#c2c8d0')
            if (result.hasOre && mineral) {
              this.fx.chips(cx, cy, crystalColor, 7, 200)
              this.fx.chips(cx, cy, hiColor, 3, 150)
              this.fx.damageText(cx, cy + 4, mineralName(result.kind), mineral.text)
            }
          } else if (mineral) {
            this.fx.chips(cx, cy, crystalColor, 14, 230)
            this.fx.chips(cx, cy, hiColor, 6, 170)
            this.fx.damageText(cx, cy - 12, mineralName(result.kind), mineral.text)
          }
          // 经验：碎岩包必有岩石经验；显矿脉或岩包真藏矿再给一份采矿经验
          host.onMine('rock')
          if (result.vein !== 'rock' || result.hasOre) host.onMine('ore')
          this.spawnOreDrops(cc, rr, ore)
          // 纯普通石头额外掉一份硝石；不替换石料，藏矿岩包和显矿不参与。
          if (result.vein === 'rock' && !result.hasOre && mineral?.visual.form!=='salt' && Math.random() < 0.03) {
            this.drops.push(new Drop(cx, cy, SALTPETER_ID))
          }
          // 楼层宿主在生成时占用名额，换房重访不释放。
          const guaranteedChest=result.vein==='rock'&&!result.hasOre&&mineral?.visual.form!=='salt'&&host.claimGuaranteedMiningChest?.()
          if (guaranteedChest||((this.def.floor??1)>=3&&!this.script?.noChest && Math.random() < CONFIG.mine.chestChance && host.claimMiningChest?.())) {
            this.addChestInteractable(cx, cy)
            this.fx.damageText(cx, cy - 26, t('game.notify.chest'), '#ffd76a')
            sfx.doorOpen()
          }
          // 50% 概率从矿里爆出怪（仅未清场房间；落点远离玩家 + 出土预警，不零帧起手；脚本房可禁用）
          if (!this.script?.noMonsterBurst && !this.cleared && Math.random() < CONFIG.mine.monsterBurstChance) {
            this.burstEnemyFromOre(cc, rr, p)
          }
          engine.hitStop(0.05)
          engine.shake(0.12)
          sfx.pickBreak()
        } else {
          // 未碎：岩包只崩石灰，显矿态崩矿色
          this.fx.chips(cx, cy, result.vein === 'rock' ? '#8b929c' : crystalColor, 4, 130)
          engine.hitStop(0.025)
          engine.shake(0.05)
          sfx.pickHit(result.ratio)
        }
      }
    }
  }

  /** 击杀公共结算：尸体碎粒、史莱姆凝液与整层统计。 */
  private onEnemyKilled(e: Enemy, host: RoomHost): void {
    this.doomsday.remove(e)
    if (e.def.tags?.includes('story_restore')) { host.onKill(0); return }
    this.fx.chips(e.x, e.y, e.deathColor, 14, 200)
    if (e.def.tags?.includes('boss')) { host.onKill(0); return }
    sfx.enemyDie(e.hitMaterial)
    if(e.def.drops){
      for(const drop of e.def.drops)if(Math.random()<drop.chance&&findItemDef(drop.item)){
        for(let n=0;n<drop.qty;n++)this.drops.push(new Drop(e.x,e.y,drop.item))
      }
    }else if ((e.hitMaterial === 'slime' || e.hitMaterial === 'venom') && Math.random() < 0.10) {
      this.drops.push(new Drop(e.x, e.y, SLIME_BALL_ID))
    }
    host.onKill(e.def.exp ?? CONFIG.exp.kill)
  }

  /**
   * 符卡释放结算入口（批次 D 首发「符札·祓」）：
   * 资源门控（灵力/CD）已在 Player.castSpell 通过。按 def.waves 排期多波光脉
   * （第一波立即），每波触发瞬间以玩家当前位置为中心，各自结算伤害/击退/消弹与演出。
   */
  resolveSpell(p: Player, spellId: ItemId, def: SpellCardDef, engine: EngineContext, host: RoomHost): void {
    const pulseDef = { ...def, knockback: def.knockback + p.knockbackBonus }
    const waves = Math.max(1, def.waves ?? 1)
    const gap = def.waveInterval ?? 0.4
    const damageBonus=p.outgoingDamageBonus
    this.fireSpellPulse(p.x, p.y, spellId, pulseDef, 0, engine, host,damageBonus)
    for (let i = 1; i < waves; i++) {
      this.pendingSpellPulses.push({ delay: gap * i, spellId, def: pulseDef, pulse: i,damageBonus })
    }
  }

  /** 单波光脉结算：以玩家当前位置 (x,y) 为中心（光波跟随玩家移动） */
  private fireSpellPulse(
    x: number,
    y: number,
    spellId: ItemId,
    def: SpellCardDef,
    pulse: number,
    engine: EngineContext,
    host: RoomHost,
    damageBonus=0
  ): void {
    // 第二声是高五度回响（在 Sfx 内按 pulse 区分音色/音量）
    sfx.spellCast(pulse)
    const ringColor = def.fxColors?.ring ?? def.color
    let killed = 0
    for (const e of this.enemies) {
      if (!e.canBeHit) continue
      const dx = e.hitX - x
      const dy = e.hitY - y
      if (Math.hypot(dx, dy) > def.radius + e.hitRadius) continue
      const ang = Math.atan2(dy, dx)
      const kind = def.damageKind ?? 'magic'
      const damage=calculateDamage({base:def.damage,damageBonus,resistance:kind === 'magic' ? e.def.combat.magicResist : e.def.combat.physicalResist,area:true,aoeReduction:e.def.combat.aoeReduction}).damage
      e.takeDamage(damage, ang, def.knockback, def.stun)
      this.fx.burst(e.x, e.y, ang, 8)
      this.fx.combatDamage(e.x, e.y - 18, damage, kind)
      if (!e.alive) {
        this.onEnemyKilled(e, host)
        killed++
      }
    }

    // 消弹：范围内毒液弹全部净化成小光点（每波各净化一次，新生弹幕也躲不过第二波）
    if (def.clearBullets) {
      host.clearEnemyBullets?.(x,y,def.radius)
      for (const b of this.bullets) {
        if (Math.hypot(b.x - x, b.y - y) <= def.radius) {
          b.dead = true
          this.fx.chips(b.x, b.y, ringColor, 3, 90)
        }
      }
      this.bullets = this.bullets.filter((b) => !b.removed)
    }

    // 释放演出：阳光色光波绽开（多层环+径向光芒+亮核）+ 暖色光粒；中心跟随玩家
    this.spellFx.push({
      x,
      y,
      radius: def.radius,
      t: 0,
      dur: 0.6,
      color: def.color,
      colors: def.fxColors,
      seed: Math.random() * Math.PI * 2,
      follow: true
    })
    this.fx.chips(x, y, ringColor, 26, 300)
    // 符卡飘字走物品语言键 item.<id>.flyword（未声明该键的符卡不飘字）
    const flyKey = `item.${spellId}.flyword`
    if (pulse === 0 && hasKey(flyKey)) this.fx.damageText(x, y - 32, t(flyKey), ringColor)
    // 第二波的震屏/顿帧减半，避免 0.4s 内两次强反馈发黏
    engine.shake(killed > 0 ? (pulse === 0 ? 0.28 : 0.2) : pulse === 0 ? 0.18 : 0.12)
    engine.hitStop(pulse === 0 ? 0.06 : 0.035)
  }

  /** 食用消耗品的治疗反馈（绿芯片 + 回复飘字） */
  flashHeal(x: number, y: number, amount: number): void {
    this.fx.chips(x, y - 6, '#8fe6a0', 12, 170)
    this.fx.damageText(x, y - 24, `+${amount}`, '#9fe6a8')
  }

  /** 背包丢弃：在指定世界坐标生成一个地面掉落物 */
  spawnGroundDrop(id: ItemId, x: number, y: number): void {
    this.drops.push(new Drop(x, y, id))
  }

  render(ctx: CanvasRenderingContext2D, player: Player): void {
    // 房间纹理 2x 超采样烘焙，此处缩回世界尺寸（相机 zoom 放大后仍锐利）
    const roomW = CONFIG.roomCols * CONFIG.tile
    const roomH = CONFIG.roomRows * CONFIG.tile
    ctx.drawImage(this.texture, 0, 0, roomW, roomH)
    this.nature?.renderGround(ctx,this.time)
    if (this.weaponImpacts.length) {
      ctx.save(); ctx.beginPath()
      const inset = CONFIG.wallThickness * CONFIG.tile
      ctx.rect(inset, inset, roomW - inset * 2, roomH - inset * 2); ctx.clip()
      for (const effect of this.weaponImpacts) if (effect.age >= 0) effect.render(ctx, effect)
      ctx.restore()
    }
    this.map.renderOreLayer(ctx)
    this.map.renderOreFx(ctx)
    // 稀疏落尘与墙边水滴，只作气氛，不遮挡矿脉和弹幕。（猩红圣堂无矿洞尘水，主题房跳过）
    ctx.save()
    if(this.script?.theme!=='grimm'){
    for(let i=0;i<12;i++){
      const x=CONFIG.wallThickness*CONFIG.tile+30+(i*137+this.def.id*19)%(roomW-CONFIG.wallThickness*CONFIG.tile*2-60),y=CONFIG.wallThickness*CONFIG.tile+25+(i*89+this.time*4)%(roomH-CONFIG.wallThickness*CONFIG.tile*2-50)
      ctx.fillStyle='#cebea02b';ctx.fillRect(x+Math.sin(this.time*0.3+i)*6,y,1,1)
    }
    for(let i=0;i<2;i++){
      const x=CONFIG.wallThickness*CONFIG.tile+28+i*(roomW-CONFIG.wallThickness*CONFIG.tile*2-56),phase=(this.time+i*2.1)%4.7
      if(phase<0.6){ctx.strokeStyle='#9cb2bb44';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,CONFIG.wallThickness*CONFIG.tile+phase*65);ctx.lineTo(x,CONFIG.wallThickness*CONFIG.tile+phase*65+4);ctx.stroke()}
      else if(phase<1.2){ctx.strokeStyle=`rgba(156,178,187,${(1.2-phase)*0.25})`;ctx.beginPath();ctx.ellipse(x,CONFIG.wallThickness*CONFIG.tile+40,(phase-0.6)*12,(phase-0.6)*4,0,0,Math.PI*2);ctx.stroke()}
    }
    }
    ctx.restore()
    this.renderDoors(ctx)
    if (this.fissure) this.renderFissure(ctx)
    // 批次 F⑤：时空乱流浮层（地面上、实体下；后续光照压暗层会统一压暗）
    // 注意传世界逻辑尺寸，不能用 texture.width（E 纹理是 2x 超采样物理画布）
    this.warp.render(ctx, roomW, roomH)

    // 全屋 y-sort：掉落/敌人/玩家/立体摆件/地面交互物统一按脚底 y 排序（星露谷式前后遮挡）
    const sortables: Array<{ y: number; draw: () => void }> = []
    for (const d of this.drops) sortables.push({ y: d.y, draw: () => d.render(ctx) })
    for (const e of this.enemies) sortables.push({ y: e.y, draw: () => e.render(ctx) })
    sortables.push({ y: player.y, draw: () => player.render(ctx) })
    if (this.plants) { const plants = this.plants; for (const p of plants.ground) sortables.push({ y: p.y, draw: () => plants.renderGround(ctx, p, this.time) }) }
    if(this.wrecks){const wrecks=this.wrecks;for(const w of wrecks.all)sortables.push({y:w.y,draw:()=>wrecks.render(ctx,w,this.time,this.wreckSearchAllowed)})}
    for (const pr of this.props) sortables.push({ y: pr.y, draw: () => renderProp(ctx, pr) })
    if(this.nature){const nature=this.nature;for(const p of nature.gathers)sortables.push({y:p.y,draw:()=>nature.renderGather(ctx,p)});for(const p of nature.wood)if(p.hp>0)sortables.push({y:p.y,draw:()=>nature.renderWood(ctx,p)})}
    // B2：地面物品/宝箱（站立物，F 交互）；物品拾取后（done）立即消失，
    // 宝箱开过仍要画开盖外形，故只对 item 过滤 done
    for (const it of this.interactables) {
      if (it.kind === 'item' && !it.done) sortables.push({ y: it.y, draw: () => this.renderGroundItem(ctx, it) })
      else if (it.kind === 'chest') sortables.push({ y: it.y, draw: () => this.renderChest(ctx, it) })
    }
    // B2：剧情追加实体（灵梦 NPC 等）
    for (const ex of this.extraSortables) {
      sortables.push({ y: ex.y, draw: () => ex.draw(ctx, this.time) })
    }
    // 矿脉晶簇：以格底为锚参与排序（高晶尖正确遮挡后方实体）
    this.map.forEachOre((ore) => {
      sortables.push({
        y: (ore.row + 1) * CONFIG.tile - 2 + ore.offsetY,
        draw: () => drawOreCrystals(ctx, ore, this.time)
      })
    })
    sortables.sort((a, b) => a.y - b.y)
    for (const it of sortables) it.draw()
    // 批次 F⑦追加：漂浮雾气轻盖实体（柔遮罩）；弹幕仍在最上层保证战斗可读
    // 同上：传世界逻辑尺寸，与纹理物理像素解耦
    ctx.save();ctx.globalAlpha*=this.artStyle.scene.fogStrength
    this.fog.render(ctx, roomW, roomH);ctx.restore()
    // 弹幕画在最上层（东方弹幕必须醒目，不参与遮挡）
    const flight = player.rangedFlight
    if (flight) {
      ctx.save(); ctx.translate(flight.x, flight.y); ctx.rotate(flight.rotation)
      getItemDef(flight.item).weapon?.drawHeld?.(ctx, { time: this.time }); ctx.restore()
    }
    // 读取一次当前世界变换，含相机缩放、震动和设备像素比；仅剔除绘制，不剔除逻辑。
    const transform = ctx.getTransform()
    const canCull = transform.b === 0 && transform.c === 0 && transform.a !== 0 && transform.d !== 0
    const x0 = -transform.e / transform.a, x1 = (ctx.canvas.width - transform.e) / transform.a
    const y0 = -transform.f / transform.d, y1 = (ctx.canvas.height - transform.f) / transform.d
    const left = Math.min(x0, x1), right = Math.max(x0, x1), top = Math.min(y0, y1), bottom = Math.max(y0, y1)
    for (const b of this.bullets) if (!canCull || b.visibleIn(left, top, right, bottom)) b.render(ctx)
    player.bow.render(ctx)
    this.fx.render(ctx)
    this.renderSpellFx(ctx)
    this.renderPrismaBlasts(ctx)
    // 地缝热气是空气层：画在实体之后、北墙立面之前
    this.steam.render(ctx)
    this.renderNorthFace(ctx, player)
    this.plants?.renderWall(ctx, this.time, player)
    this.plants?.renderCeiling(ctx, this.time, player)
    // 火苗贴在墙面上，必须在立面遮挡层之后画（火光是发光体，盖最上也不穿帮）
    this.renderTorchFlames(ctx)
    // 塔罗牌穿过障碍，牌背与抽牌提示也绘制在地图遮挡层之上。
    player.tarot.render(ctx, player)
  }

  /** 梦想封印全屏白闪强度（0~1；CaveModule 在屏幕空间盖白） */
  get sealFlashAlpha(): number {
    return this.sealFlash > 0 ? this.sealFlash / this.sealFlashDur : 0
  }

  /** 地面剧情物品：金色光柱 + 上下浮动的物件简形（镐/剑可辨识，其余走通用菱形） */
  private renderGroundItem(ctx: CanvasRenderingContext2D, it: Interactable): void {
    const data = it.data as ItemInteractData
    const bob = Math.sin(this.time * 2.4 + it.id) * 2.6
    const y = it.y + bob
    // 影子贴地
    ctx.fillStyle = 'rgba(0,0,0,0.32)'
    ctx.beginPath()
    ctx.ellipse(it.x, it.y + 7, 9, 3.4, 0, 0, Math.PI * 2)
    ctx.fill()
    // 金色指引光柱（加色微亮，暗矿洞里一眼看见）
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const beam = ctx.createLinearGradient(0, y - 46, 0, y)
    beam.addColorStop(0, 'rgba(255,225,150,0)')
    beam.addColorStop(1, 'rgba(255,225,150,0.28)')
    ctx.fillStyle = beam
    ctx.fillRect(it.x - 5, y - 46, 10, 46)
    ctx.restore()
    // 物件本体
    ctx.save()
    ctx.translate(it.x, y)
    ctx.lineJoin = 'round'
    if (data.item === PICK_RUSTY_ID) {
      // 锈镐：棕色木柄斜置 + 灰褐镐头
      ctx.rotate(-0.5)
      ctx.strokeStyle = '#6b4a2c'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(0, 9)
      ctx.lineTo(0, -9)
      ctx.stroke()
      ctx.strokeStyle = '#9a6a3a'
      ctx.lineWidth = 3.4
      ctx.beginPath()
      ctx.arc(0, -9, 6.5, Math.PI * 1.05, Math.PI * 1.95)
      ctx.stroke()
    } else if (findItemDef(data.item)?.weapon?.drawHeld) {
      ctx.rotate(-Math.PI / 2)
      getItemDef(data.item).weapon!.drawHeld!(ctx, { time: this.time })
    } else if (data.item === SWORD_IRON_ID) {
      // 铁剑：银白剑刃 + 十字护手 + 棕柄（直立插地感）
      ctx.strokeStyle = '#241a12'
      ctx.lineWidth = 4.6
      ctx.beginPath()
      ctx.moveTo(0, 11)
      ctx.lineTo(0, -12)
      ctx.stroke()
      ctx.strokeStyle = '#d8dde4'
      ctx.lineWidth = 2.8
      ctx.beginPath()
      ctx.moveTo(0, 11)
      ctx.lineTo(0, -12)
      ctx.stroke()
      ctx.strokeStyle = '#8a5a30'
      ctx.lineWidth = 2.4
      ctx.beginPath()
      ctx.moveTo(-5, 6)
      ctx.lineTo(5, 6)
      ctx.stroke()
    } else {
      // 通用：物品主色菱形 + 白芯星点
      const def = findItemDef(data.item)
      ctx.fillStyle = def?.color ?? '#c9b07a'
      ctx.strokeStyle = '#241a12'
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(0, -9)
      ctx.lineTo(7, 0)
      ctx.lineTo(0, 9)
      ctx.lineTo(-7, 0)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = def?.hi ?? '#fff3d0'
      ctx.fillRect(-1.5, -4, 3, 3)
    }
    ctx.restore()

    // 附带件（锈镐旁的火柴盒）：紧挨主件右下方，小一号
    ;(data.extras ?? []).forEach((e) => {
      const ex = it.x + 19
      const ey = y + 6
      ctx.fillStyle = 'rgba(0,0,0,0.26)'
      ctx.beginPath()
      ctx.ellipse(ex, ey + 6, 6.5, 2.6, 0, 0, Math.PI * 2)
      ctx.fill()
      const edef = findItemDef(e.item)
      ctx.save()
      ctx.translate(ex, ey)
      ctx.scale(0.7, 0.7)
      if (edef?.ground) {
        edef.ground({ ctx, x: 0, y: 0, r: 10, phase: 'rest', bob })
      } else {
        ctx.fillStyle = edef?.color ?? '#c9b07a'
        ctx.strokeStyle = '#241a12'
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.moveTo(0, -7)
        ctx.lineTo(6, 0)
        ctx.lineTo(0, 7)
        ctx.lineTo(-6, 0)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      }
      ctx.restore()
    })
  }

  /** 宝箱：未开＝金边木箱+锁+呼吸微光；开过＝开盖空箱留在原地 */
  private renderChest(ctx: CanvasRenderingContext2D, it: Interactable): void {
    const opened = it.done
    // 箱体与基地共用木头和铁箍，打开后继续留在原接地点，不使用整圈强光。
    ctx.save();ctx.fillStyle='#1c1e2c4d';ctx.beginPath();ctx.ellipse(it.x,it.y+5,15,4,0,0,Math.PI*2);ctx.fill();ctx.restore()
    if(drawMineSprite(ctx,opened?'chest-open':'chest-closed',it.x-18,it.y-(opened?56:32),36,opened?60:37)){
      if(!opened){ctx.save();ctx.globalAlpha=.5+.2*Math.sin(this.time*3+it.id);ctx.fillStyle='#dfbc78';ctx.fillRect(it.x-2,it.y-16,2,2);ctx.restore()}
      return
    }
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,0.34)'
    ctx.beginPath()
    ctx.ellipse(it.x, it.y + 8, 12, 4, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.save()
    ctx.translate(it.x, it.y)
    ctx.scale(1.4,1.4)
    ctx.lineJoin = 'round'
    if (!opened) {
      // 未开：呼吸金光圈（吸引注意）
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 3 + it.id)
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.strokeStyle = `rgba(255,214,106,${0.25 + pulse * 0.3})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(0, 2, 13 + pulse * 2, 7 + pulse, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
      // 盖子（闭合）
      ctx.fillStyle = '#8a5528'
      ctx.strokeStyle = '#3a2412'
      ctx.lineWidth = 1.8
      ctx.beginPath()
      ctx.roundRect(-10, -10, 20, 8, 2)
      ctx.fill()
      ctx.stroke()
      // 箱体
      ctx.fillStyle = '#6f421f'
      ctx.beginPath()
      ctx.rect(-10, -2, 20, 10)
      ctx.fill()
      ctx.stroke()
      // 金色包边 + 锁
      ctx.strokeStyle = '#e8c15a'
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(-10, -2)
      ctx.lineTo(10, -2)
      ctx.stroke()
      ctx.fillStyle = '#e8c15a'
      ctx.beginPath()
      ctx.arc(0, 1, 2.4, 0, Math.PI * 2)
      ctx.fill()
    } else {
      // 开盖：盖子向上翻开（深色），箱体内部发黑
      ctx.fillStyle = '#5a371c'
      ctx.strokeStyle = '#2e1c0e'
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(-10, -2)
      ctx.lineTo(-9, -12)
      ctx.lineTo(9, -12)
      ctx.lineTo(10, -2)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#6f421f'
      ctx.beginPath()
      ctx.rect(-10, -2, 20, 10)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#241508'
      ctx.beginPath()
      ctx.rect(-7, -1, 14, 5)
      ctx.fill()
    }
    // 顶面、侧板和旧金属箍统一使用场景摆件的低饱和色阶。
    ctx.lineWidth=1;ctx.strokeStyle='#302b38'
    ctx.fillStyle='#574439';ctx.beginPath();ctx.moveTo(10,-2);ctx.lineTo(14,-6);ctx.lineTo(14,4);ctx.lineTo(10,8);ctx.closePath();ctx.fill();ctx.stroke()
    if(!opened){ctx.fillStyle='#b59160';ctx.beginPath();ctx.moveTo(-10,-10);ctx.lineTo(-6,-14);ctx.lineTo(14,-14);ctx.lineTo(10,-10);ctx.closePath();ctx.fill();ctx.stroke()}
    ctx.strokeStyle='#44362e';ctx.lineWidth=.7
    for(const x of [-4,4]){ctx.beginPath();ctx.moveTo(x,-1);ctx.lineTo(x,7);ctx.stroke()}
    ctx.strokeStyle='#b99a7066';ctx.beginPath();ctx.moveTo(-3,2);ctx.lineTo(2,3);ctx.moveTo(5,5);ctx.lineTo(8,4);ctx.stroke()
    for(const x of [-8,6]){ctx.fillStyle='#8c815e';ctx.fillRect(x,-2,2,10);if(!opened)ctx.fillRect(x,-10,2,8);ctx.fillStyle='#d3bb85';ctx.fillRect(x+.5,0,1,1);ctx.fillRect(x+.5,6,1,1)}
    ctx.fillStyle='#bda16b';ctx.fillRect(-2,-1,4,5);ctx.fillStyle='#50473c';ctx.fillRect(-.5,1,1,2)
    ctx.restore()
  }

  /** 墙上火把火苗（未点燃的火把柄已烘焙进纹理，这里只画火） */
  private renderTorchFlames(ctx: CanvasRenderingContext2D): void {
    if (!this.torches.length) return
    for (const tr of this.torches) {
      drawTorchFlame(ctx, tr, this.time, this.torchLitProgress(tr))
    }
  }

  /**
   * 北墙立面遮挡层：盖在全部实体之上。
   * 玩家贴近北墙时整体淡到 alpha，避免角色走进墙根被完全吃掉
   * （怪的逐体遮挡等 y-sort 批次统一处理，切片先跟随玩家）。
   */
  private renderNorthFace(ctx: CanvasRenderingContext2D, player: Player): void {
    const face = this.textureNorth
    if (!face) return
    const f = CONFIG.art.wallFade
    const d = player.y - this.map.bounds.top
    // k=0 贴墙（最透）→ k=1 离墙（全不透明）
    const k = Math.max(0, Math.min(1, (d - f.near) / (f.far - f.near)))
    ctx.globalAlpha = f.alpha + (1 - f.alpha) * k
    ctx.drawImage(
      face,
      0,
      0,
      CONFIG.roomCols * CONFIG.tile,
      CONFIG.roomRows * CONFIG.tile
    )
    ctx.globalAlpha = 1
  }

  /**
   * 符卡光脉演出：阳光色光波绽开（重制版）
   * 层次 = 地面暖光圆盘 → 18 道径向光芒 → 波锋三层光环（外缘辉光/主环/白热亮芯）
   *       + 滞后次环 + 环上 22 颗光粒 + 中心白热闪核。
   * 发光层统一用 'lighter' 加色混合，真正有"光"而不是廉价描边圆；
   * colors 缺省时回退旧单色金环（兼容未来其他符卡）。
   */
  private renderSpellFx(ctx: CanvasRenderingContext2D): void {
    for (const s of this.spellFx) {
      if (s.t < 0) continue // 错峰排期未启动
      const k = Math.min(1, s.t / s.dur)
      const ease = 1 - Math.pow(1 - k, 3)
      const alpha = Math.pow(1 - k, 1.35)
      const R = s.radius
      const core = s.colors?.core ?? '#fff7d8'
      const ring = s.colors?.ring ?? s.color
      const rim = s.colors?.rim ?? s.color
      const rMain = R * (0.12 + 0.88 * ease)

      // —— 地面径向暖光（普通混合，打底氛围） ——
      const glowR = R * (0.2 + 0.8 * ease)
      const g = ctx.createRadialGradient(s.x, s.y, 4, s.x, s.y, glowR)
      g.addColorStop(0, hexRgba(core, 0.34 * alpha))
      g.addColorStop(0.6, hexRgba(ring, 0.13 * alpha))
      g.addColorStop(1, hexRgba(rim, 0))
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(s.x, s.y, glowR, 0, Math.PI * 2)
      ctx.fill()

      // —— 发光层：加色混合 ——
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'

      // ① 泛光 bloom：超大半径极淡暖 halo（光波外缘的空气溢光，超出波锋照亮黑暗）
      const bloomR = R * (0.35 + 1.25 * ease)
      const bg = ctx.createRadialGradient(s.x, s.y, R * 0.3, s.x, s.y, bloomR)
      bg.addColorStop(0, hexRgba(ring, 0.1 * alpha))
      bg.addColorStop(0.55, hexRgba(rim, 0.05 * alpha))
      bg.addColorStop(1, hexRgba(rim, 0))
      ctx.fillStyle = bg
      ctx.beginPath()
      ctx.arc(s.x, s.y, bloomR, 0, Math.PI * 2)
      ctx.fill()

      // ② 波锋光带：光浪扫过的地面亮环（波锋内侧 0.55r 起渐亮、过波锋后迅速消散）
      const band = ctx.createRadialGradient(s.x, s.y, rMain * 0.5, s.x, s.y, rMain * 1.18)
      band.addColorStop(0, hexRgba(ring, 0))
      band.addColorStop(0.78, hexRgba(ring, 0.05 * alpha))
      band.addColorStop(0.93, hexRgba(core, 0.22 * alpha))
      band.addColorStop(1, hexRgba(rim, 0))
      ctx.fillStyle = band
      ctx.beginPath()
      ctx.arc(s.x, s.y, rMain * 1.18, 0, Math.PI * 2)
      ctx.fill()

      // ③ 贴身光池：玩家脚下始终有一汪暖光（前半段最亮，光波绕身的本体感）
      if (k < 0.7) {
        const pf = 1 - k / 0.7
        const poolR = R * (0.22 + 0.2 * ease)
        const pg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, poolR)
        pg.addColorStop(0, hexRgba(core, 0.3 * pf))
        pg.addColorStop(0.6, hexRgba(ring, 0.12 * pf))
        pg.addColorStop(1, hexRgba(rim, 0))
        ctx.fillStyle = pg
        ctx.beginPath()
        ctx.arc(s.x, s.y, poolR, 0, Math.PI * 2)
        ctx.fill()
      }

      // 径向光芒（长短错落 + 随波缓慢旋开）
      const rays = 18
      ctx.fillStyle = hexRgba(ring, 0.5 * alpha)
      for (let i = 0; i < rays; i++) {
        const stagger = 0.72 + 0.28 * Math.abs(Math.sin(i * 12.9898 + s.seed))
        const a = s.seed + (i / rays) * Math.PI * 2 + k * 0.15
        const r0 = R * 0.08
        const r1 = R * (0.3 + 0.68 * ease) * stagger
        ctx.beginPath()
        ctx.moveTo(s.x + Math.cos(a - 0.05) * r0, s.y + Math.sin(a - 0.05) * r0)
        ctx.lineTo(s.x + Math.cos(a - 0.012) * r1, s.y + Math.sin(a - 0.012) * r1)
        ctx.lineTo(s.x + Math.cos(a + 0.012) * r1, s.y + Math.sin(a + 0.012) * r1)
        ctx.lineTo(s.x + Math.cos(a + 0.05) * r0, s.y + Math.sin(a + 0.05) * r0)
        ctx.closePath()
        ctx.fill()
      }

      // 波锋：外缘粗辉光（暖橙）
      ctx.strokeStyle = hexRgba(rim, 0.2 * alpha)
      ctx.lineWidth = 11
      ctx.beginPath()
      ctx.arc(s.x, s.y, rMain, 0, Math.PI * 2)
      ctx.stroke()
      // 波锋：主环（亮金）
      ctx.strokeStyle = hexRgba(ring, 0.85 * alpha)
      ctx.lineWidth = 3.6 - 1.8 * k
      ctx.beginPath()
      ctx.arc(s.x, s.y, rMain, 0, Math.PI * 2)
      ctx.stroke()
      // 波锋：白热亮芯
      ctx.strokeStyle = hexRgba(core, 0.9 * alpha)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(s.x, s.y, rMain, 0, Math.PI * 2)
      ctx.stroke()

      // 滞后次环（余波：落后 12% 进度、半径小一圈、更淡）
      const k2 = Math.max(0, Math.min(1, (k - 0.12) / 0.88))
      if (k2 > 0) {
        const ease2 = 1 - Math.pow(1 - k2, 3)
        const rSub = R * (0.08 + 0.72 * ease2)
        ctx.strokeStyle = hexRgba(rim, 0.3 * (1 - k2))
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(s.x, s.y, rSub, 0, Math.PI * 2)
        ctx.stroke()
      }

      // 环上光粒（贴着波锋扩散）
      const specks = 22
      for (let i = 0; i < specks; i++) {
        const stagger = 0.75 + 0.25 * Math.abs(Math.sin(i * 7.13 + s.seed * 2))
        const a = s.seed * 1.3 + (i / specks) * Math.PI * 2
        const px = s.x + Math.cos(a) * rMain
        const py = s.y + Math.sin(a) * rMain
        const sz = 1.4 + 1.8 * stagger
        ctx.fillStyle = hexRgba(i % 3 === 0 ? core : ring, 0.8 * alpha * stagger)
        ctx.beginPath()
        ctx.arc(px, py, sz, 0, Math.PI * 2)
        ctx.fill()
      }

      // 中心白热闪核（仅前 32% 时长：爆开瞬间的强光源）
      if (k < 0.32) {
        const fk = k / 0.32
        const aFlash = Math.pow(1 - fk, 1.5)
        const cr = 22 + 40 * fk
        const cg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, cr)
        cg.addColorStop(0, hexRgba(core, 0.9 * aFlash))
        cg.addColorStop(0.45, hexRgba(ring, 0.4 * aFlash))
        cg.addColorStop(1, hexRgba(rim, 0))
        ctx.fillStyle = cg
        ctx.beginPath()
        ctx.arc(s.x, s.y, cr, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.restore()
    }
  }

  /** 梦想封印：棱彩实体灵核、碎裂波冠与御札余辉；泛光只烘焙一次。 */
  private renderPrismaBlasts(ctx: CanvasRenderingContext2D): void {
    for (const b of this.prismaBlasts) {
      const k = Math.max(0, Math.min(1, b.t / b.dur))
      const ease = 1 - Math.pow(1 - k, 3)
      const alpha = Math.pow(1 - k, 1.2)
      const radius = b.r * (0.12 + ease * 0.88)
      if (!b.glow) {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 256
        const g = canvas.getContext('2d')!
        g.globalCompositeOperation = 'lighter'
        b.colors.forEach((color, i) => {
          const a = b.seed + i * Math.PI * 2 / 3
          const x = 128 + Math.cos(a) * 22, y = 128 + Math.sin(a) * 22
          const glow = g.createRadialGradient(x, y, 0, x, y, 102)
          glow.addColorStop(0, hexRgba('#fff5dd', .48))
          glow.addColorStop(.18, hexRgba(color, .48))
          glow.addColorStop(.5, hexRgba(color, .2))
          glow.addColorStop(1, hexRgba(color, 0))
          g.fillStyle = glow; g.fillRect(0, 0, 256, 256)
        })
        b.glow = canvas
      }
      ctx.save()
      try {
        ctx.translate(b.x, b.y)
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = alpha * .85
        const bloom = radius * 1.55
        ctx.drawImage(b.glow, -bloom, -bloom, bloom * 2, bloom * 2)

        // 非整圆波冠：闭合厚片有独立起伏与断口，不依赖模糊描边撑体积。
        for (let i = 0; i < 28; i++) {
          const a = b.seed + i * Math.PI * 2 / 28
          const span = .11 + .045 * Math.sin(i * 2.7 + b.seed)
          const reach = radius * (1 + .065 * Math.sin(i * 2.3 + b.seed))
          const width = (9 + 17 * (1 - k)) * (.7 + .3 * Math.sin(i * 1.9) ** 2)
          ctx.beginPath()
          for (let j = 0; j <= 4; j++) {
            const theta = a + span * j / 4
            const r = reach + Math.sin(j * 1.8 + i) * 4
            const x = Math.cos(theta) * r, y = Math.sin(theta) * r
            if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
          }
          for (let j = 4; j >= 0; j--) {
            const theta = a + span * j / 4, r = reach - width
            ctx.lineTo(Math.cos(theta) * r, Math.sin(theta) * r)
          }
          ctx.closePath()
          ctx.fillStyle = b.colors[i % 3]; ctx.globalAlpha = alpha * .65; ctx.fill()
          ctx.strokeStyle = '#fff4d6'; ctx.lineWidth = .8; ctx.globalAlpha = alpha * .55; ctx.stroke()
        }

        // 三瓣厚实灵力卷流，彩色面与小面积暖白亮脊分开，避免整团漂白。
        const core = b.r * (.3 * Math.pow(1 - k, .65) + .06)
        ctx.globalCompositeOperation = 'source-over'
        for (let i = 0; i < 3; i++) {
          ctx.save()
          ctx.rotate(b.seed + i * Math.PI * 2 / 3 + k * 1.8)
          ctx.globalAlpha = alpha * .9
          const material = ctx.createLinearGradient(-core, -core, core, core)
          material.addColorStop(0, '#642c48'); material.addColorStop(.35, b.colors[i])
          material.addColorStop(.63, '#fff2d4'); material.addColorStop(1, b.colors[(i + 1) % 3])
          ctx.fillStyle = material
          ctx.beginPath(); ctx.moveTo(-core, -core * .12)
          ctx.bezierCurveTo(-core * .8, -core, core * .65, -core * .85, core, -core * .08)
          ctx.bezierCurveTo(core * .35, -core * .42, -core * .1, core * .65, -core, -core * .12)
          ctx.fill(); ctx.restore()
        }
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = Math.pow(1 - k, 3)
        ctx.fillStyle = '#fff8e4'; ctx.beginPath(); ctx.ellipse(0, 0, core * .28, core * .23, b.seed, 0, Math.PI * 2); ctx.fill()

        // 御札与棱彩碎屑错速外散，固定种子使跨帧纹理稳定。
        for (let i = 0; i < 24; i++) {
          const a = b.seed + i * 2.39996
          const distance = b.r * (.16 + ease * (.6 + (i % 5) * .13))
          ctx.save(); ctx.translate(Math.cos(a) * distance, Math.sin(a) * distance)
          ctx.rotate(a + k * (i % 2 ? 2 : -2))
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = alpha * .85
          if (i % 3 === 0) {
            ctx.fillStyle = '#f5e6c9'; ctx.fillRect(-4, -9, 8, 18)
            ctx.fillStyle = '#b52d47'; ctx.fillRect(-2, -6, 4, 2); ctx.fillRect(-1, -2, 2, 7)
          } else {
            ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = b.colors[i % 3]
            ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(0, -2); ctx.lineTo(5, 0); ctx.lineTo(0, 2); ctx.closePath(); ctx.fill()
          }
          ctx.restore()
        }
      } finally { ctx.restore() }
    }
  }

  /** 门实时层：封印红印脉动 / 解封绿色旋涡 + 方向箭头 */
  private renderDoors(ctx: CanvasRenderingContext2D): void {
    const t = CONFIG.tile
    for (const d of this.doors) {
      const cx = d.col * t + t / 2
      const cy = d.row * t + t / 2
      if (!d.open) {
        // 暗红光晕
        const pulse = 0.55 + 0.3 * Math.sin(this.time * 4 + d.doorId)
        const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 22)
        g.addColorStop(0, `rgba(255,70,100,${0.35 * pulse})`)
        g.addColorStop(1, 'rgba(255,70,100,0)')
        ctx.fillStyle = g
        ctx.fillRect(cx - 22, cy - 22, 44, 44)
        // 六边形封印
        ctx.strokeStyle = `rgba(255,90,110,${0.75 + pulse * 0.25})`
        ctx.lineWidth = 2
        ctx.beginPath()
        for (let i = 0; i < 6; i++) {
          const a = this.time * 0.8 + (i / 6) * Math.PI * 2
          const px = cx + Math.cos(a) * 11
          const py = cy + Math.sin(a) * 11
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.closePath()
        ctx.stroke()
        ctx.fillStyle = `rgba(255,120,140,${0.5 * pulse})`
        ctx.fill()
      } else {
        // 绿色旋涡
        ctx.strokeStyle = 'rgba(107,224,160,0.85)'
        ctx.lineWidth = 2
        for (let arc = 0; arc < 2; arc++) {
          ctx.beginPath()
          const spin = this.time * 2.2 + arc * Math.PI
          ctx.arc(cx, cy, 7 + arc * 5, spin, spin + Math.PI * 1.2)
          ctx.stroke()
        }
        ctx.fillStyle = 'rgba(190,255,220,0.9)'
        ctx.beginPath()
        ctx.arc(cx, cy, 2.4, 0, Math.PI * 2)
        ctx.fill()
        // 朝房内方向的小箭头
        const dirv = DOOR_ARROW[d.dir]
        ctx.fillStyle = 'rgba(107,224,160,0.8)'
        ctx.beginPath()
        ctx.moveTo(cx + dirv.x * 13, cy + dirv.y * 13)
        ctx.lineTo(cx + dirv.x * 7 - dirv.y * 4, cy + dirv.y * 7 - dirv.x * 4)
        ctx.lineTo(cx + dirv.x * 7 + dirv.y * 4, cy + dirv.y * 7 + dirv.x * 4)
        ctx.closePath()
        ctx.fill()
      }
    }
  }

  /**
   * 下行裂隙（批次 E 手绘化）：
   * 未激活 = 地面凹陷暗托 + ink 锯齿裂缝（内透暗红幽光）；
   * 激活 = 金紫旋涡门户 + 撕裂锯齿外口 + 中心金心 + 提示。
   */
  private renderFissure(ctx: CanvasRenderingContext2D): void {
    const f = this.fissure!
    const r = CONFIG.fissure.radius
    // 固定地面透视：碎岩口沿有上面与内侧断面，门户只在扁椭圆平面内流动。
    ctx.save()
    ctx.fillStyle='#15121dcc';ctx.beginPath();ctx.ellipse(f.x+4,f.y+5,r+12,(r+12)*.56,0,0,Math.PI*2);ctx.fill()
    for(let i=0;i<13;i++){
      const a=i/13*Math.PI*2, x=f.x+Math.cos(a)*(r+5), y=f.y+Math.sin(a)*(r+5)*.55
      ctx.fillStyle=i%3?'#514650':'#665661';ctx.beginPath();ctx.ellipse(x,y,7+i%3,4+i%2,a*.2,0,Math.PI*2);ctx.fill()
      ctx.strokeStyle='#a58a7166';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-4,y-2);ctx.lineTo(x+3,y-3);ctx.stroke()
      ctx.fillStyle='#29222dcc';ctx.beginPath();ctx.ellipse(x,y+2,5,2,0,0,Math.PI);ctx.fill()
    }
    ctx.restore()
    if (!f.active) {
      // 凹陷暗托（俯视压扁）
      ctx.fillStyle = 'rgba(30,20,28,0.72)'
      ctx.beginPath()
      ctx.ellipse(f.x, f.y, r, r * 0.5, 0, 0, Math.PI * 2)
      ctx.fill()
      // 锯齿裂缝（归一化于 r=40；纵向压扁贴合俯视）
      const k = r / 40
      const cracks: number[][][] = [
        [[-30, 1], [-22, -4], [-15, 2], [-8, -3], [-1, 1], [6, -3], [13, 2], [21, -3], [30, 1]],
        [[-12, -1], [-17, -8], [-24, -7], [-29, -12]],
        [[10, -1], [15, 6], [22, 5], [27, 9]]
      ]
      const trace = (pts: number[][]): void => {
        ctx.beginPath()
        pts.forEach(([px, py], i) => {
          const x = f.x + px * k
          const y = f.y + py * k * 0.6
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
      }
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      // ink 粗缝
      ctx.strokeStyle = '#241a12'
      ctx.lineWidth = 2.4
      for (const c of cracks) {
        trace(c)
        ctx.stroke()
      }
      // 缝底暗红幽光（呼吸）
      const em = 0.4 + 0.2 * Math.sin(this.time * 1.7)
      ctx.strokeStyle = `rgba(192,80,96,${em})`
      ctx.lineWidth = 1
      for (const c of cracks) {
        trace(c)
        ctx.stroke()
      }
      ctx.lineCap = 'butt'
      ctx.lineJoin = 'miter'
      return
    }
    const pulse = 0.78 + 0.14 * Math.sin(this.time * 1.8)
    const well=ctx.createRadialGradient(f.x,f.y,1,f.x,f.y,r)
    well.addColorStop(0,'#d7b56d');well.addColorStop(.18,'#594066');well.addColorStop(.7,'#281d3b');well.addColorStop(1,'#100e1b')
    ctx.fillStyle=well;ctx.beginPath();ctx.ellipse(f.x,f.y,r,r*.55,0,0,Math.PI*2);ctx.fill()
    const g = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, r + 10)
    g.addColorStop(0, 'rgba(255,226,122,0.5)')
    g.addColorStop(0.6, 'rgba(170,90,255,0.28)')
    g.addColorStop(1, 'rgba(170,90,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(f.x - r - 10, f.y - r - 10, (r + 10) * 2, (r + 10) * 2)
    ctx.strokeStyle = `rgba(255,226,122,${pulse})`
    ctx.lineWidth = 2.5
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      const spin = this.time * 1.6 + (i * Math.PI * 2) / 3
      ctx.ellipse(f.x, f.y, r - i * 7, (r - i * 7) * 0.55, 0, spin, spin + Math.PI * 1.25)
      ctx.stroke()
    }
    // 撕裂锯齿外口（ink 16 齿）
    ctx.fillStyle = 'rgba(38,20,52,0.85)'
    ctx.strokeStyle = '#241a12'
    ctx.lineWidth = 2
    ctx.beginPath()
    const teeth = 16
    for (let i = 0; i < teeth * 2; i++) {
      const rr = i % 2 === 0 ? r + 6 : r + 1
      const a = (i / (teeth * 2)) * Math.PI * 2
      const x = f.x + Math.cos(a) * rr
      const y = f.y + Math.sin(a) * rr * 0.55
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.strokeStyle='#ad8a6c88';ctx.lineWidth=1.2
    ctx.stroke()
    // 内圈刻痕与慢速漂浮的光屑，保持贴地透视。
    for(let i=0;i<12;i++){
      const a=i/12*Math.PI*2,x=f.x+Math.cos(a)*r*.9,y=f.y+Math.sin(a)*r*.5
      ctx.strokeStyle=i%3?'#95769a77':'#e0bd7ca6';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*3,y+Math.sin(a)*2);ctx.stroke()
    }
    for(let i=0;i<7;i++){
      const phase=(this.time*.24+i/7)%1,a=i*2.4+this.time*.25
      ctx.fillStyle=`rgba(233,206,158,${Math.sin(phase*Math.PI)*.65})`;ctx.beginPath();ctx.ellipse(f.x+Math.cos(a)*r*.65,f.y+Math.sin(a)*r*.3-phase*16,1,1.6,0,0,Math.PI*2);ctx.fill()
    }
    // 中心金心（脉动）
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const hg = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 12)
    hg.addColorStop(0, `rgba(255,238,170,${0.5 * pulse})`)
    hg.addColorStop(1, 'rgba(255,238,170,0)')
    ctx.fillStyle = hg
    ctx.fillRect(f.x - 12, f.y - 12, 24, 24)
    ctx.restore()
    // 交互提示（房间内位置固定，不做距离淡变）
    ctx.textAlign = 'center'
    ctx.font = '12px zpix, "Courier New", monospace'
    ctx.fillStyle = '#ffe9a8'
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'
    ctx.lineWidth = 3
    const hint = t('game.fissure.extract_hint')
    ctx.strokeText(hint, f.x, f.y - r - 10)
    ctx.fillText(hint, f.x, f.y - r - 10)
  }
}

/** 由 RoomDef 的门朝向推导每扇门在墙内缘的格位（纯函数） */
function layoutDoors(def: RoomDef): RuntimeDoor[] {
  const { roomCols: C, roomRows: R, wallThickness: W } = CONFIG
  const groups = new Map<Dir, number[]>()
  for (const ref of def.doors) {
    const list = groups.get(ref.dir) ?? []
    list.push(ref.doorId)
    groups.set(ref.dir, list)
  }
  const out: RuntimeDoor[] = []
  for (const dir of ['N', 'S', 'W', 'E'] as Dir[]) {
    const ids = groups.get(dir) ?? []
    ids.forEach((doorId, i) => {
      let col = 0
      let row = 0
      if (dir === 'W') {
        col = W - 1
        row = slotOnWall(R, ids.length, i)
      } else if (dir === 'E') {
        col = C - W
        row = slotOnWall(R, ids.length, i)
      } else if (dir === 'N') {
        col = slotOnWall(C, ids.length, i)
        row = W - 1
      } else {
        col = slotOnWall(C, ids.length, i)
        row = R - W
      }
      out.push({ doorId, dir, col, row, open: false })
    })
  }
  return out
}

/** 门箭头朝向（从门格指向房间内部） */
const DOOR_ARROW: Record<Dir, { x: number; y: number }> = {
  N: { x: 0, y: 1 },
  S: { x: 0, y: -1 },
  W: { x: 1, y: 0 },
  E: { x: -1, y: 0 }
}
