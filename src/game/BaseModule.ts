import { setPlayerAppearance } from '../shared/playerAppearance'
import { settleSearchRewards } from '../shared/searchRewards'
import { drawShrubPot, SHRUB_SPOT, drawWardrobeRack, WARDROBE_SPOT } from './art/campCollectibles'
import { WARDROBE_BUILT } from '../content/story/sidequests/wardrobe/state'
import { withSimulationAppearance, withPlayerCostume, type PlayerAppearance } from '../shared/playerAppearance'
import { LocalPlayers, type LocalPlayersSnapshot } from './simulation/LocalPlayers'
import { CharacterProfile as LocalProfile } from '../shared/profile'
import { SnapshotCodec, type StateFields } from '../core/simulation/snapshot'
import type { IGameModule, ModuleContext } from '../core/module'
import type { EngineContext } from '../core/types'
import { saveService } from '../core/save/saveService'
import type { CharacterProfile } from '../shared/profile'
import { CharacterModuleActions } from '../shared/moduleActions'
import type { Slot } from '../shared/inventory'
import { deriveCombat, expNeeded,passiveEquipment } from '../shared/combat'
import { getItemDef } from '../shared/itemDefs'
import { itemCarryRules } from '../shared/itemCarryRules'
import { DOOMSDAY_ID } from '../content/items/vanilla/ids'
import type { GameEvents, UIPanelKind } from './gameEvents'
import { Player } from './Player'
import { touchControls, compactLayout } from '../browser/display'
import { renderNausea } from './art/nauseaScreen'
import { renderHurtScreen } from './art/hurtScreen'
import { TileMap } from './tilemap'
import { PlayerAnimator } from './art/rig/playerAnims'
import { drawReimuRig } from './art/rig/reimuRig'
import { CAMP_ENTITIES, CAMP_FACILITIES, CAMP_NPC_ANCHOR, CAMP_SCENERY_SOLIDS, campInside, campContainsCircle, drawCampGround, drawCampEntity, drawCampShadow, drawCampAtmosphere } from './art/campScene'
import { loadCampArtwork, campArtworkRevision, campArtworkReady } from './art/campArtwork'
import type { CampEntity } from './art/campScene'
import { tutorial } from './dialogue/tutorial'
import { sfx } from './audio/Sfx'
import { dialogue } from './dialogue/dialogueService'
import { registerDialogueAction } from './dialogue/effects'
import { PROLOGUE_TREE, PNODE } from '../content/story/prologue/dialogues'
import { FIRST_DEATH_TREE } from '../content/story/events/first-death/dialogues'
import { drawPlayerRig } from './art/rig/playerRig'
import { acceptCookingQuest } from '../content/story/mainline/camp-soup/transactions'
import { t, itemName, formatKeyBindings } from '../i18n'
import { canEnterMineFloor } from '../shared/mineFloors'
import { materialCount, furnaceStage, CRAFT_RECIPES } from '../shared/production'
import { ROCK_SALT_ID } from '../content/items/vanilla/ids'
import { playNextStory, hasAvailableStory, type StoryContext } from './story/storyDirector'
import { drawFurnaceState, drawWorktableTools, drawCraftMarker } from './art/workshopScene'
import { rememberGelReturn } from '../content/story/sidequests/crafting/tetanus'
import {rememberIronWork} from '../content/story/sidequests/crafting/ironWork'
import { FourthCampScene, RUMIA_CAMP } from './story/FourthCampScene'
import { FOURTH_FLAGS } from '../content/story/mainline/fourth-rescue/state'
import { discoverCarried } from '../shared/discovery'
import { refreshCulinaryProgress } from '../content/story/sidequests/culinary/state'
import { drawCampGrill } from './art/campGrill'

// 家具定义固定；预建收音机和衣架的占地组合，不在移动时反复筛选与分配数组。
const CAMP_WITHOUT_RADIO = CAMP_ENTITIES.filter(entity => entity.kind !== 'radio')
const CAMP_SOLID = [...CAMP_FACILITIES.flatMap(facility => facility.parts).filter(entity => entity.w > 0), ...CAMP_SCENERY_SOLIDS.map(rock=>({...rock,kind:'rock'}))]
const CAMP_SOLID_WITHOUT_RADIO = CAMP_SOLID.filter(entity => entity.kind !== 'radio')
const CAMP_SOLID_WITH_RACK = [...CAMP_SOLID,WARDROBE_SPOT]
const CAMP_SOLID_NO_RADIO_WITH_RACK = [...CAMP_SOLID_WITHOUT_RADIO,WARDROBE_SPOT]
const CAMP_FACILITIES_WITHOUT_RADIO = CAMP_FACILITIES.filter(facility => facility.kind !== 'radio')
const CAMP_BED = CAMP_ENTITIES.find(entity=>entity.kind==='bed')!
const CAMP_ROPE = CAMP_ENTITIES.find(entity=>entity.kind==='rope')!
const CAMP_TABLE = CAMP_ENTITIES.find(entity=>entity.kind==='table')!
const CAMP_FIRE = CAMP_ENTITIES.find(entity=>entity.kind==='fire')!
const CAMP_POT = CAMP_ENTITIES.find(entity=>entity.kind==='pot')!

/** 家具使用分轴占地碰撞，岩壁额外按实际轮廓约束角色碰撞圆。 */
class CampMap extends TileMap {
  /** 收音机占地碰撞是否生效：未解锁前它在场景中不存在，解锁当帧由 BaseModule 置 true */
  radioSolid = false
  wardrobeSolid = false
  get colliders(){
    if(this.wardrobeSolid)return this.radioSolid?CAMP_SOLID_WITH_RACK:CAMP_SOLID_NO_RADIO_WITH_RACK
    return this.radioSolid?CAMP_SOLID:CAMP_SOLID_WITHOUT_RADIO
  }
  override isSolid(col:number,row:number):boolean {
    const x=(col+0.5)*this.tile,y=(row+0.5)*this.tile
    return !campInside(x,y)||(x>CAMP_ROPE.x-CAMP_ROPE.w/2&&x<CAMP_ROPE.x+CAMP_ROPE.w/2&&y<CAMP_ROPE.y+3)
  }
  override moveEntity(e: Parameters<TileMap['moveEntity']>[0],dt:number):void {
    const oldX=e.x,oldY=e.y
    super.moveEntity(e,dt)
    const targetX=e.x,targetY=e.y
    e.y=oldY
    const colliders = this.colliders
    // 收音机未解锁前无碰撞；解锁后按实体占地参与分轴阻挡
    for(const p of colliders){
      if(!p.w)continue
      const l=p.x-p.w/2,r=p.x+p.w/2,t=p.y-p.d,b=p.y
      if(e.y+e.r>t&&e.y-e.r<b&&e.x+e.r>l&&e.x-e.r<r)e.x=oldX<=p.x?l-e.r:r+e.r
    }
    const resolvedX=e.x
    e.y=targetY
    for(const p of colliders){
      if(!p.w)continue
      const l=p.x-p.w/2,r=p.x+p.w/2,t=p.y-p.d,b=p.y
      if(e.x+e.r>l&&e.x-e.r<r&&e.y+e.r>t&&e.y-e.r<b)e.y=oldY<=t+p.d/2?t-e.r:b+e.r
    }
    if(resolvedX!==targetX)e.vx=0
    if(e.y!==targetY)e.vy=0
    const wantedX=e.x,wantedY=e.y
    e.x=oldX;e.y=oldY
    // 小步检查整个移动路径，避免掉帧时跨过凹角或薄边界。
    const steps=Math.max(1,Math.ceil(Math.hypot(wantedX-oldX,wantedY-oldY)/Math.max(1,e.r/2)))
    const dx=(wantedX-oldX)/steps,dy=(wantedY-oldY)/steps
    for(let i=0;i<steps;i++){
      if(campContainsCircle(e.x+dx,e.y,e.r))e.x+=dx
      else e.vx=0
      if(campContainsCircle(e.x,e.y+dy,e.r))e.y+=dy
      else e.vy=0
    }
  }
}
const REIMU={...CAMP_NPC_ANCHOR,title:'base.reimu.name',text:'base.reimu.text'}
export class BaseModule extends CharacterModuleActions implements IGameModule {
  readonly id='base'
  private ctx!:ModuleContext<GameEvents>
  player!:Player
  private map!:CampMap
  private panel:UIPanelKind|null=null
  private offPanel:(()=>void)|null=null
  private offFloor:(()=>void)|null=null
  private time=0
  private message=''
  private messageTime=0
  private recipeNotices:string[]=[]
  private recipeNotice=''
  private recipeNoticeTime=0
  private animator=new PlayerAnimator()
  private scale=1
  private offsetX=0
  private offsetY=0
  private ground:HTMLCanvasElement|null=null
  private entitySprites = new Map<string, HTMLCanvasElement>()
  private artworkRevision = -1
  private arrivalTime=-1
  private arrivalTalk=false
  private deathStage:'none'|'black'|'wake'|'fade'|'talk'='none'
  private deathTime=0
  private storageFlights:Array<{id:string;start:number;x:number;y:number;tx:number;ty:number}>=[]
  private flightIcons=new Map<string,HTMLImageElement>()
  get worldBlurPx():number{return this.arrivalTime<0?0:14*Math.pow(1-Math.min(1,this.arrivalTime/1.15),3)}
  constructor(character:CharacterProfile,readonly localPlayers=new LocalPlayers(character)){super(character)}
  getWeaponSkillCooldown(id:string):number {return this.player?.getWeaponSkillCooldown(id)??0}
  get canAddLocalPlayer():boolean {return !!this.player&&this.arrivalTime<0&&this.deathStage==='none'&&!dialogue.isActive&&!this.fourth?.blocking}
  debugAddLocalPlayer(appearance:PlayerAppearance):string {
    if(!this.canAddLocalPlayer)throw new Error(t('ui.local_players.not_ready'))
    const profile=new LocalProfile();profile.playerAppearance=appearance;profile.setFlag('prologue.done',true)
    const member=this.localPlayers.add(profile);this.localPlayers.ensureEntities(this.map,this.player);return member.id
  }
  debugRemoveLocalPlayer(id:string):void {this.localPlayers.remove(id)}
  private storyContext!:StoryContext
  private fourth: FourthCampScene | null = null
  captureInputState():unknown {
    if(dialogue.isActive||this.arrivalTime>=0||this.deathStage!=='none'||this.fourth?.blocking||this.panel==='inventory')throw new Error(t('ui.simulation.not_ready'))
    return {profile:this.character.captureSimulation(),party:this.localPlayers.extras.map(member=>[member.id,member.controller,member.profile.captureSimulation(),member.entity?.x,member.entity?.y,member.entity?.hp,member.entity?.alive]),player:[this.player.x,this.player.y,this.player.hp,this.player.mana,this.player.alive,this.player.debugGod,this.player.activeToolId],}
  }
  captureSimulation():unknown {
    if(dialogue.isActive||this.arrivalTime>=0||this.deathStage!=='none'||this.fourth?.blocking||this.panel==='inventory')throw new Error(t('ui.simulation.not_ready'))
    const codec=new SnapshotCodec([this.player])
    this.localPlayers.bindReferences(codec)
    return {version:1,profile:this.character.captureSimulation(codec),player:this.player.captureSimulation(codec),localPlayers:this.localPlayers.capture(codec),time:this.time}
  }
  restoreSimulation(raw:unknown):void {
    const state=raw as {version:number;profile:StateFields;player:StateFields;localPlayers?:LocalPlayersSnapshot;time:number}
    if(state.version!==1)throw new Error(t('ui.simulation.invalid'))
    dialogue.cancel();tutorial.dismiss()
    const codec=new SnapshotCodec()
    this.character.restoreSimulation(state.profile,codec)
    this.map.wardrobeSolid=this.character.flagBool(WARDROBE_BUILT)
    setPlayerAppearance(this.character.playerAppearance)
    ;(this.player as {entityId:string}).entityId=String(state.player.entityId);codec.add(this.player)
    this.localPlayers.bindPrimary(this.player);this.localPlayers.prepareRestore(state.localPlayers,codec)
    this.player.scp127.bind(this.character);this.player.ammoInventory=this.character.inventory
    this.player.restoreSimulation(state.player,codec,this.map)
    this.localPlayers.finishRestore(state.localPlayers,codec,this.map)
    this.time=state.time;this.panel=null;this.deathStage='none';this.arrivalTime=-1;this.arrivalTalk=false
    this.queueRecipeNotices()
    this.ctx.bus.emit('ui:panel',null)
  }
  onEnter(ctx:ModuleContext<GameEvents>,payload?:unknown):void {
    this.ctx=ctx
    void loadCampArtwork()
    this.entitySprites.clear()
    sfx.setCaveAmbient(false)
    sfx.setCaveMusic(false)
    sfx.setCampfireAmbient(true)
    this.map=new CampMap({spawnCol:14,spawnRow:11,oreRange:[0,0],roomKind:'start',depth:0,floor:0,doors:[]})
    // 已解锁的收音机进基地即带占地碰撞
    this.map.radioSolid=this.character.flagBool('base.radio.unlocked')
    this.map.wardrobeSolid=this.character.flagBool(WARDROBE_BUILT)
    this.player=new Player(690,550)
    this.player.applyGrowth(deriveCombat(this.character.combat))
    this.load((payload as {arrival?:boolean;trialReturn?:boolean}|undefined)?.arrival||(payload as {trialReturn?:boolean}|undefined)?.trialReturn?null:this.character.location.basePosition)
    this.equipmentChanged();this.panel=null;this.messageTime=0
    this.localPlayers.beginScene(this.player,this.map)
    if((payload as {extracted?:boolean}|undefined)?.extracted)for(const player of this.localPlayers.entities)player.scp127.say('extract')
    ctx.bus.emit('ui:panel',null)
    this.offPanel=ctx.bus.on('ui:requestPanel',kind=>this.setPanel(kind))
    this.offFloor=ctx.bus.on('base:enterFloor',({floor})=>{
      if(this.panel==='floors')this.enterMineFloor(floor)
    })
    this.ground=null
    this.arrivalTime=(payload as {trialReturn?:boolean}|undefined)?.trialReturn?-1:((payload as {prologue?:boolean}|undefined)?.prologue||this.character.flagBool('prologue.campPending'))?0:-1;this.arrivalTalk=false
    if(this.arrivalTime===0){this.player.x=1120;this.player.y=570}
    const entry=payload as {explorationDeath?:boolean;trialReturn?:boolean}|undefined
    this.deathStage=entry?.explorationDeath&&!entry.trialReturn&&!this.character.flagBool('story.firstDeath.seen')?'black':'none'
    this.deathTime=0
    if(this.deathStage!=='none'){this.arrivalTime=-1;this.player.x=CAMP_BED.x;this.player.y=CAMP_BED.y-25;tutorial.dismiss()}
    const hadCookingQuest=this.character.flagBool('quest.reimu.cooking.accepted')
    acceptCookingQuest(this.character)
    if(!hadCookingQuest&&this.character.flagBool('quest.reimu.cooking.accepted')){this.message=t('quest.reimu_cooking.accepted',{name:t('quest.reimu_cooking.name')});this.messageTime=10}
    this.storageFlights=[]
    const extracted=(payload as {arrival?:boolean;extracted?:boolean}|undefined)?.extracted===true&&this.arrivalTime<0
    for(const member of this.localPlayers.all)settleSearchRewards(member.profile,(payload as {extracted?:boolean}|undefined)?.extracted===true)
    if(extracted){for(const member of this.localPlayers.all)discoverCarried(member.profile);this.depositMaterials(2300,95)}
    this.queueRecipeNotices()
    this.storyContext={profile:this.character,data:{fromFloor:extracted?(payload as {fromFloor?:number}|undefined)?.fromFloor:undefined}}
    rememberGelReturn(this.character)
    rememberIronWork(this.character)
    const wasMisoAvailable=this.character.flagBool('quest.miso.available')
    refreshCulinaryProgress(this.character,extracted||entry?.explorationDeath===true)
    if(!wasMisoAvailable&&this.character.flagBool('quest.miso.available')&&!extracted)void saveService.persistStoryFlag('quest.miso.available')
    this.fourth = this.character.flagBool(FOURTH_FLAGS.rescued) ? new FourthCampScene(this.character, this.player, () => ctx.engine.input.reset()) : null
    if(this.fourth?.blocking)tutorial.dismiss()
    // 旧档已带回岩盐时补接剧情，不要求重复跑完一次二层。
    if(this.character.deepestDepth>=2&&materialCount(this.character,ROCK_SALT_ID)>0)this.character.setFlag('story.secondFloor.returned',true)
    // 基地剧情动作（每次进基地重登：闭包绑定当前实例与事件总线，覆盖旧实例注册）
    registerDialogueAction('base.prologueStore',()=>this.depositMaterials(120,70))
    registerDialogueAction('base.radioReady',()=>{
      // 解锁当帧实体落地：占地碰撞同步生效，清地面缓存让阴影参与重建，随后正式开 BGM 并弹曲目 toast
      this.map.radioSolid=true
      this.ground=null
      sfx.setBaseMusic(true)
      this.ctx.bus.emit('base:now-playing',sfx.baseTrackName)
    })
    // 持久交互教学（序章 arrival 段不弹；首次撤离时让到收音机剧结束后再弹，避免与对白同屏）
    const showBaseTutorial=()=>{if(!this.fourth?.blocking&&this.deathStage==='none'&&this.arrivalTime<0&&this.character.flagBool('prologue.done')&&!this.character.flagBool('tutorial.base.interacted'))tutorial.show('base.tutorial.interact',{durationMs:2147483647})}
    // 收音机：已解锁则回家即响；首次正常撤离在归仓后播发现小剧（剧末落 flag 并开 BGM）
    if(this.character.flagBool('base.radio.unlocked')){
      sfx.setBaseMusic(true)
      ctx.bus.emit('base:now-playing',sfx.baseTrackName)
      showBaseTutorial()
    } else if(extracted && !this.fourth?.blocking){
      playNextStory('camp.extracted',this.storyContext,{onEnd:showBaseTutorial})
    } else showBaseTutorial()
    this.character.location.scene='base';this.save()
    // 安全撤离回基地：归仓飞行结算后落 autosave（死亡回基地不写，保持下矿前存档点）
    if((payload as {extracted?:boolean}|undefined)?.extracted)void saveService.autosave()
  }
  onExit():void{this.deathStage='none';for(const player of this.localPlayers.entities){player.effects.clear('scene');player.cancelCharge()}dialogue.cancel();this.save();this.offPanel?.();this.offPanel=null;this.offFloor?.();this.offFloor=null;tutorial.dismiss();sfx.setBaseMusic(false);sfx.setCampfireAmbient(false);this.ctx.bus.emit('ui:panel',null)}
  /** 图鉴是配方解锁的唯一材料依据；通知仅在回营后播放，不插入额外剧情。 */
  private queueRecipeNotices():void {
    this.recipeNotice='';this.recipeNoticeTime=0
    this.recipeNotices=CRAFT_RECIPES.filter(recipe=>recipe.discovery?.every(id=>this.character.discovery.items.has(id))&&!this.character.flagBool(`recipe.discovery.${recipe.id}.announced`)).map(recipe=>recipe.id)
  }
  private updateRecipeNotice(dt:number):void {
    // 入场、对白和面板遮挡时保留通知，等玩家真正能看见再计时。
    if(this.panel||dialogue.isActive||this.deathStage!=='none'||this.arrivalTime>=0||this.fourth?.blocking)return
    this.recipeNoticeTime=Math.max(0,this.recipeNoticeTime-dt)
    if(this.recipeNoticeTime>0)return
    const id=this.recipeNotices.shift()
    if(!id){this.recipeNotice='';return}
    this.recipeNotice=t('ui.production.discovery_unlocked',{name:itemName(id)});this.recipeNoticeTime=4
    const flag=`recipe.discovery.${id}.announced`
    this.character.setFlag(flag,true)
    void saveService.persistStoryFlag(flag)
  }
  save():{x:number;y:number}{const p={x:this.player.x,y:this.player.y};this.character.location.basePosition=p;return p}
  load(slice:unknown|null):void {
    const p=slice as {x?:number;y?:number}|null
    const colliders=this.map.colliders
    if(typeof p?.x==='number'&&typeof p.y==='number'&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&campContainsCircle(p.x,p.y,this.player.hitR)&&!this.map.isSolid(Math.floor(p.x/this.map.tile),Math.floor(p.y/this.map.tile))&&!colliders.some(e=>e.w&&p.x!>e.x-e.w/2-12&&p.x!<e.x+e.w/2+12&&p.y!>e.y-e.d-12&&p.y!<e.y+12)){this.player.x=p.x;this.player.y=p.y}
  }
  get npcAnchor():{x:number;y:number}{return {x:this.offsetX+(REIMU.x+32)*this.scale,y:this.offsetY+(REIMU.y-58)*this.scale}}
  /** 当前可见实体：收音机未在剧情中解锁前不存在（不画／不投影／不可交互） */
  private get visibleEntities():CampEntity[]{
    return this.character.flagBool('base.radio.unlocked') ? CAMP_ENTITIES : CAMP_WITHOUT_RADIO
  }
  /**
   * 只把背包里的素材入仓，道具栏保留玩家配置，并为每堆排一条抛物飞行演出。
   * @param baseDelay 首条飞行起飞延迟（ms）：撤离归仓等落位约 2.3s，序章对白里几乎即起
   * @param gap 相邻两堆起飞间隔（ms）
   */
  private depositMaterials(baseDelay:number,gap:number):void{
    const inv=this.character.inventory
    for(let i=0;i<inv.slots.length;i++){
      const stack=inv.slots[i];if(!stack||!itemCarryRules(stack.id).autoStore)continue
      const stored=this.character.storage.add(stack.id,stack.qty,stack.durability)
      if(stored){
        const box=CAMP_ENTITIES.filter(e=>e.kind==='box')[this.storageFlights.length%3]
        this.storageFlights.push({id:stack.id,start:(this.time*1000)+baseDelay+this.storageFlights.length*gap,x:this.player.x,y:this.player.y-26,tx:box.x,ty:box.y-28})
        if(!this.flightIcons.has(stack.id)){
          const icon=getItemDef(stack.id).icon,img=new Image()
          img.src=icon.type==='svg'?`data:image/svg+xml;charset=utf-8,${encodeURIComponent(icon.svg)}`:icon.src
          this.flightIcons.set(stack.id,img)
        }
        stack.qty-=stored;if(stack.qty===0)inv.slots[i]=null
      }
    }
  }
  private setPanel(kind:UIPanelKind|null):void{if(kind==='wardrobe'&&!this.character.flagBool(WARDROBE_BUILT))return;if(this.fourth?.blocking||kind==='floors'&&this.fourth?.blockDeparture())return;if(kind==='map'||this.deathStage!=='none'||this.arrivalTime>=0||dialogue.isActive||kind==='floors'&&!canEnterMineFloor(this.character,2)||kind==='crafting'&&!this.character.flagBool('base.crafting.unlocked')||kind==='furnace'&&!this.character.flagBool('base.furnace.inspected'))return;this.panel=kind;if(kind)this.messageTime=0;this.ctx.bus.emit('ui:panel',kind);this.save()}
  private playProgressStory():boolean{
    if(this.ctx.manager.transitioning||this.panel||dialogue.isActive||this.arrivalTime>=0||!this.character.flagBool('quest.reimu.cooking.done'))return false
    const started=playNextStory('camp.idle',this.storyContext,{onEnd:scene=>{
      if(scene.notification){this.message=t(scene.notification);this.messageTime=6}
    }})
    if(started)tutorial.dismiss()
    return started
  }
  /** 首件时装带回后独立触发，不要求先完成任何料理或铁器任务。 */
  private playWardrobeStory():boolean {
    if(this.ctx.manager.transitioning||this.panel||dialogue.isActive||this.arrivalTime>=0||this.deathStage!=='none'||this.fourth?.blocking)return false
    const started=playNextStory('camp.wardrobe',this.storyContext,{onEnd:scene=>{
      this.map.wardrobeSolid=this.character.flagBool(WARDROBE_BUILT)
      // 衣架生成时若有人站在底脚处，轻推到正前方，避免读档后陷在家具里。
      for(const player of this.localPlayers.entities)if(Math.abs(player.x-WARDROBE_SPOT.x)<WARDROBE_SPOT.w/2+player.half&&player.y+player.half>WARDROBE_SPOT.y-WARDROBE_SPOT.d&&player.y-player.half<WARDROBE_SPOT.y){player.y=WARDROBE_SPOT.y+player.half+4;player.vx=player.vy=0}
      if(scene.notification){this.message=t(scene.notification);this.messageTime=6}
      this.save()
    }})
    if(started)tutorial.dismiss()
    return started
  }
  private playFacilityStory():boolean{
    if(this.panel||dialogue.isActive||this.arrivalTime>=0||this.deathStage!=='none'||this.fourth?.blocking)return false
    if(!hasAvailableStory('camp.fire',this.storyContext)&&!hasAvailableStory('camp.pot',this.storyContext))return false
    const points=[{point:CAMP_FIRE,event:'camp.fire'},{point:CAMP_POT,event:'camp.pot'}].sort((a,b)=>Math.hypot(a.point.x-this.player.x,a.point.y-this.player.y)-Math.hypot(b.point.x-this.player.x,b.point.y-this.player.y))
    for(const {point,event} of points)if(Math.hypot(point.x-this.player.x,point.y-this.player.y)<85&&playNextStory(event,this.storyContext,{onEnd:scene=>{if(scene.notification){this.message=t(scene.notification);this.messageTime=6}}}))return true
    return false
  }
  private interactWorktable():void{
    if(playNextStory('camp.worktable',this.storyContext,{onEnd:()=>{this.entitySprites.delete('table');this.interactWorktable()}}))return
    if(this.character.flagBool('base.crafting.unlocked')){this.setPanel('crafting');return}
    this.message=t('base.table.text');this.messageTime=5
  }
  private interactFurnace():void{
    if(this.character.flagBool('base.furnace.inspected')){this.setPanel('furnace');return}
    if(playNextStory('camp.furnace',this.storyContext,{onEnd:()=>this.setPanel('furnace')}))return
    this.message=t('base.stove.text');this.messageTime=5
  }
  private enterMineFloor(floor:number):void{
    if (this.fourth?.blockDeparture()) return
    if(this.ctx.manager.transitioning||dialogue.isActive||!canEnterMineFloor(this.character,floor))return
    if(hasAvailableStory('camp.departure',this.storyContext)){
      this.setPanel(null)
      if(playNextStory('camp.departure',this.storyContext,{onEnd:()=>this.enterMineFloor(floor)}))return
    }
    this.character.setFlag('mine.lastFloor',floor)
    this.setPanel(null);this.save();void saveService.autosave()
    this.ctx.manager.transitionTo('cave',{mode:'normal',floor})
  }
  healPlayer(amount:number):number{return this.player.heal(amount)}
  consumeItem(id:string):boolean{return this.player.consumeItem(id)}
  override selectCostume(costume:'default'|'old_miner'):boolean {
    if(!super.selectCostume(costume))return false
    this.player.costume=costume;return true
  }
  override get actionsLocked():boolean{return this.player?.isChanneling??false}
  override get inputBlocked():boolean{return this.arrivalTime>=0||this.deathStage!=='none'||!!this.fourth?.blocking||dialogue.isActive||tutorial.isModal}

  // —— 开发调试控制台入口（DevConsole.vue 专用；发布时可整体摘除，不接触存档契约） ——

  /** 设置调试无敌（App 按全局开关同步；模块未进入时 player 尚未创建，直接忽略） */
  debugSetGod(v:boolean):void{if(this.player)this.player.debugGod=v}

  /** 生命/灵力全部回满 */
  debugRefill():boolean{
    this.player.hp=this.player.maxHp
    this.player.mana=this.player.maxMana
    return true
  }

  /** 直接获得开发者神器并放入武器 B 槽。 */
  debugGiveDoomsday():boolean{
    const old=this.character.equipment.get('weaponB')
    if(old!==DOOMSDAY_ID){
      if(old&&this.character.inventory.add(old,1)!==1)return false
      this.character.equipment.set('weaponB',DOOMSDAY_ID)
    }
    this.character.selected=1
    this.equipmentChanged()
    return true
  }
  /** 调试用持有判定：武器 B 槽或背包里存在魔王剑（控制台切换按钮读它） */
  get debugHasDoomsday():boolean{
    if(this.character.equipment.get('weaponB')===DOOMSDAY_ID)return true
    return this.character.inventory.slots.some(s=>s?.id===DOOMSDAY_ID)
  }
  /** 调试专用：归还开发者神器——武器 B 槽与背包内全部抹除；身上没有时返回 false */
  debugReturnDoomsday():boolean{
    let owned=false
    if(this.character.equipment.get('weaponB')===DOOMSDAY_ID){
      this.character.equipment.set('weaponB',null)
      owned=true
      if(this.character.selected===1)this.character.selected=0
    }
    const inv=this.character.inventory
    for(let i=0;i<inv.slots.length;i++){
      if(inv.slots[i]?.id===DOOMSDAY_ID){inv.removeAt(i);owned=true}
    }
    if(!owned)return false
    this.equipmentChanged()
    return true
  }
  selectHand(index:number):void{if(this.player.isChanneling||index<0||index>2)return;this.character.selected=index;this.equipmentChanged()}
  protected equipmentChanged():void{const id=this.equipment.get((['weaponA','weaponB','pick'] as const)[this.character.selected]);if(this.player){this.player.bindEquipment(this.equipment);this.player.equipmentCombat=passiveEquipment(this.equipment);this.player.ammoInventory=this.inventory;this.player.scp127.bind(this.character)}this.player?.setMelee(id?getItemDef(id).melee??null:null,id)}
  requestCastSpellA():void{this.message=t('base.spell_hint');this.messageTime=4}
  requestCastSpellB():void{this.requestCastSpellA()}
  protected discardStack(_slot:NonNullable<Slot>):boolean{this.message=t('base.discard_hint');this.messageTime=4;return false}
  private nearest() {
    if(this.fourth && Math.hypot(this.player.x-RUMIA_CAMP.x,this.player.y-RUMIA_CAMP.y)<82)return {title:t('story.fourth.rumia_talk'),text:'',kind:'rumia'}
    const facilities = this.map.radioSolid ? CAMP_FACILITIES : CAMP_FACILITIES_WITHOUT_RADIO
    let nearest: typeof CAMP_FACILITIES[number] | null = null
    let distanceSq = 100 * 100
    for (const facility of facilities) {
      for (const part of facility.parts) {
        const dx = part.x - this.player.x, dy = part.y - this.player.y
        const candidate = dx * dx + dy * dy
        if (candidate < distanceSq) { nearest = facility; distanceSq = candidate }
      }
    }
    const dx = REIMU.x - this.player.x, dy = REIMU.y - this.player.y
    const wardrobeDistance=(WARDROBE_SPOT.x-this.player.x)**2+(WARDROBE_SPOT.y-this.player.y)**2
    if(this.character.flagBool(WARDROBE_BUILT)&&wardrobeDistance<85**2&&wardrobeDistance<distanceSq&&wardrobeDistance<dx*dx+dy*dy)
      return {title:t('base.wardrobe.name'),text:t('base.wardrobe.text'),kind:'wardrobe'}
    if (dx * dx + dy * dy < distanceSq) {
      return { ...REIMU, title: t(REIMU.title), text: t(REIMU.text), kind: 'npc' }
    }
    if (!nearest) return undefined
    const title=nearest.kind==='table'&&this.character.flagBool('quest.saltSoup.done')?this.character.flagBool('base.crafting.unlocked')?'ui.production.crafting':'ui.production.craft_intro':nearest.kind==='stove'&&this.character.flagBool('quest.saltSoup.done')?'ui.production.furnace':nearest.title
    return { title: t(nearest.kind==='fire'&&(this.character.flagBool('quest.grill.accepted')||this.character.flagBool('base.grill.built'))?'ui.cooking.grill_title':nearest.kind==='stove'&&this.character.smelting?.state==='ready'?'ui.production.claim':title), text: nearest.text ? t(nearest.text) : '', kind: nearest.kind }
  }
  handleUIInput(engine:EngineContext):void {
    const input=engine.input
    if(input.suppressed||dialogue.isActive||this.fourth?.blocking||this.deathStage!=='none'||this.arrivalTime>=0||!campArtworkReady())return
    if(input.actionPressed('panel'))this.setPanel(this.panel==='inventory'?null:'inventory')
    if(input.actionPressed('pause'))this.setPanel(this.panel?null:'pause')
    if(this.panel!=='pause')for(let i=0;i<3;i++)if(input.actionPressed((['hand1','hand2','hand3'] as const)[i]))this.selectHand(i)
  }
  update(dt:number,engine:EngineContext):void {
    this.player.scp127.observe(dt,this.player,dialogue.isActive||this.panel!==null&&this.panel!=='inventory'||engine.input.suppressed||this.deathStage!=='none'||this.arrivalTime>=0)
    // 新基地尚未就绪时不开始入场对白与走位，也不把旧画面烘焙进缓存。
    if(!campArtworkReady())return
    this.updateRecipeNotice(dt)
    const input=engine.input
    const pointer=input.resolveWorldPointer((input.mouseX-this.offsetX)/this.scale,(input.mouseY-this.offsetY)/this.scale,this.player)
    if(this.deathStage==='none'&&this.fourth?.update(dt)){
      if(this.panel==='inventory'){
        this.ctx.bus.emit('ui:inventoryReturn',undefined)
        this.panel=null;this.ctx.bus.emit('ui:panel',null)
      }
      this.time+=dt;return
    }
    if(this.deathStage!=='none'){
      this.time+=dt;this.deathTime+=dt
      this.animator.update(dt,{speed:0,moveAngle:Math.PI/2,aim:Math.PI/2,armed:false})
      if(this.deathStage==='black'&&this.deathTime>=0.5){
        this.deathStage='wake'
        dialogue.start(FIRST_DEATH_TREE,'wake',()=>{if(this.deathStage!=='wake')return;this.deathStage='fade';this.deathTime=0;input.reset()})
      } else if(this.deathStage==='fade'&&this.deathTime>=1.5){
        this.deathStage='talk'
        dialogue.start(FIRST_DEATH_TREE,'pain',()=>{
          if(this.deathStage!=='talk')return
          this.player.x=CAMP_BED.x;this.player.y=CAMP_BED.y+45;this.player.vx=0;this.player.vy=0
          this.deathStage='none';this.messageTime=0;input.reset()
          this.character.setFlag('story.firstDeath.seen',true)
          this.save();void saveService.persistStoryFlag('story.firstDeath.seen')
          if(!this.character.flagBool('tutorial.base.interacted'))tutorial.show('base.tutorial.interact',{durationMs:2147483647})
        })
      }
      return
    }
    if(!this.panel&&this.playWardrobeStory())return
    if(!this.panel&&this.playProgressStory())return
    if(this.arrivalTime>=0){
      this.arrivalTime+=dt;this.time+=dt
      const k=Math.min(1,this.arrivalTime/3)
      this.player.x=1120-430*k;this.player.y=570-20*k;this.player.vx=k<1?-143:0;this.player.vy=k<1?-7:0
      this.player.update(dt,{moveX:0,moveY:0,dodgePressed:false,dodgeHeld:false,dodgeReleased:false,attackPressed:false,attackHeld:false,pointerX:REIMU.x,pointerY:REIMU.y},this.map)
      this.animator.update(dt,{speed:k<1?150:0,moveAngle:-Math.PI,aim:k<1?-Math.PI:Math.PI/2,armed:false})
      if(this.arrivalTime>0.5&&!this.arrivalTalk){this.arrivalTalk=true;dialogue.start(PROLOGUE_TREE,PNODE.BASE_H_1,()=>{this.arrivalTime=-1;this.character.setFlag('prologue.campPending',false);this.character.setFlag('prologue.done',true);acceptCookingQuest(this.character);this.message=t('quest.reimu_cooking.accepted',{name:t('quest.reimu_cooking.name')});this.messageTime=10;tutorial.show('base.tutorial.interact',{durationMs:2147483647});this.save();void saveService.autosave()})}
      return
    }
    if(this.playFacilityStory())return
    if(this.panel!==null&&this.panel!=='inventory'||dialogue.isActive){
      // 面板由统一时钟暂停；对白只保留场景表现，不推进玩家的武器与状态计时。
      this.time+=dt
      this.player.update(0,{moveX:0,moveY:0,dodgePressed:false,dodgeHeld:false,dodgeReleased:false,attackPressed:false,attackHeld:false,pointerX:pointer.x,pointerY:pointer.y},this.map)
      this.animator.update(dt,{speed:0,moveAngle:Math.PI/2,aim:Math.PI/2,armed:false})
      return
    }
    this.time+=dt;this.messageTime=Math.max(0,this.messageTime-dt)
    this.localPlayers.bindPrimary(this.player);this.localPlayers.ensureEntities(this.map,this.player)
    const commands=this.localPlayers.readCommands(input,this.ctx.manager.simulation.tick)
    for(const member of this.localPlayers.extras)if(member.entity){
      const command=commands.find(command=>command.playerId===member.id)
      if(!command)continue
      this.localPlayers.apply(member,command,engine)
      member.entity.scp127.observe(dt,member.entity)
      withSimulationAppearance(member.profile.playerAppearance,()=>member.entity!.update(dt,{...command,attackPressed:false,attackHeld:false,attackReleased:false,specialPressed:false,specialHeld:false,specialReleased:false,dodgePressed:false,dodgeHeld:false,dodgeReleased:false},this.map))
    }
    if(input.justPressed('KeyN'))sfx.toggleMute()
    if(this.panel!=='inventory')for(let i=0;i<3;i++)if(input.actionPressed((['quick1','quick2','quick3'] as const)[i]!))this.useQuickItem(i)
    this.player.update(dt,{moveX:input.movement?.x??Number(input.isActionDown('moveRight'))-Number(input.isActionDown('moveLeft')),moveY:input.movement?.y??Number(input.isActionDown('moveDown'))-Number(input.isActionDown('moveUp')),cancelActions:input.cancelActions,dodgePressed:false,dodgeHeld:false,dodgeReleased:false,attackPressed:false,attackHeld:false,pointerX:pointer.x,pointerY:pointer.y},this.map)
    this.animator.update(dt,{speed:0,moveAngle:Math.PI/2,aim:Math.PI/2,armed:false});this.save()
    if (this.panel === 'inventory') return
    const point=this.nearest()
    if(point&&input.actionPressed('interact')){this.character.setFlag('tutorial.base.interacted',true);tutorial.dismiss();sfx.ensure();if(point.kind==='rumia'){this.fourth?.talk(()=>{this.message=t('story.fourth.fifth_opened');this.messageTime=8});return}if(point.kind==='exit'){if(this.fourth?.blockDeparture())return;if(canEnterMineFloor(this.character,2))this.setPanel('floors');else this.enterMineFloor(1);return}if(point.kind==='npc'){this.setPanel('npc');return}if(point.kind==='box'){this.setPanel('storage');return}if(point.kind==='wardrobe'){this.setPanel('wardrobe');return}if(point.kind==='pot'){if(!this.playFacilityStory())this.setPanel('cooking');return}if(point.kind==='fire'&&(this.character.flagBool('quest.grill.accepted')||this.character.flagBool('base.grill.built'))){this.setPanel('grill');return}if(point.kind==='table'){this.interactWorktable();return}if(point.kind==='stove'){this.interactFurnace();return}if(point.kind==='radio'){sfx.radioClick();this.ctx.bus.emit('base:now-playing',sfx.nextBaseTrack());return}this.message=point.text;this.messageTime=10}
  }
  render(g:CanvasRenderingContext2D,engine:EngineContext):void {
    if(!campArtworkReady()){g.fillStyle='#15131e';g.fillRect(0,0,engine.viewW,engine.viewH);return}
    this.scale=compactLayout.value?Math.max(engine.viewH/640,engine.viewW/1440):Math.min(engine.viewW/1440,engine.viewH/960);this.offsetX=compactLayout.value?Math.min(0,Math.max(engine.viewW-1440*this.scale,engine.viewW/2-this.player.x*this.scale)):(engine.viewW-1440*this.scale)/2;this.offsetY=compactLayout.value?Math.min(0,Math.max(engine.viewH-960*this.scale,engine.viewH/2-this.player.y*this.scale)):(engine.viewH-960*this.scale)/2
    g.fillStyle='#15131e';g.fillRect(0,0,engine.viewW,engine.viewH);g.save();g.translate(this.offsetX,this.offsetY);g.scale(this.scale,this.scale)
    // 资源异步就绪后一次性重建地面与设施缓存，不能把加载前的过渡画面永久烘焙。
    const revision=campArtworkRevision()
    if(revision!==this.artworkRevision){this.ground=null;this.entitySprites.clear();this.artworkRevision=revision}
    if(!this.ground){this.ground=document.createElement('canvas');this.ground.width=1440;this.ground.height=960;const c=this.ground.getContext('2d')!;drawCampGround(c,0);this.visibleEntities.forEach(e=>drawCampShadow(c,e))}
    g.drawImage(this.ground,0,0)
    drawCampAtmosphere(g,this.time)
    // 坐垫是地面布料，不阻挡行走；人物与立体家具共用接地点排序。
    g.fillStyle='#88756065';g.beginPath();g.ellipse(REIMU.x,REIMU.y+5,24,10,-0.1,0,Math.PI*2);g.fill()
    g.strokeStyle='#c3a77b45';g.lineWidth=.8;g.stroke()
    const draws=this.visibleEntities.map(e=>({y:e.y,draw:()=>{
      if (e.kind === 'fire' || e.kind === 'pot' || e.kind === 'radio') {
        drawCampEntity(g,e,this.time,this.character.flagBool('base.pot.repaired'))
        if(e.kind==='fire'&&this.character.flagBool('base.grill.built'))drawCampGrill(g,e.x,e.y)
      } else {
        // 家具不随时间变化，保留排序但只提交缓存图，避免逐帧重画木纹与布纹。
        let sprite = this.entitySprites.get(e.id)
        if (!sprite) {
          // 按实际占地宽度预留两侧余量，避免宽护栏的木桩和绑绳被缓存边缘裁掉。
          const width = Math.max(180, Math.ceil(e.w + 48))
          sprite = document.createElement('canvas'); sprite.width = width * 2; sprite.height = 480
          const c = sprite.getContext('2d')!; c.scale(2,2); c.translate(width/2-e.x,180-e.y)
          drawCampEntity(c,e,0,this.character.flagBool('base.pot.repaired'))
          if(e.kind==='table'&&this.character.flagBool('base.crafting.unlocked'))drawWorktableTools(c,e.x,e.y)
          this.entitySprites.set(e.id,sprite)
        }
        const width = sprite.width / 2
        g.drawImage(sprite,e.x-width/2,e.y-180,width,240)
      }
      if(e.kind==='stove')drawFurnaceState(g,e.x,e.y,furnaceStage(this.character),this.time,this.character.smelting?.state??'idle')
      if(e.kind==='bed'&&this.deathStage!=='none'){
        g.save();g.translate(e.x-12,e.y-30);g.rotate(-Math.PI/2)
        // 主角直接躺在旧木板上的草席上，不再叠加被褥。
        withPlayerCostume(this.equipment.visibleCostume(this.character.costume),()=>drawPlayerRig(g,0,0,this.animator.build(Math.PI/2),{expression:'blink'}))
        g.restore()
      }
    }}))
    const rk=this.arrivalTime<0?1:Math.min(1,this.arrivalTime/3),rx=REIMU.x+505*(1-rk),ry=REIMU.y+90*(1-rk)
    const reimuX=this.deathStage==='none'?rx:CAMP_BED.x-70,reimuY=this.deathStage==='none'?ry:CAMP_BED.y+40
    draws.push({y:reimuY,draw:()=>drawReimuRig(g,reimuX,reimuY,this.animator.build(Math.PI/2))})
    if(this.deathStage==='none')draws.push({y:this.player.y,draw:()=>this.player.render(g)})
    for(const member of this.localPlayers.extras)if(member.entity){const player=member.entity;draws.push({y:player.y,draw:()=>player.render(g)})}
    if(this.fourth){
      const fourth=this.fourth
      draws.push({y:fourth.rumiaPosition.y,draw:()=>fourth.renderRumia(g)})
      draws.push({y:fourth.kedamaSortY,draw:()=>fourth.renderKedama(g)})
    }
    if(this.character.flagBool('unlock.decoration.shrub'))draws.push({y:SHRUB_SPOT.y,draw:()=>drawShrubPot(g)})
    if(this.character.flagBool(WARDROBE_BUILT))draws.push({y:WARDROBE_SPOT.y,draw:()=>drawWardrobeRack(g)})
    draws.sort((a,b)=>a.y-b.y).forEach(d=>d.draw())
    this.localPlayers.renderLabels(g)
    if(hasAvailableStory('camp.worktable',this.storyContext)&&this.deathStage==='none'&&!dialogue.isActive)drawCraftMarker(g,CAMP_TABLE.x,CAMP_TABLE.y,this.time)
    if(this.deathStage==='none'&&!dialogue.isActive){
      if(hasAvailableStory('camp.fire',this.storyContext))drawCraftMarker(g,CAMP_FIRE.x,CAMP_FIRE.y-12,this.time)
      if(hasAvailableStory('camp.pot',this.storyContext))drawCraftMarker(g,CAMP_POT.x,CAMP_POT.y-8,this.time)
    }
    // 修炉任务与待领取成品共用炉体右上侧标记；领取失败时成品仍在，提示持续保留。
    if((this.character.flagBool('story.saltDelivery.seen')&&furnaceStage(this.character)<3||this.character.smelting?.state==='ready')&&this.deathStage==='none'&&!dialogue.isActive){
      const furnace=CAMP_ENTITIES.find(entity=>entity.kind==='stove')
      if(furnace)drawCraftMarker(g,furnace.x+furnace.w/2+14,furnace.y+4,this.time)
    }
    const p=this.nearest()
    if(p&&!this.panel&&this.deathStage==='none'&&this.arrivalTime<0&&!dialogue.isActive){g.font='16px zpix, sans-serif';g.textAlign='center';const text=touchControls.value?p.title:formatKeyBindings(`{key:interact} · ${p.title}`),w=g.measureText(text).width;g.fillStyle='#201e2be8';g.beginPath();g.roundRect(this.player.x-w/2-10,this.player.y-75,w+20,26,5);g.fill();g.fillStyle='#efdbc0';g.fillText(text,this.player.x,this.player.y-57)}
    const now=(this.time*1000)
    this.storageFlights=this.storageFlights.filter(f=>now<f.start+1050)
    for(const f of this.storageFlights){
      const k=Math.max(0,Math.min(1,(now-f.start)/850)),img=this.flightIcons.get(f.id)
      if(now<f.start||!img?.complete||!img.naturalWidth)continue
      const e=k*k*(3-2*k),x=f.x+(f.tx-f.x)*e,y=f.y+(f.ty-f.y)*e-Math.sin(k*Math.PI)*100,size=30*(1-k*.45)
      g.save();g.globalAlpha=Math.min(1,(1-k)*5);g.translate(x,y);g.rotate(Math.sin(k*Math.PI)*.18);g.drawImage(img,-size/2,-size/2,size,size);g.restore()
    }
    if(this.deathStage==='none')this.player.scp127.renderOverlay(g,this.player)
    g.restore()
    this.fourth?.renderScreen(g,engine.viewW,engine.viewH)
    renderNausea(g,engine.viewW,engine.viewH,this.player)
    renderHurtScreen(g,engine.viewW,engine.viewH,this.player)
    if(this.arrivalTime>=0){g.fillStyle=`rgba(0,0,0,${Math.max(0,1-this.arrivalTime/1.7)})`;g.fillRect(0,0,engine.viewW,engine.viewH)}
    if(this.deathStage!=='none'){
      const alpha=this.deathStage==='fade'?Math.max(0,1-this.deathTime/1.5):this.deathStage==='talk'?0:1
      g.fillStyle=`rgba(0,0,0,${alpha})`;g.fillRect(0,0,engine.viewW,engine.viewH)
    }
    if(!touchControls.value&&!this.panel&&this.deathStage==='none'){const mx=engine.input.mouseX,my=engine.input.mouseY;g.strokeStyle='rgba(255,255,255,0.85)';g.lineWidth=1.6;g.beginPath();g.arc(mx,my,7,0,Math.PI*2);g.moveTo(mx-11,my);g.lineTo(mx-5,my);g.moveTo(mx+5,my);g.lineTo(mx+11,my);g.moveTo(mx,my-11);g.lineTo(mx,my-5);g.moveTo(mx,my+5);g.lineTo(mx,my+11);g.stroke()}
    if(this.messageTime>0){g.fillStyle='#231b22ec';g.fillRect(engine.viewW*0.16,engine.viewH-165,engine.viewW*0.68,60);g.fillStyle='#dfc6a6';g.font='15px zpix, sans-serif';g.textAlign='center';(formatKeyBindings(this.message).match(/.{1,48}/g)??[]).forEach((text,i)=>g.fillText(text,engine.viewW/2,engine.viewH-143+i*20))}
    if(this.recipeNoticeTime>0&&!this.panel&&!dialogue.isActive&&this.deathStage==='none'&&this.arrivalTime<0&&!this.fourth?.blocking){
      g.save();g.globalAlpha*=Math.min(1,(4-this.recipeNoticeTime)/.25,this.recipeNoticeTime/.5)
      g.font='14px zpix, sans-serif';g.textAlign='center';g.shadowColor='#1b1212';g.shadowBlur=4;g.shadowOffsetY=2;g.fillStyle='#f0d39e'
      g.fillText(`✦ ${this.recipeNotice}`,engine.viewW/2,engine.viewH-(this.messageTime>0?188:154)-Math.min(1,(4-this.recipeNoticeTime)/.25)*5)
      g.restore()
    }
  }
  getHudState():Record<string,unknown>{return {scene:'base',x:Math.round(this.player.x),y:Math.round(this.player.y),hp:this.player.hp,hpRatio:1,mana:this.player.mana,manaRatio:1,spellCd:0,alive:true,selected:this.character.selected,prologue:this.arrivalTime>=0,deathBlackAlpha:this.deathStage==='fade'?Math.max(0,1-this.deathTime/1.5):this.deathStage==='black'||this.deathStage==='wake'?1:0,panel:this.panel,level:this.character.combat.level,exp:this.character.combat.exp,expNeed:expNeeded(this.character.combat.level),unspentPoints:this.character.combat.unspentPoints,round:this.character.round}}
}
