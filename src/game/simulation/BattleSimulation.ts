import { SATIETY } from '../../content/statuses/cuisine'
import { Projectile } from '../Projectile'
import { Enemy } from '../Enemy'
import { calculateDamage, calculateRangedDamage, deriveCombat } from '../../shared/combat'
import { KedamaBoss } from '../KedamaBoss'
import { withSimulationAppearance } from '../../shared/playerAppearance'
import type { EngineContext } from '../../core/types'
import { InputManager } from '../../core/InputManager'
import { FixedStep } from '../../core/simulation/FixedStep'
import { SnapshotCodec, type StateFields } from '../../core/simulation/snapshot'
import { SimulationSession, stateChecksum, preserveSimulationContext, type HeadlessAdapter, type SessionSnapshot } from '../../core/simulation/SimulationSession'
import { withoutPresentation } from '../../core/simulation/presentation'
import type { InputCommand } from '../../core/simulation/InputCommand'
import { Registry } from '../../content/core/Registry'
import { enemies } from '../../content/enemies/registry'
import { getBrain } from '../enemyAi'
import { CharacterProfile } from '../../shared/profile'
import { Player } from '../Player'
import { SearchSystem } from '../search/SearchSystem'
import { searchRewardEffects,collectSearchReward } from '../../shared/searchRewards'
import { createSearchContents,findSearchPlacement } from '../search/searchLayout'
import { SEARCH_BALANCE } from '../../content/search/balance'
import { resolveSearchRules, applySearchEffects, searchItemWeight, searchDensity } from '../../content/search/rules'
import { layoutProps } from '../art/props'
import { itemSearchDuration,itemSearchLevel,SEARCH_DURATIONS } from '../../shared/itemQuality'
import { Inventory } from '../../shared/inventory'
import { RoomRuntime, type RoomInput, type RoomHost, type RoomSnapshot } from '../cave/RoomRuntime'
import { getItemDef } from '../../shared/itemDefs'
import { CONFIG } from '../config'
import { STRANGE_GEL_ID } from '../../content/items/vanilla/ids'
import { GrimmBoss } from '../GrimmBoss'
import { withoutPersistence } from '../../core/simulation/persistence'
import { LocalPlayers, type LocalPlayersSnapshot, type LocalPlayer } from './LocalPlayers'
import { idlePlayerCommand } from '../../core/simulation/PlayerCommand'
import type { RoomParticipant } from '../cave/RoomRuntime'
import { SpatialGrid } from '../../core/spatial/SpatialGrid'
import { firstEnemyAlong,segmentCircleEntry } from '../CombatSpatial'
import { sweepProjectileObstacles } from '../projectileObstacles'
import { buildOldHellFloorPlan } from '../cave/dungeon/oldHellFloor'
import { layoutRoomDoors,doorArrival } from '../cave/dungeon/roomDoors'
import { TileMap } from '../tilemap'
import { CaveNature } from '../art/caveNature'
import { rollMineralId,rewardRareMineralIds,mineralAvailableOnFloor } from '../../content/minerals/registry'

let versionRevision=-1
let cachedContentVersion=''

/** 数值、内容行为与模拟协议共同标识录像兼容性，不能只比较游戏展示版本号。 */
export function simulationContentVersion(): string {
  if(versionRevision===Registry.revision)return cachedContentVersion
  const visited = new WeakSet<object>()
  const data = (value: unknown): unknown => {
    if(typeof value === 'function')return String(value)
    if(value === null || typeof value !== 'object')return value
    if(visited.has(value))return null
    visited.add(value)
    if(Array.isArray(value))return value.map(data)
    return Object.fromEntries(Object.entries(value).map(([key,entry])=>[key,data(entry)]))
  }
  const definitions = [...Registry.references()].map(([key,value])=>[key,data(value)])
  const brains = enemies.all().map(def=>[def.ai,String(getBrain(def.ai).think)])
  versionRevision=Registry.revision
  cachedContentVersion=`0.1.0:模拟1:${stateChecksum({definitions,brains,player:String(Player.prototype.update),room:String(RoomRuntime.prototype.update),config:CONFIG,searchBalance:SEARCH_BALANCE,satiety:SATIETY,searchDurations:SEARCH_DURATIONS,bundle:import.meta.url.split('/').pop(),implementation:[Player,Enemy,Projectile,RoomRuntime,LocalPlayers,SearchSystem,createSearchContents,findSearchPlacement,resolveSearchRules,applySearchEffects,searchItemWeight,searchDensity,searchRewardEffects,collectSearchReward,layoutProps,itemSearchDuration,itemSearchLevel,Inventory,SpatialGrid,firstEnemyAlong,segmentCircleEntry,sweepProjectileObstacles,TileMap,CaveNature,rollMineralId,rewardRareMineralIds,mineralAvailableOnFloor,buildOldHellFloorPlan,layoutRoomDoors,doorArrival,KedamaBoss,GrimmBoss,calculateDamage,calculateRangedDamage].map(String)})}`
  return cachedContentVersion
}

export interface BattleSnapshot {
  version: 1
  profile: StateFields
  player: StateFields
  localPlayers?: LocalPlayersSnapshot
  room: RoomSnapshot
  hitStop: number
  kills: number
  miningChestClaimed: boolean
  terminal: boolean
}
export interface BattleCommand extends InputCommand {
  /** 无头输入中的指针是世界坐标；不需要相机或屏幕尺寸。 */
  roomInput?: RoomInput
  spell?: string
  quickItem?: string
  selectHand?: number
  bossStage?: 2
}

export interface BattleView {
  player:{x:number;y:number;hp:number;maxHp:number;mana:number;alive:boolean}
  enemies:Array<{id:string;content:string;x:number;y:number;hp:number;alive:boolean}>
  cleared:boolean
  players:Array<{id:string;x:number;y:number;hp:number;alive:boolean}>
}

/** 使用正式房间、玩家、敌人、武器和碰撞代码，不复制一份简化战斗模型。 */
export class BattleSimulation implements HeadlessAdapter<BattleSnapshot> {
  readonly profile = new CharacterProfile()
  readonly localPlayers = new LocalPlayers(this.profile)
  player!: Player
  room!: RoomRuntime
  private hitStop = 0
  private kills = 0
  private miningChestClaimed = false
  terminal = false
  private readonly host: RoomHost = {
    inventory: this.profile.inventory,
    searchEffects:()=>searchRewardEffects(this.profile),collectSearchReward:id=>collectSearchReward(this.profile,id),
    clearEnemyBullets:(x,y,r)=>{for(const enemy of this.room.snapshotEnemies)if(enemy instanceof GrimmBoss)enemy.attacks.clearBullets(x,y,r)},
    onKill: amount => { this.kills++; this.gainExp(amount) },
    onMine: kind => this.gainExp(kind === 'ore' ? CONFIG.exp.mineOre : CONFIG.exp.mineRock),
    claimMiningChest: () => { if(this.miningChestClaimed)return false;this.miningChestClaimed=true;return true },
    requestDoor: () => { this.terminal=true }, requestExtract: () => { this.terminal=true }, onPlayerDied: () => { if(this.localPlayers.allDown)this.terminal=true },
    onItemFound: id => { if(id===STRANGE_GEL_ID)this.profile.setFlag('story.strangeGel.found',true) }
  }
  private readonly engine: EngineContext = {
    viewW: CONFIG.roomCols*CONFIG.tile, viewH: CONFIG.roomRows*CONFIG.tile, input: new InputManager(), shakeAmount: 0,
    hitStop: seconds => { this.hitStop=Math.max(this.hitStop,seconds) }, shake: () => {},
    worldDt: dt => { if(this.hitStop<=0)return dt;this.hitStop=Math.max(0,this.hitStop-dt);return 0 }
  }
  private gainExp(amount:number):void {
    if(!this.profile.flagBool('prologue.done'))return
    const multiplier=Math.min(CONFIG.exp.depthCap,1+CONFIG.exp.depthFactor*((this.room.def.floor??1)-1))
    this.profile.gainExp(Math.round(amount*multiplier))
  }
  restore(state:BattleSnapshot):void {
    preserveSimulationContext(()=>withoutPresentation(()=>{
      if(state.version!==1)throw new Error('战斗快照版本不兼容')
      const codec=new SnapshotCodec()
      this.profile.restoreSimulation(state.profile,codec)
      this.player=new Player(0,0)
      ;(this.player as {entityId:string}).entityId=String(state.player.entityId);codec.add(this.player)
      this.localPlayers.bindPrimary(this.player);this.localPlayers.prepareRestore(state.localPlayers,codec)
      this.room=new RoomRuntime(state.room.definition,0,0,state.room.script??undefined,true)
      this.room.restoreSimulation(state.room,codec)
      this.engine.viewW=this.room.map.cols*this.room.map.tile;this.engine.viewH=this.room.map.rows*this.room.map.tile
      this.player.scp127.bind(this.profile);this.player.ammoInventory=this.profile.inventory
      this.player.restoreSimulation(state.player,codec,this.room.map)
      this.localPlayers.finishRestore(state.localPlayers,codec,this.room.map)
      this.room.rememberPlayers(this.localPlayers.entities)
      this.hitStop=state.hitStop;this.kills=state.kills;this.miningChestClaimed=state.miningChestClaimed;this.terminal=state.terminal
    }))
  }
  snapshot():BattleSnapshot {
    this.localPlayers.bindPrimary(this.player)
    const codec=new SnapshotCodec([this.player]);this.room.bindSnapshotReferences(codec)
    this.localPlayers.bindReferences(codec)
    return {version:1,profile:this.profile.captureSimulation(codec),player:this.player.captureSimulation(codec),localPlayers:this.localPlayers.capture(codec),room:this.room.captureSimulation(codec),hitStop:this.hitStop,kills:this.kills,miningChestClaimed:this.miningChestClaimed,terminal:this.terminal}
  }
  view():BattleView{return{player:{x:this.player.x,y:this.player.y,hp:this.player.hp,maxHp:this.player.maxHp,mana:this.player.mana,alive:this.player.alive},enemies:this.room.snapshotEnemies.map(enemy=>({id:enemy.entityId,content:enemy.def.id,x:enemy.x,y:enemy.y,hp:enemy.hp,alive:enemy.alive})),cleared:this.room.isCleared,players:this.localPlayers.all.flatMap(member=>member.entity?[{id:member.id,x:member.entity.x,y:member.entity.y,hp:member.entity.hp,alive:member.entity.alive}]:[])}}
  update(dt:number,raw:InputCommand):void {
    if(this.terminal)return
    const command=raw as BattleCommand
    if(command.external)this.restore(command.external as BattleSnapshot)
    this.localPlayers.bindPrimary(this.player);this.localPlayers.ensureEntities(this.room.map,this.player,(x,y,r)=>this.room.canPlacePlayer(x,y,r))
    withSimulationAppearance(this.profile.playerAppearance,()=>withoutPresentation(()=>{
      if(command.selectHand!==undefined){
        this.profile.selected=Math.max(0,Math.min(2,command.selectHand))
        const slot=(['weaponA','weaponB','pick'] as const)[this.profile.selected]!
        const id=this.profile.equipment.get(slot);this.player.setMelee(id?getItemDef(id).melee??null:null,id)
      }
      if(command.quickItem){if(this.profile.inventory.count(command.quickItem)>0&&this.player.consumeItem(command.quickItem))this.profile.inventory.removeAt(this.profile.inventory.slots.findIndex(slot=>slot?.id===command.quickItem),1)}
      if(command.spell){const spell=getItemDef(command.spell).spell;if(spell&&this.player.castSpell(spell))this.room.resolveSpell(this.player,command.spell,spell,this.engine,this.host)}
      if(command.bossStage===2)this.room.beginBossSecondStage()
      const held=(action:string)=>command.actionsDown.includes(action),pressed=(action:string)=>command.actionsPressed.includes(action),released=(action:string)=>command.actionsReleased.includes(action)
      const input:RoomInput=command.roomInput??{moveX:Number(held('moveRight'))-Number(held('moveLeft')),moveY:Number(held('moveDown'))-Number(held('moveUp')),attackPressed:pressed('attack'),attackHeld:held('attack'),attackReleased:released('attack'),specialPressed:pressed('special'),specialHeld:held('special'),specialReleased:released('special'),dodgePressed:pressed('dodge'),dodgeHeld:held('dodge'),dodgeReleased:released('dodge'),pointerX:command.worldPointer?.x??command.mouseX,pointerY:command.worldPointer?.y??command.mouseY,interactPressed:pressed('interact')}
      this.player.scp127.observe(dt,this.player)
      const worldDt=this.engine.worldDt(dt)
      const members:RoomParticipant[]=[{player:this.player,input,host:this.host}]
      for(const member of this.localPlayers.extras)if(member.entity){
        const player=member.entity,host=this.memberHost(member)
        const intent=this.localPlayers.normalize(member,command.players?.find(input=>input.playerId===member.id)??idlePlayerCommand(member.id,player.x,player.y,player.facing))
        this.localPlayers.apply(member,intent,this.engine,this.room,host);player.scp127.observe(dt,player)
        members.push({player,input:intent,host})
      }
      this.room.updatePlayers(worldDt,this.engine,members,dt,command.searchActions??[])
      for(const enemy of this.room.snapshotEnemies)if(enemy instanceof GrimmBoss&&enemy.alive)enemy.attacks.updatePlayers(worldDt,this.localPlayers.entities,this.room.map,this.engine,this.room.fx,this.room.projectileBlockers)
    }))
  }
  private memberHost(member:LocalPlayer):RoomHost {
    const gain=(amount:number)=>{
      const multiplier=Math.min(CONFIG.exp.depthCap,1+CONFIG.exp.depthFactor*((this.room.def.floor??1)-1))
      if(member.profile.gainExp(Math.round(amount*multiplier))>0)member.entity?.applyGrowth(deriveCombat(member.profile.combat),false)
    }
    return {...this.host,inventory:member.profile.inventory,searchEffects:()=>searchRewardEffects(member.profile),collectSearchReward:id=>collectSearchReward(member.profile,id),onKill:amount=>{this.kills++;gain(amount)},onMine:kind=>gain(kind==='ore'?CONFIG.exp.mineOre:CONFIG.exp.mineRock),onItemFound:id=>{if(id===STRANGE_GEL_ID)member.profile.setFlag('story.strangeGel.found',true)}}
  }
}

/** 批量模拟入口只返回数据；用户或工具显式调用才运行，游戏启动不会自动跑。 */
export function simulateBattle(initial:BattleSnapshot,timing:SessionSnapshot,steps:number,input:(tick:number,state:BattleView)=>BattleCommand):{state:BattleSnapshot;session:SessionSnapshot} {
  if(!Number.isSafeInteger(steps)||steps<0)throw new Error('模拟步数无效')
  return withoutPersistence(()=>{
    const session=new SimulationSession(timing.random.seed),battle=new BattleSimulation()
    session.run(()=>battle.restore(structuredClone(initial)));session.restore(timing)
    for(let tick=0;tick<steps&&!battle.terminal;tick++)session.step(()=>battle.update(FixedStep.DT,input(session.tick,battle.view())))
    return {state:battle.snapshot(),session:session.snapshot()}
  })
}

/** 独立任务逐局让出执行权，取消不会影响正在游玩的会话或真实存档。 */
export async function simulateBattleBatch(jobs:readonly {initial:BattleSnapshot;session:SessionSnapshot;steps:number;input:(tick:number,state:BattleView)=>BattleCommand}[],signal?:AbortSignal):Promise<Array<{state:BattleSnapshot;session:SessionSnapshot}>>{
  const results:Array<{state:BattleSnapshot;session:SessionSnapshot}>=[]
  for(const job of jobs){
    if(signal?.aborted)throw new Error('批量模拟已取消')
    results.push(simulateBattle(job.initial,job.session,job.steps,job.input))
    await new Promise<void>(resolve=>setTimeout(resolve,0))
  }
  return results
}
