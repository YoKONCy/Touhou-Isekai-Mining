import type { WeaponTrailView, WeaponChargeView, WeaponImpactView } from '../../../types'
import { RED_SPEAR_ARC } from './stats'
import { redSweep, redSlamDrop, redSlamTip } from './motion'
import { drawRedSpearHead } from './appearance'

export const RED_TRAIL_DURATION = .32
const clamp = (p: number) => Math.max(0, Math.min(1, p))
/** 灰白刃影为骨，绯红缨气为势；退扫的双股长尾错位盘绕，而不是整面红色扇板。 */
export function drawRedSpearTrail(g: CanvasRenderingContext2D, v: WeaponTrailView): void {
  const p = clamp(v.age / Math.max(.001, v.activeDuration ?? .12))
  const fade = Math.min(1, v.age / .01) * Math.pow(Math.max(0, 1 - v.age / RED_TRAIL_DURATION), 1.3)
  if (fade <= 0) return
  g.save(); g.translate(v.x, v.y - 6); g.rotate(v.angle); g.lineCap = 'round'; g.lineJoin = 'round'
  if (v.chargeFull) {
    // 以世界向下的落差画劈落刃光，不能继续沿枪轴铺前射箭头。
    g.rotate(-v.angle)
    const tip=redSlamTip(v.angle,redSlamDrop(p)), begin=redSlamTip(v.angle,redSlamDrop(Math.max(0,p-.3)))
    const dx=tip.x-begin.x,dy=tip.y-begin.y,length=Math.max(.001,Math.hypot(dx,dy)),nx=-dy/length,ny=dx/length
    for(let band=0;band<2;band++){
      const width=band?3.5:8, offset=band?2:-2
      g.globalAlpha=fade*(band?.46:.25);g.fillStyle=band?'#e4e4dc':'#b9464e'
      g.beginPath();g.moveTo(begin.x+nx*offset,begin.y+ny*offset)
      g.quadraticCurveTo((begin.x+tip.x)/2+nx*width,(begin.y+tip.y)/2+ny*width,tip.x+nx*width*.15,tip.y+ny*width*.15)
      g.lineTo(tip.x-nx*width*.35,tip.y-ny*width*.35)
      g.quadraticCurveTo((begin.x+tip.x)/2-nx*width*.2,(begin.y+tip.y)/2-ny*width*.2,begin.x+nx*offset,begin.y+ny*offset);g.fill()
      g.globalAlpha=fade*.7;g.strokeStyle=band?'#f0ebd9':'#de9680';g.lineWidth=band?1:.65
      g.beginPath();g.moveTo(begin.x+nx*offset,begin.y+ny*offset);g.quadraticCurveTo((begin.x+tip.x)/2+nx*width*.4,(begin.y+tip.y)/2+ny*width*.4,tip.x,tip.y);g.stroke()
    }
    for(let i=0;i<3;i++){
      const lag=.04+i*.065
      if(p<=lag)continue
      const prior=redSlamTip(v.angle,redSlamDrop(p-lag))
      g.save();g.translate(prior.x-Math.cos(prior.angle)*88,prior.y-Math.sin(prior.angle)*88);g.rotate(prior.angle)
      g.globalAlpha=fade*(.3-i*.07);drawRedSpearHead(g);g.restore()
    }
    g.restore(); return
  }
  if (v.segment === 2) {
    const push = 34 * Math.sin(Math.min(1, p / .86) * Math.PI)
    for (let i = 0; i < 3; i++) { g.save(); g.translate(push - 12 - i * 8, 0); g.globalAlpha = fade * (.35 - i * .08); drawRedSpearHead(g); g.restore() }
    g.globalAlpha = fade * .65; g.strokeStyle = '#e4e4dc'; g.lineWidth = 1; g.beginPath(); g.moveTo(28, 0); g.lineTo(100, 0); g.stroke()
    g.globalAlpha = fade * .45; g.strokeStyle = '#c75d59'; g.lineWidth = 2; g.beginPath(); g.moveTo(24, 4); g.bezierCurveTo(48, 15, 72, -11, 96, 1); g.stroke()
    g.restore(); return
  }
  const direction = v.segment === 0 ? 1 : -1, sweep = RED_SPEAR_ARC * 2 * redSweep(p)
  const tip = -direction * RED_SPEAR_ARC + direction * sweep, span = Math.min(sweep, v.segment === 3 ? 1.9 : 1.25)
  for (let band = 0; band < 2; band++) {
    g.beginPath()
    for (let i = 0; i <= 18; i++) {
      const t = i / 18, angle = tip - direction * span * (1 - t), radius = 93 - band * 9 + Math.sin(t * Math.PI * 2 + band) * (v.segment === 3 ? 5 : 2)
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius
      if (!i) g.moveTo(x, y); else g.lineTo(x, y)
    }
    g.globalAlpha = fade * (band ? .3 : .24); g.strokeStyle = band ? '#bac6c6' : '#b6424e'; g.lineWidth = band ? 3 : 8; g.stroke()
    g.globalAlpha = fade * .7; g.strokeStyle = band ? '#e6e8df' : '#e4a18a'; g.lineWidth = band ? .95 : 1.1; g.stroke()
  }
  for (let i = 0; i < 4; i++) {
    const lag = .045 + i * .065
    if (p <= lag) continue
    g.save(); g.rotate(-direction * RED_SPEAR_ARC + direction * RED_SPEAR_ARC * 2 * redSweep(p - lag))
    g.globalAlpha = fade * (.34 - i * .065); drawRedSpearHead(g); g.restore()
  }
  // 枪尖前沿的分叉气锋，长尾在退扫时收成一股上扬的游龙走势。
  g.save(); g.rotate(tip); g.globalAlpha = fade * .75; g.strokeStyle = '#e4dcd1'; g.lineWidth = .85
  g.beginPath(); g.moveTo(91, 0); g.quadraticCurveTo(100, -2, 108, -6); g.moveTo(99, -2); g.lineTo(105, 2); g.stroke()
  g.globalAlpha = fade * .5; g.strokeStyle = '#c26761'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(74, 4); g.quadraticCurveTo(89, 10, 100, 0); g.stroke(); g.restore()
  g.restore()
}

/** 满蓄力红雾从外侧聚向胸臂，低饱和暖红薄雾保留人物与动作辨识。 */
export function drawRedSpearCharge(g: CanvasRenderingContext2D, v: WeaponChargeView): void {
  const full = v.charging && v.progress >= 1 - 1e-8
  if (v.layer === 'behind') {
    if (!full && (v.readyAge < 0 || v.readyAge > .6)) return
    g.save(); g.translate(v.x, v.y - 7)
    for (let i = 0; i < 8; i++) {
      const p = (v.time * .9 + i * .131) % 1, radius = 5 + 30 * (1 - p), angle = i * Math.PI / 4 + p * .35
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius * .72, alpha = Math.sin(p * Math.PI) * (full ? .19 : .19 * (1 - v.readyAge / .6))
      const fog = g.createRadialGradient(x, y, 0, x, y, 8)
      fog.addColorStop(0, `rgba(190,69,76,${Math.max(0, alpha)})`); fog.addColorStop(1, 'rgba(190,69,76,0)')
      g.fillStyle = fog; g.fillRect(x - 8, y - 8, 16, 16)
      g.globalAlpha = Math.max(0, alpha * 2); g.strokeStyle = '#dcada0'; g.lineWidth = .8; g.beginPath(); g.moveTo(x * 1.24, y * 1.24); g.quadraticCurveTo(x - 3, y + 3, x * .8, y * .8); g.stroke(); g.globalAlpha = 1
    }
    g.restore(); return
  }
  const cooldown = v.cooldown ?? 0
  if (!v.charging && cooldown <= 0) return
  g.save(); const x = v.x - 22, y = v.y + 23
  g.fillStyle = '#271f23ed'; g.strokeStyle = full ? '#e2b0a1' : '#978275'; g.lineWidth = .65
  g.beginPath(); g.roundRect(x - 1.5, y - 1.5, 47, 8, 1.5); g.fill(); g.stroke()
  const fill = v.charging ? v.progress : 1 - cooldown / Math.max(.001, v.maxCooldown ?? 6)
  g.fillStyle = v.charging ? full ? '#efc4ac' : '#b56361' : '#805651'; g.fillRect(x, y, 44 * clamp(fill), 5)
  g.fillStyle = '#f6dfbd66'; g.fillRect(x, y, 44 * clamp(fill), 1)
  g.restore()
}

let crater: HTMLCanvasElement | null = null
/** 裂地留一条深浅不齐的窄沟，边缘是碎石和分叉裂缝，底色透出原本的地面。 */
function craterSprite(): HTMLCanvasElement {
  if(crater)return crater
  const c=document.createElement('canvas');c.width=344;c.height=144
  const g=c.getContext('2d')!;g.scale(2,2);g.translate(10,36);g.lineJoin='round';g.lineCap='round'
  const top:Array<{x:number;y:number}>=[],bottom:Array<{x:number;y:number}>=[]
  for(let i=0;i<13;i++){
    const x=18+i*10,width=(4+Math.sin(i*1.73)*1.6+((i*7)%5)*.55)*Math.sin((i+1)/14*Math.PI)
    top.push({x,y:-width-1});bottom.push({x:x+2,y:width+1})
  }
  const fill=g.createLinearGradient(0,-8,0,9);fill.addColorStop(0,'#252b2b99');fill.addColorStop(.48,'#3a38357a');fill.addColorStop(1,'#91816b66')
  g.beginPath();g.moveTo(top[0]!.x,top[0]!.y);for(const p of top)g.lineTo(p.x,p.y);for(const p of [...bottom].reverse())g.lineTo(p.x,p.y);g.closePath();g.fillStyle=fill;g.fill()
  g.strokeStyle='#bca58a77';g.lineWidth=.7;g.beginPath();for(let i=0;i<bottom.length;i++){const p=bottom[i]!;if(!i)g.moveTo(p.x,p.y);else g.lineTo(p.x,p.y)}g.stroke()
  for(let i=0;i<10;i++){
    const x=26+i*11,side=i%2?1:-1,branch=10+(i*7)%13
    g.strokeStyle='#262d2d70';g.lineWidth=.75;g.beginPath();g.moveTo(x,side*2);g.lineTo(x+3,side*7);g.lineTo(x-2,side*12);g.lineTo(x+1,side*branch);g.moveTo(x+3,side*7);g.lineTo(x+10,side*10);g.lineTo(x+15,side*9);g.stroke()
    g.strokeStyle='#a28e7644';g.lineWidth=.55;g.beginPath();g.moveTo(x+1,side*3);g.lineTo(x+4,side*7);g.lineTo(x-1,side*12);g.stroke()
    for(let j=0;j<2;j++){
      const sx=x+j*4,sy=side*(6+j*3),size=1.6+(i+j)%3*.65
      g.fillStyle=(i+j)%3?'#847b6cb5':'#b4a086aa';g.beginPath();g.moveTo(sx-size,sy);g.lineTo(sx-.3,sy-size*.6);g.lineTo(sx+size,sy+.5);g.lineTo(sx+.3,sy+size*.65);g.closePath();g.fill()
    }
  }
  crater=c;return c
}
const dustSprites: HTMLCanvasElement[] = []
/** 尘团缓存柔边与灰褐材质，大量粒子只缩放贴图，不逐粒逐帧创建渐变。 */
function dustSprite(warm: boolean): HTMLCanvasElement {
  const index=warm?1:0
  if(dustSprites[index])return dustSprites[index]!
  const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d')!
  const fog=g.createRadialGradient(29,27,2,32,32,30)
  fog.addColorStop(0,warm?'#b47f58aa':'#b4a48aaa');fog.addColorStop(.38,warm?'#8f6e4c66':'#978c7555');fog.addColorStop(1,'#8d806400')
  g.fillStyle=fog;g.fillRect(0,0,64,64)
  dustSprites[index]=c;return c
}
/** 触地瞬间喷出百余颗碎石、扬尘与火星，尘浪退去后留下两秒逐渐冷却的裂地。 */
export function drawRedSpearCrater(g: CanvasRenderingContext2D,v: WeaponImpactView):void {
  const fade=Math.min(1,v.age/.02)*clamp((2-v.age)/.5)
  if(fade<=0)return
  g.save();g.translate(v.x,v.y);g.rotate(v.angle);g.globalAlpha*=fade;g.lineCap='round'
  g.drawImage(craterSprite(),-10,-36,172,72)
  const heat=Math.exp(-v.age*2.4)
  g.globalAlpha=fade*heat*.72;g.strokeStyle='#e2a578';g.lineWidth=1.2
  g.beginPath();g.moveTo(21,0);g.lineTo(46,-1.2);g.lineTo(61,1.1);g.lineTo(81,-1.5);g.lineTo(104,.5);g.lineTo(137,-.5);g.stroke()
  // 近地双层冲击尘浪，不铺整屏爆闪。
  if(v.age<.4){
    const p=clamp(v.age/.4),alpha=(1-p)*(1-p)
    for(let ring=0;ring<2;ring++){
      g.globalAlpha=fade*alpha*(ring?.24:.42);g.strokeStyle=ring?'#ac8b67':'#ddd0b0';g.lineWidth=ring?3*(1-p)+.6:1.8*(1-p)+.35
      g.beginPath();g.ellipse(87,0,17+p*(48+ring*14),7+p*(19+ring*5),0,.06,Math.PI-.15);g.stroke()
      g.beginPath();g.ellipse(87,0,17+p*(48+ring*14),7+p*(19+ring*5),0,Math.PI+.13,Math.PI*2-.09);g.stroke()
    }
  }
  // 大块石片与细碎砂砾各自带高度和回落，方向、尺寸与寿命错开。
  for(let i=0;i<52;i++){
    const life=.38+(i%7)*.052,p=clamp(v.age/life)
    if(p>=1)continue
    const origin=21+(i*37)%116,side=i%2?1:-1,x=origin+Math.sin(i*2.17)*(13+i%5*3)*p
    const y=side*(2+(15+(i*7)%23)*p)-Math.sin(p*Math.PI)*(9+i%6*2)
    const size=i<14?2.1+i%4*.55:.7+i%3*.3, turn=i*.71+p*4
    g.save();g.translate(x,y);g.rotate(turn);g.globalAlpha=fade*(1-p)*.85
    g.fillStyle=i%3?'#847b6a':'#b9a687';g.strokeStyle='#c8b59a88';g.lineWidth=.45
    g.beginPath();g.moveTo(-size,0);g.lineTo(-.4,-size*.8);g.lineTo(size,.15);g.lineTo(.3,size*.65);g.closePath();g.fill()
    if(i<14)g.stroke()
    g.restore()
  }
  for(let i=0;i<28;i++){
    const delay=i%4*.014,age=v.age-delay,life=.48+(i%5)*.07
    if(age<0||age>=life)continue
    const p=age/life,side=i%2?1:-1,x=23+(i*43)%113+Math.sin(i*1.6)*p*12,y=side*(2+p*(10+i%4*5))-Math.sin(p*Math.PI)*8
    const r=3.5+p*(8+i%5*1.4)
    g.globalAlpha=fade*Math.sin(p*Math.PI)*.54;g.drawImage(dustSprite(i%4===0),x-r,y-r,r*2,r*2)
  }
  // 炽热火星短促向两侧飞散，细亮芯和暗红尾分层，保留落地的石质感。
  for(let i=0;i<40;i++){
    const life=.22+i%6*.05,p=clamp(v.age/life)
    if(p>=1)continue
    const side=i%2?1:-1,x=22+(i*29)%116+Math.cos(i*2.3)*23*p,y=side*(1+(10+i%7*3)*p)-Math.sin(p*Math.PI)*(4+i%3*3)
    const angle=i*2.4,length=1.5+(1-p)*(1+i%4)
    g.globalAlpha=fade*(1-p)*.7;g.strokeStyle=i%4?'#d4885e':'#ece0b4';g.lineWidth=i%4?.6:.95
    g.beginPath();g.moveTo(x,y);g.lineTo(x-Math.cos(angle)*length,y-Math.sin(angle)*length);g.stroke()
  }
  // 喷散结束后仅剩轻薄余热，避免两秒内始终遮住敌人和地面。
  if(v.age>.5)for(let i=0;i<7;i++){
    const p=(v.age*.6+i*.139)%1,x=29+i*16,y=(i%2?2:-2)-p*10,r=3+p*5
    g.globalAlpha=fade*Math.sin(p*Math.PI)*.17;g.drawImage(dustSprite(i%3===0),x-r,y-r,r*2,r*2)
  }
  g.restore()
}
