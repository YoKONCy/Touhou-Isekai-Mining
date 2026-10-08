import type { EnemyBrain, EnemyAiHost } from './types'

/** 蝙蝠与三色精英共用阶段机制，各自的节拍、速度与弹幕全部读取内容定义。 */
export const chargeCycleBrain:EnemyBrain={
  id:'charge_cycle',
  think(h,dt,map,player,dist):void{
    if (player.untargetable && h.chargeStage !== 'dash') {
      h.pendingShots.length = 0; h.burstPending = false; h.windup = 'none'
      h.approachVelocity(0, 0, 9, dt); return
    }
    const c=h.def.chargeCycle
    if(!c)return
    if(!player.alive){h.ai='idle';h.vx=h.vy=0;h.pounceState='none';h.burstPending=false;return}
    if(h.alerted||dist<c.sight)h.ai='chase'
    if(h.ai!=='chase'){h.approachVelocity(0,0,9,dt);return}
    if(!h.canUseSkills){
      // 僵直只封出招，不封移动或拉扯计时；连击不能将整个阶段永久暂停。
      h.burstPending=false
      h.windup='none'
      if(h.chargeStage==='windup')startRetreat(h)
    }
    if(h.chargeStage==='dash'&&h.pounceState!=='lunge')startRetreat(h)
    const aim=Math.atan2(player.y-h.y,player.x-h.x)
    if(h.chargeStage==='chase'){
      h.chaseT+=dt
      if(c.chaseTimeout!==undefined&&h.chaseT>=c.chaseTimeout&&dist>c.triggerRange)startRetreat(h)
    }
    if(h.chargeStage==='windup'){
      h.vx=h.vy=0;h.pounceAng=aim;h.chargeT-=dt;h.pounceT=h.chargeT
      if(h.chargeT>0)return
      h.chargeStage='dash';h.pounceState='lunge';h.chargeHit=false
      h.chargeEndX=h.x;h.chargeEndY=h.y
      // 截取最长可通行终点，飞行越过地面障碍，但不会穿过墙壁。
      for(let step=1;step<=Math.ceil(c.dashDistance/4);step++){
        const d=Math.min(c.dashDistance,step*4)
        const x=h.x+Math.cos(aim)*d,y=h.y+Math.sin(aim)*d
        if(!h.canMoveTo(map,x,y))break
        h.chargeEndX=x;h.chargeEndY=y
      }
      h.chargeT=c.dashDistance/c.dashSpeed+.35
    }
    if(h.chargeStage==='dash'){
      const dx=h.chargeEndX-h.x,dy=h.chargeEndY-h.y,remaining=Math.hypot(dx,dy)
      h.chargeT-=dt
      if(remaining<1||h.chargeT<=0){startRetreat(h);return}
      const speed=Math.min(c.dashSpeed,remaining/Math.max(dt,.0001))
      h.vx=dx/remaining*speed;h.vy=dy/remaining*speed;return
    }
    if(h.chargeStage==='retreat'){
      h.chargeT-=dt
      if(h.chargeT<=0){h.chargeStage='chase';h.chaseT=0;h.burstPending=false;h.windup='none'}
      else{
        const velocity=h.wantVelocity(map,aim+Math.PI+h.strafeDir*.35,c.retreatSpeed)
        h.approachVelocity(velocity.x,velocity.y,10,dt)
        if(c.volley){
          h.straightCd-=dt
          if(h.canUseSkills&&h.burstPending){h.burstT-=dt;h.windupT=h.burstT;if(h.burstT<=0){h.pendingShots.push({kind:'straight',projectileId:c.volley.projectileId});h.burstPending=false;h.windup='none'}}
          if(h.canUseSkills&&!h.burstPending&&h.straightCd<=0){
            h.pendingShots.push({kind:'straight',projectileId:c.volley.projectileId})
            h.burstPending=true;h.burstT=c.volley.gap;h.straightCd+=c.volley.interval
            h.windup='straight';h.windupT=c.volley.gap
          }
        }
        return
      }
    }
    if(h.canUseSkills&&dist<=c.triggerRange){h.chargeStage='windup';h.chaseT=0;h.pounceState='windup';h.chargeT=c.windup;h.pounceT=c.windup;h.pounceAng=aim;h.vx=h.vy=0}
    else{const v=h.wantVelocity(map,aim,c.chaseSpeed);h.approachVelocity(v.x,v.y,10,dt)}
  }
}
function startRetreat(h:EnemyAiHost):void{
  const c=h.def.chargeCycle!
  h.chargeStage='retreat';h.chaseT=0;h.pounceState='none';h.vx=h.vy=0
  h.chargeT=c.retreatDuration[0]+Math.random()*(c.retreatDuration[1]-c.retreatDuration[0])
  h.straightCd=c.volley?.interval??0;h.burstPending=false;h.windup='none';h.strafeDir=Math.random()<.5?-1:1
}
