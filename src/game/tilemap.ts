import { nextEntityId } from '../core/simulation/events'
import { randomGeneration } from '../core/simulation/random'
import { CONFIG } from './config'
import { drawOreBase } from './art/oreVein'
import { canvasViewport,visible } from '../core/rendering/Viewport'
import { minerals, rollMineralId, mineralAvailableOnFloor, rewardRareMineralIds } from '../content/minerals/registry'
import { MINERAL_COPPER_ID } from '../content/minerals/vanilla/ids'
import type { MineralId } from '../content/minerals/types'
import { weightedPick } from '../content/core/Registry'

/**
 * 矿洞瓦片地图
 * - 网格数据：墙 / 地面 / 矿脉（有 HP 的可破坏瓦片，碎后露出地面）
 * - 矿脉静态晶簇预渲染到离屏 Canvas，崩落时只清除单格
 * - 裂纹阶段与敲击闪白每帧实时绘制（矿脉数量少，遍历无压力）
 * - 实体（玩家/敌人）统一走"先位移后分轴修正"的 AABB vs 瓦片碰撞
 */

export const TILE_FLOOR = 0
export const TILE_WALL = 1
export const TILE_ORE = 2
/** 封印中的门（实心，清场后解封） */
export const TILE_DOOR_CLOSED = 3
/** 已解封的门（可通行，走上去切换房间） */
export const TILE_DOOR_OPEN = 4
/** 岩浆与深坑阻挡行走，但不会像岩壁一样挡住飞行弹体。 */
export const TILE_LAVA = 5
export const TILE_PIT = 6

/** 门在瓦片网格上的格位（由房间的门朝向推导） */
export interface DoorSlot {
  col: number
  row: number
}

/** 房间瓦片地图生成参数 */
export interface TileMapOptions {
  mineralIds?: readonly MineralId[]
  lavaBankMinerals?: {roomChance:number;count:readonly [number,number]}
  terrain?: import('./cave/dungeon/types').RoomTerrain
  /** 进入房间时的出生格（周围留空不刷怪/矿） */
  spawnCol: number
  spawnRow: number
  /** 矿脉格数量区间 */
  oreRange: readonly [number, number]
  /** 房型（矿种 spawn 房型门控用） */
  roomKind: string
  /** 楼层深度（矿种 spawn 深度门控用） */
  depth: number
  /** 楼层号（正式第 1 层＝1，序章＝0；矿种 spawn 楼层门控用） */
  floor: number
  /** 本房所有门格（内缘一圈墙中的闸门） */
  doors: readonly DoorSlot[]
}

/** 岩包材质变体：0 花岗岩（冷灰颗粒）/ 1 砂岩（暖黄层理）/ 2 板岩（青灰劈理） */
export type RockMat = 0 | 1 | 2

export interface OreTile {
  entityId?: string
  col: number
  row: number
  offsetX: number
  offsetY: number
  /** 矿种 id（查矿物注册表；命名空间字符串，MOD 矿种直接进入） */
  kind: MineralId
  hp: number
  maxHp: number
  /** 敲击命中闪白计时 */
  flash: number
  /**
   * 矿脉形态：
   * - 'ore'  显矿态：矿簇晶簇直接露出（暗房发光、敲碎必掉矿），少数
   * - 'rock' 岩包态：外观只是普通岩石（不发光），敲碎必掉石料、hasOre 时才藏矿
   */
  vein: 'ore' | 'rock'
  /** 岩包态里是否真的藏矿（显矿态恒 true；决定裂纹露矿色与掉落） */
  hasOre: boolean
  /** 岩包的随机材质（三种同为岩石，外观语言不同） */
  rockMat: RockMat
}

/** 需要做瓦片碰撞的实体形状（结构化类型，玩家/敌人直接满足） */
export interface Collider {
  x: number
  y: number
  vx: number
  vy: number
  /** 碰撞盒半径（AABB 半宽/半高） */
  r: number
}

/** 确定性 2D 哈希：让裂纹/晶簇位置在同一格上永远一致，不逐帧抖动 */
function hash2(a: number, b: number): number {
  let n = (a * 374761393 + b * 668265263) | 0
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}

export class TileMap {
  readonly cols: number
  readonly rows: number
  /** 寻路缓存只在通行拓扑变化时失效，敲击闪白和环境动画不触发重建。 */
  navigationRevision = 0
  private readonly doorCells = new Set<number>()
  readonly tile: number
  /** 活动区边界（墙内缘） */
  readonly bounds: { left: number; top: number; right: number; bottom: number }

  private tiles: Uint8Array
  private ores = new Map<number, OreTile>()
  /**
   * 矿脉静态岩基离屏层（2x 超采样烘焙）。
   * 相机 cover zoom 下世界纹理会被放大 1.3~1.8 倍，原生 48px/格烘焙会糊；
   * 物理画布按 SS 倍建，上下文恒挂 SS 缩放，绘制坐标全部沿用世界单位。
   */
  private static readonly SS = 2
  private oreChunks=new Map<number,{image:HTMLCanvasElement;ctx:CanvasRenderingContext2D;x:number;y:number;width:number;height:number}>()
  private dirtyChunks=new Set<number>()
  private visualRevision=0
  get oreRevision():number{return this.visualRevision}
  private oreDirty = true
  private oreAllDirty=true

  constructor(opts: TileMapOptions) {
    const { tile, roomCols, roomRows, wallThickness } = CONFIG
    this.cols = opts.terrain?.cols ?? roomCols
    this.rows = opts.terrain?.rows ?? roomRows
    this.tile = tile
    this.bounds = {
      left: wallThickness * tile,
      top: wallThickness * tile,
      right: (this.cols - wallThickness) * tile,
      bottom: (this.rows - wallThickness) * tile
    }

    this.tiles = new Uint8Array(this.cols * this.rows)

    this.generate(opts)
  }

  captureSimulation(): { tiles: number[]; ores: OreTile[] } {
    return { tiles: Array.from(this.tiles), ores: [...this.ores.values()].map(ore => ({ ...ore })) }
  }
  restoreSimulation(state: { tiles: number[]; ores: OreTile[] }): void {
    if (state.tiles.length !== this.cols * this.rows) throw new Error('地图快照尺寸不兼容')
    this.tiles = Uint8Array.from(state.tiles)
    this.navigationRevision++
    this.ores = new Map(state.ores.map(ore => [this.key(ore.col, ore.row), { ...ore }]))
    this.releaseRenderResources();this.visualRevision++
    this.oreDirty = true
  }

  // —— 基础查询 ——

  private key(col: number, row: number): number {
    return row * this.cols + col
  }

  worldToCol(x: number): number {
    return Math.floor(x / this.tile)
  }
  worldToRow(y: number): number {
    return Math.floor(y / this.tile)
  }

  /** 越界一律视为墙（实体永远逃不出地图）；开启的门可通行 */
  isSolid(col: number, row: number): boolean {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return true
    const v = this.tiles[this.key(col, row)]
    return v !== TILE_FLOOR && v !== TILE_DOOR_OPEN
  }

  /** 地形通行与弹幕遮挡分离，岩浆上方仍可以射击。 */
  blocksProjectiles(col:number,row:number,ignoreOre=false):boolean {
    const tile=this.tileAt(col,row)
    return tile!==TILE_FLOOR&&tile!==TILE_DOOR_OPEN&&tile!==TILE_LAVA&&tile!==TILE_PIT&&!(ignoreOre&&tile===TILE_ORE)
  }

  /** 读取瓦片类型（门触发判定用） */
  tileAt(col: number, row: number): number {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return TILE_WALL
    return this.tiles[this.key(col, row)]
  }

  /** 解封一扇门：封印门 → 可通行 */
  openDoor(col: number, row: number): boolean {
    const k = this.key(col, row)
    if (!this.doorCells.has(k) || this.tiles[k] === TILE_DOOR_OPEN) return false
    this.tiles[k] = TILE_DOOR_OPEN
    this.navigationRevision++
    return true
  }

  /** 关门（剧情锁门用；仅开启中的闸门可关，返回是否发生变化） */
  closeDoor(col: number, row: number): boolean {
    const k = this.key(col, row)
    if (!this.doorCells.has(k) || this.tiles[k] === TILE_DOOR_CLOSED) return false
    this.tiles[k] = TILE_DOOR_CLOSED
    this.navigationRevision++
    return true
  }

  oreAt(col: number, row: number): OreTile | undefined {
    return this.ores.get(this.key(col, row))
  }

  /** 枚举当前全部未碎矿格（批次 E：晶簇运行时层与矿簇光源用） */
  forEachOre(cb: (ore: OreTile) => void): void {
    this.ores.forEach(cb)
  }
  /** 剧情预留区域或落石封路：仅改内墙范围，不触碰门，不产生采矿奖励。 */
  setStoryArea(left: number, top: number, right: number, bottom: number, solid = false): void {
    this.navigationRevision++
    const wall = CONFIG.wallThickness
    let changedOre = false
    for (let row = Math.max(wall, top); row <= Math.min(this.rows-wall-1, bottom); row++) {
      for (let col = Math.max(wall, left); col <= Math.min(this.cols-wall-1, right); col++) {
        const key = this.key(col, row), tile = this.tiles[key]
        if (tile === TILE_DOOR_CLOSED || tile === TILE_DOOR_OPEN) continue
        changedOre = this.ores.delete(key) || changedOre
        this.tiles[key] = solid ? TILE_WALL : TILE_FLOOR
      }
    }
    if (changedOre) {
      this.visualRevision++;this.dirtyChunks.clear();this.oreAllDirty=true
      this.oreDirty = true
    }
  }

  /** 剩余未敲碎的矿脉格数（HUD 用） */
  get oreCount(): number {
    return this.ores.size
  }

  /** 世界坐标点是否落在实心瓦片上（敌人生成落位用） */
  solidAtWorld(x: number, y: number, ignoreOre = false): boolean {
    const col = this.worldToCol(x), row = this.worldToRow(y)
    const type = this.tileAt(col, row)
    if (type !== TILE_ORE && this.isSolid(col, row)) return true
    if(ignoreOre)return false
    for (const ore of this.ores.values()) {
      const left = ore.col * this.tile + ore.offsetX, top = ore.row * this.tile + ore.offsetY
      if (x >= left && x < left + this.tile && y >= top && y < top + this.tile) return true
    }
    return false
  }

  // —— 生成 ——

  private generate(opts: TileMapOptions): void {
    const { wallThickness, mine } = CONFIG

    if(opts.terrain)this.tiles=Uint8Array.from(opts.terrain.tiles)
    // 四周墙
    else for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        if (c < wallThickness || r < wallThickness || c >= this.cols - wallThickness || r >= this.rows - wallThickness) {
          this.tiles[this.key(c, r)] = TILE_WALL
        }
      }
    }

    // 门格落在内缘一圈墙中，初始全部封印；门格及四邻禁止刷矿，保证门洞畅通
    const blockedForOre = new Set<number>()
    if(opts.terrain){
      for(const k of opts.terrain.reserved)blockedForOre.add(k)
      // 残屋内与门前留空，避免矿格占住容器、入口和屋内走道。
      for(const b of opts.terrain.buildings)for(let r=b.row;r<=b.row+b.height;r++)for(let c=b.col;c<b.col+b.width;c++)blockedForOre.add(this.key(c,r))
    }
    for (const d of opts.doors) {
      this.doorCells.add(this.key(d.col,d.row))
      this.tiles[this.key(d.col, d.row)] = TILE_DOOR_CLOSED
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
          blockedForOre.add(this.key(d.col + dc, d.row + dr))
        }
      }
    }

    const oreTarget = opts.oreRange[0] + Math.floor(randomGeneration() * (opts.oreRange[1] - opts.oreRange[0] + 1))
    if(oreTarget<=0)return
    const rare=opts.roomKind==='reward'?rewardRareMineralIds(opts.floor,opts.mineralIds):undefined
    const replacements=minerals.select(d=>mineralAvailableOnFloor(d,opts.floor)&&(d.spawn.rockReplacementChance??0)>0
      &&(!opts.mineralIds||opts.mineralIds.includes(d.id))&&(!d.spawn.rooms||d.spawn.rooms.includes(opts.roomKind)))
    let placed = 0
    let guard = 0
    while (placed < oreTarget && guard < 800) {
      guard++
      const col = wallThickness + Math.floor(randomGeneration() * (this.cols - wallThickness * 2))
      const row = wallThickness + Math.floor(randomGeneration() * (this.rows - wallThickness * 2))
      // 出生点周围留空，避免开局贴脸
      if (Math.hypot(col - opts.spawnCol, row - opts.spawnRow) < mine.spawnClearTiles) continue
      const k = this.key(col, row)
      if (this.tiles[k] !== TILE_FLOOR || blockedForOre.has(k)) continue

      // 矿种按注册表权重混编（房型/深度门控由 MineralDef.spawn 声明）；
      // 总池为空（所有矿包都没加载）时兜底铜矿，保证生成循环不中断
      let kind: MineralId = rollMineralId(opts.roomKind, opts.depth, opts.floor,opts.mineralIds) ?? MINERAL_COPPER_ID
      // 形态：少数直接露矿簇，多数只是普通岩石（敲碎才知道藏没藏矿）
      const vein: OreTile['vein'] = randomGeneration() < mine.exposedChance ? 'ore' : 'rock'
      let replacement=false
      if(vein==='rock'&&replacements.length){
        const roll=randomGeneration();let probability=0
        for(const d of replacements){
          probability+=(d.spawn.rockReplacementChance??0)*(rare?.has(d.id)?3:1)
          if(roll<Math.min(1,probability)){kind=d.id;replacement=true;break}
        }
      }
      const hasOre = !replacement && (vein === 'ore' || randomGeneration() < mine.oreInRockChance)
      this.addNaturalOre(col,row,kind,vein,hasOre,replacement)
      placed++
    }
    const shore=opts.lavaBankMinerals
    // 整房低概率摇一次；岸线再长也不会逐格放大中奖率，失败不转移到普通陆地。
    if(!shore||randomGeneration()>=shore.roomChance)return
    const shorePool=minerals.select(d=>d.spawn.placement==='lava_bank'&&d.spawn.weight>0&&mineralAvailableOnFloor(d,opts.floor)
      &&(!opts.mineralIds||opts.mineralIds.includes(d.id))&&(!d.spawn.rooms||d.spawn.rooms.includes(opts.roomKind)))
    const candidates:Array<{col:number;row:number}>=[]
    const neighbors=[[1,0],[-1,0],[0,1],[0,-1]] as const
    for(let row=1;row<this.rows-1;row++)for(let col=1;col<this.cols-1;col++){
      if(this.tileAt(col,row)!==TILE_FLOOR||blockedForOre.has(this.key(col,row))||Math.hypot(col-opts.spawnCol,row-opts.spawnRow)<mine.spawnClearTiles)continue
      if(!neighbors.some(([dc,dr])=>this.tileAt(col+dc,row+dr)===TILE_LAVA)||!neighbors.some(([dc,dr])=>this.tileAt(col+dc,row+dr)===TILE_FLOOR))continue
      candidates.push({col,row})
    }
    const count=shore.count[0]+Math.floor(randomGeneration()*(shore.count[1]-shore.count[0]+1)),chosen:Array<{col:number;row:number}>=[]
    while(chosen.length<count&&candidates.length){
      const candidate=candidates.splice(Math.floor(randomGeneration()*candidates.length),1)[0]!
      if(chosen.some(p=>Math.hypot(p.col-candidate.col,p.row-candidate.row)<3))continue
      const kind=weightedPick(shorePool,d=>d.spawn.weight,randomGeneration)?.id
      if(!kind)break
      this.addNaturalOre(candidate.col,candidate.row,kind,'ore',true);chosen.push(candidate)
    }
  }

  /** 普通矿与岸矿共用实体、硬度、碰撞和续战保存，不另建一套可挖对象。 */
  private addNaturalOre(col:number,row:number,kind:MineralId,vein:OreTile['vein'],hasOre:boolean,specialRock=false):void {
    const [lo,hi]=hasOre||specialRock?minerals.require(kind).hp:[80,100]
    const maxHp=lo+Math.floor(randomGeneration()*(hi-lo+1))
    const ore:OreTile={entityId:nextEntityId('ore'),col,row,kind,vein,hasOre,hp:maxHp,maxHp,flash:0,
      offsetX:(randomGeneration()-.5)*8,offsetY:(randomGeneration()-.5)*8,rockMat:Math.floor(randomGeneration()*3) as RockMat}
    const k=this.key(col,row);this.tiles[k]=TILE_ORE;this.ores.set(k,ore);this.drawOreTile(ore)
  }

  /**
   * 在离屏层上烘焙单格矿脉岩基（批次 E 精修版）。
   * 晶簇不在这里画——运行时由 art/oreVein.drawOreCrystals 绘制并参与 y-sort。
   */
  private drawOreTile(ore: OreTile): void {
    this.oreDirty = true
  }

  // —— 玩法交互 ——

  /**
   * 敲击矿脉一格
   * @returns 仅命中未碎返回 {broken:false,ratio}；碎掉返回 {broken:true,kind,vein,hasOre}；不是矿脉返回 null
   */
  hitOre(col: number, row: number, efficiency: number): {
    broken: boolean
    kind: MineralId
    ratio: number
    vein: OreTile['vein']
    hasOre: boolean
  } | null {
    const k = this.key(col, row)
    const ore = this.ores.get(k)
    if (!ore) return null
    ore.hp = Math.max(0, ore.hp - efficiency)
    ore.flash = CONFIG.mine.hitFlash
    if (ore.hp > 0) {
      return { broken: false, kind: ore.kind, ratio: ore.hp / ore.maxHp, vein: ore.vein, hasOre: ore.hasOre }
    }

    // 崩落：数据层变地面，离屏层只清除这一格
    this.tiles[k] = TILE_FLOOR
    this.ores.delete(k)
    this.navigationRevision++
    this.visualRevision++
    this.markOreChunks(ore)
    // 偏移可能跨格，重烘焙稀疏矿层避免擦掉相邻矿体或留下边缘残影。
    this.oreDirty = true
    return { broken: true, kind: ore.kind, ratio: 0, vein: ore.vein, hasOre: ore.hasOre }
  }

  /** 每帧逻辑：闪白衰减 */
  update(dt: number): void {
    for (const ore of this.ores.values()) {
      ore.flash = Math.max(0, ore.flash - dt)
    }
  }

  // —— 渲染 ——

  get rasterBytes():number {let bytes=0;for(const chunk of this.oreChunks.values())bytes+=chunk.image.width*chunk.image.height*4;return bytes}
  releaseRenderResources():void {for(const chunk of this.oreChunks.values())chunk.image.width=chunk.image.height=1;this.oreChunks.clear();this.dirtyChunks.clear();this.oreDirty=this.oreAllDirty=true}
  private markOreChunks(ore:OreTile):void {
    const size=this.tile*4,cols=Math.ceil(this.cols/4)
    const left=ore.col*this.tile+ore.offsetX-this.tile,right=(ore.col+1)*this.tile+ore.offsetX+this.tile
    const top=ore.row*this.tile+ore.offsetY-this.tile,bottom=(ore.row+1)*this.tile+ore.offsetY+this.tile
    for(let row=Math.max(0,Math.floor(top/size));row<=Math.min(Math.ceil(this.rows/4)-1,Math.floor(bottom/size));row++)for(let col=Math.max(0,Math.floor(left/size));col<=Math.min(cols-1,Math.floor(right/size));col++)this.dirtyChunks.add(row*cols+col)
  }
  private bakeOreChunks():void {
    const size=this.tile*4,cols=Math.ceil(this.cols/4),groups=new Map<number,OreTile[]>()
    for(const ore of this.ores.values()){
      const left=ore.col*this.tile+ore.offsetX-this.tile,right=(ore.col+1)*this.tile+ore.offsetX+this.tile,top=ore.row*this.tile+ore.offsetY-this.tile,bottom=(ore.row+1)*this.tile+ore.offsetY+this.tile
      for(let row=Math.max(0,Math.floor(top/size));row<=Math.min(Math.ceil(this.rows/4)-1,Math.floor(bottom/size));row++)for(let col=Math.max(0,Math.floor(left/size));col<=Math.min(cols-1,Math.floor(right/size));col++){
        const key=row*cols+col;let group=groups.get(key);if(!group){group=[];groups.set(key,group)}group.push(ore)
      }
    }
    for(const [key,chunk] of this.oreChunks)if(!groups.has(key)){chunk.image.width=chunk.image.height=1;this.oreChunks.delete(key)}
    for(const [key,ores] of groups){
      let chunk=this.oreChunks.get(key)
      if(chunk&&!this.oreAllDirty&&!this.dirtyChunks.has(key))continue
      if(!chunk){
        const x=key%cols*size,y=Math.floor(key/cols)*size,width=Math.min(size,this.cols*this.tile-x),height=Math.min(size,this.rows*this.tile-y),image=document.createElement('canvas')
        image.width=width*TileMap.SS;image.height=height*TileMap.SS
        chunk={image,ctx:image.getContext('2d')!,x,y,width,height};this.oreChunks.set(key,chunk)
      }
      chunk.ctx.setTransform(TileMap.SS,0,0,TileMap.SS,-chunk.x*TileMap.SS,-chunk.y*TileMap.SS)
      chunk.ctx.clearRect(chunk.x,chunk.y,chunk.width,chunk.height)
      for(const ore of ores)drawOreBase(chunk.ctx,ore)
    }
    this.dirtyChunks.clear();this.oreDirty=this.oreAllDirty=false
  }
  /** 稀疏矿层分块烘焙，敲碎只更新受影响块，屏外块不提交绘制。 */
  renderOreLayer(ctx: CanvasRenderingContext2D): void {
    if(this.oreDirty)this.bakeOreChunks()
    const view=canvasViewport(ctx)
    for(const chunk of this.oreChunks.values())if(chunk.x+chunk.width>=view.left&&chunk.x<=view.right&&chunk.y+chunk.height>=view.top&&chunk.y<=view.bottom)ctx.drawImage(chunk.image,chunk.x,chunk.y,chunk.width,chunk.height)
  }

  /** 实时裂纹 + 敲击闪白（画在实体之下） */
  renderOreFx(ctx: CanvasRenderingContext2D): void {
    const t = this.tile
    const view=canvasViewport(ctx)
    for (const ore of this.ores.values()) {
      if(!visible(view,(ore.col+.5)*t+ore.offsetX,(ore.row+.5)*t+ore.offsetY,t*1.5))continue
      // 金属矿主体与反馈在排序层一起绘制，避免矩形白块露出轮廓。
      const form=minerals.require(ore.kind).visual.form
      if(ore.vein==='ore'&&(form==='copper'||form==='iron'||form==='gold'||form==='metal'))continue
      const x = ore.col * t + ore.offsetX
      const y = ore.row * t + ore.offsetY

      // 裂纹阶段：0 完好 → 3 将碎
      const damageRatio = 1 - ore.hp / ore.maxHp
      if (damageRatio > 0) {
        const stage = Math.min(3, Math.ceil(damageRatio * 3))
        ctx.strokeStyle = `rgba(15,10,8,${0.4 + stage * 0.15})`
        ctx.lineWidth = 1.4
        for (let i = 0; i < stage; i++) {
          const sx = x + 10 + hash2(ore.col + i, ore.row) * (t - 20)
          const sy = y + 10 + hash2(ore.col, ore.row + i) * (t - 20)
          ctx.beginPath()
          ctx.moveTo(sx, sy)
          ctx.lineTo(sx + 5 + hash2(ore.col * 3 + i, ore.row) * 6, sy + 6)
          ctx.lineTo(sx + 3, sy + 12 + hash2(ore.row, ore.col + i) * 5)
          ctx.stroke()
        }
      }

      // 敲击闪白（只闪岩基区域，晶簇本体的爆白由 oreVein 运行时层负责）
      if (ore.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${(ore.flash / CONFIG.mine.hitFlash) * 0.28})`
        ctx.fillRect(x + 5, y + 15, t - 10, t - 20)
      }
    }
  }

  // —— 碰撞 ——

  /**
   * 分轴扫掠 AABB vs 瓦片：
   * 每轴独立"候选位移 → 修正"，修正时扫描从旧前缘到新前缘之间的【所有瓦片】
   * （而不仅是移动后前缘的一行/列），高速对角冲刺也不会隧穿；
   * 速度为 0 但已与实心格重叠时（被另一轴位移/外力带入），沿最小穿透方向推出，
   * 杜绝"卡进矿格后滑到另一面"的瞬移。
   */
  moveEntity(e: Collider, dt: number, ignoreOre = false): void {
    // —— X 轴 ——
    const prevX = e.x
    e.x += e.vx * dt
    if(!ignoreOre)this.resolveOreAxis(e, prevX, 'x')
    this.resolveX(e, prevX)

    // —— Y 轴（列范围基于 X 修正后的新位置，互相兜底） ——
    const prevY = e.y
    e.y += e.vy * dt
    if(!ignoreOre)this.resolveOreAxis(e, prevY, 'y')
    this.resolveY(e, prevY)

    // 活动区保险：放宽到门格所在的墙圈（门开时实体要能走到门格中心触发切房）；
    // 门格之外仍是两格厚墙，碰撞修正会挡住，这里永远只是兜底
    const t = this.tile
    e.x = Math.max(this.bounds.left - t + e.r, Math.min(e.x, this.bounds.right + t - e.r))
    e.y = Math.max(this.bounds.top - t + e.r, Math.min(e.y, this.bounds.bottom + t - e.r))
  }

  /** 偏移矿格使用真实AABB扫掠，墙和门继续使用原瓦片碰撞。 */
  private resolveOreAxis(e: Collider, previous: number, axis: 'x' | 'y'): void {
    const other = axis === 'x' ? e.y : e.x
    let target = e[axis]
    for (const ore of this.ores.values()) {
      const lo = axis === 'x' ? ore.col * this.tile + ore.offsetX : ore.row * this.tile + ore.offsetY
      const cross = axis === 'x' ? ore.row * this.tile + ore.offsetY : ore.col * this.tile + ore.offsetX
      if (other + e.r <= cross || other - e.r >= cross + this.tile) continue
      const hi = lo + this.tile
      if (target > previous && previous + e.r <= lo + .0001 && target + e.r > lo) target = Math.min(target, lo - e.r)
      else if (target < previous && previous - e.r >= hi - .0001 && target - e.r < hi) target = Math.max(target, hi + e.r)
      else if (target + e.r > lo + .0001 && target - e.r < hi - .0001) target = target < (lo + hi) / 2 ? lo - e.r : hi + e.r
    }
    if (target !== e[axis]) { e[axis] = target; if (axis === 'x') e.vx = 0; else e.vy = 0 }
  }

  /** 某列在给定行区间内是否存在实心格 */
  private colBlocked(col: number, rMin: number, rMax: number): boolean {
    for (let r = rMin; r <= rMax; r++) {
      if (this.tileAt(col, r) !== TILE_ORE && this.isSolid(col, r)) return true
    }
    return false
  }

  /** 某行在给定列区间内是否存在实心格 */
  private rowBlocked(row: number, cMin: number, cMax: number): boolean {
    for (let c = cMin; c <= cMax; c++) {
      if (this.tileAt(c, row) !== TILE_ORE && this.isSolid(c, row)) return true
    }
    return false
  }

  /**
   * X 轴两层判定（moveEntity 先 X 后 Y）：
   * ① 穿越撞击：仅当【前缘在本帧真正越过】格边缘（prev 尚在边外）才钉到撞击边，
   *    既防高速隧穿，又不会把贴着/斜擦着的格误判成新撞击；
   * ② 几何推出：候选 AABB 仍与实心格重叠时（侧向擦碰、被另一轴带入），
   *    按玩家中心相对格中心切到【近侧】，取所有候选里修正量最小者。
   *    X 轴在本步把所有 X 方向重叠清干净，Y 轴随后的列范围就不会再包含斜角格，
   *    从根上消除"贴矿斜走被 Y 轴钉到矿顶/矿底"的瞬移。
   */
  private resolveX(e: Collider, prevX: number): void {
    const t = this.tile
    const eps = 0.0001
    const rMin = Math.floor((e.y - e.r) / t)
    const rMax = Math.floor((e.y + e.r - eps) / t)
    const cMin = Math.floor((e.x - e.r) / t)
    // 右缘/下缘恰好压格边时不算与该格重叠（仅相切）：减 eps 排他，
    // 否则贴在障碍【左/上】侧稳态时覆盖范围会错误吞进障碍格，
    // 被另一轴几何推出切到格的另一侧（左/上方贴墙瞬移的根因）
    const cMax = Math.floor((e.x + e.r - eps) / t)

    // ① 穿越撞击：扫描【旧前缘→新前缘】扫过的整段列（高速深穿透也不漏格）
    let hit: number | null = null
    if (e.vx > 0) {
      const cStart = Math.floor((prevX + e.r) / t)
      const cEnd = Math.floor((e.x + e.r) / t)
      for (let c = cStart; c <= cEnd; c++) {
        if (!this.colBlocked(c, rMin, rMax)) continue
        const left = c * t
        // 必须是新前缘真正越过、且旧前缘尚在缘外（贴着墙原地蹭不会误触发）
        if (e.x + e.r > left + eps && prevX + e.r <= left + eps) {
          const cand = left - e.r
          hit = hit === null ? cand : Math.min(hit, cand)
        }
      }
    } else if (e.vx < 0) {
      const cStart = Math.floor((prevX - e.r) / t)
      const cEnd = Math.floor((e.x - e.r) / t)
      for (let c = cStart; c >= cEnd; c--) {
        if (!this.colBlocked(c, rMin, rMax)) continue
        const right = (c + 1) * t
        if (e.x - e.r < right - eps && prevX - e.r >= right - eps) {
          const cand = right + e.r
          hit = hit === null ? cand : Math.max(hit, cand)
        }
      }
    }
    if (hit !== null) {
      e.x = hit
      e.vx = 0
      return
    }

    // ② 残余重叠 → 几何近侧推出（修正量最小，不管速度方向）
    let target: number | null = null
    for (let c = cMin; c <= cMax; c++) {
      if (!this.colBlocked(c, rMin, rMax)) continue
      const center = c * t + t / 2
      const cand = e.x >= center ? (c + 1) * t + e.r : c * t - e.r
      if (target === null || Math.abs(cand - e.x) < Math.abs(target - e.x)) target = cand
    }
    if (target !== null) {
      e.x = target
      e.vx = 0
    }
  }

  /** Y 轴两层判定（镜像 resolveX；列范围基于 X 已修正后的位置） */
  private resolveY(e: Collider, prevY: number): void {
    const t = this.tile
    const eps = 0.0001
    const cMin = Math.floor((e.x - e.r) / t)
    // 右缘/下缘恰好压格边时不算与该格重叠（仅相切）：减 eps 排他，
    // 否则贴在障碍【左/上】侧稳态时覆盖范围会错误吞进障碍格，
    // 被另一轴几何推出切到格的另一侧（左/上方贴墙瞬移的根因）
    const cMax = Math.floor((e.x + e.r - eps) / t)
    const rMin = Math.floor((e.y - e.r) / t)
    const rMax = Math.floor((e.y + e.r - eps) / t)

    // ① 穿越撞击：扫描【旧前缘→新前缘】扫过的整段行
    let hit: number | null = null
    if (e.vy > 0) {
      const rStart = Math.floor((prevY + e.r) / t)
      const rEnd = Math.floor((e.y + e.r) / t)
      for (let r = rStart; r <= rEnd; r++) {
        if (!this.rowBlocked(r, cMin, cMax)) continue
        const top = r * t
        if (e.y + e.r > top + eps && prevY + e.r <= top + eps) {
          const cand = top - e.r
          hit = hit === null ? cand : Math.min(hit, cand)
        }
      }
    } else if (e.vy < 0) {
      const rStart = Math.floor((prevY - e.r) / t)
      const rEnd = Math.floor((e.y - e.r) / t)
      for (let r = rStart; r >= rEnd; r--) {
        if (!this.rowBlocked(r, cMin, cMax)) continue
        const bottom = (r + 1) * t
        if (e.y - e.r < bottom - eps && prevY - e.r >= bottom - eps) {
          const cand = bottom + e.r
          hit = hit === null ? cand : Math.max(hit, cand)
        }
      }
    }
    if (hit !== null) {
      e.y = hit
      e.vy = 0
      return
    }

    // ② 残余重叠 → 几何近侧推出
    let target: number | null = null
    for (let r = rMin; r <= rMax; r++) {
      if (!this.rowBlocked(r, cMin, cMax)) continue
      const center = r * t + t / 2
      const cand = e.y >= center ? (r + 1) * t + e.r : r * t - e.r
      if (target === null || Math.abs(cand - e.y) < Math.abs(target - e.y)) target = cand
    }
    if (target !== null) {
      e.y = target
      e.vy = 0
    }
  }
}
