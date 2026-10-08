import type { Ammunition,ItemId,RangedAttack,WeaponGrip,WeaponBodyMotion } from '../../content/items/types'
import { getItemDef } from '../../shared/itemDefs'
import type { Inventory } from '../../shared/inventory'
import { calculateRangedDamage } from '../../shared/combat'
import type { Enemy } from '../Enemy'
import type { TileMap } from '../tilemap'
import { sweepProjectileObstacles,type BulletBlocker } from '../projectileObstacles'
import { drawArrow } from '../../content/items/vanilla/weapons/bowWood/appearance'
import { IRON_ARROW_ID } from '../../content/items/vanilla/ids'
import { quantizeDir4 } from '../art/rig/skeleton'
import { ARM_RIG,armShoulders } from '../art/rig/handGrip'

interface BowOwner {
  x:number;y:number;alive:boolean;facing:number;shootingDeviation:number;rangedCritChance:number;outgoingDamageBonus:number;knockbackBonus:number
  equipmentCombat:{critChance:number;penetration:number}
}
interface Drawing { item:ItemId;ammoId:ItemId;ammo:Ammunition;attack:RangedAttack;angle:number;aimOffset:number;chargedAimOffset:number;age:number;released:boolean;releaseRequested:boolean;charged:boolean;readyNotified:boolean;recoverAge:number;releaseDraw:number;releaseGrip?:ReturnType<typeof bowGripGeometry>;rng:()=>number }
export interface ArrowShot { x:number;y:number;angle:number;speed:number;raw:number;critical:boolean;penetration:number;knockback:number;stun:number;ammoId:ItemId;dead:boolean }
const DRAW_TIME=.28,RECOVER_TIME=.22
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

/** 点按完成普射，长按蓄力后松手才发箭；背包扣箭与实际释放同步。 */
export class BowState {
  readonly shots:ArrowShot[]=[]
  private drawing:Drawing|null=null
  lastShotCharged=false
  cooldownAfterRelease=0
  get busy():boolean{return !!this.drawing}
  get ammunitionId():ItemId|undefined{return this.drawing?.ammoId}
  get nocked():boolean{return !!this.drawing&&!this.drawing.released}
  get charged():boolean {const d=this.drawing;return !!d&&(d.released?d.charged:!d.releaseRequested&&d.age>=(d.attack.charge?.duration??Infinity)-1e-8)}
  get releaseProgress():number|undefined{return this.drawing?.released?clamp(this.drawing.recoverAge/RECOVER_TIME):undefined}
  get drawProgress():number|undefined {
    const d=this.drawing;if(!d)return undefined
    if(d.released)return d.releaseDraw*Math.max(0,1-d.recoverAge/.035)
    return clamp(d.age/DRAW_TIME)*.76+.24*clamp((d.age-DRAW_TIME)/Math.max(.001,(d.attack.charge?.duration??DRAW_TIME)-DRAW_TIME))
  }
  get pullDistance():number|undefined {const d=this.drawing;return d?bowGripGeometry(d.angle,(this.drawProgress??0)*8.5).pull:undefined}
  get bodyMotion():WeaponBodyMotion|undefined {
    const d=this.drawing;if(!d)return undefined
    const p=d.released?d.releaseDraw*Math.exp(-d.recoverAge/.07):this.drawProgress??0,recoil=d.released?Math.sin(clamp(d.recoverAge/.09)*Math.PI)*.7:0,load=p*1.5-recoil
    return {facing:bowBodyFacing(d.angle),lean:.12*p-.09*recoil,rootX:-Math.cos(d.angle)*load,rootY:-Math.sin(d.angle)*load}
  }
  start(owner:BowOwner,item:ItemId,bag:Inventory|null,rng:()=>number=Math.random):number|null {
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
    this.drawing={item,ammoId:stack.id,ammo,attack:{...attack},angle:owner.facing+aimOffset,aimOffset,chargedAimOffset,age:0,released:false,releaseRequested:false,charged:false,readyNotified:false,recoverAge:0,releaseDraw:0,rng}
    return attack.attackInterval/Math.max(.01,1+ammo.attackSpeed)
  }
  tick(dt:number,held=false,released=false,aim?:number):boolean {
    const d=this.drawing;if(!d)return false
    d.age+=dt
    if(d.released){d.recoverAge+=dt;if(d.recoverAge>=RECOVER_TIME)this.drawing=null;return false}
    if(!d.releaseRequested){
      const full=d.age>=(d.attack.charge?.duration??Infinity)-1e-8
      if(aim!==undefined)d.angle=aim+(full?d.chargedAimOffset:d.aimOffset)
      if(released||!held){d.releaseRequested=true;d.charged=full}
    }
    if(!d.readyNotified&&!d.releaseRequested&&this.charged){d.readyNotified=true;return true}
    return false
  }
  grip(facing:number):WeaponGrip {
    const d=this.drawing,aim=d?.angle??facing,geometry=d?.releaseGrip??bowGripGeometry(aim,(this.drawProgress??0)*8.5)
    // 放箭时弦独立回弹，拉弦手留在后方；随后才放松收手，不能追着弦向前拨。
    const joining=d?clamp(d.age/.1):0,leaving=d?.released?1-clamp((d.recoverAge-.07)/.15):1
    const bowHand=d?.released?1-clamp((d.recoverAge-.1)/.12):1
    return {offset:0,weight:1,main:geometry.main,mainWeight:joining*bowHand,support:geometry.support,supportWeight:joining*leaving,weaponAngle:aim,inFront:geometry.dir!=='up'}
  }
  /** 实际握点在姿态同步后传入，箭从弓前发射；箭被移出背包时不凭空生成弹药。 */
  release(owner:BowOwner,bag:Inventory|null,hand:{x:number;y:number}):boolean {
    const d=this.drawing;if(!d)return false
    let fired=false
    if(!d.released&&d.releaseRequested&&d.age>=DRAW_TIME-1e-8) {
      d.releaseDraw=this.drawProgress??0
      d.releaseGrip=bowGripGeometry(d.angle,d.releaseDraw*8.5)
      d.released=true
      const index=bag?.slots.findIndex(stack=>stack?.id===d.ammoId&&stack.qty>0)??-1
      if(!owner.alive||!bag||index<0){this.cancelGesture();return false}
      bag.removeAt(index,1)
      const combat=getItemDef(d.item).combat
      const charge=d.charged?d.attack.charge:undefined
      const roll=calculateRangedDamage({base:(d.attack.damage+d.ammo.damage)*(charge?.damageMultiplier??1),damageBonus:owner.outgoingDamageBonus,critChance:(combat?.critChance??0)+d.ammo.critChance+owner.rangedCritChance+owner.equipmentCombat.critChance},d.rng)
      this.shots.push({x:hand.x+Math.cos(d.angle)*12,y:hand.y+Math.sin(d.angle)*12,angle:d.angle,speed:Math.max(1,(d.attack.speed+d.ammo.projectileSpeed)*(charge?.speedMultiplier??1)),raw:roll.damage,critical:roll.critical,
        penetration:(combat?.penetration??0)+d.ammo.penetration+owner.equipmentCombat.penetration,knockback:(d.attack.knockback??0)+d.ammo.knockback+owner.knockbackBonus,stun:(d.attack.stun??0)+d.ammo.stun,ammoId:d.ammoId,dead:false})
      fired=true
      this.lastShotCharged=d.charged
      // 普射保持原有点击间隔，长蓄力松手后仍留出收势时间，防止立即补射。
      this.cooldownAfterRelease=Math.max(RECOVER_TIME,d.attack.attackInterval/Math.max(.01,1+d.ammo.attackSpeed)-DRAW_TIME)
    }
    return fired
  }
  cancelGesture():void{this.drawing=null}
  clear():void{this.cancelGesture();this.shots.length=0}
  updateFlights(dt:number,map:TileMap,blockers:readonly BulletBlocker[],enemies:readonly Enemy[],onHit:(enemy:Enemy,damage:number,critical:boolean)=>void):void {
    for(const shot of this.shots) {
      let budget=shot.speed*dt
      // 短步扫掠兼顾近距离目标和墙前命中，不让高速箭越过目标。
      while(budget>0&&!shot.dead) {
        const step=Math.min(3,budget),x=shot.x+Math.cos(shot.angle)*step,y=shot.y+Math.sin(shot.angle)*step
        const obstacle=sweepProjectileObstacles(map,blockers,shot.x,shot.y,x,y,1.5)
        if(obstacle){shot.dead=true;break}
        shot.x=x;shot.y=y;budget-=step
        for(const enemy of enemies) {
          if(!enemy.canBeHit||!enemy.containsHit(x,y,2))continue
          const resisted=calculateRangedDamage({base:shot.raw,resistance:enemy.def.combat.physicalResist,penetration:shot.penetration}).damage
          const damage=enemy.effects.modify('damageTaken',enemy.effects.modify('physicalDamageTaken',resisted)),before=enemy.hp
          enemy.takeDamage(damage,shot.angle,shot.knockback,shot.stun);shot.dead=true;onHit(enemy,Math.max(0,before-enemy.hp),shot.critical);break
        }
      }
    }
    for(let i=this.shots.length-1;i>=0;i--)if(this.shots[i].dead)this.shots.splice(i,1)
  }
  render(g:CanvasRenderingContext2D):void {
    for(const shot of this.shots){g.save();g.translate(shot.x,shot.y);g.rotate(shot.angle);drawArrow(g,shot.ammoId===IRON_ARROW_ID);g.restore()}
  }
}
