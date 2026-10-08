import { addItemCelStop } from '../../../itemArt'
import { svgIcon, type GroundDropView, type HeldWeaponView } from '../../../types'
import { redArmAim, redSlamLift, redSlamTip } from './motion'
import { quantizeDir4 } from '../../../../../game/art/rig/skeleton'

let shaft: HTMLCanvasElement | null = null
let head: HTMLCanvasElement | null = null
/** 细长的灰白菱面刃、乌木杆和铜箍先烘焙，红缨另绘以保留动作惯性。 */
function spearSprite(): HTMLCanvasElement {
  if (shaft) return shaft
  const canvas = document.createElement('canvas'); canvas.width = 252; canvas.height = 32
  const g = canvas.getContext('2d')!; g.scale(2, 2); g.translate(35, 8); g.lineJoin = 'round'
  const wood = g.createLinearGradient(0, -2, 0, 2); addItemCelStop(wood, 0, '#83654a'); addItemCelStop(wood, .4, '#4a3e36'); addItemCelStop(wood, 1, '#282c31')
  g.beginPath(); g.roundRect(-32, -1.55, 93, 3.1, .8); g.fillStyle = wood; g.fill(); g.strokeStyle = '#262931'; g.lineWidth = .75; g.stroke()
  g.strokeStyle = '#ad8b6088'; g.lineWidth = .4; g.beginPath(); g.moveTo(-29, -.8); g.bezierCurveTo(-5, -1.2, 14, -.6, 49, -.9); g.stroke()
  g.fillStyle = '#4b3b36'; g.fillRect(-9, -1.8, 20, 3.6); g.strokeStyle = '#a68f6c'; g.lineWidth = .6
  for (let x = -8; x < 10; x += 2.7) { g.beginPath(); g.moveTo(x, -1.6); g.lineTo(x + 1.3, 1.6); g.stroke() }
  for (const x of [-29, 45, 55]) { g.fillStyle = '#997f5b'; g.fillRect(x, -2, 2.8, 4); g.fillStyle = '#d3bf8a'; g.fillRect(x, -1.7, 2.8, .7) }
  const metal = g.createLinearGradient(0, -5, 0, 5); addItemCelStop(metal, 0, '#e9e7df'); addItemCelStop(metal, .45, '#a4b6be'); addItemCelStop(metal, .51, '#5b6f84'); addItemCelStop(metal, 1, '#c1cdce')
  g.beginPath(); g.moveTo(56, -2.8); g.lineTo(64, -4.3); g.quadraticCurveTo(74, -4.8, 88, 0); g.quadraticCurveTo(74, 4.8, 64, 4.3); g.lineTo(56, 2.8); g.closePath()
  g.fillStyle = metal; g.fill(); g.strokeStyle = '#323b49'; g.lineWidth = .8; g.stroke()
  g.beginPath(); g.moveTo(60, -.3); g.lineTo(87, 0); g.lineTo(64, 3.7); g.closePath(); g.fillStyle = '#e2e2da'; g.fill()
  g.strokeStyle = '#f4eacf'; g.lineWidth = .55; g.beginPath(); g.moveTo(64, -3.6); g.quadraticCurveTo(75, -3.9, 86, -.2); g.stroke()
  g.strokeStyle = '#5d7184'; g.lineWidth = .55; g.beginPath(); g.moveTo(61, 0); g.lineTo(83, 0); g.stroke()
  g.fillStyle = '#b6996d'; g.beginPath(); g.roundRect(53, -2.4, 6, 4.8, .6); g.fill(); g.strokeStyle = '#4f4138'; g.stroke()
  shaft = canvas; return canvas
}
/** 每条飘带根部固定，末端叠加重力、错相波动、步态与挥枪惯性，绘制不改变模拟时间。 */
function tassel(g: CanvasRenderingContext2D, view?: HeldWeaponView): void {
  const v = view?.motion, time = v?.time ?? view?.time ?? 0, gait = v?.gaitWeight ?? 0
  const axis = v ? redArmAim(v) : 0, dir = v ? quantizeDir4(v.phase === 'none' ? v.charging ? v.facing : v.bodyFacing ?? v.facing : v.aim) : 'left'
  const gravityX = Math.sin(axis), gravityY = (dir === 'right' ? -1 : 1) * Math.cos(axis)
  const duration = v ? v.phase === 'windup' ? v.move.windup : v.phase === 'active' ? v.move.active : v.move.recover : 1
  const p = v ? Math.max(0, Math.min(1, 1 - v.timer / Math.max(.001, duration))) : 0
  const sign = v?.segment === 0 ? -1 : 1
  const drag = v?.phase === 'active' ? sign * 11 * Math.sin(p * Math.PI) : v?.phase === 'recover' ? sign * 4 * (1 - p) * Math.sin(p * Math.PI * 2) : v?.phase === 'windup' ? -sign * 3 * Math.sin(p * Math.PI) : 0
  g.lineJoin='round'
  for (let ribbon = 0; ribbon < 7; ribbon++) {
    const rootY = -.9 + ribbon * .38, length = 21 + ribbon % 3 * 3, width = ribbon % 2 ? .95 : 1.4
    const points: Array<{x:number;y:number}> = []
    for (let i = 0; i <= 10; i++) {
      const u = i / 10, wave = Math.sin(time * (3.4 + ribbon * .06) - u * 6.4 + ribbon * .65) * (2.8 + gait * 2.7) * u * u
      const step = Math.sin((v?.gaitPhase ?? 0) - u * 2) * gait * 3.2 * u
      points.push({ x: 53.5 - length * u + gravityX * 5.3 * u * u + wave * .23,
        y: rootY + gravityY * (3 + ribbon * .36) * u + wave + step + drag * u * u })
    }
    g.beginPath();g.moveTo(points[0]!.x,points[0]!.y)
    for(let i=1;i<points.length;i++)g.lineTo(points[i]!.x,points[i]!.y-width*Math.sin(i/10*Math.PI)*.55)
    for(let i=points.length-1;i>=0;i--)g.lineTo(points[i]!.x,points[i]!.y+width*Math.sin(i/10*Math.PI))
    g.closePath();g.fillStyle=['#85373f','#a4424a','#c36961','#984048'][ribbon%4]!;g.fill()
    if(ribbon%2===0){g.strokeStyle='#eaa38888';g.lineWidth=.4;g.beginPath();g.moveTo(points[0]!.x,points[0]!.y);for(let i=1;i<points.length;i++)g.lineTo(points[i]!.x,points[i]!.y);g.stroke()}
  }
}
export function drawRedSpear(g: CanvasRenderingContext2D, view?: HeldWeaponView): void {
  const v=view?.motion
  g.save()
  if(v?.chargeFull||v?.charging){
    const lift=redSlamLift(v), tip=redSlamTip(v.phase==='none'?v.facing:v.aim,1-lift)
    const stretch=v.charging?1+(tip.length/88-1)*(v.chargeProgress??0):tip.length/88
    g.scale(stretch,1)
  }
  g.drawImage(spearSprite(), -35, -8, 126, 16); tassel(g, view);g.restore()
}
export function drawRedSpearHead(g: CanvasRenderingContext2D): void {
  if (!head) { head = document.createElement('canvas'); head.width = 86; head.height = 38; const h = head.getContext('2d')!; h.scale(2, 2); h.translate(-46, 9.5); drawRedSpear(h) }
  g.drawImage(head, 46, -9.5, 43, 19)
}
export function drawGroundRedSpear({ ctx: g, x, y }: GroundDropView): void {
  g.save(); g.translate(x - 13, y + 3); g.rotate(-.65); g.scale(.5, .5); drawRedSpear(g); g.restore()
}
export const RED_SPEAR_ICON = svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
 <defs><linearGradient id="red-spear-steel" x2="0" y2="1"><stop stop-color="#f0eddf"/><stop offset=".47" stop-color="#a6bdc3"/><stop offset=".52" stop-color="#576a77"/><stop offset="1" stop-color="#cbd3ca"/></linearGradient></defs>
 <g transform="translate(13 53) rotate(-49) scale(.58)" stroke="#29333c" stroke-linejoin="round">
 <rect x="-8" y="-2" width="77" height="4" rx="1" fill="#544733" stroke-width="1.1"/><path d="M-5-1H52" stroke="#a58b60"/>
 <path d="M51 1Q38 6 30 17Q48 14 56 2M53 2Q44 14 37 21Q54 16 58 3" fill="#b34143" stroke="#7c2837"/>
 <path d="M53 2Q42 10 35 15M56 2Q49 13 42 18" fill="none" stroke="#e59575" stroke-width=".8"/>
 <path d="M59-3 68-5Q81-5 98 0Q81 5 68 5L59 3Z" fill="url(#red-spear-steel)"/><path d="M64 0 96 0 68 4Z" fill="#e7e7d8" stroke="none"/>
 <rect x="55" y="-3" width="7" height="6" rx=".7" fill="#bfa374"/><path d="M6-2H22M6 2H22" stroke="#8a795b"/><path d="m7-2 2 4m2-4 2 4m2-4 2 4m2-4 2 4" stroke="#b49c78" stroke-width="1"/>
 </g></svg>`)
