/**
 * 批次 E · 矿脉精修（伪立体晶簇 + 自发光）
 *
 * 分两层：
 * - drawOreBase：岩基烘焙进 TileMap.oreLayer（贴地石块 + 矿窝，一劳永逸）
 * - drawOreCrystals：晶簇运行时绘制，参与房间 y-sort（高晶尖会正确遮挡/被遮挡），
 *   带内发光呼吸、金矿星点闪烁、镐击闪白爆光
 * - oreLight：每格矿脉是一个弱全向光源（金矿最亮），命中当帧增强为爆闪
 *
 * 纯视觉：碰撞/HP/掉落在 TileMap 与 RoomRuntime 原链路不变。
 */
import { CONFIG } from '../config'
import type { OreTile, RockMat } from '../tilemap'
import { minerals } from '../../content/minerals/registry'
import type { OrePalette } from '../../content/minerals/types'
import { ART, hash2 } from './artPalette'
import type { LightSource } from './lighting'
import { drawSceneMetal, drawSceneStone, drawSharedMineral, type MetalForm } from './mineralScene'
import { mineAssetsReady } from './mineAssets'
import { MINERAL_RUBY_ID } from '../../content/minerals/vanilla/ids'
import { drawCoalFormation } from '../../content/items/vanilla/materials/deepMaterialAppearance'

/** 取某矿格的美术色板（矿种真值在注册表；缺色板属于配置错误直接抛出） */
function paletteOf(ore: OreTile): OrePalette {
  return minerals.require(ore.kind).palette
}

/**
 * 岩包材质色板（三种同为岩石，外观语言不同）：
 * - 0 花岗岩 granite：冷灰、硬切面、砂眼+云母+折枝裂口
 * - 1 砂岩 sandstone：暖黄褐、水平层理、细密砂粒、风蚀圆润
 * - 2 板岩 slate：青灰、斜向劈理板片、直棱硬面
 */
interface RockPalette {
  /** 材质名（注释/调试用） */
  name: string
  /** 接地暗影 */
  shadow: string
  /** 背光面/岩底 */
  baseDark: string
  /** 中间过渡暗面 */
  baseMid: string
  /** 主体色 */
  base: string
  /** 受光面 */
  baseHi: string
  /** 顶棱亮线 */
  top: string
  /** 顶棱亮线半透明描边色 */
  topEdge: string
  /** 裂缝深 */
  crack: string
  /** 裂口受光亮棱 */
  crackHi: string
  /** 砂眼深点 */
  grainDark: string
  /** 砂眼浅点 */
  grainLight: string
}

const ROCK_MATS: RockPalette[] = [
  {
    // 0 · 花岗岩（原灰岩配色）
    name: 'granite',
    shadow: 'rgba(20,16,22,0.26)',
    baseDark: '#454b53',
    baseMid: '#5d636c',
    base: '#727881',
    baseHi: '#8b929c',
    top: '#aab1bb',
    topEdge: 'rgba(228,234,242,0.55)',
    crack: '#31363d',
    crackHi: 'rgba(178,185,196,0.32)',
    grainDark: '#4a5059',
    grainLight: '#828993'
  },
  {
    // 1 · 砂岩（暖黄褐，风蚀）
    name: 'sandstone',
    shadow: 'rgba(30,22,14,0.28)',
    baseDark: '#6b5840',
    baseMid: '#83705a',
    base: '#97836a',
    baseHi: '#b09a7c',
    top: '#cbaf86',
    topEdge: 'rgba(240,222,186,0.55)',
    crack: '#574630',
    crackHi: 'rgba(214,186,140,0.3)',
    grainDark: '#75614a',
    grainLight: '#b6a284'
  },
  {
    // 2 · 板岩（青灰冷调，劈理）
    name: 'slate',
    shadow: 'rgba(14,18,24,0.28)',
    baseDark: '#3c444c',
    baseMid: '#4e5760',
    base: '#626c76',
    baseHi: '#7d8892',
    top: '#9aa5b0',
    topEdge: 'rgba(214,224,234,0.5)',
    crack: '#2b3138',
    crackHi: 'rgba(150,162,174,0.3)',
    grainDark: '#454d55',
    grainLight: '#74808b'
  }
]

/** 官方金属矿各用独立形态；通用金属材质保留给已有内容包。 */
function metalForm(form?:string):MetalForm|null{
  return form==='copper'||form==='iron'||form==='gold'?form:form==='metal'?'copper':null
}

/** 一根晶体的几何（格内局部坐标） */
interface Crystal {
  /** 中心 x（根部） */
  x: number
  /** 根部 y */
  base: number
  /** 半宽 */
  w: number
  /** 高度 */
  h: number
  /** 尖顶横向倾斜 */
  lean: number
}

/** 晶簇确定性布局：1 主晶 + 2~3 副晶，同格永远同一形态 */
function getCrystals(ore: OreTile, t: number): Crystal[] {
  const n = 2 + Math.floor(hash2(ore.row * 3 + 1, ore.col * 7) * 2) // 3~4 根
  const mainX = t / 2 + (hash2(ore.col * 11, ore.row * 5) - 0.5) * 12
  const out: Crystal[] = []
  for (let i = 0; i < n; i++) {
    const isMain = i === 0
    const h = isMain
      ? 19 + hash2(ore.col, ore.row) * 6
      : 9 + hash2(ore.col * 5 + i * 9, ore.row * 3 + i) * 7
    const w = h * (0.26 + hash2(i, ore.col + ore.row) * 0.08)
    const x = isMain
      ? mainX
      : mainX + (i % 2 === 0 ? -1 : 1) * (6 + hash2(ore.col + i, ore.row - i) * 6)
    out.push({
      x,
      base: t - 8 - (isMain ? 0 : hash2(i * 3, ore.col) * 2),
      w,
      h,
      lean: (hash2(ore.col + i * 13, ore.row + i * 7) - 0.5) * 5
    })
  }
  return out
}

/** 晶簇整体中心（发光/光源锚点，格内坐标） */
function clusterCenter(ore: OreTile, t: number): { x: number; y: number } {
  const cs = getCrystals(ore, t)
  const main = cs[0]
  return { x: main.x, y: main.base - main.h * 0.42 }
}

/* ================= 烘焙：岩基 ================= */

/** 单格矿脉岩基（TileMap 生成时调用，画进 oreLayer 离屏层） */
export function drawOreBase(ctx: CanvasRenderingContext2D, ore: OreTile): void {
  if (ore.vein === 'rock') {
    if(minerals.require(ore.kind).visual.form==='salt'){if(!drawSharedMineral(ctx,ore,paletteOf(ore))){drawSceneStone(ctx,ore);drawSaltCrust(ctx,ore)}}
    else drawSceneStone(ctx,ore)
    return
  }
  if(metalForm(minerals.require(ore.kind).visual.form)||(ore.kind===MINERAL_RUBY_ID&&mineAssetsReady())){
    const x=(ore.col+.5)*CONFIG.tile+ore.offsetX,y=(ore.row+.5)*CONFIG.tile+ore.offsetY
    ctx.save();ctx.fillStyle='#211b284d';ctx.beginPath();ctx.ellipse(x,y+18,23,5.5,0,0,Math.PI*2);ctx.fill()
    for(let i=0;i<5;i++){const px=x-21+hash2(ore.col+i*7,ore.row)*42,py=y+16+hash2(ore.row+i,ore.col)*5;ctx.fillStyle=i%2?'#6b605066':'#36313b80';ctx.fillRect(px,py,1.7,.8)}
    ctx.restore();return
  }
  if(minerals.require(ore.kind).visual.form==='coal'){
    const x=(ore.col+.5)*CONFIG.tile+ore.offsetX,y=(ore.row+.5)*CONFIG.tile+ore.offsetY
    ctx.save();ctx.fillStyle='#171c2466';ctx.beginPath();ctx.ellipse(x,y+8,22,8,0,0,Math.PI*2);ctx.fill()
    for(let i=0;i<18;i++){const px=x-24+hash2(ore.col+i,ore.row)*48,py=y+5+hash2(ore.row+i,ore.col)*9;ctx.fillStyle=i%3?'#272e33aa':'#57616766';ctx.fillRect(px,py,1.4,1)}
    ctx.restore();return
  }
  const a = paletteOf(ore)
  const t = CONFIG.tile
  const ox = ore.col * t + ore.offsetX
  const oy = ore.row * t + ore.offsetY
  const h = hash2(ore.col * 3 + 7, ore.row * 5 + 2)

  // 不规则扁岩（6 顶点，横卧在格底）
  const bx = ox + 5
  const by = oy + 15
  const bw = t - 10
  const bh = t - 21
  const verts: [number, number][] = [
    [bx + 3 + h * 3, by],
    [bx + bw - 4, by + 2 + h * 2],
    [bx + bw, by + bh * 0.55],
    [bx + bw - 5, by + bh],
    [bx + 5, by + bh - (1 - h) * 2],
    [bx, by + bh * 0.45]
  ]
  const poly = (): void => {
    ctx.beginPath()
    verts.forEach(([vx, vy], i) => (i === 0 ? ctx.moveTo(vx, vy) : ctx.lineTo(vx, vy)))
    ctx.closePath()
  }
  // ink 衬底
  poly()
  ctx.fillStyle = ART.ink
  ctx.fill()
  ctx.save()
  poly()
  ctx.clip()
  ctx.fillStyle = a.base
  ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4)
  // 底部暗带（岩体坐地阴影）
  ctx.fillStyle = a.baseDark
  ctx.fillRect(bx - 2, by + bh * 0.55, bw + 4, bh * 0.5)
  // 顶部一线受光
  ctx.fillStyle = 'rgba(255,245,225,0.14)'
  ctx.fillRect(bx - 2, by - 2, bw + 4, 4)
  ctx.restore()
  poly()
  ctx.lineWidth = 2
  ctx.strokeStyle = ART.ink
  ctx.stroke()

  // 晶体根部矿窝（深色椭圆 + 亮缘，位置与运行时晶簇对齐）
  for (const c of getCrystals(ore, t)) {
    ctx.fillStyle = ART.ink
    ctx.beginPath()
    ctx.ellipse(ox + c.x, oy + c.base + 1, c.w * 1.5, c.w * 0.7, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = a.baseDark
    ctx.beginPath()
    ctx.ellipse(ox + c.x, oy + c.base, c.w * 1.25, c.w * 0.5, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // 岩面碎晶石小颗粒 2 颗（矿种色暗档，提示矿种）
  for (let i = 0; i < 2; i++) {
    const sx = ox + 9 + hash2(ore.col + i * 19, ore.row + 4) * (t - 18)
    const sy = oy + 19 + hash2(ore.col - i * 3, ore.row + i * 23) * (t - 26)
    ctx.fillStyle = a.crystalDark
    ctx.fillRect(sx, sy, 2.4, 2.4)
    ctx.fillStyle = a.hi
    ctx.fillRect(sx, sy, 1.2, 1.2)
  }
}

/**
 * 岩包态岩体：一块敦实的天然岩石（10 顶点不规则块）。
 * 三种材质（花岗岩/砂岩/板岩）共用轮廓 + 五档硬边色阶分面骨架，
 * 表面纹理/裂纹/凹坑按 ore.rockMat 分派——同是岩石，只是材质语言不同。
 * 底边统一接地暗影与碎砾，"坐"在地上不发飘。
 */
function drawRockBase(ctx: CanvasRenderingContext2D, ore: OreTile): void {
  const t = CONFIG.tile
  const ox = ore.col * t + ore.offsetX
  const oy = ore.row * t + ore.offsetY
  const h = hash2(ore.col * 3 + 7, ore.row * 5 + 2)
  const h2 = hash2(ore.col + 11, ore.row * 7 + 3)
  const h3 = hash2(ore.col * 5 + 1, ore.row * 9 + 4)
  const M = ROCK_MATS[ore.rockMat] ?? ROCK_MATS[0]

  // 岩体占位（略向上发，底边留接地暗影/碎砾的位置）
  const bx = ox + 4
  const by = oy + 11
  const bw = t - 8
  const bh = t - 17

  // —— 接地暗影（先画，压在岩体下） ——
  ctx.fillStyle = M.shadow
  ctx.beginPath()
  ctx.ellipse(bx + bw / 2, by + bh + 1, bw * 0.52, 5.5, 0, 0, Math.PI * 2)
  ctx.fill()

  // 10 顶点轮廓（顶棱三折、两肩、左右侧、底三折；三个 hash 分别扰动不同顶点拉大块间差异）
  const verts: [number, number][] = [
    [bx + 6 + h * 5, by + 1 - h2],
    [bx + bw * (0.32 + h3 * 0.16), by - 1 + h2 * 2],
    [bx + bw * 0.66, by + 1 + h * 1.5],
    [bx + bw - 2 - h3 * 3, by + 4 + h2 * 3],
    [bx + bw + 1 - h * 2, by + bh * (0.38 + h3 * 0.1)],
    [bx + bw - 3 - h2 * 2, by + bh - 2],
    [bx + bw * (0.55 + h * 0.12), by + bh + 1],
    [bx + bw * (0.26 + h2 * 0.1), by + bh - h3],
    [bx + 5 + h3 * 4, by + bh - 1],
    [bx + h * 2, by + bh * (0.4 + h2 * 0.08)]
  ]
  const poly = (): void => {
    ctx.beginPath()
    verts.forEach(([vx, vy], i) => (i === 0 ? ctx.moveTo(vx, vy) : ctx.lineTo(vx, vy)))
    ctx.closePath()
  }
  // ink 衬底
  poly()
  ctx.fillStyle = ART.ink
  ctx.fill()
  ctx.save()
  poly()
  ctx.clip()

  // 岩体保留有限色阶的硬切面。
  ctx.fillStyle = M.base
  ctx.fillRect(bx - 2, by - 3, bw + 4, bh + 6)

  // 底部暗带（坐地环境闭塞）
  ctx.fillStyle = M.baseDark
  ctx.beginPath()
  ctx.moveTo(bx - 2, by + bh * 0.52)
  ctx.lineTo(bx + bw + 2, by + bh * 0.42)
  ctx.lineTo(bx + bw + 2, by + bh + 3)
  ctx.lineTo(bx - 2, by + bh + 3)
  ctx.closePath()
  ctx.fill()
  // 右侧背光面（大斜切面）
  ctx.fillStyle = M.baseDark
  ctx.beginPath()
  ctx.moveTo(bx + bw * 0.52, by + 2)
  ctx.lineTo(bx + bw - 2, by + 5)
  ctx.lineTo(bx + bw + 1, by + bh * 0.42)
  ctx.lineTo(bx + bw - 3, by + bh - 2)
  ctx.lineTo(bx + bw * 0.62, by + bh * 0.55)
  ctx.lineTo(bx + bw * 0.7, by + bh * 0.24)
  ctx.closePath()
  ctx.fill()
  // 中灰过渡切面（右暗面与主体之间的台阶面，打破大片平涂）
  ctx.fillStyle = M.baseMid
  ctx.beginPath()
  ctx.moveTo(bx + bw * 0.42, by + 3)
  ctx.lineTo(bx + bw * 0.52, by + 2)
  ctx.lineTo(bx + bw * 0.7, by + bh * 0.24)
  ctx.lineTo(bx + bw * 0.62, by + bh * 0.55)
  ctx.lineTo(bx + bw * 0.45, by + bh * 0.4)
  ctx.closePath()
  ctx.fill()
  // 左下第二过渡面（让暗部也有层次）
  ctx.fillStyle = M.baseMid
  ctx.beginPath()
  ctx.moveTo(bx, by + bh * 0.42)
  ctx.lineTo(bx + 5, by + bh - 1)
  ctx.lineTo(bx + bw * 0.3, by + bh)
  ctx.lineTo(bx + bw * 0.18, by + bh * 0.62)
  ctx.closePath()
  ctx.fill()
  // 左上受光台面
  ctx.fillStyle = M.baseHi
  ctx.beginPath()
  ctx.moveTo(bx + 7 + h * 3, by)
  ctx.lineTo(bx + bw * 0.4, by - 1 + h2 * 2)
  ctx.lineTo(bx + bw * 0.66, by + 1 + h * 1.5)
  ctx.lineTo(bx + bw * 0.44, by + 5 + h2)
  ctx.lineTo(bx + bw * 0.18, by + 4 + h)
  ctx.lineTo(bx + 2, by + 6)
  ctx.closePath()
  ctx.fill()

  // —— 材质表面纹理（贴皮，必须在 clip 内） ——
  if (ore.rockMat === 1) drawSandstoneGrain(ctx, ore, bx, by, bw, bh, M)
  else if (ore.rockMat === 2) drawSlateGrain(ctx, ore, bx, by, bw, bh)
  else drawGraniteGrain(ctx, ore, bx, by, bw, bh)
  ctx.restore()

  // ink 描边收口
  poly()
  ctx.lineWidth = 2
  ctx.strokeStyle = ART.ink
  ctx.stroke()
  // 顶棱亮线（沿顶部三段棱描一像素亮色，强化光源方向；色相随材质冷暖）
  ctx.strokeStyle = M.topEdge
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(verts[0][0] + 1, verts[0][1] + 0.6)
  ctx.lineTo(verts[1][0], verts[1][1] + 0.2)
  ctx.lineTo(verts[2][0] - 1, verts[2][1] + 0.8)
  ctx.stroke()

  // —— 材质专属裂纹 / 凹坑 ——
  if (ore.rockMat === 1) {
    drawSandstoneCracks(ctx, ore, bx, by, bw, bh, M)
    drawSandstonePits(ctx, ore, bx, by, bw, bh)
  } else if (ore.rockMat === 2) {
    drawSlateCracks(ctx, ore, bx, by, bw, bh, M)
  } else {
    drawGraniteCracks(ctx, ore, bx, by, bw, bh, M)
    drawGranitePits(ctx, ore, bx, by, bw, bh)
  }

  // —— 岩脚碎砾 2 颗（半埋在接地影里，强化体积与落地感） ——
  const pebbles: [number, number, number][] = [
    [bx + 4 + h * 3, by + bh - 1, 3.2],
    [bx + bw - 6 - h2 * 3, by + bh, 2.6]
  ]
  for (const [px, py, pr] of pebbles) {
    ctx.fillStyle = ART.ink
    ctx.beginPath()
    ctx.ellipse(px, py, pr + 0.8, pr * 0.75 + 0.6, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = M.baseMid
    ctx.beginPath()
    ctx.ellipse(px, py - 0.4, pr, pr * 0.68, 0, Math.PI, 0)
    ctx.fill()
    ctx.fillStyle = M.baseHi
    ctx.fillRect(px - pr * 0.4, py - pr * 0.55, pr * 0.7, 0.9)
  }
}

/* —— 花岗岩纹理（冷灰颗粒 + 云母 + 折枝裂口） —— */

function drawGraniteGrain(
  ctx: CanvasRenderingContext2D,
  ore: OreTile,
  bx: number,
  by: number,
  bw: number,
  bh: number
): void {
  // 7 个砂眼（深色为主、浅色只作暗部微差，避免岩面发花）
  for (let i = 0; i < 7; i++) {
    const gx = bx + 6 + hash2(ore.col * 7 + i * 13, ore.row + 3) * (bw - 12)
    const gy = by + 7 + hash2(ore.col + 5, ore.row * 3 + i * 17) * (bh - 12)
    ctx.fillStyle = i % 3 === 0 ? '#6a717b' : ROCK_MATS[0].grainDark
    ctx.fillRect(gx, gy, 1.1, 1.1)
  }
  // 土色沁点 3 粒（天然杂色，暖度极低，不构成任何矿种暗示）
  ctx.fillStyle = '#8a7d6b'
  for (let i = 0; i < 3; i++) {
    const wx = bx + 8 + hash2(ore.col - i * 4, ore.row + i * 9 + 2) * (bw - 16)
    const wy = by + 9 + hash2(ore.col + i * 6, ore.row - i * 2 + 8) * (bh - 15)
    ctx.fillRect(wx, wy, 1.5, 1.5)
  }
  // 云母亮片 2 枚（小灰菱，亮度克制不抢顶棱；仅受光区）
  for (let i = 0; i < 2; i++) {
    const mx = bx + 10 + hash2(ore.col + i * 10 + 2, ore.row * 2) * (bw * 0.5)
    const my = by + 5 + hash2(ore.col * 3, ore.row + i * 8 + 6) * (bh * 0.4)
    ctx.fillStyle = 'rgba(178,185,196,0.85)'
    ctx.beginPath()
    ctx.moveTo(mx, my - 1.5)
    ctx.lineTo(mx + 1.3, my)
    ctx.lineTo(mx, my + 1.5)
    ctx.lineTo(mx - 1.3, my)
    ctx.closePath()
    ctx.fill()
  }
}

function drawGraniteCracks(
  ctx: CanvasRenderingContext2D,
  ore: OreTile,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  M: RockPalette
): void {
  const h = hash2(ore.col * 3 + 7, ore.row * 5 + 2)
  // 折枝裂口 3 条：细尖短折线；只在裂缘上半段点一笔极淡亮棱，绝不整条勾边
  for (let i = 0; i < 3; i++) {
    const sxx = bx + 9 + hash2(ore.col * 5 + i * 17, ore.row + i * 3 + 1) * (bw - 18)
    const syy = by + 5 + hash2(ore.col - i * 6 + 2, ore.row * 3 + i * 11) * (bh * 0.28)
    const maxLen = by + bh - 4 - syy
    const lean = (hash2(ore.col + i * 9, ore.row - i * 4) - 0.5) * 7
    const seg = 2 + Math.floor(hash2(i * 3 + 1, ore.col + ore.row) * 2)
    const pts = rockCrackPath(ore, i, sxx, syy, maxLen, lean, seg, 2.5, 5)
    ctx.strokeStyle = M.crack
    ctx.lineWidth = 1.05
    ctx.lineCap = 'butt'
    tracePath(ctx, pts)
    ctx.stroke()
    ctx.strokeStyle = M.crackHi
    ctx.lineWidth = 0.6
    ctx.beginPath()
    ctx.moveTo(pts[0][0] - 0.6, pts[0][1])
    ctx.lineTo(pts[1][0] - 0.6, pts[1][1])
    ctx.stroke()
    if (hash2(ore.col + i * 31, ore.row * 7 + i) > 0.45) {
      const mid = pts[Math.floor(pts.length / 2)]
      ctx.strokeStyle = M.crack
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.moveTo(mid[0], mid[1])
      ctx.lineTo(mid[0] + (i % 2 === 0 ? 3 : -3) + h * 2, mid[1] + 2.5)
      ctx.stroke()
    }
  }
}

function drawGranitePits(
  ctx: CanvasRenderingContext2D,
  ore: OreTile,
  bx: number,
  by: number,
  bw: number,
  bh: number
): void {
  // 暗坑 2 个：不规则小凹斑（多边形小坑，无高光，远看只是岩面的深色杂疤）
  for (let i = 0; i < 2; i++) {
    const px = bx + 9 + hash2(ore.col + i * 7 + 1, ore.row + 9) * (bw - 16)
    const py = by + 12 + hash2(ore.col + 3, ore.row + i * 11) * (bh - 18)
    ctx.fillStyle = 'rgba(38,43,49,0.9)'
    ctx.beginPath()
    ctx.moveTo(px - 1.5, py - 0.8)
    ctx.lineTo(px + 0.4, py - 1.4)
    ctx.lineTo(px + 1.5, py + 0.2)
    ctx.lineTo(px + 0.2, py + 1.4)
    ctx.lineTo(px - 1.2, py + 0.9)
    ctx.closePath()
    ctx.fill()
  }
}

/* —— 砂岩纹理（水平层理 + 细密砂粒 + 氧化铁沁 + 风蚀圆坑） —— */

function drawSandstoneGrain(
  ctx: CanvasRenderingContext2D,
  ore: OreTile,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  M: RockPalette
): void {
  // 水平层理 4 条（砂岩身份证）：暗带 + 下沿一线弱亮，y 微起伏，风蚀感柔和
  for (let i = 0; i < 4; i++) {
    const yy = by + 7 + ((bh - 12) * (i + 0.5)) / 4 + (hash2(ore.col + i * 7, ore.row) - 0.5) * 3
    ctx.strokeStyle = 'rgba(74,58,36,0.5)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    for (let s = 0; s <= 4; s++) {
      const xx = bx + 3 + ((bw - 6) * s) / 4
      const wy = yy + (hash2(ore.col * 3 + s * 9, ore.row + i * 13) - 0.5) * 2.2
      s === 0 ? ctx.moveTo(xx, wy) : ctx.lineTo(xx, wy)
    }
    ctx.stroke()
    // 层理下沿受光（沉积层硬边亮线）
    ctx.strokeStyle = 'rgba(255,238,204,0.18)'
    ctx.lineWidth = 0.7
    ctx.beginPath()
    ctx.moveTo(bx + 4, yy + 1.1)
    ctx.lineTo(bx + bw - 4, yy + 1.1)
    ctx.stroke()
  }
  // 细密砂粒 12 颗（比花岗岩小而密，暗/暖交替）
  for (let i = 0; i < 12; i++) {
    const gx = bx + 5 + hash2(ore.col * 11 + i * 7, ore.row + 5) * (bw - 10)
    const gy = by + 6 + hash2(ore.col + 9, ore.row * 5 + i * 11) * (bh - 10)
    ctx.fillStyle = i % 2 === 0 ? M.grainDark : '#a8906c'
    ctx.fillRect(gx, gy, 0.9, 0.9)
  }
  // 氧化铁沁点 4 粒（砂岩特有的暖橘褐杂色）
  for (let i = 0; i < 4; i++) {
    const wx = bx + 7 + hash2(ore.col - i * 5 + 2, ore.row + i * 8) * (bw - 14)
    const wy = by + 8 + hash2(ore.col + i * 4 + 1, ore.row - i * 3 + 6) * (bh - 13)
    ctx.fillStyle = 'rgba(154,107,62,0.85)'
    ctx.fillRect(wx, wy, 1.3, 1.3)
  }
}

function drawSandstoneCracks(
  ctx: CanvasRenderingContext2D,
  ore: OreTile,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  M: RockPalette
): void {
  // 浅层横裂 2 条：纵向不深、横向位移大，顺层理走
  for (let i = 0; i < 2; i++) {
    const sxx = bx + 8 + hash2(ore.col * 5 + i * 19, ore.row + i * 5) * (bw - 20)
    const syy = by + 6 + hash2(ore.col + i * 8, ore.row * 3 + i * 9) * (bh * 0.34)
    const maxLen = (by + bh - 4 - syy) * 0.5 // 浅层：最长只到半岩高
    const lean = 6 + hash2(ore.col + i * 9, ore.row - i * 4) * 4 // 横向为主
    const seg = 2 + Math.floor(hash2(i * 3 + 1, ore.col + ore.row) * 2)
    const pts = rockCrackPath(ore, i + 5, sxx, syy, maxLen, lean, seg, 1.6, 6.5)
    ctx.strokeStyle = M.crack
    ctx.lineWidth = 0.95
    ctx.lineCap = 'butt'
    tracePath(ctx, pts)
    ctx.stroke()
    ctx.strokeStyle = M.crackHi
    ctx.lineWidth = 0.55
    ctx.beginPath()
    ctx.moveTo(pts[0][0] - 0.5, pts[0][1] - 0.5)
    ctx.lineTo(pts[1][0] - 0.5, pts[1][1] - 0.5)
    ctx.stroke()
  }
}

function drawSandstonePits(
  ctx: CanvasRenderingContext2D,
  ore: OreTile,
  bx: number,
  by: number,
  bw: number,
  bh: number
): void {
  // 风蚀圆坑 2 个：横向椭圆凹斑 + 上缘弱暗、下缘一点亮（风蚀穴的圆润感）
  for (let i = 0; i < 2; i++) {
    const px = bx + 10 + hash2(ore.col + i * 9 + 2, ore.row + 7) * (bw - 20)
    const py = by + 11 + hash2(ore.col + 4, ore.row + i * 10 + 3) * (bh - 16)
    ctx.fillStyle = 'rgba(70,55,34,0.85)'
    ctx.beginPath()
    ctx.ellipse(px, py, 2.5, 1.4, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,238,204,0.22)'
    ctx.lineWidth = 0.6
    ctx.beginPath()
    ctx.ellipse(px, py + 0.3, 2.1, 0.9, 0, 0.1, Math.PI - 0.1)
    ctx.stroke()
  }
}

/* —— 板岩纹理（斜向劈理板片 + 石英点 + 直棱裂纹） —— */

function drawSlateGrain(
  ctx: CanvasRenderingContext2D,
  ore: OreTile,
  bx: number,
  by: number,
  bw: number,
  bh: number
): void {
  // 斜向劈理 5 条：统一 26° 走向，截距 hash 微错；暗线 + 上侧平行亮线双勾
  const dx = 0.9
  const dy = 0.44
  for (let i = 0; i < 5; i++) {
    const startY = by + 2 + ((bh + 6) * i) / 5 + hash2(ore.col + i * 11, ore.row - i * 3) * 3
    const x0 = bx - 4
    const x1 = bx + bw + 4
    ctx.strokeStyle = 'rgba(30,36,42,0.55)'
    ctx.lineWidth = 0.85
    ctx.beginPath()
    ctx.moveTo(x0, startY)
    ctx.lineTo(x1, startY + ((x1 - x0) * dy) / dx)
    ctx.stroke()
    // 板片上沿亮棱（平行偏移 0.8px）
    ctx.strokeStyle = 'rgba(190,202,216,0.2)'
    ctx.lineWidth = 0.6
    ctx.beginPath()
    ctx.moveTo(x0, startY - 0.8)
    ctx.lineTo(x1, startY + ((x1 - x0) * dy) / dx - 0.8)
    ctx.stroke()
  }
  // 石英小亮点 4 枚（板岩缝里嵌的石英丝）
  for (let i = 0; i < 4; i++) {
    const qx = bx + 7 + hash2(ore.col * 6 + i * 11, ore.row + 2) * (bw - 14)
    const qy = by + 7 + hash2(ore.col + 8, ore.row * 4 + i * 9) * (bh - 12)
    ctx.fillStyle = 'rgba(168,182,198,0.7)'
    ctx.fillRect(qx, qy, 1.3, 0.9)
  }
}

function drawSlateCracks(
  ctx: CanvasRenderingContext2D,
  ore: OreTile,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  M: RockPalette
): void {
  // 直棱裂 3 条：走向更竖、折角小，像板岩沿劈理面劈开的直缝
  for (let i = 0; i < 3; i++) {
    const sxx = bx + 9 + hash2(ore.col * 5 + i * 17, ore.row + i * 3 + 1) * (bw - 18)
    const syy = by + 4 + hash2(ore.col - i * 6 + 2, ore.row * 3 + i * 11) * (bh * 0.24)
    const maxLen = by + bh - 4 - syy
    const lean = (hash2(ore.col + i * 9, ore.row - i * 4) - 0.5) * 3.4 // 横向偏移小=直
    const seg = 3
    const pts = rockCrackPath(ore, i + 9, sxx, syy, maxLen, lean, seg, 4, 2)
    ctx.strokeStyle = M.crack
    ctx.lineWidth = 1
    ctx.lineCap = 'butt'
    tracePath(ctx, pts)
    ctx.stroke()
    ctx.strokeStyle = M.crackHi
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(pts[0][0] - 0.5, pts[0][1])
    ctx.lineTo(pts[1][0] - 0.5, pts[1][1])
    ctx.stroke()
  }
}

/* —— 岩石裂纹折线工具（三种材质共用，参数化步长/横向摆动） —— */

function rockCrackPath(
  ore: OreTile,
  salt: number,
  sx: number,
  sy: number,
  maxLen: number,
  lean: number,
  seg: number,
  stepY: number,
  sway: number
): [number, number][] {
  const pts: [number, number][] = [[sx, sy]]
  for (let s = 0; s < seg; s++) {
    const last = pts[pts.length - 1]
    const remain = maxLen - (last[1] - sy)
    const dy = Math.min(stepY + hash2(ore.row + s, salt * 5 + 2) * 1.5, Math.max(1, remain / (seg - s)))
    pts.push([
      last[0] + lean / seg + (hash2(s * 7 + salt, ore.col + s) - 0.5) * sway,
      last[1] + Math.max(1.4, dy)
    ])
  }
  return pts
}

function tracePath(ctx: CanvasRenderingContext2D, pts: [number, number][]): void {
  ctx.beginPath()
  pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)))
}

/* ================= 运行时：晶簇 ================= */

/** 单根棱柱晶体：ink 衬 → 主面 → 左暗面 → 右亮棱 → 顶切面 */
function drawCrystal(ctx: CanvasRenderingContext2D, c: Crystal, a: OrePalette): void {
  const { x, base: b, w, h, lean } = c
  // 五棱柱：尖顶 / 右肩 / 右根 / 左根 / 左肩
  const path = (grow: number): Path2D => {
    const hh = h * grow
    const p = new Path2D()
    p.moveTo(x + lean, b - hh)
    p.lineTo(x + w, b - hh * 0.26)
    p.lineTo(x + w * 0.72, b)
    p.lineTo(x - w * 0.72, b)
    p.lineTo(x - w, b - hh * 0.26)
    p.closePath()
    return p
  }
  // ink 厚描边（先描 3px 再填主面）
  ctx.lineJoin = 'round'
  ctx.strokeStyle = ART.ink
  ctx.lineWidth = 3
  ctx.stroke(path(1))

  ctx.fillStyle = a.crystal
  ctx.fill(path(1))
  // 左暗面（尖顶 → 左肩 → 左根 → 中轴）
  ctx.fillStyle = a.crystalDark
  ctx.beginPath()
  ctx.moveTo(x + lean, b - h)
  ctx.lineTo(x - w, b - h * 0.26)
  ctx.lineTo(x - w * 0.72, b)
  ctx.lineTo(x - w * 0.05, b)
  ctx.closePath()
  ctx.fill()
  // 右亮棱（窄三角）
  ctx.fillStyle = a.hi
  ctx.beginPath()
  ctx.moveTo(x + lean, b - h)
  ctx.lineTo(x + w, b - h * 0.26)
  ctx.lineTo(x + w * 0.34, b - h * 0.08)
  ctx.closePath()
  ctx.fill()
  // 中棱线（晶体折面高光）
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x + lean, b - h)
  ctx.lineTo(x - w * 0.05, b)
  ctx.stroke()
}

/**
 * 运行时晶簇（世界 ctx；RoomRuntime y-sort 调用）。
 * @param time 房间时间（呼吸/星闪相位）
 */
export function drawOreCrystals(
  ctx: CanvasRenderingContext2D,
  ore: OreTile,
  time: number
): void {
  // 岩包态：不画晶簇；藏矿且敲到后半血时，裂纹深处才隐约露出矿色碎点
  if (ore.vein === 'rock') {
    drawRockCracksReveal(ctx, ore)
    return
  }
  const mineral = minerals.require(ore.kind)
  if(drawSharedMineral(ctx,ore,mineral.palette))return
  if(mineral.visual.form==='coal'){drawCoalChunks(ctx,ore);return}
  const form=metalForm(mineral.visual.form)
  if(form){drawSceneMetal(ctx,ore,form,mineral.palette,time);return}
  const a = mineral.palette
  const t = CONFIG.tile
  const ox = ore.col * t + ore.offsetX
  const oy = ore.row * t + ore.offsetY
  const cs = getCrystals(ore, t)
  const cc = clusterCenter(ore, t)
  const flashK = ore.flash / CONFIG.mine.hitFlash

  // 内发光晕（lighter；glowStrong 的矿种呼吸更明显）
  const breathe = 0.85 + 0.15 * Math.sin(time * 1.6 + ore.col * 1.7 + ore.row * 0.9)
  const glowA = (mineral.visual.glowStrong ? 0.13 : 0.08) * breathe + flashK * 0.3
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const g = ctx.createRadialGradient(
    ox + cc.x,
    oy + cc.y,
    2,
    ox + cc.x,
    oy + cc.y,
    20 + flashK * 12
  )
  g.addColorStop(0, rgbaAlpha(a.light, 0.5 * glowA))
  g.addColorStop(1, rgbaAlpha(a.light, 0))
  ctx.fillStyle = g
  ctx.fillRect(ox + cc.x - 34, oy + cc.y - 34, 68, 68)
  ctx.restore()

  // 晶簇（矮的先画，高的压上）
  const ordered = [...cs].sort((p, q) => p.h - q.h)
  ctx.save()
  ctx.translate(ox, oy)
  for (const c of ordered) drawCrystal(ctx, c, a)
  // 镐击闪白：整簇提亮
  if (flashK > 0) {
    ctx.globalAlpha = flashK * 0.6
    for (const c of ordered) {
      ctx.fillStyle = '#fff6e2'
      const p = new Path2D()
      p.moveTo(c.x + c.lean, c.base - c.h)
      p.lineTo(c.x + c.w, c.base - c.h * 0.26)
      p.lineTo(c.x + c.w * 0.72, c.base)
      p.lineTo(c.x - c.w * 0.72, c.base)
      p.lineTo(c.x - c.w, c.base - c.h * 0.26)
      p.closePath()
      ctx.fill(p)
    }
    ctx.globalAlpha = 1
  }
  ctx.restore()

  // 星点闪烁（visual.twinkle 的矿种招牌：两颗错相小星星）
  if (mineral.visual.twinkle) {
    for (let i = 0; i < 2; i++) {
      const tw = 0.5 + 0.5 * Math.sin(time * 3.2 + ore.col * 2.1 + i * 2.6)
      if (tw < 0.35) continue
      const c = ordered[ordered.length - 1]
      const sx = ox + c.x + (i === 0 ? -3 : 3)
      const sy = oy + c.base - c.h * (i === 0 ? 0.55 : 0.8)
      ctx.fillStyle = `rgba(255,244,190,${0.9 * tw})`
      ctx.fillRect(sx - 1.2, sy - 1.2, 2.4, 2.4)
    }
  }
}

/**
 * 岩包态裂纹露矿（运行时 y-sort 层）：
 * 藏矿的石头敲到后半血，裂纹深处才隐约透出矿色；越接近碎、点越多越亮，
 * 镐击命中当帧额外提亮。没藏矿的石头敲烂也不会露色。
 */
/** 盐霜沿石面裂隙沉积，灰岩主体与普通岩石保持一致。 */
function drawSaltCrust(ctx:CanvasRenderingContext2D,ore:OreTile):void{
  const x=(ore.col+.5)*CONFIG.tile+ore.offsetX,y=(ore.row+.5)*CONFIG.tile+ore.offsetY
  ctx.save();ctx.lineJoin='round';ctx.lineCap='round'
  // 先贴合岩面裁切，再把粉状盐渍和结晶集中在天然裂隙附近。
  ctx.beginPath();ctx.ellipse(x,y+1,17,11,0,0,Math.PI*2);ctx.clip()
  for(let patch=0;patch<3;patch++){
    const px=x-9+patch*8+hash2(ore.col+patch,ore.row)*3,py=y-4+patch*2+hash2(ore.row+patch,ore.col)*3
    ctx.fillStyle='#dad9c92f';ctx.beginPath();ctx.moveTo(px-5,py);ctx.lineTo(px-2,py-3);ctx.lineTo(px+4,py-1);ctx.lineTo(px+6,py+2);ctx.lineTo(px+1,py+4);ctx.lineTo(px-4,py+2);ctx.closePath();ctx.fill()
    for(let grain=0;grain<15;grain++){
      const gx=px-6+hash2(ore.col+grain*7+patch,ore.row)*12,gy=py-3+hash2(ore.row+grain*5,ore.col+patch)*7
      const size=.55+hash2(grain+ore.col,patch+ore.row)*1.35
      ctx.fillStyle='#6f767859';ctx.fillRect(gx,gy+.6,size*1.3,.8)
      ctx.fillStyle=grain%4?'#d8d8cbb0':'#f1eddacc';ctx.beginPath();ctx.moveTo(gx,gy);ctx.lineTo(gx+size,gy-size*.45);ctx.lineTo(gx+size*1.35,gy+.4);ctx.lineTo(gx+.3,gy+.8);ctx.closePath();ctx.fill()
    }
  }
  ctx.strokeStyle='#c2c6b96b';ctx.lineWidth=.7
  ctx.beginPath();ctx.moveTo(x-13,y-1);ctx.lineTo(x-6,y-3);ctx.lineTo(x-1,y+1);ctx.lineTo(x+5,y+2);ctx.lineTo(x+12,y+6);ctx.stroke()
  ctx.strokeStyle='#f1edda65';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(x-6,y-3.5);ctx.lineTo(x-1,y+.5);ctx.moveTo(x+5,y+1.5);ctx.lineTo(x+10,y+4);ctx.stroke()
  ctx.restore()
}

/** 煤体使用压叠的短块和页状断面，替代尖锐发光晶簇。 */
function drawCoalChunks(ctx:CanvasRenderingContext2D,ore:OreTile):void{
  drawCoalFormation(ctx,(ore.col+.5)*CONFIG.tile+ore.offsetX,(ore.row+.5)*CONFIG.tile+ore.offsetY,ore.col*397+ore.row*71,1,ore.flash,ore.rockMat)
}

function drawRockCracksReveal(ctx: CanvasRenderingContext2D, ore: OreTile): void {
  const wear=1-ore.hp/ore.maxHp
  if(wear>.22){
    const x=(ore.col+.5)*CONFIG.tile+ore.offsetX,y=(ore.row+.5)*CONFIG.tile+ore.offsetY
    ctx.save();ctx.translate(x,y);ctx.strokeStyle=`rgba(39,34,47,${Math.min(.85,wear*.9)})`;ctx.lineWidth=.85;ctx.lineJoin='round'
    ctx.beginPath();ctx.moveTo(-6,-10);ctx.lineTo(-1,-5);ctx.lineTo(-3,0);ctx.lineTo(2,5);ctx.lineTo(0,11)
    if(wear>.6){ctx.moveTo(-3,0);ctx.lineTo(-10,3);ctx.moveTo(2,5);ctx.lineTo(9,3)}
    ctx.stroke();ctx.restore()
  }
  if (!ore.hasOre) return
  const ratio = 1 - ore.hp / ore.maxHp
  if (ratio < 0.5) return
  const a = paletteOf(ore)
  const t = CONFIG.tile
  const ox = ore.col * t + ore.offsetX
  const oy = ore.row * t + ore.offsetY
  const k = Math.min(1, (ratio - 0.5) / 0.5)
  const flashK = ore.flash / CONFIG.mine.hitFlash
  const n = ratio >= 0.8 ? 3 : 2
  ctx.save()
  ctx.globalAlpha = Math.min(1, 0.45 + k * 0.55 + flashK * 0.4)
  for (let i = 0; i < n; i++) {
    const px = ox + 9 + hash2(ore.col * 5 + i * 13, ore.row + 7) * (t - 18)
    const py = oy + 18 + hash2(ore.col + i * 3, ore.row * 3 + i * 11) * (t - 27)
    const s = 2.6 + (i === 0 ? 1 : 0)
    ctx.fillStyle = a.crystalDark
    ctx.fillRect(px, py, s, s)
    ctx.fillStyle = a.crystal
    ctx.fillRect(px, py, s * 0.62, s * 0.62)
    ctx.fillStyle = a.hi
    ctx.fillRect(px, py, 1.2, 1.2)
  }
  ctx.restore()
}

/** hex(#rrggbb) → rgba（本模块自用小工具） */
function rgbaAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

/* ================= 光源 ================= */

/** 矿簇微光（常亮慢呼吸；镐击命中当帧附爆闪） */
export function oreLight(ore: OreTile, time: number): LightSource {
  const G = CONFIG.art.oreGlow
  const t = CONFIG.tile
  const mineral = minerals.require(ore.kind)
  const a = mineral.palette
  const cc = metalForm(mineral.visual.form)?{x:t/2,y:t/2}:clusterCenter(ore, t)
  const breathe = 0.85 + 0.15 * Math.sin(time * 1.6 + ore.col * 1.7 + ore.row * 0.9)
  const flashK = ore.flash / CONFIG.mine.hitFlash
  return {
    x: ore.col * t + cc.x + ore.offsetX,
    y: ore.row * t + cc.y + ore.offsetY,
    r: G.radius * (1 + flashK * 0.45),
    power: mineral.visual.glowPower * breathe + flashK * G.hitFlash,
    color: a.light,
    tint: 0.07 + flashK * 0.2
  }
}
