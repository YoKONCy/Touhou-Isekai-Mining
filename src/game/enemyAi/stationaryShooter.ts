import type { EnemyBrain } from './types'

/** 固定根系的连续吐射，每一发请求都由房间重新瞄准玩家当前位置。 */
export const stationaryShooterBrain:EnemyBrain={id:'stationary_shooter',think(host,dt,_map,player,dist){
  if (player.untargetable) { host.windup='none';host.volleyLeft=0;host.pendingShots.length=0;return }
  const c=host.def.turret
  if(!c)return
  host.vx=host.vy=0
  if(!player.alive||!host.alerted&&dist>c.sight){host.windup='none';host.volleyLeft=0;return}
  host.ai='kite';host.pounceAng=Math.atan2(player.y-host.y,player.x-host.x)
  if(!host.canUseSkills){host.windup='none';host.volleyLeft=0;return}
  host.straightCd-=dt
  if(host.windup==='straight'){
    host.windupT-=dt
    if(host.windupT>0)return
    host.windup='none'
    host.pendingShots.push({kind:'straight',projectileId:c.projectileId})
    host.volleyLeft--;host.burstT=c.burstGap
    return
  }
  if(host.volleyLeft>0){
    host.burstT-=dt
    while(host.burstT<=0&&host.volleyLeft>0){host.pendingShots.push({kind:'straight',projectileId:c.projectileId});host.volleyLeft--;host.burstT+=c.burstGap}
    return
  }
  if(host.straightCd<=0){host.straightCd=c.interval;host.volleyLeft=Math.random()<c.burstChance?c.burstCount:1;host.windup='straight';host.windupT=c.windup}
}}
