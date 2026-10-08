import { Enemy, type PlayerLike } from './Enemy'
import type { TileMap } from './tilemap'
import def from '../content/enemies/vanilla/overloadedKedama'
import { BOSS_FURRY_WAVE_ID, BOSS_FURRY_SEED_ID, BOSS_FURRY_ORBIT_ID, BOSS_SPIRAL_ID, BOSS_LINGER_ID, BOSS_SPIRAL_STAGE2_ID, BOSS_LINGER_STAGE2_ID } from '../content/projectiles/vanilla/kedamaBossBullets'
import { PlayerAnimator } from './art/rig/playerAnims'
import { drawOverloadedKedamaRig } from './art/rig/fourthFloorCharacters'
import { drawKedamaFur } from './art/kedamaFur'
import { drawKedamaCharge, drawKedamaDashWake, drawKedamaMoveWarning, drawKedamaTeleport, type BossTrail } from './art/kedamaBossEffects'

type Mode = 'intro' | 'windup' | 'shoot' | 'move' | 'recovery' | 'phase' | 'defeated'
type Skill = 'wave' | 'seed' | 'orbit' | 'dash' | 'spiral' | 'linger'
interface OrbitVolley {x:number;y:number;angle:number;phase:number;age:number;fired:number;count:number}
const TAU = Math.PI * 2
export const KEDAMA_DASH_DISTANCE = 350 * .3 * 3.5
export const KEDAMA_WALL_MARGIN = 80

/** 两段首领采用独立招式表，伤害、技能封印和减速仍走正式敌人链路。 */
export class KedamaBoss extends Enemy {
  stage: 1 | 2 = 1
  mode: Mode = 'intro'
  phasePending = false
  restoreProgress = 0
  shown = true
  entranceProgress = 1
  ornamentDropTime = -1
  defeatProgress = 0
  phaseBreakProgress = -1
  private clock = 0
  private timer = 0
  private elapsed = 0
  private skill: Skill = 'wave'
  private previous: Skill = 'dash'
  private fired = 0
  private lockedAngle = 0
  private moveAngle = 0
  private ready = .5
  private movementCount = 0
  private teleportNext = false
  private destination = { x:0,y:0 }
  private dashSpeed = KEDAMA_DASH_DISTANCE / .3
  private teleportFx: {x:number;y:number;tx:number;ty:number;age:number} | null = null
  private dashTrail: BossTrail[] = []
  private dashTrailClock = 0
  private lean = 0
  private readonly orbitVolleys:OrbitVolley[]=[]
  private readonly animator = new PlayerAnimator()
  constructor(x: number, y: number) { super(x,y,def.id,def) }
  override get canBeHit(): boolean { return this.alive && this.mode !== 'intro' && this.mode !== 'phase' }
  override get emerging(): boolean { return !this.canBeHit }
  override get removed(): boolean { return false }
  override clearPendingAttacks():void {super.clearPendingAttacks();this.orbitVolleys.length=0}
  beginBattle(): void { this.shown=true;this.entranceProgress=1;this.enter('recovery',.8) }
  beginSecondStage(): void { this.stage=2;this.phasePending=false;this.phaseBreakProgress=-1;this.enter('recovery',1.4);this.stunT=0 }
  override takeDamage(amount:number,angle:number,kb?:number,stun?:number):void {
    if(!this.canBeHit)return
    super.takeDamage(this.stage===1?Math.min(amount,Math.max(0,this.hp-this.maxHp*.5)):amount,angle,kb,stun)
    if(this.alive&&this.stage===1&&this.hp<=this.maxHp*.5) {this.phasePending=true;this.mode='phase';this.clearPendingAttacks();this.vx=this.vy=0;this.dashTrail=[]}
    else if(!this.alive) {this.mode='defeated';this.clearPendingAttacks();this.vx=this.vy=0;this.dashTrail=[]}
  }
  private enter(mode:Mode,duration:number):void {this.mode=mode;this.timer=duration;this.elapsed=0}
  private prepareSkill(map:TileMap,p:PlayerLike,aim:number):void {
    const choices:Skill[]=this.stage===2?['wave','seed','orbit','dash','spiral','linger']:['wave','seed','dash','spiral','linger']
    const pool=choices.filter(skill=>skill!==this.previous);this.skill=pool[Math.floor(Math.random()*pool.length)];this.previous=this.skill
    this.lockedAngle=aim;if(this.skill==='dash')this.planMovement(map,p,aim)
    this.ready=this.skill==='seed'?.7:this.skill==='orbit'?.85:this.skill==='linger'?.8:this.skill==='spiral'?.35:.4
    this.fired=0;this.enter('windup',this.ready)
  }
  /** 脱手后的发射点独立计时，不随本体位移，也不占用本体技能节拍。 */
  private updateOrbitVolleys(dt:number):void {
    for(const volley of this.orbitVolleys){
      volley.age+=dt
      while(volley.fired<volley.count&&volley.age+1e-8>=volley.fired*.2){
        const a=volley.phase+volley.fired*.2*1.6+volley.fired*Math.PI/2
        this.pendingShots.push({kind:'straight',projectileId:BOSS_FURRY_ORBIT_ID,angle:volley.angle+(volley.fired-(volley.count-1)/2)*.1,origin:{x:volley.x+Math.cos(a)*46,y:volley.y+Math.sin(a)*25}})
        volley.fired++
      }
    }
    for(let i=this.orbitVolleys.length-1;i>=0;i--)if(this.orbitVolleys[i].age>=(this.orbitVolleys[i].count-1)*.2+.18)this.orbitVolleys.splice(i,1)
  }
  private safe(map:TileMap,x:number,y:number):boolean {
    const b=map.bounds,m=KEDAMA_WALL_MARGIN
    return x>=b.left+m&&x<=b.right-m&&y>=b.top+m&&y<=b.bottom-m&&this.canMoveTo(map,x,y)
  }
  private move(map:TileMap,angle:number,speed:number,dt:number):void {
    speed*=this.effects.modify('moveSpeed',1)
    for(const offset of [0,.45,-.45,.9,-.9,1.6,-1.6,Math.PI]) {
      const a=angle+offset,x=this.x+Math.cos(a)*speed*dt,y=this.y+Math.sin(a)*speed*dt
      if(!this.safe(map,x,y))continue
      this.vx=Math.cos(a)*speed;this.vy=Math.sin(a)*speed;map.moveEntity(this,dt,true);return
    }
  }
  private planMovement(map:TileMap,p:PlayerLike,aim:number):void {
    this.teleportNext=(this.movementCount+1)%4===0
    const b=map.bounds,m=KEDAMA_WALL_MARGIN+16
    if(this.teleportNext) {
      const corners=[{x:b.left+m,y:b.top+m},{x:b.right-m,y:b.top+m},{x:b.left+m,y:b.bottom-m},{x:b.right-m,y:b.bottom-m}]
      this.destination=corners.filter(c=>this.safe(map,c.x,c.y)).sort((a,c)=>Math.hypot(c.x-p.x,c.y-p.y)-Math.hypot(a.x-p.x,a.y-p.y))[0]??{x:this.x,y:this.y}
      return
    }
    // 对整条冲刺路径采样；优先完整距离和远离墙的终点，避免沿岩壁滑行。
    let score=-Infinity,bestAngle=aim+Math.PI/2,bestDistance=0
    for(let i=0;i<48;i++) {
      const angle=aim+Math.PI/2+i*TAU/48;let distance=0
      for(let step=1;step<=24;step++) {const d=KEDAMA_DASH_DISTANCE*step/24;if(!this.safe(map,this.x+Math.cos(angle)*d,this.y+Math.sin(angle)*d))break;distance=d}
      const x=this.x+Math.cos(angle)*distance,y=this.y+Math.sin(angle)*distance
      const clearance=Math.min(x-b.left,b.right-x,y-b.top,b.bottom-y)
      const value=distance*4+Math.min(180,clearance)+Math.hypot(x-p.x,y-p.y)*.08
      if(value>score){score=value;bestAngle=angle;bestDistance=distance}
    }
    this.moveAngle=bestAngle;this.dashSpeed=bestDistance/.3
    this.destination={x:this.x+Math.cos(bestAngle)*bestDistance,y:this.y+Math.sin(bestAngle)*bestDistance}
  }
  /** 对白冻结战斗时只推进 sprite 演出与拖影消散。 */
  updatePresentation(dt:number):void {
    this.clock+=dt;if(this.ornamentDropTime>=0)this.ornamentDropTime+=dt
    if(this.teleportFx){this.teleportFx.age+=dt;if(this.teleportFx.age>.55)this.teleportFx=null}
    for(const point of this.dashTrail)point.age+=dt
    this.dashTrail=this.dashTrail.filter(point=>point.age<.28)
    const target=this.mode==='move'?Math.cos(this.moveAngle)*.22:0
    this.lean+=(target-this.lean)*(1-Math.exp(-dt*18))
    this.animator.update(dt,{speed:0,moveAngle:Math.PI/2,aim:Math.PI/2,armed:false})
  }
  override update(dt:number,map:TileMap,p:PlayerLike):void {
    this.updatePresentation(dt);this.effects.update(dt);this.stunT=Math.max(0,this.stunT-dt);this.contactCd=Math.max(0,this.contactCd-dt)
    this.vx=this.vy=0
    if(!this.alive||this.mode==='intro'||this.mode==='phase'||!p.alive||p.untargetable)return
    if(this.effects.incapacitated){this.pendingShots.length=0;this.updateOrbitVolleys(dt);return}
    this.updateOrbitVolleys(dt)
    const aim=Math.atan2(p.y-this.y,p.x-this.x),distance=Math.hypot(p.x-this.x,p.y-this.y)
    if(!this.canUseSkills){this.enter('recovery',.35);this.move(map,aim+Math.PI+.5,55,dt);return}
    this.timer-=dt;this.elapsed+=dt
    if(this.mode==='recovery') {
      if(this.timer>0)return
      this.prepareSkill(map,p,aim);return
    }
    if(this.mode==='windup') {
      if(this.timer>0)return
      if(this.skill==='dash') {
        this.movementCount++
        if(this.teleportNext) {
          this.teleportFx={x:this.x,y:this.y,tx:this.destination.x,ty:this.destination.y,age:0}
          this.dashTrail.push({x:this.x,y:this.y,age:0,lean:this.lean,time:this.clock})
          this.x=this.destination.x;this.y=this.destination.y;this.enter('recovery',.65)
        }else{this.dashTrailClock=0;this.enter('move',.3)}
      }else this.enter('shoot',10)
      return
    }
    if(this.mode==='move') {
      const step=Math.min(dt,Math.max(0,this.timer+dt)),speed=this.dashSpeed*this.effects.modify('moveSpeed',1)
      // 限制到已验证路径的终点；低帧率也不越过预告距离。
      const length=Math.min(speed*step,Math.hypot(this.destination.x-this.x,this.destination.y-this.y))
      const slices=Math.max(1,Math.ceil(length/20))
      for(let i=0;i<slices;i++) {
        this.dashTrailClock+=step/slices
        if(this.dashTrailClock>=.025){this.dashTrailClock=0;this.dashTrail.push({x:this.x,y:this.y,age:0,lean:this.lean,time:this.clock})}
        const nx=this.x+Math.cos(this.moveAngle)*length/slices,ny=this.y+Math.sin(this.moveAngle)*length/slices
        if(!this.safe(map,nx,ny)){this.timer=0;break}
        this.vx=Math.cos(this.moveAngle)*speed;this.vy=Math.sin(this.moveAngle)*speed
        map.moveEntity(this,step/slices,true)
      }
      if(this.timer<=0)this.enter('recovery',this.stage===2?.65:.8)
      return
    }
    if(this.mode!=='shoot')return
    if(this.skill==='wave') {
      const count=this.stage===2?30:12
      // 两发一组，二阶段加长后半轮，总计三十发。
      while(this.fired<count) {
        const pair=Math.floor(this.fired/2),at=pair<6?pair*.12:.95+(pair-6)*.12
        if(this.elapsed<at)break
        this.pendingShots.push({kind:'straight',projectileId:BOSS_FURRY_WAVE_ID,angle:aim+Math.sin(pair*1.25-.7)*.18+(this.fired%2?1:-1)*.065});this.fired++
      }
      if(distance<130)this.move(map,aim+Math.PI+.55,65,dt)
      if(this.fired===count)this.enter('recovery',this.stage===2?.95:1.15)
    }else if(this.skill==='seed') {
      const count=this.stage===2?5:2
      while(this.fired<count&&this.elapsed>=this.fired*.7){this.pendingShots.push({kind:'straight',projectileId:BOSS_FURRY_SEED_ID,angle:aim+(this.fired-(count-1)/2)*.12});this.fired++}
      if(this.fired===count)this.enter('recovery',1.1)
    }else if(this.skill==='orbit') {
      if(this.stage===2){
        this.orbitVolleys.push({x:this.x,y:this.y-18,angle:this.lockedAngle,phase:this.clock*1.6,age:0,fired:0,count:10})
        this.updateOrbitVolleys(0)
        this.prepareSkill(map,p,aim);return
      }
      const count=4
      while(this.fired<count&&this.elapsed>=this.fired*.2) {
        const a=this.clock*1.6+this.fired*Math.PI/2
        this.pendingShots.push({kind:'straight',projectileId:BOSS_FURRY_ORBIT_ID,angle:this.lockedAngle+(this.fired-(count-1)/2)*.1,origin:{x:this.x+Math.cos(a)*46,y:this.y-18+Math.sin(a)*25}});this.fired++
      }
      if(this.fired===count)this.enter('recovery',1.3)
    }else if(this.skill==='spiral') {
      const waves=this.stage===2?3:1,projectileId=this.stage===2?BOSS_SPIRAL_STAGE2_ID:BOSS_SPIRAL_ID
      while(this.fired<waves&&this.elapsed>=this.fired*.3){
        // 三波错开各自的空隙，弹体半径持续增长，直到撞墙或命中回收。
        for(let i=0;i<20;i++)this.pendingShots.push({kind:'straight',projectileId,angle:this.lockedAngle+i*TAU/20+this.fired*TAU/60,origin:{x:this.x,y:this.y}})
        this.fired++
      }
      if(this.fired===waves)this.enter('recovery',.7)
    }else if(this.skill==='linger') {
      const points:Array<{x:number;y:number}>=[],candidates:Array<{x:number;y:number}>=[],b=map.bounds
      // 打乱带小幅随机偏移的候选网格，保证八点分散，随机数退化时也不叠在一处。
      for(let row=0;row<6;row++)for(let col=0;col<8;col++)candidates.push({x:b.left+80+(b.right-b.left-160)*(col+.5)/8+(Math.random()-.5)*24,y:b.top+80+(b.bottom-b.top-160)*(row+.5)/6+(Math.random()-.5)*24})
      for(let i=candidates.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]]}
      for(const point of candidates) {
        if(!this.canMoveTo(map,point.x,point.y)||Math.hypot(point.x-p.x,point.y-p.y)<=90||points.some(other=>Math.hypot(point.x-other.x,point.y-other.y)<=65))continue
        points.push(point);this.pendingShots.push({kind:'straight',projectileId:this.stage===2?BOSS_LINGER_STAGE2_ID:BOSS_LINGER_ID,angle:0,origin:point});if(points.length===8)break
      }
      this.enter('recovery',1)
    }
  }
  override render(g:CanvasRenderingContext2D):void {
    if(!this.shown)return
    const k=Math.max(0,Math.min(1,this.restoreProgress)),entrance=1-Math.pow(1-this.entranceProgress,3)
    g.save();g.translate((1-entrance)*140,(1-entrance)*-65)
    const pose=this.animator.build(Math.PI/2),moving=this.mode==='move'||Math.hypot(this.vx,this.vy)>10
    for(const volley of this.orbitVolleys){
      const fade=Math.min(1,((volley.count-1)*.2+.18-volley.age)/.18)
      for(let i=0;i<4;i++){
        const a=volley.phase+volley.age*1.6+i*Math.PI/2
        g.save();g.globalAlpha*=Math.max(0,fade);g.translate(volley.x+Math.cos(a)*46,volley.y+Math.sin(a)*25)
        g.shadowColor='#d5a9ec';g.shadowBlur=10;drawKedamaFur(g,7,{mouthOpen:i===(volley.fired-1)%4?.85:.35});g.restore()
      }
    }
    for(const point of this.dashTrail) {
      g.save();g.globalAlpha*=Math.max(0,1-point.age/.28)*.26
      drawOverloadedKedamaRig(g,point.x,point.y-6,{...pose,time:point.time},{overload:0,expression:'playful',lean:point.lean});g.restore()
    }
    drawKedamaDashWake(g,this.dashTrail,this.x,this.y,this.moveAngle,this.mode==='move'?1:0)
    if(this.teleportFx){const f=this.teleportFx;drawKedamaTeleport(g,f.x,f.y,f.age,false);drawKedamaTeleport(g,f.tx,f.ty,f.age,true)}
    if(this.mode==='windup'&&this.skill==='dash') {
      if(this.teleportNext)drawKedamaTeleport(g,this.destination.x,this.destination.y,(this.elapsed/this.ready)*.35,true)
      else drawKedamaMoveWarning(g,this.x,this.y,this.destination.x,this.destination.y,this.elapsed/this.ready)
    }
    g.fillStyle='#15131d66';g.beginPath();g.ellipse(this.x,this.y+25,27,9,0,0,TAU);g.fill()
    if(this.phaseBreakProgress>=0&&this.phaseBreakProgress<1){const p=this.phaseBreakProgress;g.save();g.globalAlpha*=Math.sin(p*Math.PI)*.8;g.strokeStyle='#efcefa';g.lineWidth=2;g.beginPath();g.ellipse(this.x,this.y+8,20+p*72,9+p*32,0,0,TAU);g.stroke();for(let i=0;i<12;i++){const a=i*TAU/12+p*3;g.beginPath();g.moveTo(this.x+Math.cos(a)*(22+p*30),this.y-12+Math.sin(a)*(20+p*30));g.lineTo(this.x+Math.cos(a)*(29+p*45),this.y-12+Math.sin(a)*(27+p*45));g.stroke()}g.restore()}
    if(k<1) {
      g.save();g.globalAlpha*=1-k;g.translate(this.x,this.y)
      const hitFall=this.mode==='defeated'?Math.sin(Math.min(1,this.defeatProgress)*Math.PI)*14:0
      g.scale(1-k*.65,1-k*.65)
      if(this.mode==='defeated'&&this.defeatProgress<1)g.translate(Math.sin(this.clock*40)*(1-this.defeatProgress)*3,hitFall)
      if(this.phaseBreakProgress>=0&&this.phaseBreakProgress<1)g.translate(Math.sin(this.clock*42)*(1-this.phaseBreakProgress)*3,-Math.sin(this.phaseBreakProgress*Math.PI)*7)
      const cast=this.mode==='windup'?Math.min(1,this.elapsed/this.ready):this.mode==='shoot'?.7:this.mode==='phase'?.9:0
      const spiralSwing=this.skill==='spiral'&&this.mode==='windup'?Math.sin(Math.min(1,this.elapsed/this.ready)*Math.PI):this.skill==='spiral'&&this.mode==='shoot'?Math.sin(Math.min(1,(this.elapsed%.3)/.18)*Math.PI):this.skill==='spiral'&&this.mode==='recovery'?Math.max(0,1-this.elapsed/.2):0
      drawOverloadedKedamaRig(g,0,-6+Math.sin(this.clock*2)*1.1,pose,{overload:this.mode==='defeated'?0:this.stage===2?1:.65,cast,sideCast:spiralSwing,lean:this.lean+(spiralSwing*.14)+(this.mode==='defeated'?Math.sin(this.defeatProgress*Math.PI)*.25:0),wingDroop:Math.max(0,Math.min(1,this.ornamentDropTime/.25)),expression:this.mode==='defeated'?'hurt':moving?'playful':'neutral'})
      drawKedamaCharge(g,0,-9,cast,this.clock);g.restore()
      if(this.skill==='orbit'&&(this.mode==='windup'||this.mode==='shoot'))for(let i=this.fired;i<4;i++){const a=this.clock*1.6+i*Math.PI/2;g.save();g.translate(this.x+Math.cos(a)*46,this.y-18+Math.sin(a)*25);drawKedamaFur(g,10);g.restore()}
    }
    if(this.ornamentDropTime>=0)for(let i=0;i<4;i++){const age=this.ornamentDropTime-i*.09;if(age<0||age>.85)continue;const a=i*Math.PI/2+.45,fall=Math.min(1,age/.45);g.save();g.globalAlpha*=Math.min(1,(.85-age)/.4);g.translate(this.x+Math.cos(a)*(42+fall*8),this.y-20+Math.sin(a)*22+fall*fall*37);g.rotate(fall*.7);drawKedamaFur(g,7,{blink:true});g.restore()}
    if(k>0){g.save();g.globalAlpha*=k;g.translate(this.x,this.y+13+Math.sin(k*Math.PI)*-12);g.scale(1,.9);drawKedamaFur(g,17,{crying:true});g.restore()}
    g.restore()
  }
}
