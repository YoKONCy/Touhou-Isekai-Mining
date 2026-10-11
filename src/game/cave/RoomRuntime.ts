import { SnapshotCodec, type StateFields } from '../../core/simulation/snapshot'
import { nextEntityId, emitSimulationEvent } from '../../core/simulation/events'
import { simulationAppearance, withSimulationAppearance } from '../../shared/playerAppearance'
import { layoutBackgroundRocks } from '../art/floorDecorations'
import { profiler } from '../../core/performance/Profiler'
import { rebuildEnemyGrid,rebuildBlockerGrid,enemyCandidates } from '../CombatSpatial'
import { SpatialGrid } from '../../core/spatial/SpatialGrid'
import { canvasViewport,visible,drawVisibleLayer,type Viewport } from '../../core/rendering/Viewport'
import { roomResourceBudget } from '../../core/rendering/ResourceBudget'
import { OldHellScene } from '../art/oldHellScene'
import { layoutRoomDoors,slotOnWall, type RoomDoorPlacement } from './dungeon/roomDoors'
import { withVisualSeed } from '../../core/simulation/random'
import { KedamaBoss } from '../KedamaBoss'
import { GrimmBoss } from '../GrimmBoss'
import { randomCombat, randomGeneration, randomLoot, randomVisual } from '../../core/simulation/random'
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
import { ROCK_STONE_ID, SILICA_SAND_ID, PICK_RUSTY_ID, SWORD_IRON_ID, DOOMSDAY_ID } from '../../content/items/vanilla/ids'
import { rollEnemyId, fixedEnemyIds, enemies } from '../../content/enemies/registry'
import { weightedPick } from '../../content/core/Registry'
import { SLIME_BLUE_ID } from '../../content/enemies/vanilla/ids'
import { findMineralDef } from '../../content/minerals/registry'
import { DEFAULT_BIOME_ID, biomeDefs, rollEnemyCount, oreRangeForRoom } from '../../content/biomes/registry'
import { searchDensity } from '../../content/search/rules'
import type { SearchRoomContext, SearchEffectContext } from '../../content/search/types'
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
import { renderCollectible } from '../art/collectibleHighlight'
import { WarpField } from '../art/warpField'
import { FogField } from '../art/fogField'
import type { AmbientLevel, LightSource } from '../art/lighting'
import { TileMap, type DoorSlot, type OreTile } from '../tilemap'
import type { Dir, RoomDef } from './dungeon/types'
import type { ScriptedRoomSpec, ScriptedSpawn } from './dungeon/script'
import type { Interactable, ItemInteractData, ChestInteractData } from './interactables'
import { CaveNature, type NatureGather } from '../art/caveNature'
import { WOOD_ID, SLIME_BALL_ID } from '../../content/items/vanilla/ids'
import { damageLabel } from '../../shared/combat'
import { SALTPETER_ID } from '../../content/items/vanilla/materials/saltpeter'
import { PROP_LOGS_ID } from '../../content/props/vanilla/ids'
import { propDefs } from '../../content/props/registry'
import { updateBoomerang } from '../../content/items/vanilla/weapons/boomerang/flight'
import { FurnaceWrecks } from '../art/furnaceWrecks'
import { OLD_FURNACE_PARTS_ID } from '../../content/items/vanilla/ids'
import { CHEST_BASIC_TABLE } from '../../content/loot/vanilla/chestBasic'
import { SEARCH_CHEST_TABLE } from '../../content/loot/vanilla/searchSupplies'
import { itemQualityLevel } from '../../shared/itemQuality'
import { resolveCaveArt } from '../art/caveStyle'
import { drawMineSprite } from '../art/mineAssets'
import { SearchSystem, searchFeedback, type SearchContainer } from '../search/SearchSystem'
import { RoomThreats } from './RoomThreats'
import { RoomNavigation } from './RoomNavigation'
import { drawSearchMarkers, drawGatherMarkers } from '../search/searchMarkers'
import type { SearchView, SearchCommand } from '../../shared/search'

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
export type { PlayerIntent as RoomInput } from '../simulation/PlayerIntent'
import type { PlayerIntent as RoomInput } from '../simulation/PlayerIntent'

/** 同一世界中的独立玩家；个人奖励和操作回调随参与者绑定。 */
export interface RoomParticipant { player: Player; input: RoomInput; host: RoomHost }
interface SceneDraw {x:number;y:number;r:number;draw:(ctx:CanvasRenderingContext2D)=>void}

/** 房间向模块（CaveModule）请求的外部动作 */
export interface RoomHost {
  inventory: Inventory
  /** 为当前玩家提供幸运、事件标记等纯数据；只在首次生成容器奖励时结算。 */
  searchEffects?(player: Player, container: Readonly<SearchContainer>): SearchEffectContext
  collectSearchReward?(id:string):boolean|undefined
  furnaceSearchAllowed?():boolean
  onFurnaceSearch?(found:boolean):void
  claimMiningChest?(): boolean
  /** 仅在敲碎纯普通岩石时调用，剧情宿主负责整趟探索的保底名额。 */
  claimGuaranteedMiningChest?(): boolean
  /** 外部技能弹幕同步参与符卡每一波净化，普通矿洞可省略。 */
  clearEnemyBullets?(x:number,y:number,radius:number):void
  slowEnemyBullets?(duration:number,multiplier:number):void
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

interface RuntimeDoor extends RoomDoorPlacement {
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

/** 房间可指定独立群系，未指定时仍沿用旧矿洞的数量与矿量配置。 */
const currentBiome = (def: RoomDef) => biomeDefs.require(def.biomeId ?? DEFAULT_BIOME_ID)

export interface RoomSnapshot {
  version: 1
  definition: RoomDef
  script: ScriptedRoomSpec | null
  fields: StateFields
  map: ReturnType<TileMap['captureSimulation']>
  props: Prop[]
  nature: ReturnType<CaveNature['captureSimulation']> | null
  wrecks: {all: FurnaceWrecks['all']; colliders: Prop[]} | null
  enemies: Array<{type:string;content:string;x:number;y:number;state:StateFields;definition:import('../../core/simulation/snapshot').StateValue}>
  drops: Array<{item:ItemId;x:number;y:number;state:StateFields}>
  bullets: Array<{content:string;x:number;y:number;angle:number;state:StateFields}>
}

export class RoomRuntime {
  readonly entityId = nextEntityId('room')
  private readonly artStyle: ReturnType<typeof resolveCaveArt>
  private readonly oldHell: OldHellScene | null
  readonly def: RoomDef
  readonly map: TileMap
  texture: HTMLCanvasElement | null
  /** 批次 E：北墙拔高立面层（每帧盖在实体上做遮挡；旧纹理为 null） */
  textureNorth: HTMLCanvasElement | null
  private readonly releasePixels=()=>this.releaseRenderPixels()
  private touchRenderBudget():void {
    if(this.headless)return
    const bytes=(this.texture?.width??0)*(this.texture?.height??0)*4+(this.textureNorth?.width??0)*(this.textureNorth?.height??0)*4+this.map.rasterBytes+(this.nature?.rasterBytes??0)+this.fog.rasterBytes+(this.oldHell?.rasterBytes??0)
    roomResourceBudget.touch(this,bytes,this.releasePixels)
  }
  private releaseRenderPixels():void {
    if(this.texture)this.texture.width=this.texture.height=1
    if(this.textureNorth)this.textureNorth.width=this.textureNorth.height=1
    this.texture=this.textureNorth=null;this.map.releaseRenderResources();this.nature?.releaseRenderResources();this.fog.releaseRenderResources();this.oldHell?.releaseRenderResources()
  }
  releaseRenderResources():void {roomResourceBudget.release(this);this.releaseRenderPixels()}
  private ensureRenderTextures():void {
    if(this.texture||this.headless||this.oldHell)return
    const started=profiler.start(),slots=this.doors.map(door=>({col:door.col,row:door.row}))
    withVisualSeed(this.def.id^Math.imul((this.def.floor??1)+1,0x9e3779b9),()=>{
      if(CONFIG.art.slice){
        const layers=this.script?.theme==='grimm'?createRoomTextureTrial(slots,this.def.id):createRoomTextureE(slots,this.def.id,this.artStyle.floor,this.def.floor??1,this.def.landmark,this.artStyle.scene)
        this.texture=layers.base;this.textureNorth=layers.northFace
      }else {this.texture=createRoomTexture(slots);this.textureNorth=null}
    })
    profiler.end('textureBake',started);this.touchRenderBudget()
  }
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
  private readonly unavailableCollector = { x: 0, y: 0, half: CONFIG.player.half, alive: false }
  readonly doors: RuntimeDoor[]
  readonly fx = new FxLayer()
  /** 批次 F⑤：时空乱流氛围浮层（地面之上、实体之下） */
  private readonly warp = new WarpField()
  /** 批次 F⑦追加：漂浮动态雾气（实体之上、弹幕之下的柔遮罩） */
  private readonly fog = new FogField()
  private readonly search = new SearchSystem()
  searchView(player: Player): SearchView | null { return this.search.view(player, this.time) }
  cancelSearch(player: Player): void { this.search.cancel(player) }
  cancelSearches(): void { this.search.cancelAll(this.knownPlayers) }
  hasSearchSession(player: Player): boolean { return this.search.hasSession(player) }
  get searchContainers(): readonly SearchContainer[] { return this.search.containers }
  renderSearchMarkers(ctx: CanvasRenderingContext2D): void {
    drawSearchMarkers(ctx, this.search.containers, this.time)
    if (this.nature) drawGatherMarkers(ctx, this.nature.gathers, this.time)
  }
  private takeSearch(player: Player, containerId: string, slot: number, host: RoomHost): void {
    if (player.isChanneling) return
    const container=this.search.container(containerId)
    if(!container||!this.canReachSearch(player,container))return
    if (this.search.blockedByOther(player, containerId)) {
      this.fx.damageText(player.x, player.y - 26, t('game.search.busy_other'), '#c9b99b')
      return
    }
    const added = this.search.take(player, containerId, slot, host.inventory, stack => {
      this.fx.withPickupOwner(player.entityId, player.x, player.y, () => this.fx.pickupText(stack.id, stack.qty, '#e5d4af'))
      host.onItemFound?.(stack.id)
      emitSimulationEvent({ type: 'pickup', source: containerId, collector: player.entityId, item: stack.id, quantity: stack.qty })
    },host.collectSearchReward)
    if (added) sfx.searchTake()
    else if (this.search.view(player, this.time)?.slots.some(s => s.revealed && s.item)) this.fx.damageText(player.x, player.y - 26, t('game.notify.bag_full'), '#ff9a7a')
    const view = this.search.view(player, this.time)
    if (view?.complete && !view.slots.some(s => s.item)) this.search.cancel(player)
  }

  readonly fissure: { x: number; y: number; active: boolean } | null

  private enemies: Enemy[] = []
  private readonly doomsday = new DoomsdayRoom({
    fx: this.fx, enemies: () => this.enemies, time: () => this.time,
    onEnemyKilled: (enemy, host) => this.onEnemyKilled(enemy, host)
  })
  private doomsdayOwner: string | null = null
  private readonly ownerDoomsday = new Map<string, DoomsdayRoom>()
  private doomFor(player: Player): DoomsdayRoom {
    if (this.doomsdayOwner === null) this.doomsdayOwner = player.entityId
    if (this.doomsdayOwner === player.entityId) return this.doomsday
    let effect = this.ownerDoomsday.get(player.entityId)
    if (!effect) {
      effect = new DoomsdayRoom({fx:this.fx,enemies:()=>this.enemies,time:()=>this.time,onEnemyKilled:(enemy,host)=>this.onEnemyKilled(enemy,host)})
      this.ownerDoomsday.set(player.entityId,effect)
    }
    return effect
  }

  clearDoomsday(player: Player): void {
    const effect=this.doomsdayOwner===player.entityId?this.doomsday:this.ownerDoomsday.get(player.entityId)
    effect?.clear(player)
  }
  renderDoomsday(ctx: CanvasRenderingContext2D, player: Player): void {
    // 表现层只读取已存在的状态，不能因绘制频率不同创建新的模拟组件。
    const effect=this.doomsdayOwner===player.entityId?this.doomsday:this.ownerDoomsday.get(player.entityId)
    effect?.render(ctx,player)
  }

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
    owner?: string
    render?: NonNullable<SpellCardDef['targetFx']>['render']
  }> = []
  /** 延迟符卡脉冲（多波次符卡：第二波及以后排期；触发时以玩家当前位置为中心） */
  private pendingSpellPulses: Array<{
    delay: number
    spellId: ItemId
    def: SpellCardDef
    pulse: number
    damageBonus:number
    owner?:string
    channel?:boolean
  }> = []
  private bulletSlowRemaining = 0
  private bulletSlowMultiplier = 1
  private cleared: boolean
  /** 批次 E：火把开始点燃时刻；null=从未点燃，负值=建房前已亮（空房） */
  private litStart: number | null = null
  /** 旧地狱清场后的散雾起点，随模拟时间与房间快照保存。 */
  private fogClearStart: number | null = null
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
  private readonly deathNotifiedPlayers = new Set<string>()
  private readonly settledKills = new Set<string>()
  private readonly interactionHints = new Map<string, string | null>()
  private readonly playerEntities = new Map<string, Player>()
  private knownPlayers:Player[]=[]
  private playerScratch:Player[]=[]
  private livingScratch:RoomParticipant[]=[]
  private inventorySpace=new WeakMap<Inventory,Map<string,boolean>>()
  private bladeScratch:ReturnType<Player['getProjectileErasure']>[number][]=[]
  private separationGrid=new SpatialGrid<Enemy>()
  private separationCandidates:Enemy[]=[]
  private staticDraws:SceneDraw[]=[]
  private dynamicDraws:SceneDraw[]=[]
  private actorDraws=new WeakMap<object,SceneDraw>()
  private collisionNext:Prop[]=[]
  private collisionRecords=new WeakMap<Prop,{x:number;y:number;s:number;id:string;w:number|undefined;h:number|undefined;segments:Prop['segments'];block:boolean|undefined;definition:unknown}>()
  private staticDrawKey=''
  private prepareStaticDraws():void {
    const key=`${this.map.oreRevision}:${this.props.length}:${this.plants?.ground.length}:${this.wrecks?.all.length}:${this.nature?.gathers.length}:${this.nature?.wood.length}:${this.interactables.length}:${this.extraSortables.length}`
    if(this.staticDrawKey===key)return
    this.staticDrawKey=key;const out=this.staticDraws;out.length=0
    const add=(x:number,y:number,r:number,draw:SceneDraw['draw'])=>out.push({x,y,r,draw})
    if(this.plants){const plants=this.plants;for(const p of plants.ground)add(p.x,p.y,180,g=>plants.renderGround(g,p,this.time))}
    if(this.wrecks){const wrecks=this.wrecks;for(const w of wrecks.all)add(w.x,w.y,150,g=>wrecks.render(g,w,this.time,this.wreckSearchAllowed))}
    for(const prop of this.props)add(prop.x,prop.y,180*prop.s,g=>renderProp(g,prop,this.time))
    if(this.nature){const nature=this.nature;for(const p of nature.gathers)add(p.x,p.y,100,g=>{if(!p.done)nature.renderGather(g,p,this.time)});for(const p of nature.wood)add(p.x,p.y,100,g=>{if(p.hp>0)nature.renderWood(g,p)})}
    for(const it of this.interactables){if(it.kind==='item')add(it.x,it.y,100,g=>{if(!it.done)this.renderGroundItem(g,it)});else if(it.kind==='chest')add(it.x,it.y,90,g=>this.renderChest(g,it))}
    for(const building of this.oldHell?.buildings??[])add(building.x,building.y,building.radius,g=>this.oldHell!.renderBuilding(g,building,this.knownPlayers))
    for(const rock of this.oldHell?.rocks.formations??[])add(rock.x,rock.y,rock.radius,g=>this.oldHell!.rocks.render(g,rock,this.knownPlayers))
    if(this.oldHell)for(const door of this.doors)add((door.col+.5)*this.map.tile,(door.row+.5)*this.map.tile+38,225,g=>this.oldHell!.renderDoorway(g,door,this.time,this.knownPlayers))
    for(const ex of this.extraSortables)add(0,ex.y,Infinity,g=>ex.draw(g,this.time))
    this.map.forEachOre(ore=>add((ore.col+.5)*CONFIG.tile+ore.offsetX,(ore.row+1)*CONFIG.tile-2+ore.offsetY,CONFIG.tile*2,g=>drawOreCrystals(g,ore,this.time)))
    out.sort((a,b)=>a.y-b.y)
  }
  private drawActors(ctx:CanvasRenderingContext2D,players:readonly Player[],view:Viewport):void {
    this.prepareStaticDraws();const dynamic=this.dynamicDraws;dynamic.length=0
    const add=(entity:Player|Enemy|Drop,r:number)=>{
      let draw=this.actorDraws.get(entity);if(!draw){draw={x:0,y:0,r,draw:g=>entity.render(g)};this.actorDraws.set(entity,draw)}
      draw.x=entity.x;draw.y=entity.y;draw.r=r;if(visible(view,draw.x,draw.y,draw.r))dynamic.push(draw)
    }
    for(const drop of this.drops)add(drop,40)
    for(const enemy of this.enemies)add(enemy,enemy.def.tags?.includes('boss')?700:240)
    for(const player of players)add(player,450)
    dynamic.sort((a,b)=>a.y-b.y)
    let i=0,j=0,count=0
    while(i<this.staticDraws.length||j<dynamic.length){
      const fixed=this.staticDraws[i],moving=dynamic[j]
      const next=moving&&(!fixed||moving.y<=fixed.y)?dynamic[j++]:this.staticDraws[i++]
      if(visible(view,next.x,next.y,next.r)){next.draw(ctx);count++}
    }
    profiler.count('drawnObjects',count)
  }
  rememberPlayers(players:readonly Player[]):void {
    if(players.length===this.knownPlayers.length&&players.every((player,index)=>player===this.knownPlayers[index]))return
    this.playerEntities.clear()
    for(const player of players){if(this.playerEntities.has(player.entityId))throw new Error('房间收到重复玩家');this.playerEntities.set(player.entityId,player)}
    this.knownPlayers=Array.from(players)
  }
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
  private readonly threats = new RoomThreats()
  private readonly navigation = new RoomNavigation()
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

  /** 房间的搜索经济上下文只含纯数据，区域与特殊字段可由未来场景直接提供。 */
  private searchContext(): SearchRoomContext {
    return { floor: this.def.floor ?? 1, biomeId: this.def.biomeId ?? DEFAULT_BIOME_ID,
      roomKind: this.def.kind, regionId: this.def.searchRegion, fields: this.def.searchFields, profile: this.def.searchProfile }
  }

  /**
   * @param script 固定脚本房间规格（序章；普通房省略）
   */
  constructor(def: RoomDef, spawnX: number, spawnY: number, script?: ScriptedRoomSpec, private readonly headless = false) {
    this.def = def
    this.script = script ?? null
    if (script?.manualTorches) this.manualTorch = true
    const biome = currentBiome(def)
    this.artStyle = resolveCaveArt(biome, def.floor ?? 1)
    let backgroundRocks:readonly import('../art/floorDecorations').BackgroundRock[]=[]
    // 脚本房按固定表计数；普通房和陷阱房共用楼层预算，陷阱房选择偏多的一档。
    this.enemyTotal = script?.spawns ? script.spawns.length : script?.enemyRange
      ? script.enemyRange[0]+Math.floor(randomGeneration()*(script.enemyRange[1]-script.enemyRange[0]+1))
      : biome.emptyContent?0:rollEnemyCount(biome, def)+(!script?fixedEnemyIds(def.kind,def.floor??1,biome.enemyIds).length+(def.extraEnemies?.length??0):0)
    this.doors = layoutRoomDoors(def)
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
      terrain:def.terrain,
      mineralIds:biome.mineralIds,
      lavaBankMinerals:script?.noOre?undefined:biome.lavaBankMinerals,
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
    this.oldHell=biome.environment==='old_hell'&&def.terrain?new OldHellScene(this.map,def.terrain):null
    if(this.oldHell){
      this.texture=this.textureNorth=null;this.torches=[];this.vents=[]
      this.props=this.oldHell.containerProps
    } else if (CONFIG.art.slice) {
      if (script?.theme === 'grimm') {
        // 猩红圣堂斗场：黑石砖地 + 仪式法阵 + 黑石裙墙 + 帷幔立面 + 落地火盆（无矿洞杂物）
        const layers = headless ? null : createRoomTextureTrial(doorSlots, def.id)
        this.texture = layers?.base ?? null
        this.textureNorth = layers?.northFace ?? null
        this.torches = []
        this.vents = []
      } else {
        // 批次 E：石板地 + 岩壁立面 + 坑木支架（双层）+ 墙上火把 + 苔藓地缝
        const art = this.artStyle
        const layers = headless ? null : createRoomTextureE(doorSlots, def.id, art.floor, def.floor ?? 1, def.landmark, art.scene)
        backgroundRocks=layers?.backgroundRocks ?? layoutBackgroundRocks(CONFIG.roomCols*CONFIG.tile,CONFIG.roomRows*CONFIG.tile,CONFIG.wallThickness*CONFIG.tile,CONFIG.tile,doorSlots,def.id,art.floor,art.scene.boneFragments)
        this.texture = layers?.base ?? null
        this.textureNorth = layers?.northFace ?? null
        this.torches = layoutTorches(doorSlots)
        this.vents = layoutSteamVents(doorSlots, def.id)
      }
      const art = this.artStyle
      this.props = script?.noProps ? [] : layoutProps(doorSlots, def.id, spawnX, spawnY, this.vents, orePoints, this.searchContext()).map(p=>({...p,artStyle:art.scene}))
    } else {
      this.texture = headless ? null : withVisualSeed(def.id^Math.imul((def.floor??1)+1,0x9e3779b9),()=>createRoomTexture(doorSlots))
      this.textureNorth = null
      this.torches = []
      this.vents = []
      this.props = []
    }
    // 第三房的教学矿车固定在入口附近，清掉覆盖它的矿格与随机摆件。
    for (const fixed of script?.searchProps ?? []) {
      this.map.setStoryArea(fixed.x - 48, fixed.y - 56, fixed.x + 48, fixed.y + 32)
      const props = this.props as Prop[]
      for (let i = props.length - 1; i >= 0; i--) if (Math.hypot(props[i]!.x - fixed.x, props[i]!.y - fixed.y) < 100) props.splice(i, 1)
      props.push({ id: fixed.id, x: fixed.x, y: fixed.y, s: fixed.s ?? 1, seed: def.id + 17, artStyle: this.artStyle.scene })
    }
    for (let i = 0; i < this.props.length; i++) {
      const prop = this.props[i]!, definition = propDefs.get(prop.id), searchable = definition?.search
      if (searchable) this.search.add({ id: `${this.entityId}:prop:${i}`, x: prop.x, y: prop.y, range: Math.max(80, (definition!.halfWidth + 48) * prop.s), cols:searchable.cols,rows: searchable.rows, table: searchable.table,
        kind: searchable.cols === 2 ? 'small' : searchable.cols === 3 ? 'large' : 'chest', sourceId: prop.id, context: this.searchContext(), profile: searchable.profile,
        fields: typeof searchable.fields?.markerHeight === 'number' ? {...searchable.fields,markerHeight:searchable.fields.markerHeight*prop.s} : searchable.fields,
        nameKey: `prop.${prop.id}.name`, ref: script?.searchProps?.find(p => p.x === prop.x && p.y === prop.y)?.ref })
    }
    this.steam = new SteamVents(this.vents)
    if (!script?.noNature && !script && (!biome.emptyContent||biome.gatherSpawns)) {
      // 非采矿的背景岩块与石质摆件均逐块判定，TileMap 中可挖的岩石不在此表。
      const gatherRocks=[...backgroundRocks,...this.props.filter(p=>propDefs.get(p.id)?.tags?.includes('rock')).map(p=>({x:p.x,y:p.y,radius:(propDefs.get(p.id)?.halfWidth??18)*p.s+18}))]
      this.nature = new CaveNature(this.map, this.props, spawnX, spawnY, def.floor ?? 1, gatherRocks,
        biome.gatherSpawns?{spawns:biome.gatherSpawns,terrain:def.terrain}:undefined)
      if(!biome.gatherSpawns){
        this.plants = new CavePlants(this.map, doorSlots, def.id, this.nature.waterBanks)
        this.nature.attachHangingFruit(this.plants.fruitAnchors,def.floor??1)
      }
    }

    if (script?.spawns) {
      // 脚本房：固定点位刷怪（delay>0 的进延迟队列，update 中到期出场）
      // aggressive：剧情房怪物出生即索敌，不等玩家走进视野
      for (const sp of script.spawns) {
        if ((sp.delay ?? 0) > 0) this.pendingSpawns.push(sp)
        else this.spawnEnemyAt(sp.id, sp.x, sp.y, sp.burrow === true, script.aggressive === true)
      }
    } else if(!biome.emptyContent) {
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
        const phase=randomGeneration()*Math.PI*2, count=Math.max(16,Math.ceil(radius*2*Math.PI/24))
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
    // 奖励房只在首次构造时判定，不占挖矿宝箱名额；重访与续战复用已保存实体。
    if(def.kind==='reward'&&!script&&!biome.emptyContent&&randomGeneration()<.25){
      const {left,right,top,bottom}=this.map.bounds
      let spot:{x:number;y:number}|undefined
      for(let attempt=0;attempt<80&&!spot;attempt++){
        const x=attempt===0?(left+right)/2:left+40+randomGeneration()*(right-left-80)
        const y=attempt===0?(top+bottom)/2:top+40+randomGeneration()*(bottom-top-80)
        if(this.canPlacePlayer(x,y,28)&&!this.props.some(p=>circleHitsProp(x,y,32,p))&&!this.nature?.gathers.some(p=>Math.hypot(p.x-x,p.y-y)<52)&&!this.nature?.wood.some(p=>Math.hypot(p.x-x,p.y-y)<70)&&!this.wrecks?.all.some(p=>Math.hypot(p.x-x,p.y-y)<70))spot={x,y}
      }
      if(spot)this.addChestInteractable(spot.x,spot.y)
    }
    // 无怪房间（入口/奖励）默认解封；末间/普通房清场后解封
    // 脚本房在有延迟怪时 enemyTotal 已计入，不会误入此分支；startLocked 强制初始锁门
    this.cleared = this.enemyTotal === 0 && !script?.startLocked && def.encounter!=='survival'
    if (this.cleared) {
      // 环境探索房可能开局没有敌人，撤离裂隙也应同步激活。
      if(this.fissure)this.fissure.active=true
      for (const d of this.doors) {
        d.open = true
        this.map.openDoor(d.col, d.row)
      }
      // 旧地狱空房也从浓雾开始渐散，其余空房沿用常亮逻辑。
      if(this.oldHell)this.fogClearStart=this.time
      else if (!this.manualTorch) this.litStart = -10
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
    if(!script)this.threats.initialize(this.map,biome)
    this.refreshCollisionProps()
    this.touchRenderBudget()
  }
  canPlacePlayer(x:number,y:number,r:number):boolean {
    const b=this.map.bounds
    if(x-r<b.left||x+r>b.right||y-r<b.top||y+r>b.bottom)return false
    for(const [dx,dy] of [[0,0],[-r,0],[r,0],[0,-r],[0,r]])if(this.map.solidAtWorld(x+dx,y+dy))return false
    return !this.collisionProps.some(prop=>circleHitsProp(x,y,r,prop))&&!this.enemies.some(enemy=>enemy.alive&&Math.hypot(enemy.x-x,enemy.y-y)<enemy.r+r)
  }

  /** 无头演练可明确请求首领换段，剧情演出仍由正式导演控制。 */
  beginBossSecondStage():void {
    for(const enemy of [...this.enemies])if(enemy instanceof KedamaBoss&&enemy.stage===1){this.summonBossGuardian(enemy);enemy.beginSecondStage()}
  }
  summonBossGuardian(boss:Enemy):Enemy {
    const normal=enemies.require('touhou:slime_guardian'),b=this.map.bounds
    const x=Math.max(b.left+55,Math.min(b.right-55,boss.x+85)),y=Math.max(b.top+55,Math.min(b.bottom-55,boss.y+35))
    const guardian=new Enemy(x,y,normal.id,{...normal,hp:normal.hp*1.5})
    guardian.startBurrowSpawn();guardian.alert();this.addEnemy(guardian)
    return guardian
  }
  get snapshotEnemies():readonly Enemy[]{return this.enemies}

  /** 注册活跃实体与静态碰撞物，命中集合恢复为同一批对象引用。 */
  bindSnapshotReferences(codec: SnapshotCodec): void {
    for(const entity of [...this.enemies,...this.drops,...this.bullets])codec.add(entity)
    this.map.forEachOre(ore=>codec.reference(ore.entityId??`${this.entityId}:ore:${ore.col}:${ore.row}`,ore))
    this.props.forEach((prop,index)=>codec.reference(`${this.entityId}:prop:${index}`,prop))
    this.nature?.wood.forEach((wood,index)=>codec.reference(`${this.entityId}:wood:${index}`,wood))
    this.nature?.gathers.forEach((gather,index)=>codec.reference(`${this.entityId}:gather:${index}`,gather))
    this.interactables.forEach(item=>codec.reference(`${this.entityId}:interact:${item.id}`,item))
  }
  captureSimulation(codec = new SnapshotCodec()): RoomSnapshot {
    this.bindSnapshotReferences(codec)
    const keys=['entityId','enemyTotal','cleared','doors','fissure','litStart','fogClearStart','manualTorch','torchesEnabled','litTorchAt','visited','deathNotified','deathNotifiedPlayers','settledKills','doomsdayOwner','time','interactSeq','pendingSpawns','roomAlerted','enemiesFrozen','prismaClock','prismaArmed','prismaPoints','pendingSpellPulses','bulletSlowRemaining','bulletSlowMultiplier','weaponImpacts','survivalElapsed','survivalWave','survivalComplete','doomsday','search','threats']
    const fields:StateFields={}
    const source=this as unknown as Record<string,unknown>
    for(const key of keys)fields[key]=codec.encode(source[key])
    // 交互物自身是完整数据，其他状态中的引用才编码为实体标识。
    fields.interactables= this.interactables.map(item=>({$type:'object',fields:codec.capture(item)}))
    fields.ownerDoomsday = [...this.ownerDoomsday].map(([owner,effect])=>({owner,state:codec.capture(effect,['room'])}))
    return {version:1,definition:structuredClone(this.def),script:this.script?structuredClone(this.script):null,fields,map:this.map.captureSimulation(),
      props:structuredClone(this.props) as Prop[],nature:this.nature?.captureSimulation()??null,
      wrecks:this.wrecks?{all:structuredClone(this.wrecks.all),colliders:structuredClone(this.wrecks.colliders)}:null,
      enemies:this.enemies.map(enemy=>({type:enemy.simulationKind,content:enemy.def.id,x:enemy.x,y:enemy.y,state:enemy.captureSimulation(codec),definition:codec.encode(enemy.def)})),
      drops:this.drops.map(drop=>({item:drop.itemId,x:drop.x,y:drop.y,state:drop.captureSimulation(codec)})),
      bullets:this.bullets.map(bullet=>({content:bullet.projectileId,x:bullet.x,y:bullet.y,angle:bullet.angle,state:bullet.captureSimulation(codec)}))}
  }
  /** 先重建所有实例并登记 ID，再恢复引用、计时与技能队列。 */
  restoreSimulation(snapshot:RoomSnapshot,codec = new SnapshotCodec()):void {
    if(snapshot.version!==1||snapshot.definition.id!==this.def.id)throw new Error('房间快照不兼容')
    ;(this as {entityId:string}).entityId=String(snapshot.fields.entityId)
    this.map.restoreSimulation(snapshot.map)
    ;(this.props as Prop[]).splice(0,this.props.length,...structuredClone(snapshot.props))
    if(snapshot.nature){
      if(!this.nature)this.nature=new CaveNature(this.map,this.props,0,0,0)
      this.nature.restoreSimulation(snapshot.nature)
    }else this.nature=null
    if(snapshot.wrecks){
      if(!this.wrecks)this.wrecks=new FurnaceWrecks(this.map,this.props,{x:0,y:0},[],[])
      this.wrecks.all.splice(0,this.wrecks.all.length,...structuredClone(snapshot.wrecks.all))
      this.wrecks.colliders.splice(0,this.wrecks.colliders.length,...structuredClone(snapshot.wrecks.colliders))
    }else this.wrecks=null
    this.enemies=snapshot.enemies.map(record=>{
      const enemy=record.type==='kedama'?new KedamaBoss(record.x,record.y):record.type==='grimm'?new GrimmBoss(record.x,record.y):new Enemy(record.x,record.y,record.content,codec.decode(record.definition) as import('../../content/enemies/types').EnemyDef)
      ;(enemy as {entityId:string}).entityId=String(record.state.entityId);return enemy
    })
    this.drops=snapshot.drops.map(record=>{const drop=new Drop(record.x,record.y,record.item);(drop as {entityId:string}).entityId=String(record.state.entityId);return drop})
    this.bullets=snapshot.bullets.map(record=>{const bullet=new Projectile(record.x,record.y,record.angle,record.content);(bullet as {entityId:string}).entityId=String(record.state.entityId);return bullet})
    // 完整数据先解码，随后登记被引用的交互物。
    this.interactables=codec.decode(snapshot.fields.interactables!) as Interactable[]
    this.bindSnapshotReferences(codec)
    const {interactables,ownerDoomsday,...fields}=snapshot.fields
    codec.restore(this,fields)
    // 旧快照没有散雾计时；未清场的房间不能继承构造时空房的散雾起点。
    if(this.oldHell&&!('fogClearStart' in fields))this.fogClearStart=this.cleared?(this.litStart!==null&&this.litStart>=0?this.litStart:this.time):null
    this.ownerDoomsday.clear()
    for (const record of (ownerDoomsday ?? []) as Array<{owner:string;state:StateFields}>) {
      const effect = new DoomsdayRoom({fx:this.fx,enemies:()=>this.enemies,time:()=>this.time,onEnemyKilled:(enemy,host)=>this.onEnemyKilled(enemy,host)})
      codec.restore(effect,record.state);this.ownerDoomsday.set(record.owner,effect)
    }
    snapshot.enemies.forEach((record,index)=>this.enemies[index]!.restoreSimulation(record.state,codec))
    snapshot.drops.forEach((record,index)=>this.drops[index]!.restoreSimulation(record.state,codec))
    snapshot.bullets.forEach((record,index)=>this.bullets[index]!.restoreSimulation(record.state,codec))
    this.nearbyInteractable=null;this.spellFx=[];this.prismaBlasts=[]
    this.interactionHints.clear()
    this.staticDrawKey='';this.actorDraws=new WeakMap()
    this.refreshCollisionProps()
    // 兼容已经清场、但旧逻辑遗留了门标记与瓦片不一致的第五层续战快照。
    if(this.oldHell&&this.cleared&&!this.script)this.setDoorsOpen(true,true)
  }

  /** 房间光源（本帧） */
  getRoomLights(view?: ViewBounds): LightSource[] {
    if (!CONFIG.art.slice) return []
    const T = CONFIG.art.torch
    const out: LightSource[] = []
    this.oldHell?.appendLights(out,this.time,view)
    // 自发光怪物优先照亮近景；最多八盏小灯，死亡环弹不逐颗增加环境光源。
    let enemyLights=0
    for(let priority=1;priority>=0;priority--)for(const enemy of this.enemies){
      const light=enemy.def.visual.light
      if(!light||Math.min(1,light.priority??0)!==priority||!enemy.alive||enemy.emerging||enemyLights>=8)continue
      const position=enemy.renderPosition,r=light.radius
      if(view&&(position.x+r<view.x||position.x-r>view.x+view.w||position.y+r<view.y||position.y-r>view.y+view.h))continue
      out.push({x:position.x,y:position.y-5,r,power:light.power,color:light.color,tint:light.tint})
      enemyLights++
    }
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
      if (s.render) continue
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
    if(this.oldHell)return {center:.1,edge:.25,cc:'28,25,20',ec:'20,21,18'}
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
      if (this.artStyle.scene.deepHollow) {
        const D = CONFIG.art.deepHollowAmbient
        return this.cleared ? { center: D.litCenter, edge: D.litEdge } : { center: D.dimCenter, edge: D.dimEdge }
      }
      return this.cleared ? { center: A.litCenter, edge: A.litEdge } : { center: A.dimCenter, edge: A.dimEdge }
    }
    return null
  }

  /** 漆黑态：手动火把房一根未点（CaveModule 据此收紧帽灯视域） */
  get pitchBlack(): boolean {
    return this.manualTorch && this.litTorchAt.size === 0
  }

  get aliveEnemies(): number {
    let count=0;for(const enemy of this.enemies)if(enemy.alive)count++;return count
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
    this.bulletSlowRemaining = 0; this.bulletSlowMultiplier = 1
    for (const enemy of this.enemies) enemy.clearPendingAttacks()
    for(const member of new Set([player,...this.playerEntities.values()])) {
      member.meleeEchoes.length=0
      member.areaBurst=null
      member.tarot.clear(); member.bow.clear(); member.scp127.clearFlights(); member.rangedFlight = null; member.cancelCharge(); this.clearDoomsday(member)
    }
  }
  /** 退出参与者只清除自己的待发攻击和资源效果，不清掉队友弹幕。 */
  detachPlayer(player:Player):void {
    player.meleeEchoes.length=0
    player.areaBurst=null
    this.search.cancel(player)
    this.clearDoomsday(player)
    this.ownerDoomsday.delete(player.entityId)
    this.pendingSpellPulses=this.pendingSpellPulses.filter(pulse=>pulse.owner!==player.entityId)
    this.spellFx=this.spellFx.filter(effect=>effect.owner!==player.entityId)
    this.deathNotifiedPlayers.delete(player.entityId);this.interactionHints.delete(player.entityId)
    this.playerEntities.delete(player.entityId)
    this.fx.removePickupOwner(player.entityId)
    player.tarot.clear();player.bow.clear();player.scp127.clearFlights();player.rangedFlight=null
    for(const enemy of this.enemies)if(enemy.targetId===player.entityId)enemy.targetId=null
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
  hintFor(player: Player): string | null { return this.interactionHints.get(player.entityId) ?? null }

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

  /** 宝箱使用4×4搜索托盘，默认走独立的正式宝箱池。 */
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
    this.search.add({ id: `${this.entityId}:chest:${it.id}`, x, y, range: 70, cols:4,rows:4,nameKey: 'ui.search.chest', table:table===CHEST_BASIC_TABLE?SEARCH_CHEST_TABLE:table,chestId: it.id,
      kind: 'chest', context: this.searchContext() })
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
   * 翻 cleared 牌，按环境触发散雾或点火，同时解封各门并净化弹幕。
   * 节拍由导演掌控，清场台词念完再调用。
   */
  storyClear(): void {
    if (this.cleared) return
    this.cleared = true
    emitSimulationEvent({type:'clear',room:this.def.id})
    this.bullets = []
    this.threats.clear()
    if(this.oldHell)this.fogClearStart=this.time
    else if (!this.manualTorch) {this.litStart = this.time;sfx.torchIgnite()}
    this.setDoorsOpen(true)
    if (this.enemyTotal > 0) sfx.roomClear()
  }

  /** 门控：强制开/关全部门（剧情锁门/解封；关门用于"进房即锁"演出） */
  setDoorsOpen(open: boolean, quiet = false): void {
    for (const d of this.doors) {
      if (open) {
        const changed=this.map.openDoor(d.col,d.row)
        d.open=true
        if (changed) {
          if (!quiet) {
            sfx.doorOpen()
            const cx = d.col * CONFIG.tile + CONFIG.tile / 2
            const cy = d.row * CONFIG.tile + CONFIG.tile / 2
            this.fx.burst(cx, cy, -Math.PI / 2, 10)
          }
        }
      } else {
        this.map.closeDoor(d.col,d.row);d.open=false
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
        const x = bounds.left + pad + randomCombat() * (bounds.right - bounds.left - pad * 2)
        const y = bounds.top + pad + randomCombat() * (bounds.bottom - bounds.top - pad * 2)
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
      seed: randomVisual() * Math.PI * 2
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
    this.deathNotifiedPlayers.clear()
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

  /** 残屋容器必须沿无遮挡方向接近，不能站在外墙另一侧隔墙翻找。 */
  private canReachSearch(player:Player,container:SearchContainer):boolean {
    if(!this.oldHell)return true
    const dx=container.x-player.x,dy=container.y-player.y,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/(this.map.tile*.2)))
    for(let i=1;i<=steps;i++)if(this.map.solidAtWorld(player.x+dx*i/steps,player.y+dy*i/steps))return false
    return true
  }

  /** 首次成功翻找后打开实体；中断、换人和重新打开均不重播铁柜的开锁演出。 */
  private beginSearch(player:Player,container:SearchContainer,host:RoomHost):boolean {
    if(!this.canReachSearch(player,container))return false
    const first=container.slots===null
    if(!this.search.begin(player,container,first?host.searchEffects?.(player,container):undefined))return false
    if(first){
      const prop=this.props.find(p=>p.id===container.sourceId&&p.x===container.x&&p.y===container.y)
      if(prop)prop.searchOpenedAt=this.time
    }
    if(first&&container.fields?.advanced===true){
      sfx.sealedCabinetOpen();this.fx.searchDust(container.x,container.y-24)
    }else sfx.searchOpen()
    return true
  }

  /** 每帧刷新最近交互物提示，并在 F 按下时结算（item/torch/chest 内置；special 回调导演） */
  private updateInteractables(player: Player, input: RoomInput, host: RoomHost): void {
    if (player.isChanneling) return
    const currentSearch = this.search.view(player, this.time)
    if (currentSearch && input.interactPressed) {
      const container = this.search.container(currentSearch.id)!
      this.nearbyInteractable = { id: -3, kind: 'search', x: container.x, y: container.y, range: container.range, hint: t(currentSearch.searching ? 'game.search.searching' : currentSearch.slots.some(s => s.item) ? 'game.search.take_hint' : 'game.search.hint'), oneShot: false, done: false }
      if (currentSearch.slots.some(s => s.item)) this.takeSearch(player, currentSearch.id, -1, host)
      else if (!currentSearch.complete && !currentSearch.searching && !(input.moveX || input.moveY || input.attackHeld || input.specialHeld || input.dodgeHeld || input.dodgePressed)) {
        if (!this.beginSearch(player, container, host)) this.fx.damageText(player.x, player.y - 24, t('game.search.busy'), '#c9b99b')
      }
      return
    }
    let nearest: Interactable | null = null
    let nearestDistanceSq = Infinity
    for (const it of this.interactables) {
      if (it.done || it.kind === 'chest') continue
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
    const target = this.search.nearest(player,container=>this.canReachSearch(player,container))
    if (target) {
      const distance = (target.x - player.x) ** 2 + (target.y - player.y) ** 2
      if (distance < nearestDistanceSq) {
        nearestDistanceSq = distance
        nearest = { id: -3, kind: 'search', x: target.x, y: target.y, range: target.range, hint: t(target.complete ? 'game.search.take_hint' : 'game.search.hint'), oneShot: false, done: false, data: target.id, ref: target.ref }
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
    if (it.kind === 'search') {
      const container = this.search.container(String(it.data))
      if (container && container.revealed > 0 && container.slots?.some(Boolean)) {
        if (this.search.open(player, container)) this.takeSearch(player, container.id, -1, host)
        else if (this.search.blockedByOther(player, container.id)) this.fx.damageText(player.x, player.y - 24, t('game.search.busy_other'), '#c9b99b')
        return
      }
      if (input.moveX || input.moveY || input.attackHeld || input.specialHeld || input.dodgeHeld || input.dodgePressed) return
      if (container && !this.beginSearch(player, container, host)) this.fx.damageText(player.x, player.y - 24, t('game.search.busy'), '#c9b99b')
    } else if (it.kind === 'item') {
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
    } else {
      // special：只回调，行为（对话/开门/转阶段）完全由导演定义
      if (it.oneShot) it.done = true
      host.onInteract?.(it)
    }
  }

  /** 五秒一批增援；三十秒只解封和点灯，不清理敌人或弹幕。 */
  private updateSurvival(dt:number,player:Player):void{
    this.survivalElapsed=Math.min(30,this.survivalElapsed+dt)
    while(this.survivalWave<5&&this.survivalElapsed>=(this.survivalWave+1)*5){
      this.survivalWave++
      const count=randomCombat()<1/3?1:2,{left,right,top,bottom}=this.map.bounds
      for(let n=0;n<count;n++){
        const id=rollEnemyId('normal',this.def.depth,this.def.floor??1,currentBiome(this.def).enemyIds);if(!id)continue
        const definition=enemies.require(id),radius=definition.radius+3
        let point:{x:number;y:number}|null=null
        for(let tries=0;tries<160;tries++){
          const x=left+radius+randomCombat()*(right-left-radius*2),y=top+radius+randomCombat()*(bottom-top-radius*2)
          if(Math.hypot(x-player.x,y-player.y)<110||this.enemies.some(e=>e.alive&&Math.hypot(e.x-x,e.y-y)<e.r+radius+12)||this.props.some(p=>circleHitsProp(x,y,radius,p))||this.wrecks?.colliders.some(p=>circleHitsProp(x,y,radius,p)))continue
          if([[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]].some(([dx,dy])=>this.map.solidAtWorld(x+dx!,y+dy!)))continue
          point={x,y};break
        }
        if(!point)continue
        const kind=definition.movement==='stationary'?'burrow':definition.movement==='flying'?'ceiling':randomCombat()<.5?'burrow':'ceiling'
        const enemy=new Enemy(point.x,point.y,id);enemy.startEncounterSpawn(kind);enemy.alert();this.enemies.push(enemy);this.enemyTotal++
        if(kind==='burrow')sfx.burrowWarn(Math.max(-.7,Math.min(.7,(point.x-player.x)/430)))
      }
    }
    if(this.survivalElapsed>=30){
      this.survivalComplete=true
      if(!this.oldHell){this.litStart=this.time;sfx.torchIgnite()}
      sfx.roomClear()
      for(const door of this.doors){this.map.openDoor(door.col,door.row);door.open=true}
      sfx.doorOpen();this.fx.damageText(player.x,player.y-45,t('game.survival.open'),'#dfc897')
    }
  }

  /** 敌人落位（避开实心瓦片、出生点、彼此重叠）；种类按注册表权重混编 */
  private spawnEnemies(spawnX: number, spawnY: number): void {
    const { bounds, tile } = this.map
    // 刷怪只认内容注册表：加新怪在 Def 写 spawn.weight 即可，本函数零改动
    const depth = this.def.depth ?? 0
    const allowed=currentBiome(this.def).enemyIds
    this.refreshCollisionProps()
    if(this.oldHell)this.navigation.configure(this.map,this.collisionProps)
    const fixed=this.script?[]:[...(this.def.extraEnemies??[]),...fixedEnemyIds(this.def.kind,this.def.floor??1,allowed)]
    const valid=(x:number,y:number,radius:number):boolean=>{
      const clearance=Math.max(24,radius)
      if(Math.hypot(x-spawnX,y-spawnY)<180||this.collisionProps.some(p=>circleHitsProp(x,y,clearance,p)))return false
      if(this.enemies.some(e=>Math.hypot(e.x-x,e.y-y)<Math.max(50,e.r+clearance+4)))return false
      if(![[0,0],[-clearance,-clearance],[-clearance,clearance],[clearance,-clearance],[clearance,clearance]].every(([dx,dy])=>!this.map.solidAtWorld(x+dx!,y+dy!)))return false
      return !this.oldHell||this.navigation.canReach(x,y,spawnX,spawnY,radius)
    }
    for (let n = 0; n < this.enemyTotal; n++) {
      const enemyId=n<fixed.length?fixed[n]:rollEnemyId(this.def.kind,depth,this.def.floor??1,allowed)
      if(!enemyId)continue
      const radius=enemies.require(enemyId).radius
      let x = spawnX
      let y = spawnY
      let ok = false
      for (let tries = 0; tries < 300; tries++) {
        x = bounds.left + tile + randomGeneration() * (bounds.right - bounds.left - tile * 2)
        y = bounds.top + tile + randomGeneration() * (bounds.bottom - bounds.top - tile * 2)
        if(!valid(x,y,radius))continue
        ok = true
        break
      }
      if (!ok) {
        // 随机落位失败时遍历内部地面，固定精英也不能卡在矿石或大型摆件里。
        search:for(let yy=bounds.top+tile;yy<bounds.bottom-tile;yy+=tile)for(let xx=bounds.left+tile;xx<bounds.right-tile;xx+=tile){
          if(valid(xx,yy,radius)){x=xx;y=yy;ok=true;break search}
        }
      }
      if(!ok)continue
      this.enemies.push(new Enemy(x,y,enemyId))
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
    if(mineral?.drops){
      for(const entry of mineral.drops)if(findItemDef(entry.item)&&(entry.chance>=1||randomLoot()<entry.chance)){
        for(let i=0;i<entry.quantity;i++)this.drops.push(new Drop(cx,cy,entry.item))
      }
      return
    }
    if(mineral?.visual.form==='salt'){
      this.drops.push(new Drop(cx,cy,ROCK_STONE_ID),new Drop(cx,cy,mineral.dropItemId))
      if(randomLoot()<.2)this.drops.push(new Drop(cx,cy,mineral.dropItemId))
      return
    }
    if (ore.vein === 'rock') {
      const rockN = CONFIG.mine.rockDrop + (randomLoot() < CONFIG.mine.rockBonusChance ? 1 : 0)
      for (let i = 0; i < rockN; i++) {
        this.drops.push(new Drop(cx, cy, ROCK_STONE_ID))
      }
      if(randomLoot()<.2)this.drops.push(new Drop(cx,cy,SILICA_SAND_ID))
      if (ore.hasOre && mineral && findItemDef(mineral.dropItemId)) {
        const oreN = 1 + (randomLoot() < CONFIG.mine.rockOreBonusChance ? 1 : 0)
        for (let i = 0; i < oreN; i++) {
          this.drops.push(new Drop(cx, cy, mineral.dropItemId))
        }
      }
      return
    }
    if (!mineral || !findItemDef(mineral.dropItemId)) return
    // 显矿数量按共用权重表摇号：1 个 67% / 2 个 33%。
    let n = CONFIG.mine.veinYield[0]?.[0] ?? 1
    const roll = randomLoot()
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
        ? far[Math.floor(randomCombat() * far.length)] // 合格池随机取，落点不可预判
        : cand.reduce((a, b) => (b.d > a.d ? b : a)) // 兜底（贴脸挖矿）：取离玩家最远的点
    // 种类混编同样走注册表权重（房型/深度门控由 Def.spawn 声明）
    const enemyId = rollEnemyId(this.def.kind, this.def.depth ?? 0,this.def.floor??1,currentBiome(this.def).enemyIds)
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

  private separationFree(e:{r?:number;collisionR?:number},x:number,y:number):boolean {
    const r=e.r??e.collisionR??0,flying=e instanceof Enemy&&e.def.movement==='flying'
    for(const [dx,dy] of [[0,0],[-r,-r],[-r,r],[r,-r],[r,r]])if(this.map.solidAtWorld(x+dx!,y+dy!,flying))return false
    return flying||!this.collisionProps.some(prop=>circleHitsProp(x,y,r,prop))
  }

  private pushOutCircle(e: {x:number;y:number;vx:number;vy:number;r?:number;collisionR?:number}, cx: number, cy: number, minDist: number): void {
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
    if (!this.separationFree(e,tx,ty)) return
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
    const next=this.collisionNext;next.length=0
    for (const prop of this.props) next.push(prop)
    if(this.wrecks)for(const collider of this.wrecks.colliders)next.push(collider)
    if (this.nature) for (const wood of this.nature.wood) {
      if (wood.hp > 0) next.push(this.resourceCollider(wood, false))
    }
    // 已开盖的宝箱仍有实体占地，沿用原有碰撞规则。
    for (const item of this.interactables) {
      if (item.kind === 'chest') next.push(this.resourceCollider(item, true))
    }
    let changed=next.length!==this.collisionProps.length
    for(let i=0;i<next.length;i++){
      const prop=next[i],old=this.collisionRecords.get(prop),definition=propDefs.get(prop.id)
      if(next[i]!==this.collisionProps[i]||!old||old.x!==prop.x||old.y!==prop.y||old.s!==prop.s||old.id!==prop.id||old.w!==prop.halfWidth||old.h!==prop.halfThick||old.segments!==prop.segments||old.block!==prop.blockBullets||old.definition!==definition){
        changed=true;this.collisionRecords.set(prop,{x:prop.x,y:prop.y,s:prop.s,id:prop.id,w:prop.halfWidth,h:prop.halfThick,segments:prop.segments,block:prop.blockBullets,definition})
      }
    }
    if(!changed)return
    this.navigation.invalidate()
    this.staticDrawKey=''
    this.collisionProps.length=0;for(const prop of next)this.collisionProps.push(prop)
    this.bulletBlockers.length=0
    for (const prop of this.collisionProps) {
      if (propBlocksBullets(prop)) for (const band of propBands(prop)) this.bulletBlockers.push(band)
    }
    rebuildBlockerGrid(this.bulletBlockers)
  }

  /**
   * @param dt 世界逻辑 dt（命中顿帧期间为 0：敌人/弹幕/掉落/特效/环境全部冻结）
   * @param playerDt 玩家时钟 dt（顿帧期间仍为真实帧时间：攻速、移动、闪避不被冻结）
   */
  update(dt: number, engine: EngineContext, player: Player, input: RoomInput, host: RoomHost, playerDt: number = dt): void {
    this.updatePlayers(dt, engine, [{player,input,host}], playerDt)
  }

  /** 世界、敌人、弹幕和掉落只推进一次；每个参与者仅推进自己的角色。 */
  updatePlayers(dt: number, engine: EngineContext, participants: readonly RoomParticipant[], playerDt: number = dt, searchActions: readonly SearchCommand[] = engine.input.searchActions): void {
    if (!participants.length) return
    const started=profiler.start()
    this.playerScratch.length=0
    for(const member of participants)this.playerScratch.push(member.player)
    this.rememberPlayers(this.playerScratch)
    for(const id of this.ownerDoomsday.keys())if(!this.playerEntities.has(id))this.ownerDoomsday.delete(id)
    const {player, host} = participants[0]!
    for (const member of participants) {
      if (member.player.isChanneling) this.search.cancel(member.player)
      else this.search.beforeInput(member.player, member.input)
    }
    for (const action of searchActions) {
      const member = participants.find(p => (p.player.playerId ?? p.player.entityId) === action.playerId)
      if (!member || member.player.isChanneling && action.slot !== -2) continue
      if (action.slot === -2) {
        if (this.search.view(member.player, this.time)?.id === action.containerId) this.search.cancel(member.player)
      } else if (action.slot === -3) {
        const container = this.search.container(action.containerId)
        if (container && this.search.view(member.player, this.time)?.id === container.id) {
          if (!this.beginSearch(member.player, container, member.host)) this.fx.damageText(member.player.x, member.player.y - 24, t('game.search.busy'), '#c9b99b')
        }
      } else this.takeSearch(member.player, action.containerId, action.slot, member.host)
    }
    const living = this.livingScratch;living.length=0
    for(const member of participants)if(member.player.alive)living.push(member)
    for (const member of living) this.deathNotifiedPlayers.delete(member.player.entityId)
    this.time += dt
    for (const effect of this.weaponImpacts) effect.age += dt
    this.weaponImpacts = this.weaponImpacts.filter(effect => effect.age < effect.duration)
    this.wreckSearchAllowed=host.furnaceSearchAllowed?.()??false
    if(this.def.encounter==='survival'&&!this.survivalComplete&&living.length)this.updateSurvival(dt,living[0]!.player)
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
    if(this.oldHell)this.navigation.configure(map,solidProps)
    if(!this.enemiesFrozen){
      if(!this.cleared&&this.aliveEnemies>0)this.threats.updateLava(dt,map,this.playerScratch,this.enemies,solidProps,(id,x,y)=>{
        const enemy=new Enemy(x,y,id);enemy.startEncounterSpawn('ceiling');enemy.alert();this.enemies.push(enemy);this.enemyTotal++
      })
      this.threats.updateBursts(dt,this.bullets,this.fx)
    }
    rebuildEnemyGrid(this.enemies)
    let phaseStarted=profiler.start()
    // 玩家时钟独立：命中顿帧冻结世界时，玩家的攻速/移动/闪避照常推进
    for (const {player,input,host} of participants) {
    withSimulationAppearance(player.appearance ?? simulationAppearance(), () => {
    player.update(playerDt, input, map, solidProps)
    for(const amount of player.drainStatusDamage())this.fx.combatDamage(player.x,player.y-20,amount,'true')
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
    player.tarot.updateFlights(playerDt, player, this.enemies, map, bulletBlockers, (enemy, result) => {
      this.fx.burst(enemy.x, enemy.y, player.facing, 5)
      // 混合攻击分别展示分量，合计等于实际扣血，过量伤害不冒出虚高数字。
      const total = result.physical + result.magic + result.trueDamage
      const parts = [{ kind: 'physical' as const, amount: result.physical }, { kind: 'magic' as const, amount: result.magic }, { kind: 'true' as const, amount: result.trueDamage }].filter(part => part.amount > 0)
      if (!parts.length) this.fx.combatDamage(enemy.x, enemy.y - 18, 0, 'physical')
      parts.forEach((part, i) => this.fx.combatDamage(enemy.x, enemy.y - 18 - i * 22, part.amount * result.damage / total, part.kind, result.critical))
      sfx.meleeHit(enemy.hitMaterial)
      if (!enemy.alive) this.onEnemyKilled(enemy, host)
    })
    player.bow.updateFlights(playerDt,map,this.bulletBlockers,this.enemies,(enemy,damage,critical,kind)=>{
      this.fx.burst(enemy.x,enemy.y,player.facing,5);this.fx.combatDamage(enemy.x,enemy.y-18,damage,kind,critical);sfx.meleeHit(enemy.hitMaterial)
      if(!enemy.alive)this.onEnemyKilled(enemy,host)
    })
    player.scp127.updateFlights(playerDt,map,this.bulletBlockers,this.enemies,(enemy,damage,critical)=>{
      this.fx.combatDamage(enemy.x,enemy.y-18,damage,'physical',critical)
      this.fx.burst(enemy.hitX,enemy.hitY,player.facing,3)
      if(!enemy.alive)this.onEnemyKilled(enemy,host)
    })
    this.doomFor(player).update(dt, player, !player.isChanneling && input.specialPressed, engine, host)
    })
    }

    profiler.end('playerLogic',phaseStarted);phaseStarted=profiler.start()
    // 敌人 AI + 收集开火请求（毒液史莱姆两种弹幕节拍）
    // 封印聚气/剧情冻结期间全体停止行动（不开火，为灵梦争取那一瞬）
    for (const e of this.enemies) {
      // 剧情冻结（封印对白/连爆演出）期间全体停止行动（不开火）
      if (this.enemiesFrozen && e.alive) continue
      const target = this.selectTarget(e, participants)
      e.targetId = target?.entityId ?? null
      if (e.alive && !target) continue
      e.advanceContactTargets(dt)
      const wasAlive=e.alive
      const beforeX=e.x,beforeY=e.y,wasCharging=e.pounceState==='lunge'
      e.update(dt, map, target ?? participants[0]!.player, solidProps, this.enemies,this.oldHell?this.navigation:undefined)
      this.threats.updateChargeTrail(e,beforeX,beforeY,wasCharging,map,solidProps)
      for(const amount of e.drainStatusDamage())this.fx.combatDamage(e.hitX,e.hitY-12,amount,'true')
      if(wasAlive&&!e.alive&&e.statusDamageSource){
        const owner=participants.find(member=>member.player.entityId===e.statusDamageSource)??participants[0]!
        this.onEnemyKilled(e,owner.host)
      }
      if (!e.alive) continue
      const player = target ?? participants[0]!.player
      for (const shot of e.drainShots()) {
        // 吐弹声像跟随怪相对玩家方位（暗房里能"听声辨位"）
        const shotPan = Math.max(-1, Math.min(1, (e.x - player.x) / 300)) * 0.7
        if (shot.kind === 'straight') {
          // 瞄准玩家当前位置的直线弹（弹种由 AI 请求携带）
          const ang = shot.angle ?? Math.atan2(player.y - e.y, player.x - e.x)
          const count=shot.volley?.count??1,spread=shot.volley?.spread??0
          for(let i=0;i<count;i++){
            const direction=ang+(count>1?(i/(count-1)-.5)*spread:0)
            this.bullets.push(
              new Projectile(
                shot.origin?.x ?? e.x + Math.cos(direction) * (e.r + 4),
                shot.origin?.y ?? e.y + Math.sin(direction) * (e.r + 4),
                direction,
                shot.projectileId
              )
            )
            this.bullets[this.bullets.length - 1]!.sourceId = e.entityId
          }
          if(e.def.tags?.includes('magma'))sfx.fireBurst('shoot',shotPan)
          else sfx.enemyShoot('straight', shotPan)
        } else {
          // N 向圆形扩散（慢弹墙，数量由该怪 Def 声明）
          const n = e.ringCount
          for (let i = 0; i < n; i++) {
            const ang = (i / n) * Math.PI * 2 + this.time * 0.07
            this.bullets.push(new Projectile(e.x, e.y, ang, shot.projectileId))
            this.bullets[this.bullets.length - 1]!.sourceId = e.entityId
          }
          sfx.enemyShoot('ring', shotPan)
        }
      }
    }

    profiler.end('enemyLogic',phaseStarted);phaseStarted=profiler.start()
    // 怪 ↔ 玩家圆分离（出土中的怪钉在出生点，坑影不滑动；钻出后才参与推挤）
    // 间隔按玩家精瘦碰撞圆，敌人可以逼得更近（受击判定也同步缩小）
    for (const {player} of participants) if (player.alive) {
      for (const e of this.enemies) {
        if (!e.alive || e.emerging || e.def.tags?.includes('boss') || e.def.chargeCycle&&e.pounceState==='lunge') continue
        if(e.def.movement==='stationary'||e.isStoneGuard){this.pushOutCircle(player,e.x,e.y,e.r+player.collisionR);continue}
        this.pushOutCircle(e, player.x, player.y, e.r + player.collisionR)
      }
    }
    // 分离仍按原实体顺序结算；每次推挤后刷新网格，后续候选使用修正后的坐标。
    this.separationGrid.clear()
    for(const e of this.enemies)if(e.alive&&!e.emerging)this.separationGrid.insert(e,e.x-e.r,e.y-e.r,e.x+e.r,e.y+e.r)
    for (let i = 0; i < this.enemies.length; i++) {
      const a = this.enemies[i]
      if (!a.alive || a.emerging) continue
      this.separationGrid.query(a.x-a.r,a.y-a.r,a.x+a.r,a.y+a.r,this.separationCandidates)
      let last=i
      for(let candidate=0;candidate<this.separationCandidates.length;candidate++){
        const b=this.separationCandidates[candidate],j=this.enemies.indexOf(b)
        if(j<=last)continue
        last=j
        if (!b.alive || b.emerging) continue
        const ax=a.x,ay=a.y,bx=b.x,by=b.y
        if((a.def.movement==='stationary'||a.isStoneGuard)&&(b.def.movement==='stationary'||b.isStoneGuard))continue
        if(a.def.movement==='stationary'||a.isStoneGuard){if(b.def.movement!=='flying')this.pushOutCircle(b,a.x,a.y,a.r+b.r)}
        else if(b.def.movement==='stationary'||b.isStoneGuard){if(a.def.movement!=='flying')this.pushOutCircle(a,b.x,b.y,a.r+b.r)}
        else {
        if(a.def.movement!==b.def.movement||a.def.chargeCycle&&a.pounceState==='lunge'||b.def.chargeCycle&&b.pounceState==='lunge')continue
        const min = a.r + b.r
        const squared=(a.x-b.x)**2+(a.y-b.y)**2
        if (squared < min*min && squared > 1e-8) {
          const d=Math.sqrt(squared)
          const half = (min - d) / 2
          const nx = (a.x - b.x) / d
          const ny = (a.y - b.y) / d
          if (this.separationFree(a,a.x+nx*half,a.y+ny*half)) {
            a.x += nx * half
            a.y += ny * half
          }
          if (this.separationFree(b,b.x-nx*half,b.y-ny*half)) {
            b.x -= nx * half
            b.y -= ny * half
          }
        }
        }
        if(a.x!==ax||a.y!==ay||b.x!==bx||b.y!==by){
          this.separationGrid.update(a,a.x-a.r,a.y-a.r,a.x+a.r,a.y+a.r)
          this.separationGrid.update(b,b.x-b.r,b.y-b.r,b.x+b.r,b.y+b.r)
          this.separationGrid.query(a.x-a.r,a.y-a.r,a.x+a.r,a.y+a.r,this.separationCandidates);candidate=-1
        }
      }
    }

    rebuildEnemyGrid(this.enemies)
    // 接触伤害（倒下通知统一在弹幕结算后做边沿检查；冻结/聚气中怪无伤害）
    for (const {player} of participants) if (player.alive && !this.enemiesFrozen) {
      for (const e of enemyCandidates(this.enemies,player.x-player.hitR,player.y-player.hitR,player.x+player.hitR,player.y+player.hitR)) {
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

    profiler.end('contacts',phaseStarted);phaseStarted=profiler.start()
    // 弹幕：位移/撞墙/撞大件掩体 + 命中玩家（无敌帧可穿弹）
    const bladeSweep=this.bladeScratch;bladeSweep.length=0
    for(const member of participants)if(member.player.alive)for(const sweep of member.player.getProjectileErasure())bladeSweep.push(sweep)
    const splitBullets: Projectile[] = []
    const slowedTime = Math.min(dt, this.bulletSlowRemaining)
    const bulletSpeed = dt > 0 ? 1 - (1 - this.bulletSlowMultiplier) * slowedTime / dt : 1
    this.bulletSlowRemaining = Math.max(0, this.bulletSlowRemaining - dt)
    for (const b of this.bullets) {
      const prevBulletX = b.x, prevBulletY = b.y
      b.update(dt, map, bulletBlockers, bulletSpeed)
      if (!b.dead && bladeSweep.length && bladeErasesProjectile(bladeSweep, b.x, b.y, b.r, prevBulletX, prevBulletY)) {
        b.dead = true; this.fx.chips(b.x, b.y, '#ddc5bc', 4, 70); continue
      }
      // 高速弹与曲线弹按整段实际轨迹判定，撞到玩家后方墙壁也不能漏掉途中命中。
      let hitPlayer = false
      let hitTarget:Player|null=null,firstDistance=Infinity
      if(b.canTouch)for(const {player} of living){
        if(!player.alive||player.isInvincible)continue
        const distance=b.touchDistance(player.x,player.y,player.collisionR)
        if(distance!==null&&distance<firstDistance){firstDistance=distance;hitTarget=player}
      }
      if (hitTarget) {
        const player = hitTarget
        hitPlayer = true
        b.hitPlayerAt(firstDistance)
        const hpBefore = player.hp
        player.takeHit(b.damage, b.angle, 'magic', true)
        if(player.alive&&!player.debugGod&&b.onHitStatus&&(player.hp<hpBefore||b.statusOnBlockedHit))player.effects.add(b.onHitStatus,b.onHitStatus.id)
        this.fx.chips(player.x, player.y, b.hitColor, 10, 160)
        this.fx.damageText(player.x, player.y - 20, `-${damageLabel(hpBefore-player.hp)}`, b.hitColor)
        engine.shake(0.12)
      }
      const groundImpact=b.drainGroundImpact()
      if(groundImpact)this.threats.addImpact(groundImpact,b.angle,map,solidProps,this.fx)
      if (b.dead) {
        if(b.impactSound==='fire'){
          if(!groundImpact)sfx.fireBurst('splat',Math.max(-.7,Math.min(.7,(b.x-player.x)/430)))
          continue
        }
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
      if (b.hasPendingSplit) {
        const children = b.drainSplit()
        for (const child of children) child.sourceId = b.sourceId
        splitBullets.push(...children)
      }
    }
    compactInPlace(this.bullets, b => !b.removed)
    this.bullets.push(...splitBullets)
    this.threats.updateGround(dt,this.playerScratch,this.fx)
    profiler.end('projectiles',phaseStarted);phaseStarted=profiler.start()

    // 玩家倒下（接触/弹幕两路都可能造成）→ 先问剧情层是否接管，否则边沿通知一次
    for (const {player,host} of participants) if (!player.alive && !this.deathNotifiedPlayers.has(player.entityId)) {
      this.deathNotifiedPlayers.add(player.entityId)
      if (host.onPlayerDowned?.() !== true) {
        host.onPlayerDied()
      }
    }
    if (participants.every(member => !member.player.alive)) {profiler.end('roomUpdate',started);return}

    // 尸体清理
    compactInPlace(this.enemies, e => !e.removed)

    // 同一逻辑步按背包与物品种类复用容量查询；入包后失效，不能误判最后一格。
    for(const member of living){let space=this.inventorySpace.get(member.host.inventory);if(!space){space=new Map();this.inventorySpace.set(member.host.inventory,space)}space.clear()}
    // 掉落物：贴身请求拾取 → 背包确认入包 / 满包弹回
    for (const drop of this.drops) {
      const definition=findItemDef(drop.itemId)
      let collector:RoomParticipant|undefined,nearest:RoomParticipant|undefined,previous:RoomParticipant|undefined,best=Infinity,closest=Infinity
      for(const member of living){
        if(!member.player.alive)continue
        const dx=member.player.x-drop.x,dy=member.player.y-drop.y,distance=dx*dx+dy*dy
        if(distance<closest){nearest=member;closest=distance}
        const space=this.inventorySpace.get(member.host.inventory)!
        let available=space.get(drop.itemId)
        if(available===undefined){available=!!definition&&member.host.inventory.canAdd(drop.itemId);space.set(drop.itemId,available)}
        if(!available)continue
        if(member.player.entityId===drop.collectorId&&distance<(CONFIG.drop.magnetRange*1.6)**2)previous=member
        if(distance<best){collector=member;best=distance}
      }
      collector=previous??collector??nearest
      const player = collector?.player ?? participants[0]!.player
      const host = collector?.host ?? participants[0]!.host
      drop.collectorId = collector?.player.entityId ?? null
      if (!host.inventory.acceptingItems) {
        this.unavailableCollector.x = player.x; this.unavailableCollector.y = player.y
        drop.collectorId = null
        drop.update(dt, map, this.unavailableCollector)
        continue
      }
      if (!drop.update(dt, map, player)) continue
      if (host.inventory.add(drop.itemId, 1,drop.durability) > 0) {
        this.inventorySpace.get(host.inventory)?.clear()
        drop.confirm()
        emitSimulationEvent({type:'pickup',source:drop.entityId,collector:player.entityId,item:drop.itemId,quantity:1})
        host.onItemFound?.(drop.itemId)
        sfx.pickup()
        const def = getItemDef(drop.itemId)
        this.fx.burst(drop.x, drop.y, -Math.PI / 2, 5)
        this.fx.pickupText(drop.itemId, 1, def.text,player.entityId)
      } else {
        // 背包已满：从玩家身边弹开并给提示
        drop.reject(player.x, player.y)
        this.inventorySpace.get(host.inventory)?.set(drop.itemId,false)
        this.fx.damageText(player.x, player.y - 26, t('game.notify.bag_full'), '#ff9a7a')
      }
    }
    compactInPlace(this.drops, d => !d.isCollected)
    profiler.end('pickups',phaseStarted)

    // 挥镐双目标判定
    for (const {player,host} of participants) if (player.alive && player.getSwing() && player.swingPhase === 'active') {
      withSimulationAppearance(player.appearance ?? simulationAppearance(),()=>this.resolveSwingHits(engine, player, host))
    }
    for(const {player,host} of participants)this.resolveEchoHits(player,host)
    for(const {player,host} of participants)this.resolveAreaBurstHits(player,host,dt)

    if(!this.cleared&&this.def.encounter==='survival'&&this.survivalComplete&&this.aliveEnemies===0&&!this.threats.blocksClear){
      this.cleared=true
      this.threats.clear()
      this.setDoorsOpen(true)
      if(this.oldHell)this.fogClearStart=this.time
    }
    // 清场 → 解封所有门 + 激活裂隙（延迟刷怪未出场不算清场；脚本房可禁止自动开门/点火）
    // startLocked 房（序章醒来黑房）的清场状态只能由脚本流程解除：初始 0 怪也不许在
    // 第一帧自动翻牌，否则光照会误切亮档——亮房里帽灯光圈消失、"好黑"的演出全毁
    if (
      !this.cleared &&
      this.def.encounter!=='survival' &&
      !this.script?.startLocked &&
      !this.script?.manualClear &&
      this.aliveEnemies === 0 &&
      !this.threats.blocksClear &&
      this.pendingSpawns.length === 0
    ) {
      this.cleared = true
      emitSimulationEvent({type:'clear',room:this.def.id})
      if(this.oldHell)this.fogClearStart=this.time
      // 手动火把房 / 显式抑制的脚本房：火把与门都交给导演
      if (!this.oldHell && !this.manualTorch && !this.script?.suppressAutoClear) {
        // 批次 E：火把从此刻起逐根错峰点燃（火星在下方统一检测）
        this.litStart = this.time
      }
      // 有怪的房间才播清场音（出生空房/奖励房进门不打扰）
      if (this.enemyTotal > 0) {
        sfx.roomClear()
        if (!this.oldHell && !this.manualTorch && !this.script?.suppressAutoClear) sfx.torchIgnite()
      }
      // 清场净化普通残弹；已经爆发的死亡弹幕继续飞行，不再阻碍开门。
      this.bullets = this.bullets.filter(b=>b.surviveRoomClear)
      this.threats.clear()
      if (!this.script?.suppressAutoClear) {
        this.setDoorsOpen(true)
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

    this.search.update(dt, this.time, this.knownPlayers, (player, container, index) => {
      const item=container.slots?.[index]
      sfx.searchReveal(searchFeedback(item?.id),!item,item?itemQualityLevel(getItemDef(item.id)):1)
    }, (player, container) => {
      const member = participants.find(p => p.player === player)
      if (!member) return
      const chest = container.chestId !== undefined ? this.interactables.find(it => it.id === container.chestId) : undefined
      if (chest) chest.done = true
      member.host.onInteract?.(chest ?? { id: -3, kind: 'search', x: container.x, y: container.y, range: container.range, hint: null, oneShot: false, done: true, ref: container.ref })
    },()=>sfx.searchRummage())
    // 踩门 → 切换房间
    this.interactionHints.clear()
    for (const {player,input,host} of participants) if (player.alive) {
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
      this.fx.withPickupOwner(player.entityId,player.x,player.y,()=>this.updateInteractables(player, input, host))
      this.interactionHints.set(player.entityId,this.interactHint)
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
        const owner = participants.find(member => member.player.entityId === s.owner)?.player ?? player
        s.x = owner.x
        s.y = owner.y
      }
    }
    this.spellFx = this.spellFx.filter((s) => s.t < s.dur)
    for (const q of this.pendingSpellPulses) {
      if (q.channel) {
        if (participants.find(member => member.player.entityId === q.owner)?.player.isChanneling) continue
        q.channel = false
      } else q.delay -= dt
    }
    const duePulses = this.pendingSpellPulses.filter((q) => !q.channel && q.delay <= 1e-8)
    this.pendingSpellPulses = this.pendingSpellPulses.filter((q) => q.channel || q.delay > 1e-8)
    // 第二波也以玩家当前位置为中心——光波始终绕身绽开
    for (const q of duePulses) {
      const owner = q.owner ? participants.find(member => member.player.entityId === q.owner) : participants[0]
      if(!owner)continue
      if (owner.player.alive) this.fireSpellPulse(owner.player.x, owner.player.y, q.spellId, q.def, q.pulse, engine, owner.host,q.damageBonus,owner.player.entityId)
    }

    map.update(dt)
    this.fx.setPickupAnchor(player.x, player.y)
    for(const member of participants)this.fx.setPickupAnchor(member.player.x,member.player.y,member.player.entityId)
    this.fx.update(dt)
    profiler.count('players',participants.length);profiler.count('enemies',this.enemies.length);profiler.count('bullets',this.bullets.length);profiler.count('drops',this.drops.length)
    profiler.end('roomUpdate',started)
  }

  /** 最近有效目标与轻量保持阈值；已起手的技能不随距离微变而换目标。 */
  private selectTarget(enemy: Enemy, members: readonly RoomParticipant[]): Player | null {
    if(members.length===1)return members[0].player.alive?members[0].player:null
    let nearest:Player|null=null,previous:Player|null=null,best=Infinity
    let selectable=false
    for(const member of members)if(member.player.alive&&!member.player.untargetable){selectable=true;break}
    for(const {player} of members){
      if(!player.alive||selectable&&player.untargetable)continue
      const d=(player.x-enemy.x)**2+(player.y-enemy.y)**2;if(d<best){nearest=player;best=d}
      if(player.entityId===enemy.targetId)previous=player
    }
    if(previous&&(enemy.windup!=='none'||enemy.pounceState!=='none'
      ||enemy instanceof KedamaBoss&&['windup','shoot','move'].includes(enemy.mode)
      ||enemy instanceof GrimmBoss&&!['retreat','run','recovery'].includes(enemy.state)))return previous
    // 小幅距离变化保持目标，避免多人交叉走位使前摇方向每帧抖动。
    return previous && nearest && ((previous.x-enemy.x)**2+(previous.y-enemy.y)**2) <= best*1.44 ? previous : nearest
  }

  /** 百裂斩按固定矩形逐轮结算，每轮命中范围内所有敌人，无多目标衰减。 */
  private resolveAreaBurstHits(player:Player,host:RoomHost,dt:number):void {
    const burst=player.areaBurst
    if(!burst)return
    const due=Math.min(burst.count,Math.floor((burst.age+1e-8)/(burst.duration/burst.count))+1)
    const cos=Math.cos(burst.angle),sin=Math.sin(burst.angle),radius=Math.hypot(burst.range,burst.width/2)+48
    while(burst.issued<due){
      const index=burst.issued++
      // 每轮两道破空声随世界时钟触发，空斩也出声，不受普通命中音的节流限制。
      getItemDef(burst.weaponId).weapon?.chargeAttack?.areaBurst?.sound?.(index)
      for(const enemy of enemyCandidates(this.enemies,burst.x-radius,burst.y-radius,burst.x+radius,burst.y+radius)){
        if(!enemy.canBeHit)continue
        const dx=enemy.hitX-burst.x,dy=enemy.hitY-burst.y,r=enemy.hitRadius,fwd=dx*cos+dy*sin,side=-dx*sin+dy*cos
        // 与刀影的局部坐标一致：向前纵深为 range，朝着玩家的近侧边左右各 width/2。
        const near=Math.max(0,Math.min(burst.range,fwd)),across=Math.max(-burst.width/2,Math.min(burst.width/2,side))
        if((fwd-near)**2+(side-across)**2>r*r)continue
        // 同一轮物理与魔法各算一次抗性，再合成一次受击，避免缩石概率和击退重复触发。
        const damage=enemy.resolveMixedDamage({base:burst.physicalDamage+burst.magicDamage,attackPower:0,coefficient:0,critChance:0,penetration:burst.physicalPenetration},
          burst.magicDamage/Math.max(.001,burst.physicalDamage+burst.magicDamage),burst.magicPenetration)
        enemy.takeDamage(damage.damage,burst.angle,0,0,'mixed')
        if(damage.physical>0)this.fx.combatDamage(enemy.hitX-4,enemy.hitY-19,damage.physical,'physical')
        if(damage.magic>0)this.fx.combatDamage(enemy.hitX+4,enemy.hitY-30,damage.magic,'magic')
        if(!enemy.alive)this.onEnemyKilled(enemy,host,burst.weaponId)
      }
    }
    // 空斩与房间刀影使用同一时钟，命中顿帧期间不会伤害先跑完、演出还没开始。
    burst.age+=dt
  }

  /** 残影每刀只命中同一目标一次，自己的延迟与刀身计时分开。 */
  private resolveEchoHits(player:Player,host:RoomHost):void {
    for(const echo of player.meleeEchoes){
      const elapsed=echo.age-(echo.delay??0)
      if(elapsed<0||elapsed>=echo.activeDuration)continue
      const m=echo.move,cos=Math.cos(echo.angle),sin=Math.sin(echo.angle),reach=m.reach+(m.stabWidth??0)+48
      for(const enemy of enemyCandidates(this.enemies,echo.x-reach,echo.y-reach,echo.x+reach,echo.y+reach)){
        if(!enemy.canBeHit||echo.hitIds.has(enemy.entityId))continue
        const dx=enemy.hitX-echo.x,dy=enemy.hitY-echo.y,r=enemy.hitRadius
        const angle=Math.atan2(dy,dx),difference=Math.atan2(Math.sin(angle-echo.angle),Math.cos(angle-echo.angle))
        const hit=m.shape==='slash'?Math.hypot(dx,dy)<=m.reach+r&&Math.abs(difference)<=(m.arc??0)
          :dx*cos+dy*sin>=-r&&dx*cos+dy*sin<=m.reach+r&&Math.abs(-dx*sin+dy*cos)<=(m.stabWidth??14)/2+r
        if(!hit)continue
        echo.hitIds.add(enemy.entityId)
        const result=enemy.resolveDamage({base:echo.damage,attackPower:0,coefficient:0,critChance:0,penetration:echo.magicPenetration},'magic')
        enemy.takeDamage(result.damage,angle,0,0,'magic')
        if(result.damage>0)this.fx.combatDamage(enemy.hitX+5,enemy.hitY-35,result.damage,'magic')
        if(!enemy.alive)this.onEnemyKilled(enemy,host,echo.weaponId)
      }
    }
  }

  /** 刀身、矿脉和采集物共用玩家本次挥击的命中集合。 */
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
    const queryRadius=Math.max(swing.reach,m.reach)+swing.stabWidth+32
    const candidates=weaponHit?this.enemies:enemyCandidates(this.enemies,p.x-queryRadius,p.y-queryRadius,p.x+queryRadius,p.y+queryRadius)
    for (const e of candidates) {
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
      const kind=m.damageKind??'physical'
      const input={base:impact.damage,attackPower:p.attackPower,damageBonus:p.outgoingDamageBonus+p.swingDamageBonus,
        coefficient:m.powerCoefficient ?? (m.windup+m.active+m.recover),
        penetration:kind==='magic'?(equipment?.magicPenetration??impact.penetration+p.equipmentCombat.penetration):impact.penetration+p.equipmentCombat.penetration,critChance:(equipment?.critChance??0)+p.equipmentCombat.critChance+(p.equipmentCombat.meleeCritChance??0),
        critMultiplier:resource?.criticalPassive?.multiplier,
        area:m.aoe?.mode!=='none'&&(m.shape==='slash'||!!m.aoe),aoeReduction:e.def.combat.aoeReduction,falloff:dmgMult*p.swingChargeMultiplier*p.meleeWeaponDamageMultiplier*(e.def.combat.meleeDamageTakenMultiplier??1)*(kind==='magic'?1:p.physicalDamageMultiplier)}
      const mixed=kind==='physical'&&resource?.physicalToMagic?e.resolveMixedDamage(input,resource.physicalToMagic,equipment?.magicPenetration??0):null
      const result=mixed??e.resolveDamage(input,kind)
      const extraMagicBase=resource?.fixedMagicDamage??0
      const extraMagic=extraMagicBase>0?e.resolveDamage({base:extraMagicBase,attackPower:0,coefficient:0,critChance:0,penetration:equipment?.magicPenetration??0},'magic').damage:0
      const damage = result.damage+extraMagic
      p.hitSet.add(e)
      p.swingHitCount++
      // 主伤害与附伤分别扣抗性后合并一次受击，避免死亡、缩石概率与击退重复触发。
      e.takeDamage(damage, ang, (m.knockback ?? e.def.combat.knockback) + p.knockbackBonus, m.stun,mixed||extraMagic>0?'mixed':kind)
      if(damage>0)for(const effect of p.meleeAccessoryEffects())if(e.alive)e.addStatus(effect,p.entityId)
      if (e.alive) for (const effect of p.swingHitEffects) e.addStatus(effect, 'weapon:hit')
      if (e.alive && result.critical) for (const effect of resource?.criticalPassive?.effects ?? []) {
        // 持续伤害可记录实际施加者，死亡结算沿用状态系统的多人击杀归属。
        e.addStatus(effect, resource?.criticalPassive?.source === 'attacker' ? p.entityId : 'weapon:critical')
      }
      this.fx.burst(e.x, e.y, ang)
      if(mixed){
        if(mixed.physical>0)this.fx.combatDamage(e.hitX-5,e.hitY-18,mixed.physical,'physical',result.critical)
        if(mixed.magic>0)this.fx.combatDamage(e.hitX+5,e.hitY-31,mixed.magic,'magic',result.critical)
      }else this.fx.combatDamage(e.x,e.y-18,result.damage,kind,result.critical)
      if(extraMagic>0)this.fx.combatDamage(e.hitX+5,e.hitY-(mixed?43:31),extraMagic,'magic')
      if(resource?.hitFx)this.weaponImpacts.push({x:e.hitX,y:e.hitY,angle:ang,move:m,age:0,...resource.hitFx})
      // 武器专属冲击仅在首个实际命中上播放，跨帧扫入多个目标也不重复叠音。
      if (resource?.hitSound && p.swingHitCount === 1) resource.hitSound(e.hitMaterial)
      if (!e.alive) {
        engine.shake(0.2)
        this.onEnemyKilled(e, host, p.activeToolId)
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
      if(wood.hp===0){for(let i=0,n=1+Math.floor(randomLoot()*2);i<n;i++)this.drops.push(new Drop(wood.x,wood.y,WOOD_ID));sfx.pickBreak()}else sfx.pickHit(wood.hp/30)
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
            const specialRock=mineral?.visual.form==='blackstone'
            this.fx.chips(cx, cy, specialRock?crystalColor:'#8b929c', 15, 230)
            this.fx.chips(cx, cy, specialRock?hiColor:'#a6adb7', 6, 170)
            this.fx.damageText(cx, cy - 10, specialRock||mineral?.visual.form==='salt'?mineralName(result.kind):t('game.notify.rock'), specialRock?mineral!.text:'#c2c8d0')
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
          const ordinaryRock=result.vein==='rock'&&!result.hasOre&&!mineral?.drops&&mineral?.visual.form!=='salt'
          if (ordinaryRock && randomLoot() < 0.03) {
            this.drops.push(new Drop(cx, cy, SALTPETER_ID))
          }
          // 楼层宿主在生成时占用名额，换房重访不释放。
          const guaranteedChest=ordinaryRock&&host.claimGuaranteedMiningChest?.()
          if (guaranteedChest||((this.def.floor??1)>=3&&!this.script?.noChest && randomLoot() < Math.min(1, CONFIG.mine.chestChance * searchDensity(this.searchContext(), 'chest')) && host.claimMiningChest?.())) {
            this.addChestInteractable(cx, cy)
            this.fx.damageText(cx, cy - 26, t('game.notify.chest'), '#ffd76a')
            sfx.doorOpen()
          }
          // 50% 概率从矿里爆出怪（仅未清场房间；落点远离玩家 + 出土预警，不零帧起手；脚本房可禁用）
          if (!this.script?.noMonsterBurst && !this.cleared && randomCombat() < CONFIG.mine.monsterBurstChance) {
            this.burstEnemyFromOre(cc, rr, p)
          }
          engine.hitStop(0.05)
          engine.shake(0.12)
          sfx.pickBreak()
        } else {
          // 未碎：岩包只崩石灰，显矿态崩矿色
          this.fx.chips(cx, cy, result.vein === 'rock' && !mineral?.drops ? '#8b929c' : crystalColor, 4, 130)
          engine.hitStop(0.025)
          engine.shake(0.05)
          sfx.pickHit(result.ratio)
        }
      }
    }
  }

  /** 击杀公共结算：尸体碎粒、史莱姆凝液与整层统计。 */
  private onEnemyKilled(e: Enemy, host: RoomHost, weaponId: ItemId | null = null): void {
    if (this.settledKills.has(e.entityId)) return
    this.settledKills.add(e.entityId)
    this.threats.onDeath(e)
    this.doomsday.remove(e)
    for (const effect of this.ownerDoomsday.values()) effect.remove(e)
    if (e.def.tags?.includes('story_restore')) { host.onKill(0); return }
    this.fx.chips(e.x, e.y, e.deathColor, 14, 200)
    if (e.def.tags?.includes('boss')) { host.onKill(0); return }
    sfx.enemyDie(e.hitMaterial)
    // 调用方只传实际完成击杀的武器快照；切换手持或用符卡击杀不能借用被动。
    const chanceMultiplier = weaponId ? findItemDef(weaponId)?.weapon?.killDropPassive?.chanceMultiplier ?? 1 : 1
    // 必掉池只抽一次，不把互斥项当成多个独立概率，也不因掉率加成再掉一份。
    if(e.def.dropPool){
      const drop=weightedPick(e.def.dropPool,entry=>findItemDef(entry.item)?entry.weight:0,randomLoot)
      if(drop)for(let n=0;n<drop.qty;n++)this.drops.push(new Drop(e.x,e.y,drop.item))
    }
    if(e.def.drops){
      for(const drop of e.def.drops)if(randomLoot()<Math.min(1,drop.chance*chanceMultiplier)&&findItemDef(drop.item)){
        for(let n=0;n<drop.qty;n++)this.drops.push(new Drop(e.x,e.y,drop.item))
      }
    }else if (!e.def.dropPool && (e.hitMaterial === 'slime' || e.hitMaterial === 'venom') && randomLoot() < Math.min(1,0.10*chanceMultiplier)) {
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
    const damageBonus=def.damageKind==='physical'?p.physicalOutgoingDamageBonus:p.outgoingDamageBonus
    if (def.channelTime) {
      for (let i = 0; i < waves; i++) this.pendingSpellPulses.push({delay:gap*i,spellId,def:pulseDef,pulse:i,damageBonus,owner:p.entityId,channel:true})
      return
    }
    this.fireSpellPulse(p.x, p.y, spellId, pulseDef, 0, engine, host,damageBonus,p.entityId)
    for (let i = 1; i < waves; i++) {
      this.pendingSpellPulses.push({ delay: gap * i, spellId, def: pulseDef, pulse: i,damageBonus,owner:p.entityId })
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
    damageBonus=0,
    owner?:string
  ): void {
    // 第二声是高五度回响（在 Sfx 内按 pulse 区分音色/音量）
    if (def.sound) def.sound()
    else sfx.spellCast(pulse)
    if (def.control) {
      const control = def.control
      for (const enemy of this.enemies) {
        if (!enemy.alive || (def.scope !== 'room' && Math.hypot(enemy.hitX-x,enemy.hitY-y)>def.radius+enemy.hitRadius)) continue
        for (const effect of control.enemyEffects) enemy.addStatus(effect,owner??spellId,control.duration)
        if (def.targetFx) this.spellFx.push({x:enemy.hitX,y:enemy.hitY,radius:enemy.hitRadius,t:0,dur:def.targetFx.duration,color:def.color,seed:randomVisual()*Math.PI*2,follow:false,owner,render:def.targetFx.render})
      }
      this.bulletSlowMultiplier = this.bulletSlowRemaining > 0 ? Math.min(this.bulletSlowMultiplier,control.bulletSpeedMultiplier) : control.bulletSpeedMultiplier
      this.bulletSlowRemaining = Math.max(this.bulletSlowRemaining,control.duration)
      host.slowEnemyBullets?.(control.duration,control.bulletSpeedMultiplier)
      engine.shake(.1)
      return
    }
    const ringColor = def.fxColors?.ring ?? def.color
    let killed = 0
    for (const e of this.enemies) {
      if (!e.canBeHit) continue
      const dx = e.hitX - x
      const dy = e.hitY - y
      if (Math.hypot(dx, dy) > def.radius + e.hitRadius) continue
      const ang = Math.atan2(dy, dx)
      const kind = def.damageKind ?? 'magic'
      const damage=e.resolveDamage({base:def.damage,damageBonus,area:true,aoeReduction:e.def.combat.aoeReduction},kind).damage
      e.takeDamage(damage, ang, def.knockback, def.stun,kind)
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
      seed: randomVisual() * Math.PI * 2,
      follow: true,
      owner
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
  spawnGroundDrop(id: ItemId, x: number, y: number,durability?:number): void {
    this.drops.push(new Drop(x, y, id,durability))
  }

  render(ctx: CanvasRenderingContext2D, player: Player): void {
    this.renderPlayers(ctx,[player],player)
  }
  renderPlayers(ctx: CanvasRenderingContext2D, players: readonly Player[], player: Player = players[0]!): void {
    if (!player) return
    const started=profiler.start(),view=canvasViewport(ctx),groundStarted=profiler.start()
    this.ensureRenderTextures()
    // 房间纹理 2x 超采样烘焙，此处缩回世界尺寸（相机 zoom 放大后仍锐利）
    const roomW = this.map.cols * this.map.tile
    const roomH = this.map.rows * this.map.tile
    this.oldHell?.renderGround(ctx,view,this.time)
    if(this.texture) drawVisibleLayer(ctx,this.texture,roomW,roomH,view)
    this.nature?.renderGround(ctx,this.time)
    this.threats.renderGround(ctx,this.map,view)
    if (this.weaponImpacts.length) {
      ctx.save(); ctx.beginPath()
      const inset = CONFIG.wallThickness * CONFIG.tile
      ctx.rect(inset, inset, roomW - inset * 2, roomH - inset * 2); ctx.clip()
      for (const effect of this.weaponImpacts) if (effect.age >= 0) effect.render(ctx, effect)
      ctx.restore()
    }
    this.map.renderOreLayer(ctx)
    this.map.renderOreFx(ctx)
    profiler.end('ground',groundStarted)
    // 稀疏落尘与墙边水滴，只作气氛，不遮挡矿脉和弹幕。（猩红圣堂无矿洞尘水，主题房跳过）
    ctx.save()
    if(this.script?.theme!=='grimm'&&!this.oldHell){
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
    if(!this.oldHell)this.warp.render(ctx, roomW, roomH)

    // 全屋 y-sort：掉落/敌人/玩家/立体摆件/地面交互物统一按脚底 y 排序（星露谷式前后遮挡）
    const actorStarted=profiler.start();this.drawActors(ctx,players,view);profiler.end('actors',actorStarted)
    // 批次 F⑦追加：漂浮雾气轻盖实体（柔遮罩）；弹幕仍在最上层保证战斗可读
    // 同上：传世界逻辑尺寸，与纹理物理像素解耦
    if(this.oldHell)this.oldHell.renderAtmosphere(ctx,view,this.time,players,this.fogClearStart)
    else {ctx.save();ctx.globalAlpha*=this.artStyle.scene.fogStrength
      this.fog.render(ctx, roomW, roomH);ctx.restore()}
    // 弹幕画在最上层（东方弹幕必须醒目，不参与遮挡）
    this.threats.renderWarnings(ctx,view,this.time)
    for(const owner of players){
    const flight = owner.rangedFlight
    if (flight&&visible(view,flight.x,flight.y,80)) {
      ctx.save(); ctx.translate(flight.x, flight.y); ctx.rotate(flight.rotation)
      withSimulationAppearance(owner.appearance??simulationAppearance(),()=>getItemDef(flight.item).weapon?.drawHeld?.(ctx, { time: this.time })); ctx.restore()
    }
    }
    // 读取一次当前世界变换，含相机缩放、震动和设备像素比；仅剔除绘制，不剔除逻辑。
    const transform = ctx.getTransform()
    const canCull = transform.b === 0 && transform.c === 0 && transform.a !== 0 && transform.d !== 0
    const x0 = -transform.e / transform.a, x1 = (ctx.canvas.width - transform.e) / transform.a
    const y0 = -transform.f / transform.d, y1 = (ctx.canvas.height - transform.f) / transform.d
    const left = Math.min(x0, x1), right = Math.max(x0, x1), top = Math.min(y0, y1), bottom = Math.max(y0, y1)
    for (const b of this.bullets) if (!canCull || b.visibleIn(left, top, right, bottom)) b.render(ctx)
    for (const player of players) { player.bow.render(ctx); player.scp127.renderFlights(ctx) }
    this.fx.render(ctx)
    this.renderSpellFx(ctx)
    this.renderPrismaBlasts(ctx)
    // 地缝热气是空气层：画在实体之后、北墙立面之前
    this.steam.render(ctx)
    this.renderNorthFace(ctx, player)
    this.plants?.renderWall(ctx, this.time, player)
    this.plants?.renderCeiling(ctx, this.time, player)
    this.oldHell?.renderCeiling(ctx,view,players)
    // 火苗贴在墙面上，必须在立面遮挡层之后画（火光是发光体，盖最上也不穿帮）
    this.renderTorchFlames(ctx)
    // 塔罗牌穿过障碍，牌背与抽牌提示也绘制在地图遮挡层之上。
    for (const player of players) player.tarot.render(ctx, player)
    this.touchRenderBudget();profiler.end('roomRender',started)
  }

  /** 梦想封印全屏白闪强度（0~1；CaveModule 在屏幕空间盖白） */
  get sealFlashAlpha(): number {
    return this.sealFlash > 0 ? this.sealFlash / this.sealFlashDur : 0
  }

  /** 地面剧情物品：金色光柱 + 上下浮动的物件简形（镐/剑可辨识，其余走通用菱形） */
  private renderGroundItem(ctx: CanvasRenderingContext2D, it: Interactable): void {
    renderCollectible(ctx,it,{x:it.x-48,y:it.y-76,width:96,height:112},g=>this.renderGroundItemCurrent(g,it))
  }
  private renderGroundItemCurrent(ctx: CanvasRenderingContext2D, it: Interactable): void {
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
    drawVisibleLayer(ctx,face,CONFIG.roomCols*CONFIG.tile,face.height/2,canvasViewport(ctx))
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
      if (s.render) { s.render(ctx,{x:s.x,y:s.y,age:s.t,duration:s.dur,seed:s.seed}); continue }
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
    // 旧地狱的矿道入口已参与实体排序，不能再叠加旧版旋涡符印。
    if(this.oldHell)return
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

/** 门箭头朝向（从门格指向房间内部） */
const DOOR_ARROW: Record<Dir, { x: number; y: number }> = {
  N: { x: 0, y: 1 },
  S: { x: 0, y: -1 },
  W: { x: 1, y: 0 },
  E: { x: -1, y: 0 }
}
