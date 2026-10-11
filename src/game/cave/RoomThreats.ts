import type { BiomeDef } from '../../content/biomes/types'
import type { Enemy } from '../Enemy'
import type { Player } from '../Player'
import { Projectile,type GroundImpact } from '../Projectile'
import { TILE_FLOOR,TILE_LAVA,type TileMap } from '../tilemap'
import { randomCombat } from '../../core/simulation/random'
import { SpriteCache,bakeSprite,drawSprite } from '../../core/rendering/SpriteCache'
import { visible,type Viewport } from '../../core/rendering/Viewport'
import { drawWispBurstWarning } from '../../content/enemies/vanilla/oldHellAppearance'
import { sfx } from '../audio/Sfx'
import type { Prop } from '../art/props'
import { circleHitsProp } from '../art/props'
import type { FxLayer } from '../FxLayer'
import { damageLabel } from '../../shared/combat'
import { drawGroundFire } from '../art/oldHellFire'

interface Burst {x:number;y:number;source:string;remaining:number;duration:number;count:number;projectileId:string;angle:number;fired:boolean}
interface Puddle extends GroundImpact {remaining:number;age:number;seed:number;kind?:'flame'}
const sprites=new SpriteCache(4,128*1024)

/** 只保存模拟数据；定时增援、延迟死亡和地面伤害可随房间一同冻结、续战。 */
export class RoomThreats {
  private bursts:Burst[]=[]
  private puddles:Puddle[]=[]
  private damageClocks=new Map<string,number>()
  private trailAnchors=new Map<string,{x:number;y:number}>()
  private lavaClock:number|null=null
  private lavaProfile:BiomeDef['lavaEncounter']
  private shores:Array<{x:number;y:number}>=[]

  initialize(map:TileMap,biome:BiomeDef):void {
    const profile=biome.lavaEncounter
    if(!profile)return
    const t=map.tile
    for(let row=1;row<map.rows-1;row++)for(let col=1;col<map.cols-1;col++){
      if(map.tileAt(col,row)!==TILE_FLOOR)continue
      if([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>map.tileAt(col+dx!,row+dy!)===TILE_LAVA))this.shores.push({x:(col+.5)*t,y:(row+.5)*t})
    }
    if(this.shores.length){this.lavaProfile=profile;this.resetLavaClock()}
  }

  private resetLavaClock():void {
    const p=this.lavaProfile
    if(p)this.lavaClock=p.interval[0]+randomCombat()*(p.interval[1]-p.interval[0])
  }

  /** 每次只做一轮生成，不用累计补刷；离开房间后不调用此方法，保留剩余时间。 */
  updateLava(dt:number,map:TileMap,players:readonly Player[],enemies:readonly Enemy[],props:readonly Prop[],spawn:(id:string,x:number,y:number)=>void):void {
    if(this.lavaClock===null||!this.lavaProfile||!players.some(p=>p.alive))return
    this.lavaClock-=dt
    if(this.lavaClock>0)return
    this.resetLavaClock()
    const count=randomCombat()<.5?1:2
    for(let n=0;n<count;n++)for(let attempt=0;attempt<80;attempt++){
      const p=this.shores[Math.floor(randomCombat()*this.shores.length)]!
      if(players.some(player=>player.alive&&Math.hypot(p.x-player.x,p.y-player.y)<150))continue
      if(enemies.some(e=>e.alive&&Math.hypot(e.x-p.x,e.y-p.y)<e.r+25)||props.some(prop=>circleHitsProp(p.x,p.y,17,prop)))continue
      if([[0,0],[15,0],[-15,0],[0,15],[0,-15]].some(([dx,dy])=>map.solidAtWorld(p.x+dx!,p.y+dy!)))continue
      spawn(this.lavaProfile.enemyId,p.x,p.y);break
    }
  }

  onDeath(enemy:Enemy):void {
    const p=enemy.def.deathBurst
    if(!p)return
    this.bursts.push({x:enemy.x,y:enemy.y,source:enemy.entityId,remaining:p.delay,duration:p.delay,count:p.count,projectileId:p.projectileId,angle:randomCombat()*Math.PI*2,fired:false})
    sfx.fireBurst('warning')
  }

  updateBursts(dt:number,bullets:Projectile[],fx:FxLayer):void {
    for(const burst of this.bursts){
      if(burst.fired)continue
      burst.remaining-=dt
      if(burst.remaining>0)continue
      burst.fired=true
      for(let i=0;i<burst.count;i++){
        const bullet=new Projectile(burst.x,burst.y,burst.angle+i*Math.PI*2/burst.count,burst.projectileId)
        bullet.sourceId=burst.source;bullets.push(bullet)
      }
      fx.chips(burst.x,burst.y,'#ffd99b',14,180);sfx.fireBurst('burst')
    }
    // 只等待死亡预警，弹幕发出即允许清场；已发出的烈焰弹由自身寿命回收。
    this.bursts=this.bursts.filter(b=>!b.fired)
  }

  get blocksClear():boolean { return this.bursts.length>0 }

  addImpact(impact:GroundImpact,angle:number,map:TileMap,props:readonly Prop[],fx:FxLayer):void {
    const valid=(x:number,y:number)=>map.tileAt(Math.floor(x/map.tile),Math.floor(y/map.tile))===TILE_FLOOR&&!props.some(prop=>circleHitsProp(x,y,3,prop))
    let point:{x:number;y:number}|null=null
    // 从碰撞点沿来路回退，地火不能落进墙或隔着墙跳到另一边。
    for(let distance=0;distance<=map.tile;distance+=4){
      const x=impact.x-Math.cos(angle)*distance,y=impact.y-Math.sin(angle)*distance
      if(valid(x,y)){point={x,y};break}
      if(distance>0&&map.blocksProjectiles(Math.floor(x/map.tile),Math.floor(y/map.tile)))break
    }
    if(!point)return
    this.puddles.push({...impact,...point,remaining:impact.duration,age:0,seed:randomCombat()*Math.PI*2})
    fx.chips(point.x,point.y,'#efab69',7,95);sfx.fireBurst('splat')
  }

  /** 按实际经过的距离铺火，不按帧数增生；冲刺停下、死亡或中断便结束本段路径。 */
  updateChargeTrail(enemy:Enemy,fromX:number,fromY:number,wasCharging:boolean,map:TileMap,props:readonly Prop[]):void {
    const config=enemy.def.chargeCycle?.fireTrail
    if(!config)return
    if(!enemy.alive||!wasCharging&&enemy.pounceState!=='lunge'){
      this.trailAnchors.delete(enemy.entityId);return
    }
    if(Math.hypot(enemy.x-fromX,enemy.y-fromY)<.01)return
    const add=(x:number,y:number)=>{
      if(map.tileAt(Math.floor(x/map.tile),Math.floor(y/map.tile))!==TILE_FLOOR||props.some(prop=>circleHitsProp(x,y,3,prop)))return
      this.puddles.push({x,y,...config,kind:'flame',remaining:config.duration,age:0,seed:randomCombat()*Math.PI*2})
    }
    let anchor=this.trailAnchors.get(enemy.entityId)
    if(!anchor){anchor={x:fromX,y:fromY};this.trailAnchors.set(enemy.entityId,anchor);add(fromX,fromY)}
    const dx=enemy.x-anchor.x,dy=enemy.y-anchor.y,distance=Math.hypot(dx,dy),spacing=Math.max(4,config.spacing)
    const count=Math.floor(distance/spacing)
    for(let i=1;i<=count;i++)add(anchor.x+dx/distance*spacing*i,anchor.y+dy/distance*spacing*i)
    if(count>0){anchor.x+=dx/distance*spacing*count;anchor.y+=dy/distance*spacing*count}
    if(enemy.pounceState!=='lunge')this.trailAnchors.delete(enemy.entityId)
  }

  updateGround(dt:number,players:readonly Player[],fx:FxLayer):void {
    for(const [id,time] of this.damageClocks){
      if(!players.some(p=>p.entityId===id)){this.damageClocks.delete(id);continue}
      this.damageClocks.set(id,Math.max(0,time-dt))
    }
    for(const puddle of this.puddles){puddle.remaining-=dt;puddle.age+=dt}
    this.puddles=this.puddles.filter(p=>p.remaining>0)
    for(const player of players){
      if(!player.alive||(this.damageClocks.get(player.entityId)??0)>0)continue
      const puddle=this.puddles.find(p=>Math.hypot(player.x-p.x,player.y-p.y)<p.radius+player.collisionR)
      if(!puddle)continue
      // 计时按玩家消费，即使闪避免伤也不允许通过进出或重叠加速结算。
      this.damageClocks.set(player.entityId,puddle.interval)
      const before=player.hp
      player.takeHit(puddle.damage,0,'true',false,true)
      if(player.hp<before)fx.damageText(player.x,player.y-20,`-${damageLabel(before-player.hp)}`,'#efb07c')
    }
  }

  clear():void { this.bursts=[];this.puddles=[];this.damageClocks.clear();this.trailAnchors.clear();this.lavaClock=null }

  renderGround(g:CanvasRenderingContext2D,map:TileMap,view:Viewport):void {
    for(const p of this.puddles){
      if(!visible(view,p.x,p.y,p.radius+10))continue
      g.save();g.beginPath()
      const t=map.tile
      for(let row=Math.floor((p.y-p.radius)/t);row<=Math.floor((p.y+p.radius)/t);row++)for(let col=Math.floor((p.x-p.radius)/t);col<=Math.floor((p.x+p.radius)/t);col++)if(map.tileAt(col,row)===TILE_FLOOR)g.rect(col*t,row*t,t,t)
      g.clip();g.translate(p.x,p.y)
      if(p.kind==='flame'){
        g.globalAlpha*=.62*Math.min(1,p.age/.05,p.remaining/.22)
        drawGroundFire(g,0,0,p.seed+p.age*4,p.radius/20)
        g.restore();continue
      }
      g.scale(p.radius/27,p.radius/27)
      g.globalAlpha*=Math.min(1,p.age/.12,p.remaining/.65)
      const frame=Math.floor(p.seed)%3
      drawSprite(g,sprites.get(`puddle:${frame}`,()=>bakeSprite(-33,-30,66,60,c=>{
        const body=new Path2D('M-25-2Q-28-13-15-16Q-11-24-1-20Q11-25 17-14Q29-13 24-2Q30 10 16 15Q8 24-3 18Q-17 24-21 12Q-29 9-25-2Z')
        c.fillStyle='#2b2429';c.fill(body);c.strokeStyle='#9b513b';c.lineWidth=2.2;c.stroke(body)
        c.fillStyle='#a84d33';c.beginPath();c.ellipse(-1,-1,20,14,-.2,0,Math.PI*2);c.fill()
        c.strokeStyle='#e59c53';c.lineWidth=2.1;c.beginPath();c.moveTo(-20,-4);c.bezierCurveTo(-5,-12,-8,9,15,8);c.moveTo(-4,-14);c.lineTo(1,-6);c.lineTo(17,-8);c.stroke()
        c.fillStyle='#443039';c.beginPath();c.ellipse(-10,3,6,4,.4,0,Math.PI*2);c.ellipse(9,-8,4,2,-.3,0,Math.PI*2);c.fill()
        c.strokeStyle='#f7ca7d';c.lineWidth=.8;c.beginPath();c.moveTo(-17,-5);c.lineTo(-10,-5);c.moveTo(1,-4);c.lineTo(11,5);c.stroke()
      })))
      g.fillStyle='#ffe1a6';g.globalAlpha*=.4+.2*Math.sin(p.age*7+p.seed)
      for(let i=0;i<3;i++){const a=p.seed+i*2.1;g.beginPath();g.arc(Math.cos(a)*14,Math.sin(a)*10,1.2+Math.sin(p.age*6+i)*.5,0,Math.PI*2);g.fill()}
      g.restore()
    }
  }

  renderWarnings(g:CanvasRenderingContext2D,view:Viewport,time:number):void {
    for(const b of this.bursts)if(!b.fired&&visible(view,b.x,b.y,65))drawWispBurstWarning(g,b.x,b.y,Math.max(0,1-b.remaining/b.duration),b.angle,time)
  }
}
