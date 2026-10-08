import type { DoorSlot } from '../tilemap'
import { hash2 } from './artPalette'
import { drawMineSprite } from './mineAssets'

/** 深窟静态布景只在建房时烘焙，地貌不改变矿格和通行判定。 */
export function drawDeepHollowGround(g: CanvasRenderingContext2D, w: number, h: number, wall: number, tile: number, seed: number, doors: readonly DoorSlot[], arena: boolean): void {
  const entrance = (x: number, y: number) => doors.some(d => Math.hypot(x - (d.col + .5) * tile, y - (d.row + .5) * tile) < tile * 1.6)
  g.save(); g.beginPath(); g.rect(wall, wall, w - wall * 2, h - wall * 2); g.clip(); g.lineCap = 'round'
  // 连续的石灰沉积带以斜走向贯穿地面，保留主行走区的低对比。
  for (let i = 0; i < 8; i++) {
    const y = wall + 40 + hash2(seed + 94, i * 9) * (h - wall * 2 - 80)
    g.strokeStyle = i % 2 ? '#a7b3ab0c' : '#263b421a'; g.lineWidth = 12 + hash2(i, seed + 10) * 15
    g.beginPath(); g.moveTo(wall + 10, y); g.bezierCurveTo(w * .35, y - 45, w * .65, y + 25, w - wall - 10, y - 70); g.stroke()
    g.strokeStyle = '#bbc8bc1a'; g.lineWidth = .7; g.stroke()
  }
  // 墙脚堆积的灰白石屑与褪色根须，几何由房间种子固定。
  for (let i = 0; i < 34; i++) {
    const side = i % 3, q = hash2(seed + 32, i), s = hash2(i, seed + 69)
    const x = side === 0 ? wall + 18 + s * 24 : side === 1 ? w - wall - 18 - s * 24 : wall + 30 + q * (w - wall * 2 - 60)
    const y = side === 2 ? wall + 14 + s * 20 : wall + 35 + q * (h - wall * 2 - 70)
    if (entrance(x, y)) continue
    g.save(); g.translate(x, y); g.rotate(s * 2)
    if(drawMineSprite(g,'ground-rubble',-13,-9,26,20,'#78938e',.12)){g.restore();continue}
    g.fillStyle = '#1d2b3133'; g.beginPath(); g.ellipse(0, 3, 10, 3, 0, 0, Math.PI * 2); g.fill()
    g.strokeStyle = '#3b4b50'; g.lineWidth = .8; g.fillStyle = i % 3 ? '#7a8986' : '#a3a898'
    g.beginPath(); g.moveTo(-6, -1); g.lineTo(-3, -6); g.lineTo(5, -5); g.lineTo(9, -1); g.lineTo(5, 4); g.lineTo(-5, 3); g.closePath(); g.fill(); g.stroke()
    g.strokeStyle = '#cbd0bb88'; g.beginPath(); g.moveTo(-3, -4); g.lineTo(4, -4); g.stroke(); g.restore()
  }
  // 青蓝的小菌膜沿墙根零散发亮，不给整个房间覆盖饱和色。
  for (let i = 0; i < 9; i++) {
    const x = wall + 70 + hash2(i * 5, seed + 19) * (w - wall * 2 - 140), y = i % 2 ? wall + 35 : h - wall - 32
    if (entrance(x, y)) continue
    const glow = g.createRadialGradient(x, y, 1, x, y, 30); glow.addColorStop(0, '#8caebb22'); glow.addColorStop(1, '#617e8e00')
    g.fillStyle = glow; g.fillRect(x - 30, y - 30, 60, 60)
    for (let k = 0; k < 5; k++) { const px = x + Math.sin(k * 4 + seed) * 12, py = y + Math.cos(k * 3 + seed) * 4; g.fillStyle = k % 2 ? '#b5cbc078' : '#819fa37c'; g.beginPath(); g.ellipse(px, py, 1.7 + k % 2, .9, 0, 0, Math.PI * 2); g.fill() }
  }
  if (arena) {
    const x = w / 2, y = h / 2 + 25
    // 天然剥离形成的宽阔岩盘，不提前摆出尚未接入的 BOSS 或救援角色。
    g.save(); g.translate(x, y)
    const path = new Path2D('M-181-45Q-124-112-25-104Q76-114 151-58Q200-8 161 64Q68 101-58 91Q-164 85-181-45Z')
    g.fillStyle = '#a5ada719'; g.fill(path); g.strokeStyle = '#bfc8b329'; g.lineWidth = 1.5; g.stroke(path)
    g.strokeStyle = '#24363d55'; g.lineWidth = 1.2
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * 174, Math.sin(a) * 83); g.lineTo(Math.cos(a + .1) * 133, Math.sin(a + .1) * 64); g.lineTo(Math.cos(a - .12) * 110, Math.sin(a - .12) * 52); g.stroke() }
    g.restore()
  }
  g.restore()
}

export function drawDeepHollowWall(g: CanvasRenderingContext2D, w: number, wall: number, tile: number, seed: number, doors: readonly DoorSlot[]): void {
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round'
  for (let i = 0; i < 19; i++) {
    const x = wall + 10 + hash2(seed + 121, i) * (w - wall * 2 - 20), y = wall * .22
    if (doors.some(d => d.row < wall / tile && Math.abs((d.col + .5) * tile - x) < tile * 1.2)) continue
    const len = 25 + hash2(i, seed + 99) * 63
    g.strokeStyle = '#172d354d'; g.lineWidth = 6; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 3, y + 21, x - 5, y + 38, x - 3, y + len); g.stroke()
    g.strokeStyle = '#aab9af4f'; g.lineWidth = .8; g.beginPath(); g.moveTo(x - 2, y); g.bezierCurveTo(x + 1, y + 21, x - 8, y + 38, x - 5, y + len); g.stroke()
    if (i % 4 === 0) { g.strokeStyle = '#687b6066'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8, y + 27); g.lineTo(x + 3, y + 48); g.moveTo(x + 8, y + 27); g.lineTo(x + 16, y + 38); g.stroke() }
  }
  g.restore()
}
