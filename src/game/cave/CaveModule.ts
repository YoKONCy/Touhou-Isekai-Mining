import { setPlayerAppearance } from '../../shared/playerAppearance'
import { FifthFloorDirector } from './FifthFloorDirector'
import { FIFTH_FLAGS } from '../../content/story/mainline/fifth-entry/state'
import { canvasViewport } from '../../core/rendering/Viewport'
import { searchRewardEffects,collectSearchReward,settleSearchRewards } from '../../shared/searchRewards'
import { LocalPlayers, type LocalPlayer, type LocalPlayersSnapshot } from '../simulation/LocalPlayers'
import type { SearchView } from '../../shared/search'
import { idlePlayerCommand, type PlayerCommand } from '../../core/simulation/PlayerCommand'
import type { PlayerAppearance } from '../../shared/playerAppearance'
import { SnapshotCodec, type StateFields } from '../../core/simulation/snapshot'
import type { RoomSnapshot } from './RoomRuntime'
import type { BattleSnapshot } from '../simulation/BattleSimulation'
import { readPlayerIntent } from '../simulation/PlayerIntent'
import { touchControls } from '../../browser/display'
import { randomCombat, randomGeneration, withGenerationSeed } from '../../core/simulation/random'
/**
 * 矿洞模块（IGameModule 首个实现）
 *
 * 职责：
 * - 持有整层 BSP 平面图与已访问房间缓存（懒创建、重访保留状态）
 * - 玩家/背包/装备跨房间保持；相机按房间钳制
 * - 踩门触发淡出 → 切房 → 淡入的房间级切换（元气骑士式）
 * - 清场规则/裂隙/敌人投放全部委托 RoomRuntime
 * - 撤离与死亡走 EventBus 通知 UI 弹结算（模块不认识 Vue）
 *
 * 批次 C：槽位背包 + 装备纸娃娃 + 操作快捷栏 + Tab/M 面板冻结 + 相邻房小地图
 *
 * 操作栏位契约（DESIGN_MEMO §4.4）：
 * [武器A=1] [武器B=2] [镐=3] [符卡A=E] [符卡B=R] [道具1=4] [道具2=5] [道具3=6]
 * 武器/镐是装备槽镜像，符卡批次 D 实装，道具 3 槽从背包自由拖配。
 *
 * 撤离与死亡结算后返回基地：安全撤离保留携带物资，
 * 死亡扣除随身素材与本级已有经验的 25%，并向界面提供实际损失清单。
 */
import { Camera } from '../../core/Camera'
import { saveService } from '../../core/save/saveService'
import { canSearchFurnace } from '../../content/story/mainline/furnace/transactions'
import { t, formatKeyBindings } from '../../i18n'
import { playNextStory } from '../story/storyDirector'
import { configureThirdFloor } from './dungeon/thirdFloor'
import { chosenMineFloor } from '../../shared/mineFloors'
import { RELAY_FLAGS, shouldStartMineRelay, recordShallowReturn } from '../../content/story/mainline/mine-relay/state'
import { buildMineRelayPlan, mineRelayRoomSpec } from '../../content/story/mainline/mine-relay/route'
import { buildFourthFloorPlan } from './dungeon/fourthFloor'
import { MineRelayDirector } from './MineRelayDirector'
import type { ActionId } from '../../core/keymap'
import { CaveLight, makeLampLight, type LightSource } from '../art/lighting'
import type { IGameModule, ModuleContext } from '../../core/module'
import type { EngineContext } from '../../core/types'
import type { GameEvents, RunStats, UIPanelKind } from '../gameEvents'
import { ENABLED_SLOTS, slotAccepts, TRINKET_SLOTS } from '../../shared/equipment'
import type { EquipSlot, ItemDef, ItemId } from '../../shared/itemDefs'
import { getItemDef } from '../../shared/itemDefs'
import { itemCarryRules } from '../../shared/itemCarryRules'
import { completeSmeltingRun } from '../../shared/production'
import {
  ORE_COPPER_ID,
  ORE_IRON_ID,
  ORE_GOLD_ID,
  DOOMSDAY_ID
} from '../../content/items/vanilla/ids'
import type { Slot } from '../../shared/inventory'
import { QUICK_ACCEPT_KINDS } from '../../shared/quickSlots'
import { CharacterProfile } from '../../shared/profile'
import { deriveCombat, expNeeded, loseDeathExp, passiveEquipment } from '../../shared/combat'
import { dialogue } from '../dialogue/dialogueService'
import { tutorial } from '../dialogue/tutorial'
import { floorTitle } from '../dialogue/floorTitle'
import { CONFIG } from '../config'
import { renderNausea } from '../art/nauseaScreen'
import { renderHurtScreen } from '../art/hurtScreen'
import { sfx } from '../audio/Sfx'
import { Player } from '../Player'
import { doorDirOf, generateFloorPlan, otherRoom } from './dungeon/bsp'
import type { Dir, FloorPlan, RoomDef } from './dungeon/types'
import { RoomRuntime, type RoomHost, type RoomInput, type RoomParticipant } from './RoomRuntime'
import { FourthFloorDirector } from './FourthFloorDirector'
import { FOURTH_FLAGS } from '../../content/story/mainline/fourth-rescue/state'
import { buildOldHellFloorPlan } from './dungeon/oldHellFloor'
import { layoutRoomDoors,doorArrival,roomDimensions } from './dungeon/roomDoors'
import { STRANGE_GEL_ID } from '../../content/items/vanilla/ids'
import { PrologueDirector, type PrologueHost } from './PrologueDirector'
import { buildProloguePlan } from './prologue/prologueFloor'

type FadePhase = 'none' | 'out' | 'in'

/** 手持切换 action（实际按键在 keymap：1 武器A / 2 武器B / 3 镐） */
const HAND_ACTIONS: ActionId[] = ['hand1', 'hand2', 'hand3']
/** 道具快捷槽使用键：4 / 5 / 6（暂未纳入改键表） */
const QUICK_ACTIONS = ['quick1', 'quick2', 'quick3'] as const
/** 手持序号 → 装备槽（顺序即 DESIGN_MEMO §4.4 契约） */
const HAND_SLOTS = ['weaponA', 'weaponB', 'pick'] as const

/** 切房后玩家落点（门格内侧一格中心 + 朝房内方向） */
const EMPTY_ROOM_INPUT: RoomInput = {
  moveX: 0,
  moveY: 0,
  dodgePressed: false,
  dodgeHeld: false,
  dodgeReleased: false,
  attackPressed: false,
  specialPressed: false,
  specialHeld: false,
  specialReleased: false,
  attackHeld: false,
  attackReleased: false,
  pointerX: 0,
  pointerY: 0,
  interactPressed: false
}

function arrivePoint(room: RoomRuntime, doorId: number): { x: number; y: number; facing: number } {
  // 同墙多门按实际连接定位，不能落到该方向的第一扇门。
  const door = room.doors.find((d) => d.doorId === doorId)!
  return doorArrival(door)
}

/** 大地图/罗盘用的房间只读视图 */
export interface FloorMapView {
  slotCols: number
  slotRows: number
  currentId: number
  rooms: Array<{
    id: number
    sx: number
    sy: number
    kind: string
    depth: number
    current: boolean
    visited: boolean
    cleared: boolean
    enemiesAlive: number
    oresLeft: number
  }>
  doors: Array<{ id: number; a: number; b: number; dirA: Dir; dirB: Dir; open: boolean; aVisited: boolean; bVisited: boolean }>
}

/** 相邻房小地图只读视图（左上 NeighborMap 组件用） */
export interface NeighborView {
  kind: string
  cleared: boolean
  /** 当前房每扇门一条（同方位可能多条，UI 端聚合） */
  neighbors: Array<{
    dir: Dir
    open: boolean
    visited: boolean
    kind: string
    enemies: number
  }>
}

export class CaveModule implements IGameModule, PrologueHost {
  readonly id = 'cave'

  private mctx!: ModuleContext<GameEvents>
  private offRestart: (() => void) | null = null
  private offRequestPanel: (() => void) | null = null
  /** 批次 E：音频手势解锁监听的解绑函数 */
  private offAudioUnlock: (() => void) | null = null

  private miningChestClaimed = false
  claimMiningChest(): boolean {
    if (this.director || this.depth < 3 || this.miningChestClaimed) return false
    this.miningChestClaimed = true
    return true
  }
  private depth = 1
  private plan!: FloorPlan
  private roomSeed = 0
  /** 本层距撤离点的最大 BFS 步数（普通房刷怪权重区间的归一化基准） */
  /** 玩家实体（PrologueHost 接口要求公开；每次新趟重建） */
  player!: Player
  /**
   * 角色三件套（装备/背包/快捷槽）已上移至账号级 CharacterProfile：
   * 跨矿洞房间、跨死亡、跨模块（未来基地）、跨刷新全部保持。
   * 这里保留同名 getter 代理，类内既有 this.inventory 等写法零改动，UI 也照旧访问。
   */
  get inventory() {
    return this.character.inventory
  }
  get foodCooldown(): number { return this.character.food.remaining }
  get foodCooldownDuration(): number { return this.character.food.duration }
  getWeaponSkillCooldown(id:string):number { return this.player?.getWeaponSkillCooldown(id)??0 }
  selectCostume(costume:'default'|'old_miner'):boolean {
    if(costume==='old_miner'&&!this.character.flagBool('unlock.costume.old_miner'))return false
    this.character.costume=costume;this.player.costume=costume;return true
  }
  get equipment() {
    return this.character.equipment
  }
  get quickSlots() {
    return this.character.quickSlots
  }
  /** 当前手持槽序号（0 武器A / 1 武器B / 2 镐），真值在档案里 */
  private get selected(): number {
    return this.character.selected
  }
  private set selected(v: number) {
    this.character.selected = v
  }
  private camera!: Camera
  /** 批次 E：矿洞光照（环境压暗 + 矿工帽暖光圈） */
  private light!: CaveLight
  getSearchView(): SearchView | null { return this.current?.searchView(this.player) ?? null }
  get actionsLocked():boolean{return this.player?.isChanneling??false}
  override get inputBlocked():boolean{return this.locked||this.storyLock||this.fade!=='none'||this.entryReveal>=0||!!this.relay?.blocksInput||!!this.fourth?.blocksInput||!!this.fifth?.blocksInput||dialogue.isActive||tutorial.isModal}
  takeSearchSlot(slot: number): void {
    const view = this.getSearchView()
    if (view) this.mctx.engine.input.queueSearch({ playerId: this.localPlayers.primaryId, containerId: view.id, slot })
  }
  cancelSearch(): void {
    const view = this.getSearchView()
    if (view) this.mctx.engine.input.queueSearch({ playerId: this.localPlayers.primaryId, containerId: view.id, slot: -2 })
  }
  private roomCache = new Map<number, RoomRuntime>()
  private currentId = -1
  private current!: RoomRuntime

  private fade: FadePhase = 'none'
  private fadeT = 0
  private pendingDoor = -1
  private doorCooldown = 0
  /** 结算面板期间冻结一切玩法 */
  private locked = false
  /** Tab/M 面板（打开时冻结玩法；与结算面板互斥） */
  private panel: UIPanelKind | null = null
  private kills = 0
  private extracted = false
  /** 剧情演出锁（梦想封印等 cut-in：世界继续演，但玩家输入冻结；由序章导演置位） */
  storyLock = false
  private survivalIntroPending=false
  /** B2 序章导演（新档首层存在；ENDING 收尾后置 null 进入正常随机下矿） */
  private director: PrologueDirector | null = null
  private relay: MineRelayDirector | null = null
  private fourth: FourthFloorDirector | null = null
  private fifth: FifthFloorDirector | null = null
  /** 剧情黑场当前不透明度（向 director.black 目标指数渐变；S0 醒来/营地用） */
  private blackAlpha = 0
  private entryReveal = -1
  private entryTitlePending = false
  /**
   * 序章显影序列的世界模糊量（px），供 App 直接写 canvas.style.filter：
   * 绝不能用 ctx.filter——那是逐帧 CPU 软件光栅全画布，会卡成 PPT；
   * DOM CSS filter 走合成层/GPU，世界坐标绘制零额外开销。
   */
  get worldBlurPx(): number {
    return this.director?.blurPx ?? (this.entryReveal >= 0 ? 12 * Math.pow(1 - Math.min(1, this.entryReveal / 0.65), 3) : 0)
  }
  /** 快捷栏点击符卡 A 的挂号（实际结算在 update 中执行，需要 engine 震屏） */
  private spellARequested = false
  private spellBRequested = false

  // —— PrologueHost 窄接口（导演只准通过这些面驱动模块） —— //
  get profile(): CharacterProfile {
    return this.character
  }
  get roomId(): number {
    return this.currentId
  }
  get room(): RoomRuntime {
    return this.current
  }
  /** 房间运行时对模块的回调集合（构造时绑定，读写均经档案三件套） */
  private readonly host: RoomHost
  private readonly participantHosts = new Map<string, RoomHost>()
  private activeParticipants:RoomParticipant[]=[]
  private participantEntries=new WeakMap<Player,RoomParticipant>()
  get canAddLocalPlayer():boolean { return !!this.current && !this.director && !this.locked && !dialogue.isActive && !this.fourth?.blocksInput && !this.fifth?.blocksInput && !this.relay?.blocksInput }
  debugAddLocalPlayer(appearance:PlayerAppearance):string {
    if(!this.canAddLocalPlayer)throw new Error(t('ui.local_players.not_ready'))
    const profile=new CharacterProfile();profile.playerAppearance=appearance;profile.setFlag('prologue.done',true)
    const member=this.localPlayers.add(profile);this.localPlayers.ensureEntities(this.current.map,this.player,(x,y,r)=>this.current.canPlacePlayer(x,y,r))
    return member.id
  }
  debugRemoveLocalPlayer(id:string):void {
    if(id===this.localPlayers.primaryId)return
    const member=this.localPlayers.get(id)
    if(member?.entity)this.current.detachPlayer(member.entity)
    this.participantHosts.delete(id);this.localPlayers.remove(id)
    if(this.localPlayers.allDown&&!this.director)this.finishRun('cave:died')
  }
  private participantHost(member:LocalPlayer):RoomHost {
    let host=this.participantHosts.get(member.id)
    if(host)return host
    const gain=(amount:number)=>{
      const multiplier=Math.min(CONFIG.exp.depthCap,1+CONFIG.exp.depthFactor*(this.depth-1))
      if(member.profile.gainExp(Math.round(amount*multiplier))>0){member.entity?.applyGrowth(deriveCombat(member.profile.combat),false);member.entity?.showLevelUp()}
    }
    host={...this.host,inventory:member.profile.inventory,
      searchEffects:()=>searchRewardEffects(member.profile),collectSearchReward:id=>collectSearchReward(member.profile,id),
      onKill:amount=>{this.kills++;gain(amount)},
      onMine:kind=>gain(kind==='ore'?CONFIG.exp.mineOre:CONFIG.exp.mineRock),
      onItemFound:id=>{this.host.onItemFound?.(id);if(id===STRANGE_GEL_ID)member.profile.setFlag('story.strangeGel.found',true)},
      onPlayerDowned:()=>false,
      equipItem:(slot,id)=>{member.profile.equipment.set(slot,id);this.localPlayers.sync(member);return true}}
    this.participantHosts.set(member.id,host);return host
  }
  private participants(input:RoomInput,engine:EngineContext,dt:number,frozen=false):RoomParticipant[] {
    this.localPlayers.bindPrimary(this.player);this.localPlayers.ensureEntities(this.current.map,this.player,(x,y,r)=>this.current.canPlacePlayer(x,y,r))
    const commands=frozen?[]:this.localPlayers.readCommands(engine.input,this.mctx.manager.simulation.tick)
    if(!this.director)for(const player of this.localPlayers.entities)player.beginMineRun(`${this.roomSeed}:${this.character.round}`)
    const result=this.activeParticipants;result.length=0
    let primary=this.participantEntries.get(this.player)
    if(!primary){primary={player:this.player,input,host:this.host};this.participantEntries.set(this.player,primary)}
    primary.input=input;result.push(primary)
    for(const member of this.localPlayers.extras){
      const player=member.entity;if(!player)continue
      const host=this.participantHost(member)
      const command=commands.find(command=>command.playerId===member.id)??idlePlayerCommand(member.id,player.x,player.y,player.facing)
      if(!frozen)this.localPlayers.apply(member,command,engine,this.current,host)
      player.scp127.observe(frozen?0:dt,player,frozen||this.entryReveal>=0)
      player.scp127.noteArena(this.current.def.id,this.current.isCleared)
      let entry=this.participantEntries.get(player)
      if(!entry){entry={player,input:command,host};this.participantEntries.set(player,entry)}
      entry.input=command;entry.host=host;result.push(entry)
    }
    return result
  }

  setStoryLock(v: boolean): void {
    this.storyLock = v
  }

  setHand(i: number): void {
    if(this.player?.isChanneling)return
    this.selected = i
    this.syncMelee()
  }

  syncMeleeNow(): void {
    this.syncMelee()
  }

  /** 黑场演出中静默切房（导演 veil 已全黑，不走淡入淡出） */
  warpToRoom(roomId: number, fromDoorId: number): void {
    this.enterRoom(roomId, fromDoorId)
  }

  /** 序章唯一收尾：补录名册，移交独立基地。符礼改由营地做饭任务交付。 */
  onPrologueFinished(prologue = false): void {
    const c = this.character
    if(prologue)c.setFlag('prologue.campPending',true)
    if (!c.npcs.includes('touhou:reimu')) c.npcs.push('touhou:reimu')
    c.setFlag('story.marisa.lost', true)
    this.storyLock = false
    this.director = null
    this.mctx.manager.switchTo('base', { arrival: true, prologue })
  }

  /**
   * @param character 账号级角色档案（组合根 main.ts 读档/建档后注入；矿洞与基地共享同一实例）
   */
  constructor(private readonly character: CharacterProfile, readonly localPlayers = new LocalPlayers(character)) {
    this.host = {
      inventory: this.character.inventory,
      onItemFound: id => { if (id === STRANGE_GEL_ID) this.character.setFlag('story.strangeGel.found', true) },
      searchEffects:()=>searchRewardEffects(this.character),collectSearchReward:id=>collectSearchReward(this.character,id),
      claimMiningChest: () => this.claimMiningChest(),
      claimGuaranteedMiningChest:()=>{
        if(!this.relay||this.miningChestClaimed)return false
        this.miningChestClaimed=true;return true
      },
      furnaceSearchAllowed:()=>canSearchFurnace(this.character),
      onFurnaceSearch:found=>{playNextStory('cave.furnaceSearch',{profile:this.character,data:{found}})},
      onKill: (exp) => {
        this.kills++
        this.grantCombatExp(exp)
      },
      onMine: (kind) => {
        this.grantCombatExp(kind === 'ore' ? CONFIG.exp.mineOre : CONFIG.exp.mineRock)
        // B2：敲矿节拍转发序章导演（锈镐教学计 2 块岩石触发破门）
        this.director?.notifyMine(kind)
      },
      requestDoor: (doorId) => this.beginTransition(doorId),
      // 序章基地东门（剧情出口）：导演验收后落 flag 并收尾转正式第一层
      requestStoryExit: (ref) => this.director?.onStoryExit(ref),
      requestExtract: () => { if (!this.fourth?.active) this.finishRun('cave:extract') },
      onPlayerDied: () => { if(this.localPlayers.allDown)this.finishRun('cave:died') },
      // B2：教学期倒下由导演接管（不甘独白 + 半血复活）；返回 false 才走死亡结算
      onPlayerDowned: () => this.director?.handlePlayerDowned() ?? false,
      onInteract: (it) => {this.director?.onInteract(it);this.relay?.onInteract(it.ref);this.fourth?.onInteract(it.ref)},
      equipItem: (slot, item) => {
        this.character.equipment.set(slot, item)
        this.syncMelee()
        return true
      }
    }
  }

  /** 经验统一入口：吃深层倍率后加经验，并在升级时通知 UI 弹金色提示 */
  private grantCombatExp(amount: number): void {
    // 序章不接成长系统：prologue.done 在踏入基地东门转正式第一层时才落档，
    // 此前击杀/挖矿一律不给经验、不弹升级提示（等级保持 1 级进正式矿洞）
    if (!this.character.flagBool('prologue.done')) return
    const depthMul = Math.min(CONFIG.exp.depthCap, 1 + CONFIG.exp.depthFactor * (this.depth - 1))
    const leveled = this.character.gainExp(Math.round(amount * depthMul))
    if (leveled > 0) {
      this.player.showLevelUp()
      this.mctx.bus.emit('cave:levelup', {
        level: this.character.combat.level,
        unspentPoints: this.character.combat.unspentPoints
      })
    }
  }

  onEnter(ctx: ModuleContext<GameEvents>, payload?: unknown): void {
    this.mctx = ctx
    this.depth = chosenMineFloor(this.character, (payload as {floor?:number}|undefined)?.floor)
    this.camera = new Camera(ctx.engine.viewW, ctx.engine.viewH, {
      left: 0,
      top: 0,
      right: CONFIG.roomCols * CONFIG.tile,
      bottom: CONFIG.roomRows * CONFIG.tile
    })
    this.light = new CaveLight(ctx.engine.viewW, ctx.engine.viewH)
    this.camera.setFraming(CONFIG.roomCols*CONFIG.tile,CONFIG.roomRows*CONFIG.tile)
    this.offRestart = ctx.bus.on('cave:restart', () => {
      sfx.setCaveMusic(false)
      sfx.setCaveAmbient(false)
      ctx.manager.transitionTo('base', { arrival: true, extracted: this.extracted, fromFloor:this.depth, explorationDeath: !this.extracted && this.character.flagBool('prologue.done') }, !this.extracted&&this.localPlayers.allDown)
    })
    this.offRequestPanel = ctx.bus.on('ui:requestPanel', (kind) => this.setPanel(kind))
    // 批次 E：浏览器要求用户手势后才能出声，首次按键/点击懒初始化音频
    const unlock = (): void => sfx.ensure()
    window.addEventListener('keydown', unlock)
    window.addEventListener('mousedown', unlock)
    this.offAudioUnlock = () => {
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('mousedown', unlock)
    }
    this.startNewRun(this.character.flagBool('prologue.done') ? 'normal' : 'prologue')
  }

  onExit(): void {
    this.current?.cancelSearches()
    for(const room of this.roomCache.values())room.releaseRenderResources()
    sfx.setKedamaMusic(false)
    this.player?.cancelCharge()
    dialogue.cancel()
    sfx.stopFootsteps()
    for(const player of this.localPlayers.entities){this.current?.clearDoomsday(player);player.cancelCharge();player.effects.clear('scene')}
    this.player?.effects.clear('scene')
    this.player?.tarot.clear()
    this.player?.bow.clear()
    this.player?.scp127.clearFlights()
    sfx.setCaveAmbient(false)
    sfx.setCaveMusic(false)
    floorTitle.dismiss()
    tutorial.dismiss()
    this.offRestart?.()
    this.offRequestPanel?.()
    this.offAudioUnlock?.()
    this.offRestart = null
    this.offRequestPanel = null
    this.offAudioUnlock = null
  }

  /** 演出中的回调不是战斗数据；只在可操作边界建立恢复点。 */
  captureInputState():unknown {
    if(this.director||this.relay||dialogue.isActive||this.fourth?.blocksInput||this.fifth?.blocksInput||this.storyLock||this.locked||this.panel==='inventory')throw new Error(t('ui.simulation.not_ready'))
    return {profile:this.character.captureSimulation(),party:this.localPlayers.extras.map(member=>[member.id,member.controller,member.profile.captureSimulation(),member.entity?.x,member.entity?.y,member.entity?.hp,member.entity?.alive]),player:[this.player.x,this.player.y,this.player.hp,this.player.mana,this.player.alive,this.player.debugGod,this.player.activeToolId],room:this.currentId,kills:this.kills,cast:this.spellARequested,castB:this.spellBRequested,phase:this.fourth?.phase,enemies:this.current.snapshotEnemies.map(enemy=>[enemy.entityId,enemy.x,enemy.y,enemy.hp,enemy.alive]),ore:this.current.oreLeft,cleared:this.current.isCleared}
  }
  captureSimulation():unknown {
    if(this.director||this.relay||dialogue.isActive||this.fourth?.blocksInput||this.fifth?.blocksInput||this.storyLock||this.locked||this.panel==='inventory')throw new Error(t('ui.simulation.not_ready'))
    const codec=new SnapshotCodec([this.player])
    this.localPlayers.bindReferences(codec)
    for(const room of this.roomCache.values()){codec.add(room);room.bindSnapshotReferences(codec)}
    const fields:StateFields={}
    const source=this as unknown as Record<string,unknown>
    for(const key of ['roomSeed','depth','currentId','fade','fadeT','pendingDoor','doorCooldown','miningChestClaimed','kills','extracted','survivalIntroPending','blackAlpha','entryReveal','entryTitlePending','spellARequested','spellBRequested'])fields[key]=codec.encode(source[key])
    return {version:1,profile:this.character.captureSimulation(codec),player:this.player.captureSimulation(codec),localPlayers:this.localPlayers.capture(codec),plan:{...structuredClone(this.plan),slots:Array.from(this.plan.slots)},rooms:[...this.roomCache.values()].map(room=>room.captureSimulation(codec)),fields,fourth:this.fourth?.captureSimulation(codec)??null}
  }
  restoreSimulation(raw:unknown):void {
    const state=raw as {version:number;profile:StateFields;player:StateFields;localPlayers?:LocalPlayersSnapshot;plan:FloorPlan;rooms:RoomSnapshot[];fields:StateFields;fourth:StateFields|null}
    if(state.version!==1||!state.rooms?.length)throw new Error(t('ui.simulation.invalid'))
    dialogue.cancel();tutorial.dismiss();floorTitle.dismiss()
    const codec=new SnapshotCodec()
    this.character.restoreSimulation(state.profile,codec)
    setPlayerAppearance(this.character.playerAppearance)
    if(!this.player)this.player=new Player(0,0)
    ;(this.player as {entityId:string}).entityId=String(state.player.entityId);codec.add(this.player)
    this.localPlayers.bindPrimary(this.player);this.localPlayers.prepareRestore(state.localPlayers,codec);this.participantHosts.clear()
    this.director=null;this.relay=null;this.fifth=null;this.storyLock=false;this.locked=false;this.panel=null
    this.plan={...structuredClone(state.plan),slots:Int16Array.from(state.plan.slots)}
    for(const room of this.roomCache.values())room.releaseRenderResources()
    this.roomCache.clear()
    for(const slice of state.rooms){
      const room=new RoomRuntime(slice.definition,this.player.x,this.player.y,slice.script??undefined)
      room.restoreSimulation(slice,codec);codec.add(room);this.roomCache.set(room.def.id,room)
    }
    this.spellBRequested=false
    codec.restore(this,state.fields)
    const room=this.roomCache.get(this.currentId)
    if(!room)throw new Error(t('ui.simulation.invalid'))
    this.current=room
    this.player.ammoInventory=this.character.inventory;this.player.scp127.bind(this.character)
    this.player.restoreSimulation(state.player,codec,room.map)
    this.localPlayers.finishRestore(state.localPlayers,codec,room.map)
    room.rememberPlayers(this.localPlayers.entities)
    this.fourth=state.fourth?new FourthFloorDirector(this.character,()=>this.mctx.manager.transitionTo('base',{arrival:true,extracted:true,fromFloor:4,rumiaArrival:true})):null
    if(this.fourth){
      const active=state.rooms.find(slice=>slice.definition.landmark==='kedama_arena')
      if(active)this.fourth.onRoomEnter(this.roomCache.get(active.definition.id)!,true,true)
      this.fourth.restoreSimulation(state.fourth!,codec)
    }
    this.camera.setBounds({left:0,top:0,right:room.map.cols*room.map.tile,bottom:room.map.rows*room.map.tile});this.camera.snapTo(this.player)
    this.mctx.bus.emit('ui:panel',null)
    sfx.setKedamaMusic(!!this.fourth?.active);if(!this.fourth?.active)sfx.setCaveMusic(true,this.depth===5?'old_hell':'cave')
  }
  /** 当前房间可导出给不依赖 Canvas 的正式战斗驱动。 */
  captureBattleSimulation():BattleSnapshot {
    const codec=new SnapshotCodec([this.player]);this.current.bindSnapshotReferences(codec)
    this.localPlayers.bindReferences(codec)
    return {version:1,profile:this.character.captureSimulation(codec),player:this.player.captureSimulation(codec),localPlayers:this.localPlayers.capture(codec),room:this.current.captureSimulation(codec),hitStop:this.mctx.engine.captureTiming?.().hitStop??0,kills:this.kills,miningChestClaimed:this.miningChestClaimed,terminal:this.locked}
  }

  /**
   * 生成全新一层（背包/装备/等级全部保留；每次调用＝新一趟下矿）
   * @param mode prologue＝新档序章固定脚本楼层（无饭团/无随机）；normal＝正常随机下矿
   */
  private startNewRun(mode: 'normal' | 'prologue'): void {
    floorTitle.dismiss()
    this.roomSeed = Math.floor(randomGeneration()*4294967296)
    this.director = null
    this.fifth = mode === 'normal' && this.depth === 5 && !this.character.flagBool(FIFTH_FLAGS.introSeen) ? new FifthFloorDirector(this.character) : null
    this.relay = mode==='normal'&&shouldStartMineRelay(this.character,this.depth)
      ? new MineRelayDirector(this.character,()=>this.finishRun('cave:extract')) : null
    this.fourth = mode === 'normal' && this.depth === 4 && !this.character.flagBool(FOURTH_FLAGS.rescued) ? new FourthFloorDirector(this.character, () => {
      completeSmeltingRun(this.character); this.character.deepestDepth = Math.max(4, this.character.deepestDepth)
      this.mctx.manager.transitionTo('base', { arrival: true, extracted: true, fromFloor: 4, rumiaArrival: true })
    }) : null
    this.entryReveal = mode === 'normal' ? 0 : -1
    this.entryTitlePending = mode === 'normal'
    this.blackAlpha = 1
    // 模块在祈祷卡遮挡期间就会初始化，此处不能提前播放。
    sfx.setCaveMusic(false)
    if (mode === 'prologue') {
      this.plan = buildProloguePlan()
    } else if(this.relay){
      this.plan=buildMineRelayPlan()
    } else if(this.depth===4){
      this.plan=buildFourthFloorPlan()
    } else if(this.depth===5){
      this.plan=buildOldHellFloorPlan(!!this.fifth)
    } else {
      this.plan = generateFloorPlan()
      for (const room of this.plan.rooms) room.floor = this.depth
      if(this.depth===3)configureThirdFloor(this.plan)
    }
    for(const room of this.roomCache.values())room.releaseRenderResources()
    this.roomCache.clear()
    this.miningChestClaimed = false
    this.kills = 0
    this.extracted = false
    this.locked = false
    this.storyLock = false
    this.setPanelSilent(null)
    this.spellARequested=false;this.spellBRequested=false
    this.fade = 'none'
    this.fadeT = 0
    this.pendingDoor = -1
    this.doorCooldown = 0
    this.player = new Player((CONFIG.roomCols * CONFIG.tile) / 2, (CONFIG.roomRows * CONFIG.tile) / 2)
    // 注入角色成长派生（属性点全 0 时＝旧写死数值；开局满血满灵力）
    this.player.applyGrowth(deriveCombat(this.character.combat))
    this.syncMelee()


    // 普通下矿才计一趟，序章和返回基地均不增加回合。
    this.character.location.scene = 'cave'
    if (mode === 'normal') this.character.round += 1

    // 导演必须先于首房创建（建房需取脚本规格），start 在进房后调用（避免 onRoomEnter 抢跑）
    if (mode === 'prologue') this.director = new PrologueDirector(this)
    this.enterRoom(this.plan.startId, -1)
    if(mode==='normal'){
      const enteredKey=`mine.floor.${this.depth}.entered`
      if(!this.relay&&!this.character.flagBool(enteredKey)){
        this.character.setFlag(enteredKey,true)
        // 只保存探索认知，不覆盖死亡后仍需保留的下矿前检查点。
        void saveService.persistStoryFlag(enteredKey)
      }
    }
    if (mode === 'prologue') {
      this.director?.start()
      // S0 开场必须纯黑入场（避免首帧亮房一闪再淡黑）
      this.blackAlpha = 1
    }
  }

  /** 进入（并按需懒创建）一个房间，重定位玩家与相机 */
  private enterRoom(roomId: number, fromDoorId: number): void {
    this.current?.cancelSearches()
    const def = this.plan.rooms.find((r) => r.id === roomId)!
    let room = this.roomCache.get(roomId)
    if (!room) {
      const size=roomDimensions(def)
      let sx = (size.cols * CONFIG.tile) / 2
      let sy = (size.rows * CONFIG.tile) / 2
      const entrance = def.terrain?.storyEntrance
      if (fromDoorId < 0 && entrance) {
        // 刷怪出生保护围绕通道出口，避免演出结束立即贴脸接敌。
        sx = (entrance.exitCol + .5) * CONFIG.tile
        sy = (entrance.exitRow + .5) * CONFIG.tile
      }
      if (fromDoorId >= 0) {
        // 落点本身就是合法地面，同时用作刷怪/矿脉的出生留空中心
        const p = this.previewArrive(def, fromDoorId)
        sx = p.x
        sy = p.y
      }
      room = withGenerationSeed(this.roomSeed^Math.imul(roomId+1,0x9e3779b9),()=>new RoomRuntime(def, sx, sy, this.director?.specForRoom(roomId)??(this.relay?mineRelayRoomSpec:def.landmark==='kedama_arena'&&this.fourth?this.fourth.specForArena():undefined)))
      this.roomCache.set(roomId, room)
    }

    this.current?.clearDoomsday(this.player)
    for(const member of this.localPlayers.entities){member.meleeEchoes.length=0;member.areaBurst=null}
    if (this.player.rangedFlight && !this.player.rangedFlight.returning) {
      this.player.rangedFlight.returning = true
      this.player.rangedFlight.hits.clear()
    }
    this.player.tarot.clear()
    this.player.bow.clear()
    this.player.scp127.clearFlights()
    room.clearDoomsday(this.player)
    this.current = room
    this.currentId = roomId

    if (fromDoorId >= 0) {
      const p = arrivePoint(room, fromDoorId)
      this.player.x = p.x
      this.player.y = p.y
      this.player.facing = p.facing
    } else {
      const entrance = def.terrain?.storyEntrance
      this.player.x = entrance ? (entrance.spawnCol + .5) * room.map.tile : (room.map.cols * room.map.tile) / 2
      this.player.y = entrance ? (entrance.spawnRow + .5) * room.map.tile : (room.map.rows * room.map.tile) / 2
    }
    this.player.vx = 0
    this.player.vy = 0

    if(fromDoorId<0)this.localPlayers.beginScene(this.player,room.map,(x,y,r)=>room.canPlacePlayer(x,y,r))
    else {this.localPlayers.bindPrimary(this.player);this.localPlayers.placeExtras(room.map,this.player,(x,y,r)=>room.canPlacePlayer(x,y,r))}
    room.rememberPlayers(this.localPlayers.entities)

    room.onPlayerEnter()
    this.survivalIntroPending=def.encounter==='survival'&&!this.character.flagBool('story.monsterRoom.seen')

    this.camera.setBounds({
      left: 0,
      top: 0,
      right: room.map.cols * room.map.tile,
      bottom: room.map.rows * room.map.tile
    })
    this.camera.snapTo({ x: this.player.x, y: this.player.y })
    this.doorCooldown = CONFIG.dungeon.doorTriggerCooldown
    // B2：序章导演房号钩子（首次进入各房才触发剧情；重访不重播）
    this.director?.onRoomEnter(roomId)
    this.relay?.onRoomEnter(roomId,room)
    this.fourth?.onRoomEnter(room, def.landmark === 'kedama_arena')
  }

  /**
   * 构造前预估落点（RoomRuntime 生成敌人/矿脉时需要出生留空中心）。
   * 与运行时共用同一份门口和落点查询，避免异形岩岸产生两套位置算法。
   */
  private previewArrive(def: RoomDef, doorId: number): { x: number; y: number } {
    return doorArrival(layoutRoomDoors(def).find(door=>door.doorId===doorId)!)
  }

  private beginTransition(doorId: number): void {
    if (this.panel === 'inventory') {
      this.mctx.bus.emit('ui:inventoryReturn', undefined)
      this.setPanel(null)
    }
    if (this.fade !== 'none' || this.locked || this.panel !== null || this.doorCooldown > 0) return
    this.current.cancelSearches()
    for(const player of this.localPlayers.entities)player.cancelCharge()
    this.fade = 'out'
    this.fadeT = 0
    this.pendingDoor = doorId
  }

  /** 撤离/死亡 → 冻结并通知 UI；死亡损失随实际扣除一起记录。 */
  private finishRun(kind: 'cave:extract' | 'cave:died'): void {
    if (this.locked || this.fifth?.blocksInput) return
    this.mctx.bus.emit('ui:inventoryReturn', undefined)
    this.locked = true
    this.extracted = kind === 'cave:extract'
    for(const member of this.localPlayers.all)settleSearchRewards(member.profile,this.extracted)
    if(this.extracted&&!this.director)completeSmeltingRun(this.character)
    if(this.extracted&&this.depth===2)this.character.setFlag('story.secondFloor.returned',true)
    if(this.extracted){
      recordShallowReturn(this.character,this.depth)
      if(this.relay?.completed)this.character.setFlag(RELAY_FLAGS.returned,true)
    }
    const lostItems = new Map<ItemId, number>()
    let lostExp = 0
    // 死亡按物品规则丢失随身素材，扣除本级已有经验的 25%；装备、等级与仓库不受影响。
    if (!this.extracted) {
      lostExp = loseDeathExp(this.character.combat)
      for (const inv of [this.inventory, this.quickSlots, this.character.trash]) {
        for (let i = 0; i < inv.slots.length; i++) {
          const stack = inv.slots[i]
          if (stack && itemCarryRules(stack.id).loseOnDeath) {
            // 清空槽位前记录实扣数量，同种物品跨背包与快捷栏合并展示。
            lostItems.set(stack.id, (lostItems.get(stack.id) ?? 0) + stack.qty)
            inv.slots[i] = null
          }
        }
      }
    }
    for(const member of this.localPlayers.extras){
      const profile=member.profile
      if(this.extracted){completeSmeltingRun(profile);profile.deepestDepth=Math.max(profile.deepestDepth,this.depth)}
      else {
        loseDeathExp(profile.combat)
        for(const inventory of [profile.inventory,profile.quickSlots,profile.trash]){
          for(let index=0;index<inventory.slots.length;index++){
            const stack=inventory.slots[index]
            if(stack&&itemCarryRules(stack.id).loseOnDeath)inventory.slots[index]=null
          }
        }
      }
    }
    let cleared = 0
    for (const room of this.roomCache.values()) if (room.isCleared) cleared++
    if(!this.relay)this.character.deepestDepth = Math.max(this.character.deepestDepth, this.depth)
    const stats: RunStats = {
      depth: this.depth,
      roomsCleared: cleared,
      roomsTotal: this.plan.rooms.length,
      kills: this.kills,
      losses: {
        items: Array.from(lostItems, ([id, qty]) => ({ id, qty })),
        exp: lostExp
      },
      bag: {
        copper: this.inventory.count(ORE_COPPER_ID),
        iron: this.inventory.count(ORE_IRON_ID),
        gold: this.inventory.count(ORE_GOLD_ID)
      }
    }
    this.mctx.bus.emit(kind, stats)
  }

  // —— 面板（Tab 背包 / M 大地图），模块为状态唯一真值，UI 经 bus 同步 ——

  private setPanelSilent(kind: UIPanelKind | null): void {
    this.panel = kind
  }

  /** 提示展示或提前打开地图后即记为已看，只保存标记，不覆盖下矿前的检查点。 */
  private markMapTutorialSeen(): void {
    if (this.character.flagBool('tutorial.map.seen')) return
    this.character.setFlag('tutorial.map.seen', true)
    void saveService.persistStoryFlag('tutorial.map.seen')
  }

  private setPanel(kind: UIPanelKind | null): void {
    if (this.locked) return
    if (kind && (this.fourth?.blocksInput || this.fifth?.blocksInput)) return
    if (kind) this.current.cancelSearch(this.player)
    if (kind) for(const player of this.localPlayers.entities)player.cancelCharge()
    this.panel = kind
    this.director?.onPanelChanged(kind)
    if (kind === 'map' && !this.director) {
      this.markMapTutorialSeen()
      if (tutorial.current.value?.key === 'story.tut.map') tutorial.dismiss()
    }
    this.mctx.bus.emit('ui:panel', kind)
  }

  /** 当前手持槽 → 玩家招式同步（切换 1/2/3、换装后调用；空槽=空手） */
  private syncMelee(): void {
    if (!this.player) return
    this.player.ammoInventory=this.inventory
    this.player.bindEquipment(this.equipment)
    this.player.scp127.bind(this.character)
    this.player.equipmentCombat = passiveEquipment(this.equipment)
    const id = this.equipment.get(HAND_SLOTS[this.selected])
    this.player.setMelee(id ? getItemDef(id).melee ?? null : null, id)
  }

  // —— 供 UI（Vue）直接调用的动作 ——

  /** 当前打开的面板（UI 轮询/判断用） */
  get currentPanel(): UIPanelKind | null {
    return this.panel
  }

  /** 当前手持序号（0 武器A / 1 武器B / 2 镐） */
  get selectedHand(): number {
    return this.selected
  }

  /** 切换手持（键 1/2/3；面板打开时也允许顺手切） */
  selectHand(index: number): void {
    if (this.player.isChanneling) return
    if (index < 0 || index >= HAND_SLOTS.length || index === this.selected) return
    this.selected = index
    this.syncMelee()
  }

  /** 大地图只读视图 */
  getFloorMapView(): FloorMapView {
    const doorOpen = (id: number, a: number, b: number): boolean => {
      const ra = this.roomCache.get(a)
      const rb = this.roomCache.get(b)
      const aOpen = ra?.doors.find((d) => d.doorId === id)?.open ?? false
      const bOpen = rb?.doors.find((d) => d.doorId === id)?.open ?? false
      // 已探索的连接必须两端都解封，避免把邻室的旧状态当作可通行路线。
      return ra && rb ? aOpen && bOpen : aOpen || bOpen
    }
    return {
      slotCols: this.plan.slotCols,
      slotRows: this.plan.slotRows,
      currentId: this.currentId,
      rooms: this.plan.rooms.map((r) => ({
        id: r.id,
        sx: r.sx,
        sy: r.sy,
        kind: r.encounter==='survival'?'survival':r.kind,
        depth: r.depth,
        current: r.id === this.currentId,
        visited: this.roomCache.has(r.id),
        cleared: this.roomCache.get(r.id)?.isCleared ?? false,
        enemiesAlive: this.roomCache.get(r.id)?.aliveCount ?? 0,
        oresLeft: this.roomCache.get(r.id)?.oreLeft ?? 0
      })),
      doors: this.plan.doors.map((d) => ({
        id: d.id,
        a: d.a,
        b: d.b,
        dirA: d.dirA,
        dirB: d.dirB,
        open: doorOpen(d.id, d.a, d.b),
        // 战争迷雾：门线只在至少一端被探索过才显示
        aVisited: this.roomCache.has(d.a),
        bVisited: this.roomCache.has(d.b)
      }))
    }
  }

  /** 相邻房小地图视图：中心当前房 + 每扇门对端房间的状态 */
  getNeighborView(): NeighborView {
    // Vue 首帧渲染可能早于本模块 onEnter 建层（current 尚未出生），
    // 查询契约保证任意时机调用都返回合法形状：未进房=无邻接的空视图
    if (!this.current) {
      return { kind: 'start', cleared: false, neighbors: [] }
    }
    return {
      kind: this.current.def.encounter==='survival'?'survival':this.current.def.kind,
      cleared: this.current.isCleared,
      neighbors: this.current.doors.map((d) => {
        const tid = otherRoom(this.plan, d.doorId, this.currentId)
        const target = this.roomCache.get(tid)
        const def = this.plan.rooms.find((r) => r.id === tid)!
        return {
          dir: d.dir,
          open: d.open,
          visited: !!target,
          kind: def.encounter==='survival'?'survival':def.kind,
          enemies: target?.aliveCount ?? 0
        }
      })
    }
  }

  /** 对话/事件系统的治疗入口（返回实际回复量；死亡/满血为 0） */
  healPlayer(amount: number): number {
    if (!this.player || !this.player.alive) return 0
    const real = this.player.heal(amount)
    if (real > 0 && this.current) this.current.flashHeal(this.player.x, this.player.y, real)
    return real
  }
  /** 背包、快捷栏和共享物品卡统一处理食用附加状态。 */
  consumeItem(id: string): boolean {
    if (this.locked || !this.player?.alive) return false
    const beforeHp = this.player.hp
    if (!this.player.consumeItem(id)) return false
    const realHeal = this.player.hp - beforeHp
    if (realHeal > 0) this.current?.flashHeal(this.player.x, this.player.y, realHeal)
    return true
  }

  // —— 开发调试控制台入口（DevConsole.vue 专用；发布时可整体摘除，不接触存档契约） ——

  /** 设置调试无敌（App 按全局开关同步；新一趟下矿重建 Player 后会被重新同步） */
  debugSetGod(v: boolean): void {
    if (this.player) this.player.debugGod = v
  }

  /** 生命/灵力全部回满（死亡中无效） */
  debugRefill(): boolean {
    if (!this.player?.alive) return false
    this.player.hp = this.player.maxHp
    this.player.mana = this.player.maxMana
    return true
  }

  /** 秒杀当前房间全部存活敌人，返回击杀数 */
  debugKillRoom(): number {
    if (!this.current || this.locked) return 0
    return this.current.debugKillAll(this.host)
  }

  /** 调试专用：在玩家面前生成一只 100000 血史莱姆靶子 */
  debugSpawnDummy(): boolean {
    if (!this.current || !this.player.alive) return false
    const p = this.player
    const dist = 72
    let x = p.x + Math.cos(p.facing) * dist
    let y = p.y + Math.sin(p.facing) * dist
    // 面前落在实心格时，沿两侧扇形逐步找可通行落点
    if (this.current.map.solidAtWorld(x, y)) {
      let found = false
      for (let i = 1; i <= 12; i++) {
        const a = p.facing + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.3
        const cx = p.x + Math.cos(a) * dist
        const cy = p.y + Math.sin(a) * dist
        if (!this.current.map.solidAtWorld(cx, cy)) {
          x = cx
          y = cy
          found = true
          break
        }
      }
      // 极端死角兜底：贴脸生成，碰撞分离会把它推出墙
      if (!found) {
        x = p.x + Math.cos(p.facing) * 28
        y = p.y + Math.sin(p.facing) * 28
      }
    }
    this.current.debugSpawnDummy(x, y)
    return true
  }

  /** 直接获得开发者神器并放入武器 B 槽。 */
  debugGiveDoomsday(): boolean {
    const old = this.character.equipment.get('weaponB')
    if (old !== DOOMSDAY_ID) {
      if (old && this.character.inventory.add(old, 1) !== 1) return false
      this.character.equipment.set('weaponB', DOOMSDAY_ID)
    }
    this.selected = 1
    this.syncMelee()
    return true
  }

  /** 调试用持有判定：武器 B 槽或背包里存在魔王剑（控制台切换按钮读它） */
  get debugHasDoomsday(): boolean {
    if (this.character.equipment.get('weaponB') === DOOMSDAY_ID) return true
    return this.inventory.slots.some(s => s?.id === DOOMSDAY_ID)
  }

  /** 调试专用：归还破灭魔王剑——装备槽与背包内全部抹除（不掉地面），并清掉杀戮状态与房间附着 */
  debugReturnDoomsday(): boolean {
    let owned = false
    if (this.character.equipment.get('weaponB') === DOOMSDAY_ID) {
      this.character.equipment.set('weaponB', null)
      owned = true
      if (this.selected === 1) this.selected = 0
    }
    // 背包里若有（理论上仅一把）一并清干净
    for (let i = 0; i < this.inventory.slots.length; i++) {
      if (this.inventory.slots[i]?.id === DOOMSDAY_ID) { this.inventory.removeAt(i); owned = true }
    }
    if (!owned) return false
    // 此刻 activeToolId 仍记录着魔王剑，clearDoomsday 会据此取消杀戮并清空光束/附着
    this.current?.clearDoomsday(this.player)
    this.syncMelee()
    return true
  }

  /** 当前是否允许调试撤离（结算未锁、非序章流程） */
  get debugCanExtract(): boolean {
    return !this.locked && this.director === null && !this.fourth?.active && !this.fifth?.blocksInput
  }

  /** 立即按正常撤离结算本局（弹撤离面板，矿石与成长全部保留） */
  debugExtract(): boolean {
    if (!this.debugCanExtract) return false
    this.finishRun('cave:extract')
    return true
  }

  /** 使用背包指定格的消耗品（面板双击用；满血不浪费） */
  consumeSlot(index: number): boolean {
    if (this.locked || !this.player.alive) return false
    const slot = this.inventory.slots[index]
    if (!slot) return false
    if (!this.consumeItem(slot.id)) return false
    this.inventory.removeAt(index, 1)
    return true
  }

  /** 使用道具快捷槽（键 4/5/6 或单击快捷栏；非消耗品/满血无效果） */
  useQuickItem(qIndex: number): boolean {
    if (this.locked || !this.player.alive) return false
    const slot = this.quickSlots.get(qIndex)
    if (!slot) return false
    if (!this.consumeItem(slot.id)) return false
    this.quickSlots.consumeOne(qIndex)
    return true
  }

  /** 快捷栏点击符卡 A（Vue 调用）：挂个号，实际释放在本帧 update 内带 engine 结算 */
  requestCastSpellA(): void {
    this.spellARequested = true
  }
  requestCastSpellB(): void {
    this.spellBRequested = true
  }

  /** 读取指定符卡槽，经灵力/CD 门控后交给房间结算。 */
  private tryCastSpell(engine: EngineContext,slot:'spellA'|'spellB'): void {
    if (this.locked || !this.player.alive) return
    const id = this.equipment.get(slot)
    const def = id ? getItemDef(id).spell : null
    if (!def) return
    if (this.player.castSpell(def)) {
      // 带物品 id：符卡飘字等语言词条按 item.<id>.* 查
      this.current.resolveSpell(this.player, id!, def, engine, this.host)
    }
  }

  /**
   * 两格拖放结算（格可位于背包/道具槽不同容器）：
   * 同类尽量合并到目标堆，合不下或异类则整堆交换。纯函数，由调用方写回容器。
   */
  private mergeOrSwap(src: NonNullable<Slot>, dst: Slot, cap = getItemDef(src.id).maxStack): { src: Slot; dst: Slot } {
    if (dst && dst.id === src.id) {
      const put = Math.min(cap - dst.qty, src.qty)
      if (put > 0) {
        const left = src.qty - put
        return { src: left > 0 ? { ...src, qty: left } : null, dst: { ...dst, qty: dst.qty + put } }
      }
    }
    return { src: dst, dst: src }
  }

  /** 背包格 → 道具快捷槽（武器/镐/符卡类型不合法直接拒绝） */
  invToQuick(invIndex: number, qIndex: number): boolean {
    const src = this.inventory.slots[invIndex]
    if (!src || !QUICK_ACCEPT_KINDS.has(getItemDef(src.id).kind)) return false
    const r = this.mergeOrSwap(src, this.quickSlots.get(qIndex))
    if (r.src && r.src.qty > this.inventory.stackLimit(r.src.id)) return false
    this.inventory.slots[invIndex] = r.src
    this.quickSlots.set(qIndex, r.dst)
    return true
  }

  /** 道具快捷槽 → 背包格 */
  quickToInv(qIndex: number, invIndex: number): void {
    const src = this.quickSlots.get(qIndex)
    if (!src) return
    const cap = this.inventory.stackLimit(src.id), dst = this.inventory.slots[invIndex]
    if (!dst) {
      const put = this.inventory.depositAt(invIndex, src, src.qty)
      this.quickSlots.set(qIndex, src.qty > put ? { ...src, qty: src.qty - put } : null)
      return
    }
    if (dst.id !== src.id && src.qty > cap) return
    const r = this.mergeOrSwap(src, dst, cap)
    this.quickSlots.set(qIndex, r.src)
    this.inventory.slots[invIndex] = r.dst
  }

  /** 道具快捷槽之间互拖（同类合并/异类交换） */
  quickMove(from: number, to: number): void {
    const src = this.quickSlots.get(from)
    if (!src || from === to) return
    const r = this.mergeOrSwap(src, this.quickSlots.get(to))
    this.quickSlots.set(from, r.src)
    this.quickSlots.set(to, r.dst)
  }

  /** 道具快捷槽整堆丢出，沿用光标持有的逐个结算，保留实际数量。 */
  quickDrop(qIndex: number): void {
    const slot = this.quickSlots.get(qIndex)
    if (!slot || !this.dropHeld(slot)) return
    this.quickSlots.set(qIndex, null)
  }

  /** 光标拿放装备后同步招式；镐只能替换，不能卸空。 */
  setEquipment(slot: EquipSlot, id: ItemId | null): boolean {
    if (this.actionsLocked) return false
    if (!ENABLED_SLOTS.has(slot) || slot === 'pick' && !id || id && !slotAccepts(slot, id)) return false
    this.equipment.set(slot, id)
    this.syncMelee()
    return true
  }

  /** 物品卡自动穿戴：武器优先进空槽，其余按物品自带槽归位。 */
  equipFromSlot(index: number): boolean {
    const slot = this.inventory.slots[index]
    if (!slot) return false
    const def = getItemDef(slot.id)
    const target = this.preferredEquipSlot(def)
    if (!target || !ENABLED_SLOTS.has(target)) return false
    return this.equipFromSlotTo(index, target)
  }

  /** 武器/符卡这类同型多栏物品的默认归位槽 */
  private preferredEquipSlot(def: ItemDef): EquipSlot | null {
    if (def.kind === 'weapon') {
      return this.equipment.get('weaponA') === null
        ? 'weaponA'
        : this.equipment.get('weaponB') === null
          ? 'weaponB'
          : 'weaponA' // 两槽都占着：挤进 A，旧武器回背包格
    }
    if (def.kind === 'spellcard') return !this.equipment.get('spellA')?'spellA':!this.equipment.get('spellB')?'spellB':'spellA'
    // 饰品类（物品声明虚拟槽 'trinket'）：自动进第一个空着的饰品槽，全满则挤 A
    if (def.equipSlot === 'trinket') {
      return TRINKET_SLOTS.find((s) => this.equipment.get(s) === null) ?? 'trinketA'
    }
    return def.equipSlot ?? null
  }

  /** 背包格 → 穿到指定装备槽（槽位类型门控；旧装备回格） */
  equipFromSlotTo(index: number, targetSlot: EquipSlot): boolean {
    if (this.actionsLocked) return false
    const invSlot = this.inventory.slots[index]
    if (!invSlot) return false
    if (!ENABLED_SLOTS.has(targetSlot) || !slotAccepts(targetSlot, invSlot.id)) return false
    const old = this.equipment.setStack(targetSlot, invSlot)
    this.inventory.removeAt(index)
    if (old) this.inventory.slots[index]=old
    this.syncMelee()
    return true
  }

  /** 装备槽 → 放回背包空格（镐槽必须始终有镐，不允许卸空） */
  unequip(slot: EquipSlot): boolean {
    if (this.actionsLocked) return false
    if (!ENABLED_SLOTS.has(slot) || slot === 'pick') return false
    const stack = this.equipment.getStack(slot)
    if (!stack) return false
    const empty = this.inventory.firstEmpty()
    if (empty < 0) return false
    this.equipment.set(slot, null)
    this.inventory.slots[empty]=stack
    this.syncMelee()
    return true
  }

  /** 拖拽装备槽 → 指定背包格（仅空格接受；镐槽同样禁卸） */
  unequipTo(slot: EquipSlot, index: number): boolean {
    if (this.actionsLocked) return false
    if (!ENABLED_SLOTS.has(slot) || slot === 'pick') return false
    const stack = this.equipment.getStack(slot)
    if (!stack || this.inventory.slots[index]) return false
    this.equipment.set(slot, null)
    this.inventory.slots[index]=stack
    this.syncMelee()
    return true
  }

  /** 背包格丢出世界（在玩家身边生成地面掉落物） */
  dropFromSlot(index: number): void {
    const stack=this.inventory.slots[index];if(!stack)return
    const id = this.inventory.removeAt(index)
    if (!id) return
    const a = randomCombat() * Math.PI * 2
    const d = 30 + randomCombat() * 14
    this.current.spawnGroundDrop(id, this.player.x + Math.cos(a) * d, this.player.y + Math.sin(a) * d,stack.durability)
  }

  /** 光标拆堆栈丢到脚下：持有几个就生成几个地面掉落物（在玩家身边散开） */
  dropHeld(stack: NonNullable<Slot>): boolean {
    if (this.locked || !this.player.alive) return false
    for (let n = 0; n < stack.qty; n++) {
      const a = randomCombat() * Math.PI * 2
      const d = 26 + randomCombat() * 22
      this.current.spawnGroundDrop(stack.id, this.player.x + Math.cos(a) * d, this.player.y + Math.sin(a) * d,stack.durability)
    }
    return true
  }

  handleUIInput(engine: EngineContext): void {
    const { input } = engine
    if (input.suppressed || this.locked || this.relay?.blocksInput || this.fourth?.blocksInput || this.fifth?.blocksInput || dialogue.isActive) return
    if (input.actionPressed('panel')) this.setPanel(this.panel === 'inventory' ? null : 'inventory')
    if (input.actionPressed('map')) this.setPanel(this.panel === 'map' ? null : 'map')
    if (input.actionPressed('pause')) {
      if (this.panel === null && this.getSearchView()) this.cancelSearch()
      else this.setPanel(this.panel === null ? 'pause' : null)
    }
    if (input.justPressed('KeyN')) sfx.toggleMute()
    if (this.panel !== null && this.panel !== 'pause') {
      for (const a of HAND_ACTIONS) if (input.actionPressed(a)) this.selectHand(HAND_ACTIONS.indexOf(a))
    }
  }
  updatePaused(engine: EngineContext): void {
    this.camera.resize(engine.viewW, engine.viewH)
    this.light.resize(engine.viewW, engine.viewH)
  }
  update(dt: number, engine: EngineContext): void {
    this.player.scp127.observe(dt, this.player, dialogue.isActive || this.storyLock || this.panel !== null && this.panel !== 'inventory' || engine.input.suppressed || !!this.fourth?.blocksInput || !!this.fifth?.blocksInput || !!this.relay?.blocksInput || this.entryReveal >= 0)
    this.player.scp127.noteArena(this.current.def.id, this.current.isCleared)
    if (dialogue.isActive || this.storyLock || engine.input.suppressed) this.player.cancelCharge()
    sfx.setCaveAmbient(true)
    const { input } = engine
    this.camera.resize(engine.viewW, engine.viewH)
    // 批次 E：光贴图遮罩跟随画布尺寸
    this.light.resize(engine.viewW, engine.viewH)

    // 鼠标世界坐标（瞄准）
    const rawWorld = this.camera.screenToWorld(input.mouseX, input.mouseY)
    const world = input.resolveWorldPointer(rawWorld.x,rawWorld.y,this.player)
    input.worldMouseX = world.x
    input.worldMouseY = world.y

    this.doorCooldown = Math.max(0, this.doorCooldown - dt)

    // 命中顿帧：本帧世界 dt（敌人/弹幕/特效冻结），玩家时钟仍用真实 dt
    const wdt = engine.worldDt(dt)

    // 剧情黑场渐变（目标＝导演 veil：S0 显影是连续缓动值，营地为 1；切房期间也推进）
    if (this.entryReveal >= 0) {
      // 普通入矿从首次可操作更新开始显影，祈祷卡停留期间不提前消耗标题。
      if (this.entryTitlePending) {
        this.entryTitlePending = false
        if(!this.fourth?.active&&!this.fifth?.blocksInput)sfx.setCaveMusic(true,this.depth===5?'old_hell':'cave')
        if(!this.fifth?.blocksInput)floorTitle.show(this.relay?'story.mineRelay.route_title':this.depth===5?'floor.title.cave_fifth':this.depth===4?'floor.title.cave_fourth':this.depth===3?'floor.title.cave_third':this.depth===2?'floor.title.cave_second':'floor.title.cave_first', undefined, { holdMs: 850 })
        if (!this.fifth?.blocksInput && !this.character.flagBool('tutorial.map.seen')) {
          tutorial.show('story.tut.map', { durationMs: 99999999 })
          this.markMapTutorialSeen()
        }
      }
      this.entryReveal += dt
      this.blackAlpha = Math.pow(1 - Math.min(1, this.entryReveal / 0.85), 3)
      if (this.entryReveal >= 0.85) this.entryReveal = -1
    } else {
      const blackTarget = this.director?.veil ?? 0
      this.blackAlpha += (blackTarget - this.blackAlpha) * (1 - Math.exp(-dt * 4.2))
      if (!blackTarget && this.blackAlpha < 0.004) this.blackAlpha = 0
    }

    // —— 切房过渡：淡出 → 切换 → 淡入（期间冻结玩法） ——
    if (this.fade !== 'none') {
      this.fadeT += dt
      const dur = this.fade === 'out' ? CONFIG.dungeon.fadeOut : CONFIG.dungeon.fadeIn
      if (this.fade === 'out' && this.fadeT >= dur) {
        const to = otherRoom(this.plan, this.pendingDoor, this.currentId)
        this.enterRoom(to, this.pendingDoor)
        this.fade = 'in'
        this.fadeT = 0
      } else if (this.fade === 'in' && this.fadeT >= dur) {
        this.fade = 'none'
        this.pendingDoor = -1
      }
      this.camera.update(dt)
      return
    }

    // 消费引擎暂存震屏
    if (engine.shakeAmount > 0) {
      this.camera.addTrauma(engine.shakeAmount)
      engine.shakeAmount = 0
    }

    // 结算冻结：玩法停摆，相机震动照常衰减，渲染不黑（Vue 盖面板）
    if (this.locked) {
      this.camera.update(dt)
      return
    }

    // 背包只占界面输入，世界与角色计时继续；其他模态面板仍暂停。
    if (this.panel !== null && this.panel !== 'inventory') {
      return
    }

    if (this.fifth?.blocksInput) {
      this.current.cancelSearches()
      if (this.entryReveal < 0) this.fifth.update(dt, engine, this.current, this.localPlayers.entities, this.camera)
      else this.camera.update(dt)
      return
    }

    if(this.survivalIntroPending&&!dialogue.isActive){
      this.survivalIntroPending=false
      playNextStory('cave.monsterRoom',{profile:this.character})
    }
    // 主控倒下后由存活队友承担场景站位，剧情进度仍写入主控档案。
    const storyPlayer=this.player.alive?this.player:this.localPlayers.entities.find(player=>player.alive)??this.player
    if(this.entryReveal<0)this.relay?.update(dt,engine,this.current,storyPlayer)
    if(this.entryReveal<0)this.fourth?.update(dt,engine,this.current,storyPlayer)
    if (this.panel === 'inventory' && (this.fourth?.blocksInput || this.relay?.blocksInput || dialogue.isActive || this.storyLock || tutorial.isModal)) {
      this.mctx.bus.emit('ui:inventoryReturn', undefined)
      this.setPanel(null)
    }
    if (this.fourth?.blocksInput || this.relay?.blocksInput || dialogue.isActive || this.storyLock || tutorial.isModal) this.current.cancelSearches()
    if(this.fourth?.blocksInput){this.camera.follow({x:this.player.x,y:this.player.y},dt);this.camera.update(dt);return}
    if(this.relay?.blocksInput){this.camera.update(dt);return}
    // 对话/剧情演出/模态教程：玩家输入全冻结，但房间继续 update（敌人/特效/演出照常呼吸）
    if (dialogue.isActive || this.storyLock || tutorial.isModal) {
      // 正常探索的短旁白暂停战斗与计时，避免阅读时被弹幕命中。
      if(dialogue.isActive&&!this.director){this.camera.update(dt);return}
      // 演出冻结：玩家也停摆，世界 dt 与玩家 dt 同源即可
      this.current.updatePlayers(wdt, engine, this.participants(EMPTY_ROOM_INPUT,engine,wdt,true), wdt)
      if (tutorial.isModal) {
        // 模态教程气泡：交互键仅用于确认关闭（点击由组件处理）
        if (input.actionPressed('interact')) tutorial.dismiss()
      }
      this.director?.update(dt)
      this.camera.follow({ x: this.player.x, y: this.player.y }, dt)
      this.camera.update(dt)
      return
    }

    // —— 快捷栏按键：1/2/3 切手持，4/5/6 用道具，E/R 释放符卡 A/B ——
    for (const a of HAND_ACTIONS) {
      if (input.actionPressed(a)) this.selectHand(HAND_ACTIONS.indexOf(a))
    }
    for (let i = 0; this.panel !== 'inventory' && i < QUICK_ACTIONS.length; i++) {
      if (input.actionPressed(QUICK_ACTIONS[i]!)) this.useQuickItem(i)
    }
    if (this.panel !== 'inventory' && input.actionPressed('spellA') || this.spellARequested) this.tryCastSpell(engine,'spellA')
    if (this.panel !== 'inventory' && input.actionPressed('spellB') || this.spellBRequested) this.tryCastSpell(engine,'spellB')
    this.spellARequested = false;this.spellBRequested = false

    // —— 正常玩法（移动/攻击/闪避/交互全走 action 键位映射） ——
    const dead = !this.player.alive
    // 序章醒来房未解锁闪避：三种闪避输入全部掐断（短闪/长闪都发不出来）
    const dodgeOn = !this.director || this.director.dodgeUnlocked
    const intent=readPlayerIntent(input,input.worldMouseX,input.worldMouseY,this.panel !== 'inventory')
    const roomInput:RoomInput={...intent,moveX:dead?0:intent.moveX,moveY:dead?0:intent.moveY,
      attackPressed:!dead&&intent.attackPressed,attackHeld:!dead&&intent.attackHeld,attackReleased:!dead&&intent.attackReleased,
      specialPressed:!dead&&intent.specialPressed,specialHeld:!dead&&intent.specialHeld,specialReleased:!dead&&intent.specialReleased,
      dodgePressed:!dead&&dodgeOn&&intent.dodgePressed,dodgeHeld:!dead&&dodgeOn&&intent.dodgeHeld,dodgeReleased:!dead&&dodgeOn&&intent.dodgeReleased,
      interactPressed:!dead&&this.panel !== 'inventory'&&intent.interactPressed}

    // 世界吃顿帧 dt，玩家吃真实 dt（顿帧不拖慢攻速与移动）
    this.current.updatePlayers(wdt, engine, this.participants(roomInput,engine,dt), dt)
    this.fourth?.update(0,engine,this.current,this.player.alive?this.player:this.localPlayers.entities.find(player=>player.alive)??this.player)
    // B2：序章阶段推进（移动距离/清场计数/靠近灵梦/封印计时）
    this.director?.update(dt)
    this.camera.follow(this.player.alive?this.player:this.localPlayers.entities.find(player=>player.alive)??this.player,dt)
    this.camera.update(dt)
  }

  render(ctx: CanvasRenderingContext2D, engine: EngineContext): void {
    ctx.fillStyle = '#0b0d12'
    ctx.fillRect(0, 0, engine.viewW, engine.viewH)

    ctx.save()
    this.camera.apply(ctx)
    this.current.renderPlayers(ctx, this.localPlayers.entities, this.player)
    this.relay?.render(ctx)
    // 批次 E：光照压在全部世界内容之上（世界坐标；切房黑罩在屏幕空间另盖）
    if (CONFIG.art.slice) {
      const A = CONFIG.art.ambient
      // 脚本黑房（手动火把）按点火数给专属档位；其余房间按清场两档
      const ambient =
        this.current.ambientLevel ??
        (this.current.isCleared
          ? { center: A.litCenter, edge: A.litEdge }
          : { center: A.dimCenter, edge: A.dimEdge })
      if(this.depth>=2&&!this.current.ambientLevel){ambient.center=Math.min(.94,ambient.center+.07);ambient.edge=Math.min(.98,ambient.edge+.04)}
      // 帽灯全向柔光 + 房间光源（火把/地缝/矿簇；矿簇屏外自动剔除）
      const playerPosition=this.player.renderPosition
      const lightView=canvasViewport(ctx)
      const lamp = makeLampLight(playerPosition.x, playerPosition.y,this.player.equipmentCombat.lightRadiusMultiplier??1)
      // 漆黑醒来房：视野被黑暗压迫，帽灯视域收八成，光圈外真的什么都没有
      if (this.current.pitchBlack) lamp.r *= 0.8
      const lightSources: LightSource[] = [
        lamp,
        ...this.localPlayers.extras.flatMap(member=>{
          if(!member.entity?.alive)return []
          const position=member.entity.renderPosition
          return [makeLampLight(position.x,position.y,member.entity.equipmentCombat.lightRadiusMultiplier??1)]
        }),
        ...this.current.getRoomLights({
          x: lightView.left,
          y: lightView.top,
          w: lightView.right-lightView.left,
          h: lightView.bottom-lightView.top
        })
      ]
      this.light.render(
        ctx,
        lightView.left,
        lightView.top,
        this.camera.zoom,
        ambient,
        lightSources
      )
    }
    this.current.renderSearchMarkers(ctx)
    // 光束与状态文字是发光层，不被矿洞光照遮罩压黑。
    for(const player of this.localPlayers.entities){
      this.current.renderDoomsday(ctx, player)
      if (CONFIG.art.slice) player.renderDoomCrescents(ctx, 'all')
      player.scp127.renderOverlay(ctx, player)
    }
    this.localPlayers.renderLabels(ctx)
    ctx.restore()
    renderNausea(ctx, engine.viewW, engine.viewH, this.player)
    renderHurtScreen(ctx, engine.viewW, engine.viewH, this.player)

    const remaining=this.current.survivalSeconds
    if(remaining!==null&&!dialogue.isActive&&this.fade==='none'&&!this.locked){
      const width=236,x=(engine.viewW-width)/2,y=28
      ctx.save();ctx.fillStyle='#2b241ce8';ctx.strokeStyle='#b49a6580';ctx.lineWidth=1
      ctx.beginPath();ctx.roundRect(x,y,width,50,3);ctx.fill();ctx.stroke()
      ctx.font='12px zpix, "DotGothic16", monospace';ctx.textAlign='center';ctx.fillStyle='#e3cca0';ctx.fillText(t('game.survival.timer',{seconds:remaining}),engine.viewW/2,y+22)
      ctx.fillStyle='#89744b44';ctx.fillRect(x+16,y+34,width-32,4);ctx.fillStyle='#cfaa66';ctx.fillRect(x+16,y+34,(width-32)*(1-remaining/30),4);ctx.restore()
    }
    // 切房黑罩
    if (this.fade !== 'none') {
      const dur = this.fade === 'out' ? CONFIG.dungeon.fadeOut : CONFIG.dungeon.fadeIn
      const p = Math.min(1, this.fadeT / dur)
      const alpha = this.fade === 'out' ? p : 1 - p
      ctx.fillStyle = `rgba(5,4,9,${alpha})`
      ctx.fillRect(0, 0, engine.viewW, engine.viewH)
    }

    // B2：梦想封印爆发白闪（屏幕空间；灵梦 cut-in 的收尾光）
    const sealAlpha = this.current.sealFlashAlpha
    if (sealAlpha > 0) {
      ctx.fillStyle = `rgba(255,244,250,${Math.min(1, sealAlpha)})`
      ctx.fillRect(0, 0, engine.viewW, engine.viewH)
    }

    // B2：序章黑场（S0 醒来/营地；alpha 渐变，淡入淡出不突兀；B3 替换为真实据点）
    if (this.blackAlpha > 0) {
      ctx.fillStyle = `rgba(5,4,9,${Math.min(1, this.blackAlpha)})`
      ctx.fillRect(0, 0, engine.viewW, engine.viewH)
    }

    // B2：F 交互提示木牌（底部居中；面板/结算/营地黑场时隐藏）
    if (this.panel === null && !dialogue.isActive && !this.locked && this.fade === 'none' && this.blackAlpha < .05) {
      this.director?.renderTorchGuide(ctx, this.camera, engine.viewW, engine.viewH)
      this.director?.renderMiningGuide(ctx, this.camera, engine.viewW, engine.viewH)
      this.director?.renderSearchGuide(ctx, this.camera, engine.viewW, engine.viewH)
    }
    this.fourth?.renderScreen(ctx,engine.viewW,engine.viewH)
    this.fifth?.renderScreen(ctx,engine.viewW,engine.viewH,this.player,this.camera)
    const rawHint = this.current.hintFor(this.player)
    const hint = rawHint ? formatKeyBindings(rawHint) : null
    if (hint && this.panel === null && !dialogue.isActive && !this.locked && !this.director?.black) {
      ctx.save()
      // 像素招牌字（与 HUD/教程气泡同一字体栈）
      ctx.font = '14px zpix, "DotGothic16", "Courier New", monospace'
      const h = 32
      // 左右各留一颗菱形钉饰的位置
      const w = ctx.measureText(hint).width + 64
      const x = (engine.viewW - w) / 2
      // 整体抬高，与底部快捷栏（占屏底约 80~95px）留出呼吸间隙
      const y = engine.viewH - 150
      const r = 5
      // 木牌本体：深棕纵向渐变 + 黄铜细边（与 TutorialBubble 同一视觉语言）
      const bg = ctx.createLinearGradient(0, y, 0, y + h)
      bg.addColorStop(0, 'rgba(45,34,20,0.95)')
      bg.addColorStop(1, 'rgba(27,19,11,0.95)')
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.arcTo(x + w, y, x + w, y + h, r)
      ctx.arcTo(x + w, y + h, x, y + h, r)
      ctx.arcTo(x, y + h, x, y, r)
      ctx.arcTo(x, y, x + w, y, r)
      ctx.closePath()
      ctx.fillStyle = bg
      ctx.fill()
      ctx.strokeStyle = 'rgba(214,172,96,0.55)'
      ctx.lineWidth = 1
      ctx.stroke()
      // 顶部内嵌高光线
      ctx.fillStyle = 'rgba(240,205,126,0.14)'
      ctx.fillRect(x + r, y + 1, w - r * 2, 1)
      // 左右黄铜菱形钉（旋转方块，不依赖符号字体）
      const drawNail = (nx: number, ny: number): void => {
        ctx.save()
        ctx.translate(nx, ny)
        ctx.rotate(Math.PI / 4)
        ctx.fillStyle = '#d6ac60'
        ctx.fillRect(-2.6, -2.6, 5.2, 5.2)
        ctx.restore()
      }
      drawNail(x + 18, y + h / 2)
      drawNail(x + w - 18, y + h / 2)
      // 文案：暖米黄像素字
      ctx.fillStyle = '#f0e4c8'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(hint, engine.viewW / 2, y + h / 2 + 1)
      ctx.restore()
    }

    // 准星只跟随画布；移入搜索等界面时交还系统指针，避免留下冻结的准星。
    if (this.panel === null && !this.locked && !touchControls.value && engine.input.pointerOverCanvas) {
      const mx = engine.input.mouseX
      const my = engine.input.mouseY
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.arc(mx, my, 7, 0, Math.PI * 2)
      ctx.moveTo(mx - 11, my)
      ctx.lineTo(mx - 5, my)
      ctx.moveTo(mx + 5, my)
      ctx.lineTo(mx + 11, my)
      ctx.moveTo(mx, my - 11)
      ctx.lineTo(mx, my - 5)
      ctx.moveTo(mx, my + 5)
      ctx.lineTo(mx, my + 11)
      ctx.stroke()
    }
  }

  /**
   * 闪避状态码（i18n：引擎只产出稳定机器码，UI 侧翻 ui.dodge.<code>；
   * down=倒下 press=按压判定 roll=翻滚 coast=后撤滑行 lunge=长闪冲刺 cool=冷却中 ready=就绪）
   */
  private describeDodge(): string {
    const p = this.player
    if (!p.alive) return 'down'
    if (p.pendingDodge) return 'press'
    if (p.dodgePhase === 'short') return 'roll'
    if (p.dodgePhase === 'long') return p.isCoasting ? 'coast' : 'lunge'
    if (p.dodgeCooldown > 0) return 'cool'
    return 'ready'
  }

  /** HUD 只读快照（约 10Hz 轮询；背包/装备 UI 直接持有实例操作，不走快照） */
  getHudState(): Record<string, unknown> {
    const cur = this.current
    return {
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
      speed: Math.round(this.player.speedNow),
      // 保留真实生命值，由 HUD 统一向下取整，避免矿洞与基地显示采用不同规则。
      hp: this.player.hp,
      hpRatio: this.player.hpRatio,
      mana: Math.round(this.player.mana),
      manaRatio: this.player.manaRatio,
      spellCd: this.player.spellCdRatio,
      alive: this.player.alive,
      swing: this.player.swingPhase,
      dodge: this.describeDodge(),
      iFrame: this.player.isInvincible,
      dodgeCd: this.player.dodgeCdRatio,
      depth: this.depth,
      roomKind: cur.def.kind,
      roomId: this.currentId,
      enemiesAlive: cur.aliveCount,
      enemiesTotal: cur.totalEnemies,
      oresLeft: cur.oreLeft,
      dropsOnGround: cur.dropsCount,
      kills: this.kills,
      roomsCleared: [...this.roomCache.values()].filter((r) => r.isCleared).length,
      roomsTotal: this.plan.rooms.length,
      bagCopper: this.inventory.count(ORE_COPPER_ID),
      bagIron: this.inventory.count(ORE_IRON_ID),
      bagGold: this.inventory.count(ORE_GOLD_ID),
      selected: this.selected,
      panel: this.panel,
      // B2：序章固定楼层进行中（HUD 楼层牌/进房横幅显示章节名而非"第一层"）
      prologue: this.director !== null,
      // 成长信息（B0：右上调试窗可见，正式角色面板后续批次做）
      level: this.character.combat.level,
      exp: this.character.combat.exp,
      expNeed: expNeeded(this.character.combat.level),
      unspentPoints: this.character.combat.unspentPoints,
      round: this.character.round
    }
  }
}
