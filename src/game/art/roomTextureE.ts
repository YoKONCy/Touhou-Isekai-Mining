/**
 * 矿洞共用房间底板（原入口名称保留，群系通过数据变种）
 *
 * 输出两层离屏画布（房间创建时一次性预渲染，运行时只 drawImage）：
 * - base：连续低对比岩面 + 东西南三面低岩墙 + 全部门洞（通道+坑木门框）
 * - northFace：北墙拔高立面（岩层/墙顶石台/坑木支架/北墙门架），
 *   每帧盖在所有实体之上，玩家贴近北墙时整体半透明——遮挡伪立体的关键。
 *
 * 碰撞几何与旧版完全一致，本文件只改视觉。
 */
import { CONFIG } from '../config'
import type { BiomeFloorStyle } from '../../content/biomes/types'
import { biomeCave } from '../../content/biomes/vanilla/cave'
import { drawCaveFloor } from './caveFloor'
import { drawFloorDecorations, type BackgroundRock } from './floorDecorations'
import type { DoorSlot } from '../tilemap'
import { ART, hash2 } from './artPalette'
import { drawDeepHollowGround, drawDeepHollowWall } from './deepHollow'
import type { CaveSceneStyle } from '../../content/biomes/types'
import { resolveCaveArt } from './caveStyle'
import { drawMineWalls, drawMineVariation } from './mineScenery'
import { drawMineSprite } from './mineAssets'

export interface RoomTextureELayers {
  /** 纯背景岩块锚点，供野生亚麻逐块判定；不参与碰撞或采矿。 */
  backgroundRocks?: readonly BackgroundRock[]
  base: HTMLCanvasElement
  northFace: HTMLCanvasElement
}

export type Side = 'n' | 's' | 'w' | 'e'

/** 火把只挂北/西/东三面墙（南门是玩家进出面） */
export type TorchSide = 'n' | 'w' | 'e'
export interface TorchSlot {
  side: TorchSide
  col: number
  row: number
  /** 错峰点燃序号 */
  index: number
  /** 火焰随机种子 */
  seed: number
}

export function createRoomTextureE(
  doors: readonly DoorSlot[] = [],
  seed = 0,
  floorStyle?: BiomeFloorStyle,
  floor = 1,
  landmark?: 'kedama_arena',
  sceneStyle?: CaveSceneStyle
): RoomTextureELayers {
  const { tile: t, roomCols: cols, roomRows: rows, wallThickness: wt } = CONFIG
  const W=cols*t,H=rows*t,wall=wt*t,art=resolveCaveArt(biomeCave,floor)
  const material=floorStyle??art.floor,variation=sceneStyle??art.scene
  // 所有楼层共用二倍采样的底图与北墙层；群系只改变材质参数和装饰叠层。
  const mk=():[HTMLCanvasElement,CanvasRenderingContext2D]=>{const c=document.createElement('canvas');c.width=W*2;c.height=H*2;const g=c.getContext('2d')!;g.scale(2,2);return [c,g]}
  const [base,bctx]=mk(),[face,fctx]=mk()
  bctx.fillStyle=ART.void;bctx.fillRect(0,0,W,H)
  drawCaveFloor(bctx,W,H,wall,seed,material)
  const backgroundRocks=drawFloorDecorations(bctx,W,H,wall,t,doors,seed,material,variation.boneFragments)
  const vents=layoutSteamVents(doors,seed);drawSteamVentCracks(bctx,vents)
  drawMineWalls(bctx,fctx,W,H,wall,t,seed,doors,variation)
  drawTimbers(fctx,W,wall,t,doors.filter(d=>d.row<wt))
  drawMineVariation(bctx,fctx,W,H,wall,t,seed,doors,variation)
  if(variation.deepHollow){drawDeepHollowGround(bctx,W,H,wall,t,seed,doors,landmark==='kedama_arena');drawDeepHollowWall(fctx,W,wall,t,seed,doors)}
  const sideOf=(d:DoorSlot):Side=>d.row<wt?'n':d.row>=rows-wt?'s':d.col<wt?'w':'e'
  for(const d of doors){
    const side=sideOf(d),x=d.col*t,y=d.row*t
    // 通道覆盖整段墙厚，门框与符印仍共用实际门格的中心，避免半段黑色空缝。
    bctx.save();bctx.fillStyle=material.base
    if(side==='n'||side==='s')bctx.fillRect(x,side==='n'?0:H-wall,t,wall)
    else bctx.fillRect(side==='w'?0:W-wall,y,wall,t)
    bctx.restore()
    withDoorTransform(bctx,x,y,t,side,()=>drawPassage(bctx,t))
    if(side==='n'){
      fctx.save();fctx.globalCompositeOperation='destination-out';fctx.fillRect(x,y,t,t);fctx.restore()
      withDoorTransform(fctx,x,y,t,side,()=>drawTimberPortal(fctx,t))
    }else withDoorTransform(bctx,x,y,t,side,()=>drawTimberPortal(bctx,t))
  }
  for(const tr of layoutTorches(doors)){
    const g=tr.side==='n'?fctx:bctx,head=torchHeadPos(tr)
    if(!drawMineSprite(g,tr.side==='n'?'torch-n':tr.side==='w'?'torch-w':'torch-e',head.x-18,head.y-12,36,42))withDoorTransform(g,tr.col*t,tr.row*t,t,tr.side,()=>drawUnlitTorch(g,t))
  }
  return {base,northFace:face,backgroundRocks}
}

/* ================= 坑木支架 ================= */

/** 北墙顶梁 + 立柱（门洞两侧必立，其余每 4 格一根） */
function drawTimbers(ctx: CanvasRenderingContext2D, W: number, wall: number, t: number, northDoors: readonly DoorSlot[]): void {
  ctx.save()
  const L=wall,R=W-wall
  let ready=true
  for(let x=L;x<R;x+=96)ready=drawMineSprite(ctx,'timber-beam',x,5,Math.min(96,R-x),13)&&ready
  if(ready){
    for(let c=3;c<CONFIG.roomCols-3;c+=4){const x=(c+.5)*t;if(!northDoors.some(d=>Math.abs((d.col+.5)*t-x)<t))drawMineSprite(ctx,'timber-post',x-5,17,10,wall-17)}
    ctx.restore();return
  }
  ctx.restore()
  // —— 顶梁（y 6..22 贯通） ——
  ctx.fillStyle = ART.timber.dark
  ctx.fillRect(0, 4, W, 19)
  ctx.fillStyle = ART.timber.main
  ctx.fillRect(0, 7, W, 13)
  ctx.fillStyle = ART.timber.hi
  ctx.fillRect(0, 8, W, 2)
  ctx.fillStyle = ART.timber.joint
  ctx.fillRect(0, 20, W, 3)
  // 木纹（竖向短丝）+ 木节
  ctx.strokeStyle = ART.timber.grain
  ctx.lineWidth = 1
  for (let x = 24; x < W; x += 42 + hash2(x, 1) * 12) {
    ctx.beginPath()
    ctx.moveTo(x, 9)
    ctx.lineTo(x + 1.5, 19)
    ctx.stroke()
  }
  for (let i = 0; i < 5; i++) {
    const kx = hash2(i * 17 + 3, 2) * W
    ctx.strokeStyle = ART.timber.grain
    ctx.beginPath()
    ctx.ellipse(kx, 13.5, 3.4, 2.2, 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  // —— 立柱位置：门两侧优先，等距柱补齐（去重） ——
  const posts: number[] = []
  const tryAdd = (xc: number): void => {
    if (posts.every((p) => Math.abs(p - xc) > 34)) posts.push(xc)
  }
  for (const d of northDoors) {
    tryAdd(d.col * t + 9)
    tryAdd(d.col * t + t - 9)
  }
  for (let c = 2; c < CONFIG.roomCols; c += 4) {
    const inDoor = northDoors.some((d) => Math.abs((d.col + 0.5) * t - (c + 0.5) * t) < t * 1.5)
    if (!inDoor) tryAdd((c + 0.5) * t)
  }
  posts.sort((a, b) => a - b)
  for (const xc of posts) drawPost(ctx, xc, 20, wall + 4)
}

/** 一根坑木立柱：左暗 / 主 / 右亮三面 + 木纹木节 + 柱底压影 */
function drawPost(ctx: CanvasRenderingContext2D, xc: number, y0: number, y1: number): void {
  const w = 14
  ctx.fillStyle = ART.ink
  ctx.fillRect(xc - w / 2 - 1, y0 - 1, w + 2, y1 - y0 + 2)
  ctx.fillStyle = ART.timber.main
  ctx.fillRect(xc - w / 2, y0, w, y1 - y0)
  ctx.fillStyle = ART.timber.dark
  ctx.fillRect(xc - w / 2, y0, 3, y1 - y0)
  ctx.fillStyle = ART.timber.hi
  ctx.fillRect(xc + w / 2 - 2, y0, 2, y1 - y0)
  // 木纹横丝
  ctx.strokeStyle = ART.timber.grain
  ctx.lineWidth = 1
  for (let y = y0 + 18; y < y1 - 6; y += 22 + hash2(xc, y) * 8) {
    ctx.beginPath()
    ctx.moveTo(xc - 4, y)
    ctx.quadraticCurveTo(xc, y + 2, xc + 4, y)
    ctx.stroke()
  }
  // 木节
  ctx.strokeStyle = ART.timber.grain
  ctx.beginPath()
  ctx.ellipse(xc, y0 + (y1 - y0) * 0.4, 2.6, 3.6, 0, 0, Math.PI * 2)
  ctx.stroke()
  // 柱底压在石台上的暗影
  ctx.fillStyle = ART.timber.joint
  ctx.fillRect(xc - w / 2 - 2, y1 - 4, w + 4, 4)
}

/* ================= 门洞 ================= */

/** 把绘制坐标系旋到"门洞朝向恒为北（远端在上）"，四个方向同一套画法 */
export function withDoorTransform(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: number,
  side: Side,
  fn: () => void
): void {
  ctx.save()
  if (side === 'n') ctx.translate(x, y)
  else if (side === 's') {
    ctx.translate(x + t, y + t)
    ctx.rotate(Math.PI)
  } else if (side === 'w') {
    ctx.translate(x, y + t)
    ctx.rotate(-Math.PI / 2)
  } else {
    ctx.translate(x + t, y)
    ctx.rotate(Math.PI / 2)
  }
  fn()
  ctx.restore()
}

/** 门洞通道：通路碎石地 + 向北沉入黑暗的渐变 */
function drawPassage(ctx: CanvasRenderingContext2D, t: number): void {
  // 近端（格底）通路地面
  ctx.fillStyle = ART.path
  ctx.fillRect(0, 0, t, t)
  // 暗通道
  const g = ctx.createLinearGradient(0, 4, 0, t)
  g.addColorStop(0, ART.voidDeep)
  g.addColorStop(0.7, ART.void)
  g.addColorStop(1, '#1b1520')
  ctx.fillStyle = g
  ctx.fillRect(8, 4, t - 16, t - 8)
  ctx.save();ctx.globalAlpha=.55
  const rubble=drawMineSprite(ctx,'ground-rubble',11,t-13,t-22,12)
  ctx.restore()
  if(rubble)return
  // 近端碎石（与房间地面的衔接）
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = ART.floor.pebble
    ctx.beginPath()
    ctx.ellipse(12 + i * 11 + hash2(i, t) * 4, t - 7 - hash2(i, i) * 3, 2.2, 1.6, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  // 洞口顶部一线冷光（提示可通行）
  ctx.fillStyle = 'rgba(150,170,190,0.10)'
  ctx.fillRect(10, 6, t - 20, 2)
}

/** 坑木门框（本地坐标，远端在北）：两根立柱 + 顶横梁，三面受光 */
function drawTimberPortal(ctx: CanvasRenderingContext2D, t: number): void {
  if(drawMineSprite(ctx,'door-frame',0,0,t,t))return
  const wood = (x: number, y: number, w: number, h: number): void => {
    ctx.fillStyle = ART.ink
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2)
    ctx.fillStyle = ART.timber.main
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = ART.timber.dark
    ctx.fillRect(x, y, 2.5, h)
    ctx.fillStyle = ART.timber.hi
    ctx.fillRect(x + w - 2, y, 2, h)
  }
  // 立柱（净洞口 17~31 共 14px，配角色 26px 身高贴门时只遮帽尖）
  wood(4, 2, 6, t - 8)
  wood(t - 10, 2, 6, t - 8)
  // 顶横梁（远端）
  ctx.fillStyle = ART.ink
  ctx.fillRect(4, 0, t - 8, 10)
  ctx.fillStyle = ART.timber.main
  ctx.fillRect(5, 1, t - 10, 7)
  ctx.fillStyle = ART.timber.hi
  ctx.fillRect(5, 2, t - 10, 2)
}

/* ================= 墙上火把 ================= */

/** 火把本地坐标（withDoorTransform 本地系：远端/墙在北=屏幕上，活动区在南=屏幕下） */
const TORCH_HEAD_Y = 0.72 // 火把头碗（格内归一化坐标）
const TORCH_LIGHT_Y = 1.0 // 光源点（贴墙根，照亮地面）

/**
 * 确定性火把布局：北墙 2 根 + 西/东墙各 1 根，候选位逐一避让门洞及其邻格。
 * 南门不挂（玩家进出面）。
 */
export function layoutTorches(doors: readonly DoorSlot[]): TorchSlot[] {
  const { roomCols: cols, wallThickness: wt } = CONFIG
  // 门格及四邻格都不放（门框两侧立柱需要净空）
  const busy = (c: number, r: number): boolean =>
    doors.some((d) => Math.abs(d.col - c) <= 1 && Math.abs(d.row - r) <= 1)

  const out: TorchSlot[] = []
  const push = (side: TorchSide, c: number, r: number): void => {
    if (out.some((q) => q.side === side && q.col === c && q.row === r)) return
    out.push({ side, col: c, row: r, index: out.length, seed: hash2(c * 7 + 1, r * 13 + 3) * 10 })
  }

  // 北墙 2 根（内缘行 wt-1）
  for (const c of [7, 22, 5, 24, 10, 19]) {
    if (out.filter((q) => q.side === 'n').length >= 2) break
    if (!busy(c, wt - 1)) push('n', c, wt - 1)
  }
  // 西墙 1 根
  for (const r of [6, 13, 4, 15, 10]) {
    if (!busy(wt - 1, r)) {
      push('w', wt - 1, r)
      break
    }
  }
  // 东墙 1 根
  for (const r of [13, 6, 15, 4, 10]) {
    if (!busy(cols - wt, r)) {
      push('e', cols - wt, r)
      break
    }
  }
  return out
}

/** 火把本地坐标 → 世界坐标（与 withDoorTransform 同一旋转矩阵） */
export function torchLocalToWorld(
  tr: TorchSlot,
  lx: number,
  ly: number
): { x: number; y: number } {
  const t = CONFIG.tile
  const cx = (tr.col + 0.5) * t
  const cy = (tr.row + 0.5) * t
  const dx = lx - t / 2
  const dy = ly - t / 2
  switch (tr.side) {
    case 'n':
      return { x: cx + dx, y: cy + dy }
    case 'w':
      return { x: cx + dy, y: cy - dx }
    case 'e':
      return { x: cx - dy, y: cy + dx }
  }
}

/** 火把光源点世界坐标 */
export function torchLightPos(tr: TorchSlot): { x: number; y: number } {
  const t = CONFIG.tile
  return torchLocalToWorld(tr, t / 2, t * TORCH_LIGHT_Y)
}

/** 木柄、火碗与竖直火焰共用同一个头部锚点；与照明投射到地面的锚点分别定义。 */
export function torchHeadPos(tr:TorchSlot):{x:number;y:number}{
  return torchLocalToWorld(tr,CONFIG.tile/2,CONFIG.tile*TORCH_HEAD_Y-1)
}

/**
 * 单根火把点燃进度 0~1。
 * @param litStart 清场时刻；null 从未点燃；负值表示建房前已亮（空房）
 */
export function torchProgress(time: number, litStart: number | null, index: number): number {
  if (litStart === null) return 0
  const { stagger, igniteDur } = CONFIG.art.torch
  const p = (time - (litStart + index * stagger)) / igniteDur
  return Math.max(0, Math.min(1, p))
}

/** 火焰闪烁系数（光源强度与火苗外形共用，保证"光随火动"） */
export function torchFlicker(time: number, seed: number): number {
  return (
    0.9 +
    0.09 * Math.sin(time * 11 + seed * 2.1) +
    0.05 * Math.sin(time * 17.3 + seed) +
    0.03 * Math.sin(time * 29.7 + seed * 3.7)
  )
}

/** 回弹缓动：火苗从 0 窜起时轻轻冒一下头 */
function easeOutBack(x: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

/** 未点燃火把（烘焙）：墙上铁箍座 + 木柄 + 铁碗 + 焦黑油布卷 */
function drawUnlitTorch(ctx: CanvasRenderingContext2D, t: number): void {
  const hx = t / 2

  // 铁箍座（钉在岩面上）
  ctx.fillStyle = ART.ink
  ctx.fillRect(hx - 8, t * 0.25, 16, 9)
  ctx.fillStyle = '#3a3f47'
  ctx.fillRect(hx - 7, t * 0.26, 14, 7)
  ctx.fillStyle = '#6a7078'
  ctx.fillRect(hx - 5, t * 0.28, 2, 2)
  ctx.fillRect(hx + 3, t * 0.28, 2, 2)

  // 木柄（向活动区伸出，本地垂直向下）
  ctx.fillStyle = ART.ink
  ctx.fillRect(hx - 3, t * 0.33, 6, t * 0.35)
  ctx.fillStyle = ART.timber.main
  ctx.fillRect(hx - 2, t * 0.34, 4, t * 0.33)
  ctx.fillStyle = ART.timber.dark
  ctx.fillRect(hx - 2, t * 0.34, 1.4, t * 0.33)
  ctx.fillStyle = ART.timber.hi
  ctx.fillRect(hx + 0.6, t * 0.34, 1.2, t * 0.33)

  // 铁碗（裹油布的火把头）
  const hy = t * TORCH_HEAD_Y
  ctx.fillStyle = ART.ink
  ctx.beginPath()
  ctx.ellipse(hx, hy, 6.5, 5.4, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#454a52'
  ctx.beginPath()
  ctx.ellipse(hx, hy - 0.6, 5.4, 4.2, 0, Math.PI, 0)
  ctx.fill()

  // 焦黑油布卷（未点燃状态：两小撮焦布头，明示"这是火把"）
  ctx.strokeStyle = '#1c140e'
  ctx.lineWidth = 2.4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(hx - 2, hy - 2)
  ctx.lineTo(hx - 3.4, hy - 7)
  ctx.moveTo(hx + 1.5, hy - 2.4)
  ctx.lineTo(hx + 2.6, hy - 7.6)
  ctx.stroke()
  ctx.lineCap = 'butt'
}

/**
 * 点燃后的火苗在世界坐标中竖直跳动；侧墙只改变支臂朝向。
 */
export function drawTorchFlame(
  ctx: CanvasRenderingContext2D,
  tr: TorchSlot,
  time: number,
  progress: number
): void {
  if (progress <= 0) return
  ctx.save()
  try {
    const s = Math.max(0, easeOutBack(progress))
    const fl = Math.max(0.55, torchFlicker(time, tr.seed)) * s
    const {x:hx,y:hy}=torchHeadPos(tr)
    const sway = Math.sin(time * 3.4 + tr.seed) * 1.5 * s
    const h = 19 * fl
    const w = 12 * fl

    // 自发光晕（加色；火把本身的"亮"）
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const glow = ctx.createRadialGradient(hx + sway, hy - 5, 2, hx + sway, hy - 5, 26 * s)
    glow.addColorStop(0, `rgba(255,150,60,${0.3 * s})`)
    glow.addColorStop(1, 'rgba(255,120,40,0)')
    ctx.fillStyle = glow
    ctx.fillRect(hx - 28 * s, hy - 32 * s, 56 * s, 52 * s)
    ctx.restore()

    const frame=Math.floor(time*7+tr.seed*2)%4
    const names=['torch-flame-0','torch-flame-1','torch-flame-2','torch-flame-3'] as const
    if(drawMineSprite(ctx,names[frame]!,hx+sway-w/2,hy-h,w,h+1))return

    // 外焰（橙红水滴）→ 内焰（金黄）→ 焰心（暖白）
    const teardrop = (ww: number, hh: number, color: string): void => {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(0, -hh)
      ctx.bezierCurveTo(ww * 0.95, -hh * 0.5, ww * 0.5, -hh * 0.08, 0, 0)
      ctx.bezierCurveTo(-ww * 0.5, -hh * 0.08, -ww * 0.95, -hh * 0.5, 0, -hh)
      ctx.closePath()
      ctx.fill()
    }
    ctx.save()
    ctx.translate(hx + sway, hy)
    teardrop(w, h, '#ff7a2a')
    teardrop(w * 0.62, h * 0.66, '#ffc24a')
    teardrop(w * 0.3, h * 0.4, '#fff3b8')
    ctx.restore()
  } finally {ctx.restore()}
}

/* ================= 冒热气的地缝 ================= */

/** 地缝：折线裂缝（烘焙余烬点）+ 热源点（运行时热气粒子与微光） */
export interface SteamVent {
  x: number
  y: number
  seed: number
  /** 裂缝折线节点（世界坐标） */
  pts: { x: number; y: number }[]
}

/**
 * 确定性地缝布局：每房 0~2 条，落在活动区内缩 2 格区域，
 * 避开门通道中线 ±2 格。
 */
export function layoutSteamVents(doors: readonly DoorSlot[], seed: number): SteamVent[] {
  const { tile: t, roomCols: cols, roomRows: rows, wallThickness: wt } = CONFIG
  const banCols = doors.filter((d) => d.row < wt || d.row >= rows - wt).map((d) => d.col)
  const banRows = doors.filter((d) => d.col < wt || d.col >= cols - wt).map((d) => d.row)

  const n = (() => {
    const h = hash2(seed * 5 + 3, 77)
    if (h < 0.18) return 0
    return h < 0.88 ? 1 : 2
  })()

  const vents: SteamVent[] = []
  for (let i = 0; i < n; i++) {
    const fx = 0.16 + hash2(seed + i * 9, 3) * 0.68
    const fy = 0.18 + hash2(seed + i * 7, 11) * 0.6
    const x = (wt * t + 2 * t) + fx * ((cols - 2 * wt - 4) * t)
    const y = (wt * t + 2 * t) + fy * ((rows - 2 * wt - 5) * t)
    const col = Math.floor(x / t)
    const row = Math.floor(y / t)
    // 压到门通道中轴就放弃本缝（数量已经是 0~2 的概率档，少一条无妨）
    if (banCols.some((bc) => Math.abs(bc - col) <= 2)) continue
    if (banRows.some((br) => Math.abs(br - row) <= 2)) continue

    // 主轴方向（水平/斜向两种条状裂缝）
    const ang0 = hash2(i, seed) < 0.5 ? 0 : Math.PI / 5
    const segs = 3 + Math.floor(hash2(seed * 3, i * 5) * 2)
    const pts = [{ x, y }]
    let px = x
    let py = y
    for (let s = 0; s < segs; s++) {
      const a = ang0 + (hash2(seed + s, i * 13 + 1) - 0.5) * 1.1
      const len = 11 + hash2(s * 7 + seed, i * 3) * 13
      px += Math.cos(a) * len
      py += Math.sin(a) * len
      pts.push({ x: px, y: py })
    }
    vents.push({ x, y, seed: seed * 10 + i * 3.7, pts })
  }
  return vents
}

/** 烘焙地缝：ink 宽裂缝 + 暗红缝底 + 沿线 2~3 处余烬点 */
function drawSteamVentCracks(ctx: CanvasRenderingContext2D, vents: SteamVent[]): void {
  for (const v of vents) {
    const path = (w: number, color: string): void => {
      ctx.strokeStyle = color
      ctx.lineWidth = w
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      v.pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
      ctx.stroke()
      ctx.lineCap = 'butt'
    }
    // 烧蚀晕染与塌陷缝唇先烘焙，余烬只在深处，不描成霓虹线。
    path(13, 'rgba(25,19,23,0.16)')
    path(9, '#3e3b3655')
    path(5, '#242729')
    path(1.2, '#412829')
    // 分段错位岩唇使裂隙有深浅与宽窄变化，而非等宽的彩色线条。
    for(let i=1;i<v.pts.length;i++){
      const a=v.pts[i-1],b=v.pts[i],r=hash2(i+17,v.seed*1000)
      ctx.beginPath();ctx.moveTo(a.x-1,a.y-2);ctx.lineTo(b.x-2,b.y-2.5);ctx.lineTo(b.x+1,b.y-4-r*2);ctx.lineTo(a.x+2,a.y-3);ctx.closePath()
      ctx.fillStyle=i%2?'#72705b55':'#4f514650';ctx.fill()
      ctx.strokeStyle='#a59a743b';ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(a.x+2,a.y-3);ctx.lineTo(b.x+1,b.y-4-r*2);ctx.stroke()
    }
    ctx.save()
    ctx.translate(-0.8, 1.6)
    path(0.7, '#8c766044')
    ctx.restore()
    for(let k=1;k<v.pts.length-1;k++){
      const p=v.pts[k],side=k%2?1:-1
      ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+side*(4+hash2(k,v.seed|0)*7),p.y+3);ctx.lineTo(p.x+side*12,p.y+1)
      ctx.strokeStyle='#25212a';ctx.lineWidth=1;ctx.stroke()
      ctx.beginPath();ctx.moveTo(p.x+3,p.y+4);ctx.lineTo(p.x+6,p.y+3);ctx.lineTo(p.x+8,p.y+5);ctx.closePath();ctx.fillStyle='#65584b';ctx.fill()
      ctx.strokeStyle='#99846b55';ctx.lineWidth=.6;ctx.stroke()
    }

    // 余烬点（确定性 2~3 处；亮芯只在其中 1~2 处）
    const embers = 2 + (hash2(v.seed | 0, 5) > 0.5 ? 1 : 0)
    for (let i = 0; i < embers; i++) {
      const p = v.pts[1 + Math.floor(hash2(i, v.seed | 0) * (v.pts.length - 1))]
      const ex = p.x + (hash2(v.seed | 0, i * 3) - 0.5) * 3
      const ey = p.y + (hash2(i * 7, v.seed | 0) - 0.5) * 3
      ctx.fillStyle = ART.ember.orange
      ctx.beginPath()
      ctx.arc(ex, ey, 1.7, 0, Math.PI * 2)
      ctx.fill()
      if (i < embers - 1) {
        ctx.fillStyle = ART.ember.core
        ctx.beginPath()
        ctx.arc(ex, ey, 0.8, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}

/** 地缝余烬慢闪系数（光源用；比火把慢得多，"地热"的呼吸感） */
export function emberPulse(time: number, seed: number): number {
  return 0.82 + 0.12 * Math.sin(time * 1.3 + seed) + 0.06 * Math.sin(time * 2.7 + seed * 1.7)
}
