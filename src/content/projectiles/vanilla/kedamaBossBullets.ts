import type { BulletRenderer, ProjectileDef } from '../types'
import { drawKedamaFur } from '../../../game/art/kedamaFur'

export const BOSS_FURRY_WAVE_ID = 'touhou:boss_furry_wave'
export const BOSS_FURRY_SEED_ID = 'touhou:boss_furry_seed'
export const BOSS_FURRY_SPLIT_ID = 'touhou:boss_furry_split'
export const BOSS_FURRY_ORBIT_ID = 'touhou:boss_furry_orbit'
export const BOSS_SPIRAL_ID = 'touhou:boss_furry_spiral'
export const BOSS_LINGER_ID = 'touhou:boss_furry_linger'
export const BOSS_SPIRAL_STAGE2_ID = 'touhou:boss_furry_spiral_stage2'
export const BOSS_LINGER_STAGE2_ID = 'touhou:boss_furry_linger_stage2'
const TAU = Math.PI * 2

/** 尖绒梭形弹：冷紫发光边、暖白核与囧脸保持毛绒语言，轮廓独立于普通毛玉。 */
const drawNeedle: BulletRenderer = ({ ctx: g, x, y, r, angle }) => {
  g.save(); g.translate(x, y); g.rotate(angle)
  const glow = g.createRadialGradient(0, 0, r * .3, 0, 0, r * 2.7)
  glow.addColorStop(0, '#fff2f0aa'); glow.addColorStop(.4, '#cbaaee66'); glow.addColorStop(1, '#ad87e700')
  g.fillStyle = glow; g.fillRect(-r * 3, -r * 3, r * 6, r * 6)
  const shape = new Path2D(`M${r*1.6} 0L${r*.6} ${-r*.43}L${r*.3} ${-r*.88}L${-r*.35} ${-r*.58}L${-r*1.4} ${-r*.62}L${-r*.82} 0L${-r*1.4} ${r*.62}L${-r*.35} ${r*.58}L${r*.3} ${r*.88}L${r*.6} ${r*.43}Z`)
  g.fillStyle = '#d0b0de'; g.strokeStyle = '#755580'; g.lineWidth = .9; g.fill(shape); g.stroke(shape)
  g.fillStyle = '#fff6e9'; g.beginPath(); g.moveTo(r * 1.25, 0); g.lineTo(-r * .8, -r * .35); g.lineTo(-r * .45, r * .25); g.closePath(); g.fill()
  // 囧脸沿飞行轴排列，外形在小尺寸下仍是尖锐的独立弹种。
  g.strokeStyle = '#705176'; g.lineWidth = .8
  for (const sign of [-1, 1]) { g.beginPath(); g.ellipse(r * .1, sign * r * .27, r * .11, r * .12, 0, 0, TAU); g.stroke() }
  g.fillStyle = '#eaae98'; g.beginPath(); g.moveTo(-r*.18,-r*.08); g.lineTo(-r*.18,r*.08); g.lineTo(-r*.5,r*.16); g.lineTo(-r*.5,-r*.16); g.closePath(); g.fill(); g.stroke()
  g.restore()
}

/** 爆弹为囧脸毛球，尖绒冠与临爆的发光环突出爆弹辨识。 */
const drawSeed: BulletRenderer = view => {
  const { ctx: g, x, y, r, phase } = view, warning = Math.max(0, ((view.splitProgress ?? 0) - .5) * 2)
  g.save(); g.translate(x, y)
  const glow = g.createRadialGradient(0, 0, r * .5, 0, 0, r * 2.5)
  glow.addColorStop(0, '#fff1d9cc'); glow.addColorStop(.45, '#e7afd877'); glow.addColorStop(1, '#c491de00')
  g.fillStyle = glow; g.fillRect(-r*2.5,-r*2.5,r*5,r*5)
  g.strokeStyle = '#cf9fde'; g.lineWidth = 1.4
  for (let i=0;i<8;i++) { const a=i*TAU/8+phase*.06; g.beginPath(); g.moveTo(Math.cos(a)*r*.8,Math.sin(a)*r*.8); g.lineTo(Math.cos(a-.08)*r*1.45,Math.sin(a-.08)*r*1.45); g.lineTo(Math.cos(a+.12)*r,Math.sin(a+.12)*r); g.stroke() }
  drawKedamaFur(g, r * (1 + warning * .12), { mouthOpen: .9 })
  g.globalAlpha *= warning; g.strokeStyle = '#ffe4b9'; g.lineWidth = 1.5; g.beginPath(); g.arc(0,0,r+5+warning*4,0,TAU); g.stroke(); g.restore()
}
const drawLinger = (life:number):BulletRenderer => ({ ctx: g, x, y, r, age = 0 }) => {
  const rise = Math.min(1, age / .65), fade = Math.min(1, (life-age)/.3)
  g.save(); g.translate(x,y); g.globalAlpha *= Math.max(0,fade)
  g.strokeStyle = '#ddbfec99'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(0,8,r*(1.25-rise*.25),r*.4,0,0,TAU); g.stroke()
  g.fillStyle = '#27203288'; g.beginPath(); g.ellipse(0,8,r*.9,r*.3,0,0,TAU); g.fill()
  g.translate(0,(1-rise)*14-4-Math.sin(age*3)*1.5); g.scale(1,rise)
  g.shadowColor = '#c4a0ea'; g.shadowBlur = 12; drawKedamaFur(g,r,{mouthOpen:.8}); g.restore()
}
export const bossFurryBullets: ProjectileDef[] = [
  { id:BOSS_FURRY_WAVE_ID,speed:369.6,radius:8,damage:12,render:drawNeedle },
  { id:BOSS_FURRY_SPLIT_ID,speed:277.2,radius:7,damage:10,render:drawNeedle },
  { id:BOSS_FURRY_SEED_ID,speed:223.3,radius:15,damage:18,render:drawSeed,split:{distance:220,count:16,projectileId:BOSS_FURRY_SPLIT_ID} },
  { id:BOSS_FURRY_ORBIT_ID,speed:662.2,radius:12,damage:12,render:drawNeedle },
  { id:BOSS_SPIRAL_ID,speed:184.8,radius:8,damage:12,render:drawNeedle,spiral:{angularSpeed:1.3475,initialRadius:32} },
  { id:BOSS_LINGER_ID,speed:0,radius:14,damage:5,render:drawLinger(5.65),life:5.65,lingering:{riseTime:.65} },
  { id:BOSS_SPIRAL_STAGE2_ID,speed:184.8,radius:8,damage:12,render:drawNeedle,ignoreRoomObstacles:true,spiral:{angularSpeed:1.3475,initialRadius:32,angularDecay:.75} },
  { id:BOSS_LINGER_STAGE2_ID,speed:0,radius:14,damage:5,render:drawLinger(10.65),life:10.65,lingering:{riseTime:.65} }
]
