import type { IGameModule, ModuleContext } from '../core/module'
import type { EngineContext } from '../core/types'
import { saveService } from '../core/save/saveService'
import type { CharacterProfile } from '../shared/profile'
import { CharacterModuleActions } from '../shared/moduleActions'
import type { Slot } from '../shared/inventory'
import { deriveCombat, expNeeded } from '../shared/combat'
import { getItemDef } from '../shared/itemDefs'
import { itemCarryRules } from '../shared/itemCarryRules'
import { DOOMSDAY_ID } from '../content/items/vanilla/ids'
import type { GameEvents, UIPanelKind } from './gameEvents'
import { Player } from './Player'
import { renderNausea } from './art/nauseaScreen'
import { renderHurtScreen } from './art/hurtScreen'
import { TileMap } from './tilemap'
import { PlayerAnimator } from './art/rig/playerAnims'
import { drawReimuRig } from './art/rig/reimuRig'
import { CAMP_ENTITIES, CAMP_FACILITIES, CAMP_NPC_ANCHOR, CAMP_SCENERY_SOLIDS, campInside, campContainsCircle, drawCampGround, drawCampEntity, drawCampShadow, drawCampAtmosphere } from './art/campScene'
import { loadCampArtwork, campArtworkRevision } from './art/campArtwork'
import type { CampEntity } from './art/campScene'
import { tutorial } from './dialogue/tutorial'
import { sfx } from './audio/Sfx'
import { dialogue } from './dialogue/dialogueService'
import { registerDialogueAction } from './dialogue/effects'
import { PROLOGUE_TREE, PNODE } from '../content/story/prologue/dialogues'
import { FIRST_DEATH_TREE } from '../content/story/events/first-death/dialogues'
import { drawPlayerRig } from './art/rig/playerRig'
import { acceptCookingQuest } from '../content/story/mainline/camp-soup/transactions'
import { t } from '../i18n'
import { canEnterMineFloor } from '../shared/mineFloors'
import { materialCount, furnaceStage } from '../shared/production'
import { ROCK_SALT_ID } from '../content/items/vanilla/ids'
import { playNextStory, hasAvailableStory, type StoryContext } from './story/storyDirector'
import { drawFurnaceState, drawWorktableTools, drawCraftMarker } from './art/workshopScene'
import { rememberGelReturn } from '../content/story/sidequests/crafting/tetanus'
import {rememberIronWork} from '../content/story/sidequests/crafting/ironWork'
import { FourthCampScene, RUMIA_CAMP } from './story/FourthCampScene'
import { FOURTH_FLAGS } from '../content/story/mainline/fourth-rescue/state'

// 家具定义在运行期间固定；按收音机解锁状态预建列表，不在移动与绘制时反复筛选。
const CAMP_WITHOUT_RADIO = CAMP_ENTITIES.filter(entity => entity.kind !== 'radio')
const CAMP_SOLID = [...CAMP_FACILITIES.flatMap(facility => facility.parts).filter(entity => entity.w > 0), ...CAMP_SCENERY_SOLIDS.map(rock=>({...rock,kind:'rock'}))]
const CAMP_SOLID_WITHOUT_RADIO = CAMP_SOLID.filter(entity => entity.kind !== 'radio')
const CAMP_FACILITIES_WITHOUT_RADIO = CAMP_FACILITIES.filter(facility => facility.kind !== 'radio')
const CAMP_BED = CAMP_ENTITIES.find(entity=>entity.kind==='bed')!
const CAMP_ROPE = CAMP_ENTITIES.find(entity=>entity.kind==='rope')!
const CAMP_TABLE = CAMP_ENTITIES.find(entity=>entity.kind==='table')!

/** 家具使用分轴占地碰撞，岩壁额外按实际轮廓约束角色碰撞圆。 */
class CampMap extends TileMap {
  /** 收音机占地碰撞是否生效：未解锁前它在场景中不存在，解锁当帧由 BaseModule 置 true */
  radioSolid = false
  override isSolid(col:number,row:number):boolean {
    const x=(col+0.5)*this.tile,y=(row+0.5)*this.tile
    return !campInside(x,y)||(x>CAMP_ROPE.x-CAMP_ROPE.w/2&&x<CAMP_ROPE.x+CAMP_ROPE.w/2&&y<CAMP_ROPE.y+3)
  }
  override moveEntity(e: Parameters<TileMap['moveEntity']>[0],dt:number):void {
    const oldX=e.x,oldY=e.y
    super.moveEntity(e,dt)
    const targetX=e.x,targetY=e.y
    e.y=oldY
    const colliders = this.radioSolid ? CAMP_SOLID : CAMP_SOLID_WITHOUT_RADIO
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
  constructor(character:CharacterProfile){super(character)}
  private storyContext!:StoryContext
  private fourth: FourthCampScene | null = null
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
    this.player=new Player(690,550)
    this.player.applyGrowth(deriveCombat(this.character.combat))
    this.load((payload as {arrival?:boolean;trialReturn?:boolean}|undefined)?.arrival||(payload as {trialReturn?:boolean}|undefined)?.trialReturn?null:this.character.location.basePosition)
    this.equipmentChanged();this.panel=null;this.messageTime=0
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
    if(extracted)this.depositMaterials(2300,95)
    this.storyContext={profile:this.character,data:{fromFloor:extracted?(payload as {fromFloor?:number}|undefined)?.fromFloor:undefined}}
    rememberGelReturn(this.character)
    rememberIronWork(this.character)
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
  onExit():void{this.deathStage='none';this.player.effects.clear('scene');dialogue.cancel();this.save();this.offPanel?.();this.offPanel=null;this.offFloor?.();this.offFloor=null;tutorial.dismiss();sfx.setBaseMusic(false);sfx.setCampfireAmbient(false);this.ctx.bus.emit('ui:panel',null)}
  save():{x:number;y:number}{const p={x:this.player.x,y:this.player.y};this.character.location.basePosition=p;return p}
  load(slice:unknown|null):void {
    const p=slice as {x?:number;y?:number}|null
    const colliders=this.map.radioSolid?CAMP_SOLID:CAMP_SOLID_WITHOUT_RADIO
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
      const stored=this.character.storage.add(stack.id,stack.qty)
      if(stored){
        const box=CAMP_ENTITIES.filter(e=>e.kind==='box')[this.storageFlights.length%3]
        this.storageFlights.push({id:stack.id,start:performance.now()+baseDelay+this.storageFlights.length*gap,x:this.player.x,y:this.player.y-26,tx:box.x,ty:box.y-28})
        if(!this.flightIcons.has(stack.id)){
          const icon=getItemDef(stack.id).icon,img=new Image()
          img.src=icon.type==='svg'?`data:image/svg+xml;charset=utf-8,${encodeURIComponent(icon.svg)}`:icon.src
          this.flightIcons.set(stack.id,img)
        }
        stack.qty-=stored;if(stack.qty===0)inv.slots[i]=null
      }
    }
  }
  private setPanel(kind:UIPanelKind|null):void{if(this.fourth?.blocking||kind==='floors'&&this.fourth?.blockDeparture())return;if(kind==='map'||this.deathStage!=='none'||this.arrivalTime>=0||dialogue.isActive||kind==='floors'&&!canEnterMineFloor(this.character,2)||kind==='crafting'&&!this.character.flagBool('base.crafting.unlocked')||kind==='furnace'&&!this.character.flagBool('base.furnace.inspected'))return;this.panel=kind;if(kind)this.messageTime=0;this.ctx.bus.emit('ui:panel',kind);this.save()}
  private playProgressStory():boolean{
    if(this.ctx.manager.transitioning||this.panel||dialogue.isActive||this.arrivalTime>=0||!this.character.flagBool('quest.reimu.cooking.done'))return false
    const started=playNextStory('camp.idle',this.storyContext,{onEnd:scene=>{
      if(scene.notification){this.message=t(scene.notification);this.messageTime=6}
    }})
    if(started)tutorial.dismiss()
    return started
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
  selectHand(index:number):void{if(index<0||index>2)return;this.character.selected=index;this.equipmentChanged()}
  protected equipmentChanged():void{const id=this.equipment.get((['weaponA','weaponB','pick'] as const)[this.character.selected]);if(this.player)this.player.ammoInventory=this.inventory;this.player?.setMelee(id?getItemDef(id).melee??null:null,id)}
  requestCastSpellA():void{this.message=t('base.spell_hint');this.messageTime=4}
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
    if (dx * dx + dy * dy < distanceSq) {
      return { ...REIMU, title: t(REIMU.title), text: t(REIMU.text), kind: 'npc' }
    }
    if (!nearest) return undefined
    const title=nearest.kind==='table'&&this.character.flagBool('quest.saltSoup.done')?this.character.flagBool('base.crafting.unlocked')?'ui.production.crafting':'ui.production.craft_intro':nearest.kind==='stove'&&this.character.flagBool('quest.saltSoup.done')?'ui.production.furnace':nearest.title
    return { title: t(nearest.kind==='stove'&&this.character.smelting?.state==='ready'?'ui.production.claim':title), text: nearest.text ? t(nearest.text) : '', kind: nearest.kind }
  }
  update(dt:number,engine:EngineContext):void {
    const input=engine.input
    if(this.deathStage==='none'&&this.fourth?.update(dt)){this.time+=dt;return}
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
    if(this.playProgressStory())return
    if(input.actionPressed('panel'))this.setPanel(this.panel==='inventory'?null:'inventory')
    if(input.justPressed('Escape'))this.setPanel(this.panel?null:'pause')
    for(let i=0;i<3;i++)if(input.actionPressed((['hand1','hand2','hand3'] as const)[i]))this.selectHand(i)
    if(this.arrivalTime>=0){
      this.arrivalTime+=dt;this.time+=dt
      const k=Math.min(1,this.arrivalTime/3)
      this.player.x=1120-430*k;this.player.y=570-20*k;this.player.vx=k<1?-143:0;this.player.vy=k<1?-7:0
      this.player.update(dt,{moveX:0,moveY:0,dodgePressed:false,dodgeHeld:false,dodgeReleased:false,attackPressed:false,attackHeld:false,pointerX:REIMU.x,pointerY:REIMU.y},this.map)
      this.animator.update(dt,{speed:k<1?150:0,moveAngle:-Math.PI,aim:k<1?-Math.PI:Math.PI/2,armed:false})
      if(this.arrivalTime>0.5&&!this.arrivalTalk){this.arrivalTalk=true;dialogue.start(PROLOGUE_TREE,PNODE.BASE_H_1,()=>{this.arrivalTime=-1;this.character.setFlag('prologue.campPending',false);this.character.setFlag('prologue.done',true);acceptCookingQuest(this.character);this.message=t('quest.reimu_cooking.accepted',{name:t('quest.reimu_cooking.name')});this.messageTime=10;tutorial.show('base.tutorial.interact',{durationMs:2147483647});this.save();void saveService.autosave()})}
      return
    }
    if(this.panel||dialogue.isActive){
      // 面板/对白期间冻结玩法，但人物保留待机呼吸，避免场景里的角色变定格玩偶
      this.time+=dt
      this.player.update(dt,{moveX:0,moveY:0,dodgePressed:false,dodgeHeld:false,dodgeReleased:false,attackPressed:false,attackHeld:false,pointerX:(input.mouseX-this.offsetX)/this.scale,pointerY:(input.mouseY-this.offsetY)/this.scale},this.map)
      this.animator.update(dt,{speed:0,moveAngle:Math.PI/2,aim:Math.PI/2,armed:false})
      return
    }
    this.time+=dt;this.messageTime=Math.max(0,this.messageTime-dt)
    if(input.justPressed('KeyN'))sfx.toggleMute()
    for(let i=0;i<3;i++)if(input.justPressed(`Digit${i+4}`))this.useQuickItem(i)
    this.player.update(dt,{moveX:Number(input.isActionDown('moveRight'))-Number(input.isActionDown('moveLeft')),moveY:Number(input.isActionDown('moveDown'))-Number(input.isActionDown('moveUp')),dodgePressed:false,dodgeHeld:false,dodgeReleased:false,attackPressed:false,attackHeld:false,pointerX:(input.mouseX-this.offsetX)/this.scale,pointerY:(input.mouseY-this.offsetY)/this.scale},this.map)
    this.animator.update(dt,{speed:0,moveAngle:Math.PI/2,aim:Math.PI/2,armed:false});this.save()
    const point=this.nearest()
    if(point&&input.actionPressed('interact')){this.character.setFlag('tutorial.base.interacted',true);tutorial.dismiss();sfx.ensure();if(point.kind==='rumia'){this.fourth?.talk(()=>{this.message=t('story.fourth.fifth_opened');this.messageTime=8});return}if(point.kind==='exit'){if(this.fourth?.blockDeparture())return;if(canEnterMineFloor(this.character,2))this.setPanel('floors');else this.enterMineFloor(1);return}if(point.kind==='npc'){this.setPanel('npc');return}if(point.kind==='box'){this.setPanel('storage');return}if(point.kind==='pot'){this.setPanel('cooking');return}if(point.kind==='table'){this.interactWorktable();return}if(point.kind==='stove'){this.interactFurnace();return}if(point.kind==='radio'){sfx.radioClick();this.ctx.bus.emit('base:now-playing',sfx.nextBaseTrack());return}this.message=point.text;this.messageTime=10}
  }
  render(g:CanvasRenderingContext2D,engine:EngineContext):void {
    this.scale=Math.min(engine.viewW/1440,engine.viewH/960);this.offsetX=(engine.viewW-1440*this.scale)/2;this.offsetY=(engine.viewH-960*this.scale)/2
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
        drawPlayerRig(g,0,0,this.animator.build(Math.PI/2),{expression:'blink'})
        g.restore()
      }
    }}))
    const rk=this.arrivalTime<0?1:Math.min(1,this.arrivalTime/3),rx=REIMU.x+505*(1-rk),ry=REIMU.y+90*(1-rk)
    const reimuX=this.deathStage==='none'?rx:CAMP_BED.x-70,reimuY=this.deathStage==='none'?ry:CAMP_BED.y+40
    draws.push({y:reimuY,draw:()=>drawReimuRig(g,reimuX,reimuY,this.animator.build(Math.PI/2))})
    if(this.deathStage==='none')draws.push({y:this.player.y,draw:()=>this.player.render(g)})
    if(this.fourth)draws.push({y:RUMIA_CAMP.y,draw:()=>this.fourth!.render(g)})
    draws.sort((a,b)=>a.y-b.y).forEach(d=>d.draw())
    if(hasAvailableStory('camp.worktable',this.storyContext)&&this.deathStage==='none'&&!dialogue.isActive)drawCraftMarker(g,CAMP_TABLE.x,CAMP_TABLE.y,this.time)
    // 修炉任务与待领取成品共用炉体右上侧标记；领取失败时成品仍在，提示持续保留。
    if((this.character.flagBool('story.saltDelivery.seen')&&furnaceStage(this.character)<3||this.character.smelting?.state==='ready')&&this.deathStage==='none'&&!dialogue.isActive){
      const furnace=CAMP_ENTITIES.find(entity=>entity.kind==='stove')
      if(furnace)drawCraftMarker(g,furnace.x+furnace.w/2+14,furnace.y+4,this.time)
    }
    const p=this.nearest()
    if(p&&!this.panel&&this.deathStage==='none'&&this.arrivalTime<0&&!dialogue.isActive){g.font='16px zpix, sans-serif';g.textAlign='center';const text=`F · ${p.title}`,w=g.measureText(text).width;g.fillStyle='#201e2be8';g.beginPath();g.roundRect(this.player.x-w/2-10,this.player.y-75,w+20,26,5);g.fill();g.fillStyle='#efdbc0';g.fillText(text,this.player.x,this.player.y-57)}
    const now=performance.now()
    this.storageFlights=this.storageFlights.filter(f=>now<f.start+1050)
    for(const f of this.storageFlights){
      const k=Math.max(0,Math.min(1,(now-f.start)/850)),img=this.flightIcons.get(f.id)
      if(now<f.start||!img?.complete||!img.naturalWidth)continue
      const e=k*k*(3-2*k),x=f.x+(f.tx-f.x)*e,y=f.y+(f.ty-f.y)*e-Math.sin(k*Math.PI)*100,size=30*(1-k*.45)
      g.save();g.globalAlpha=Math.min(1,(1-k)*5);g.translate(x,y);g.rotate(Math.sin(k*Math.PI)*.18);g.drawImage(img,-size/2,-size/2,size,size);g.restore()
    }
    g.restore()
    this.fourth?.renderScreen(g,engine.viewW,engine.viewH)
    renderNausea(g,engine.viewW,engine.viewH,this.player)
    renderHurtScreen(g,engine.viewW,engine.viewH,this.player)
    if(this.arrivalTime>=0){g.fillStyle=`rgba(0,0,0,${Math.max(0,1-this.arrivalTime/1.7)})`;g.fillRect(0,0,engine.viewW,engine.viewH)}
    if(this.deathStage!=='none'){
      const alpha=this.deathStage==='fade'?Math.max(0,1-this.deathTime/1.5):this.deathStage==='talk'?0:1
      g.fillStyle=`rgba(0,0,0,${alpha})`;g.fillRect(0,0,engine.viewW,engine.viewH)
    }
    if(!this.panel&&this.deathStage==='none'){const mx=engine.input.mouseX,my=engine.input.mouseY;g.strokeStyle='rgba(255,255,255,0.85)';g.lineWidth=1.6;g.beginPath();g.arc(mx,my,7,0,Math.PI*2);g.moveTo(mx-11,my);g.lineTo(mx-5,my);g.moveTo(mx+5,my);g.lineTo(mx+11,my);g.moveTo(mx,my-11);g.lineTo(mx,my-5);g.moveTo(mx,my+5);g.lineTo(mx,my+11);g.stroke()}
    if(this.messageTime>0){g.fillStyle='#231b22ec';g.fillRect(engine.viewW*0.16,engine.viewH-165,engine.viewW*0.68,60);g.fillStyle='#dfc6a6';g.font='15px zpix, sans-serif';g.textAlign='center';(this.message.match(/.{1,48}/g)??[]).forEach((text,i)=>g.fillText(text,engine.viewW/2,engine.viewH-143+i*20))}
  }
  getHudState():Record<string,unknown>{return {scene:'base',x:Math.round(this.player.x),y:Math.round(this.player.y),hp:this.player.hp,hpRatio:1,mana:this.player.mana,manaRatio:1,spellCd:0,alive:true,selected:this.character.selected,prologue:this.arrivalTime>=0,deathBlackAlpha:this.deathStage==='fade'?Math.max(0,1-this.deathTime/1.5):this.deathStage==='black'||this.deathStage==='wake'?1:0,panel:this.panel,level:this.character.combat.level,exp:this.character.combat.exp,expNeed:expNeeded(this.character.combat.level),unspentPoints:this.character.combat.unspentPoints,round:this.character.round}}
}
