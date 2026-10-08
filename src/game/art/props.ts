/**
 * 批次 E · 场景立体摆件（Props）
 *
 * J 批次起为真实体：每种摆件脚底挂一根统一的"薄横线"碰撞箱
 * （长度随素材，与材质/种类无关），玩家与敌人均被阻挡、会沿线段滑动；
 * 弹幕与掉落物不接此碰撞（J 批次铁律）。矿脉走 TileMap 网格碰撞，两套互不相关。
 * 正式外观复用矿洞共用图集与薄轮廓、材质色块；旧程序绘制仅作加载失败兜底。
 * 位置确定性生成（房间种子），避开门道/地缝/出生点/彼此重叠；
 * 高摆件远离北墙根（柱顶不得伸进北墙立面遮挡带）。
 * 摆件参与房间 y-sort，走到下方会被遮挡、走到上方便压在它之上。
 */
import { CONFIG } from '../config'
import type { Collider, DoorSlot } from '../tilemap'
import { propDefs } from '../../content/props/registry'
import type { PropDef, PropId, PropSegment } from '../../content/props/types'
import { ART, hash2 } from './artPalette'
import type { SteamVent } from './roomTextureE'
import type { CaveSceneStyle } from '../../content/biomes/types'
import { drawMineSprite, mineAssetsReady } from './mineAssets'
import { drawMinePropDetail } from './mineDetails'

export interface Prop {
  /** 同一摆件随群系材质变种，不为每层创建另一份定义。 */
  artStyle?: CaveSceneStyle
  /** 摆件内容 id（碰撞尺寸/外观查 propDefs 注册表） */
  id: PropId
  /** 脚底锚点（世界坐标；同时是 y-sort 键与横线碰撞箱所在 y） */
  x: number
  y: number
  /** 统一缩放（碰撞半长随之缩放） */
  s: number
  seed: number
  /** 动态物资点复用薄碰撞，尺寸可按实际外观指定（缺省查 Def）。 */
  halfWidth?: number
  halfThick?: number
  /** 动态物资点的多段碰撞（缺省＝单段 halfWidth/halfThick）。 */
  segments?: readonly PropSegment[]
  /** 动态物资点是否挡弹幕（缺省查 Def；废木/宝箱等借用 id 时显式给 false）。 */
  blockBullets?: boolean
}

/** 世界坐标碰撞段（压扁胶囊＝矩形段身＋两端半圆） */
export interface PropBand {
  x0: number
  x1: number
  y0: number
  y1: number
}

interface PropBandCache {
  id: PropId
  x: number
  y: number
  scale: number
  halfWidth: number
  halfThick: number
  segments?: readonly PropSegment[]
  bands: readonly PropBand[]
}
/** 弱引用缓存随房间实体释放，不延长旧房间的生命周期。 */
const bandCache = new WeakMap<Prop, PropBandCache>()

/** 局部段转世界胶囊；位置、尺寸、缩放或多段定义改变时重新生成。 */
export function propBands(p: Prop): readonly PropBand[] {
  const def = propDefs.get(p.id)
  const segments = p.segments ?? (def?.segments?.length ? def.segments : undefined)
  const halfWidth = p.halfWidth ?? def?.halfWidth ?? 16
  const halfThick = p.halfThick ?? def?.halfThick ?? 6
  const cached = bandCache.get(p)
  if (cached && cached.id === p.id && cached.x === p.x && cached.y === p.y && cached.scale === p.s
    && cached.halfWidth === halfWidth && cached.halfThick === halfThick
    && cached.segments?.length === segments?.length) {
    let unchanged = true
    if (segments) for (let index = 0; index < segments.length; index++) {
      const current = segments[index], previous = cached.segments![index]
      if (current.ox !== previous.ox || current.oy !== previous.oy
        || current.hw !== previous.hw || current.hb !== previous.hb) { unchanged = false; break }
    }
    if (unchanged) return cached.bands
  }
  const makeBand = (ox: number, oy: number, hw: number, hb: number): PropBand => {
    const cx = p.x + ox * p.s, y1 = p.y + oy * p.s
    return { x0: cx - hw * p.s, x1: cx + hw * p.s, y0: y1 - hb * p.s * 2, y1 }
  }
  const bands = segments
    ? segments.map(segment => makeBand(segment.ox, segment.oy, segment.hw, segment.hb))
    : [makeBand(0, 0, halfWidth, halfThick)]
  bandCache.set(p, {
    id: p.id, x: p.x, y: p.y, scale: p.s, halfWidth, halfThick,
    segments: segments?.map(segment => ({ ...segment })), bands
  })
  return bands
}

/** 摆件是否作为弹幕掩体（Def 声明；运行时字段优先，供动态物资点显式关闭） */
export function propBlocksBullets(p: Prop): boolean {
  if (p.blockBullets !== undefined) return p.blockBullets
  return propDefs.get(p.id)?.blockBullets === true
}

/** 摆件横线碰撞箱的左右端点（世界 x；单段摆件的便捷接口） */
export function propSpan(p: Prop): [number, number] {
  const [b] = propBands(p)
  return [b.x0, b.x1]
}

/** 圆（x,y,r）是否撞上某摆件的任一压扁胶囊（段身矩形 + 两端半圆） */
export function circleHitsProp(x: number, y: number, r: number, p: Prop): boolean {
  for (const b of propBands(p)) {
    const cx = Math.max(b.x0, Math.min(x, b.x1))
    const cy = Math.max(b.y0, Math.min(y, b.y1))
    const dx = x - cx
    const dy = y - cy
    if (dx * dx + dy * dy < r * r) return true
  }
  return false
}

/**
 * 移动后对摆件胶囊集合做推挤修正（玩家/敌人专用；弹幕、掉落物禁止调用）。
 * ① 当前重叠：沿"圆心→胶囊最近点"法线整圆推出，按法线主导轴清零速度（贴段身可横滑）
 * ② 高速扫掠：上一帧在阻挡薄带外、本帧穿入且跨越点落段身内 → 钉回带边
 *    （闪避 600px/s + 低帧率也不隧穿；端点圆柱的斜穿由重叠检测兜底）
 */
export function resolveCircleProps(
  e: Collider,
  prevX: number,
  prevY: number,
  props: readonly Prop[]
): void {
  for (const p of props) {
    for (const b of propBands(p)) {
      const cx = Math.max(b.x0, Math.min(e.x, b.x1))
      const cy = Math.max(b.y0, Math.min(e.y, b.y1))
      let dx = e.x - cx
      let dy = e.y - cy
      const d2 = dx * dx + dy * dy

      if (d2 < e.r * e.r) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2)
          const push = e.r - d
          dx /= d
          dy /= d
          e.x += dx * push
          e.y += dy * push
          if (Math.abs(dx) > Math.abs(dy)) e.vx = 0
          else e.vy = 0
        } else {
          // 圆心落在胶囊矩形内：矩形半宽远大于半厚，最小穿透轴恒为竖直方向
          e.y = prevY >= b.y1 ? b.y1 + e.r : b.y0 - e.r
          e.vy = 0
        }
        continue
      }

      // 扫掠防隧穿：是否跨过了阻挡薄带 y±(半厚+r) 的两条边（跨越点必须在段身 x 范围内）
      const top = b.y0 - e.r
      const bot = b.y1 + e.r
      const prevAbove = prevY < top
      const prevBelow = prevY > bot
      const nowAbove = e.y < top
      const nowBelow = e.y > bot
      if ((prevAbove && !nowAbove) || (prevBelow && !nowBelow)) {
        const remain = prevAbove ? top - prevY : prevY - bot
        const span = Math.abs(e.y - prevY)
        const t = span > 1e-6 ? Math.max(0, Math.min(1, remain / span)) : 0
        const crossX = prevX + (e.x - prevX) * t
        // 端点附近留半档容差，避免斜擦端头时在"推出/钉回"之间抖动
        if (crossX > b.x0 - e.r * 0.5 && crossX < b.x1 + e.r * 0.5) {
          e.y = prevAbove ? top : bot
          e.vy = 0
        }
      }
    }
  }
}

/**
 * 确定性摆件布局。
 * 生成顺序铁律（K 批次）：房间先由 TileMap 生成全部矿脉格（晶簇+岩包），
 * 再调本函数摆摆件——orePoints 为全部矿脉格中心，摆件锚点必须与其保持
 * "自身布局半径 + 0.8 格"以上间距，杜绝石头嵌矿、堵矿甚至和矿格碰撞箱叠死。
 * @param spawnX/spawnY 玩家出生点（附近 130px 不放摆件）
 * @param orePoints 本房全部矿脉格（含未敲岩包）的世界中心点
 */
export function layoutProps(
  doors: readonly DoorSlot[],
  seed: number,
  spawnX: number,
  spawnY: number,
  vents: readonly SteamVent[],
  orePoints: readonly { x: number; y: number }[]
): Prop[] {
  const { tile: t, roomCols: cols, roomRows: rows, wallThickness: wt } = CONFIG
  const wall = wt * t
  // 活动区内缘
  const L = wall
  const R = cols * t - wall
  const T = wall
  const B = rows * t - wall
  // 高摆件顶不得越过北墙立面下沿（wall+4），统一限制锚点 y >= wall + 2.2t
  const MIN_Y = wall + 2.2 * t
  // 摆件锚点与矿格中心的附加间距（0.8 格；连同 rad 一起判定）
  const ORE_GAP = 0.8 * t

  // 门道禁放带（南北门按列、东西门按行，±2 格净空）
  const banCols = doors.filter((d) => d.row < wt || d.row >= rows - wt).map((d) => d.col * t + t / 2)
  const banRows = doors.filter((d) => d.col < wt || d.col >= cols - wt).map((d) => d.row * t + t / 2)

  const placed: Prop[] = []
  const clearOf = (x: number, y: number, rad: number): boolean => {
    if (x - rad < L + t || x + rad > R - t || y < MIN_Y || y + rad > B - t) return false
    if (Math.hypot(x - spawnX, y - spawnY) < 130) return false
    if (banCols.some((bx) => Math.abs(x - bx) < 2.4 * t)) return false
    if (banRows.some((by) => Math.abs(y - by) < 2.4 * t)) return false
    if (vents.some((v) => Math.hypot(x - v.x, y - v.y) < 60)) return false
    // K 批次：矿脉格（含藏矿岩包）周边禁放，摆件不得贴矿、压矿
    if (orePoints.some((o) => Math.hypot(x - o.x, y - o.y) < rad + ORE_GAP)) return false
    if (placed.some((p) => Math.hypot(x - p.x, y - p.y) < Math.max(rad, 26) + 24)) return false
    return true
  }

  /**
   * 沿"墙根带"尝试放一件；mid=true 时改在房间中部带找位。
   * edgeGap＝大件离墙距离区间（格）：大件半径大，太贴墙会与岩壁重叠。
   */
  const tryPlace = (def: PropDef, salt: number, rad: number, mid = false, edgeGap: [number, number] = [0.8, 2.4]): boolean => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const h1 = hash2(seed + salt * 13 + attempt * 7, 3)
      const h2 = hash2(seed + salt * 17, attempt * 11 + 5)
      let x: number
      let y: number
      if (mid) {
        x = L + t * 2.5 + h1 * (R - L - 5 * t)
        y = MIN_Y + h2 * (B - MIN_Y - 2 * t)
      } else {
        // 贴东西南三面墙根带（距墙按 gap 格）
        const edge = Math.floor(h1 * 3) // 0 南 / 1 西 / 2 东
        const off = (edgeGap[0] + hash2(attempt, salt + seed) * (edgeGap[1] - edgeGap[0])) * t
        if (edge === 0) {
          x = L + t * 1.5 + h2 * (R - L - 3 * t)
          y = B - off
        } else if (edge === 1) {
          x = L + off
          y = MIN_Y + h2 * (B - MIN_Y - 2 * t)
        } else {
          x = R - off
          y = MIN_Y + h2 * (B - MIN_Y - 2 * t)
        }
      }
      if (clearOf(x, y, rad)) {
        placed.push({ id: def.id, x, y, s: 0.9 + hash2(salt, seed + attempt) * 0.25, seed: seed * 10 + salt })
        return true
      }
    }
    return false
  }

  // 大件组（3~4 格矿业设施）单独收集，统一摇号：每房至多一件，墙边为主、少量中置。
  const largeDefs: PropDef[] = []

  // 遍历注册表按布局规则摆放（注册顺序即摆放顺序；MOD 摆件带 layout 即自动进房）
  propDefs.all().forEach((def, di) => {
    const rule = def.layout
    if (!rule) return
    if (rule.large) {
      largeDefs.push(def)
      return
    }
    const saltBase = di * 16 + 1
    // chance 缺省=每房必出
    if (rule.chance !== undefined && hash2(seed, saltBase) >= rule.chance) return
    const [lo, hi] = rule.count
    const n = lo + Math.floor(hash2(seed, saltBase + 1) * (hi - lo + 1))
    for (let i = 0; i < n; i++) tryPlace(def, saltBase + i, rule.radius)
    // 中部带追加件（原大石 40% 中置）
    if (rule.midBonus !== undefined && hash2(seed, saltBase + 2) < rule.midBonus) {
      tryPlace(def, saltBase + 99, rule.radius, true)
    }
  })

  const lp = CONFIG.art.largeProps
  if (lp.enabled && largeDefs.length > 0 && hash2(seed, 7777) < lp.chance) {
    const def = largeDefs[Math.floor(hash2(seed, 7778) * largeDefs.length)]
    const mid = hash2(seed, 7779) < lp.midChance
    // 大件半径大：墙边选址失败再退到中部，尽量不空摇号
    if (!tryPlace(def, 9001, def.layout!.radius, mid, [2.0, 3.0])) {
      tryPlace(def, 9002, def.layout!.radius, true)
    }
  }

  return placed
}

/* ================= 绘制（原点=脚底锚点） ================= */

/** 椭圆贴地阴影 */
function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.fillStyle = 'rgba(8,6,4,0.3)'
  ctx.beginPath()
  ctx.ellipse(x, y + 2, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
}

export function renderProp(ctx: CanvasRenderingContext2D, p: Prop): void {
  // 外观由 PropDef 提供（官方 Def 复用下面五个程序化绘制器，MOD 可自画）
  propDefs.require(p.id).render(ctx, p)
}

/** 大石头：不规则岩体 + 顶截面受光 + 裂纹，偶发顶苔 */
export function drawBoulder(ctx: CanvasRenderingContext2D, p: Prop): void {
  const s = p.s
  const art=p.artStyle
  if(mineAssetsReady())shadow(ctx,p.x,p.y,22*s,5*s)
  if(drawMineSprite(ctx,(['boulder-a','boulder-b','boulder-c'] as const)[Math.floor(hash2(p.seed,37)*3)],p.x-26*s,p.y-35*s,52*s,37*s,art?.wallTint,art?.tintStrength))return
  shadow(ctx, p.x, p.y, 22 * s, 7 * s)
  // 岩体轮廓（确定性 7 顶点多边形）
  const verts: [number, number][] = []
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 - Math.PI / 2
    const rr = (0.82 + hash2(i, p.seed | 0) * 0.22) * 22 * s
    verts.push([p.x + Math.cos(a) * rr * 1.18, p.y - 12 * s + Math.sin(a) * rr * 0.82])
  }
  const poly = (): void => {
    ctx.beginPath()
    verts.forEach(([vx, vy], i) => (i === 0 ? ctx.moveTo(vx, vy) : ctx.lineTo(vx, vy)))
    ctx.closePath()
  }
  poly()
  ctx.fillStyle = ART.ink
  ctx.fill()
  ctx.save()
  poly()
  ctx.clip()
  ctx.fillStyle = ART.rock.face
  ctx.fillRect(p.x - 30 * s, p.y - 40 * s, 60 * s, 40 * s)
  // 暗面（右下 1/3 斜切）
  ctx.fillStyle = ART.rock.faceDark
  ctx.beginPath()
  ctx.moveTo(p.x + 2 * s, p.y + 6 * s)
  ctx.lineTo(p.x + 30 * s, p.y - 4 * s)
  ctx.lineTo(p.x + 30 * s, p.y + 10 * s)
  ctx.lineTo(p.x - 30 * s, p.y + 10 * s)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
  poly()
  ctx.lineWidth = 2.5
  ctx.strokeStyle = ART.ink
  ctx.stroke()
  // 顶部受光截面（左上一块）
  ctx.fillStyle = ART.rock.topHi
  ctx.beginPath()
  ctx.moveTo(verts[0][0], verts[0][1])
  ctx.lineTo(verts[1][0], verts[1][1])
  ctx.lineTo(verts[2][0], verts[2][1])
  ctx.lineTo(p.x - 2 * s, p.y - 8 * s)
  ctx.closePath()
  ctx.fill()
  // 裂纹
  ctx.strokeStyle = ART.rock.crack
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(p.x - 6 * s, p.y - 18 * s)
  ctx.lineTo(p.x - 2 * s, p.y - 10 * s)
  ctx.lineTo(p.x - 8 * s, p.y - 4 * s)
  ctx.stroke()
  // 顶苔（30%）
  if (hash2(p.seed | 0, 7) < 0.3) {
    ctx.fillStyle = ART.rock.moss
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.ellipse(p.x - 8 * s + i * 6 * s, p.y - 24 * s + (i % 2) * 3 * s, 4 * s, 2.6 * s, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  if (CONFIG.art.propsPolish) {
    // 接地压影：岩脚与地面之间一条软暗缝，石头像真的压在地上
    ctx.fillStyle = 'rgba(18,12,9,0.32)'
    ctx.beginPath()
    ctx.ellipse(p.x, p.y + 1.5 * s, 19 * s, 4.5 * s, 0, 0, Math.PI * 2)
    ctx.fill()
    // 顶部受光棱线 + 一粒云母亮点
    ctx.strokeStyle = 'rgba(216,207,182,0.28)'
    ctx.lineWidth = 1.1
    ctx.beginPath()
    ctx.moveTo(verts[1][0], verts[1][1])
    ctx.lineTo(verts[2][0], verts[2][1])
    ctx.stroke()
    ctx.fillStyle = 'rgba(200,196,178,0.5)'
    ctx.fillRect(p.x + 6 * s, p.y - 14 * s, 1.6 * s, 1.6 * s)
  }
}

/** 岩石柱：柱顶帽 + 层理柱身 + 柱脚碎石 */
export function drawPillar(ctx: CanvasRenderingContext2D, p: Prop): void {
  const s = p.s
  const art=p.artStyle
  if(mineAssetsReady())shadow(ctx,p.x,p.y,16*s,4*s)
  if(drawMineSprite(ctx,'wall-b',p.x-17*s,p.y-65*s,34*s,67*s,art?.wallTint,art?.tintStrength))return
  shadow(ctx, p.x, p.y, 18 * s, 6 * s)
  const w = 22 * s
  const h = 52 * s
  const top = p.y - h
  // 柱脚碎石
  ctx.fillStyle = ART.rock.top
  ctx.beginPath()
  ctx.ellipse(p.x - 15 * s, p.y, 6 * s, 4 * s, 0, 0, Math.PI * 2)
  ctx.ellipse(p.x + 13 * s, p.y - 1, 5 * s, 3.4 * s, 0, 0, Math.PI * 2)
  ctx.fill()
  // 柱身（ink 衬边）
  ctx.fillStyle = ART.ink
  ctx.fillRect(p.x - w / 2 - 2, top, w + 4, h + 2)
  ctx.fillStyle = ART.rock.face
  ctx.fillRect(p.x - w / 2, top, w, h)
  // 左侧暗面 + 右侧受光
  ctx.fillStyle = ART.rock.faceDark
  ctx.fillRect(p.x - w / 2, top, 5 * s, h)
  ctx.fillStyle = ART.rock.faceHi
  ctx.fillRect(p.x + w / 2 - 3 * s, top, 3 * s, h)
  // 横向层理 3 条
  ctx.strokeStyle = ART.rock.faceDark
  ctx.lineWidth = 2.4
  for (let i = 1; i <= 3; i++) {
    const ly = top + (h / 4) * i
    ctx.beginPath()
    ctx.moveTo(p.x - w / 2, ly + (hash2(i, p.seed | 0) - 0.5) * 3)
    ctx.lineTo(p.x + w / 2, ly + (hash2(p.seed | 0, i) - 0.5) * 3)
    ctx.stroke()
  }
  // 竖裂纹 1 条
  ctx.strokeStyle = ART.rock.crack
  ctx.lineWidth = 1.3
  ctx.beginPath()
  ctx.moveTo(p.x + 4 * s, top + 8 * s)
  ctx.lineTo(p.x + 7 * s, top + 20 * s)
  ctx.lineTo(p.x + 3 * s, top + 30 * s)
  ctx.stroke()
  // 柱顶帽（比柱身宽一圈的石块）
  ctx.fillStyle = ART.ink
  ctx.fillRect(p.x - w / 2 - 5, top - 10 * s, w + 10, 12 * s)
  ctx.fillStyle = ART.rock.top
  ctx.fillRect(p.x - w / 2 - 4, top - 9 * s, w + 8, 9 * s)
  ctx.fillStyle = ART.rock.topHi
  ctx.fillRect(p.x - w / 2 - 4, top - 9 * s, w + 8, 2.4 * s)
  // 帽上苔痕
  if (hash2(p.seed | 0, 11) < 0.5) {
    ctx.fillStyle = ART.rock.moss
    ctx.beginPath()
    ctx.ellipse(p.x - 5 * s, top - 8 * s, 5 * s, 2.4 * s, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  if (CONFIG.art.propsPolish) {
    // 柱脚压影 + 柱身右侧一道受光细线，强化圆雕体积
    ctx.fillStyle = 'rgba(18,12,9,0.34)'
    ctx.fillRect(p.x - w / 2 - 1 * s, p.y - 5 * s, w + 2, 5 * s)
    ctx.fillStyle = 'rgba(214,205,180,0.16)'
    ctx.fillRect(p.x + w / 2 - 4.4 * s, top + 6 * s, 1.2 * s, h - 12 * s)
  }
}

/** 废坑木堆：2~3 根斜交圆木 + 端部年轮，一根长苔 */
export function drawLogs(ctx: CanvasRenderingContext2D, p: Prop): void {
  if(mineAssetsReady())shadow(ctx,p.x,p.y,21*p.s,4*p.s)
  if(drawMineSprite(ctx,'logs',p.x-25*p.s,p.y-28*p.s,50*p.s,29*p.s))return
  const s = p.s
  shadow(ctx, p.x, p.y, 24 * s, 6 * s)
  const drawLog = (cx: number, cy: number, len: number, ang: number, mossy: boolean): void => {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(ang)
    // 杆身
    ctx.fillStyle = ART.ink
    ctx.fillRect(-len / 2 - 1, -5.5 * s, len + 2, 11 * s)
    ctx.fillStyle = ART.timber.main
    ctx.fillRect(-len / 2, -4.5 * s, len, 9 * s)
    ctx.fillStyle = ART.timber.dark
    ctx.fillRect(-len / 2, -4.5 * s, len, 2.5 * s)
    ctx.fillStyle = ART.timber.hi
    ctx.fillRect(-len / 2, 1.2 * s, len, 1.6 * s)
    // 木纹
    ctx.strokeStyle = ART.timber.grain
    ctx.lineWidth = 1
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath()
      ctx.moveTo(-len * 0.3, i * 2.6 * s)
      ctx.lineTo(len * 0.3, i * 2.6 * s)
      ctx.stroke()
    }
    // 两端年轮截面
    for (const ex of [-len / 2, len / 2]) {
      ctx.fillStyle = ART.ink
      ctx.beginPath()
      ctx.ellipse(ex, 0, 2.6 * s, 5.2 * s, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = ART.timber.hi
      ctx.beginPath()
      ctx.ellipse(ex, 0, 2 * s, 4.2 * s, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = ART.timber.grain
      ctx.beginPath()
      ctx.ellipse(ex, 0, 1 * s, 2.4 * s, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    if (mossy) {
      ctx.fillStyle = ART.rock.moss
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.ellipse(-8 * s + i * 7 * s, -5 * s, 3.6 * s, 2.2 * s, 0, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.restore()
  }
  drawLog(p.x, p.y - 3 * s, 40 * s, 0.16, false)
  drawLog(p.x - 4 * s, p.y - 9 * s, 34 * s, -0.32, true)
  drawLog(p.x + 8 * s, p.y - 14 * s, 28 * s, 0.5, false)
  if (CONFIG.art.propsPolish) {
    // 贴地潮痕：最下一根圆木下沿压一条深色水线 + 木面结疤
    ctx.strokeStyle = ART.timber.joint
    ctx.lineWidth = 1.1
    ctx.beginPath()
    ctx.moveTo(p.x - 15 * s, p.y - 2 * s)
    ctx.lineTo(p.x + 11 * s, p.y - 1 * s)
    ctx.stroke()
    ctx.fillStyle = ART.timber.grain
    ctx.beginPath()
    ctx.ellipse(p.x + 2 * s, p.y - 8 * s, 1.4 * s, 2 * s, 0.3, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** 旧矿车残骸：歪倒木厢 + 一个铁轮（锈蚀统一走 ART.metal 色板） */
export function drawCart(ctx: CanvasRenderingContext2D, p: Prop): void {
  if(mineAssetsReady())shadow(ctx,p.x,p.y,21*p.s,4*p.s)
  if(drawMineSprite(ctx,'cart',p.x-25*p.s,p.y-40*p.s,50*p.s,42*p.s))return
  const s = p.s
  shadow(ctx, p.x, p.y, 24 * s, 6 * s)
  ctx.save()
  ctx.translate(p.x, p.y - 8 * s)
  ctx.rotate(-0.22)
  // 车厢（梯形破木板）
  ctx.fillStyle = ART.ink
  ctx.beginPath()
  ctx.moveTo(-20 * s, -12 * s)
  ctx.lineTo(20 * s, -12 * s)
  ctx.lineTo(15 * s, 6 * s)
  ctx.lineTo(-15 * s, 6 * s)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = ART.timber.main
  ctx.beginPath()
  ctx.moveTo(-18 * s, -10 * s)
  ctx.lineTo(18 * s, -10 * s)
  ctx.lineTo(13.5 * s, 4 * s)
  ctx.lineTo(-13.5 * s, 4 * s)
  ctx.closePath()
  ctx.fill()
  // 板缝
  ctx.strokeStyle = ART.timber.dark
  ctx.lineWidth = 1.6
  for (const bx of [-6, 6]) {
    ctx.beginPath()
    ctx.moveTo(bx * s, -10 * s)
    ctx.lineTo(bx * 0.72 * s, 4 * s)
    ctx.stroke()
  }
  // 厢口黑
  ctx.fillStyle = ART.ink
  ctx.fillRect(-18 * s, -13 * s, 36 * s, 4 * s)
  // 木厢受光顶沿
  ctx.fillStyle = ART.timber.hi
  ctx.fillRect(-16 * s, -9.4 * s, 32 * s, 1.2 * s)
  // 铁锈箍（绕车斗一圈的扁铁条：深锈底 + 磨亮上沿 + 铆钉）
  ctx.fillStyle = ART.metal.rustDark
  ctx.fillRect(-13 * s, -3.4 * s, 26 * s, 3.2 * s)
  ctx.fillStyle = ART.metal.rust
  ctx.fillRect(-13 * s, -3.4 * s, 26 * s, 1.6 * s)
  ctx.fillStyle = ART.metal.rustHi
  ctx.fillRect(-13 * s, -3.4 * s, 26 * s, 0.7 * s)
  for (const rx of [-11, 11]) {
    ctx.fillStyle = ART.metal.rivet
    ctx.beginPath()
    ctx.arc(rx * s, -1.8 * s, 0.9 * s, 0, Math.PI * 2)
    ctx.fill()
  }
  // 锈斑（确定性散点）
  ctx.fillStyle = ART.metal.rustSpot
  for (let i = 0; i < 3; i++) {
    const hx = -10 + hash2(i, p.seed | 0) * 20
    const hy = -8 + hash2(p.seed | 0, i + 9) * 10
    ctx.fillRect(hx * s, hy * s, 1.8 * s, 1.2 * s)
  }
  // 铁轮（歪在右前）
  ctx.save()
  ctx.translate(10 * s, 9 * s)
  ctx.fillStyle = ART.ink
  ctx.beginPath()
  ctx.arc(0, 0, 8 * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = ART.metal.rustDark
  ctx.beginPath()
  ctx.arc(0, 0, 6.6 * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = ART.metal.iron
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.arc(0, 0, 6.4 * s, -2.4, -0.5)
  ctx.stroke()
  ctx.strokeStyle = ART.metal.rustHi
  ctx.lineWidth = 1.2
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(a) * 5.6 * s, Math.sin(a) * 5.6 * s)
    ctx.stroke()
  }
  ctx.fillStyle = ART.metal.rust
  ctx.beginPath()
  ctx.arc(0, 0, 2 * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  // 接地压影
  if (CONFIG.art.propsPolish) {
    ctx.fillStyle = 'rgba(18,12,9,0.3)'
    ctx.beginPath()
    ctx.ellipse(0, 7 * s, 15 * s, 3 * s, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** 旧装饰蘑菇入口保留以兼容内容 id，正式外观改为岩缝蕨丛。 */
export function drawMushrooms(ctx: CanvasRenderingContext2D, p: Prop): void {
  if(drawMinePropDetail(ctx,p,'plant-fern',30,30))return
  const s=p.s
  shadow(ctx,p.x,p.y,10*s,2*s)
  ctx.save();ctx.translate(p.x,p.y);ctx.scale(s,s)
  // 素材失败时同样保持蕨类轮廓，避免装饰再次变回可采集蘑菇的外观。
  for(let i=0;i<5;i++){
    const ex=(i-2)*4,ey=-12-Math.sin(i*1.7+p.seed)*4
    ctx.strokeStyle='#52674f';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(ex*.3,ey,ex,ey);ctx.stroke()
    for(let k=1;k<5;k++){const x=ex*k/5,y=ey*k/5;for(const side of [-1,1]){ctx.fillStyle=k%2?'#83906b':'#60775b';ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+side*5,y-4,x+side*6,y-2);ctx.lineTo(x,y+1);ctx.fill()}}
  }
  ctx.restore()
}

/* ================= 大型矿业遗迹（3~4 格；原点＝脚底锚点） ================= */

/**
 * 硬边多边形：面色填充 + ink 粗描边（描边骑在轮廓上、内外各半，
 * 与大石/墙石台同一手绘语言；旧版 ink 衬底被同尺寸面色完全覆盖，等于没描边）。
 */
function poly(
  ctx: CanvasRenderingContext2D,
  pts: Array<[number, number]>,
  fill: string,
  lw = 2
): void {
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  if (lw > 0) {
    ctx.strokeStyle = ART.ink
    ctx.lineWidth = lw
    ctx.stroke()
  }
}

/** 嵌在岩面上的碎矿石：ink 底石 → 矿色切面 → 亮棱 → 暗缝（不发光，纯材质点） */
function oreChunk(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  main: string,
  hi: string,
  rot: number
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  poly(ctx, [[-r, r * 0.3], [-r * 0.7, -r * 0.6], [r * 0.2, -r * 0.8], [r, -r * 0.1], [r * 0.5, r * 0.7]], main, 1.2)
  ctx.fillStyle = hi
  ctx.beginPath()
  ctx.moveTo(-r * 0.7, -r * 0.6)
  ctx.lineTo(r * 0.2, -r * 0.8)
  ctx.lineTo(-r * 0.1, -r * 0.2)
  ctx.lineTo(-r * 0.6, -r * 0.1)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = ART.ink
  ctx.lineWidth = 0.7
  ctx.beginPath()
  ctx.moveTo(-r * 0.2, -r * 0.3)
  ctx.lineTo(r * 0.1, r * 0.2)
  ctx.stroke()
  ctx.restore()
}

/** 确定性锈斑：同一实例永远同一分布（hash 由种子+序号派生） */
function rustSpeckle(ctx: CanvasRenderingContext2D, seed: number, area: [number, number, number, number], n: number): void {
  const [x0, y0, w, h] = area
  for (let i = 0; i < n; i++) {
    const hx = x0 + hash2(seed * 31 + i, 7) * w
    const hy = y0 + hash2(11, seed * 17 + i) * h
    ctx.fillStyle = i % 3 === 0 ? ART.metal.rustSpot : ART.metal.rustDark
    ctx.beginPath()
    ctx.ellipse(hx, hy, 1 + hash2(i, seed) * 1.8, 0.7 + hash2(seed, i) * 1.1, hash2(i, 3) * 0.8, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** 岩脚散落碎石＋压影（大件接地真实感） */
function groundDebris(ctx: CanvasRenderingContext2D, seed: number, spots: Array<[number, number, number]>): void {
  spots.forEach(([cx, cy, rr], i) => {
    ctx.fillStyle = 'rgba(14,9,7,0.28)'
    ctx.beginPath()
    ctx.ellipse(cx, cy + 2.5, rr * 1.5, rr * 0.42, 0, 0, Math.PI * 2)
    ctx.fill()
    const k = hash2(seed + i * 5, 3)
    ctx.fillStyle = k < 0.5 ? ART.rock.face : ART.rock.top
    ctx.beginPath()
    ctx.ellipse(cx - rr * 0.7, cy, rr * 0.7, rr * 0.5, -0.3, 0, Math.PI * 2)
    ctx.ellipse(cx + rr * 0.6, cy + 1, rr * 0.55, rr * 0.42, 0.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = ART.rock.topHi
    ctx.fillRect(cx - rr * 0.9, cy - rr * 0.35, rr * 0.7, 0.8)
  })
}

/** 铁铆钉：暗钉窝 + 左上小亮心 */
function rivet(ctx: CanvasRenderingContext2D, x: number, y: number, r = 1.1): void {
  ctx.fillStyle = ART.metal.rivet
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = ART.metal.rustHi
  ctx.beginPath()
  ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.4, 0, Math.PI * 2)
  ctx.fill()
}

/** A · 翻倒矿车＋洒落矿料：透视车斗（可见内腔）、朝天轮毂、碎石矿料 */
export function drawCartWreck(ctx: CanvasRenderingContext2D, p: Prop): void {
  // 两段实体仍由内容定义控制，贴图分别覆盖车斗和右侧散矿。
  if(mineAssetsReady())shadow(ctx,p.x+8*p.s,p.y,66*p.s,7*p.s)
  if(drawMineSprite(ctx,'cart-wreck',p.x-60*p.s,p.y-83*p.s,142*p.s,90*p.s))return
  const s = p.s
  const sd = (p.seed | 0) + 101
  shadow(ctx, p.x, p.y, 76 * s, 11 * s)
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.scale(s, s)
  ctx.lineJoin = 'round'

  // —— 右侧矿料堆（先画，车斗压在其左缘） ——
  // 暗部底堆
  poly(ctx, [[14, 3], [20, -8], [30, -17], [44, -24], [58, -23], [70, -15], [76, -5], [73, 3]], ART.rock.faceDark, 2)
  // 主石面（不规则双鼓包轮廓）
  poly(ctx, [[17, 2], [23, -10], [33, -18], [45, -22], [52, -19], [58, -23], [68, -16], [73, -7], [70, 2]], ART.rock.face, 2)
  // 受光顶脊两块
  ctx.fillStyle = ART.rock.topHi
  ctx.beginPath()
  ctx.moveTo(23, -10)
  ctx.lineTo(33, -18)
  ctx.lineTo(40, -14)
  ctx.lineTo(31, -7)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(52, -19)
  ctx.lineTo(58, -23)
  ctx.lineTo(64, -17)
  ctx.lineTo(56, -14)
  ctx.closePath()
  ctx.fill()
  // 石缝分叉（ink 细线，全部收在轮廓内）
  ctx.strokeStyle = ART.rock.crack
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(36, -17)
  ctx.lineTo(40, -10)
  ctx.lineTo(35, -4)
  ctx.moveTo(40, -10)
  ctx.lineTo(47, -8)
  ctx.moveTo(60, -16)
  ctx.lineTo(57, -9)
  ctx.lineTo(62, -4)
  ctx.stroke()
  // 砂眼
  ctx.fillStyle = ART.rock.crack
  for (const [qx, qy] of [[28, -8], [44, -6], [66, -9]]) {
    ctx.beginPath()
    ctx.ellipse(qx, qy, 1.1, 0.8, 0.3, 0, Math.PI * 2)
    ctx.fill()
  }
  // 嵌面矿石 3 颗（铜/铁色，带切面亮棱）
  oreChunk(ctx, 34 + (hash2(sd, 1) - 0.5) * 4, -13, 3.4, '#8a5630', '#c98a4e', -0.4)
  oreChunk(ctx, 54 + (hash2(sd, 2) - 0.5) * 4, -12, 3, '#6e757f', '#aab1bb', 0.3)
  oreChunk(ctx, 63 + (hash2(sd, 3) - 0.5) * 3, -19, 2.4, '#96602f', '#cf9050', 0.6)

  // —— 朝天轮（轮毂正对镜头：外胎正圆 + 椭圆透视内缘） ——
  ctx.save()
  ctx.translate(-50, -40)
  // 轮毂投在车斗上的影
  ctx.fillStyle = 'rgba(12,8,6,0.35)'
  ctx.beginPath()
  ctx.ellipse(6, 16, 13, 4, 0.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = ART.ink
  ctx.beginPath()
  ctx.arc(0, 0, 15, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = ART.metal.rustDark
  ctx.beginPath()
  ctx.arc(0, 0, 12.6, 0, Math.PI * 2)
  ctx.fill()
  // 胎面磨亮弧（左上一段）
  ctx.strokeStyle = ART.metal.iron
  ctx.lineWidth = 2.2
  ctx.beginPath()
  ctx.arc(0, 0, 12.2, -2.7, -0.6)
  ctx.stroke()
  // 透视内缘（椭圆轮槽）
  ctx.strokeStyle = ART.metal.rustSpot
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.ellipse(0, 0, 9.4, 5.6, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = '#2c211a'
  ctx.beginPath()
  ctx.ellipse(0, 0, 8.8, 5.1, 0, 0, Math.PI * 2)
  ctx.fill()
  // 辐条（六根，收到椭圆轮槽上）
  ctx.strokeStyle = ART.metal.rustHi
  ctx.lineWidth = 2
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.2
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * 2.6, Math.sin(a) * 1.7)
    ctx.lineTo(Math.cos(a) * 8.4, Math.sin(a) * 4.9)
    ctx.stroke()
  }
  // 轴帽
  ctx.fillStyle = ART.ink
  ctx.beginPath()
  ctx.arc(0, 0, 3.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = ART.metal.rust
  ctx.beginPath()
  ctx.arc(0, 0, 2.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = ART.metal.iron
  ctx.beginPath()
  ctx.arc(-0.7, -0.7, 0.9, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // —— 侧翻车斗：先画可见内腔（朝上的深色梯形） ——
  ctx.save()
  ctx.translate(-12, -14)
  ctx.rotate(-0.14)
  // 外壁 ink 轮廓底
  poly(ctx, [[-36, -12], [33, -12], [28, 14], [-30, 14]], ART.ink, 0)
  // 外壁木板（分三块，板间留 ink 缝）
  const boards: Array<[number, number, string]> = [
    [-35, -9, ART.timber.dark],
    [-12, -9, ART.timber.main],
    [11, -9, ART.timber.dark]
  ]
  for (const [bx, by, bc] of boards) {
    ctx.fillStyle = bc
    ctx.beginPath()
    ctx.moveTo(bx, by)
    ctx.lineTo(bx + 22, by)
    ctx.lineTo(bx + 19, 12)
    ctx.lineTo(bx - 3, 12)
    ctx.closePath()
    ctx.fill()
  }
  // 整体外轮廓描边（盖掉板缝出头）
  ctx.strokeStyle = ART.ink
  ctx.lineWidth = 2.2
  ctx.beginPath()
  ctx.moveTo(-36, -12)
  ctx.lineTo(33, -12)
  ctx.lineTo(28, 14)
  ctx.lineTo(-30, 14)
  ctx.closePath()
  ctx.stroke()
  // 顶沿厚木（受光）
  ctx.fillStyle = ART.timber.hi
  ctx.beginPath()
  ctx.moveTo(-36, -12)
  ctx.lineTo(33, -12)
  ctx.lineTo(32, -9.4)
  ctx.lineTo(-35, -9.4)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = ART.ink
  ctx.lineWidth = 1.2
  ctx.stroke()
  // 木纹与木节
  ctx.strokeStyle = ART.timber.grain
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(-30, 2)
  ctx.bezierCurveTo(-22, -1, -16, 4, -8, 1)
  ctx.moveTo(14, 3)
  ctx.bezierCurveTo(18, 0, 24, 4, 27, 2)
  ctx.stroke()
  ctx.fillStyle = ART.timber.grain
  ctx.beginPath()
  ctx.ellipse(-20, 6, 1.6, 2.4, 0.2, 0, Math.PI * 2)
  ctx.ellipse(3, 7, 1.3, 2, -0.3, 0, Math.PI * 2)
  ctx.fill()
  // 内腔（顶沿上方，深处黑＋内侧暗木）
  ctx.fillStyle = ART.ink
  ctx.beginPath()
  ctx.moveTo(-36, -12)
  ctx.lineTo(-33, -20)
  ctx.lineTo(31, -20)
  ctx.lineTo(33, -12)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = ART.rock.faceDark
  ctx.beginPath()
  ctx.moveTo(-31, -18.6)
  ctx.lineTo(29, -18.6)
  ctx.lineTo(30, -13.4)
  ctx.lineTo(-33, -13.4)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = ART.ink
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(-36, -12)
  ctx.lineTo(-33, -20)
  ctx.lineTo(31, -20)
  ctx.lineTo(33, -12)
  ctx.stroke()
  // 两条锈铁箍（绕斗壁，带铆钉与锈斑）
  for (const y of [-3, 7]) {
    ctx.fillStyle = ART.metal.rustDark
    ctx.fillRect(-32, y, 62, 3.8)
    ctx.fillStyle = ART.metal.rust
    ctx.fillRect(-32, y, 62, 2.2)
    ctx.fillStyle = ART.metal.rustHi
    ctx.fillRect(-32, y, 62, 0.8)
    rivet(ctx, -29, y + 2)
    rivet(ctx, 27, y + 2)
  }
  rustSpeckle(ctx, sd, [-28, -9, 54, 18], 7)
  ctx.restore()

  // —— 车辕（弯杆带断裂白茬） ——
  ctx.save()
  ctx.translate(-42, -3)
  ctx.rotate(0.3)
  ctx.fillStyle = ART.ink
  ctx.fillRect(-30, -4, 36, 8)
  ctx.fillStyle = ART.timber.dark
  ctx.fillRect(-29, -3, 32, 6)
  ctx.fillStyle = ART.timber.hi
  ctx.fillRect(-29, -3, 32, 1.5)
  // 端头裂开的白茬
  ctx.fillStyle = '#c8ab7e'
  ctx.beginPath()
  ctx.moveTo(-30, -3)
  ctx.lineTo(-35, -1)
  ctx.lineTo(-30, 3)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = ART.timber.grain
  ctx.beginPath()
  ctx.moveTo(-24, 0)
  ctx.lineTo(-2, -1)
  ctx.stroke()
  ctx.restore()

  // 接地：车斗下与料堆下两团软影，周围碎石
  ctx.fillStyle = 'rgba(14,9,7,0.32)'
  ctx.beginPath()
  ctx.ellipse(-14, 3, 38, 4.4, -0.1, 0, Math.PI * 2)
  ctx.ellipse(46, 4, 30, 3.8, 0, 0, Math.PI * 2)
  ctx.fill()
  groundDebris(ctx, sd, [[-46, 4, 2.6], [-36, 6, 2], [74, 4, 2.4], [12, 5, 2]])
  ctx.restore()
}

/**
 * 一根带三面受光的废方木：
 * 顶面亮、正面主、底缘暗；两端年轮截面（裂心＋偏心环）；长向木纹、纵裂与木节。
 */
function drawBeam(ctx: CanvasRenderingContext2D, len: number, thick: number, rot: number, seed = 1): void {
  ctx.save()
  ctx.rotate(rot)
  const h = thick / 2
  // 杆身三面
  ctx.fillStyle = ART.ink
  ctx.fillRect(-len / 2 - 1.6, -h - 1.6, len + 3.2, thick + 3.2)
  ctx.fillStyle = ART.timber.main
  ctx.fillRect(-len / 2, -h, len, thick)
  ctx.fillStyle = ART.timber.hi
  ctx.fillRect(-len / 2, -h, len, thick * 0.3)
  ctx.fillStyle = ART.timber.dark
  ctx.fillRect(-len / 2, h - thick * 0.2, len, thick * 0.2)
  // 顶/正面分界 ink 线
  ctx.strokeStyle = ART.ink
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(-len / 2, -h + thick * 0.3)
  ctx.lineTo(len / 2, -h + thick * 0.3)
  ctx.stroke()
  // 长向木纹（两条错峰贝塞尔）
  ctx.strokeStyle = ART.timber.grain
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(-len * 0.42, -0.5)
  ctx.bezierCurveTo(-len * 0.2, -2.6, len * 0.1, 1.8, len * 0.38, -0.6)
  ctx.moveTo(-len * 0.3, 3)
  ctx.bezierCurveTo(-len * 0.05, 1.2, len * 0.2, 3.6, len * 0.42, 2.4)
  ctx.stroke()
  // 一条纵裂（折枝裂口，收在杆内）
  ctx.strokeStyle = ART.ink
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(-len * 0.1 + hash2(seed, 2) * 6, -h + 2)
  ctx.lineTo(-len * 0.05, 0)
  ctx.lineTo(-len * 0.12 + 4, h - 2)
  ctx.stroke()
  // 木节
  ctx.fillStyle = ART.timber.grain
  ctx.beginPath()
  ctx.ellipse(len * 0.18, 1.4, 1.5, 2.3, 0.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = ART.timber.dark
  ctx.beginPath()
  ctx.ellipse(len * 0.18, 1.4, 0.7, 1.2, 0.2, 0, Math.PI * 2)
  ctx.stroke()
  // 两端年轮截面（椭圆环 + 裂心）
  for (const ex of [-len / 2, len / 2]) {
    ctx.fillStyle = ART.ink
    ctx.beginPath()
    ctx.ellipse(ex, 0, 2.8, h + 1.5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = ART.timber.hi
    ctx.beginPath()
    ctx.ellipse(ex, 0, 2, h + 0.6, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = ART.timber.grain
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.ellipse(ex, 0, 1.2, h * 0.6, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = ART.timber.dark
    ctx.beginPath()
    ctx.ellipse(ex, 0, 0.6, h * 0.3, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** 岩块（不规则 6~8 顶点 + 暗斜切面 + 受光顶 + 裂），seed 逐件扰动 */
function boulderChunk(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  seed: number,
  moss: boolean
): void {
  const pts: Array<[number, number]> = []
  const n = 7
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2
    const rr = 0.82 + hash2(seed * 13 + i * 7, 3) * 0.26
    pts.push([cx + Math.cos(a) * w * rr, cy + Math.sin(a) * h * rr])
  }
  poly(ctx, pts, ART.rock.face, 2)
  // 暗斜切面（右下三顶点连线到底边）
  ctx.fillStyle = ART.rock.faceDark
  ctx.beginPath()
  ctx.moveTo(pts[2][0], pts[2][1])
  ctx.lineTo(pts[3][0], pts[3][1])
  ctx.lineTo(pts[4][0], pts[4][1])
  ctx.lineTo(pts[5][0], pts[5][1])
  ctx.lineTo(cx - w * 0.2, cy + h * 0.9)
  ctx.lineTo(cx + w * 0.2, cy + h * 0.6)
  ctx.closePath()
  ctx.fill()
  // 受光顶截面（前两顶点一带）
  ctx.fillStyle = ART.rock.topHi
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  ctx.lineTo(pts[1][0], pts[1][1])
  ctx.lineTo(pts[2][0], pts[2][1])
  ctx.lineTo(cx - w * 0.15, cy - h * 0.15)
  ctx.closePath()
  ctx.fill()
  // 分叉裂纹
  ctx.strokeStyle = ART.rock.crack
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(cx - w * 0.15, cy - h * 0.35)
  ctx.lineTo(cx, cy - h * 0.02)
  ctx.lineTo(cx - w * 0.2, cy + h * 0.3)
  ctx.moveTo(cx, cy - h * 0.02)
  ctx.lineTo(cx + w * 0.18, cy + h * 0.12)
  ctx.stroke()
  // 砂眼
  ctx.fillStyle = ART.rock.crack
  ctx.beginPath()
  ctx.ellipse(cx + w * 0.3, cy + h * 0.25, 1, 0.8, 0, 0, Math.PI * 2)
  ctx.fill()
  if (moss) {
    ctx.fillStyle = ART.rock.moss
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.ellipse(cx - w * 0.3 + i * w * 0.28, cy - h * 0.72 + (i % 2) * 2, 3.4, 1.8, 0.2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = ART.rock.mossHi
    ctx.beginPath()
    ctx.ellipse(cx - w * 0.2, cy - h * 0.78, 1.6, 0.8, 0.2, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** B · 坍塌坑木支架：斜倒横梁＋错位立柱（年轮截面），右端压垮岩块 */
export function drawTimberCollapse(ctx: CanvasRenderingContext2D, p: Prop): void {
  if(mineAssetsReady())shadow(ctx,p.x+7*p.s,p.y,70*p.s,7*p.s)
  if(drawMineSprite(ctx,'timber-collapse',p.x-72*p.s,p.y-77*p.s,156*p.s,84*p.s))return
  const s = p.s
  const sd = (p.seed | 0) + 202
  shadow(ctx, p.x, p.y, 86 * s, 11 * s)
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.scale(s, s)
  ctx.lineJoin = 'round'

  // 左后斜立柱（斜插进碎石堆，根部土包）
  ctx.save()
  ctx.translate(-58, -20)
  ctx.rotate(-0.5)
  drawBeam(ctx, 62, 11, 0, sd + 1)
  ctx.restore()
  ctx.fillStyle = ART.rock.faceDark
  ctx.beginPath()
  ctx.ellipse(-34, 2, 12, 4.4, -0.2, 0, Math.PI * 2)
  ctx.fill()

  // 主横梁（128 长方木斜横）
  ctx.save()
  ctx.translate(-2, -12)
  ctx.rotate(-0.09)
  drawBeam(ctx, 128, 14, 0, sd + 2)
  // 梁上一道脱开的锈铁箍（支架遗存）
  ctx.fillStyle = ART.metal.rustDark
  ctx.fillRect(20, -8.4, 12, 3)
  ctx.fillRect(20, 5.4, 12, 3)
  ctx.fillStyle = ART.metal.rust
  ctx.fillRect(20, -8.4, 12, 1.4)
  ctx.fillRect(20, 5.4, 12, 1.4)
  rivet(ctx, 22, -7)
  rivet(ctx, 30, -7)
  rustSpeckle(ctx, sd + 9, [-60, -6, 120, 12], 6)
  ctx.restore()

  // 第二根立柱横压梁上
  ctx.save()
  ctx.translate(16, -26)
  ctx.rotate(0.4)
  drawBeam(ctx, 56, 10, 0, sd + 3)
  ctx.restore()

  // 右端垮落岩块（大小两块）
  boulderChunk(ctx, 45, -13, 27, 17, sd + 4, true)
  boulderChunk(ctx, 66, -8, 15, 11, sd + 5, false)

  // 折断木刺、碎木条
  ctx.strokeStyle = ART.timber.dark
  ctx.lineWidth = 2.4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-32, -1)
  ctx.lineTo(-22, -6)
  ctx.moveTo(2, 3)
  ctx.lineTo(11, -4)
  ctx.moveTo(-52, -30)
  ctx.lineTo(-46, -24)
  ctx.stroke()
  ctx.fillStyle = ART.timber.hi
  ctx.beginPath()
  ctx.moveTo(-32, -1)
  ctx.lineTo(-30, -3)
  ctx.lineTo(-27, -2)
  ctx.closePath()
  ctx.fill()

  // 接地压影与碎石
  ctx.fillStyle = 'rgba(14,9,7,0.32)'
  ctx.beginPath()
  ctx.ellipse(-8, 3, 58, 3.8, 0, 0, Math.PI * 2)
  ctx.ellipse(52, 4, 32, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  groundDebris(ctx, sd + 6, [[-66, 4, 2.4], [-20, 5, 2], [80, 4, 2.4], [20, 6, 1.8]])
  ctx.restore()
}

/** 单根腐朽枕木（不规则缺口、顶面受光、裂纹、苔斑），tilt＝翘起倾角 */
function drawTie(ctx: CanvasRenderingContext2D, seed: number, tilt: number): void {
  ctx.save()
  ctx.rotate(tilt)
  // 不规则腐朽轮廓（左右端被蛀缺）
  const pts: Array<[number, number]> = [
    [-12 + hash2(seed, 1) * 2, -4],
    [-6, -4.6],
    [2, -4],
    [9, -4.6],
    [12.5 - hash2(seed, 2) * 2, -2],
    [11.5, 3.4],
    [4, 4.2],
    [-3, 3.6],
    [-10, 4.2],
    [-12.5, 1.5]
  ]
  poly(ctx, pts, ART.timber.dark, 1.6)
  // 顶面受光窄带
  ctx.fillStyle = ART.timber.main
  ctx.beginPath()
  ctx.moveTo(-10, -3.6)
  ctx.lineTo(9, -4)
  ctx.lineTo(10, -2.2)
  ctx.lineTo(-10.5, -1.8)
  ctx.closePath()
  ctx.fill()
  // 横向裂纹两条
  ctx.strokeStyle = ART.timber.grain
  ctx.lineWidth = 0.9
  ctx.beginPath()
  ctx.moveTo(-6, -1)
  ctx.lineTo(-5.4, 2.6)
  ctx.moveTo(4, -1.4)
  ctx.lineTo(4.6, 2.8)
  ctx.stroke()
  // 顶面苔斑
  if (hash2(seed, 5) < 0.6) {
    ctx.fillStyle = ART.rock.moss
    ctx.beginPath()
    ctx.ellipse(-2 + hash2(seed, 6) * 6, -3, 2.4, 1, 0.1, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** C · 断裂矿轨残段：工字锈轨＋腐朽枕木，左端撕裂翘起悬空；贴地段不挡身不挡弹 */
export function drawBrokenRails(ctx: CanvasRenderingContext2D, p: Prop): void {
  if(drawMinePropDetail(ctx,p,'broken-rails',156,55))return
  const s = p.s
  const sd = (p.seed | 0) + 303
  shadow(ctx, p.x, p.y, 74 * s, 8 * s)
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.scale(s, s)
  ctx.lineJoin = 'round'

  // 五根枕木（右侧贴地三根、左侧两根随轨翘起）
  const ties = [54, 26, -2, -32, -54]
  ties.forEach((tx, i) => {
    const lift = i >= 3 ? (i - 2.5) * 8 : 0
    ctx.save()
    ctx.translate(tx, -1 - lift)
    drawTie(ctx, sd + i, i >= 3 ? -0.36 : 0.02)
    ctx.restore()
  })

  /**
   * 一段工字轨：轨底（锈宽条）＋轨腰（暗窄条）＋轨头（磨亮窄面）。
   * x0/x1 为段端点，ry 为轨道中轴 y；翘起段用多边形另画。
   */
  const railFlat = (x0: number, x1: number, ry: number): void => {
    // 轨底
    ctx.fillStyle = ART.metal.rustDark
    ctx.fillRect(x0, ry - 2.6, x1 - x0, 5.2)
    ctx.fillStyle = ART.metal.rust
    ctx.fillRect(x0, ry - 2.2, x1 - x0, 4.2)
    // 轨腰（中段压暗）
    ctx.fillStyle = ART.metal.rustSpot
    ctx.fillRect(x0, ry - 1.2, x1 - x0, 2.4)
    // 磨亮面断续露出，剥落锈皮服从轨头方向，不画一根塑料亮条。
    const steel=ctx.createLinearGradient(x0,ry-2,x0,ry+2)
    steel.addColorStop(0,'#c0b7a2');steel.addColorStop(.35,'#898c87');steel.addColorStop(1,'#4d5355')
    ctx.fillStyle=steel;ctx.fillRect(x0,ry-1.8,x1-x0,1.7)
    for(let k=0;k<9;k++){
      const x=x0+k*(x1-x0)/9,len=2+hash2(sd+k,ry)*5
      ctx.fillStyle=k%3?ART.metal.rustDark:ART.metal.rust
      ctx.fillRect(x,ry-1.5,len,.8)
      ctx.strokeStyle='#c5bb9b55';ctx.lineWidth=.4;ctx.beginPath();ctx.moveTo(x+len,ry-1.7);ctx.lineTo(x+len+3,ry-1.7);ctx.stroke()
    }
    ctx.fillStyle=ART.metal.rustHi;ctx.fillRect(x0,ry+.8,x1-x0,.45)
  }

  for (const ry of [-5, 5]) {
    // —— 贴地段 ——
    railFlat(-30, 56, ry)
    // 道钉（贴地段 3 组，压住轨底）
    for (const nx of [24, -2]) {
      ctx.fillStyle = ART.ink
      ctx.fillRect(nx - 1, ry - 3.4, 2, 1.6)
      ctx.fillStyle = ART.metal.iron
      ctx.fillRect(nx - 0.8, ry - 3.3, 1.6, 0.7)
    }
    // —— 翘起段（折向左上的多边形工字） ——
    const lean: Array<[number, number]> = [
      [-30, ry - 2.4],
      [-56, ry - 15],
      [-63, ry - 19.5],
      [-65, ry - 15],
      [-59, ry - 10.5],
      [-33, ry + 2.4]
    ]
    poly(ctx, lean, ART.metal.rustDark, 1.6)
    // 翘起段轨腰暗面
    ctx.fillStyle = ART.metal.rustSpot
    ctx.beginPath()
    ctx.moveTo(-31, ry - 1)
    ctx.lineTo(-58, ry - 12.5)
    ctx.lineTo(-61, ry - 13.8)
    ctx.lineTo(-33, ry + 1)
    ctx.closePath()
    ctx.fill()
    // 翘起段轨头磨亮棱
    ctx.strokeStyle = ART.metal.iron
    ctx.lineWidth = 1.3
    ctx.beginPath()
    ctx.moveTo(-31, ry - 2)
    ctx.lineTo(-57, ry - 15.2)
    ctx.lineTo(-63, ry - 19)
    ctx.stroke()
  }
  // 撕裂断口：参差锯齿（两根轨头）＋亮断茬面
  ctx.strokeStyle = ART.ink
  ctx.lineWidth = 1.3
  for (const ry of [-5, 5]) {
    ctx.beginPath()
    ctx.moveTo(-62, ry - 20)
    ctx.lineTo(-60, ry - 16)
    ctx.lineTo(-63, ry - 13)
    ctx.stroke()
    ctx.fillStyle = '#c9c2ad'
    ctx.beginPath()
    ctx.moveTo(-62.5, ry - 19)
    ctx.lineTo(-60.5, ry - 17)
    ctx.lineTo(-62, ry - 16)
    ctx.closePath()
    ctx.fill()
  }
  // 锈斑散在贴地两轨上
  rustSpeckle(ctx, sd, [-28, -8, 82, 16], 10)

  // 悬空端投影＋贴地段压影
  ctx.fillStyle = 'rgba(12,9,7,0.3)'
  ctx.beginPath()
  ctx.ellipse(-54, 4, 15, 3, -0.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(18,12,9,0.24)'
  ctx.fillRect(-28, 5, 84, 3)
  // 枕木周围碎石
  groundDebris(ctx, sd + 8, [[46, 5, 2], [10, 6, 1.8], [-20, 5, 1.6]])
  ctx.restore()
}

/** D · 垮塌岩堆：多块不规则落石＋斜搭旧木板＋锈弯镐（单件宽胶囊，seed 逐件扰动） */
export function drawRockCollapse(ctx: CanvasRenderingContext2D, p: Prop): void {
  if(drawMinePropDetail(ctx,p,'rock-collapse',158,80))return
  const s = p.s
  const sd = (p.seed | 0) + 404
  shadow(ctx, p.x, p.y, 84 * s, 11 * s)
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.scale(s, s)
  ctx.lineJoin = 'round'

  // 后层两块（压暗一档，靠色差退后；不画 moss）
  boulderChunk(ctx, -42, -15, 27, 20, sd + 1, false)
  ctx.fillStyle = 'rgba(10,7,9,0.28)'
  ctx.beginPath()
  ctx.ellipse(-42, -15, 27, 20, 0, 0, Math.PI * 2)
  ctx.fill()
  boulderChunk(ctx, 40, -17, 25, 19, sd + 2, false)
  ctx.fillStyle = 'rgba(10,7,9,0.28)'
  ctx.beginPath()
  ctx.ellipse(40, -17, 25, 19, 0, 0, Math.PI * 2)
  ctx.fill()

  // 前层主岩（大＋右中＋左下小）
  boulderChunk(ctx, -12, -8, 33, 23, sd + 3, true)
  boulderChunk(ctx, 24, -6, 20, 15, sd + 4, false)

  // 斜搭旧木板（一端断成白茬、一端埋石缝）
  ctx.save()
  ctx.translate(26, -18)
  ctx.rotate(0.52)
  ctx.fillStyle = ART.ink
  ctx.fillRect(-24, -4.6, 48, 9.2)
  ctx.fillStyle = ART.timber.dark
  ctx.fillRect(-23, -3.6, 46, 7.2)
  ctx.fillStyle = ART.timber.main
  ctx.fillRect(-23, -3.6, 46, 2.4)
  // 木纹与一条裂缝
  ctx.strokeStyle = ART.timber.grain
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(-16, 0.5)
  ctx.bezierCurveTo(-4, -2, 8, 2, 18, 0)
  ctx.stroke()
  ctx.strokeStyle = ART.ink
  ctx.beginPath()
  ctx.moveTo(-2, -3)
  ctx.lineTo(0, 0)
  ctx.lineTo(-3, 2.6)
  ctx.stroke()
  // 右下断端白茬（锯齿）
  ctx.fillStyle = '#c8ab7e'
  ctx.beginPath()
  ctx.moveTo(23, -3.6)
  ctx.lineTo(27, -1)
  ctx.lineTo(23, 3.6)
  ctx.lineTo(21, 0)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  // 锈弯镐（左前）：弯月形镐头＋两段镐尖＋断柄
  ctx.save()
  ctx.translate(-30, -4)
  ctx.rotate(-0.45)
  // 断柄
  ctx.fillStyle = ART.ink
  ctx.fillRect(-2, -2.8, 30, 5.6)
  ctx.fillStyle = ART.timber.main
  ctx.fillRect(-1, -1.9, 28, 3.8)
  ctx.fillStyle = ART.timber.hi
  ctx.fillRect(-1, -1.9, 28, 1.2)
  ctx.strokeStyle = ART.timber.grain
  ctx.lineWidth = 0.9
  ctx.beginPath()
  ctx.moveTo(2, 0.4)
  ctx.lineTo(24, -0.3)
  ctx.stroke()
  // 柄端裂纹
  ctx.strokeStyle = ART.ink
  ctx.beginPath()
  ctx.moveTo(26, -1.5)
  ctx.lineTo(27.5, 0)
  ctx.stroke()
  // 弯月镐头（ink 底 → 锈主 → 磨亮外缘）
  ctx.fillStyle = ART.ink
  ctx.beginPath()
  ctx.moveTo(-2, -3.4)
  ctx.quadraticCurveTo(-15, -8.5, -19, -1.5)
  ctx.quadraticCurveTo(-15, 5.5, -2, 3.4)
  ctx.quadraticCurveTo(-7, 0.5, -2, -3.4)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = ART.metal.rustDark
  ctx.beginPath()
  ctx.moveTo(-3, -2.2)
  ctx.quadraticCurveTo(-13, -6.5, -16.5, -1.2)
  ctx.quadraticCurveTo(-13, 4, -3, 2.2)
  ctx.quadraticCurveTo(-7.5, 0, -3, -2.2)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = ART.metal.iron
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(-4, -2.4)
  ctx.quadraticCurveTo(-13, -6, -16, -1.6)
  ctx.stroke()
  rivet(ctx, -4.5, 0.2, 1)
  ctx.restore()

  // 岩脚碎石堆（三簇）与接地压影
  groundDebris(ctx, sd + 7, [[-60, 2, 3], [-10, 4, 2.6], [58, 2, 3], [-34, 3, 2]])
  ctx.fillStyle = 'rgba(14,9,7,0.34)'
  ctx.beginPath()
  ctx.ellipse(0, 4, 72, 4.6, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}
