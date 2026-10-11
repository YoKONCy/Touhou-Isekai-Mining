import { Player } from '../Player'
import type { TileMap } from '../tilemap'
import type { EngineContext } from '../../core/types'
import type { InputManager } from '../../core/InputManager'
import { SnapshotCodec, type StateFields } from '../../core/simulation/snapshot'
import { idlePlayerCommand, type PlayerCommand } from '../../core/simulation/PlayerCommand'
import { CharacterProfile } from '../../shared/profile'
import { deriveCombat, passiveEquipment } from '../../shared/combat'
import { getItemDef } from '../../shared/itemDefs'
import { withSimulationAppearance } from '../../shared/playerAppearance'
import type { RoomHost, RoomRuntime } from '../cave/RoomRuntime'
import { t } from '../../i18n'
import { bakeSprite, drawSprite, type RasterSprite } from '../../core/rendering/SpriteCache'
import { canvasViewport,visible } from '../../core/rendering/Viewport'
import { fontCacheKey } from '../../core/rendering/TextStamp'
const labels=new WeakMap<LocalPlayer,{key:string;sprite:RasterSprite}>()

export type PlayerController = {kind:'gamepad';index:number} | {kind:'script'} | {kind:'idle'}
export interface LocalPlayerInputView {
  readonly playerId:string;readonly entityId:string
  readonly x:number;readonly y:number;readonly vx:number;readonly vy:number
  readonly hp:number;readonly mana:number;readonly alive:boolean;readonly facing:number
  readonly selected:number;readonly tool:string|null
}
export interface LocalPlayer {
  readonly id: string
  readonly profile: CharacterProfile
  entity: Player | null
  controller: PlayerController
  /** 输入源只拿只读数据并返回指令，不能通过参数绕过固定逻辑步修改角色。 */
  source?: (tick:number, view:LocalPlayerInputView) => PlayerCommand
  buttons: boolean[]
}
export interface LocalPlayersSnapshot {
  version: 1
  sequence: number
  members: Array<{id:string;profile:StateFields;player:StateFields;controller:PlayerController}>
}
const HANDS = ['weaponA','weaponB','pick'] as const
const NO_COMMANDS:PlayerCommand[]=[]
const noCommands=()=>NO_COMMANDS

/** 玩家名册属于会话，世界不限定人数；各玩家档案和控制器互相独立。 */
export class LocalPlayers {
  readonly primaryId = 'local:primary'
  private sequence = 0
  private readonly members = new Map<string, LocalPlayer>()
  private roster:LocalPlayer[]=[]
  private guests:LocalPlayer[]=[]
  private actors:Player[]=[]
  private rosterDirty=true
  private actorsDirty=true
  private syncStates=new WeakMap<LocalPlayer,{entity:Player;revision:number;selected:number;appearance:string}>()
  constructor(profile: CharacterProfile) {
    this.members.set(this.primaryId,{id:this.primaryId,profile,entity:null,controller:{kind:'idle'},buttons:[]})
  }
  private refreshRoster():void {
    if(!this.rosterDirty)return
    this.roster=Array.from(this.members.values());this.guests=this.roster.filter(member=>member.id!==this.primaryId);this.rosterDirty=false
  }
  get all(): readonly LocalPlayer[] { this.refreshRoster();return this.roster }
  get extras(): readonly LocalPlayer[] { this.refreshRoster();return this.guests }
  get entities(): readonly Player[] {
    if(this.actorsDirty){this.actors=[];for(const member of this.all)if(member.entity)this.actors.push(member.entity);this.actorsDirty=false}
    return this.actors
  }
  get primary(): LocalPlayer { return this.members.get(this.primaryId)! }
  get allDown(): boolean { return this.entities.length>0 && this.entities.every(player=>!player.alive) }
  get(id:string): LocalPlayer | undefined { return this.members.get(id) }
  add(profile = new CharacterProfile(), controller?: PlayerController): LocalPlayer {
    if(this.all.some(member=>member.profile===profile))throw new Error(t('ui.local_players.profile_in_use'))
    const used=new Set(this.extras.flatMap(member=>member.controller.kind==='gamepad'?[member.controller.index]:[]))
    let index=0;while(used.has(index))index++
    if(controller)this.validateController(controller)
    let id:string
    do{id=`local:player:${++this.sequence}`}while(this.members.has(id))
    const member:LocalPlayer={id,profile,entity:null,controller:controller??{kind:'gamepad',index},buttons:[]}
    this.members.set(id,member)
    this.rosterDirty=this.actorsDirty=true
    return member
  }
  remove(id:string):boolean { if(id===this.primaryId)return false;const removed=this.members.delete(id);if(removed)this.rosterDirty=this.actorsDirty=true;return removed }
  setController(id:string,controller:PlayerController):void {
    const member=this.get(id)
    if(!member||id===this.primaryId)throw new Error(t('ui.local_players.invalid_player'))
    this.validateController(controller,id)
    member.controller=controller;member.buttons=[]
  }
  setInputSource(id:string,source:LocalPlayer['source']):void {
    const member=this.get(id);if(!member||id===this.primaryId)throw new Error(t('ui.local_players.invalid_player'))
    member.source=source;member.controller=source?{kind:'script'}:{kind:'idle'};member.buttons=[]
  }
  private validateController(controller:PlayerController,except?:string):void {
    if(!controller||!['gamepad','idle','script'].includes(controller.kind))throw new Error(t('ui.local_players.invalid_controller'))
    if(controller.kind==='gamepad'){
      if(!Number.isSafeInteger(controller.index)||controller.index<0)throw new Error(t('ui.local_players.invalid_controller'))
      if(this.extras.some(other=>other.id!==except&&other.controller.kind==='gamepad'&&other.controller.index===controller.index))throw new Error(t('ui.local_players.controller_in_use'))
    }
  }
  bindPrimary(player:Player):void {if(this.primary.entity!==player)this.actorsDirty=true;this.primary.entity=player;player.playerId=this.primaryId;player.appearance=this.primary.profile.playerAppearance;player.costume=this.primary.profile.costume;player.bindFood(this.primary.profile.food) }
  beginScene(player:Player,map:TileMap,valid?:(x:number,y:number,r:number)=>boolean):void {
    this.bindPrimary(player)
    for(const member of this.extras){member.entity=null;member.buttons=[]}
    this.actorsDirty=true
    this.ensureEntities(map,player,valid)
  }
  ensureEntities(map:TileMap,anchor:Player,valid?:(x:number,y:number,r:number)=>boolean):void {
    for(const member of this.extras)if(!member.entity){
      const player=member.entity=new Player(anchor.x,anchor.y)
      this.actorsDirty=true
      player.playerId=member.id;player.applyGrowth(deriveCombat(member.profile.combat));this.sync(member)
      this.place(player,map,anchor,this.entities,valid)
    }
  }
  placeExtras(map:TileMap,anchor:Player,valid?:(x:number,y:number,r:number)=>boolean):void {
    this.ensureEntities(map,anchor,valid)
    for(const member of this.extras)if(member.entity){member.entity.cancelCharge();this.place(member.entity,map,anchor,this.entities,valid)}
  }
  private place(player:Player,map:TileMap,anchor:Player,others:readonly Player[],valid?:(x:number,y:number,r:number)=>boolean):void {
    const b=map.bounds
    for(let radius=map.tile;radius<Math.hypot(b.right-b.left,b.bottom-b.top);radius+=map.tile){
      for(let i=0;i<16;i++){
        const angle=i*Math.PI/8,x=anchor.x+Math.cos(angle)*radius,y=anchor.y+Math.sin(angle)*radius,r=player.collisionR
        if(x-r<b.left||x+r>b.right||y-r<b.top||y+r>b.bottom)continue
        if(map.solidAtWorld(x,y)||map.solidAtWorld(x-r,y-r)||map.solidAtWorld(x+r,y+r))continue
        if(valid&&!valid(x,y,r))continue
        if(others.some(other=>other!==player&&Math.hypot(other.x-x,other.y-y)<r+other.collisionR+8))continue
        player.x=x;player.y=y;player.vx=player.vy=0;return
      }
    }
    // 极端密集地图允许队友重合，不能把人传送进墙内。
    player.x=anchor.x;player.y=anchor.y;player.vx=player.vy=0
  }
  sync(member:LocalPlayer):void {
    const player=member.entity;if(!player)return
    player.costume=member.profile.costume
    const previous=this.syncStates.get(member),revision=member.profile.equipment.revision,selected=member.profile.selected,appearance=member.profile.playerAppearance
    if(previous?.entity===player&&previous.revision===revision&&previous.selected===selected&&previous.appearance===appearance)return
    player.appearance=member.profile.playerAppearance
    player.bindFood(member.profile.food)
    player.bindEquipment(member.profile.equipment)
    player.scp127.bind(member.profile);player.ammoInventory=member.profile.inventory
    const id=member.profile.equipment.get(HANDS[member.profile.selected]??'pick')
    withSimulationAppearance(player.appearance,()=>player.setMelee(id?getItemDef(id).melee??null:null,id))
    player.equipmentCombat=passiveEquipment(member.profile.equipment)
    this.syncStates.set(member,{entity:player,revision,selected,appearance})
  }
  readCommands(input:InputManager,tick:number):PlayerCommand[] {
    if(!this.extras.length){input.resolvePlayerCommands(noCommands);return NO_COMMANDS}
    const commands=input.resolvePlayerCommands(()=>{
      const out:PlayerCommand[]=[]
      const pads=this.extras.length&&typeof navigator!=='undefined'?navigator.getGamepads?.()??[]:[]
      for(const member of this.extras){
        const player=member.entity;if(!player)continue
        if(member.source&&member.controller.kind==='script')out.push({...member.source(tick,{playerId:member.id,entityId:player.entityId,x:player.x,y:player.y,vx:player.vx,vy:player.vy,hp:player.hp,mana:player.mana,alive:player.alive,facing:player.facing,selected:member.profile.selected,tool:player.activeToolId}),playerId:member.id})
        else out.push(this.readGamepad(member,pads))
      }
      return out
    })
    const out:PlayerCommand[]=[]
    for(let i=0;i<this.extras.length;i++){
      const member=this.extras[i],command=commands[i]?.playerId===member.id?commands[i]:commands.find(command=>command.playerId===member.id)
      if(member.entity&&command)out.push(this.normalize(member,command))
    }
    return out
  }
  normalize(member:LocalPlayer,raw:PlayerCommand):PlayerCommand {
    const p=member.entity!,command=idlePlayerCommand(member.id,p.x,p.y,p.facing)
    command.moveX=Number.isFinite(raw.moveX)?Math.max(-1,Math.min(1,raw.moveX)):0
    command.moveY=Number.isFinite(raw.moveY)?Math.max(-1,Math.min(1,raw.moveY)):0
    if(Number.isFinite(raw.pointerX)&&Number.isFinite(raw.pointerY)){command.pointerX=raw.pointerX;command.pointerY=raw.pointerY}
    for(const key of ['attackPressed','attackHeld','attackReleased','specialPressed','specialHeld','specialReleased','dodgePressed','dodgeHeld','dodgeReleased','interactPressed'] as const)command[key]=raw[key]===true
    if(raw.hand!==undefined&&Number.isInteger(raw.hand)&&raw.hand>=0&&raw.hand<3)command.hand=raw.hand
    if(raw.quickSlot!==undefined&&Number.isInteger(raw.quickSlot)&&raw.quickSlot>=0&&raw.quickSlot<3)command.quickSlot=raw.quickSlot
    if(raw.spellSlot===0||raw.spellSlot===1)command.spellSlot=raw.spellSlot
    if(raw.cancelActions===true)command.cancelActions=true
    return command
  }
  private readGamepad(member:LocalPlayer,pads:readonly (Gamepad|null)[]):PlayerCommand {
    const player=member.entity!,command=idlePlayerCommand(member.id,player.x,player.y,player.facing)
    if(member.controller.kind!=='gamepad'){command.cancelActions=true;return command}
    const pad=pads[member.controller.index]
    if(!pad?.connected){member.buttons=[];command.cancelActions=true;return command}
    const down=(index:number)=>!!pad?.connected&&(pad.buttons[index]?.pressed===true||(pad.buttons[index]?.value??0)>.25)
    const pressed=(index:number)=>down(index)&&!member.buttons[index],released=(index:number)=>!down(index)&&!!member.buttons[index]
    const axis=(index:number)=>{const value=pad?.axes[index]??0;return Number.isFinite(value)&&Math.abs(value)>.18?value:0}
    command.moveX=axis(0);command.moveY=axis(1)
    const x=axis(2),y=axis(3)
    if(Math.hypot(x,y)>.18){const angle=Math.atan2(y,x);command.pointerX=player.x+Math.cos(angle)*300;command.pointerY=player.y+Math.sin(angle)*300}
    command.attackHeld=down(7);command.attackPressed=pressed(7);command.attackReleased=released(7)
    command.specialHeld=down(1);command.specialPressed=pressed(1);command.specialReleased=released(1)
    command.dodgeHeld=down(0);command.dodgePressed=pressed(0);command.dodgeReleased=released(0)
    command.interactPressed=pressed(2)
    if(pressed(4))command.hand=(member.profile.selected+2)%3
    if(pressed(5))command.hand=(member.profile.selected+1)%3
    if(pressed(3))command.spellSlot=0
    if(pressed(6))command.spellSlot=1
    for(const [slot,button] of [12,15,13].entries())if(pressed(button))command.quickSlot=slot
    member.buttons=Array.from({length:pad?.buttons.length??16},(_,index)=>down(index))
    return command
  }
  apply(member:LocalPlayer,command:PlayerCommand,engine:EngineContext,room?:RoomRuntime,host?:RoomHost):void {
    const player=member.entity;if(!player||!player.alive)return
    if(command.cancelActions){player.cancelCharge();player.bow.cancelGesture()}
    if(!player.isChanneling&&command.hand!==undefined&&Number.isInteger(command.hand)&&command.hand>=0&&command.hand<3)member.profile.selected=command.hand
    this.sync(member)
    if(command.quickSlot!==undefined&&Number.isInteger(command.quickSlot)&&command.quickSlot>=0&&command.quickSlot<3){const slot=member.profile.quickSlots.get(command.quickSlot);if(slot&&player.consumeItem(slot.id))member.profile.quickSlots.consumeOne(command.quickSlot)}
    if(command.spellSlot!==undefined&&room&&host){
      const id=member.profile.equipment.get(command.spellSlot===0?'spellA':'spellB'),spell=id?getItemDef(id).spell:undefined
      if(id&&spell&&player.castSpell(spell))room.resolveSpell(player,id,spell,engine,host)
    }
  }
  bindReferences(codec:SnapshotCodec):void { for(const player of this.entities)codec.add(player) }
  capture(codec:SnapshotCodec):LocalPlayersSnapshot {
    this.bindReferences(codec)
    return {version:1,sequence:this.sequence,members:this.extras.filter(member=>member.entity).map(member=>({id:member.id,profile:member.profile.captureSimulation(codec),player:member.entity!.captureSimulation(codec),controller:structuredClone(member.controller)}))}
  }
  /** 先登记所有玩家实例，之后房间敌人的目标引用才能正确解码。 */
  prepareRestore(snapshot:LocalPlayersSnapshot|undefined,codec:SnapshotCodec):void {
    if(snapshot&&snapshot.version!==1)throw new Error('多人名册快照不兼容')
    if(snapshot&&(!Number.isSafeInteger(snapshot.sequence)||snapshot.sequence<0||!Array.isArray(snapshot.members)))throw new Error('多人名册数据无效')
    const previous=new Map(this.members)
    for(const member of this.extras)this.members.delete(member.id)
    this.rosterDirty=this.actorsDirty=true;this.syncStates=new WeakMap()
    this.sequence=snapshot?.sequence??0
    for(const record of snapshot?.members??[]){
      if(record.id===this.primaryId||this.members.has(record.id))throw new Error('多人名册包含重复玩家')
      this.validateController(record.controller)
      const profile=previous.get(record.id)?.profile??new CharacterProfile()
      profile.restoreSimulation(record.profile,codec)
      const entity=new Player(0,0);(entity as {entityId:string}).entityId=String(record.player.entityId)
      const member:LocalPlayer={id:record.id,profile,entity,controller:structuredClone(record.controller),source:previous.get(record.id)?.source,buttons:[]}
      this.members.set(member.id,member);codec.add(entity);this.sync(member)
      this.rosterDirty=this.actorsDirty=true
    }
  }
  finishRestore(snapshot:LocalPlayersSnapshot|undefined,codec:SnapshotCodec,map:TileMap):void {
    for(const record of snapshot?.members??[]){
      const member=this.get(record.id)!;member.entity!.restoreSimulation(record.player,codec,map)
      member.entity!.scp127.bind(member.profile);member.entity!.ammoInventory=member.profile.inventory;member.entity!.bindFood(member.profile.food)
    }
  }
  renderLabels(g:CanvasRenderingContext2D):void {
    if(this.members.size<2)return
    const view=canvasViewport(g)
    for(const [index,member] of this.all.entries())if(member.entity){
      const text=member.profile.playerName||`P${index+1}`,p=member.entity
      if(!visible(view,p.x,p.y-45,160))continue
      const color=p.alive?(member.profile.playerAppearance==='sister'?'#d8c4ee':'#b9d7ee'):'#9d8d91',key=`${text}:${color}:${fontCacheKey()}`
      let label=labels.get(member)
      if(!label||label.key!==key){
        g.save();g.font='10px zpix, sans-serif';const width=Math.ceil(g.measureText(text).width)+8;g.restore()
        const sprite=bakeSprite(-width/2,-13,width,18,c=>{c.font='10px zpix, sans-serif';c.textAlign='center';c.lineWidth=3;c.strokeStyle='#15121ed9';c.fillStyle=color;c.strokeText(text,0,0);c.fillText(text,0,0)})
        label={key,sprite};labels.set(member,label)
      }
      g.save();g.translate(p.x,p.y-45);drawSprite(g,label.sprite);g.restore()
    }
  }
}
