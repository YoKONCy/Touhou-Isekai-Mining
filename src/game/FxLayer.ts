import { randomVisual } from '../core/simulation/random'
/**
 * 特效层：命中火花粒子 + 飘字
 * 设数量上限并原地清理过期条目，避免高密度战斗逐帧生成筛选数组。
 */

import { t, itemName } from '../i18n'
import { damageLabel } from '../shared/combat'
import { compactInPlace } from '../core/collections'

export type HitDamageKind = 'physical' | 'magic' | 'true'
export const DAMAGE_COLORS: Record<HitDamageKind, string> = { physical: '#f4ca8c', magic: '#b8b0ff', true: '#8ef0e2' }

interface PickupNotice {
  owner?:string
  id: string
  qty: number
  color: string
  life: number
  y: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  /** 重力加速度（矿屑/碎块用） */
  grav: number
  /** 圆形粒子（默认方块碎屑） */
  round?: boolean
}

interface FloatText {
  x: number
  y: number
  life: number
  /** 总寿命（暴击大字存活略久） */
  maxLife: number
  text: string
  color: string
  vy: number
  /** 暴击强调：大号粗体 + 出场弹缩 + 厚描边 */
  big?: boolean
}

export class FxLayer {
  private particles: Particle[] = []
  private texts: FloatText[] = []
  private particlePool:Particle[]=[]
  private textPool:FloatText[]=[]
  private acquireParticle():Particle {
    const p=this.particlePool.pop()??{x:0,y:0,vx:0,vy:0,life:0,maxLife:0,size:0,color:'',grav:0,round:false}
    p.round=false;this.particles.push(p);return p
  }
  private pickups: PickupNotice[] = []
  private pendingPickups: PickupNotice[] = []
  private pickupX = 0
  private pickupY = 0
  private readonly pickupAnchors = new Map<string,{x:number;y:number}>()
  private pickupOwner: string | undefined
  withPickupOwner<T>(owner:string,x:number,y:number,work:()=>T):T {
    const previous=this.pickupOwner;this.pickupOwner=owner;this.setPickupAnchor(x,y,owner)
    try{return work()}finally{this.pickupOwner=previous}
  }
  removePickupOwner(owner:string):void {
    this.pickupAnchors.delete(owner)
    this.pickups=this.pickups.filter(notice=>notice.owner!==owner)
    this.pendingPickups=this.pendingPickups.filter(notice=>notice.owner!==owner)
  }

  /** 拾取走独立短队列，同类合并，待显示条目不消耗寿命。 */
  pickupText(id: string, qty: number, color: string, owner=this.pickupOwner): void {
    if (qty <= 0) return
    const existing = [...this.pickups, ...this.pendingPickups].find(p => p.id === id && p.owner === owner)
    if (existing) {
      existing.qty += qty
      existing.life = Math.min(2.2, existing.life + 0.35)
      return
    }
    this.pendingPickups.push({ id, qty, color, life: 1.6, y: 0, owner })
  }

  setPickupAnchor(x: number, y: number, owner?:string): void {
    if(owner){const anchor=this.pickupAnchors.get(owner);if(anchor){anchor.x=x;anchor.y=y}else this.pickupAnchors.set(owner,{x,y});return}
    this.pickupX = x
    this.pickupY = y
  }

  /** 铁柜初开时的短积灰，复用粒子池且不消耗战斗随机源。 */
  searchDust(x:number,y:number):void {
    for(let i=0;i<9&&this.particles.length<240;i++){
      const p=this.acquireParticle(),life=.32+randomVisual()*.24
      p.x=x+(randomVisual()-.5)*30;p.y=y+randomVisual()*15
      p.vx=(randomVisual()-.5)*70;p.vy=-14-randomVisual()*30
      p.life=p.maxLife=life;p.size=2+randomVisual()*3;p.grav=14;p.round=true
      p.color=i%2?'#a59b80':'#837c68'
    }
  }

  /** 锥形火花爆发 */
  burst(x: number, y: number, angle: number, count = 9): void {
    const colors = ['#fff3c4', '#ffd166', '#ffffff', '#ff9f43']
    for (let i = 0; i < count; i++) {
      if (this.particles.length > 240) break
      // 在攻击方向 ±0.9 弧度内喷射
      const a = angle + (randomVisual() - 0.5) * 1.8
      const sp = 90 + randomVisual() * 220
      const p=this.acquireParticle();p.x=x;p.y=y;p.vx=Math.cos(a)*sp;p.vy=Math.sin(a)*sp
      p.life=.28+randomVisual()*.22;p.maxLife=.5;p.size=1.5+randomVisual()*2.5;p.color=colors[(randomVisual()*colors.length)|0];p.grav=0
    }
  }

  /**
   * 伤害飘字
   * @param big 暴击强调样式：24px 粗体、厚暗描边、出场弹缩，寿命与上浮也更强
   */
  damageText(x: number, y: number, text: string, color = '#ffe08a', big = false): void {
    const p=(this.texts.length>30?this.texts.shift():this.textPool.pop())??{x:0,y:0,life:0,maxLife:0,text:'',color:'',vy:0,big:false}
    p.x=x+(randomVisual()-.5)*10;p.y=y;p.life=p.maxLife=big ? .85 : .7;p.text=text;p.color=color;p.vy=big?-72:-52;p.big=big
    this.texts.push(p)
  }

  /** 伤害类型仅通过颜色区分：物理暖金、魔法淡紫、真实青白，暴击强调独立保留。 */
  combatDamage(x: number, y: number, amount: number, kind: HitDamageKind, critical = false): void {
    this.damageText(x, y, `${damageLabel(amount)}${critical ? '!' : ''}`, DAMAGE_COLORS[kind], critical)
  }

  /**
   * 碎块飞溅：矿屑/血屑，初速偏向上方并带重力坠落
   * @param color 碎块颜色
   * @param count 数量
   * @param power 初速度倍率
   */
  chips(x: number, y: number, color: string, count = 8, power = 170): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length > 240) break
      const a = -Math.PI / 2 + (randomVisual() - 0.5) * 2.4
      const sp = power * (0.4 + randomVisual() * 0.8)
      const p=this.acquireParticle();p.x=x+(randomVisual()-.5)*8;p.y=y+(randomVisual()-.5)*8;p.vx=Math.cos(a)*sp;p.vy=Math.sin(a)*sp
      p.life=.35+randomVisual()*.3;p.maxLife=.65;p.size=2+randomVisual()*2.4;p.color=color;p.grav=560
    }
  }

  update(dt: number): void {
    for (const p of this.pickups) p.life -= dt
    compactInPlace(this.pickups, p => p.life > 0)
    for(let i=0;i<this.pendingPickups.length;){
      const notice=this.pendingPickups[i]!;let count=0;for(const other of this.pickups)if(other.owner===notice.owner)count++
      if(count>=3){i++;continue}
      notice.y=count*19;this.pickups.push(notice);this.pendingPickups.splice(i,1)
    }
    if(this.pickups.length){const rows=new Map<string|undefined,number>(),ease=1-Math.exp(-dt*12)
      for(const p of this.pickups){const index=rows.get(p.owner)??0;rows.set(p.owner,index+1);p.y+=(index*19-p.y)*ease}}
    const drag = Math.exp(-5 * dt)
    for (const p of this.particles) {
      p.life -= dt
      p.vx *= drag
      p.vy *= drag
      p.vy += p.grav * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      if(p.life<=0)this.particlePool.push(p)
    }
    compactInPlace(this.particles, p => p.life > 0)

    const textDrag = Math.exp(-3 * dt)
    for (const t of this.texts) {
      t.life -= dt
      t.y += t.vy * dt
      t.vy *= textDrag
      if(t.life<=0)this.textPool.push(t)
    }
    compactInPlace(this.texts, t => t.life > 0)
  }

  render(ctx: CanvasRenderingContext2D): void {
    // 粒子
    for (const p of this.particles) {
      const a = Math.max(0, p.life / p.maxLife)
      ctx.globalAlpha = a
      ctx.fillStyle = p.color
      if (p.round) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
      }
    }
    // 飘字
    ctx.globalAlpha = 1
    ctx.textAlign = 'center'
    ctx.font = '16px zpix, "Courier New", monospace'
    for (const ft of this.texts) {
      const a = Math.min(1, ft.life / 0.35)
      ctx.globalAlpha = a
      if (ft.big) {
        // 暴击：出场 0.14s 从 1.4 弹缩回 1.0（三次缓出），与普通伤害数字明显拉开
        const k = Math.max(0, Math.min(1, (ft.maxLife - ft.life) / 0.14))
        const ease = 1 - Math.pow(1 - k, 3)
        const scale = 1.4 - 0.4 * ease
        ctx.save()
        ctx.translate(ft.x, ft.y)
        ctx.scale(scale, scale)
        // 24px 合成粗体 + 6px 深色厚描边，像素字在亮背景上也压得住
        ctx.font = 'bold 24px zpix, "Courier New", monospace'
        ctx.lineJoin = 'round'
        ctx.strokeStyle = 'rgba(28, 12, 0, 0.9)'
        ctx.lineWidth = 6
        ctx.strokeText(ft.text, 0, 0)
        ctx.fillStyle = ft.color
        ctx.fillText(ft.text, 0, 0)
        ctx.restore()
        continue
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'
      ctx.lineWidth = 3
      ctx.strokeText(ft.text, ft.x, ft.y)
      ctx.fillStyle = ft.color
      ctx.fillText(ft.text, ft.x, ft.y)
    }
    // 人物侧上方独立排版，与头顶伤害数字错开；按画布变换约束到可视边缘。
    ctx.font = '12px zpix, "Courier New", monospace'
    ctx.textAlign = 'left'
    const tr = ctx.getTransform()
    const left = (8 - tr.e) / tr.a
    const right = (ctx.canvas.width - 8 - tr.e) / tr.a
    const top = (8 - tr.f) / tr.d
    const bottom = (ctx.canvas.height - 8 - tr.f) / tr.d
    for (const p of this.pickups) {
      const anchor=p.owner?this.pickupAnchors.get(p.owner):undefined
      const baseY = Math.max(top + 12, Math.min((anchor?.y??this.pickupY) - 56, bottom - 50))
      const text = t('game.notify.pickup_qty', { name: itemName(p.id), qty: p.qty })
      const width = ctx.measureText(text).width
      const x = Math.max(left, Math.min((anchor?.x??this.pickupX) + 25, right - width))
      ctx.globalAlpha = Math.min(1, p.life / 0.3)
      ctx.strokeStyle = 'rgba(12,14,20,0.85)'
      ctx.lineWidth = 3
      ctx.strokeText(text, x, baseY + p.y)
      ctx.fillStyle = p.color
      ctx.fillText(text, x, baseY + p.y)
    }
    ctx.globalAlpha = 1
  }
}
