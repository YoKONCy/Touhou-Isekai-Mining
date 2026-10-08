/**
 * 猩红圣堂斗场 · 格林试炼专属房间纹理（垂直切片，与 roomTextureE 同规格）
 *
 * 输出两层离屏画布（建房时一次性预渲染，运行时只 drawImage）：
 * - base：近黑打磨黑石砖地（砖缝透暗红）+ 中央巨型仪式法阵 + 三面黑石裙墙 + 落地火盆
 * - northFace：黑石砌块立面 + 顶部暗红垂坠帷幔窄边 + 暗金横杆流苏 + 石台压顶
 *
 * 与矿洞纹理（roomTextureE）的区别：无坑木、无苔藓、无地缝、无积水、无火把；
 * 光源由运行时火盆（TrialModule）提供。碰撞几何完全一致，本文件只改视觉。
 */
import { CONFIG } from '../config'
import type { DoorSlot } from '../tilemap'
import { hash2 } from './artPalette'

export interface RoomTextureTrialLayers {
  base: HTMLCanvasElement
  northFace: HTMLCanvasElement
}

/** 落地火盆点位（世界坐标；光源与动态火苗由 TrialModule 按此表渲染） */
export const BRAZIER_SPOTS: ReadonlyArray<{ x: number; y: number; seed: number }> = [
  { x: 300, y: 150, seed: 1.3 },
  { x: 720, y: 138, seed: 4.7 },
  { x: 1140, y: 150, seed: 2.9 },
  { x: 150, y: 430, seed: 6.1 },
  { x: 1290, y: 430, seed: 3.4 },
  { x: 150, y: 706, seed: 5.5 },
  { x: 1290, y: 706, seed: 2.2 }
]

export function createRoomTextureTrial(
  doors: readonly DoorSlot[] = [],
  seed = 0
): RoomTextureTrialLayers {
  const { tile: t, roomCols: cols, roomRows: rows, wallThickness: wt } = CONFIG
  const W = cols * t
  const H = rows * t
  const wall = wt * t
  const innerL = wall
  const innerT = wall
  const innerR = W - wall
  const innerB = H - wall

  // 2x 超采样（同矿洞纹理）
  const SS = 2
  const mk = (): [HTMLCanvasElement, CanvasRenderingContext2D] => {
    const cv = document.createElement('canvas')
    cv.width = W * SS
    cv.height = H * SS
    const c = cv.getContext('2d')!
    c.setTransform(SS, 0, 0, SS, 0, 0)
    return [cv, c]
  }
  const [base, bctx] = mk()
  const [face, fctx] = mk()

  const doorSet = new Set(doors.map((d) => d.col * 1000 + d.row))
  const isDoor = (c: number, r: number): boolean => doorSet.has(c * 1000 + r)

  // —— 1) 兜底：墙外/门洞近乎纯黑的酒黑 ——
  bctx.fillStyle = '#080306'
  bctx.fillRect(0, 0, W, H)

  // —— 2) 黑石砖地 ——
  drawSanctumFloor(bctx, innerL, innerT, innerR, innerB, seed)
  // —— 3) 中央仪式法阵（极暗克制，不能抢弹幕） ——
  drawRitualCircle(bctx, W / 2, H * 0.49, seed)
  // —— 4) 三面黑石裙墙（北墙 base 兜底，立面层会盖满） ——
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < wt; r++) if (!isDoor(c, r)) drawWallCell(bctx, c * t, r * t, t, null, c, r)
    for (let r = rows - wt; r < rows; r++) if (!isDoor(c, r)) drawWallCell(bctx, c * t, r * t, t, 'top', c, r)
  }
  for (let r = wt; r < rows - wt; r++) {
    for (let c = 0; c < wt; c++) if (!isDoor(c, r)) drawWallCell(bctx, c * t, r * t, t, 'right', c, r)
    for (let c = cols - wt; c < cols; c++) if (!isDoor(c, r)) drawWallCell(bctx, c * t, r * t, t, 'left', c, r)
  }
  // 门洞（试炼房实际无门；保留通用兜底，镂成纯黑）
  for (const d of doors) bctx.fillStyle = '#050204', bctx.fillRect(d.col * t, d.row * t, t, t)
  // —— 5) 落地火盆（铁座烘焙；火苗运行时画） ——
  for (const b of BRAZIER_SPOTS) drawBrazier(bctx, b.x, b.y, b.seed)

  // —— 6) 北墙立面：黑石墙 + 暗红帷幔窄边 + 石台压顶 ——
  drawFaceStone(fctx, W, wall, seed)
  drawDrapery(fctx, W, wall)
  drawFaceLedge(fctx, W, wall, seed)
  for (const d of doors) {
    fctx.save()
    fctx.globalCompositeOperation = 'destination-out'
    fctx.fillStyle = '#000'
    fctx.fillRect(d.col * t + 8, d.row * t + t - 46, t - 16, 52)
    fctx.restore()
  }

  return { base, northFace: face }
}

/* ================= 黑石砖地 ================= */

/** 打磨黑石大砖：错缝横列铺设，砖缝为近黑并透一线暗红，砖面微差 + 稀疏磨痕。 */
function drawSanctumFloor(
  ctx: CanvasRenderingContext2D,
  l: number, t0: number, r: number, b: number, seed: number
): void {
  // 砖缝底色（近黑，微暖）
  ctx.fillStyle = '#0b0508'
  ctx.fillRect(l, t0, r - l, b - t0)
  // 厅堂中央比四角略亮一丝的红酒底光
  const cx = (l + r) / 2
  const cy = (t0 + b) / 2
  const rg = ctx.createRadialGradient(cx, cy, 60, cx, cy, r - l)
  rg.addColorStop(0, 'rgba(58,22,30,0.30)')
  rg.addColorStop(0.55, 'rgba(34,13,19,0.18)')
  rg.addColorStop(1, 'rgba(10,4,8,0)')
  ctx.fillStyle = rg
  ctx.fillRect(l, t0, r - l, b - t0)

  const slabCols = ['#1d1319', '#1a1016', '#20141b', '#191015', '#1c1218']
  const courseH = 64
  const slabW = 128
  let row = 0
  for (let y = t0; y < b; y += courseH) {
    const hh = Math.min(courseH, b - y)
    const off = row % 2 ? slabW / 2 : 0
    let col = 0
    for (let x = l - off; x < r; x += slabW) {
      const jx = x <= l || x + slabW >= r ? 0 : (hash2(col * 3 + row * 17 + seed, col - row * 5) - 0.5) * 5
      const jy = (hash2(col * 7 - row * 3, row * 11 + seed) - 0.5) * 4
      const x0 = Math.max(l + 1.5, x + 1.5 + jx)
      const y0 = y + 1.5 + jy
      const w0 = Math.min(r - 1.5, x + slabW - 1.5) - x0
      const h0 = hh - 3
      if (w0 <= 4) { col++; continue }
      ctx.fillStyle = slabCols[Math.floor(hash2(col * 13 + 3, row * 19 + seed * 2) * slabCols.length) % slabCols.length]
      ctx.fillRect(x0, y0, w0, h0)
      // 砖顶/砖左一线暗红缝光
      ctx.fillStyle = 'rgba(120,44,50,0.13)'
      ctx.fillRect(x0, y0, w0, 1)
      ctx.fillRect(x0, y0, 1, h0)
      // 砖面打磨微差：大块极淡的受光面
      if (hash2(col + seed * 4, row - seed) < 0.3) {
        ctx.fillStyle = 'rgba(88,52,60,0.07)'
        ctx.fillRect(x0 + 6, y0 + 5, w0 * 0.5, 2)
      }
      col++
    }
    row++
  }

  // 磨痕/暗渍（少量；不画水洼苔藓）
  for (let i = 0; i < 26; i++) {
    const x = l + 24 + hash2(i * 5 + seed, 71) * (r - l - 48)
    const y = t0 + 20 + hash2(31, i * 9 + seed) * (b - t0 - 40)
    const k = hash2(i, seed * 3)
    if (k < 0.55) {
      // 细划痕
      ctx.strokeStyle = `rgba(150,110,118,${0.05 + 0.05 * hash2(i + 3, seed)})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + 10 + 14 * hash2(i + 9, seed), y + (hash2(i, seed) - 0.5) * 6)
      ctx.stroke()
    } else {
      // 暗渍
      ctx.fillStyle = 'rgba(6,2,4,0.22)'
      ctx.beginPath()
      ctx.ellipse(x, y, 8 + 12 * hash2(seed, i), 3 + 4 * hash2(i, seed), hash2(i, i + seed) * 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // 漂浮余烬的烘焙尘点
  for (let i = 0; i < 64; i++) {
    const x = l + 14 + hash2(i * 11 + 3, seed + 5) * (r - l - 28)
    const y = t0 + 12 + hash2(seed + 9, i * 7 + 1) * (b - t0 - 24)
    ctx.fillStyle = `rgba(210,${70 + Math.round(60 * hash2(i, seed))},40,${(0.05 + 0.12 * hash2(seed, i * 3)).toFixed(3)})`
    ctx.fillRect(x, y, 1.4, 1.4)
  }
}

/* ================= 中央仪式法阵 ================= */

/** 巨型暗色仪式圆环：多层断环/刻度/倒三角符印，全部低透明度压在地面下。 */
function drawRitualCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, seed: number): void {
  const ring = (rad: number, lw: number, alpha: number): void => {
    ctx.strokeStyle = `rgba(158,48,52,${alpha})`
    ctx.lineWidth = lw
    ctx.beginPath()
    ctx.arc(cx, cy, rad, 0, Math.PI * 2)
    ctx.stroke()
  }
  ring(332, 1.6, 0.16)
  ring(320, 0.8, 0.10)
  ring(252, 1, 0.14)
  ring(152, 1, 0.12)
  ring(30, 1.4, 0.18)

  // 外环 16 刻度
  ctx.strokeStyle = 'rgba(178,58,60,0.20)'
  ctx.lineWidth = 1.4
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8 + seed * 0.01
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * 322, cy + Math.sin(a) * 322)
    ctx.lineTo(cx + Math.cos(a) * 332, cy + Math.sin(a) * 332)
    ctx.stroke()
  }
  // 内环 8 短刻
  ctx.strokeStyle = 'rgba(178,58,60,0.15)'
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + Math.PI / 8
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * 158, cy + Math.sin(a) * 158)
    ctx.lineTo(cx + Math.cos(a) * 166, cy + Math.sin(a) * 166)
    ctx.stroke()
  }
  // 倒三角剧团符印（r=214 外接圆，尖朝下）
  ctx.strokeStyle = 'rgba(150,44,50,0.12)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  for (let i = 0; i <= 3; i++) {
    const a = Math.PI / 2 + i * (Math.PI * 2 / 3)
    const x = cx + Math.cos(a) * 214
    const y = cy + Math.sin(a) * 214
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
  }
  ctx.stroke()
  // 四正方位微亮节点
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 - Math.PI / 2
    ctx.fillStyle = 'rgba(206,74,66,0.32)'
    ctx.beginPath()
    ctx.arc(cx + Math.cos(a) * 332, cy + Math.sin(a) * 332, 2.6, 0, Math.PI * 2)
    ctx.fill()
  }
  // 中心暗红眼
  const cg = ctx.createRadialGradient(cx, cy, 1, cx, cy, 26)
  cg.addColorStop(0, 'rgba(120,30,30,0.20)')
  cg.addColorStop(1, 'rgba(60,12,16,0)')
  ctx.fillStyle = cg
  ctx.beginPath()
  ctx.arc(cx, cy, 26, 0, Math.PI * 2)
  ctx.fill()
}

/* ================= 黑石裙墙 ================= */

/** 一格黑石砌块墙（东西南低墙）；ledge=朝活动区的压顶石台朝向。 */
function drawWallCell(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, t: number,
  ledge: 'top' | 'bottom' | 'left' | 'right' | null,
  c: number, r: number
): void {
  ctx.fillStyle = '#150d12'
  ctx.fillRect(x, y, t, t)
  // 错缝砌块横列
  const courseH = 15
  for (let yy = 0; yy < t; yy += courseH) {
    const row = Math.floor(yy / courseH)
    ctx.fillStyle = '#080306'
    ctx.fillRect(x, y + yy, t, 2)
    ctx.fillStyle = 'rgba(120,50,54,0.07)'
    ctx.fillRect(x, y + yy + 2, t, 1)
    const bw = 22
    const off = row % 2 ? bw / 2 : 0
    for (let xx = -off; xx < t; xx += bw) {
      ctx.fillStyle = 'rgba(5,2,4,0.5)'
      ctx.fillRect(x + xx, y + yy, 2, courseH)
    }
    // 砌块面色微差
    if (hash2(c * 3 + row, r * 7 - row) < 0.5) {
      ctx.fillStyle = 'rgba(46,26,34,0.16)'
      ctx.fillRect(x + 3, y + yy + 4, t - 8, 3)
    }
  }
  // 稀疏竖向裂纹
  if (hash2(c * 11 + 3, r * 13 + 7) < 0.4) {
    ctx.strokeStyle = 'rgba(4,1,3,0.6)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    const cxp = x + 9 + hash2(r, c) * (t - 18)
    ctx.moveTo(cxp, y + 3)
    ctx.lineTo(cxp + (hash2(c + 1, r) - 0.5) * 7, y + t * 0.5)
    ctx.lineTo(cxp + (hash2(c + 2, r) - 0.5) * 9, y + t - 3)
    ctx.stroke()
  }
  // 朝活动区的压顶石台
  if (ledge) {
    ctx.fillStyle = '#231419'
    if (ledge === 'top') ctx.fillRect(x, y, t, 11)
    if (ledge === 'bottom') ctx.fillRect(x, y + t - 11, t, 11)
    if (ledge === 'left') ctx.fillRect(x, y, 11, t)
    if (ledge === 'right') ctx.fillRect(x + t - 11, y, 11, t)
    ctx.fillStyle = 'rgba(150,66,66,0.20)'
    if (ledge === 'top') ctx.fillRect(x, y + 1, t, 2)
    if (ledge === 'bottom') ctx.fillRect(x, y + t - 10, t, 2)
    if (ledge === 'left') ctx.fillRect(x + 1, y, 2, t)
    if (ledge === 'right') ctx.fillRect(x + t - 10, y, 2, t)
    ctx.fillStyle = '#050204'
    if (ledge === 'top') ctx.fillRect(x, y + 10, t, 2)
    if (ledge === 'bottom') ctx.fillRect(x, y + t - 12, t, 2)
    if (ledge === 'left') ctx.fillRect(x + 10, y, 2, t)
    if (ledge === 'right') ctx.fillRect(x + t - 12, y, 2, t)
  }
}

/* ================= 北墙立面 ================= */

/** 黑石砌块立面（通顶）。 */
function drawFaceStone(ctx: CanvasRenderingContext2D, W: number, wall: number, seed: number): void {
  ctx.fillStyle = '#140c11'
  ctx.fillRect(0, 0, W, wall)
  const ch = 22
  const bw = 72
  let row = 0
  for (let y = 38; y < wall - 12; y += ch) {
    const hh = Math.min(ch, wall - 12 - y)
    const off = row % 2 ? bw / 2 : 0
    for (let x = -off; x < W; x += bw) {
      const h = hash2(Math.floor(x / bw) * 5 + row, seed + row * 3)
      ctx.fillStyle = h < 0.5 ? '#170e14' : '#130b10'
      ctx.fillRect(x + 1, y + 1, bw - 2, hh - 2)
      ctx.fillStyle = 'rgba(120,50,54,0.05)'
      ctx.fillRect(x + 2, y + 2, bw - 4, 1.5)
    }
    ctx.fillStyle = '#070306'
    ctx.fillRect(0, y, W, 2)
    row++
  }
  // 竖裂纹
  for (let i = 0; i < 20; i++) {
    const x = hash2(i * 9 + 2, seed) * W
    const y0 = 40 + hash2(i, seed + 4) * 26
    ctx.strokeStyle = 'rgba(4,1,3,0.55)'
    ctx.lineWidth = 1.3
    ctx.beginPath()
    ctx.moveTo(x, y0)
    ctx.lineTo(x + (hash2(i, 1) - 0.5) * 8, y0 + 12)
    ctx.lineTo(x + (hash2(i, 2) - 0.5) * 10, y0 + 26)
    ctx.stroke()
  }
}

/** 顶部暗红垂坠帷幔窄边：暗金横杆 + 竖向褶裥 + 波浪下摆与流苏。 */
function drawDrapery(ctx: CanvasRenderingContext2D, W: number, wall: number): void {
  const top = 3
  const foldW = 26
  const baseY = 28
  const dip = 10
  // 帷布主体（下摆波浪：每褶中央向下垂尖）
  const cloth = ctx.createLinearGradient(0, top, 0, baseY + dip)
  cloth.addColorStop(0, '#4d1320')
  cloth.addColorStop(0.55, '#370d18')
  cloth.addColorStop(1, '#240810')
  ctx.fillStyle = cloth
  ctx.beginPath()
  ctx.moveTo(0, top)
  ctx.lineTo(W, top)
  ctx.lineTo(W, baseY)
  for (let x = W; x >= 0; x -= foldW) {
    ctx.quadraticCurveTo(x - foldW / 2, baseY + dip, x - foldW, baseY)
  }
  ctx.lineTo(0, top)
  ctx.closePath()
  ctx.fill()
  // 褶裥明暗：褶沟暗线 + 褶峰亮丝
  for (let x = 0; x <= W; x += foldW) {
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'
    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.moveTo(x + 1, top + 2)
    ctx.lineTo(x + 1, baseY - 2)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(168,52,62,0.20)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x + foldW / 2, top + 3)
    ctx.lineTo(x + foldW / 2, baseY + 2)
    ctx.stroke()
  }
  // 暗金横杆
  ctx.fillStyle = '#4a3318'
  ctx.fillRect(0, 1, W, 5)
  ctx.fillStyle = '#7c5c2c'
  ctx.fillRect(0, 1, W, 1.4)
  // 波浪下摆金边 + 褶尖小金穗
  ctx.strokeStyle = '#83612e'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(0, baseY)
  for (let x = 0; x <= W; x += foldW) {
    ctx.quadraticCurveTo(x + foldW / 2, baseY + dip, x + foldW, baseY)
  }
  ctx.stroke()
  for (let x = foldW / 2; x < W; x += foldW) {
    ctx.strokeStyle = '#83612e'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, baseY + dip - 1)
    ctx.lineTo(x, baseY + dip + 4)
    ctx.stroke()
    ctx.fillStyle = '#a97e3c'
    ctx.beginPath()
    ctx.arc(x, baseY + dip + 5, 1.5, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** 墙底石台压顶（黑石砌块，压进活动区 6px）。 */
function drawFaceLedge(ctx: CanvasRenderingContext2D, W: number, wall: number, seed: number): void {
  const top = wall - 14
  let x = 0
  let i = 0
  while (x < W) {
    const bw = 26 + hash2(i * 3 + 5, seed + 7) * 18
    const dip = (hash2(i, 11) - 0.5) * 4
    ctx.fillStyle = '#22131a'
    ctx.fillRect(x, top + dip, bw, 22 - dip)
    ctx.fillStyle = 'rgba(150,66,66,0.18)'
    ctx.fillRect(x + 1, top + dip + 1, bw - 2, 2)
    ctx.fillStyle = '#070306'
    ctx.fillRect(x, top + 2, 2, 20)
    x += bw
    i++
  }
  ctx.fillStyle = '#0a0508'
  ctx.fillRect(0, top - 3, W, 3)
  ctx.fillStyle = '#050204'
  ctx.fillRect(0, wall + 4, W, 3)
}

/* ================= 落地火盆（烘焙铁座） ================= */

/** 三足铁火盆：宽沿铁碗 + 外撇三足 + 盆内暗红余烬床（火苗运行时另画）。 */
function drawBrazier(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number): void {
  // 地面压影
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.beginPath()
  ctx.ellipse(x, y + 12, 17, 5.5, 0, 0, Math.PI * 2)
  ctx.fill()
  // 外撇三足
  ctx.strokeStyle = '#0c0810'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  for (const s of [-1, 0, 1]) {
    ctx.beginPath()
    ctx.moveTo(x + s * 6, y + 5)
    ctx.lineTo(x + s * 9.5, y + 14)
    ctx.stroke()
  }
  ctx.lineCap = 'butt'
  // 碗体阴影托
  ctx.fillStyle = '#0a060d'
  ctx.beginPath()
  ctx.ellipse(x, y + 3, 12, 8, 0, 0, Math.PI * 2)
  ctx.fill()
  // 碗体（梯形截面）
  const bg = ctx.createLinearGradient(x - 11, y, x + 11, y)
  bg.addColorStop(0, '#19121c')
  bg.addColorStop(0.5, '#2b1d28')
  bg.addColorStop(1, '#120c16')
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.moveTo(x - 11, y - 1)
  ctx.quadraticCurveTo(x - 8, y + 8, x - 6, y + 8)
  ctx.lineTo(x + 6, y + 8)
  ctx.quadraticCurveTo(x + 8, y + 8, x + 11, y - 1)
  ctx.closePath()
  ctx.fill()
  // 碗沿
  ctx.fillStyle = '#35232f'
  ctx.beginPath()
  ctx.ellipse(x, y - 1, 11, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  // 盆内余烬床
  const eg = ctx.createRadialGradient(x, y - 2, 1, x, y - 1, 8)
  eg.addColorStop(0, '#7a2418')
  eg.addColorStop(0.6, '#3d120d')
  eg.addColorStop(1, '#180708')
  ctx.fillStyle = eg
  ctx.beginPath()
  ctx.ellipse(x, y - 1, 8.5, 2.8, 0, 0, Math.PI * 2)
  ctx.fill()
  // 静态余烬点
  for (let i = 0; i < 5; i++) {
    const ex = x + (hash2(i, seed) - 0.5) * 12
    const ey = y - 1 + (hash2(seed, i) - 0.5) * 2.4
    ctx.fillStyle = i % 2 ? 'rgba(255,138,56,0.8)' : 'rgba(255,86,40,0.8)'
    ctx.beginPath()
    ctx.arc(ex, ey, 0.9 + hash2(i * 2, seed) * 0.7, 0, Math.PI * 2)
    ctx.fill()
  }
}
