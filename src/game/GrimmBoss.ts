import { randomCombat } from '../core/simulation/random'
import { Enemy, type PlayerLike } from './Enemy'
import GRIMM_DEF from '../content/enemies/vanilla/grimm'
import { CONFIG } from './config'
import type { TileMap } from './tilemap'
import { BossAttacks } from './BossAttacks'
import { drawGrimm, createGrimmRigMotion } from './art/rig/grimmRig'
import { sfx } from './audio/Sfx'
import { grimmSound, grimmSpellVolley } from '../content/enemies/vanilla/grimmAudio'
import { drawBossCastHalo } from './art/rig/bossCastHalo'
import { GRIMM_BALANCE } from '../content/enemies/vanilla/grimmBalance'

type State='retreat'|'run'|'roll'|'hidden'|'slash'|'chain'|'cast'|'second'|'thirdVolley'|'recovery'|'break'|'timeSpell'
/** 格林专用编排，共用 Enemy 的生命和所有正式武器结算。 */
export class GrimmBoss extends Enemy {
  /** 实体坐标为躯干中心，素材仍以脚底为锚；初始出生位置保持原脚底位置。 */
  private readonly footOffset=90*CONFIG.tile/48
  override get simulationKind():string{return 'grimm'}
  constructor(x:number,y:number){super(x,y-90*CONFIG.tile/48,GRIMM_DEF.id,GRIMM_DEF)}
  readonly attacks=new BossAttacks()
  state:State='retreat'
  private clock=0
  private lastTarget:PlayerLike|null=null
  private timer=1
  private duration=1
  private skill=0
  private lastSkill=0
  private repeats=0
  private angle=0
  private warning:{x:number;y:number;targetX:number;targetY:number}|null=null
  private slashIssued=false
  private hitFlash=0
  private deadSound=false
  private readonly rigMotion=createGrimmRigMotion()
  private haloProgress=0
  private haloAlpha=0
  private battleStage=1
  private breakTarget=2
  private spellBeat=0
  private volleyAngle=0
  private teleported=false
  private spellRifts=0
  get stage():number{return this.battleStage}
  get spellRemaining():number{return this.state==='timeSpell'?Math.max(0,this.timer):0}
  get isTimeSpell():boolean{return this.state==='timeSpell'}
  override get canBeHit():boolean{return this.alive&&this.state!=='hidden'&&this.state!=='break'&&this.battleStage!==2}
  override get emerging():boolean{return !this.canBeHit}
  override tryHitPlayer():boolean{return false}
  override takeDamage(amount:number,angle:number,kb?:number,stun?:number,kind='unknown'):void {
    if(!this.canBeHit)return
    // 先截断伤害，避免父类死亡分支在破功时被触发。
    const applied=this.battleStage===1?Math.min(amount,Math.max(0,this.hp-this.maxHp*.55)):amount
    super.takeDamage(applied,angle,kb,stun,kind);this.hitFlash=.09
    if(this.battleStage===1&&this.hp<=this.maxHp*.55){
      this.hp=this.maxHp*.55;this.alive=true;this.dying=0;this.breakTarget=2
      this.attacks.clear();this.warning=null;this.vx=this.vy=0
      this.enter('break',1);grimmSound(sfx, 'armor');return
    }
    if(!this.alive){this.attacks.clear();this.warning=null;this.dying=1.2;if(!this.deadSound){grimmSound(sfx, 'death');this.deadSound=true}}
    else grimmSound(sfx, 'armor')
  }
  private enter(state:State,duration:number):void{
    this.state=state;this.timer=this.duration=duration
    if(state==='cast'||state==='break'){this.haloProgress=0;this.haloAlpha=0}
    if(state==='break'){
      this.teleported=false
      this.attacks.add('smoke',this.x,this.y,{rx:85,duration:.55})
      grimmSound(sfx, 'vanish')
    }
  }
  private move(map:TileMap,angle:number,speed:number,dt:number):void {
    speed *= this.effects.modify('moveSpeed', 1)
    const b=map.bounds,pad=this.r+18
    // 全圆占地前瞻，贴墙时由小角度到反向扫描，避免卡角。
    for(const off of [0,.4,-.4,.8,-.8,1.3,-1.3,1.8,-1.8,2.4,-2.4,Math.PI]){
      const a=angle+off,x=this.x+Math.cos(a)*(speed*dt+26),y=this.y+Math.sin(a)*(speed*dt+26)
      if(x-pad<b.left||x+pad>b.right||y-pad<b.top||y+pad>b.bottom)continue
      if(map.solidAtWorld(x-pad,y-pad)||map.solidAtWorld(x+pad,y+pad))continue
      this.vx=Math.cos(a)*speed;this.vy=Math.sin(a)*speed;map.moveEntity(this,dt);return
    }
    this.vx=this.vy=0
  }
  private hide(map:TileMap,p:PlayerLike):void {
    this.attacks.add('smoke',this.x,this.y,{rx:70,duration:.55})
    const b=map.bounds,pad=this.r+25
    // 预警出现时锁定出生点和瞄准点，之后绝不偷偷追踪。
    const a=randomCombat()*Math.PI*2,d=CONFIG.tile*(2.6+randomCombat()*1.1)
    const x=Math.max(b.left+pad,Math.min(b.right-pad,p.x+Math.cos(a)*d)),y=Math.max(b.top+pad,Math.min(b.bottom-pad,p.y+Math.sin(a)*d))
    this.warning={x,y,targetX:p.x,targetY:p.y};this.enter('hidden',.3+randomCombat()*.3);grimmSound(sfx, 'vanish')
  }
  private finish():void{this.enter('recovery',.35+randomCombat()*.3)}
  private ring(p:PlayerLike,second:boolean):void {
    const n=second?24:16,base=second&&this.battleStage===3?this.volleyAngle:Math.atan2(p.y-this.y,p.x-this.x),speed=second?750:460
    if(!second)this.volleyAngle=base
    const travelTime=Math.hypot(CONFIG.roomCols*CONFIG.tile,CONFIG.roomRows*CONFIG.tile)/(speed*(second?1:.6))+.3
    const wall=CONFIG.wallThickness*CONFIG.tile
    for(let i=0;i<n;i++){
      const angle=base+i*Math.PI*2/n,c=Math.cos(angle),s=Math.sin(angle)
      const dx=Math.abs(c)<1e-6?Infinity:(c>0?CONFIG.roomCols*CONFIG.tile-wall-this.x:this.x-wall)/Math.abs(c)
      const dy=Math.abs(s)<1e-6?Infinity:(s>0?CONFIG.roomRows*CONFIG.tile-wall-this.y:this.y-wall)/Math.abs(s)
      // 每发独立抽取墙距的65%～120%，最远允许短暂出界；全程不重新随机。
      const reach=Math.max(30,Math.min(dx,dy))*(.65+randomCombat()*.55)
      this.attacks.add(second?'bolt':'mist',this.x,this.y,{angle,speed,rx:second?6:11,duration:!second&&this.battleStage===3?5.6:travelTime,reach,phase:i,returning:!second&&this.battleStage===3,fixed:second&&this.battleStage===3})
    }
    grimmSound(sfx, second?'laser':'burst')
  }
  private seals(map:TileMap):void {
    const b=map.bounds,rx=CONFIG.tile*1.5,ry=CONFIG.tile
    // 分区随机采样，16 点覆盖全屋而不是堆在同一个角落。
    for(let i=0;i<16;i++){
      const x=b.left+rx+(i%4+.2+randomCombat()*.6)/4*(b.right-b.left-2*rx)
      const y=b.top+ry+(Math.floor(i/4)+.2+randomCombat()*.6)/4*(b.bottom-b.top-2*ry)
      this.attacks.add('seal',x,y,{rx,ry,delay:.5+randomCombat()*.3,duration:.28})
    }
    grimmSound(sfx, 'burst')
  }
  private lasers(map:TileMap):void {
    const b=map.bounds
    const timing=GRIMM_BALANCE.laser
    {
      // 单组快速扫过，双组只错开起拍，保留交叉压迫；不锁住首领的后续招式。
      const index=this.battleStage===3?Math.floor(randomCombat()*8):Math.floor(randomCombat()*4)*2
      const dual=this.battleStage===3&&randomCombat()<.5
      const warning=dual?timing.dualWarning:timing.warning,step=dual?timing.dualStep:timing.step
      for(let group=0;group<(dual?2:1);group++){
        const direction=(index+(group?2:0))*Math.PI/4
        const normal=direction,angle=normal+Math.PI/2
        const extent=Math.abs(Math.cos(normal))*(b.right-b.left)/2+Math.abs(Math.sin(normal))*(b.bottom-b.top)/2
        const count=dual?7:14
        const groupDelay=group*timing.groupOffset
        for(let i=0;i<count;i++){
          const off=-extent+(i+.5)*extent*2/count
          const delay=warning+i*step+groupDelay
          this.attacks.add('laser',(b.left+b.right)/2+Math.cos(normal)*off,(b.top+b.bottom)/2+Math.sin(normal)*off,
            {angle,rx:Math.hypot(b.right-b.left,b.bottom-b.top),ry:extent*.6/count/(dual?2:1),
              delay,duration:timing.active,warningDuration:timing.hintDuration,phase:group})
        }
      }
    }
    grimmSound(sfx, 'charge')
  }
  private rifts(map:TileMap,p:PlayerLike,survival=false):void {
    const b=map.bounds,cx=(b.left+b.right)/2,cy=(b.top+b.bottom)/2
    for(let i=0;i<(survival?4:5);i++){
      // 两束压玩家附近，其余切周边空间；预警落点锁定后不再追踪。
      const aim=Math.atan2(p.y-cy,p.x-cx)
      const angle=aim+i*Math.PI/5+(randomCombat()-.5)*.24
      const nx=-Math.sin(angle),ny=Math.cos(angle)
      const extent=Math.abs(nx)*(b.right-b.left)/2+Math.abs(ny)*(b.bottom-b.top)/2
      const playerOffset=(p.x-cx)*nx+(p.y-cy)*ny
      const clearance=survival?68:52
      let offset=i<2?playerOffset+(i===0?-1:1)*(clearance+randomCombat()*22):(randomCombat()-.5)*extent*1.6
      offset=Math.max(-extent+30,Math.min(extent-30,offset))
      // 保留可读反应间距，预警锁定后不再追踪，也不把线放到房间之外。
      if(Math.abs(offset-playerOffset)<clearance-9){
        const left=playerOffset-clearance,right=playerOffset+clearance
        offset=left>=-extent+30?left:Math.min(extent-30,right)
      }
      this.attacks.add('rift',cx+nx*offset,cy+ny*offset,{angle,rx:Math.hypot(b.right-b.left,b.bottom-b.top),
        ry:survival?17:22,delay:survival?GRIMM_BALANCE.survival.riftWarning:.9,duration:.65,activeDuration:.18,phase:i})
    }
    grimmSound(sfx, 'charge')
  }
  private timePattern(beat:number,p:PlayerLike,map:TileMap):void {
    const balance=GRIMM_BALANCE.survival,elapsed=balance.duration-this.timer,act=Math.min(2,Math.floor(elapsed/8))
    // 换幕与裂束前后暂停补弹，避免读取预警时又被新一圈弹幕封住移动路线。
    if(elapsed>22.6||elapsed%8<.5||balance.riftTimes.some(at=>elapsed>=at-balance.riftPauseBefore&&elapsed<=at+balance.riftPauseAfter))return
    const seeds=act>0&&beat%5===0,petals=act===2&&beat%4===0
    grimmSpellVolley(sfx, act,seeds,petals)
    const base=beat*.12*(act===1?-1:1)
    const reach=Math.hypot(CONFIG.roomCols*CONFIG.tile,CONFIG.roomRows*CONFIG.tile)*.5+50
    const count=balance.counts[act]!,speed=balance.speeds[act]!
    const gap=base+Math.PI/3
    for(let side=0;side<2;side++){
      const orbit=base+side*Math.PI
      for(let i=0;i<count;i++){
        const angle=base+i*Math.PI*2/count+side*Math.PI/count
        // 两股弹交错并留出较窄缺口，旋向按节拍变化，不实时追踪玩家。
        const gapDistance=Math.abs(Math.atan2(Math.sin(angle-gap),Math.cos(angle-gap)))
        if(Math.min(gapDistance,Math.PI-gapDistance)<balance.gapHalfAngle+.1)continue
        const returning=act>0&&side===1&&beat%(act===2?2:3)===0
        this.attacks.add('oath',this.x+Math.cos(orbit)*42,this.y+Math.sin(orbit)*42,
          {angle,speed,rx:6,duration:returning?4.8:reach/speed+1,reach,delay:side*.22,
            bend:(side?-1:1)*(.15+act*.055),dark:side===1,returning,phase:beat+i,
            appearance:side===0?'petal':'needle'})
      }
    }
    // 黑晶停驻后扇射，瞄准落点保持锁定，不追着玩家转向。
    if(seeds)for(let i=0;i<3;i++){
      const a=base+i*Math.PI*2/3,c=Math.cos(a),s=Math.sin(a),b=map.bounds
      const dx=Math.abs(c)<1e-6?Infinity:(c>0?b.right-this.x:this.x-b.left)/Math.abs(c)
      const dy=Math.abs(s)<1e-6?Infinity:(s>0?b.bottom-this.y:this.y-b.top)/Math.abs(s)
      this.attacks.add('shardSeed',this.x,this.y,{angle:a,rx:8,duration:1.55,reach:Math.max(30,Math.min(270,dx-40,dy-40)),targetX:p.x,targetY:p.y,dark:true,appearance:'crystal',phase:beat+i})
    }
    if(petals)for(let i=0;i<12;i++){
      const angle=base+i*Math.PI/6,gapDistance=Math.abs(Math.atan2(Math.sin(angle-gap),Math.cos(angle-gap)))
      if(Math.min(gapDistance,Math.PI-gapDistance)<balance.gapHalfAngle+.1)continue
      this.attacks.add('oath',this.x,this.y,{angle,speed:125,rx:7,duration:6,reach,bend:.16,dark:true,appearance:'cinder',phase:beat+i})
    }
  }
  override update(dt:number,map:TileMap,p:PlayerLike):void {
    this.motionHistory.capture(this.x, this.y)
    // 不可选中时沿最后已知位置继续既有演出，不实时锁定当前角色，也不暂停整个战斗。
    if (!p.untargetable) {
      if (!this.lastTarget) this.lastTarget={x:p.x,y:p.y,half:p.half,alive:p.alive}
      this.lastTarget.x=p.x;this.lastTarget.y=p.y;this.lastTarget.vx=p.vx;this.lastTarget.vy=p.vy;this.lastTarget.alive=p.alive
    } else if (this.lastTarget) p=this.lastTarget
    this.effects.update(dt)
    if (this.alive && this.effects.incapacitated) { this.vx = this.vy = 0; return }
    if (this.alive && this.effects.skillsDisabled && this.state !== 'break' && this.state !== 'timeSpell') {
      // 愚者封印禁止开新技能并取消当前起手，已发出的弹幕仍由独立攻击层推进。
      if (this.state !== 'retreat') { this.state = 'retreat'; this.timer = this.duration = .35 }
      this.warning = null; this.haloAlpha = 0
      this.move(map, Math.atan2(this.y - p.y, this.x - p.x), 52, dt)
      return
    }
    this.clock+=dt;this.hitFlash=Math.max(0,this.hitFlash-dt)
    if(this.alive&&(this.state==='cast'||this.state==='break'||this.state==='timeSpell')){
      this.haloProgress=Math.min(1,(this.duration-this.timer+dt)/this.duration)
      this.haloAlpha=Math.min(1,this.haloAlpha+dt*9)
    }else this.haloAlpha=Math.max(0,this.haloAlpha-dt/ .32)
    if(!this.alive){this.dying=Math.max(0,this.dying-dt);return}
    this.timer-=dt;this.vx=this.vy=0
    if(this.state==='break'){
      if(this.breakTarget===2&&!this.teleported&&this.timer<=.65){
        const b=map.bounds;this.x=(b.left+b.right)/2;this.y=(b.top+b.bottom)/2
        this.teleported=true
        this.attacks.add('smoke',this.x,this.y,{rx:85,duration:.6});grimmSound(sfx, 'vanish')
      }
      if(this.timer<=0){
        this.battleStage=this.breakTarget;this.attacks.clear()
        if(this.battleStage===2){this.spellBeat=0;this.spellRifts=0;this.enter('timeSpell',GRIMM_BALANCE.survival.duration)}else this.enter('retreat',.5)
      }
      return
    }
    if(this.state==='timeSpell'){
      if(this.timer<=0){this.attacks.clear();this.breakTarget=3;this.enter('break',1);return}
      if(this.effects.skillsDisabled)return
      const elapsed=GRIMM_BALANCE.survival.duration-this.timer
      const warningTimes=GRIMM_BALANCE.survival.riftTimes
      while(this.spellRifts<warningTimes.length&&elapsed>=warningTimes[this.spellRifts]){this.rifts(map,p,true);this.spellRifts++}
      const beat=Math.floor(elapsed/GRIMM_BALANCE.survival.beat)
      while(this.spellBeat<=beat)this.timePattern(this.spellBeat++,p,map)
      return
    }
    if(this.state==='retreat'){
      this.move(map,Math.atan2(this.y-p.y,this.x-p.x),52,dt)
      if(this.timer<=0){const candidates=(this.battleStage===3?[1,2,3,4,5]:[1,2,3,4]).filter(s=>s!==this.lastSkill);this.skill=candidates[Math.floor(randomCombat()*candidates.length)];this.lastSkill=this.skill
        if(this.skill===1){this.repeats=2+Math.floor(randomCombat()*3);this.enter('run',.5)}else{this.enter('cast',this.skill===5?1.05:this.skill===2?.3:.5);if(this.skill===5)this.rifts(map,p);grimmSound(sfx, 'charge')}
      }
    }else if(this.state==='run'){
      this.move(map,Math.atan2(p.y-this.y,p.x-this.x),320,dt)
      if(this.timer<=0)this.enter('roll',.16)
    }else if(this.state==='roll'){
      this.move(map,Math.atan2(p.y-this.y,p.x-this.x),360,dt)
      if(this.timer<=0)this.hide(map,p)
    }else if(this.state==='hidden'){
      if(this.timer<=0&&this.warning){const w=this.warning;this.x=w.x;this.y=w.y;this.angle=Math.atan2(w.targetY-w.y,w.targetX-w.x);this.warning=null;this.enter('slash',.26);this.slashIssued=false;this.attacks.add('smoke',this.x,this.y,{rx:65,duration:.4});grimmSound(sfx, 'slash')}
    }else if(this.state==='slash'){
      const steps=Math.max(1,Math.ceil(680*dt/10)),step=dt/steps
      for(let i=0;i<steps;i++){const speed=680*this.effects.modify('moveSpeed',1);this.vx=Math.cos(this.angle)*speed;this.vy=Math.sin(this.angle)*speed;map.moveEntity(this,step)}
      if(this.duration-this.timer>=.07&&!this.slashIssued){this.slashIssued=true;this.attacks.add('slash',this.x,this.y,{angle:this.angle,rx:120,duration:.2})}
      if(this.timer<=0){this.repeats--;if(this.repeats>0)this.enter('chain',.12);else this.finish()}
    }else if(this.state==='chain'){
      if(this.timer<=0)this.enter('roll',.16)
    }else if(this.state==='cast'&&this.timer<=0){
      if(this.skill===2){this.ring(p,false);this.enter('second',.2)}
      else{if(this.skill===3)this.seals(map);else if(this.skill===4)this.lasers(map);this.finish()}
    }else if(this.state==='second'&&this.timer<=0){
      this.ring(p,true)
      if(this.battleStage===3){this.volleyAngle+=Math.PI/24;this.enter('thirdVolley',.22)}else this.finish()
    }else if(this.state==='thirdVolley'&&this.timer<=0){this.ring(p,true);this.finish()}
    else if(this.state==='recovery'&&this.timer<=0)this.enter('retreat',(.35+randomCombat()*.5)/(1+(this.stage-1)*.15))
  }
  override render(g:CanvasRenderingContext2D):void {
    const offset=this.motionHistory.offset(this.x,this.y)
    g.save();g.translate(offset.x,offset.y)
    try{this.renderBoss(g)}finally{g.restore()}
  }
  private renderBoss(g:CanvasRenderingContext2D):void {
    if(this.state==='hidden'&&this.alive){
      if(this.warning){
        const w=this.warning
        // 以本次预警经过时间驱动约 8Hz 紧张脉动，临近出招逐渐增大，但不闪灭。
        const elapsed=Math.max(0,this.duration-this.timer)
        const urgency=Math.min(1,elapsed/this.duration)
        const pulse=Math.sin(elapsed*Math.PI*16)
        const breath=.5+.5*pulse
        const markerScale=(1.15+.3*urgency)*(1+(.045+.02*urgency)*pulse)
        g.save();g.translate(w.x,w.y)
        // 地面落点投影：仅一枚柔和暗红光斑，不画箭头与符纹圈
        const sh=g.createRadialGradient(0,4,1,0,4,18)
        sh.addColorStop(0,`rgba(255,60,45,${.28+.22*breath})`);sh.addColorStop(1,'rgba(150,20,15,0)')
        g.globalCompositeOperation='lighter';g.fillStyle=sh
        g.beginPath();g.ellipse(0,4,18,7,0,0,Math.PI*2);g.fill()
        g.globalCompositeOperation='source-over'
        // 悬浮感叹号：缓慢增大叠加小幅快速缩放，亮度只微闪，始终清楚可辨。
        g.translate(0,-18+.6*Math.sin(elapsed*9))
        g.rotate(-.2);g.scale(markerScale,markerScale)
        g.globalAlpha=.94+.06*breath
        // 外发光
        g.globalCompositeOperation='lighter'
        const glow=g.createRadialGradient(0,-5,1,0,-5,24)
        glow.addColorStop(0,`rgba(255,80,55,${.34+.3*breath})`);glow.addColorStop(.55,'rgba(240,45,35,.14)');glow.addColorStop(1,'rgba(180,20,15,0)')
        g.fillStyle=glow;g.beginPath();g.arc(0,-5,24,0,Math.PI*2);g.fill()
        g.globalCompositeOperation='source-over'
        // 竖杆：粗壮圆角长牌，亮红渐变 + 深酒黑描边，任何地砖上都清晰
        const bar=new Path2D()
        const bx=-4.6,by=-18,bw=9.2,bh=19,br=4.6
        bar.moveTo(bx,by+br);bar.arcTo(bx,by,bx+br,by,br);bar.lineTo(bx+bw-br,by);bar.arcTo(bx+bw,by,bx+bw,by+br,br)
        bar.lineTo(bx+bw,by+bh-br);bar.arcTo(bx+bw,by+bh,bx+bw-br,by+bh,br);bar.lineTo(bx+br,by+bh);bar.arcTo(bx,by+bh,bx,by+bh-br,br);bar.closePath()
        const bg=g.createLinearGradient(0,by,0,by+bh)
        bg.addColorStop(0,'#ff7a52');bg.addColorStop(.35,'#f23024');bg.addColorStop(1,'#9c0e18')
        g.shadowColor='#ff2a18';g.shadowBlur=12+8*breath
        g.fillStyle=bg;g.fill(bar);g.shadowBlur=0
        g.strokeStyle='#3d0510';g.lineWidth=2;g.lineJoin='round';g.stroke(bar)
        // 杆身内高光
        g.strokeStyle='rgba(255,228,205,.85)';g.lineWidth=1.3;g.lineCap='round'
        g.beginPath();g.moveTo(-1.9,by+3.4);g.lineTo(-1.9,by+bh-4.2);g.stroke()
        // 圆点：饱满独立，与杆同材质
        g.shadowColor='#ff2a18';g.shadowBlur=10+6*breath
        const dg=g.createRadialGradient(-1,6.5,0.5,0,8.5,5.4)
        dg.addColorStop(0,'#ff7a52');dg.addColorStop(.5,'#ef2f23');dg.addColorStop(1,'#9c0e18')
        g.fillStyle=dg;g.beginPath();g.arc(0,8.5,4.8,0,Math.PI*2);g.fill();g.shadowBlur=0
        g.strokeStyle='#3d0510';g.lineWidth=2;g.beginPath();g.arc(0,8.5,4.8,0,Math.PI*2);g.stroke()
        g.fillStyle='rgba(255,228,205,.9)';g.beginPath();g.arc(-1.6,6.9,1.2,0,Math.PI*2);g.fill()
        g.restore()
      }
      return
    }
    if(this.haloAlpha>0)drawBossCastHalo(g,this.x,this.y+this.footOffset-82,this.clock,this.haloProgress,this.haloAlpha)
    const pose=this.state==='run'?'run':this.state==='roll'?'roll':this.state==='slash'?'slash':this.state==='cast'||this.state==='second'||this.state==='thirdVolley'||this.state==='break'||this.state==='timeSpell'?'cast':'walk'
    drawGrimm(g,this.x,this.y+this.footOffset,this.clock,pose,1-Math.max(0,this.timer)/this.duration,this.hitFlash,this.alive?(this.state==='break'&&this.breakTarget===2?(this.teleported?Math.min(1,(.65-this.timer)/.25):Math.max(0,(this.timer-.65)/.35)):1):this.dying/1.2,this.rigMotion,this.state==='break'?this.breakTarget:this.battleStage)
    if(this.state==='cast'){g.save();g.strokeStyle='#e04a38';g.lineWidth=2;g.globalAlpha=.8;g.beginPath();g.ellipse(this.x,this.y+this.footOffset,56+Math.sin(this.clock*25)*3,22,0,0,Math.PI*2);g.stroke();g.restore()}
  }
}
