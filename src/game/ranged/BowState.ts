import { captureMotion, interpolatedPosition } from '../../core/simulation/interpolation'
import { randomCombat } from '../../core/simulation/random'
import type { Ammunition,ItemId,RangedAttack,WeaponGrip,WeaponBodyMotion } from '../../content/items/types'
import { getItemDef } from '../../shared/itemDefs'
import type { Inventory } from '../../shared/inventory'
import { calculateRangedDamage, type DamageKind } from '../../shared/combat'
import type { Enemy } from '../Enemy'
import type { TileMap } from '../tilemap'
import { sweepProjectileObstacles,type BulletBlocker } from '../projectileObstacles'
import { drawArrow, drawMagicArrow } from '../../content/items/vanilla/weapons/bowWood/appearance'
import { firstEnemyAlong } from '../CombatSpatial'
import { canvasViewport,visible } from '../../core/rendering/Viewport'
import { IRON_ARROW_ID } from '../../content/items/vanilla/ids'
import { quantizeDir4 } from '../art/rig/skeleton'
import { ARM_RIG,armShoulders } from '../art/rig/handGrip'

interface BowOwner {
  x:number;y:number;alive:boolean;facing:number;shootingDeviation:number;rangedCritChance:number;outgoingDamageBonus:number;knockbackBonus:number
  equipmentCombat:{critChance:number;penetration:number}
  physicalDamageMultiplier?:number
}
interface Drawing { item:ItemId;ammoId:ItemId;ammo:Ammunition;attack:RangedAttack;angle:number;aimOffset:number;chargedAimOffset:number;age:number;released:boolean;releaseRequested:boolean;releaseAt?:number;charged:boolean;readyNotified:boolean;recoverAge:number;releaseDraw:number;rollCritBonus:number;releaseGrip?:ReturnType<typeof bowGripGeometry>;rng:()=>number }
export interface ArrowShot { x:number;y:number;angle:number;speed:number;raw:number;critical:boolean;penetration:number;knockback:number;stun:number;ammoId:ItemId;dead:boolean;damageKind:DamageKind;pierceObstacles:boolean;pierceEnemies:boolean;empowered:boolean;hits:Set<string> }
const DRAW_TIME=.28,RECOVER_TIME=.22
/** 完整周期的弓将弹药射速倍率作用于各阶段，动作和实际射击周期保持一致。 */
const timingScale=(d:Drawing)=>d.attack.bowTiming?.intervalIncludesCharge?1/Math.max(.01,1+d.ammo.attackSpeed):1
const drawTime=(d:Drawing)=>(d.attack.bowTiming?.drawDuration??DRAW_TIME)*timingScale(d)
const recoverTime=(d:Drawing)=>Math.max(.001,(d.attack.bowTiming?.recoverDuration??RECOVER_TIME)*timingScale(d))
const chargeTime=(d:Drawing)=>(d.attack.charge?.duration??Infinity)*timingScale(d)
const visualRecoverAge=(d:Drawing)=>d.recoverAge*RECOVER_TIME/recoverTime(d)
const clamp=(n:number)=>Math.max(0,Math.min(1,n))
// 斜向射击采用侧身拉弓，避免正背身的肩线限制把弦推到弓身前面。
const bowBodyFacing=(aim:number)=>Math.abs(Math.cos(aim))>.35?(Math.cos(aim)>0?0:Math.PI):aim

/** 同时满足两条手臂长度的握点；弓身与弦不靠拉长袖子来扩大动作。 */
function bowGripGeometry(aim:number,extra:number) {
  const dir=quantizeDir4(bowBodyFacing(aim)),a=dir==='right'?Math.PI-aim:aim,u={x:Math.cos(a),y:Math.sin(a)}
  const {near,far}=armShoulders(dir),length=ARM_RIG.upper+ARM_RIG.lower-.02
  const w={x:far.x-near.x,y:far.y-near.y},dot=w.x*u.x+w.y*u.y
  const distance=Math.min(7.5+extra,-dot+Math.sqrt(Math.max(0,dot*dot+4*length*length-w.x*w.x-w.y*w.y)))
  const q={x:far.x+u.x*distance,y:far.y+u.y*distance},preferred={x:u.x*6,y:(near.y+far.y)/2+u.y*6}
  const apart=(p:{x:number;y:number},c:{x:number;y:number})=>Math.hypot(p.x-c.x,p.y-c.y)
  const inside=(p:{x:number;y:number})=>apart(p,near)<=length+.0001&&apart(p,q)<=length+.0001
  const candidates:Array<{x:number;y:number}>=[]
  if(inside(preferred))candidates.push(preferred)
  for(const center of [near,q]){
    const r=apart(preferred,center)||1,point={x:center.x+(preferred.x-center.x)*length/r,y:center.y+(preferred.y-center.y)*length/r}
    if(inside(point))candidates.push(point)
  }
  const dx=q.x-near.x,dy=q.y-near.y,r=Math.hypot(dx,dy)||1,h=Math.sqrt(Math.max(0,length*length-r*r/4))
  for(const sign of [-1,1])candidates.push({x:(near.x+q.x)/2-sign*dy/r*h,y:(near.y+q.y)/2+sign*dx/r*h})
  const main=candidates.sort((p,b)=>apart(p,preferred)-apart(b,preferred))[0]!
  return {dir,main,support:{x:main.x-u.x*distance,y:main.y-u.y*distance},pull:distance-7.5}
}

/** 点按完成普射，普通弓松手放箭，自动弓蓄满放箭；扣箭与实际释放同步。 */
export class BowState {
  readonly shots:ArrowShot[]=[]
  private drawing:Drawing|null=null
  private sequenceItem:ItemId|null=null
  private chargedStreak=0
  lastShotCharged=false
  cooldownAfterRelease=0
  get busy():boolean{return !!this.drawing}
  get ammunitionId():ItemId|undefined{return this.drawing?.ammoId}
  get nocked():boolean{return !!this.drawing&&!this.drawing.released}
  get charged():boolean {const d=this.drawing;return !!d&&(d.released?d.charged:!d.releaseRequested&&d.age>=chargeTime(d)-1e-8)}
  get releaseProgress():number|undefined{return this.drawing?.released?clamp(this.drawing.recoverAge/recoverTime(this.drawing)):undefined}
  get drawProgress():number|undefined {
    const d=this.drawing;if(!d)return undefined
    if(d.released)return d.releaseDraw*Math.max(0,1-visualRecoverAge(d)/.035)
    const draw=drawTime(d),full=d.attack.charge?chargeTime(d):draw
    return clamp(d.age/draw)*.76+.24*clamp((d.age-draw)/Math.max(.001,full-draw))
  }
  get pullDistance():number|undefined {const d=this.drawing;return d?bowGripGeometry(d.angle,(this.drawProgress??0)*8.5).pull:undefined}
  get bodyMotion():WeaponBodyMotion|undefined {
    const d=this.drawing;if(!d)return undefined
    const age=visualRecoverAge(d)
    const p=d.released?d.releaseDraw*Math.exp(-age/.07):this.drawProgress??0,recoil=d.released?Math.sin(clamp(age/.09)*Math.PI)*.7:0,load=p*1.5-recoil
    return {facing:bowBodyFacing(d.angle),lean:.12*p-.09*recoil,rootX:-Math.cos(d.angle)*load,rootY:-Math.sin(d.angle)*load}
  }
  start(owner:BowOwner,item:ItemId,bag:Inventory|null,rng:()=>number=randomCombat):number|null {
    if(!owner.alive||this.busy||!bag)return null
    const attack=getItemDef(item).ranged
    if(attack?.type!=='bow'||!attack.ammoFamily)return null
    const stack=bag.slots.find(stack=>stack&&stack.qty>0&&getItemDef(stack.id).ammunition?.family===attack.ammoFamily)
    if(!stack)return null
    const ammo={...getItemDef(stack.id).ammunition!}
    const deviation=owner.shootingDeviation+attack.accuracyPenalty-ammo.accuracyCorrection,spread=rng()*2-1
    const aimOffset=spread*Math.max(0,deviation)*Math.PI/180
    // 同一支箭沿用同一次偏差采样；蓄满只收窄偏差范围，不重掷方向。
    const chargedAimOffset=spread*Math.max(0,deviation-(attack.charge?.accuracyCorrection??0))*Math.PI/180
    if(this.sequenceItem!==item){this.sequenceItem=item;this.chargedStreak=0}
    this.drawing={item,ammoId:stack.id,ammo,attack:{...attack},angle:owner.facing+aimOffset,aimOffset,chargedAimOffset,age:0,released:false,releaseRequested:false,charged:false,readyNotified:false,recoverAge:0,releaseDraw:0,rollCritBonus:0,rng}
    return attack.attackInterval/Math.max(.01,1+ammo.attackSpeed)
  }
  tick(dt:number,held=false,released=false,aim?:number):boolean {
    const d=this.drawing;if(!d)return false
    d.age+=dt
    if(d.released){d.recoverAge+=dt;if(d.recoverAge>=recoverTime(d)-1e-8)this.drawing=null;return false}
    let ready=false
    if(!d.releaseRequested){
      const full=d.age>=chargeTime(d)-1e-8
      if(aim!==undefined)d.angle=aim+(full?d.chargedAimOffset:d.aimOffset)
      if(full&&!d.readyNotified){d.readyNotified=true;ready=true}
      if(released||!held||full&&d.attack.charge?.autoRelease){
        d.releaseRequested=true;d.charged=full
        d.releaseAt=full&&d.attack.charge?.autoRelease?chargeTime(d):Math.max(drawTime(d),d.age)
      }
    }
    return ready
  }
  /** 保护和暴击归当前拉弓动作；长闪仍打断，重复短闪取最大加成而不累加。 */
  onDodge(kind:'short'|'long',preserve:boolean,critChance:number):void {
    const d=this.drawing
    if(kind!=='short'||!preserve||!d?.attack.charge){this.cancelGesture();return}
    if(!d.released&&!d.releaseRequested)d.rollCritBonus=Math.max(d.rollCritBonus??0,critChance)
  }
  grip(facing:number):WeaponGrip {
    const d=this.drawing,aim=d?.angle??facing,geometry=d?.releaseGrip??bowGripGeometry(aim,(this.drawProgress??0)*8.5)
    // 放箭时弦独立回弹，拉弦手留在后方；随后才放松收手，不能追着弦向前拨。
    const age=d?visualRecoverAge(d):0
    const joining=d?clamp(d.age/.1):0,leaving=d?.released?1-clamp((age-.07)/.15):1
    const bowHand=d?.released?1-clamp((age-.1)/.12):1
    return {offset:0,weight:1,main:geometry.main,mainWeight:joining*bowHand,support:geometry.support,supportWeight:joining*leaving,weaponAngle:aim,inFront:geometry.dir!=='up'}
  }
  /** 实际握点在姿态同步后传入，箭从弓前发射；箭被移出背包时不凭空生成弹药。 */
  release(owner:BowOwner,bag:Inventory|null,hand:{x:number;y:number}):boolean {
    const d=this.drawing;if(!d)return false
    let fired=false
    if(!d.released&&d.releaseRequested&&d.age>=drawTime(d)-1e-8) {
      d.releaseDraw=this.drawProgress??0
      d.releaseGrip=bowGripGeometry(d.angle,d.releaseDraw*8.5)
      d.released=true
      // 归还逻辑帧越过释放时刻的余量，避免280ms+120ms被逐段取整成更慢的周期。
      if(d.attack.bowTiming?.intervalIncludesCharge)d.recoverAge=Math.max(0,d.age-(d.releaseAt??d.age))
      const index=bag?.slots.findIndex(stack=>stack?.id===d.ammoId&&stack.qty>0)??-1
      if(!owner.alive||!bag||index<0){this.cancelGesture();return false}
      bag.removeAt(index,1)
      const combat=getItemDef(d.item).combat
      const charge=d.charged?d.attack.charge:undefined
      this.chargedStreak=d.charged&&d.attack.chargedFinisher?this.chargedStreak+1:0
      const finisher=d.charged&&d.attack.chargedFinisher&&this.chargedStreak>=d.attack.chargedFinisher.count?d.attack.chargedFinisher:undefined
      if(finisher)this.chargedStreak=0
      const kind=finisher?.damageKind??d.attack.damageKind??'physical'
      const roll=calculateRangedDamage({base:(d.attack.damage+d.ammo.damage)*(finisher?.damageMultiplier??charge?.damageMultiplier??1)*(kind==='physical'?owner.physicalDamageMultiplier??1:1),damageBonus:owner.outgoingDamageBonus,
        critChance:(combat?.critChance??0)+d.ammo.critChance+owner.rangedCritChance+owner.equipmentCombat.critChance+(d.charged?(d.rollCritBonus??0):0)},d.rng)
      this.shots.push({x:hand.x+Math.cos(d.angle)*12,y:hand.y+Math.sin(d.angle)*12,angle:d.angle,speed:Math.max(1,(d.attack.speed+d.ammo.projectileSpeed)*(finisher?.speedMultiplier??charge?.speedMultiplier??1)),raw:roll.damage,critical:roll.critical,
        penetration:(combat?.penetration??0)+d.ammo.penetration+owner.equipmentCombat.penetration,knockback:(d.attack.knockback??0)+d.ammo.knockback+owner.knockbackBonus,stun:(d.attack.stun??0)+d.ammo.stun,ammoId:d.ammoId,dead:false,
        damageKind:finisher?.damageKind??d.attack.damageKind??'physical',pierceObstacles:finisher?.pierceObstacles??false,pierceEnemies:finisher?.pierceEnemies??false,empowered:!!finisher,hits:new Set()})
      fired=true
      this.lastShotCharged=d.charged
      const interval=d.attack.attackInterval/Math.max(.01,1+d.ammo.attackSpeed)
      // 完整周期从起拉计算，蓄力和收势不再额外叠加一份冷却；旧弓保留原规则。
      this.cooldownAfterRelease=d.attack.bowTiming?.intervalIncludesCharge
        ?Math.max(0,Math.max(interval,(d.releaseAt??d.age)+recoverTime(d))-d.age)
        :Math.max(recoverTime(d),interval-drawTime(d))
    }
    return fired
  }
  cancelGesture(resetSequence=false):void{this.drawing=null;if(resetSequence){this.sequenceItem=null;this.chargedStreak=0}}
  clear():void{this.cancelGesture(true);this.shots.length=0}
  updateFlights(dt:number,map:TileMap,blockers:readonly BulletBlocker[],enemies:readonly Enemy[],onHit:(enemy:Enemy,damage:number,critical:boolean,kind:DamageKind)=>void):void {
    for(const shot of this.shots) {
      captureMotion(shot)
      // 兼容旧续战快照里尚未保存命中集合的普通箭矢。
      shot.hits??=new Set<string>()
      let budget=shot.speed*dt
      // 连续扫掠比较整段飞行的首次接触，不让高速箭越过目标或墙体。
      while(budget>0&&!shot.dead) {
        const step=budget,x=shot.x+Math.cos(shot.angle)*step,y=shot.y+Math.sin(shot.angle)*step
        const obstacle=shot.pierceObstacles?null:sweepProjectileObstacles(map,blockers,shot.x,shot.y,x,y,1.5)
        const target=firstEnemyAlong(enemies,shot.x,shot.y,x,y,2,shot.hits)
        if(obstacle&&(!target||obstacle.fraction<=target.fraction)){shot.x=obstacle.x;shot.y=obstacle.y;shot.dead=true;break}
        const fraction=target?.fraction??1
        shot.x+=(x-shot.x)*fraction;shot.y+=(y-shot.y)*fraction;budget*=1-fraction
        if(target) {
          const enemy=target.enemy
          shot.hits.add(enemy.entityId)
          const kind=shot.damageKind??'physical'
          const damage=enemy.resolveDamage({base:shot.raw,penetration:shot.penetration},kind,true).damage,before=enemy.hp
          enemy.takeDamage(damage,shot.angle,shot.knockback,shot.stun,kind);shot.dead=!shot.pierceEnemies;onHit(enemy,Math.max(0,before-enemy.hp),shot.critical,kind)
        }
      }
      // 穿障碍只穿场内地形，飞出房间边界后回收，不能无限积累后台箭矢。
      if(shot.x<0||shot.y<0||shot.x>=map.cols*map.tile||shot.y>=map.rows*map.tile)shot.dead=true
    }
    let write=0;for(const shot of this.shots)if(!shot.dead)this.shots[write++]=shot;this.shots.length=write
  }
  render(g:CanvasRenderingContext2D):void {
    if (!this.shots.length) return
    const view=canvasViewport(g)
    for(const shot of this.shots){const position=interpolatedPosition(shot);if(!visible(view,position.x,position.y,65))continue;g.save();g.translate(position.x,position.y);g.rotate(shot.angle);if(shot.empowered)drawMagicArrow(g);else drawArrow(g,shot.ammoId===IRON_ARROW_ID);g.restore()}
  }
}
