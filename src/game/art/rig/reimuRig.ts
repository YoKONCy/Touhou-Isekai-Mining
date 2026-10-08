/**
 * 博丽灵梦 · 骨骼绘制入口（正式画风为已确认的 C 版像素赛璐璐，约 52px）
 *
 * 形象设定（新参考存档于 art-studies/references/character-style/reimu-style-reference.png）：
 *   棕色大波浪长发披到腰下 + 头顶大红色蝴蝶结（外缘白色波浪褶边）+
 *   两侧红白发管；红瞳半垂眼；红色无袖背心裙（白翻领 + 黄色领巾结，
 *   裙摆白褶边）；露肩独立宽白袖（上臂红绑带固定，袖缘红色折线纹，
 *   袖口白褶边）；光腿 + 白色袜套 + 红绑带 + 棕色小鞋。
 *
 * 与主角共用 {@link PlayerPose} 骨骼协议与 PlayerAnimator：
 *   步态/四向镜像/迟滞全部白嫖，本文件只换外观部件，并新增 cast 施法姿态混合。
 *
 * right 向以 left 为基底整体镜像，只画 down/up/披发在躯干层（盖背/垂肩），
 * 头部只留后脑托发 + 齐眉刘海 + 蝴蝶结 + 发管 + 红瞳脸。
 */
import { dirAngle, lerpAngle, type Dir4, type PlayerPose } from './skeleton'
import { drawReimuCelRig, drawReimuCelHead, getReimuRigAtlas } from './reimuCelRig'
export { loadReimuRigAssets } from './reimuCelRig'

/** 深紫黑统一描边色（与主角同墨色，暗背景保分离） */
const INK = '#241b2e'

/** 灵梦色板 */
const MAT = {
  skin: '#ffd9bd',
  skinDark: '#e6b28e',
  // 棕色长发（参考图棕发：主棕/暗巧克力/浅棕挑染）
  hair: '#805a46',
  hairDark: '#55362f',
  hairHi: '#bd9270',
  // 红裙/结/绑带
  red: '#d63f45',
  redDark: '#a82c33',
  redLight: '#ec6064',
  // 白袖/翻领/褶边
  white: '#f7f2ee',
  whiteShade: '#d6cfcc',
  // 黄领巾
  yellow: '#f2bf3c',
  yellowDark: '#d39a26',
  // 红瞳
  eye: '#cf3e4c',
  eyeDark: '#7c1f2a',
  // 棕鞋
  shoe: '#7a4e33',
  shoeDark: '#5b3824',
  mouth: '#a0625a',
  blush: 'rgba(235,128,110,0.45)'
} as const

/** 比例常量（与主角同尺寸：同框身高/肩高一致） */
const PELVIS_Y = 6.5
const HEAD_Y = -15.4
/** 灵梦头部放大系数（Q 版大头：头占全身约 44%；只放头局部系，骨架/身体不动） */
const HEAD_SCALE = 1.12
const L_THIGH = 6
const L_SHIN = 5.6
const L_UPPER = 5.2
const L_LOWER = 4.8
const W_LEG = 4.2 // 光腿腿管宽（比裤管略细）
const W_SLEEVE = 6.2 // 独立宽白袖（比主角连身袖宽，喇叭感）
const SHOULDER = 4.8
const SHOULDER_Y = -6
const X_HIP = -1.6
const X_ARM = 8.6
const X_SHOULDER = 12.4
const SKIRT_HALF = 9.4 // 裙摆展开半宽

/** 手部锚点（与主角同协议；未来灵梦持符战斗时外挂道具用） */
export interface ReimuHandAnchor {
  x: number
  y: number
  angle: number
  inFront: boolean
}

export interface ReimuRigOptions {
  /**
   * 聚气施法强度 0~1：双臂从自然垂落混合到向两侧斜上张开（大袖张开），
   * =1 为梦想封印推出定格。0/缺省＝常态 idle/walk。
   */
  cast?: number
}

/**
 * 在世界坐标 (x,y) 绘制灵梦。
 * @returns 近侧手世界锚点
 */
/** 正式入口采用已确认的像素赛璐璐资源；加载期间沿用原有绘制，保证首帧可见。 */
export function drawReimuRig(ctx: CanvasRenderingContext2D, x: number, y: number, pose: PlayerPose, opts: ReimuRigOptions = {}): ReimuHandAnchor {
  return getReimuRigAtlas() ? drawReimuCelRig(ctx, x, y, pose, opts) : drawLegacyReimuRig(ctx, x, y, pose, opts)
}

function drawLegacyReimuRig(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pose: PlayerPose,
  opts: ReimuRigOptions = {}
): ReimuHandAnchor {
  const mirror = pose.dir === 'right'
  const drawDir: Dir4 = mirror ? 'left' : pose.dir
  const ma = (a: number): number => (mirror ? Math.PI - a : a)
  const b = pose.bone
  const cast = Math.max(0, Math.min(1, opts.cast ?? 0))

  const side = drawDir === 'left'
  const da = dirAngle(drawDir)
  const perpX = Math.cos(da + Math.PI / 2)
  const perpY = Math.sin(da + Math.PI / 2)
  const legGap = side ? 2.2 : 3.6

  // —— 双肩锚点（同主角排法） ——
  let sxF: number, syF: number, sxN: number, syN: number
  if (side) {
    sxF = 2.8
    syF = SHOULDER_Y
    sxN = -1.8
    syN = SHOULDER_Y
  } else {
    sxF = perpX * SHOULDER
    syF = SHOULDER_Y + perpY * SHOULDER
    sxN = -perpX * SHOULDER
    syN = SHOULDER_Y - perpY * SHOULDER
  }

  // —— 施法张臂：在"朝左基底局部角"里覆写双臂（right 向由根层镜像） ——
  // 近臂（身前侧 -y）举向左上 -0.72；远臂（+y 侧）举向右上 -2.42；
  // 袖摆/手随聚气时钟轻微颤，=1 前送时两臂再收拢 0.12（推出感）。
  const castTremor = cast * (1 - cast) * 0.035 * Math.sin(pose.time * 9)
  const farTarget = (drawDir === 'up' ? -0.72 : -2.42) + castTremor
  const nearTarget = (drawDir === 'up' ? -2.42 : -0.72) - castTremor
  const armFarUpper = cast > 0 ? lerpAngle(b.armFarUpper, farTarget, cast) : b.armFarUpper
  const armNearUpper = cast > 0 ? lerpAngle(b.armNearUpper, nearTarget, cast) : b.armNearUpper
  const armFarLower = cast > 0 ? armFarUpper + 0.12 - 0.05 * cast : b.armFarLower
  const armNearLower = cast > 0 ? armNearUpper + 0.12 - 0.05 * cast : b.armNearLower

  // —— 近手世界锚点（纯 FK，严禁 getTransform） ——
  const handLocalX = sxN + Math.cos(armNearUpper) * L_UPPER + Math.cos(armNearLower) * L_LOWER
  const handLocalY = syN + Math.sin(armNearUpper) * L_UPPER + Math.sin(armNearLower) * L_LOWER
  const hand: ReimuHandAnchor = {
    x: x + pose.rootX + (mirror ? -handLocalX : handLocalX),
    y: y + pose.rootY + handLocalY,
    angle: mirror ? Math.PI - armNearLower : armNearLower,
    inFront: pose.weaponInFront
  }

  ctx.save()
  ctx.translate(x + pose.rootX, y + pose.rootY)
  if (mirror) ctx.scale(-1, 1)
  ctx.rotate(pose.rootRot)
  ctx.scale(pose.scaleX, pose.scaleY)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // 1. 远侧腿
  // 侧面远腿略向后、向上错位，让静止双鞋仍有可读的纵深。
  drawLeg(ctx, perpX * legGap + (side ? 1.8 : 0), PELVIS_Y + perpY * legGap - (side ? 0.3 : 0), b.thighFar, b.shinFar, true, side)
  // 2. 正/背面近侧腿
  if (!side) {
    drawLeg(ctx, -perpX * legGap, PELVIS_Y - perpY * legGap, b.thighNear, b.shinNear, false)
  }

  // 2b. 侧身远袖在底层
  if (side) {
    drawSleeve(ctx, sxF, syF, armFarUpper, armFarLower, true, drawDir, pose.time, cast, 1)
  }

  // 侧面近腿也在裙身底层，大腿上端由裙摆遮住。
  if (side) {
    drawLeg(ctx, -perpX * legGap, PELVIS_Y - perpY * legGap, b.thighNear, b.shinNear, false, true)
  }

  // 3. 躯干（红裙 + 翻领领巾 + 分层长发披片）
  ctx.save()
  ctx.translate(0, PELVIS_Y)
  ctx.rotate(ma(b.spine))
  drawTorso(ctx, drawDir, pose.cape, pose.time)
  ctx.restore()

  // 4. 头（后脑托发 + 脸 + 刘海 + 蝴蝶结 + 发管 + 红瞳）
  drawHead(ctx, pose, drawDir, ma(pose.aim))

  // 4b. 扎束双缕（必须在头之后、前层袖子之前：脸侧段压在脸下，胸前段被袖子自然遮一半）
  drawFrontSidelocks(ctx, pose, drawDir)

  // 5. 双臂前层（露肩宽白袖是最外层）
  if (drawDir === 'up') {
    drawSleeve(ctx, sxF, syF, armFarUpper, armFarLower, true, drawDir, pose.time, cast)
    drawSleeve(ctx, sxN, syN, armNearUpper, armNearLower, false, drawDir, pose.time, cast)
  } else if (side) {
    drawSleeve(ctx, sxN, syN, armNearUpper, armNearLower, false, drawDir, pose.time, cast)
  } else {
    drawSleeve(ctx, sxF, syF, armFarUpper, armFarLower, true, drawDir, pose.time, cast)
    drawSleeve(ctx, sxN, syN, armNearUpper, armNearLower, false, drawDir, pose.time, cast)
  }

  // 背面垂臂全藏在长发后；施法张臂才将完整袖子放到前层。
  if (drawDir === 'up') {
    drawHead(ctx, pose, drawDir, ma(pose.aim))
    if (cast > 0) {
      drawSleeve(ctx, sxF, syF, armFarUpper, armFarLower, true, drawDir, pose.time, cast)
      drawSleeve(ctx, sxN, syN, armNearUpper, armNearLower, false, drawDir, pose.time, cast)
    }
  }

  ctx.restore()
  return hand
}

// ───────────────────────── 基元（与主角同语言） ─────────────────────────

function shape(
  ctx: CanvasRenderingContext2D,
  fill: string,
  stroke: string = INK,
  lw = 1.3
): void {
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = lw
  ctx.stroke()
}

/** 圆管线（同主角：主色粗线 + 右下暗面 + 极细墨边） */
function tube(
  ctx: CanvasRenderingContext2D,
  a1: number,
  a2: number,
  l1: number,
  l2: number,
  w: number,
  main: string,
  dark: string
): void {
  const x1 = Math.cos(a1) * l1
  const y1 = Math.sin(a1) * l1
  const x2 = x1 + Math.cos(a2) * l2
  const y2 = y1 + Math.sin(a2) * l2
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.strokeStyle = main
  ctx.lineWidth = w
  ctx.stroke()
  ctx.save()
  ctx.translate(0.7, 0.9)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.strokeStyle = dark
  ctx.lineWidth = w * 0.36
  ctx.globalAlpha *= 0.55
  ctx.stroke()
  ctx.restore()
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.strokeStyle = INK
  ctx.lineWidth = w + 1.5
  ctx.globalAlpha *= 0.28
  ctx.stroke()
  ctx.restore()
}

// ───────────────────────── 腿脚（光腿 + 白袜套 + 红绑带 + 棕鞋） ─────────────────────────

function drawLeg(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  thighA: number,
  shinA: number,
  far: boolean,
  side = false
): void {
  ctx.save()
  ctx.translate(hx, hy)
  // 光腿：大腿/小腿都用肤色管线
  tube(
    ctx,
    thighA,
    shinA,
    L_THIGH,
    L_SHIN,
    W_LEG,
    far ? MAT.skinDark : MAT.skin,
    far ? '#cf9d7c' : MAT.skinDark
  )
  const kx = Math.cos(thighA) * L_THIGH
  const ky = Math.sin(thighA) * L_THIGH
  const ax = kx + Math.cos(shinA) * L_SHIN
  const ay = ky + Math.sin(shinA) * L_SHIN

  // 白色袜套：从小腿 35% 处一直盖到脚踝（叠在肤色管线上）
  const sockStart = 0.35
  const ssx = kx + Math.cos(shinA) * L_SHIN * sockStart
  const ssy = ky + Math.sin(shinA) * L_SHIN * sockStart
  ctx.beginPath()
  ctx.moveTo(ssx, ssy)
  ctx.lineTo(ax, ay)
  ctx.strokeStyle = far ? MAT.whiteShade : MAT.white
  ctx.lineWidth = W_LEG + 0.3
  ctx.stroke()
  // 侧面远袜被近腿遮住，仅保留白袜轮廓，避免红环露成裙摆延伸。
  if (!(side && far)) {
  // 袜口红绑带（一圈红环：垂直于小腿方向的短粗线）
  ctx.save()
  ctx.translate(ssx, ssy)
  ctx.rotate(shinA)
  ctx.beginPath()
  ctx.moveTo(0, -(W_LEG / 2 + 0.2))
  ctx.lineTo(0, W_LEG / 2 + 0.2)
  ctx.strokeStyle = MAT.red
  ctx.lineWidth = 0.7
  ctx.lineCap = 'butt'
  ctx.stroke()
  ctx.restore()
  }

  // 鞋层
  ctx.save()
  ctx.translate(ax, ay)
  ctx.rotate((thighA + shinA) / 2)
  // 脚踝白翻口
  ctx.beginPath()
  ctx.ellipse(0.1, 0, 1.5, 2.3, 0, 0, Math.PI * 2)
  ctx.fillStyle = far ? MAT.whiteShade : MAT.white
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 0.8
  ctx.stroke()
  // 侧面只保留袜口的一圈红带，避免脚踝第二道红带露成穿模碎片。
  if (!side) {
    ctx.beginPath()
    ctx.moveTo(-1.2, -1.5)
    ctx.lineTo(1.2, -1.5)
    ctx.strokeStyle = MAT.red
    ctx.lineWidth = 0.6
    ctx.lineCap = 'butt'
    ctx.stroke()
    ctx.lineCap = 'round'
  }
  // 侧面鞋长与鞋宽收小，远鞋再略缩形成纵深，不改变腿骨与脚踝位置。
  if (side) ctx.scale(far ? 0.76 : 0.84, far ? 0.8 : 0.86)
  // 棕色小鞋
  ctx.beginPath()
  ctx.ellipse(2.1, 0.2, 2.9, 2.15, 0, 0, Math.PI * 2)
  ctx.fillStyle = far ? MAT.shoeDark : MAT.shoe
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 1
  ctx.stroke()
  // 深色鞋底
  ctx.beginPath()
  ctx.moveTo(-0.3, 1.5)
  ctx.quadraticCurveTo(2.1, 2.8, 4.6, 1.4)
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.4
  ctx.stroke()
  ctx.restore() // 鞋层
  ctx.restore() // 髋层
}

// ───────────────────────── 露肩独立宽白袖 ─────────────────────────

/**
 * 一条独立宽白袖：袖管沿臂骨（与肩膀断开＝露肩），
 * 上臂起点红绑带+小蝴蝶结固定，管身缀红色短折线纹，末端喇叭白褶边+小手。
 * hideLevel 1＝侧身远臂只露窄白袖影。
 */
function drawSleeve(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  upperA: number,
  lowerA: number,
  far: boolean,
  dir: Dir4,
  time: number,
  cast: number,
  hideLevel = 0,
  layer: 'full' | 'cuff' = 'full'
): void {
  ctx.save()
  ctx.translate(sx, sy)
  const sideView = dir === 'left'
  const wSleeve = sideView && hideLevel === 1 ? W_SLEEVE * 0.55 : sideView ? W_SLEEVE * 0.72 : W_SLEEVE
  const x1 = Math.cos(upperA) * L_UPPER
  const y1 = Math.sin(upperA) * L_UPPER
  const ex = x1 + Math.cos(lowerA) * L_LOWER
  const ey = y1 + Math.sin(lowerA) * L_LOWER

  // 背面袖口可独立重绘，袖管留在完整发幕后。
  if (layer === 'full') {
  // 袖身沿前臂逐渐展开，替代等宽圆管的胶囊轮廓。
  const nx = -Math.sin(lowerA)
  const ny = Math.cos(lowerA)
  const shoulderNX = -Math.sin(upperA)
  const shoulderNY = Math.cos(upperA)
  ctx.beginPath()
  ctx.moveTo(shoulderNX * wSleeve * 0.35, shoulderNY * wSleeve * 0.35)
  ctx.quadraticCurveTo(x1 + nx * wSleeve * 0.43, y1 + ny * wSleeve * 0.43, ex + nx * wSleeve * 0.65, ey + ny * wSleeve * 0.65)
  ctx.quadraticCurveTo(ex + Math.cos(lowerA) * 1.0, ey + Math.sin(lowerA) * 1.0, ex - nx * wSleeve * 0.65, ey - ny * wSleeve * 0.65)
  ctx.quadraticCurveTo(x1 - nx * wSleeve * 0.43, y1 - ny * wSleeve * 0.43, -shoulderNX * wSleeve * 0.35, -shoulderNY * wSleeve * 0.35)
  ctx.closePath()
  shape(ctx, far && dir !== 'up' ? MAT.whiteShade : MAT.white, INK, 0.75)

  // —— 上臂红绑带（袖管与上臂固定处）：起点沿骨 1.3px ——
  ctx.save()
  ctx.translate(Math.cos(upperA) * 1.3, Math.sin(upperA) * 1.3)
  ctx.rotate(upperA)
  ctx.beginPath()
  ctx.moveTo(0, -wSleeve / 2)
  ctx.lineTo(0, wSleeve / 2)
  ctx.strokeStyle = MAT.red
  ctx.lineWidth = 0.8
  ctx.lineCap = 'butt'
  ctx.stroke()
  // 小结用扁平双翅，而不是两颗圆球。
  ctx.fillStyle = MAT.redLight
  ctx.beginPath()
  ctx.moveTo(0, -wSleeve / 2)
  ctx.lineTo(-1.1, -wSleeve / 2 - 0.9)
  ctx.lineTo(-1.0, -wSleeve / 2 + 0.3)
  ctx.lineTo(0, -wSleeve / 2)
  ctx.lineTo(1.1, -wSleeve / 2 - 0.9)
  ctx.lineTo(1.0, -wSleeve / 2 + 0.3)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  // —— 管身红色折线纹（大臂段 2 对红条：块面化后少即是多，3 对缩小发糊） ——
  if (hideLevel !== 1) {
    ctx.save()
    ctx.translate(Math.cos(upperA) * L_UPPER * 0.52, Math.sin(upperA) * L_UPPER * 0.52)
    ctx.rotate(upperA)
    ctx.strokeStyle = MAT.red
    ctx.lineWidth = 0.5
    ctx.lineCap = 'butt'
    for (const i of [-1, 1]) {
      const px = i * 2.1
      ctx.beginPath()
      ctx.moveTo(px - 0.6, wSleeve / 2 - 0.5)
      ctx.lineTo(px + 0.1, wSleeve / 2 - 1.5)
      ctx.moveTo(px - 0.1, -wSleeve / 2 + 0.5)
      ctx.lineTo(px + 0.6, -wSleeve / 2 + 1.5)
      ctx.stroke()
    }
    ctx.restore()
  }

  }

  // —— 袖口喇叭白褶边 + 小手 ——
  ctx.save()
  ctx.translate(ex, ey)
  ctx.rotate(lowerA)
  if (cast > 0) ctx.rotate(Math.sin(time * 8) * 0.05 * cast)
  if (hideLevel === 1) {
    ctx.beginPath()
    ctx.ellipse(0.4, 0, 1.2, wSleeve / 2 + 0.1, 0, 0, Math.PI * 2)
    ctx.fillStyle = MAT.white
    ctx.globalAlpha *= 0.85
    ctx.fill()
    ctx.globalAlpha /= 0.85
  } else {
    // 喇叭褶边（比管身宽出一圈的白扇）
    ctx.beginPath()
    ctx.moveTo(-1.7, -wSleeve / 2 - 0.7)
    ctx.quadraticCurveTo(-0.6, -wSleeve / 2 - 1.3, 0.5, -wSleeve / 2 - 0.6)
    ctx.quadraticCurveTo(2.0, 0, 0.5, wSleeve / 2 + 0.6)
    ctx.quadraticCurveTo(-0.6, wSleeve / 2 + 1.3, -1.7, wSleeve / 2 + 0.7)
    ctx.quadraticCurveTo(-0.8, 0, -1.7, -wSleeve / 2 - 0.7)
    ctx.closePath()
    ctx.fillStyle = far ? MAT.whiteShade : MAT.white
    ctx.fill()
    ctx.strokeStyle = INK
    ctx.lineWidth = 0.5
    ctx.stroke()
    // 褶边瓣分叶（三道小弧）
    ctx.strokeStyle = MAT.whiteShade
    ctx.lineWidth = 0.4
    ctx.beginPath()
    for (const yy of [-wSleeve / 4, 0, wSleeve / 4]) {
      ctx.moveTo(-1.4, yy)
      ctx.quadraticCurveTo(-0.2, yy + 0.7, 1.0, yy)
    }
    ctx.stroke()
    // 小手（褶边外只露一点点）
    ctx.beginPath()
    ctx.ellipse(2.0, 0, 1.3, 1.55, 0, 0, Math.PI * 2)
    shape(ctx, MAT.skin, INK, 0.9)
  }
  ctx.restore()
  ctx.restore()
}

// ───────────────────────── 躯干（红裙 + 翻领领巾 + 披发） ─────────────────────────

/**
 * 躯干（脊柱局部系：原点骨盆，+x 朝头顶，+y 角色右）。
 * 长发披片也在本层画：背面整片盖背长发、正面两缕肩侧长发、侧身身后披发。
 */
function drawTorso(ctx: CanvasRenderingContext2D, dir: Dir4, sway: number, time: number): void {
  if (dir === 'left') {
    drawTorsoSide(ctx, sway, time)
    return
  }
  const fl = sway * 3 // 步态裙摆轻翻

  if (dir === 'up') {
    // —— 背面：红裙整片（无袖肩带） ——
    ctx.beginPath()
    ctx.moveTo(X_SHOULDER + 2.4, -2.6)
    ctx.quadraticCurveTo(X_SHOULDER + 2.2, -6, X_SHOULDER, -9.4)
    ctx.quadraticCurveTo(6, -11.2, X_HIP - 1 - fl, -SKIRT_HALF)
    ctx.quadraticCurveTo(X_HIP - 2.4, 0, X_HIP - 1 + fl, SKIRT_HALF)
    ctx.quadraticCurveTo(6, 11.2, X_SHOULDER, 9.4)
    ctx.quadraticCurveTo(X_SHOULDER + 2.2, 6, X_SHOULDER + 2.4, 2.6)
    ctx.quadraticCurveTo(X_SHOULDER + 3, 0, X_SHOULDER + 2.4, -2.6)
    ctx.closePath()
    shape(ctx, MAT.red, INK, 1.55)
    // 右半暗面软条
    ctx.beginPath()
    ctx.moveTo(X_SHOULDER, 9.4)
    ctx.quadraticCurveTo(5.6, 6, X_HIP - 1 + fl, SKIRT_HALF)
    ctx.lineTo(X_HIP - 3.2 + fl, SKIRT_HALF - 1.4)
    ctx.quadraticCurveTo(3, 4, X_SHOULDER - 1.6, 7.6)
    ctx.closePath()
    ctx.fillStyle = MAT.redDark
    ctx.globalAlpha = 0.55
    ctx.fill()
    ctx.globalAlpha = 1
    // 后领白小弧
    ctx.beginPath()
    ctx.ellipse(X_SHOULDER + 1.7, 0, 2.6, 1.9, 0, 0, Math.PI * 2)
    shape(ctx, MAT.white, INK, 0.9)
    // 裙摆白褶边（沿下摆弧一排圆瓣）
    drawFrillArc(ctx, X_HIP - 1, fl, -SKIRT_HALF + 1, SKIRT_HALF - 1)
    // 完整背面披发在主流程覆盖袖管后绘制，袖口和手再提到前层。
    return
  }

  // —— 正面：红色无袖背心裙（窄肩带 + 收腰 + A 字裙摆） ——
  ctx.beginPath()
  ctx.moveTo(X_HIP - 2.4 - fl, -SKIRT_HALF) // 左下摆
  ctx.quadraticCurveTo(X_HIP - 3.4, 0, X_HIP - 2.4 + fl, SKIRT_HALF)
  ctx.quadraticCurveTo(1.4, 7.8, 4.4, 5.8) // 右胯收腰
  ctx.lineTo(X_ARM + 0.2, 4.6) // 右侧腰→腋下
  ctx.lineTo(X_SHOULDER - 0.6, 3.4) // 肩带外
  ctx.lineTo(X_SHOULDER + 0.4, 1.8) // 肩带内
  ctx.lineTo(X_ARM + 0.4, 2.4) // 领口右
  ctx.quadraticCurveTo(X_ARM - 1, 3.4, X_ARM - 2.4, 2.4) // 领口弧（U 领）
  ctx.lineTo(X_SHOULDER + 0.4, -1.8)
  ctx.lineTo(X_SHOULDER - 0.6, -3.4)
  ctx.lineTo(X_ARM + 0.2, -4.6)
  ctx.lineTo(4.4, -5.8)
  ctx.quadraticCurveTo(1.4, -7.8, X_HIP - 2.4 - fl, -SKIRT_HALF)
  ctx.closePath()
  shape(ctx, MAT.red, INK, 1.55)
  // 右侧暗面（裙摆+腰侧）
  ctx.beginPath()
  ctx.moveTo(4.4, 5.8)
  ctx.quadraticCurveTo(1.4, 7.8, X_HIP - 2.4 + fl, SKIRT_HALF)
  ctx.lineTo(X_HIP - 4.2 + fl, SKIRT_HALF - 1.2)
  ctx.quadraticCurveTo(2.6, 5.2, 3.4, 3.6)
  ctx.closePath()
  ctx.fillStyle = MAT.redDark
  ctx.globalAlpha = 0.5
  ctx.fill()
  ctx.globalAlpha = 1
  // 裙摆折面从腰线向外展开，小尺寸仍能读出布料而非一块红色圆盘。
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(4.4, s * 2.8)
    ctx.quadraticCurveTo(0.8, s * 4.8, X_HIP - 2.4, s * 7.0)
    ctx.lineTo(X_HIP - 2.8, s * 4.5)
    ctx.quadraticCurveTo(1.0, s * 3.0, 4.4, s * 2.8)
    ctx.fillStyle = s < 0 ? MAT.redLight : MAT.redDark
    ctx.globalAlpha = 0.42
    ctx.fill()
  }
  ctx.globalAlpha = 1
  // 裙摆白褶边
  drawFrillArc(ctx, X_HIP - 2.6, fl, -SKIRT_HALF + 0.8, SKIRT_HALF - 0.8)

  // —— 白色翻领（领口两片） + 黄领巾结 ——
  drawCollarFront(ctx)
  // —— 脖子（插进后发/领口） ——
  ctx.beginPath()
  ctx.ellipse(14.7, 0, 2.1, 1.5, 0, 0, Math.PI * 2)
  shape(ctx, MAT.skin, INK, 0.9)
  drawCollarFrontOver(ctx)
  // 注：正面扎束双缕已移至头部局部系（drawSidelock），此处不再画肩侧长发
}

/** 白领 + 黄领巾（先画：被脖子压住根部） */
function drawCollarFront(ctx: CanvasRenderingContext2D): void {
  // 白翻领两片（西装领：从颈侧斜向外下）
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(14.8, s * 1.1)
    ctx.lineTo(13.2, s * 3.0)
    ctx.lineTo(10.8, s * 3.4)
    ctx.lineTo(12.3, s * 0.8)
    ctx.closePath()
    shape(ctx, MAT.white, INK, 0.55)
  }
}

/** 黄领巾结（脖子画完后压上） */
function drawCollarFrontOver(ctx: CanvasRenderingContext2D): void {
  // 黄色结粒
  ctx.beginPath()
  ctx.ellipse(12.7, 0, 1.7, 1.4, 0, 0, Math.PI * 2)
  shape(ctx, MAT.yellow, INK, 0.9)
  // 参考图的垂胸双片领巾：下端展开，避免缩成领口的一颗黄点。
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(12.2, s * 0.6)
    ctx.quadraticCurveTo(10.2, s * 0.9, 7.8, s * 2.0)
    ctx.lineTo(7.5, s * 0.35)
    ctx.lineTo(10.5, s * 0.15)
    ctx.closePath()
    shape(ctx, s < 0 ? MAT.yellow : MAT.yellowDark, INK, 0.45)
  }
  // 结粒暗面小点
  ctx.beginPath()
  ctx.ellipse(13.2, 0.4, 0.7, 0.55, 0, 0, Math.PI * 2)
  ctx.fillStyle = MAT.yellowDark
  ctx.globalAlpha = 0.7
  ctx.fill()
  ctx.globalAlpha = 1
}

/** 裙摆白褶边：沿 x≈hipX 的下摆弧排一串圆瓣 */
function drawFrillArc(
  ctx: CanvasRenderingContext2D,
  hipX: number,
  fl: number,
  y0: number,
  y1: number
): void {
  const petals = 8
  const step = (y1 - y0) / petals
  for (let i = 0; i < petals; i++) {
    const yy = y0 + step * (i + 0.5)
    // 瓣随下摆弧：中央瓣更低（x 更小）
    const t = Math.abs(yy) / SKIRT_HALF
    const px = hipX - 0.9 + 0.9 * t * t + fl * (yy / SKIRT_HALF)
    ctx.beginPath()
    ctx.moveTo(px + 1.0, yy - step * 0.52)
    ctx.lineTo(px - 0.55, yy - step * 0.45)
    ctx.quadraticCurveTo(px - 1.3, yy, px - 0.5, yy + step * 0.48)
    ctx.lineTo(px + 1.1, yy + step * 0.52)
    ctx.closePath()
    ctx.fillStyle = MAT.white
    ctx.fill()
    ctx.strokeStyle = INK
    ctx.lineWidth = 0.6
    ctx.stroke()
  }
}

/** 头部局部系中的完整后发，后脑到腰下只有一条连续轮廓。 */
function hairBackPath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath()
  ctx.moveTo(-9.1, -1.5)
  ctx.bezierCurveTo(-10.3, -8.7, -5.4, -10.2, 0, -10.1)
  ctx.bezierCurveTo(6.5, -10.2, 10.0, -7.2, 9.2, -0.5)
  ctx.bezierCurveTo(8.4, 5.8, 9.0, 9.8, 10.0, 14.0)
  ctx.quadraticCurveTo(11.6, 19.2, 8.5, 23.0)
  ctx.quadraticCurveTo(8.8, 20.8, 6.6, 20.0)
  ctx.quadraticCurveTo(6.9, 23.6, 3.8, 24.0)
  ctx.quadraticCurveTo(4.8, 21.9, 2.5, 20.8)
  ctx.quadraticCurveTo(1.1, 24.2, -1.8, 23.0)
  ctx.quadraticCurveTo(-0.3, 21.0, -2.8, 20.0)
  ctx.quadraticCurveTo(-4.4, 23.7, -7.4, 22.0)
  ctx.quadraticCurveTo(-5.9, 20.1, -7.2, 18.8)
  ctx.quadraticCurveTo(-9.2, 20.2, -10.0, 20.1)
  ctx.bezierCurveTo(-8.6, 14.0, -10.0, 10.1, -9.0, 5.0)
  ctx.quadraticCurveTo(-8.5, 1.5, -9.1, -1.5)
  ctx.closePath()
}

function drawLongHairBack(ctx: CanvasRenderingContext2D): void {
  hairBackPath(ctx)
  shape(ctx, MAT.hair, INK, 1.0)
  ctx.save()
  ctx.clip()
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(s * 2.5, -8.7)
    ctx.bezierCurveTo(s * 8.8, -4.4, s * 5.2, 5.0, s * 7.8, 13.0)
    ctx.quadraticCurveTo(s * 9.1, 18.5, s * 5.8, 22.0)
    ctx.bezierCurveTo(s * 6.5, 13.0, s * 2.7, 3.8, s * 2.5, -8.7)
    ctx.fillStyle = s < 0 ? MAT.hairHi : MAT.hairDark
    ctx.globalAlpha = 0.32
    ctx.fill()
  }
  ctx.strokeStyle = MAT.hairDark
  ctx.lineWidth = 0.65
  ctx.globalAlpha = 0.5
  for (const xx of [-5.5, -1.8, 3.5, 7.2]) {
    ctx.beginPath()
    ctx.moveTo(xx * 0.55, -6.5)
    ctx.bezierCurveTo(xx * 1.35, 1.0, xx * 0.45, 12.0, xx, 21.0)
    ctx.stroke()
  }
  ctx.restore()
}

/** 侧身躯干：先画身后披发（+y），再画红裙（胸前扎束缕由头层负责） */
function drawTorsoSide(ctx: CanvasRenderingContext2D, sway: number, time: number): void {
  const fl = sway * 2.2

  // —— 身后披发（+y 身后）：根部贴后背被裙身遮，发梢飘出轮廓 ——
  ctx.beginPath()
  ctx.moveTo(X_SHOULDER + 0.6, 0.6)
  ctx.quadraticCurveTo(X_SHOULDER - 1, 5.8, 3.6, 6.6 + fl) // 后脑→后背外蓬
  ctx.quadraticCurveTo(0.6, 8.4 + fl, X_HIP - 0.6 + fl, 7.4) // 发身上段
  // 末端两波参差
  ctx.lineTo(X_HIP - 2.6 + fl * 1.2, 6.2)
  ctx.lineTo(X_HIP - 3.4 + fl * 1.3, 3.6)
  ctx.lineTo(X_HIP - 1.2 + fl * 0.7, 3.0)
  ctx.lineTo(X_HIP - 2.4 + fl, 0.8)
  ctx.quadraticCurveTo(2.2, 2.4, 4.6, 1.4)
  ctx.closePath()
  ctx.fillStyle = MAT.hair
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.5
  ctx.stroke()
  // 块面高光（一块浅棕）
  ctx.fillStyle = MAT.hairHi
  ctx.globalAlpha = 0.75
  ctx.beginPath()
  ctx.ellipse(2.8, 5.8 + fl * 0.4, 0.8, 2.6, 0.15, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  // —— 红色背心裙侧身（厚度压到正面六成） ——
  ctx.beginPath()
  ctx.moveTo(X_SHOULDER + 0.4, -3.4) // 前胸肩带
  ctx.quadraticCurveTo(X_SHOULDER + 0.8, -0.4, X_SHOULDER - 0.6, 4.0) // 胸前过到侧腰
  ctx.lineTo(7.2, 5.2) // 侧腰
  ctx.quadraticCurveTo(2.2, 6.4 + fl, X_HIP - 1.4 + fl, 4.8) // 后裙摆
  ctx.quadraticCurveTo(X_HIP - 2.2, 0.4, X_HIP - 0.4, -3.6) // 裙摆过底
  ctx.quadraticCurveTo(4.6, -4.4, X_ARM + 1, -3.8) // 前摆
  ctx.closePath()
  shape(ctx, MAT.red, INK, 1.55)
  // 后缘暗面
  ctx.beginPath()
  ctx.moveTo(7.2, 5.2)
  ctx.quadraticCurveTo(2.2, 6.4 + fl, X_HIP - 1.4 + fl, 4.8)
  ctx.lineTo(X_HIP - 2.6 + fl, 4.2)
  ctx.quadraticCurveTo(3.2, 5, 8, 3.8)
  ctx.closePath()
  ctx.fillStyle = MAT.redDark
  ctx.globalAlpha = 0.55
  ctx.fill()
  ctx.globalAlpha = 1
  // 裙摆白褶边（侧影 5 瓣）
  const petals = 5
  for (let i = 0; i < petals; i++) {
    const t = i / (petals - 1)
    const px = X_HIP - 0.6 - 1.1 * Math.sin(t * Math.PI) + fl * 0.6
    const yy = -3.4 + t * 8.4
    ctx.beginPath()
    ctx.ellipse(px, yy, 1.15, 0.95, 0, 0, Math.PI * 2)
    ctx.fillStyle = MAT.white
    ctx.fill()
    ctx.strokeStyle = INK
    ctx.lineWidth = 0.6
    ctx.stroke()
  }
  // 前领白角 + 黄结侧影
  ctx.beginPath()
  ctx.moveTo(13.8, -3.2)
  ctx.lineTo(12.4, -1.4)
  ctx.lineTo(13.4, -1.8)
  ctx.closePath()
  shape(ctx, MAT.white, INK, 0.8)
  ctx.beginPath()
  ctx.ellipse(12.6, -1.2, 1.2, 1.0, 0, 0, Math.PI * 2)
  shape(ctx, MAT.yellow, INK, 0.8)
  // 侧颈（后领白小弧 + 肤色颈柱）
  ctx.beginPath()
  ctx.ellipse(14.7, 1.0, 2.3, 1.3, 0.1, 0, Math.PI * 2)
  shape(ctx, MAT.white, INK, 0.9)
  ctx.beginPath()
  ctx.ellipse(14.3, -0.5, 2.0, 1.1, 0, 0, Math.PI * 2)
  shape(ctx, MAT.skin, INK, 0.9)
}

// ───────────────────────── 头（棕发 + 大蝴蝶结 + 发管 + 红瞳） ─────────────────────────

function drawHead(ctx: CanvasRenderingContext2D, pose: PlayerPose, dir: Dir4, aim: number): void {
  ctx.save()
  ctx.translate(0, HEAD_Y)
  ctx.rotate(pose.bone.head + Math.PI / 2)
  ctx.scale(HEAD_SCALE, HEAD_SCALE)
  const blink = pose.time % 3.6 < 0.12
  if (dir === 'up') drawHeadBack(ctx)
  else if (dir === 'left') drawHeadSide(ctx, blink, aim)
  else drawHeadFront(ctx, blink, aim)
  ctx.restore()
}

/**
 * 蓬大后发头盔（一整块：比颅骨鼓出一圈，发量感是神韵来源）。
 * 高光用"块"不用线，粗描边贴纸感。
 */
function hairCapShape(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath()
  ctx.moveTo(-9.4, -0.6)
  ctx.quadraticCurveTo(-10.6, -8.6, -4.4, -9.9)
  ctx.quadraticCurveTo(0, -10.6, 4.8, -9.9)
  ctx.quadraticCurveTo(10.4, -8.8, 9.8, -1.6)
  ctx.quadraticCurveTo(10.2, 3.2, 7.8, 5.2)
  ctx.quadraticCurveTo(0, 7.2, -7.8, 5.2)
  ctx.quadraticCurveTo(-10.0, 3.0, -9.4, -0.6)
  ctx.closePath()
  ctx.fillStyle = MAT.hair
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.8
  ctx.stroke()
  // 块面高光（两个浅色大椭圆块，参考图像素语言）
  ctx.fillStyle = MAT.hairHi
  ctx.beginPath()
  ctx.ellipse(-3.2, -9.0, 1.7, 1.0, -0.25, 0, Math.PI * 2)
  ctx.ellipse(2.8, -9.3, 1.35, 0.85, 0.2, 0, Math.PI * 2)
  ctx.fill()
  // 暗部块（发底一排深色，压出头发厚度）
  ctx.fillStyle = MAT.hairDark
  ctx.beginPath()
  ctx.ellipse(0, 4.4, 7.6, 1.5, 0, 0, Math.PI * 2)
  ctx.globalAlpha = 0.5
  ctx.fill()
  ctx.globalAlpha = 1
}

/**
 * 扎束双缕之一（s=-1 左缕 / +1 右缕）：
 * 从耳侧发管扎点往下，束身顺脸侧垂到胸前、末端散开两三个圆卷瓣。
 * clipTop/clipBottom：在头局部系内只绘制该 y 区间（双缕跨头身两层，
 * 脸段在脸下层、胸前段在裙身上层，于脸底 y≈7.5 处接力，接缝被领口遮住）。
 * 注意：左右镜像通过 x*s 直接构造，【绝不使用 ctx.scale(1,-1)】——
 * 否则 clip 矩形会随镜像翻转，左缕胸前段会被裁到头顶上方。
 */
function drawSidelock(ctx: CanvasRenderingContext2D, s: number, clipBottom = 40, clipTop = -40): void {
  ctx.save()
  ctx.beginPath()
  ctx.rect(-14, clipTop, 28, clipBottom - clipTop)
  ctx.clip()
  const X = (x: number): number => s * x
  ctx.beginPath()
  // 束身上外缘：扎点 → 中段外鼓 → 末端
  ctx.moveTo(X(6.2), -1.6)
  ctx.quadraticCurveTo(X(8.6), -0.2, X(8.8), 3.4)
  ctx.quadraticCurveTo(X(9.2), 8.6, X(8.0), 12.4)
  // 两束顺向收尖，减少内扣卷瓣与深黑墨团。
  ctx.quadraticCurveTo(X(8.2), 14.3, X(6.1), 15.3)
  ctx.quadraticCurveTo(X(6.3), 13.9, X(5.8), 13.1)
  ctx.quadraticCurveTo(X(4.5), 14.5, X(3.1), 14.7)
  ctx.quadraticCurveTo(X(3.9), 12.8, X(4.1), 11.8)
  // 束身内缘回到扎点
  ctx.quadraticCurveTo(X(4.4), 9.0, X(5.6), 4.2)
  ctx.quadraticCurveTo(X(6.0), 1.0, X(5.4), -1.4)
  ctx.closePath()
  ctx.fillStyle = MAT.hair
  ctx.fill()
  ctx.strokeStyle = MAT.hairDark
  ctx.lineWidth = 0.65
  ctx.stroke()
  // 束身暗面（内侧一条，表现圆束体积）
  ctx.beginPath()
  ctx.moveTo(X(5.6), 0)
  ctx.quadraticCurveTo(X(4.6), 6.0, X(3.4), 12.6)
  ctx.strokeStyle = MAT.hairDark
  ctx.lineWidth = 1.5
  ctx.globalAlpha = 0.55
  ctx.stroke()
  ctx.globalAlpha = 1
  // 顺着束身铺一段弯曲亮面，避免椭圆高光像贴在头发上的珠子。
  ctx.beginPath()
  ctx.moveTo(X(7.4), 1.5)
  ctx.bezierCurveTo(X(8.6), 4.0, X(8.4), 7.6, X(7.0), 11.4)
  ctx.quadraticCurveTo(X(7.4), 7.0, X(6.8), 3.5)
  ctx.closePath()
  ctx.fillStyle = MAT.hairHi
  ctx.globalAlpha = 0.55
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.restore()
}

/** 侧面耳前扎束缕（基底朝左；近侧一条垂胸前，末端三卷瓣），clip 区间同正面双缕 */
function drawSideSidelock(ctx: CanvasRenderingContext2D, clipBottom = 40, clipTop = -40): void {
  ctx.save()
  ctx.beginPath()
  ctx.rect(-14, clipTop, 28, clipBottom - clipTop)
  ctx.clip()
  ctx.beginPath()
  ctx.moveTo(4.2, -1.4)
  ctx.quadraticCurveTo(5.4, 3.2, 5.0, 7.6)
  ctx.quadraticCurveTo(5.0, 10.8, 4.4, 12.8)
  ctx.quadraticCurveTo(4.5, 14.0, 2.9, 14.5)
  ctx.quadraticCurveTo(3.2, 12.9, 2.6, 12.1)
  ctx.quadraticCurveTo(1.5, 13.6, 0.3, 13.7)
  ctx.quadraticCurveTo(1.1, 12.1, 1.2, 11.0)
  ctx.quadraticCurveTo(1.4, 8.4, 2.4, 3.6)
  ctx.quadraticCurveTo(2.8, 0.4, 3.0, -1.2)
  ctx.closePath()
  ctx.fillStyle = MAT.hair
  ctx.fill()
  ctx.strokeStyle = MAT.hairDark
  ctx.lineWidth = 0.65
  ctx.stroke()
  ctx.fillStyle = MAT.hairHi
  ctx.globalAlpha = 0.55
  ctx.beginPath()
  ctx.moveTo(4.1, 2.0)
  ctx.bezierCurveTo(5.0, 4.6, 4.9, 8.6, 3.5, 11.6)
  ctx.quadraticCurveTo(4.0, 6.5, 3.6, 3.2)
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.restore()
}

/**
 * 双缕胸前段（头画完之后、前层袖子之前调用）：
 * 与头层脸段在 y≈7.5 处接力，保证发缕既在脸下层又能盖在红裙身前。
 */
function drawFrontSidelocks(ctx: CanvasRenderingContext2D, pose: PlayerPose, dir: Dir4): void {
  if (dir === 'up') return
  ctx.save()
  ctx.translate(0, HEAD_Y)
  ctx.rotate(pose.bone.head + Math.PI / 2)
  ctx.scale(HEAD_SCALE, HEAD_SCALE)
  if (dir === 'left') {
    drawSideSidelock(ctx, 40, 7.5)
  } else {
    drawSidelock(ctx, -1, 40, 7.5)
    drawSidelock(ctx, 1, 40, 7.5)
  }
  ctx.restore()
}

/**
 * 头顶大红蝴蝶结：两片大三角翅 + 外缘白色波浪褶边 + 中央结粒。
 * back=true 时位置略下移、翅略大（背面视角）。
 */
function drawBow(ctx: CanvasRenderingContext2D, back = false): void {
  // 头部整体放大 HEAD_SCALE，这里数值略收，最终视觉宽≈与头同宽
  const cy = back ? -9.6 : -10.0
  const spread = back ? 9.4 : 8.9
  const tipY = back ? -15.8 : -15.4
  for (const s of [-1, 1]) {
    // 红翅（根在结粒、尖朝外上，圆底兜回）
    ctx.beginPath()
    ctx.moveTo(-0.4, cy + 0.2)
    ctx.quadraticCurveTo(s * 4.6, cy - 3.2, s * spread, tipY)
    ctx.bezierCurveTo(s * (spread + 1.4), tipY + 2.2, s * (spread + 1.2), cy + 0.7, s * (spread - 0.6), cy + 2.2)
    ctx.quadraticCurveTo(s * 4.7, cy + 1.3, -0.4, cy + 0.2)
    ctx.closePath()
    ctx.fillStyle = MAT.red
    ctx.fill()
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.5
    ctx.stroke()
    // 翅面暗褶（一条内线）
    ctx.beginPath()
    ctx.moveTo(s * 1.2, cy - 0.2)
    ctx.quadraticCurveTo(s * (spread - 2.4), cy - 2.6, s * (spread - 1.4), tipY + 1.6)
    ctx.strokeStyle = MAT.redDark
    ctx.lineWidth = 0.8
    ctx.globalAlpha = 0.7
    ctx.stroke()
    ctx.globalAlpha = 1
    // 连续白色荷叶边替代三个孤立白点，沿红翅外弧排出布料褶瓣。
    ctx.beginPath()
    ctx.moveTo(s * (spread - 0.55), tipY + 0.55)
    for (let i = 0; i < 4; i++) {
      const y0 = tipY + 0.55 + i * 1.7
      ctx.quadraticCurveTo(s * (spread + 0.85), y0 + 0.85, s * (spread - 0.35), y0 + 1.7)
    }
    ctx.lineTo(s * (spread - 1.15), tipY + 7.35)
    ctx.quadraticCurveTo(s * (spread + 0.05), cy - 2.0, s * (spread - 1.25), tipY + 0.65)
    ctx.closePath()
    shape(ctx, MAT.white, INK, 0.4)
  }
  // 中央结粒
  ctx.beginPath()
  ctx.ellipse(0, cy, 1.9, 1.7, 0, 0, Math.PI * 2)
  shape(ctx, MAT.redDark, INK, 1)
  ctx.beginPath()
  ctx.ellipse(-0.4, cy - 0.4, 0.7, 0.5, 0, 0, Math.PI * 2)
  ctx.fillStyle = MAT.redLight
  ctx.fill()
}

/** 一只红白发管（白褶托 + 红筒）；朝向 -1/+1 控制在头部哪侧 */
function drawHairTube(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  // 白色褶边托（小横扇）
  ctx.beginPath()
  ctx.ellipse(x, y + 1.0, 1.6, 1.0, s * 0.15, 0, Math.PI * 2)
  shape(ctx, MAT.white, INK, 0.7)
  // 褶边两小叶
  ctx.strokeStyle = MAT.whiteShade
  ctx.lineWidth = 0.6
  ctx.beginPath()
  ctx.moveTo(x - 1.0, y + 1.0)
  ctx.quadraticCurveTo(x, y + 1.7, x + 1.0, y + 1.0)
  ctx.stroke()
  // 红色筒
  ctx.beginPath()
  ctx.ellipse(x, y - 0.5, 1.05, 1.9, s * 0.12, 0, Math.PI * 2)
  shape(ctx, MAT.red, INK, 0.8)
  // 筒口白圈
  ctx.beginPath()
  ctx.ellipse(x, y - 2.0, 0.85, 0.5, 0, 0, Math.PI * 2)
  ctx.fillStyle = MAT.white
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 0.5
  ctx.stroke()
}

/** 背面头：蓬大后脑棕发（块面）＋ 两侧发管扎点 ＋ 蝴蝶结；双缕垂胸前不可见 */
function drawHeadBack(ctx: CanvasRenderingContext2D): void {
  drawLongHairBack(ctx)
  // 扎点下的束发在背面也有独立外轮廓，不把发饰贴在整片发幕上。
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(s * 7.5, 0.8)
    ctx.bezierCurveTo(s * 10.3, 4.4, s * 10.6, 9.8, s * 9.4, 14.2)
    ctx.quadraticCurveTo(s * 10.5, 16.5, s * 8.3, 18.0)
    ctx.quadraticCurveTo(s * 8.7, 15.7, s * 7.1, 15.0)
    ctx.quadraticCurveTo(s * 6.8, 17.2, s * 5.3, 17.6)
    ctx.bezierCurveTo(s * 7.3, 11.0, s * 6.5, 5.1, s * 7.5, 0.8)
    ctx.closePath()
    shape(ctx, MAT.hair, MAT.hairDark, 0.65)
    ctx.beginPath()
    ctx.moveTo(s * 8.2, 3.0)
    ctx.bezierCurveTo(s * 9.2, 7.5, s * 8.7, 11.0, s * 8.0, 14.0)
    ctx.strokeStyle = MAT.hairHi
    ctx.lineWidth = 0.8
    ctx.stroke()
  }
  // 发管扎点（头左右两侧偏后）
  drawHairTube(ctx, -7.8, 0.6, -1)
  drawHairTube(ctx, 7.8, 0.6, 1)
  // 连续披发覆盖后颈，背面不在发幕中央露肤色。
  // 蝴蝶结（背面也完整可见）
  drawBow(ctx, true)
}

/** 预览页复用正式头壳；候选五官不影响游戏中的默认脸。 */
export function drawReimuFaceCandidate(ctx: CanvasRenderingContext2D, variant: 'A' | 'B' | 'C' | 'D'): void {
  if (!getReimuRigAtlas()) { drawHeadFront(ctx, false, Math.PI / 2, variant); return }
  const expressions = { A: 'neutral', B: 'happy', C: 'hurt', D: 'shy' } as const
  drawReimuCelHead(ctx, 'down', expressions[variant])
}

function drawHeadFront(ctx: CanvasRenderingContext2D, blink: boolean, aim: number, variant?: 'A' | 'B' | 'C' | 'D'): void {
  hairCapShape(ctx)
  // 扎束双缕·脸段（脸下层：胸前段由 drawFrontSidelocks 在裙身上层接力）
  drawSidelock(ctx, -1, 8)
  drawSidelock(ctx, 1, 8)
  // 耳朵（压在发束之上，只露小半圆）
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(s * 7.5, -0.8, 1.2, 1.8, 0, 0, Math.PI * 2)
    shape(ctx, MAT.skin, INK, 1.4)
  }
  // 白瓷脸（馒头形，粗描边）
  ctx.beginPath()
  ctx.moveTo(-7.2, -2.4)
  ctx.quadraticCurveTo(-7.4, -8.6, 0, -8.8)
  ctx.quadraticCurveTo(7.4, -8.6, 7.2, -2.4)
  ctx.quadraticCurveTo(7.0, 4.0, 4.6, 5.7)
  ctx.quadraticCurveTo(0, 7.5, -4.6, 5.7)
  ctx.quadraticCurveTo(-7.0, 4.0, -7.2, -2.4)
  ctx.closePath()
  shape(ctx, MAT.skin, INK, 1.05)
  // 刘海（整块＋下缘错落圆瓣：中央一撮最长到 -2.2，两侧 -3.4，像剪出来的）
  ctx.beginPath()
  ctx.moveTo(-7.8, -2.0)
  ctx.quadraticCurveTo(-8.6, -8.8, -4.1, -9.6)
  ctx.quadraticCurveTo(0, -10.2, 4.3, -9.6)
  ctx.quadraticCurveTo(8.5, -8.6, 8.2, -2.0)
  // 三组顺向大束，浅瓣谷代替密集回钩，棕色发面保持连续。
  ctx.quadraticCurveTo(6.4, -2.8, 5.1, -4.5)
  ctx.quadraticCurveTo(4.5, -2.7, 2.0, -1.6)
  ctx.quadraticCurveTo(2.5, -3.1, 1.4, -4.0)
  ctx.quadraticCurveTo(-0.2, -2.8, -3.9, -2.7)
  ctx.quadraticCurveTo(-3.1, -3.9, -3.4, -4.5)
  ctx.quadraticCurveTo(-5.6, -3.0, -7.8, -2.0)
  ctx.closePath()
  shape(ctx, MAT.hair, MAT.hairDark, 0.55)
  // 明暗顺着分束中心向发尖展开，浅棕亮面与深棕叠压面代替孤立亮点。
  ctx.save()
  ctx.clip()
  ctx.beginPath()
  ctx.moveTo(-1.4, -9.7)
  ctx.bezierCurveTo(-5.6, -9.0, -6.2, -5.6, -7.2, -2.9)
  ctx.quadraticCurveTo(-4.3, -5.0, -3.4, -7.1)
  ctx.quadraticCurveTo(-2.5, -8.5, -1.4, -9.7)
  ctx.moveTo(0.4, -9.5)
  ctx.bezierCurveTo(3.8, -8.4, 3.7, -4.3, 2.0, -2.5)
  ctx.quadraticCurveTo(5.1, -4.5, 4.6, -7.0)
  ctx.quadraticCurveTo(3.0, -9.2, 0.4, -9.5)
  ctx.fillStyle = MAT.hairHi
  ctx.globalAlpha = 0.5
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(1.5, -8.6)
  ctx.quadraticCurveTo(3.9, -5.2, 1.9, -1.6)
  ctx.lineTo(4.5, -2.0)
  ctx.quadraticCurveTo(5.3, -6.0, 1.5, -8.6)
  ctx.moveTo(-3.2, -7.3)
  ctx.quadraticCurveTo(-3.4, -4.3, -5.4, -2.5)
  ctx.lineTo(-2.7, -2.6)
  ctx.quadraticCurveTo(-1.8, -5.2, -3.2, -7.3)
  ctx.fillStyle = MAT.hairDark
  ctx.globalAlpha = 0.3
  ctx.fill()
  ctx.restore()
  // 发管扎点（压住双缕根部，明确"扎束"结构）
  drawHairTube(ctx, -7.6, -1.4, -1)
  drawHairTube(ctx, 7.6, -1.4, 1)
  // 蝴蝶结
  drawBow(ctx, false)

  // —— 五官：眼睛是绝对主角（下移/放大），细弯眉＋粉团腮红，无嘴 ——
  const ox = Math.cos(aim) * 0.4
  const oy = Math.sin(aim) * 0.26
  if (variant || !blink) {
    ctx.save()
    ctx.translate(ox, oy - 0.25)
    drawCandidateEyes(ctx, variant ?? 'B')
    ctx.restore()
  } else {
  // 两眼眼尾朝外，左眼只镜像眼线方向，避免双眼一起向右上挑。
  drawReimuEye(ctx, -3.5 + ox, 1.4 + oy, blink, -1)
  drawReimuEye(ctx, 3.5 + ox, 1.4 + oy, blink, 1)
  // 细眉（内低外高的轻挑眉，走势与上眼线呼应；淡而不断）
  ctx.strokeStyle = MAT.hairDark
  ctx.lineWidth = 0.55
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-5.0, -1.9)
  ctx.quadraticCurveTo(-3.9, -2.3, -2.6, -1.95)
  ctx.moveTo(5.0, -1.9)
  ctx.quadraticCurveTo(3.9, -2.3, 2.6, -1.95)
  ctx.stroke()
  }
  // 粉团腮红（淡粉轻染：若有似无的血色，不能抢眼睛的戏）
  ctx.fillStyle = 'rgba(255,150,172,0.3)'
  ctx.beginPath()
  ctx.ellipse(-5.0, 4.5, 1.55, 0.95, 0, 0, Math.PI * 2)
  ctx.ellipse(5.0, 4.5, 1.55, 0.95, 0, 0, Math.PI * 2)
  ctx.fill()
}

/**
 * 灵梦灵动大眼（v4 杏仁眼：去圆呆——
 *   眼裂横向拉长（宽 ≫ 高），虹膜收小、两侧留出眼白＝眼珠有转动余地的灵气；
 *   上眼线内低外高、眼尾利落上挑＝灵梦的小傲娇，而不是两颗圆弹珠）。
 */
function drawCandidateEyes(ctx: CanvasRenderingContext2D, variant: 'A' | 'B' | 'C' | 'D', side = false): void {
  // 四种眼裂结构，统一使用裁切虹膜、上下色层及同侧光源。
  const spec = {
    A: { width: 2.5, top: -1.3, bottom: 1.9, tilt: -0.35, iris: 1.5, brow: -2.2 },
    B: { width: 2.3, top: -1.65, bottom: 2.1, tilt: 0.0, iris: 1.55, brow: -2.45 },
    C: { width: 2.6, top: -0.85, bottom: 1.7, tilt: -0.6, iris: 1.35, brow: -1.9 },
    D: { width: 2.45, top: -1.4, bottom: 1.8, tilt: 0.2, iris: 1.4, brow: -2.2 }
  }[variant]
  // 朝左侧颜的眼尾位于耳侧（局部右侧），不能沿用正脸左眼的镜像方向。
  for (const s of side ? [1] : [-1, 1]) {
    ctx.save()
    if (!side) ctx.translate(s * 3.5, 1.65)
    ctx.scale(s * (side ? 0.78 : 1), side ? 0.8 : 1)
    const w = spec.width
    const eyePath = (): void => {
      ctx.beginPath()
      ctx.moveTo(-w, 0)
      ctx.bezierCurveTo(-w * 0.55, spec.top, w * 0.5, spec.top, w, spec.tilt)
      ctx.bezierCurveTo(w * 0.65, spec.bottom, -w * 0.65, spec.bottom, -w, 0)
      ctx.closePath()
    }
    eyePath()
    ctx.fillStyle = '#fffaf3'
    ctx.fill()
    ctx.save()
    ctx.clip()
    const iris = ctx.createLinearGradient(0, -1.3, 0, 2.0)
    iris.addColorStop(0, '#542238')
    iris.addColorStop(0.48, '#a63250')
    iris.addColorStop(1, '#ef8790')
    ctx.beginPath()
    ctx.ellipse(0.15, 0.6, spec.iris, 1.95, 0, 0, Math.PI * 2)
    ctx.fillStyle = iris
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(0.15, 0.2, 0.52, 1.0, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#4e2033'
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(-s * 0.48, -0.1, 0.4, 0.48, -s * 0.2, 0, Math.PI * 2)
    ctx.fillStyle = '#fffdf8'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(s * 0.5, 1.2, 0.19, 0, Math.PI * 2)
    ctx.fillStyle = '#ffd9da'
    ctx.fill()
    ctx.restore()
    // 眼线用渐宽的填充面，在外眼角收成尖端。
    ctx.beginPath()
    ctx.moveTo(-w, 0)
    ctx.bezierCurveTo(-w * 0.55, spec.top, w * 0.5, spec.top, w, spec.tilt)
    ctx.lineTo(w + 0.65, spec.tilt - 0.42)
    ctx.quadraticCurveTo(w * 0.5, spec.top - 0.6, -w * 0.55, spec.top - 0.25)
    ctx.quadraticCurveTo(-w * 0.85, -0.35, -w, 0)
    ctx.fillStyle = INK
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(-1.1, spec.brow)
    ctx.quadraticCurveTo(0.2, spec.brow - 0.35, 1.7, spec.brow + spec.tilt * 0.3)
    ctx.strokeStyle = MAT.hairDark
    ctx.lineWidth = 0.45
    ctx.stroke()
    ctx.restore()
  }
}

function drawReimuEye(ctx: CanvasRenderingContext2D, cx: number, cy: number, blink: boolean, outward: number): void {
  if (blink) {
    ctx.beginPath()
    ctx.moveTo(cx - 2.25, cy - 0.3)
    ctx.quadraticCurveTo(cx, cy + 0.6, cx + 2.25, cy - 0.55)
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.6
    ctx.lineCap = 'round'
    ctx.stroke()
    return
  }
  // 眼白（横向杏仁形：宽 2.35 / 高 1.5，不描黑边）
  ctx.beginPath()
  ctx.ellipse(cx, cy + 0.25, 2.35, 1.5, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#fffdf8'
  ctx.fill()
  // 红虹膜（略放大：两侧只留一线眼白，灵动但不怒目瞪眼）
  ctx.beginPath()
  ctx.ellipse(cx, cy + 0.4, 1.58, 1.56, 0, 0, Math.PI * 2)
  ctx.fillStyle = MAT.eye
  ctx.fill()
  // 瞳底浅红块
  ctx.beginPath()
  ctx.ellipse(cx, cy + 0.98, 1.1, 0.8, 0, 0, Math.PI * 2)
  ctx.fillStyle = MAT.redLight
  ctx.globalAlpha = 0.28
  ctx.fill()
  ctx.globalAlpha = 1
  // 深红瞳孔
  ctx.beginPath()
  ctx.ellipse(cx, cy + 0.47, 0.74, 0.86, 0, 0, Math.PI * 2)
  ctx.fillStyle = MAT.eyeDark
  ctx.fill()
  // 双高光：左上大椭圆块 + 右下小圆点
  ctx.beginPath()
  ctx.ellipse(cx - 0.5, cy - 0.28, 0.52, 0.6, -0.3, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx + 0.55, cy + 0.95, 0.26, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,222,226,0.95)'
  ctx.fill()
  // 上眼线：一条平滑拱弧，内眼角低、外眼角轻挑（无折角，避免凶相）
  ctx.beginPath()
  ctx.moveTo(cx - outward * 2.2, cy - 0.55)
  ctx.quadraticCurveTo(cx, cy - 1.85, cx + outward * 2.3, cy - 0.65)
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.0
  ctx.lineCap = 'round'
  ctx.stroke()
  // 眼尾挑线（顺着外眼角轻轻延长，挑度放缓）
  ctx.beginPath()
  ctx.moveTo(cx + outward * 2.3, cy - 0.65)
  ctx.lineTo(cx + outward * 2.7, cy - 0.95)
  ctx.strokeStyle = INK
  ctx.lineWidth = 0.9
  ctx.stroke()
}

/** 侧面头（基底朝左：脸在 x 负、脑后在 x 正；耳前一条扎束发缕垂胸前，无嘴） */
function drawHeadSide(ctx: CanvasRenderingContext2D, blink: boolean, aim: number): void {
  const f = -1
  // 后发（+x 脑后：蓬大块，与身后披发片衔接）
  ctx.beginPath()
  ctx.moveTo(f * 3.6, -7.6)
  ctx.quadraticCurveTo(0.8, -11.6, 5.6, -9.8)
  ctx.quadraticCurveTo(9.4, -8.4, 9.4, -4.0)
  ctx.quadraticCurveTo(9.6, 0.4, 8.0, 2.6)
  ctx.quadraticCurveTo(8.0, 4.4, 5.8, 4.4)
  ctx.quadraticCurveTo(4.6, 5.2, 2.8, 4.6)
  ctx.quadraticCurveTo(2.6, -1.4, f * 3.6, -7.6)
  ctx.closePath()
  ctx.fillStyle = MAT.hair
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.7
  ctx.stroke()
  // 后发块面高光＋暗部
  ctx.fillStyle = MAT.hairHi
  ctx.beginPath()
  ctx.ellipse(6.6, -7.6, 1.2, 0.85, 0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = MAT.hairDark
  ctx.globalAlpha = 0.45
  ctx.beginPath()
  ctx.ellipse(6.6, 3.4, 2.6, 1.2, 0.1, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  // 后脑下缘延伸到肩侧，让披发连接身体而非悬在细颈后面。
  ctx.beginPath()
  ctx.moveTo(7.2, 1.6)
  ctx.bezierCurveTo(10.0, 4.6, 8.4, 11.3, 10.5, 16.8)
  ctx.quadraticCurveTo(11.1, 19.2, 8.6, 21.5)
  ctx.quadraticCurveTo(8.8, 19.0, 6.7, 18.5)
  ctx.quadraticCurveTo(6.4, 21.1, 4.2, 20.1)
  ctx.bezierCurveTo(5.6, 14.0, 3.9, 8.8, 4.2, 2.5)
  ctx.closePath()
  shape(ctx, MAT.hair, INK, 0.9)
  // 侧颈上端插入下巴，下端插入白领，先画再由脸覆盖。
  ctx.beginPath()
  ctx.moveTo(-1.1, 3.5)
  ctx.lineTo(1.9, 3.6)
  ctx.lineTo(2.0, 8.6)
  ctx.lineTo(-1.3, 8.6)
  ctx.closePath()
  shape(ctx, MAT.skin, INK, 0.6)
  ctx.beginPath()
  ctx.moveTo(-2.1, 6.9)
  ctx.lineTo(2.7, 7.1)
  ctx.lineTo(1.3, 9.2)
  ctx.lineTo(-2.0, 8.6)
  ctx.closePath()
  shape(ctx, MAT.white, INK, 0.6)
  // 脸（圆颌 Q 侧颜）
  ctx.beginPath()
  ctx.moveTo(2.2, 3.4)
  ctx.quadraticCurveTo(f * 0.4, 5.6, f * 3.8, 5.0)
  ctx.quadraticCurveTo(f * 5.1, 4.5, f * 5.3, 3.4)
  ctx.quadraticCurveTo(f * 5.4, 2.9, f * 5.2, 2.3)
  ctx.quadraticCurveTo(f * 5.9, 1.4, f * 5.7, 0.6)
  ctx.quadraticCurveTo(f * 5.5, -0.3, f * 5, -1.3)
  ctx.quadraticCurveTo(f * 4.6, -3.6, f * 4.4, -5.5)
  ctx.quadraticCurveTo(f * 3.2, -8.2, f * 1.2, -7.1)
  ctx.quadraticCurveTo(0.6, -6.1, 1.4, -4.5)
  ctx.lineTo(2.2, 3.4)
  ctx.closePath()
  shape(ctx, MAT.skin, INK, 1.6)
  // 耳朵
  ctx.beginPath()
  ctx.ellipse(2.4, -0.4, 1.4, 2.0, 0, 0, Math.PI * 2)
  shape(ctx, MAT.skin, INK, 1.3)
  // 耳前扎束发缕·脸段（胸前段由 drawFrontSidelocks 接力）
  drawSideSidelock(ctx, 8)
  // 斜刘海（盖前额，下缘两片错落圆瓣，块面）
  ctx.beginPath()
  ctx.moveTo(f * 5.2, -2.8)
  ctx.quadraticCurveTo(f * 5.4, -6.2, f * 4.2, -8.0)
  ctx.quadraticCurveTo(f * 2.0, -10.8, 1.4, -10.2)
  ctx.quadraticCurveTo(4.4, -9.8, 5.2, -7.2)
  ctx.quadraticCurveTo(5.6, -5.2, 3.5, -3.0)
  ctx.quadraticCurveTo(3.7, -4.7, 2.5, -5.2)
  ctx.quadraticCurveTo(1.1, -2.9, -1.4, -2.4)
  ctx.quadraticCurveTo(-0.8, -3.8, -1.5, -4.2)
  ctx.quadraticCurveTo(-3.8, -2.8, f * 5.2, -2.8)
  ctx.closePath()
  ctx.fillStyle = MAT.hair
  ctx.fill()
  ctx.strokeStyle = MAT.hairDark
  ctx.lineWidth = 0.6
  ctx.stroke()
  ctx.save()
  ctx.clip()
  ctx.beginPath()
  ctx.moveTo(0.5, -9.8)
  ctx.bezierCurveTo(-3.6, -9.0, -3.8, -5.1, -4.8, -3.1)
  ctx.quadraticCurveTo(-1.8, -4.3, -1.2, -6.5)
  ctx.quadraticCurveTo(-0.7, -8.1, 0.5, -9.8)
  ctx.fillStyle = MAT.hairHi
  ctx.globalAlpha = 0.5
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(2.3, -8.8)
  ctx.quadraticCurveTo(5.0, -5.0, 2.5, -2.6)
  ctx.lineTo(4.8, -3.0)
  ctx.quadraticCurveTo(6.0, -6.6, 2.3, -8.8)
  ctx.fillStyle = MAT.hairDark
  ctx.globalAlpha = 0.35
  ctx.fill()
  ctx.restore()
  // 发管扎点（压住发缕根部）
  drawHairTube(ctx, 5.4, 0.0, 1)
  // 侧身蝴蝶结：近侧一只翅【竖立】在头顶（侧面看蝴蝶结的标准剪影）——
  // 结粒在头顶、翅尖朝天略偏脑后，白褶边沿翅的上外缘弧排；
  // 旧版画成平躺脑后的扁椭圆＋竖直白点，像耳罩，方向错误。
  ctx.save()
  ctx.translate(0.4, -9.8)
  ctx.beginPath()
  ctx.moveTo(-1.0, -0.6) // 翅根前角（贴头顶脸侧）
  ctx.quadraticCurveTo(-0.2, -3.8, 1.6, -5.4) // 前缘上行到翅尖
  ctx.quadraticCurveTo(4.8, -4.6, 4.3, -1.3) // 后缘圆弧兜下
  ctx.quadraticCurveTo(2.4, 0.0, -1.0, -0.6) // 底边回根
  ctx.closePath()
  shape(ctx, MAT.red, INK, 1.4)
  // 褶边 3 个小白瓣：从翅尖沿上外缘向脑后弧排
  const frill: Array<[number, number]> = [
    [2.1, -5.1],
    [3.7, -4.2],
    [4.5, -2.7]
  ]
  for (const [fx2, fy2] of frill) {
    ctx.beginPath()
    ctx.arc(fx2, fy2, 0.62, 0, Math.PI * 2)
    ctx.fillStyle = MAT.white
    ctx.fill()
    ctx.strokeStyle = INK
    ctx.lineWidth = 0.4
    ctx.stroke()
  }
  // 结粒压在翅根
  ctx.beginPath()
  ctx.ellipse(-0.3, -0.5, 1.55, 1.4, 0, 0, Math.PI * 2)
  shape(ctx, MAT.redDark, INK, 1.1)
  ctx.restore()

  // 单只块面红瞳（侧脸中下部，无下睑线，一根眼尾挑线）
  const ox = Math.max(0, -Math.cos(aim)) * 0.3
  const oy = Math.sin(aim) * 0.22
  const ex = f * 3.5 + f * ox
  const ey = 0.5 + oy
  if (blink) {
    ctx.beginPath()
    ctx.moveTo(ex - 1.35, ey - 0.2)
    ctx.quadraticCurveTo(ex, ey + 0.5, ex + 1.35, ey - 0.2)
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.6
    ctx.stroke()
  } else {
    // 侧颜复用 B 眼形，以透视比例压窄；眉形和红瞳层次保持一致。
    ctx.save()
    ctx.translate(ex, ey)
    drawCandidateEyes(ctx, 'B', true)
    ctx.restore()
  }
  if (blink) {
    ctx.strokeStyle = MAT.hairDark
    ctx.lineWidth = 0.45
    ctx.beginPath()
    ctx.moveTo(ex - 1.3, ey - 1.95)
    ctx.quadraticCurveTo(ex - 0.4, ey - 2.2, ex + 0.7, ey - 2.15)
    ctx.stroke()
  }
  // 粉团腮红（淡粉轻染）
  ctx.fillStyle = 'rgba(255,150,172,0.3)'
  ctx.beginPath()
  ctx.ellipse(f * 2.6, 2.9, 1.3, 0.85, 0, 0, Math.PI * 2)
  ctx.fill()
}
