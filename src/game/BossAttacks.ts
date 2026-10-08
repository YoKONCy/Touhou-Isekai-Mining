import type { EngineContext } from '../core/types'
import type { Player } from './Player'
import type { TileMap } from './tilemap'
import type { FxLayer } from './FxLayer'
import { sfx } from './audio/Sfx'
import { grimmSound, grimmSpellSplit } from '../content/enemies/vanilla/grimmAudio'
import { bladeErasesProjectile } from './weaponProjectileSweep'
import { damageLabel } from '../shared/combat'
import { sweepProjectileObstacles, type BulletBlocker } from './projectileObstacles'

export type BossHazard = {
  kind: 'mist'|'bolt'|'seal'|'laser'|'slash'|'smoke'|'oath'|'rift'|'shardSeed'
  x:number; y:number; age:number; delay:number; duration:number
  rx:number; ry:number; angle:number; speed:number; hit:boolean; fired:boolean
  ox:number; oy:number; phase:number
  returning?:boolean; bend?:number; dark?:boolean; fixed?:boolean
  reach?:number; activeDuration?:number
  split?:boolean; targetX?:number; targetY?:number
  removed?:boolean
}
const flyingHazard = (h: BossHazard) => h.kind === 'mist' || h.kind === 'bolt' || h.kind === 'oath' || h.kind === 'shardSeed'
/** 飞行弹以碰撞结束生命周期，返流 duration 只控制轨迹周期；定时法阵、激光仍按时结束。 */
export class BossAttacks {
  hazards: BossHazard[]=[]
  /** 每根 hazard 私有的渐变缓存：渐变在创建时凝固于当前变换，固定不动的法阵柱可在存活期跨帧复用，
   *  动态透明度改由 globalAlpha 控制，避免 16 柱齐射时每帧新建上百个渐变对象。 */
  private gradCache=new WeakMap<BossHazard,{ctx:unknown,map:Map<string,CanvasGradient>}>()
  private cachedGrad(h:BossHazard,g:CanvasRenderingContext2D,key:string,make:()=>CanvasGradient):CanvasGradient{
    let slot=this.gradCache.get(h)
    if(!slot||slot.ctx!==g){slot={ctx:g,map:new Map()};this.gradCache.set(h,slot)}
    let grad=slot.map.get(key)
    if(!grad){grad=make();slot.map.set(key,grad)}
    return grad
  }
  add(kind:BossHazard['kind'],x:number,y:number,options:Partial<BossHazard>={}):void {
    this.hazards.push({kind,x,y,ox:x,oy:y,age:0,delay:0,duration:1,rx:12,ry:12,angle:0,speed:0,hit:false,fired:false,phase:0,...options})
  }
  clear():void {this.hazards=[]}
  clearBullets(x:number,y:number,r:number):void {
    this.hazards=this.hazards.filter(h=>!(h.kind==='mist'||h.kind==='bolt'||h.kind==='oath'||h.kind==='shardSeed')||Math.hypot(h.x-x,h.y-y)>r)
  }
  update(dt:number,p:Player,map:TileMap,engine:EngineContext,fx:FxLayer,blockers:readonly BulletBlocker[]=[]):void {
    for(const h of this.hazards){
      const before=h.age;h.age+=dt
      if(h.age<h.delay)continue
      const t=h.age-h.delay
      // 跨过激活时刻也结算一次，避免低帧率漏掉短激光。
      if(h.removed||!flyingHazard(h)&&before>h.delay+h.duration)continue
      const px=h.x,py=h.y
      if(!h.fired){
        h.fired=true
        if(h.kind==='seal'||h.kind==='laser'||h.kind==='rift')grimmSound(sfx, h.kind==='laser'?'laser':'impact')
        if(h.kind==='rift'){grimmSound(sfx, 'slash');engine.shake(.22)}
      }
      if(h.kind==='mist'){
        // 黄金比例旋臂：环整体外扩并旋转 1.618 圈，每发弹绕自身行进中心先外扩后回卷。
        const life=h.returning?t%h.duration:Math.max(0,t)
        const c=Math.cos(h.angle),s=Math.sin(h.angle),b=map.bounds
        const wallX=Math.abs(c)<1e-6?Infinity:(c>0?b.right-h.ox:h.ox-b.left)/Math.abs(c)
        const wallY=Math.abs(s)<1e-6?Infinity:(s>0?b.bottom-h.oy:h.oy-b.top)/Math.abs(s)
        // duration 是返流周期，不是飞行寿命；所有飞行弹都由实际障碍碰撞回收。
        const outward=Math.max(24,h.reach??Math.min(wallX-110,wallY-110))/(h.speed*.6)
        const travel=h.returning?outward*Math.sin(Math.PI*life/h.duration):life
        const span=h.returning?outward:h.duration
        const phi=(1+Math.sqrt(5))/2, theta=travel*(2*Math.PI*phi/span)
        const curl=118*Math.pow(Math.max(0,Math.sin(Math.PI*travel/span)),.9)
        const drift=h.speed*.6*travel
        h.x=h.ox+Math.cos(h.angle)*drift+Math.cos(h.angle+theta)*curl
        h.y=h.oy+Math.sin(h.angle)*drift+Math.sin(h.angle+theta)*curl
      }else if(h.kind==='shardSeed'){
        // 前段减速滑行，中段停驻收束；定向扇射锁定发射时的目标，不持续追踪。
        const u=Math.min(1,t/.75),distance=(h.reach??260)*(1-Math.pow(1-u,3))
        h.x=h.ox+Math.cos(h.angle)*distance;h.y=h.oy+Math.sin(h.angle)*distance
      }else if(h.kind==='oath'){
        const u=h.returning?(t%h.duration)/h.duration:Math.min(1,t/h.duration)
        // 返流弹在中点自然减速，先停再回；原点锁定，不追踪角色。
        const distance=h.returning?(h.reach??h.speed*h.duration/Math.PI)*Math.sin(Math.PI*u):h.speed*t
        const a=h.angle+(h.bend??0)*Math.sin(Math.PI*u)
        h.x=h.ox+Math.cos(a)*distance;h.y=h.oy+Math.sin(a)*distance
      }else if(h.kind==='bolt'){
        if(!h.fixed&&!p.untargetable&&t<.16){const aim=Math.atan2(p.y-h.y,p.x-h.x);const diff=Math.atan2(Math.sin(aim-h.angle),Math.cos(aim-h.angle));h.angle+=Math.max(-.6*dt,Math.min(.6*dt,diff))}
        h.x+=Math.cos(h.angle)*h.speed*dt;h.y+=Math.sin(h.angle)*h.speed*dt
      }
      if (h.removed) continue
      if (flyingHazard(h)) {
        const wall = sweepProjectileObstacles(map, blockers, px, py, h.x, h.y, h.rx)
        if (wall) { h.x = wall.x; h.y = wall.y; h.removed = true; continue }
      }
      if ((h.kind==='mist'||h.kind==='bolt'||h.kind==='oath'||h.kind==='shardSeed') && p.getProjectileErasure().length
        && bladeErasesProjectile(p.getProjectileErasure(),h.x,h.y,h.rx,px,py)) {
        h.removed=true;fx.chips(h.x,h.y,'#dec9c0',4,70);continue
      }
      let hit=false
      if(h.kind==='mist'||h.kind==='bolt'||h.kind==='oath'||h.kind==='shardSeed'){
        const dx=h.x-px,dy=h.y-py,len=dx*dx+dy*dy
        const k=len?Math.max(0,Math.min(1,((p.x-px)*dx+(p.y-py)*dy)/len)):0
        hit=Math.hypot(p.x-px-k*dx,p.y-py-k*dy)<=h.rx+p.hitR
      }else if(h.kind==='seal'){
        hit=((p.x-h.x)/(h.rx+p.hitR))**2+((p.y-h.y)/(h.ry+p.hitR))**2<=1
      }else if(h.kind==='laser'||h.kind==='rift'){
        const dx=p.x-h.x,dy=p.y-h.y,c=Math.cos(h.angle),s=Math.sin(h.angle)
        const along=dx*c+dy*s
        const active=h.activeDuration??h.duration
        const head=h.kind==='rift'?-h.rx+2*h.rx*Math.min(1,t/.04):h.rx
        hit=(h.kind!=='rift'||before-h.delay<=active)&&Math.abs(-dx*s+dy*c)<=h.ry+p.hitR&&along>=-h.rx-p.hitR&&along<=head+p.hitR
      }
      else if(h.kind==='slash'){
        const a=Math.atan2(p.y-h.y,p.x-h.x)-h.angle
        hit=Math.hypot(p.x-h.x,p.y-h.y)<=h.rx+p.hitR&&Math.abs(Math.atan2(Math.sin(a),Math.cos(a)))<=1.35
      }
      if(hit&&!h.hit&&p.alive&&!p.isInvincible&&!p.debugGod){
        const hp=p.hp;p.takeHit(10,h.angle,h.kind==='slash'?'physical':'magic',flyingHazard(h));h.hit=true
        fx.damageText(p.x,p.y-20,'-'+damageLabel(hp-p.hp),'#bc9cd9');fx.chips(p.x,p.y,'#a394bc',8,160);engine.shake(.16)
        if(flyingHazard(h))h.removed=true
      }
      // 分裂放在撞墙、消弹和玩家命中之后，已被消灭的种子不能再生成弹幕。
      if(h.kind==='shardSeed'&&!h.removed&&t>=1.2&&!h.split){
        h.split=true
        grimmSpellSplit(sfx, Math.max(-.65,Math.min(.65,(h.x-p.x)/400)))
        const aim=Math.atan2((h.targetY??p.y)-h.y,(h.targetX??p.x)-h.x)
        for(let i=-2;i<=2;i++)this.add('oath',h.x,h.y,{angle:aim+i*.19,speed:235,rx:5.5,duration:7,phase:i,dark:i%2===0,bend:i*.035})
        h.removed=true
      }
    }
    this.hazards=this.hazards.filter(h=>!h.removed&&(flyingHazard(h)||h.age<h.delay+h.duration))
  }
  render(g:CanvasRenderingContext2D,map:TileMap):void {
    g.save()
    try{
      for(const h of this.hazards){
        const t=h.age-h.delay
        // 只有激光把提示线压缩到预警最初 0.1 秒；法阵等其他攻击的预警仍覆盖整个 delay。
        const hint=h.kind==='laser'?.1:Infinity,warnEnd=Math.min(h.delay,hint)
        const warning=t<0&&h.age<warnEnd
        const k=warning?Math.max(0,h.age/Math.max(.01,warnEnd)):Math.min(1,Math.max(0,t)/h.duration)
        g.save()
        // 单个特效绘制即便抛错也必须恢复状态，防止 lighter 泄漏污染整帧导致白屏。
        try{
          g.globalAlpha=1;g.globalCompositeOperation='source-over';g.shadowBlur=0
          g.translate(h.x,h.y)
          if(h.kind==='mist'||h.kind==='smoke'||h.kind==='bolt'||h.kind==='slash'){
            // 软体/近战特效统一裁剪在墙内（外扩 8px 容错），尾焰雾缘不可能泄到墙外黑区
            g.save();g.beginPath();g.rect(map.bounds.left-8-h.x,map.bounds.top-8-h.y,
              map.bounds.right-map.bounds.left+16,map.bounds.bottom-map.bounds.top+16);g.clip()
          }
          // 飞行弹幕在墙缘再叠加一层纯视觉羽化，裁剪边被淡出，不会硬切（不改变位置与碰撞）
          if(h.kind==='mist'||h.kind==='smoke'||h.kind==='bolt'){
            const m=h.kind==='bolt'?60:h.kind==='smoke'?40:24
            const ef=Math.min(1,(h.x-(map.bounds.left-m))/m,(map.bounds.right+m-h.x)/m,(h.y-(map.bounds.top-m))/m,(map.bounds.bottom+m-h.y)/m)
            g.globalAlpha=Math.max(0,ef)
          }
          if(h.kind==='laser')this.renderLaser(g,h,map,t,warning,k)
          else if(h.kind==='rift')this.renderRift(g,h,map,t,k)
          else if(h.kind==='oath'||h.kind==='shardSeed'){
             g.save();g.beginPath();g.rect(map.bounds.left-h.x,map.bounds.top-h.y,map.bounds.right-map.bounds.left,map.bounds.bottom-map.bounds.top);g.clip()
            this.renderOath(g,h,t);g.restore()
          }
          else if(h.kind==='seal')this.renderSeal(g,h,t,warning,k)
          else if(h.kind==='bolt')this.renderBolt(g,h,t,k)
          else if(h.kind==='mist'||h.kind==='smoke')this.renderMist(g,h,t,k)
          else if(h.kind==='slash')this.renderSlash(g,h,t,k)
          if(h.kind==='mist'||h.kind==='smoke'||h.kind==='bolt'||h.kind==='slash')g.restore()
        }finally{g.restore()}
      }
    }finally{
      // 双保险：无论内部发生什么，离开时画面状态必须是干净的。
      g.restore();g.globalAlpha=1;g.globalCompositeOperation='source-over';g.shadowBlur=0;g.setLineDash([])
    }
  }
  /** 高能激光：提示线只在预警最初一瞬；激活后为猩红黑束、柔和外晕与连续白炽核心，整体裁剪在墙内。 */
  private renderLaser(g:CanvasRenderingContext2D,h:BossHazard,map:TileMap,t:number,warning:boolean,k:number):void {
    const left=-h.rx,right=h.rx,w=h.rx*2
    // 先在世界空间裁剪，再旋转束坐标，斜向激光也不泄漏到墙外。
    g.save();g.beginPath();g.rect(map.bounds.left-h.x,map.bounds.top-h.y,map.bounds.right-map.bounds.left,map.bounds.bottom-map.bounds.top);g.clip();g.rotate(h.angle)
    g.beginPath();g.rect(left,-h.ry*4,w,h.ry*8);g.clip()
    g.setLineDash([])
    if(warning){
      const a=.3+.6*k
      const band=g.createLinearGradient(0,-h.ry,0,h.ry)
      band.addColorStop(0,'rgba(255,70,60,0)');band.addColorStop(.5,`rgba(255,70,60,${.05*a})`);band.addColorStop(1,'rgba(255,70,60,0)')
      g.fillStyle=band;g.fillRect(left,-h.ry,w,h.ry*2)
      g.globalCompositeOperation='lighter'
      g.strokeStyle=`rgba(255,170,150,${.75*a})`;g.lineWidth=1
      g.beginPath();g.moveTo(left,0);g.lineTo(right,0);g.stroke()
      g.strokeStyle=`rgba(255,110,90,${.5*a})`
      for(const cx of [left,right]){g.beginPath();g.moveTo(cx,-6);g.lineTo(cx,6);g.stroke()}
      g.globalCompositeOperation='source-over'
      g.restore()
      return
    }
    if(t<0){g.restore();return}
    // 击打包络：快速点亮、持续短促、快速熄灭
    const e=Math.min(1,k*7)*Math.min(1,(1-k)*10),fl=.82+.18*Math.sin(t*96)
    // 击发瞬间冲击（前 35%）：爆闪强度随击发快速衰减，是压迫感的主要来源
    const strike=Math.min(1,k/.35),flash=Math.pow(1-strike,1.5)
    // 沿束等离子噪声：多频正弦叠加，让光带边缘与光丝始终翻涌扭结，绝不出现"贴图直棍"
    const N=(u:number,o:number)=>.55*Math.sin(u*9+o+t*.6)+.3*Math.sin(u*23-o*1.7+t*3.2)+.15*Math.sin(u*51+o*2.3+t*7)
    const SEG=42
    // 上下边缘随 fn 起伏的连续能量带（替代硬边 fillRect）
    const band=(fn:(u:number)=>number,fill:string|CanvasGradient)=>{
      g.beginPath()
      for(let i=0;i<=SEG;i++){const u=i/SEG,x=left+w*u,y=fn(u);i?g.lineTo(x,-y):g.moveTo(x,-y)}
      for(let i=SEG;i>=0;i--){g.lineTo(left+w*(i/SEG),fn(i/SEG))}
      g.closePath();g.fillStyle=fill;g.fill()
    }
    // ⓪ 压光暗带：高能束击发前先把上下地面压暗，亮芯对比更强（多束重叠也只到温和压暗）
    g.globalCompositeOperation='source-over'
    const press=g.createLinearGradient(0,-h.ry*4,0,h.ry*4)
    press.addColorStop(0,'rgba(8,1,3,0)');press.addColorStop(.5,`rgba(8,1,3,${.15*e})`);press.addColorStop(1,'rgba(8,1,3,0)')
    g.fillStyle=press;g.fillRect(left,-h.ry*4,w,h.ry*8)
    // ① 三层不规则泛光：带宽/频率/速度各不相同，边缘是翻卷的软光而不是直线
    g.globalCompositeOperation='lighter'
    for(const [mul,peak,o] of [[4.4,.05*(1+flash),1.3],[2.5,.1*(1+.5*flash),4.1],[1.5,.16*(1+.4*flash),7.7]] as const){
      const gr=g.createLinearGradient(0,-h.ry*mul,0,h.ry*mul)
      gr.addColorStop(0,'rgba(255,60,40,0)');gr.addColorStop(.5,`rgba(238,60,42,${peak*e})`);gr.addColorStop(1,'rgba(255,60,40,0)')
      band(u=>h.ry*mul*(.86+.18*N(u,o)),gr)
    }
    // ② 黑束主体：上下边缘随等离子噪声起伏
    g.globalCompositeOperation='source-over'
    const body=g.createLinearGradient(0,-h.ry*1.05,0,h.ry*1.05)
    body.addColorStop(0,'#2a0e0c');body.addColorStop(.18,'#160607');body.addColorStop(.5,'#070203');body.addColorStop(.82,'#160607');body.addColorStop(1,'#2a0e0c')
    band(u=>h.ry*(.9+.14*N(u,2.2)),body)
    // ③ 内焰两层不规则热层（宽度沿束起伏，叠出明暗层次）
    g.globalCompositeOperation='lighter'
    const heat1=g.createLinearGradient(0,-h.ry*.62,0,h.ry*.62)
    heat1.addColorStop(0,'rgba(255,80,50,0)');heat1.addColorStop(.5,`rgba(255,86,52,${(.26+.14*flash)*e})`);heat1.addColorStop(1,'rgba(255,80,50,0)')
    band(u=>h.ry*.55*(.78+.3*N(u,5.6)),heat1)
    const heat2=g.createLinearGradient(0,-h.ry*.3,0,h.ry*.3)
    heat2.addColorStop(0,'rgba(255,150,95,0)');heat2.addColorStop(.5,`rgba(255,150,100,${(.3+.18*flash)*e})`);heat2.addColorStop(1,'rgba(255,150,95,0)')
    band(u=>h.ry*.27*(.7+.36*N(u,9.2)),heat2)
    // ④ 等离子光丝：三条沿束蜿蜒扭结，主丝白炽、副丝橙红
    g.lineCap='round'
    for(let j=2;j>=0;j--){
      g.beginPath()
      for(let i=0;i<=SEG;i++){const u=i/SEG,x=left+w*u
        const y=Math.sin(u*10+t*(6+j*2.2)+j*2.1)*h.ry*.2+Math.sin(u*27-t*8.5+j*3)*h.ry*.09
        i?g.lineTo(x,y):g.moveTo(x,y)}
      if(j===0){g.strokeStyle=`rgba(255,242,224,${(.92+.08*flash)*e*fl})`;g.lineWidth=1.7+1.6*flash;g.shadowColor='#ffb088';g.shadowBlur=12}
      else{g.strokeStyle=`rgba(255,${150+40*j},95,${.55*e*fl})`;g.lineWidth=1.1}
      g.stroke()
    }
    g.shadowBlur=0
    // 沿束传播的高亮结：脉冲沿束跑动并在击发瞬间膨胀
    for(let p=0;p<2;p++){
      const u=(t*(.55+p*.19)+p*.47)%1,x=left+w*u
      const y=Math.sin(u*10+t*(6+p*2.2)+p*2.1)*h.ry*.2,kr=7+7*flash
      const kg=g.createRadialGradient(x,y,1,x,y,kr*2.2)
      kg.addColorStop(0,`rgba(255,250,240,${.9*e*fl})`);kg.addColorStop(.4,`rgba(255,170,110,${.4*e})`);kg.addColorStop(1,'rgba(255,90,50,0)')
      g.fillStyle=kg;g.beginPath();g.arc(x,y,kr*2.2,0,Math.PI*2);g.fill()
    }
    // ⑤ 边缘电弧：高频跳变的锯齿分叉闪电（每 1/26 秒重排）
    const tick=Math.floor(t*26),Hh=(n:number)=>{const s=Math.sin(n*127.1+h.phase*13+tick*7.7)*43758.5453;return s-Math.floor(s)}
    g.lineWidth=1
    for(let i=0;i<24;i++){
      const f=Hh(i*3.1)
      if(f<.32)continue
      const u=((i*41.7+h.phase*9)%1),x=left+w*u,side=i%2?1:-1
      const hy=h.ry*(.9+.14*N(u,2.2)),len=(5+f*13)*(.45+flash)
      g.strokeStyle=`rgba(255,${190+50*f},150,${.55*f*e})`
      g.beginPath();g.moveTo(x,side*hy);g.lineTo(x+(f-.5)*4,side*(hy+len*.5));g.lineTo(x+(f-.5)*7,side*(hy+len));g.stroke()
    }
    g.lineCap='butt'
    // 墙端：击发瞬间的扩散半环 + 垂直放射芒 + 熔接点
    for(const cx of [left,right]){
      const inward=cx===left?1:-1
      if(flash>0){
        // 朝房间内侧扩散的冲击半环
        for(const [lw,col] of [[6,`rgba(255,120,80,${.3*flash})`],[2,`rgba(255,235,220,${.6*flash})`]] as const){
          g.strokeStyle=col;g.lineWidth=lw
          g.beginPath();g.arc(cx,0,4+h.ry*2.6*(1-flash),inward>0?-Math.PI/2:Math.PI/2,inward>0?Math.PI/2:Math.PI*1.5);g.stroke()
        }
        // 贴墙的垂直放射短芒
        g.strokeStyle=`rgba(255,180,140,${.55*flash})`;g.lineWidth=1.4
        for(let m=-2;m<=2;m++){
          const y0=m*h.ry*.62,y1=y0+Math.sign(m||1)*h.ry*.5*flash
          g.beginPath();g.moveTo(cx,y0);g.lineTo(cx+inward*4*flash,y1);g.stroke()
        }
      }
      const pg=g.createRadialGradient(cx,0,1,cx,0,h.ry*(1.25+flash))
      pg.addColorStop(0,`rgba(255,${214+30*flash},180,${(.5+.4*flash)*e*fl})`);pg.addColorStop(.5,`rgba(230,70,45,${.2*e})`);pg.addColorStop(1,'rgba(150,25,15,0)')
      g.fillStyle=pg;g.beginPath();g.arc(cx,0,h.ry*(1.25+flash),0,Math.PI*2);g.fill()
    }
    g.globalCompositeOperation='source-over'
    g.restore()
  }
  /** 黑暗法阵：预警为断裂旋转的猩红剧团符印（非机械等分）；激活为边缘翻滚的黑红火柱、
   *  柱内上升焰纹、地面焦黑裂隙与双层不规则冲击环，多柱齐放不糊屏。
   *  性能：渐变全部峰值化后按柱缓存、零 shadowBlur（用 lighter 双描模拟辉光）、路径降采样、
   *  虚线模式三种复用、淡出末期跳过细小粒子。 */
  private renderSeal(g:CanvasRenderingContext2D,h:BossHazard,t:number,warning:boolean,k:number):void {
    // 稳定的伪随机散列：让每一处断口/刻痕/火星都不对称，且每根柱各自不同
    const Hh=(n:number)=>{const s=Math.sin(n*127.1+h.phase*3.7)*43758.5453;return s-Math.floor(s)}
    if(warning){
      g.save();g.scale(h.rx,h.ry)
      const breathe=.65+.35*Math.sin(h.age*5.2)
      // 地面暗红染斑（呼吸）——渐变按峰值缓存，透明度走 globalAlpha
      g.globalCompositeOperation='lighter'
      g.globalAlpha=k*breathe
      const stain=this.cachedGrad(h,g,'sealStain',()=>{
        const gr=g.createRadialGradient(0,0,.12,0,0,1.18)
        gr.addColorStop(0,'rgba(206,42,28,.13)');gr.addColorStop(.6,'rgba(150,30,24,.06)');gr.addColorStop(1,'rgba(120,20,16,0)')
        return gr
      })
      g.fillStyle=stain;g.beginPath();g.arc(0,0,1.18,0,Math.PI*2);g.fill()
      // 中心暗核
      g.globalCompositeOperation='source-over'
      g.fillStyle=`rgba(18,3,6,${.6*k})`;g.beginPath();g.arc(0,0,.24,0,Math.PI*2);g.fill()
      g.globalCompositeOperation='lighter';g.lineCap='round'
      // 断裂外符环：5 段不闭合、长短/半径/角度错落、缓慢正转；无 shadow，宽暗底描+细亮线双描出辉光
      for(let i=0;i<5;i++){
        const base=i*Math.PI*2/5+h.age*.45+(Hh(i)-.5)*.12
        const len=.55+.5*Hh(i+9),rad=.95+.05*Hh(i+3)
        const col=i%2?'#ff5a3c':'#e04438'
        g.strokeStyle=col;g.lineWidth=.055
        g.beginPath();g.arc(0,0,rad,base,base+len);g.stroke()
        g.strokeStyle=`rgba(255,${i%2?90:106},${i%2?60:72},.9)`;g.lineWidth=.022
        g.beginPath();g.arc(0,0,rad,base,base+len);g.stroke()
      }
      // 内圈碎弧：6 段更细、反向旋转
      for(let i=0;i<6;i++){
        const base=-i*Math.PI*2/6-h.age*.7+(Hh(i+20)-.5)*.15
        g.strokeStyle=`rgba(255,110,84,${.75*k})`;g.lineWidth=.013
        g.beginPath();g.arc(0,0,.66,base,base+.34+.2*Hh(i+14));g.stroke()
      }
      // 不等长径向刻痕
      for(let i=0;i<9;i++){
        const a=i*Math.PI*2/9+h.age*.2+(Hh(i+30)-.5)*.05,r1=.8+.13*Hh(i+33)
        g.strokeStyle=`rgba(255,120,92,${(.55+.4*Hh(i+40))*k})`;g.lineWidth=.016
        g.beginPath();g.moveTo(Math.cos(a)*.78,Math.sin(a)*.78);g.lineTo(Math.cos(a)*r1,Math.sin(a)*r1);g.stroke()
      }
      // 内接三角符印（剧团尖徽）
      g.strokeStyle=`rgba(255,90,66,${.55*k*breathe})`;g.lineWidth=.02
      g.beginPath()
      for(let i=0;i<=3;i++){const a=-Math.PI/2+i*Math.PI*2/3,x=Math.cos(a)*.5,y=Math.sin(a)*.5;i?g.lineTo(x,y):g.moveTo(x,y)}
      g.stroke()
      // 中心猩红核
      g.globalAlpha=k*breathe
      const cd=this.cachedGrad(h,g,'sealCore',()=>{
        const gr=g.createRadialGradient(0,0,0,0,0,.14)
        gr.addColorStop(0,'rgba(255,120,80,.85)');gr.addColorStop(1,'rgba(200,40,25,0)')
        return gr
      })
      g.fillStyle=cd;g.beginPath();g.arc(0,0,.14,0,Math.PI*2);g.fill()
      g.globalAlpha=1;g.restore();g.lineCap='butt';g.globalCompositeOperation='source-over'
      if(k>.7){
        const p=(k-.7)/.3
        g.globalCompositeOperation='lighter';g.globalAlpha=.4*p
        g.strokeStyle='#ff9a80';g.lineWidth=1
        g.beginPath();g.moveTo(0,-96*p);g.lineTo(0,0);g.stroke()
        g.globalAlpha=1;g.globalCompositeOperation='source-over'
      }
      return
    }
    // 击打节奏：前 22% 砸落点亮，之后是快速衰减的余波
    const strike=Math.min(1,k/.22),fade=Math.max(0,1-(k-.22)/.78),e=strike*fade,top=-160
    // 柱宽与边缘翻滚量都沿柱高变化（顶部窄而稳、底部宽而乱）
    const Hf=(y:number)=>{const v=(y-top)/(6-top);return h.rx*(.12+.6*v)}
    const J=(y:number,o:number)=>{const v=(y-top)/(6-top);return (.05+.11*v)*(Math.sin(y*.11+o+t*8)+.5*Math.sin(y*.27-o-t*5))}
    // ① 落点宽泛光（峰值渐变缓存）+ ② 焦黑地面斑（22 点不规则边缘，砸落时展开）
    g.save();g.scale(h.rx,h.ry);g.globalCompositeOperation='lighter';g.globalAlpha=e
    const glow=this.cachedGrad(h,g,'sealGlow',()=>{
      const gr=g.createRadialGradient(0,4,.1,0,4,1.5)
      gr.addColorStop(0,'rgba(255,110,70,.3)');gr.addColorStop(.5,'rgba(200,45,30,.12)');gr.addColorStop(1,'rgba(150,25,18,0)')
      return gr
    })
    g.fillStyle=glow;g.beginPath();g.arc(0,4,1.5,0,Math.PI*2);g.fill()
    g.globalAlpha=1;g.globalCompositeOperation='source-over'
    g.beginPath()
    const br=.92*(.55+.45*strike),NQ=22
    for(let q=0;q<=NQ;q++){
      const a=q*Math.PI*2/NQ,rr=br*(1+.09*Math.sin(a*4+t*3+h.phase)+.05*Math.sin(a*9-h.phase))
      const x=Math.cos(a)*rr,y=Math.sin(a)*rr;q?g.lineTo(x,y):g.moveTo(x,y)
    }
    g.closePath();g.fillStyle='rgba(20,3,5,.82)';g.fill()
    g.restore()
    // ③ 地面裂隙：6 条锯齿折线，长度/方向都不对称（淡出末期直接省略）
    if(k<.8){
      g.globalCompositeOperation='lighter';g.lineCap='round'
      for(let i=0;i<6;i++){
        const a=i*Math.PI/3+(Hh(i+50)-.5)*.5,len=h.rx*(.5+Hh(i+55))*(.4+.6*strike)
        g.strokeStyle=`rgba(255,${90+60*Hh(i+60)},55,${.4*strike*fade})`;g.lineWidth=1.2
        g.beginPath()
        for(let s=0;s<=3;s++){const v=s/3,x=Math.cos(a)*len*v+(Hh(i*7+s)-.5)*7,y=6+Math.sin(a)*len*v+(Hh(i*9+s)-.5)*7;s?g.lineTo(x,y):g.moveTo(x,y)}
        g.stroke()
      }
      g.lineCap='butt'
    }
    // ④ 体积弱光梯形（顶部几乎不可见，峰值渐变缓存）
    const pillar=(th:number,bh:number)=>{g.beginPath();g.moveTo(-bh,5);g.lineTo(-th,top);g.lineTo(th,top);g.lineTo(bh,5);g.closePath()}
    g.globalCompositeOperation='lighter';g.globalAlpha=e
    const vg=this.cachedGrad(h,g,'sealVol',()=>{
      const gr=g.createLinearGradient(0,top,0,6)
      gr.addColorStop(0,'rgba(150,30,25,0)');gr.addColorStop(.7,'rgba(210,50,38,.08)');gr.addColorStop(1,'rgba(255,110,80,.18)')
      return gr
    })
    g.fillStyle=vg;pillar(h.rx*.16,h.rx*1.05);g.fill();g.globalAlpha=1
    // ⑤ 不规则黑红火柱：左右边缘沿高度 12 段翻滚，不再是笔直梯形
    g.globalCompositeOperation='source-over'
    const SY=12
    g.beginPath()
    for(let i=0;i<=SY;i++){const y=top+(6-top)*i/SY,x=-Hf(y)*(1+J(y,1.7));i?g.lineTo(x,y):g.moveTo(x,y)}
    for(let i=SY;i>=0;i--){const y=top+(6-top)*i/SY;g.lineTo(Hf(y)*(1+J(y,4.9)),y)}
    g.closePath()
    const cg=this.cachedGrad(h,g,'sealBody',()=>{
      const gr=g.createLinearGradient(-h.rx*.72,0,h.rx*.72,0)
      gr.addColorStop(0,'#2c0c0f');gr.addColorStop(.5,'#070204');gr.addColorStop(1,'#2c0c0f')
      return gr
    })
    g.fillStyle=cg;g.fill()
    // ⑥ 柱内上升焰纹：虚线只在三种模式间切换，亮段持续向柱顶窜升
    g.globalCompositeOperation='lighter';g.lineCap='round'
    const dashes=[[16,38],[24,44],[20,34]]
    for(let i=0;i<7;i++){
      const o=i*2.3
      g.strokeStyle=`rgba(255,${105+40*Hh(i)},60,${.4*e})`;g.lineWidth=1.4+1.1*Hh(i+3)
      g.setLineDash(dashes[i%3]);g.lineDashOffset=-t*170-i*40
      g.beginPath()
      for(let s=0;s<=8;s++){const y=top+(6-top)*s/8,x=Math.sin(y*.09+o+t*2)*Hf(y)*.45;s?g.lineTo(x,y):g.moveTo(x,y)}
      g.stroke()
    }
    g.setLineDash([])
    // ⑦ 柱缘破碎火丝：左右各 5 段外翻短焰（淡出末期省略）
    if(k<.8){
      for(const side of[-1,1])for(let i=0;i<5;i++){
        const y=top+(6-top)*(i+.5)/5+(Hh(i+side*8+70)-.5)*14
        const x=side*Hf(y)*(1+J(y,side>0?4.9:1.7)),len=6+10*Hh(i+80)
        g.strokeStyle=`rgba(255,${150+60*Hh(i+81)},95,${(.4+.3*strike)*e})`;g.lineWidth=1.3
        g.beginPath();g.moveTo(x,y);g.lineTo(x+side*len,y+(Hh(i+82)-.5)*10);g.stroke()
      }
    }
    g.lineCap='butt'
    // ⑧ 落点热熔光（峰值渐变缓存）
    g.globalAlpha=e
    const ig=this.cachedGrad(h,g,'sealImpact',()=>{
      const gr=g.createRadialGradient(0,5,1,0,5,h.rx*.85)
      gr.addColorStop(0,'rgba(255,222,185,.7)');gr.addColorStop(.35,'rgba(250,92,55,.26)');gr.addColorStop(1,'rgba(140,25,15,0)')
      return gr
    })
    g.fillStyle=ig;g.beginPath();g.ellipse(0,5,h.rx*.85,h.ry*.85,0,0,Math.PI*2);g.fill();g.globalAlpha=1
    // ⑨ 双层不规则冲击环（30 点，半径沿圆周抖动，错速扩散）
    g.save();g.scale(h.rx,h.ry)
    const ring=(rad:number,col:string,lw:number,off:number)=>{
      g.strokeStyle=col;g.lineWidth=lw;g.beginPath()
      const RQ=30
      for(let q=0;q<=RQ;q++){const a=q*Math.PI*2/RQ,rr=rad*(1+.05*Math.sin(a*5+off)+.03*Math.sin(a*11-off))
        const x=Math.cos(a)*rr,y=Math.sin(a)*rr;q?g.lineTo(x,y):g.moveTo(x,y)}
      g.closePath();g.stroke()
    }
    ring(.32+strike*.85,`rgba(255,140,105,${.4*fade})`,.025,1.3)
    ring(.2+strike*.6,`rgba(255,220,200,${.55*fade})`,.015,4.7)
    g.restore()
    // ⑩ 迸飞火星（砸落瞬间向外抛洒并微沉，淡出末期省略）
    if(k<.8)for(let i=0;i<10;i++){
      const a=i*Math.PI*2/10+(Hh(i+90)-.5)*.4,d=h.rx*(.3+1.15*strike)*(.6+.5*Hh(i+95))
      const x=Math.cos(a)*d,y=6+Math.sin(a)*d+10*strike*strike,sz=1.2+1.4*Hh(i+99)
      g.fillStyle=`rgba(255,${160+60*Hh(i+100)},${90+50*Hh(i+101)},${.85*fade})`
      g.beginPath();g.arc(x,y,sz,0,Math.PI*2);g.fill()
    }
    g.globalCompositeOperation='source-over'
  }
  /** 生存时符弹体：实色危险核与亮边，回卷前显露一圈收缩提示。 */
  private oathSprites:HTMLCanvasElement[]=[]
  private renderOath(g:CanvasRenderingContext2D,h:BossHazard,t:number):void {
    const index=h.dark?1:0
    if(!this.oathSprites[index]){
      // 暗核、血色渐变刃面与羽化光晕一次烘焙；高弹量不逐粒开阴影或建立渐变。
      const cv=document.createElement('canvas');cv.width=cv.height=64
      const c=cv.getContext('2d')!;c.translate(32,32)
      const halo=c.createRadialGradient(0,0,2,0,0,29)
      halo.addColorStop(0,h.dark?'rgba(210,30,85,.38)':'rgba(255,75,60,.5)');halo.addColorStop(.45,'rgba(180,12,46,.16)');halo.addColorStop(1,'rgba(80,0,20,0)')
      c.fillStyle=halo;c.fillRect(-32,-32,64,64)
      c.beginPath();c.moveTo(15,0);c.bezierCurveTo(2,-10,-9,-8,-14,0);c.bezierCurveTo(-7,9,4,8,15,0);c.closePath()
      const body=c.createLinearGradient(0,-9,0,9)
      body.addColorStop(0,h.dark?'#913044':'#ffd4b0');body.addColorStop(.28,h.dark?'#370917':'#cf3345');body.addColorStop(.65,'#12030b');body.addColorStop(1,'#78152b')
      c.fillStyle=body;c.fill();c.strokeStyle='#060108';c.lineWidth=1.5;c.stroke()
      c.globalCompositeOperation='lighter';c.strokeStyle=h.dark?'#e65c87':'#ffb199';c.lineWidth=1.3
      c.beginPath();c.moveTo(-11,0);c.quadraticCurveTo(1,-7,13,0);c.stroke()
      c.fillStyle='#fff0dd';c.beginPath();c.ellipse(5,-1,3,1.1,0,0,Math.PI*2);c.fill()
      this.oathSprites[index]=cv
    }
    g.save();g.rotate(h.angle+(h.bend??0)*Math.sin(Math.PI*Math.min(1,t/h.duration)))
    const r=h.rx,size=r*5
    g.drawImage(this.oathSprites[index],-size/2,-size/2,size,size)
    g.globalCompositeOperation='lighter'
    if(h.kind==='shardSeed'){
      const gather=Math.min(1,t/1.2)
      g.rotate(t*3);g.strokeStyle='#f38ca5';g.lineWidth=1.2
      g.beginPath();g.moveTo(0,-r*1.8);g.lineTo(r*1.3,0);g.lineTo(0,r*1.8);g.lineTo(-r*1.3,0);g.closePath();g.stroke()
      g.strokeStyle=`rgba(255,140,160,${.3+.5*gather})`;g.beginPath();g.arc(0,0,r*(2.5-gather),0,Math.PI*1.6);g.stroke()
    }
    if(h.returning&&t/h.duration>.34&&t/h.duration<.55){
      g.strokeStyle='rgba(255,130,145,.8)';g.lineWidth=1
      g.beginPath();g.arc(0,0,r+3+7*(.55-t/h.duration)/.21,0,Math.PI*2);g.stroke()
    }
    g.restore()
  }
  /** 黑域裂束：一秒全程刻线预警，激活后黑核沿线崩裂，血色裂缘而非白炽激光芯。 */
  private renderRift(g:CanvasRenderingContext2D,h:BossHazard,map:TileMap,t:number,k:number):void {
    g.save()
    g.beginPath();g.rect(map.bounds.left-h.x,map.bounds.top-h.y,map.bounds.right-map.bounds.left,map.bounds.bottom-map.bounds.top);g.clip();g.rotate(h.angle)
    if(t<0){
      g.strokeStyle=`rgba(244,100,120,${.45+.4*h.age/h.delay})`;g.lineWidth=1.3
      g.beginPath();g.moveTo(-h.rx,0);g.lineTo(h.rx,0);g.stroke()
      g.setLineDash([5,13]);g.lineDashOffset=-h.age*35;g.strokeStyle='#641228';g.lineWidth=3;g.stroke();g.setLineDash([])
    }else{
      const e=Math.min(1,t/.025)*Math.pow(Math.max(0,1-k),.8),head=-h.rx+h.rx*2*Math.min(1,t/.04)
      // 击发爆裂宽晕与碎片扩散，余光持续但伤害窗口独立。
      g.globalCompositeOperation='lighter';g.globalAlpha=e
      const flare=g.createLinearGradient(0,-h.ry*4,0,h.ry*4)
      flare.addColorStop(0,'rgba(100,2,24,0)');flare.addColorStop(.45,'rgba(238,30,65,.28)');flare.addColorStop(.5,'rgba(255,124,139,.48)');flare.addColorStop(.55,'rgba(238,30,65,.28)');flare.addColorStop(1,'rgba(100,2,24,0)')
      g.fillStyle=flare;g.fillRect(-h.rx,-h.ry*4,head+h.rx,h.ry*8)
      for(const [width,color] of [[h.ry*3,'rgba(170,12,46,.16)'],[h.ry*2,'#070109']] as const){
        g.globalCompositeOperation=width>h.ry*2?'lighter':'source-over';g.globalAlpha=e
        g.strokeStyle=color;g.lineWidth=width;g.beginPath();g.moveTo(-h.rx,0);g.lineTo(head,0);g.stroke()
      }
      g.globalCompositeOperation='lighter';g.globalAlpha=e;g.lineWidth=2
      for(const side of [-1,1]){
        g.strokeStyle='#dc3b64';g.beginPath()
        for(let i=0;i<=36;i++){
          const x=-h.rx+(head+h.rx)*i/36,y=side*h.ry*(.8+.22*Math.sin(i*7.3+h.phase+t*40))
          i?g.lineTo(x,y):g.moveTo(x,y)
        }
        g.stroke()
      }
      g.strokeStyle='#f391a0';g.lineWidth=1.2
      for(let i=0;i<18;i++){
        const x=-h.rx+(head+h.rx)*(i+.5)/18,side=i%2?1:-1
        g.beginPath();g.moveTo(x,side*h.ry);g.lineTo(x-12,side*(h.ry+12+18*k));g.lineTo(x-25,side*(h.ry+8));g.stroke()
        const travel=55*k,sy=side*(h.ry+travel)
        g.fillStyle=i%2?'#c73759':'#390719';g.beginPath();g.moveTo(x-10*k,sy);g.lineTo(x-8-18*k,sy+side*7);g.lineTo(x-20*k,sy+side*14);g.closePath();g.fill()
      }
    }
    g.restore()
  }
  /** 柱状激光弹：断裂尾焰、黑色梭体、流动核线与白热弹头。 */
  private renderBolt(g:CanvasRenderingContext2D,h:BossHazard,t:number,k:number):void {
    void k;g.rotate(h.angle)
    g.globalCompositeOperation='lighter';g.lineCap='round'
    for(let j=0;j<3;j++){
      const bx=-14-j*16,bw=14-j*3,spread=3.2-j*.7,oy=Math.sin(t*26+j*2.4+h.phase)*2.2
      const fg=g.createLinearGradient(bx-bw,0,bx+bw*.4,0)
      fg.addColorStop(0,'rgba(190,40,25,0)');fg.addColorStop(1,`rgba(255,100,60,${.3-j*.07})`)
      g.fillStyle=fg;g.beginPath();g.moveTo(bx+bw*.5,oy);g.lineTo(bx-bw,oy-spread);g.lineTo(bx-bw-5,oy);g.lineTo(bx-bw,oy+spread);g.closePath();g.fill()
    }
    g.lineCap='butt'
    const halo=g.createRadialGradient(8,0,1,8,0,22)
    halo.addColorStop(0,'rgba(255,150,95,.45)');halo.addColorStop(.6,'rgba(220,60,35,.16)');halo.addColorStop(1,'rgba(150,25,15,0)')
    g.fillStyle=halo;g.beginPath();g.arc(8,0,22,0,Math.PI*2);g.fill()
    g.globalCompositeOperation='source-over'
    const body=g.createLinearGradient(-46,0,15,0)
    body.addColorStop(0,'#280c0d');body.addColorStop(.65,'#130506');body.addColorStop(1,'#050202')
    g.fillStyle=body
    g.beginPath();g.moveTo(15,0);g.lineTo(3,-4.6);g.lineTo(-46,-1.2);g.lineTo(-51,0);g.lineTo(-46,1.2);g.lineTo(3,4.6);g.closePath();g.fill()
    g.globalCompositeOperation='lighter'
    g.strokeStyle=`rgba(255,120,80,${.65+.25*Math.sin(t*22+h.phase)})`;g.lineWidth=1.2;g.shadowColor='#ff3a18';g.shadowBlur=7
    g.beginPath();g.moveTo(-40,0);g.lineTo(9,0);g.stroke();g.shadowBlur=0
    g.fillStyle='#ffe8d8';g.beginPath();g.arc(10.5,0,2,0,Math.PI*2);g.fill()
    g.globalCompositeOperation='source-over'
  }
  /** 黑雾/黑洞：多层柔和羽化的翻卷雾边、纯黑吞噬核与暗涡；移动雾团带反向残雾与集中猩红瞳。全程不画硬边线。 */
  private renderMist(g:CanvasRenderingContext2D,h:BossHazard,t:number,k:number):void {
    const smoke=h.kind==='smoke'
    // 外部已按墙缘羽化设置基准透明度，所有层都要沿用
    const base=g.globalAlpha
    const r=h.rx*(smoke?1.5*(.55+k):1.7)*(1+.06*Math.sin(t*9+h.phase*1.7)),fade=smoke?1-k:1
    if(!smoke){
      // 运动反方向的三缕残雾：纯羽化团，没有任何边线
      g.globalCompositeOperation='source-over'
      for(let j=1;j<=3;j++){
        const tx=-Math.cos(h.angle)*j*12,ty=-Math.sin(h.angle)*j*12,tr=r*(.6-j*.11)
        const tg=g.createRadialGradient(tx,ty,1,tx,ty,tr)
        tg.addColorStop(0,`rgba(5,2,10,${.5*fade*base})`);tg.addColorStop(.65,`rgba(26,10,36,${.26*fade*base})`);tg.addColorStop(1,'rgba(20,8,30,0)')
        g.fillStyle=tg;g.beginPath();g.arc(tx,ty,tr,0,Math.PI*2);g.fill()
      }
    }
    // 不规则翻卷轮廓
    const blob=(scale:number,f1:number,f2:number,spd:number)=>{
      g.beginPath()
      for(let q=0;q<=24;q++){
        const a=q*Math.PI*2/24
        const rr=r*scale*(1+.1*Math.sin(a*3+t*spd+h.phase*f1)+.06*Math.sin(a*7-t*spd*.7+h.phase*f2))
        const x=Math.cos(a)*rr,y=Math.sin(a)*rr;q?g.lineTo(x,y):g.moveTo(x,y)
      }
      g.closePath()
    }
    // 外层暖红到暗紫的柔和光边（lighter，但极弱）
    g.globalAlpha=fade*.5*base;g.globalCompositeOperation='lighter'
    const rim=g.createRadialGradient(0,0,r*.2,0,0,r)
    rim.addColorStop(.55,'rgba(120,35,60,0)');rim.addColorStop(.8,smoke?'rgba(150,50,90,.16)':'rgba(190,55,85,.2)')
    rim.addColorStop(.92,'rgba(230,80,70,.12)');rim.addColorStop(1,'rgba(120,30,40,0)')
    g.fillStyle=rim;blob(1.02,1.7,2.4,2.6);g.fill()
    g.globalCompositeOperation='source-over'
    // 两缕翻卷雾边：暗紫雾团羽化覆盖，制造体积而非描边
    for(const [sc,col,a0] of [[.88,'rgba(48,24,66,',.5],[.72,'rgba(64,28,74,',.32]] as const){
      const fg=g.createRadialGradient(0,0,r*.2,0,0,r)
      fg.addColorStop(0,col+(.5*fade*base)+')');fg.addColorStop(.7,col+(.22*fade*base)+')');fg.addColorStop(1,col+'0)')
      g.fillStyle=fg;blob(sc,2.1+a0,3.2-a0,2.2+a0);g.fill()
    }
    // 纯黑吞噬核
    g.globalAlpha=base
    const core=g.createRadialGradient(0,0,1,0,0,r)
    core.addColorStop(0,'#000000');core.addColorStop(.42,'#020106');core.addColorStop(.68,'#0d0614');core.addColorStop(.88,'rgba(34,12,40,.35)');core.addColorStop(1,'rgba(18,8,26,0)')
    g.fillStyle=core;blob(.92,1.7,2.4,2.6);g.fill()
    // 折返雾弹在转向前收缩亮环，返程保留血红弧，区分去程与回流。
    if(h.returning){
      const u=t/h.duration
      if(u>.4){
        g.globalCompositeOperation='lighter';g.globalAlpha=base*.65
        g.strokeStyle='#e65b78';g.lineWidth=1.4
        const ringR=u<.5?r*(1.4-(u-.4)*4):r*.72
        g.beginPath();g.arc(0,0,ringR,t*2,t*2+Math.PI*1.5);g.stroke()
      }
    }
    // 暗涡：两条极细极暗的内卷弧
    g.globalCompositeOperation='lighter';g.lineCap='round'
    for(let j=0;j<2;j++){
      g.strokeStyle=`rgba(170,90,150,${(.1-j*.035)*fade*base})`;g.lineWidth=1.2
      const rr=r*(.46+j*.16),s=t*(3.2-j*.7)+h.phase+j*2.2
      g.beginPath();g.arc(0,0,rr,s,s+1.7);g.stroke()
    }
    g.lineCap='butt';g.globalCompositeOperation='source-over'
    if(!smoke){
      const fl=.55+.35*Math.sin(t*18+h.phase)
      g.globalCompositeOperation='lighter'
      const halo=g.createRadialGradient(0,0,0,0,0,r*.42)
      halo.addColorStop(0,`rgba(255,80,70,${.32*fl*base})`);halo.addColorStop(.6,`rgba(215,40,50,${.1*fl*base})`);halo.addColorStop(1,'rgba(150,15,30,0)')
      g.fillStyle=halo;g.beginPath();g.arc(0,0,r*.42,0,Math.PI*2);g.fill()
      g.fillStyle=`rgba(255,214,200,${.85*fl*base})`;g.beginPath();g.arc(0,0,r*.13,0,Math.PI*2);g.fill()
      g.globalCompositeOperation='source-over'
    }
    g.globalAlpha=base
  }
  /** 闪现斩·猩红烈焰月牙：整片扇形用 48 个刃片实体填充（厚黑焰底 + 加色焰色渐变 + 白炽刃口，新刃亮旧刃淡），
   *  外沿翻卷火舌、刃锋火星爆点与劈出瞬闪。手法为高规格厚刃的"切片实填"，配色与火焰材质为格林剧团专属。 */
  private renderSlash(g:CanvasRenderingContext2D,h:BossHazard,t:number,k:number):void {
    g.save();g.rotate(h.angle)
    // 仅增加视觉刃身厚度与雾缘，伤害仍按原始 h.rx 结算。
    const R=h.rx*1.1,A=1.3
    const seed=h.phase+h.angle*2.7
    // 节奏：刃锋快速扫出（前 34%），半径展开到 R，随后整体慢收
    const strike=Math.min(1,k/.16)
    const sw=1-Math.pow(1-Math.min(1,k/.34),3)
    const grow=1-Math.pow(1-Math.min(1,k/.4),3)
    const fade=Math.pow(1-k,.65)*strike
    const lead=-A+2*A*sw
    const rad=R*(.66+.34*grow)
    // 雾体先于刃身：黑血雾核遮住地砖，外缘羽化并逆向翻卷，不用大面积红光代替黑暗。
    g.globalCompositeOperation='source-over'
    for(let j=0;j<7;j++){
      const a=-A+(lead+A)*(j+.5)/7
      const r=rad*(.82+.035*Math.sin(j*2.7+seed+t*8))
      const mx=Math.cos(a)*r,my=Math.sin(a)*r
      const size=24+13*Math.sin((j+.5)/7*Math.PI)+10*k
      const fog=g.createRadialGradient(mx,my,1,mx,my,size)
      fog.addColorStop(0,'rgba(3,0,4,.88)')
      fog.addColorStop(.42,'rgba(21,2,10,.72)')
      fog.addColorStop(.75,'rgba(56,5,20,.32)')
      fog.addColorStop(1,'rgba(28,2,12,0)')
      g.globalAlpha=fade;g.fillStyle=fog
      g.beginPath();g.ellipse(mx,my,size,size*.82,a-t*1.2,0,Math.PI*2);g.fill()
    }
    // 两层血色空气泛光：软外晕与集中热层各自占据不同宽度。
    g.globalCompositeOperation='lighter';g.globalAlpha=fade
    g.lineCap='round'
    for(const [w,col] of [[48,'rgba(140,8,34,.12)'],[25,'rgba(240,22,45,.22)']] as const){
      g.lineWidth=w;g.strokeStyle=col;g.beginPath();g.arc(0,0,rad,-A,lead);g.stroke()
    }
    // —— 48 片刃片，把"从后缘到当前刃锋"的整段月牙实体填满 ——
    const steps=48,span=2*A/steps
    for(let i=0;i<steps;i++){
      const a=-A+i*span,b=Math.min(lead,a+span+.004)
      if(b<=a)continue
      // 中间最厚、两端收尖的月牙截面；靠近当前刃锋（更新）的刃片更亮
      const mid=(a+A)/(2*A)
      const width=Math.min(rad*.82,88)*Math.pow(Math.sin(Math.PI*Math.min(1,Math.max(0,mid))),.72)
      const freshness=Math.exp(-(lead-(a+b)/2)*1.15)
      const rr=rad*(1+Math.sin(a*8+seed)*.018)
      const sector=(out:number)=>{g.beginPath();g.arc(0,0,out,a,b);g.arc(0,0,Math.max(2,rr-width),b,a,true);g.closePath()}
      // 厚黑焰底：先立住暗轮廓，发光层才不会糊成纸片
      g.globalCompositeOperation='source-over'
      g.globalAlpha=fade*(.22+.66*freshness)
      g.fillStyle='#210309';sector(rr+3);g.fill()
      // 加色焰身：内缘暗焰 → 猩红 → 橙焰 → 外沿白炽
      g.globalCompositeOperation='lighter'
      const fg=g.createRadialGradient(0,0,rr-width,0,0,rr+2)
      fg.addColorStop(0,'rgba(66,2,18,.18)');fg.addColorStop(.35,'rgba(152,5,30,.72)')
      fg.addColorStop(.7,'rgba(245,26,48,.94)');fg.addColorStop(.92,'rgba(255,90,75,.98)');fg.addColorStop(1,'rgba(255,225,205,.98)')
      g.fillStyle=fg;g.globalAlpha=fade*(.36+.64*freshness);sector(rr);g.fill()
      // 外沿白炽刃口：越新越亮
      g.strokeStyle=`rgba(255,244,224,${(.15+.8*freshness)*fade})`;g.lineWidth=1+.6*freshness
      g.beginPath();g.arc(0,0,rr,a,b);g.stroke()
    }
    g.globalAlpha=fade
    g.globalCompositeOperation='lighter';g.lineCap='round'
    // 整条扫过弧的厚暗焰辉（空气溢光）
    g.strokeStyle='rgba(218,18,42,.32)';g.lineWidth=30
    g.beginPath();g.arc(0,0,rad,-A,lead);g.stroke()
    // 外沿翻卷火舌：沿月牙外弧朝挥砍反方向卷的焰尖，越靠近刃锋越长越亮
    const fangs=9
    for(let i=0;i<fangs;i++){
      const tt=i/(fangs-1),ang=-A+2*A*tt*sw
      if(ang>lead-.02)continue
      const near=Math.max(0,1-Math.abs(ang-lead)/.6)
      const stagger=.7+.3*Math.abs(Math.sin(i*8.7+seed))
      const ca=Math.cos(ang),sa=Math.sin(ang),tx=-sa,ty=ca
      const tipAng=ang-.09,len=rad*(.1+.17*near)*stagger,bw=rad*.055
      g.fillStyle=`rgba(255,${104+78*near},${46+26*near},${(.52*near+.14)*fade})`
      g.beginPath()
      g.moveTo(ca*rad*.99+tx*bw,sa*rad*.99+ty*bw)
      g.lineTo(Math.cos(tipAng)*(rad+len),Math.sin(tipAng)*(rad+len))
      g.lineTo(ca*rad*.99-tx*bw,sa*rad*.99-ty*bw)
      g.closePath();g.fill()
    }
    // 刃锋当前位置：粗亮弧头 + 白热爆边
    g.strokeStyle=`rgba(255,120,58,${.6*fade})`;g.lineWidth=9;g.shadowColor='#ff5a28';g.shadowBlur=16
    g.beginPath();g.arc(0,0,rad,lead-.2,lead);g.stroke()
    g.strokeStyle=`rgba(255,248,232,${.95*fade})`;g.lineWidth=2.4
    g.beginPath();g.arc(0,0,rad,lead-.16,lead);g.stroke();g.shadowBlur=0
    // 刃锋甩出的火星（集中在刃锋前方，暖色小粒向外迸散）
    if(k<.62){
      const em=Math.pow(1-k/.62,1.2)
      for(let i=0;i<8;i++){
        const ea=lead-(i%3)*.09,rrr=rad+5+((i*13.7)%1)*17*em
        g.fillStyle=`rgba(255,${165+55*((i*5)%2)},${85+45*((i*3)%2)},${.8*em*fade})`
        g.beginPath();g.arc(Math.cos(ea)*rrr,Math.sin(ea)*rrr,1.1+((i*7)%3)*.65,0,Math.PI*2);g.fill()
      }
    }
    // 刃锋爆点
    const bx=Math.cos(lead)*rad,by=Math.sin(lead)*rad
    const bg=g.createRadialGradient(bx,by,1,bx,by,26)
    bg.addColorStop(0,`rgba(255,248,234,${.92*fade})`);bg.addColorStop(.45,`rgba(255,118,52,${.38*fade})`);bg.addColorStop(1,'rgba(190,32,20,0)')
    g.fillStyle=bg;g.beginPath();g.arc(bx,by,26,0,Math.PI*2);g.fill()
    // 劈出瞬间的白热闪核（前 28%）
    if(k<.28){
      const fk=k/.28,fa=Math.pow(1-fk,1.5),cr=18+36*fk
      const cg=g.createRadialGradient(rad*.14,0,0,rad*.14,0,cr)
      cg.addColorStop(0,`rgba(255,248,234,${.85*fa})`);cg.addColorStop(.5,`rgba(255,108,46,${.32*fa})`);cg.addColorStop(1,'rgba(190,30,20,0)')
      g.fillStyle=cg;g.beginPath();g.arc(rad*.14,0,cr,0,Math.PI*2);g.fill()
    }
    g.restore();g.lineCap='butt'
  }
}
