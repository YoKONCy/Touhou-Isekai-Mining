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
import { RoomRuntime, type RoomHost, type RoomInput } from './cave/RoomRuntime'
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
  readonly id='trial'
  player!:Player
  boss!:GrimmBoss
  private room!:RoomRuntime
  private ctx!:ModuleContext<GameEvents>
  private off:(()=>void)|null=null
  private panel:UIPanelKind|null=null
  private castRequested=false
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
  onEnter(ctx:ModuleContext<GameEvents>):void {
    this.ctx=ctx;this.panel=null;this.finished=0;this.leaving=false;this.castRequested=false;this.shake=0;this.clock=0
    this.pulse=.6;this.lastStage=1;this.phase='intro'
    sfx.setBaseMusic(false);sfx.setCampfireAmbient(false);sfx.setCaveMusic(false);sfx.setCaveAmbient(true);sfx.setTrialMusic(false)
    const w=CONFIG.roomCols*CONFIG.tile,h=CONFIG.roomRows*CONFIG.tile
    this.player=new Player(w*.5,h*.74);this.player.applyGrowth(deriveCombat(this.character.combat));this.player.hp=this.player.maxHp;this.player.mana=this.player.maxMana
    this.player.effects.add(CRIMSON_BLESSING, 'scene:grimm')
    this.equipmentChanged()
    this.room=new RoomRuntime({id:7401,sx:0,sy:0,kind:'normal',depth:0,exitDist:0,doors:[]},this.player.x,this.player.y,{theme:'grimm',noOre:true,noProps:true,spawns:[],manualClear:true,suppressAutoClear:true,noChest:true,noMonsterBurst:true})
    this.boss=new GrimmBoss(w*.5,h*.4)
    this.room.addEnemy(this.boss)
    // 七只落地火盆：猩红暖光常驻（±10% 焰息由房间光源统一处理）
    for(const b of BRAZIER_SPOTS)this.room.addCustomLight(b.x,b.y-4,300,.9,'#ff8038',.24,true)
    this.initEmbers()
    this.host={inventory:this.inventory,clearEnemyBullets:(x,y,r)=>this.boss.attacks.clearBullets(x,y,r),onKill:()=>{},onMine:()=>{},requestDoor:()=>{},requestExtract:()=>this.returnToBase(),onPlayerDied:()=>{this.leaving=true}}
    this.off=ctx.bus.on('ui:requestPanel',kind=>{if(kind!==null&&kind!=='inventory'&&kind!=='pause')return;if(kind)this.player.cancelCharge();this.panel=kind;ctx.bus.emit('ui:panel',kind)})
    ctx.bus.emit('ui:panel',null);ctx.engine.input.reset()
    dialogue.registerTree(GRIMM_DIALOGUE)
    dialogue.start(GRIMM_DIALOGUE.id, 'silence', () => {
      if(this.phase!=='intro')return
      this.phase='battle';ctx.engine.input.reset();sfx.setTrialMusic(true)
    })
  }
  onExit():void {
    this.player.cancelCharge()
    this.phase='defeatFade'
    this.player.effects.clear('scene')
    this.player.tarot.clear()
    this.player.bow.clear()
    dialogue.cancel(GRIMM_DIALOGUE.id)
    this.embers.dispose();this.screenAtmosphere.reset()
this.off?.();this.off=null;this.boss.attacks.clear();this.room.clearDoomsday(this.player);sfx.setCaveAmbient(false);sfx.setTrialMusic(false);this.ctx.bus.emit('ui:panel',null)}
  returnToBase():void {this.ctx.manager.switchTo('base',{trialReturn:true})}
  protected equipmentChanged():void {
    if(this.player)this.player.ammoInventory=this.inventory
    const id=this.equipment.get((['weaponA','weaponB','pick'] as const)[this.character.selected])
    this.player?.setMelee(id?getItemDef(id).melee??null:null,id)
    if(this.player)this.player.equipmentCombat=passiveEquipment(this.equipment)
  }
  selectHand(index:number):void {if(index<0||index>2)return;this.character.selected=index;this.equipmentChanged()}
  protected discardStack(_stack:NonNullable<Slot>):boolean{return false}
  healPlayer(amount:number):number{return this.player.heal(amount)}
  consumeItem(id:string):boolean{return this.player.consumeItem(id)}
  requestCastSpellA():void{this.castRequested=true}
  debugSetGod(value:boolean):void{if(this.player)this.player.debugGod=value}
  debugRefill():boolean{this.player.hp=this.player.maxHp;this.player.mana=this.player.maxMana;return true}
  get debugHasDoomsday():boolean{return this.equipment.get('weaponB')===DOOMSDAY_ID||this.inventory.slots.some(s=>s?.id===DOOMSDAY_ID)}
  debugGiveDoomsday():boolean{const old=this.equipment.get('weaponB');if(old!==DOOMSDAY_ID){if(old&&this.inventory.add(old,1)!==1)return false;this.equipment.set('weaponB',DOOMSDAY_ID)}this.selectHand(1);return true}
  debugReturnDoomsday():boolean{if(!this.debugHasDoomsday)return false;this.room.clearDoomsday(this.player);if(this.equipment.get('weaponB')===DOOMSDAY_ID)this.equipment.set('weaponB',null);for(let i=0;i<this.inventory.slots.length;i++)if(this.inventory.slots[i]?.id===DOOMSDAY_ID)this.inventory.removeAt(i);if(this.character.selected===1)this.character.selected=0;this.equipmentChanged();return true}
  private cast(engine:EngineContext):void {
    const id=this.equipment.get('spellA'),spell=id?getItemDef(id).spell:null
    if(!id||!spell||!this.player.castSpell(spell))return
    this.room.resolveSpell(this.player,id,spell,engine,this.host)
  }
  update(dt:number,engine:EngineContext):void {
    const i=engine.input
    if(i.suppressed){this.player.cancelCharge();return}
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
    if(i.actionPressed('panel'))this.ctx.bus.emit('ui:requestPanel',this.panel==='inventory'?null:'inventory')
    if(i.justPressed('Escape'))this.ctx.bus.emit('ui:requestPanel',this.panel?null:'pause')
    for(let n=0;n<3;n++)if(i.actionPressed((['hand1','hand2','hand3'] as const)[n]))this.selectHand(n)
    if(this.panel)return
    if(this.finishBattle())return
    for(let n=0;n<3;n++)if(i.justPressed('Digit'+(n+4)))this.useQuickItem(n)
    if(i.justPressed('KeyE')||this.castRequested)this.cast(engine);this.castRequested=false
    const input:RoomInput={moveX:Number(i.isActionDown('moveRight'))-Number(i.isActionDown('moveLeft')),moveY:Number(i.isActionDown('moveDown'))-Number(i.isActionDown('moveUp')),dodgePressed:i.actionPressed('dodge'),dodgeHeld:i.isActionDown('dodge'),dodgeReleased:i.actionReleased('dodge'),attackPressed:i.actionPressed('attack'),attackHeld:i.isActionDown('attack'),attackReleased:i.actionReleased('attack'),specialPressed:i.actionPressed('special'),specialHeld:i.isActionDown('special'),specialReleased:i.actionReleased('special'),pointerX:(i.mouseX-this.ox)/this.scale,pointerY:(i.mouseY-this.oy)/this.scale,interactPressed:false}
    // 命中顿帧：Boss/弹幕/特效冻结，玩家时钟独立（攻速与移动不被拖慢）
    const wdt=engine.worldDt(dt)
    this.room.update(wdt,engine,this.player,input,this.host,dt)
    if(this.finishBattle())return
    if(this.boss.alive)this.boss.attacks.update(wdt,this.player,this.room.map,engine,this.room.fx,this.room.projectileBlockers)
    if(this.finishBattle())return
    this.shake=Math.min(1,this.shake+engine.shakeAmount);engine.shakeAmount=0
  }
  /** 结局只触发一次；对话期间暂停死亡计时，结束后再播放原有退场动画。 */
  private finishBattle():boolean {
    if(this.phase!=='battle')return true
    if(!this.player.alive||this.leaving){
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
  render(g:CanvasRenderingContext2D,e:EngineContext):void {
    const w=CONFIG.roomCols*CONFIG.tile,h=CONFIG.roomRows*CONFIG.tile
    // 全屋可见，顶部预警和出生点不因相机裁剪消失。
    this.scale=Math.min(e.viewW/w,(e.viewH-90)/h);this.ox=(e.viewW-w*this.scale)/2;this.oy=65
    g.fillStyle='#0a0408';g.fillRect(0,0,e.viewW,e.viewH);g.save();g.translate(this.ox+Math.sin(this.clock*83)*this.shake*5,this.oy+Math.cos(this.clock*71)*this.shake*4);g.scale(this.scale,this.scale)
    this.room.render(g,this.player)
    this.renderWorldAtmosphere(g,e)
    this.boss.attacks.render(g,this.room.map);this.room.renderDoomsday(g,this.player);this.player.renderDoomCrescents(g,'all');g.restore()
    this.renderScreenAtmosphere(g,e)
    renderNausea(g,e.viewW,e.viewH,this.player)
    renderHurtScreen(g,e.viewW,e.viewH,this.player)
    const width=Math.min(560,e.viewW*.55),left=(e.viewW-width)/2,ratio=this.boss.hp/this.boss.maxHp
    g.save();g.textAlign='center';g.font='16px zpix, sans-serif';g.fillStyle='#e5d6bc';g.fillText(t('trial.grimm.name')+' · '+t('trial.stage',{n:this.boss.stage}),e.viewW/2,22)
    g.fillStyle='#18121f';g.fillRect(left,32,width,13);const grad=g.createLinearGradient(left,0,left+width,0);grad.addColorStop(0,'#523d66');grad.addColorStop(.65,'#96709e');grad.addColorStop(1,'#d3afbd');g.fillStyle=grad;g.fillRect(left,32,width*ratio,13);g.strokeStyle='#baa085';g.lineWidth=1;g.strokeRect(left,32,width,13)
    for(const k of [.55]){g.fillStyle='#0e0b17';g.fillRect(left+width*k-1,32,2,13)}
    g.font='10px zpix, sans-serif';g.fillStyle='#e5d6bc';g.fillText(Math.ceil(this.boss.hp)+' / '+this.boss.maxHp,e.viewW/2,43)
    if(this.boss.isTimeSpell){
      const title=t('trial.time_spell_name'),cx=e.viewW/2
      const size=Math.max(18,Math.min(30,e.viewW/22))
      g.font=`bold ${size}px zpix, serif`;g.lineJoin='round'
      const tw=g.measureText(title).width
      const shade=g.createLinearGradient(0,48,0,105)
      shade.addColorStop(0,'rgba(9,1,7,.9)');shade.addColorStop(1,'rgba(30,3,12,0)')
      g.fillStyle=shade;g.fillRect(cx-tw/2-28,48,tw+56,58)
      g.strokeStyle='#16030b';g.lineWidth=5;g.strokeText(title,cx,78)
      const ink=g.createLinearGradient(0,54,0,80)
      ink.addColorStop(0,'#fff0d6');ink.addColorStop(.5,'#ffb8ab');ink.addColorStop(1,'#b94b65')
      g.fillStyle=ink;g.fillText(title,cx,78)
      g.strokeStyle='#a34b56';g.lineWidth=1;g.beginPath();g.moveTo(cx-tw/2,85);g.lineTo(cx+tw/2,85);g.stroke()
      g.font='12px zpix, sans-serif';g.fillStyle='#e6a994'
      g.fillText(t('trial.time_spell_timer',{seconds:this.boss.spellRemaining.toFixed(1)}),cx,101)
    }
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
      const sources:LightSource[]=[lamp,...this.room.getRoomLights()]
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
