import { setPlayerAppearance } from '../shared/playerAppearance'
import type { PlayerAppearance } from '../shared/playerAppearance'
import { LocalPlayers, type LocalPlayer, type LocalPlayersSnapshot } from './simulation/LocalPlayers'
import { CharacterProfile as LocalProfile } from '../shared/profile'
import { idlePlayerCommand } from '../core/simulation/PlayerCommand'
import { SnapshotCodec, type StateFields } from '../core/simulation/snapshot'
import type { RoomSnapshot } from './cave/RoomRuntime'
import { readPlayerIntent } from './simulation/PlayerIntent'
import { compactLayout } from '../browser/display'
import type { IGameModule, ModuleContext } from '../core/module'
import type { EngineContext } from '../core/types'
import type { CharacterProfile } from '../shared/profile'
import { CharacterModuleActions } from '../shared/moduleActions'
import type { Slot } from '../shared/inventory'
import { deriveCombat, passiveEquipment, expNeeded } from '../shared/combat'
import { getItemDef } from '../shared/itemDefs'
import { DOOMSDAY_ID } from '../content/items/vanilla/ids'
import { Player } from './Player'
import { renderNausea } from './art/nauseaScreen'
import { renderHurtScreen } from './art/hurtScreen'
import { CRIMSON_BLESSING } from '../shared/statusEffects'
import { GrimmBoss } from './GrimmBoss'
import { RoomRuntime, type RoomHost, type RoomInput, type RoomParticipant } from './cave/RoomRuntime'
import { CaveLight, makeLampLight, type AmbientLevel, type LightSource } from './art/lighting'
import { BRAZIER_SPOTS } from './art/roomTextureTrial'
import { ScreenAtmosphere, GRIMM_SCREEN_STYLE } from './art/ScreenAtmosphere'
import { EmberField, makeGlowSprite } from './art/EmberField'
import type { GameEvents, UIPanelKind } from './gameEvents'
import { CONFIG } from './config'
import { sfx } from './audio/Sfx'
import { t } from '../i18n'
import { dialogue } from './dialogue/dialogueService'
import type { DialogueTree } from './dialogue/types'

const GRIMM_PORTRAIT = { src: `${import.meta.env.BASE_URL}grimm-portrait.png`, side: 'left' as const, rendering: 'pixel' as const }
const GRIMM_DIALOGUE: DialogueTree = {
  id: 'trial.grimm', start: 'silence', nodes: {
    silence: { id: 'silence', speaker: 'trial.grimm.name', text: 'trial.grimm.silence', portrait: GRIMM_PORTRAIT, next: 'arrival' },
    arrival: { id: 'arrival', speaker: 'trial.grimm.name', text: 'trial.grimm.arrival', portrait: GRIMM_PORTRAIT, next: 'begin' },
    begin: { id: 'begin', speaker: 'trial.grimm.name', text: 'trial.grimm.begin', portrait: GRIMM_PORTRAIT },
    defeated: { id: 'defeated', speaker: 'trial.grimm.name', text: 'trial.grimm.silence', portrait: GRIMM_PORTRAIT }
  }
}

/** 独立调试场景：不写探索进度，不发奖励，不调用矿洞死亡结算。 */

export class TrialModule extends CharacterModuleActions implements IGameModule {
  constructor(character:CharacterProfile,readonly localPlayers=new LocalPlayers(character)){super(character)}
  get canAddLocalPlayer():boolean{return !!this.room&&this.phase==='battle'&&!dialogue.isActive}
  debugAddLocalPlayer(appearance:PlayerAppearance):string {
    if(!this.canAddLocalPlayer)throw new Error(t('ui.local_players.not_ready'))
    const profile=new LocalProfile();profile.playerAppearance=appearance;profile.setFlag('prologue.done',true)
    const member=this.localPlayers.add(profile);this.localPlayers.ensureEntities(this.room.map,this.player,(x,y,r)=>this.room.canPlacePlayer(x,y,r))
    member.entity?.effects.add(CRIMSON_BLESSING,'trial');return member.id
  }
  debugRemoveLocalPlayer(id:string):void {if(id===this.localPlayers.primaryId)return;const member=this.localPlayers.get(id);if(member?.entity)this.room.detachPlayer(member.entity);this.localPlayers.remove(id)}
  readonly id='trial'
  player!:Player
  boss!:GrimmBoss
  private room!:RoomRuntime
  private ctx!:ModuleContext<GameEvents>
  private off:(()=>void)|null=null
  private panel:UIPanelKind|null=null
  private castRequested=false
  private castBRequested=false
  private finished=0
  private scale=1
  private ox=0
  private oy=0
  private host!:RoomHost
  private phase: 'intro' | 'battle' | 'victoryTalk' | 'victoryAnimation' | 'defeatFade' = 'intro'
  private leaving=false
  private shake=0
  private clock=0
  /** 圣堂光照贴图（火盆 + 玩家灯 + Boss 猩红气焰） */
  private caveLight:CaveLight|null=null
  /** 漂浮余烬 */
  private readonly embers=new EmberField({left:120,right:1324,top:108,bottom:874})
  /** 阶段切换红光脉冲（1→0 衰减） */
  private pulse=0
  private lastStage=1
  /** 按视口尺寸缓存的红黑暗角渐变 */
  private readonly screenAtmosphere = new ScreenAtmosphere(GRIMM_SCREEN_STYLE)
  /** 余烬软精灵（猩红/橙/金，懒加载）与火盆光晕（大号橙） */
  private static brazierGlow:HTMLCanvasElement|null=null
  captureInputState():unknown {
    if(this.phase!=='battle'||dialogue.isActive||this.panel==='inventory')throw new Error(t('ui.simulation.not_ready'))
    return {profile:this.character.captureSimulation(),party:this.localPlayers.extras.map(member=>[member.id,member.controller,member.profile.captureSimulation(),member.entity?.x,member.entity?.y,member.entity?.hp,member.entity?.alive]),player:[this.player.x,this.player.y,this.player.hp,this.player.mana,this.player.alive,this.player.debugGod,this.player.activeToolId],cast:this.castRequested,castB:this.castBRequested,enemies:this.room.snapshotEnemies.map(enemy=>[enemy.entityId,enemy.x,enemy.y,enemy.hp,enemy.alive])}
  }
  captureSimulation():unknown {
    if(this.phase!=='battle'||dialogue.isActive||this.panel==='inventory')throw new Error(t('ui.simulation.not_ready'))
    const codec=new SnapshotCodec([this.player]);this.room.bindSnapshotReferences(codec)
    this.localPlayers.bindReferences(codec)
    return {version:1,profile:this.character.captureSimulation(codec),player:this.player.captureSimulation(codec),localPlayers:this.localPlayers.capture(codec),room:this.room.captureSimulation(codec),clock:this.clock,lastStage:this.lastStage,castRequested:this.castRequested,castBRequested:this.castBRequested}
  }
  restoreSimulation(raw:unknown):void {
    const state=raw as {version:number;profile:StateFields;player:StateFields;localPlayers?:LocalPlayersSnapshot;room:RoomSnapshot;clock:number;lastStage:number;castRequested:boolean;castBRequested?:boolean}
    if(state.version!==1)throw new Error(t('ui.simulation.invalid'))
    dialogue.cancel()
    const codec=new SnapshotCodec()
    this.character.restoreSimulation(state.profile,codec)
    setPlayerAppearance(this.character.playerAppearance)
    ;(this.player as {entityId:string}).entityId=String(state.player.entityId);codec.add(this.player)
    this.localPlayers.bindPrimary(this.player);this.localPlayers.prepareRestore(state.localPlayers,codec)
    this.room.restoreSimulation(state.room,codec)
    const boss=this.room.snapshotEnemies.find(enemy=>enemy instanceof GrimmBoss)
    if(!(boss instanceof GrimmBoss))throw new Error(t('ui.simulation.invalid'))
    this.boss=boss;this.player.scp127.bind(this.character);this.player.ammoInventory=this.character.inventory
    this.player.restoreSimulation(state.player,codec,this.room.map)
    this.localPlayers.finishRestore(state.localPlayers,codec,this.room.map)
    this.room.rememberPlayers(this.localPlayers.entities)
    this.clock=state.clock;this.lastStage=state.lastStage;this.castRequested=state.castRequested;this.castBRequested=state.castBRequested??false;this.phase='battle';this.panel=null;this.leaving=false;this.finished=0
    this.ctx.bus.emit('ui:panel',null)
  }
  onEnter(ctx:ModuleContext<GameEvents>):void {
    this.ctx=ctx;this.panel=null;this.finished=0;this.leaving=false;this.castRequested=false;this.castBRequested=false;this.shake=0;this.clock=0
    this.pulse=.6;this.lastStage=1;this.phase='intro'
    sfx.setBaseMusic(false);sfx.setCampfireAmbient(false);sfx.setCaveMusic(false);sfx.setCaveAmbient(true);sfx.setTrialMusic(false)
    const w=CONFIG.roomCols*CONFIG.tile,h=CONFIG.roomRows*CONFIG.tile
    this.player=new Player(w*.5,h*.74);this.player.applyGrowth(deriveCombat(this.character.combat));this.player.hp=this.player.maxHp;this.player.mana=this.player.maxMana
    this.player.effects.add(CRIMSON_BLESSING, 'scene:grimm')
    this.equipmentChanged()
    this.room=new RoomRuntime({id:7401,sx:0,sy:0,kind:'normal',depth:0,exitDist:0,doors:[]},this.player.x,this.player.y,{theme:'grimm',noOre:true,noProps:true,spawns:[],manualClear:true,suppressAutoClear:true,noChest:true,noMonsterBurst:true})
    this.boss=new GrimmBoss(w*.5,h*.4)
    this.room.addEnemy(this.boss)
    this.localPlayers.beginScene(this.player,this.room.map,(x,y,r)=>this.room.canPlacePlayer(x,y,r))
    for(const member of this.localPlayers.extras)member.entity?.effects.add(CRIMSON_BLESSING,'trial.grimm')
    // 七只落地火盆：猩红暖光常驻（±10% 焰息由房间光源统一处理）
    for(const b of BRAZIER_SPOTS)this.room.addCustomLight(b.x,b.y-4,300,.9,'#ff8038',.24,true)
    this.initEmbers()
    this.host={inventory:this.inventory,clearEnemyBullets:(x,y,r)=>this.boss.attacks.clearBullets(x,y,r),slowEnemyBullets:(duration,multiplier)=>this.boss.attacks.slowBullets(duration,multiplier),onKill:()=>{},onMine:()=>{},requestDoor:()=>{},requestExtract:()=>this.returnToBase(),onPlayerDied:()=>{if(this.localPlayers.allDown)this.leaving=true}}
    this.off=ctx.bus.on('ui:requestPanel',kind=>{if(kind!==null&&kind!=='inventory'&&kind!=='pause')return;if(kind)for(const player of this.localPlayers.entities)player.cancelCharge();this.panel=kind;ctx.bus.emit('ui:panel',kind)})
    ctx.bus.emit('ui:panel',null);ctx.engine.input.reset()
    dialogue.registerTree(GRIMM_DIALOGUE)
    dialogue.start(GRIMM_DIALOGUE.id, 'silence', () => {
      if(this.phase!=='intro')return
      this.phase='battle';ctx.engine.input.reset();sfx.setTrialMusic(true)
    })
  }
  onExit():void {
    this.room.releaseRenderResources()
    for(const player of this.localPlayers.entities){this.room.detachPlayer(player);player.effects.clear('scene')}
    for(const player of this.localPlayers.entities)player.cancelCharge()
    this.phase='defeatFade'
    this.player.effects.clear('scene')
    this.player.tarot.clear()
    this.player.bow.clear()
    this.player.scp127.clearFlights()
    dialogue.cancel(GRIMM_DIALOGUE.id)
    this.embers.dispose();this.screenAtmosphere.reset()
this.off?.();this.off=null;this.boss.attacks.clear();this.room.clearDoomsday(this.player);sfx.setCaveAmbient(false);sfx.setTrialMusic(false);this.ctx.bus.emit('ui:panel',null)}
  returnToBase():void {this.ctx.manager.switchTo('base',{trialReturn:true})}
  protected equipmentChanged():void {
    this.player?.bindEquipment(this.equipment)
    this.player?.scp127.bind(this.character)
    if(this.player)this.player.ammoInventory=this.inventory
    const id=this.equipment.get((['weaponA','weaponB','pick'] as const)[this.character.selected])
    this.player?.setMelee(id?getItemDef(id).melee??null:null,id)
    if(this.player)this.player.equipmentCombat=passiveEquipment(this.equipment)
  }
  selectHand(index:number):void {if(this.player.isChanneling||index<0||index>2)return;this.character.selected=index;this.equipmentChanged()}
  protected discardStack(_stack:NonNullable<Slot>):boolean{return false}
  healPlayer(amount:number):number{return this.player.heal(amount)}
  consumeItem(id:string):boolean{return this.player.consumeItem(id)}
  getWeaponSkillCooldown(id:string):number{return this.player?.getWeaponSkillCooldown(id)??0}
  override get actionsLocked():boolean{return this.player?.isChanneling??false}
  override get inputBlocked():boolean{return this.phase!=='battle'||dialogue.isActive}
  requestCastSpellA():void{this.castRequested=true}
  requestCastSpellB():void{this.castBRequested=true}
  debugSetGod(value:boolean):void{if(this.player)this.player.debugGod=value}
  debugRefill():boolean{this.player.hp=this.player.maxHp;this.player.mana=this.player.maxMana;return true}
  get debugHasDoomsday():boolean{return this.equipment.get('weaponB')===DOOMSDAY_ID||this.inventory.slots.some(s=>s?.id===DOOMSDAY_ID)}
  debugGiveDoomsday():boolean{const old=this.equipment.get('weaponB');if(old!==DOOMSDAY_ID){if(old&&this.inventory.add(old,1)!==1)return false;this.equipment.set('weaponB',DOOMSDAY_ID)}this.selectHand(1);return true}
  debugReturnDoomsday():boolean{if(!this.debugHasDoomsday)return false;this.room.clearDoomsday(this.player);if(this.equipment.get('weaponB')===DOOMSDAY_ID)this.equipment.set('weaponB',null);for(let i=0;i<this.inventory.slots.length;i++)if(this.inventory.slots[i]?.id===DOOMSDAY_ID)this.inventory.removeAt(i);if(this.character.selected===1)this.character.selected=0;this.equipmentChanged();return true}
  private cast(engine:EngineContext,slot:'spellA'|'spellB'):void {
    const id=this.equipment.get(slot),spell=id?getItemDef(id).spell:null
    if(!id||!spell||!this.player.castSpell(spell))return
    this.room.resolveSpell(this.player,id,spell,engine,this.host)
  }
  handleUIInput(engine:EngineContext):void {
    const input=engine.input
    if(input.suppressed||dialogue.isActive||this.phase!=='battle')return
    if(input.actionPressed('panel'))this.ctx.bus.emit('ui:requestPanel',this.panel==='inventory'?null:'inventory')
    if(input.actionPressed('pause'))this.ctx.bus.emit('ui:requestPanel',this.panel?null:'pause')
    if(this.panel!=='pause')for(let n=0;n<3;n++)if(input.actionPressed((['hand1','hand2','hand3'] as const)[n]))this.selectHand(n)
  }
  update(dt:number,engine:EngineContext):void {
    this.player.scp127.observe(dt,this.player,dialogue.isActive||this.panel!==null&&this.panel!=='inventory'||engine.input.suppressed||this.phase==='intro'||this.phase==='victoryTalk')
    this.player.scp127.noteArena('trial',this.phase==='victoryAnimation'||this.phase==='victoryTalk')
    const i=engine.input
    if(i.suppressed){for(const player of this.localPlayers.entities)player.cancelCharge();return}
    if(i.justPressed('KeyN'))sfx.toggleMute()
    this.clock+=dt;this.shake=Math.max(0,this.shake-dt*1.8)
    this.pulse=Math.max(0,this.pulse-dt*.8)
    if(this.boss&&this.boss.alive&&this.boss.stage!==this.lastStage){this.lastStage=this.boss.stage;this.pulse=1}
    this.updateEmbers(dt)
    if(this.phase==='intro'||this.phase==='victoryTalk')return
    if(this.phase==='defeatFade'){
      this.finished+=dt
      if(this.finished>=1.8)this.returnToBase()
      return
    }
    if(this.phase==='victoryAnimation'){
      this.boss.update(dt,this.room.map,this.player)
      this.finished+=dt
      if(this.finished>=1.3)this.returnToBase()
      return
    }
    if(this.panel&&this.panel!=='inventory')return
    if(this.finishBattle())return
    if(this.panel!=='inventory')for(let n=0;n<3;n++)if(i.actionPressed((['quick1','quick2','quick3'] as const)[n]!))this.useQuickItem(n)
    if(this.panel!=='inventory'&&i.actionPressed('spellA')||this.castRequested)this.cast(engine,'spellA')
    if(this.panel!=='inventory'&&i.actionPressed('spellB')||this.castBRequested)this.cast(engine,'spellB')
    this.castRequested=false;this.castBRequested=false
    const pointer=i.resolveWorldPointer((i.mouseX-this.ox)/this.scale,(i.mouseY-this.oy)/this.scale,this.player)
    const input:RoomInput={...readPlayerIntent(i,pointer.x,pointer.y,this.panel!=='inventory'),interactPressed:false}
    // 命中顿帧：Boss/弹幕/特效冻结，玩家时钟独立（攻速与移动不被拖慢）
    const wdt=engine.worldDt(dt)
    this.localPlayers.bindPrimary(this.player);this.localPlayers.ensureEntities(this.room.map,this.player,(x,y,r)=>this.room.canPlacePlayer(x,y,r))
    const commands=this.localPlayers.readCommands(i,this.ctx.manager.simulation.tick)
    const members:RoomParticipant[]=[{player:this.player,input,host:this.host}]
    for(const member of this.localPlayers.extras)if(member.entity){
      const player=member.entity,host:RoomHost={...this.host,inventory:member.profile.inventory}
      const command=commands.find(command=>command.playerId===member.id)??idlePlayerCommand(member.id,player.x,player.y,player.facing)
      this.localPlayers.apply(member,command,engine,this.room,host);player.scp127.observe(dt,player)
      members.push({player,input:command,host})
    }
    this.room.updatePlayers(wdt,engine,members,dt)
    if(this.finishBattle())return
    if(this.boss.alive)this.boss.attacks.updatePlayers(wdt,this.localPlayers.entities,this.room.map,engine,this.room.fx,this.room.projectileBlockers)
    if(this.finishBattle())return
    this.shake=Math.min(1,this.shake+engine.shakeAmount);engine.shakeAmount=0
  }
  /** 结局只触发一次；对话期间暂停死亡计时，结束后再播放原有退场动画。 */
  private finishBattle():boolean {
    if(this.phase!=='battle')return true
    if(this.localPlayers.allDown||this.leaving){
      this.ctx.bus.emit('ui:inventoryReturn', undefined)
      this.panel=null;this.ctx.bus.emit('ui:panel',null)
      this.phase='defeatFade';this.finished=0;sfx.setTrialMusic(false)
      this.boss.attacks.clear();this.ctx.engine.input.reset();return true
    }
    if(!this.boss.alive){
      this.phase='victoryTalk';this.finished=0;sfx.setTrialMusic(false)
      this.boss.attacks.clear();this.boss.dying=1.2
      this.panel=null;this.ctx.bus.emit('ui:panel',null);this.ctx.engine.input.reset()
      dialogue.start(GRIMM_DIALOGUE.id,'defeated',()=>{
        if(this.phase!=='victoryTalk')return
        this.phase='victoryAnimation';this.boss.dying=1.2;this.ctx.engine.input.reset()
      })
      return true
    }
    return false
  }
  /** 首领界面独立于场景画布，CSS 动画不参与战斗时钟与快照。 */
  getBossHudState():import('../shared/bossHud').BossHudState|null {
    if(!this.boss||this.phase==='intro'||this.phase==='defeatFade')return null
    return {id:'grimm',nameKey:'trial.grimm.name',hp:this.boss.hp,maxHp:this.boss.maxHp,stage:this.boss.stage,
      threshold:.55,defeated:!this.boss.alive,invulnerable:this.boss.state==='break'||this.boss.stage===2,
      guardian:false,...(this.boss.isTimeSpell?{spell:{nameKey:'trial.time_spell_name',remaining:this.boss.spellRemaining}}:{})}
  }
  render(g:CanvasRenderingContext2D,e:EngineContext):void {
    const w=CONFIG.roomCols*CONFIG.tile,h=CONFIG.roomRows*CONFIG.tile
    // 全屋可见，顶部预警和出生点不因相机裁剪消失。
    this.scale=Math.min(e.viewW/w,(e.viewH-(compactLayout.value?55:90))/h);this.ox=(e.viewW-w*this.scale)/2;this.oy=compactLayout.value?48:65
    g.fillStyle='#0a0408';g.fillRect(0,0,e.viewW,e.viewH);g.save();g.translate(this.ox+Math.sin(this.clock*83)*this.shake*5,this.oy+Math.cos(this.clock*71)*this.shake*4);g.scale(this.scale,this.scale)
    this.room.renderPlayers(g,this.localPlayers.entities,this.player)
    this.renderWorldAtmosphere(g,e)
    for(const player of this.localPlayers.entities){this.room.renderDoomsday(g,player);player.renderDoomCrescents(g,'all');player.scp127.renderOverlay(g,player)}
    this.localPlayers.renderLabels(g);g.restore()
    this.renderScreenAtmosphere(g,e)
    // 危险弹幕在场景压色之后绘制，亮边不能被红黑暗角再次染暗。
    g.save();g.translate(this.ox+Math.sin(this.clock*83)*this.shake*5,this.oy+Math.cos(this.clock*71)*this.shake*4);g.scale(this.scale,this.scale)
    this.boss.attacks.render(g,this.room.map);g.restore()
    renderNausea(g,e.viewW,e.viewH,this.player)
    renderHurtScreen(g,e.viewW,e.viewH,this.player)
    g.save()
    if(this.phase==='defeatFade'){
      const k=Math.min(1,this.finished/1.8)
      g.fillStyle=`rgba(0,0,0,${k*k*(3-2*k)})`;g.fillRect(0,0,e.viewW,e.viewH)
    }
    if(!this.panel&&this.phase==='battle'){g.strokeStyle='#e6d6ed';g.beginPath();g.arc(e.input.mouseX,e.input.mouseY,6,0,Math.PI*2);g.stroke()}
    g.restore()
  }

  // ================= 猩红圣堂氛围 =================

  private initEmbers():void {this.embers.reset()}
  private updateEmbers(dt:number):void {this.embers.update(dt)}

  /** 世界空间氛围：暗红酒黑压暗罩（火盆/玩家灯/Boss 气焰挖光）→ 火盆焰体 → 漂浮余烬 */
  private renderWorldAtmosphere(g:CanvasRenderingContext2D,e:EngineContext):void {
    if(CONFIG.art.slice){
      this.caveLight??=new CaveLight(e.viewW,e.viewH)
      this.caveLight.resize(e.viewW,e.viewH)
      const breath=.022*Math.sin(this.clock*.7)
      const ambient:AmbientLevel={
        center:Math.max(.14,.6+breath-this.pulse*.3),
        edge:Math.min(.97,.9+breath*.6-this.pulse*.16),
        cc:'18,5,9',ec:'4,1,3'
      }
      // 玩家可视光圈：略收窄换压迫感，色温转暖与火盆统一
      const lamp=makeLampLight(this.player.x,this.player.y)
      lamp.r*=.92;lamp.color='#ffd6b2';lamp.tint=.08
      const sources:LightSource[]=[lamp,...this.localPlayers.extras.flatMap(member=>member.entity?.alive?[makeLampLight(member.entity.x,member.entity.y)]:[]),...this.room.getRoomLights()]
      // Boss 本体是一团呼吸的猩红气焰光源
      if(this.boss.alive)sources.push({x:this.boss.x,y:this.boss.y,r:172,power:.5+.08*Math.sin(this.clock*5.3),color:'#ff5230',tint:.22})
      this.caveLight.render(g,0,0,this.scale,ambient,sources)
    }
    this.renderBraziers(g)
    this.renderEmbers(g)
  }

  /** 七只落地火盆动态焰体：加色光晕用缓存精灵，焰心为暗红外焰→橙→金→暖白四层水滴。 */
  private renderBraziers(g:CanvasRenderingContext2D):void {
    TrialModule.brazierGlow??=makeGlowSprite('255,120,52',64)
    const glow=TrialModule.brazierGlow
    g.save()
    g.globalCompositeOperation='lighter'
    for(const s of BRAZIER_SPOTS){
      const fl=.9+.08*Math.sin(this.clock*11+s.seed*2.1)+.04*Math.sin(this.clock*17.3+s.seed)
      const sway=Math.sin(this.clock*3.4+s.seed)*1.6
      const gs=46*fl
      g.globalAlpha=.5*fl
      g.drawImage(glow,s.x+sway-gs/2,s.y-8-gs/2,gs,gs)
    }
    g.globalAlpha=1
    g.restore()
    const drop=(ww:number,hh:number,col:string):void=>{
      g.fillStyle=col
      g.beginPath()
      g.moveTo(0,-hh)
      g.bezierCurveTo(ww*.95,-hh*.5,ww*.5,-hh*.08,0,0)
      g.bezierCurveTo(-ww*.5,-hh*.08,-ww*.95,-hh*.5,0,-hh)
      g.closePath();g.fill()
    }
    for(const s of BRAZIER_SPOTS){
      const fl=Math.max(.72,.9+.08*Math.sin(this.clock*11+s.seed*2.1)+.04*Math.sin(this.clock*17.3+s.seed))
      const sway=Math.sin(this.clock*3.4+s.seed)*1.6
      g.save();g.translate(s.x+sway,s.y-2)
      drop(5.6*fl,16*fl,'#d83a20')
      drop(4.6*fl,13.5*fl,'#ff6a2a')
      drop(3*fl,9.5*fl,'#ffb244')
      drop(1.6*fl,6*fl,'#fff2bc')
      g.restore()
    }
  }

  /** 漂浮余烬：加色软精灵，各自闪烁频率 + 左右轻摆 + 近大远小景深。 */
  private renderEmbers(g:CanvasRenderingContext2D):void {
    this.embers.render(g,this.clock)
  }

  /** 屏幕空间氛围：红黑暗角 + 极慢猩红呼吸 + 阶段切换以 Boss 为中心的红光脉冲。 */
  private renderScreenAtmosphere(g:CanvasRenderingContext2D,e:EngineContext):void {
    this.screenAtmosphere.render(g,e.viewW,e.viewH,this.clock,this.pulse,
      this.ox+this.boss.x*this.scale,this.oy+this.boss.y*this.scale)
  }
  getHudState():Record<string,unknown>{const p=this.player,c=this.character.combat;return {scene:'trial',x:p.x,y:p.y,hp:p.hp,hpRatio:p.hpRatio,mana:p.mana,manaRatio:p.manaRatio,spellCd:p.spellCdRatio,alive:p.alive,selected:this.character.selected,panel:this.panel,speed:p.speedNow,swing:p.swingPhase,dodge:p.dodgePhase==='none'?'ready':p.dodgePhase==='short'?'roll':'lunge',dodgeCd:p.dodgeCdRatio,iFrame:p.isInvincible,enemiesAlive:this.boss.alive?1:0,enemiesTotal:1,roomsCleared:0,roomsTotal:1,depth:0,roomKind:'normal',roomId:7401,prologue:false,kills:0,oresLeft:0,dropsOnGround:0,level:c.level,exp:c.exp,expNeed:expNeeded(c.level),unspentPoints:c.unspentPoints,round:this.character.round}}
}
