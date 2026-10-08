/**
 * 玩家骨骼绘制入口 · Q 版羽织少年（正式采用 Edit 参考的像素赛璐璐部件）
 *
 * 形象设定（对齐主人给的立绘参考）：
 *   黑色蓬松乱发 + 头顶一根弯呆毛；半垂慵懒眼（粗上眼睑压眼）；
 *   深蓝开襟羽织（宽袖一体、袖口/下摆白色青海波纹），
 *   内搭白 T 恤（胸前黑色抽象图案），黑长裤，白色运动鞋。
 *
 * 正式资源：public/characters/player/character-parts.png，头脸和衣料沿用确认的 Edit 参考。
 *   以下矢量基元仅在资源尚未就绪时作为过渡，不再作为正式美术基准。
 *
 * 层级（脊柱局部系）：
 *   远腿 → 羽织后片（背面/侧） → 远袖 → 近腿 → T恤+羽织前片+躯干 →
 *   头（后发→脸→刘海→呆毛→半垂眼） → 近袖前层（武器挂袖口）
 * right 向以 left 为基底整体镜像，只画 down/up/left 三面。
 * 本文件只消费 {@link PlayerPose} 纯数据，签名与旧积木版完全一致。
 */
import { dirAngle, type Dir4, type PlayerPose } from './skeleton'
import { ARM_RIG, armShoulders } from './handGrip'
import { drawPlayerCelRig, drawPlayerCelHead, getPlayerRigAtlas, type PlayerCelExpression } from './playerCelRig'
export { loadPlayerRigAssets } from './playerCelRig'

/** 深紫黑统一描边色 */
const INK = '#241b2e'

/** 角色色板（主色 + 深一级分面色） */
const MAT = {
  skin: '#ffd9bd',
  skinDark: '#e6b28e',
  hair: '#343044',
  hairHi: '#70647f', // 发束高光采用紫灰色面
  hairDark: '#211c2c',
  haori: '#526ba4', // 羽织主色（柔亮靛蓝）
  haoriDark: '#354775', // 羽织暗面/远肢
  haoriEdge: '#8fa4de', // 衣缘细滚边
  wave: '#dce8ff', // 白色青海波纹
  tee: '#f5f3ee', // T 恤白
  teeShade: '#d9d5cc',
  inkPrint: '#2a2a33', // T 恤胸前黑图案
  pants: '#35313f',
  pantsDark: '#27242f',
  shoe: '#f3f1ec',
  shoeDark: '#c9c5bb',
  eye: '#5d3d2e', // 虹膜棕
  mouth: '#a0625a',
  blush: 'rgba(235,128,110,0.45)'
} as const

/** 比例常量（调参只动这里；世界 px） */
const PELVIS_Y = 6.5 // 骨盆世界 y（原点=碰撞中心）
const HEAD_Y = -14.2 // 头心下收，缩短下巴到衣领的距离
const L_THIGH = 7.4
const L_SHIN = 7.2
const L_UPPER = ARM_RIG.upper
const L_LOWER = ARM_RIG.lower
const W_LEG = 4.6 // 裤管宽
const W_SLEEVE = 4.6 // 羽织宽袖管宽（垂臂合身袖，宽感靠袖口白护；侧身再透视收窄）
// 躯干脊柱系（原点骨盆，+x 朝头顶）关键高度
const X_HIP = -1.6 // 衣摆最低点的身高轴位置（骨盆以下＝大腿根）
const X_ARM = 8.6 // 腋下
const X_SHOULDER = 12.4 // 肩线
const HEM_HALF = 10 // 衣摆外缘横向半宽
const GAP_HALF = 3 // 前片开襟中缝半宽（白 T 露出宽度）

/** 持械手锚点（世界坐标，供外部把武器挂到手部） */
export interface HandAnchor {
  x: number
  y: number
  angle: number
  inFront: boolean
}

export interface RigOptions {
  /** 受伤态采用参考的生气差分；无敌帧闪烁仍由调用方控制透明度。 */
  hurt?: boolean
  /** 显式表情优先于受伤和自动眨眼，可供剧情与预览使用。 */
  expression?: PlayerCelExpression
  /**
   * 武器层内绘制回调：在持械手局部系执行——
   * 原点=手心、+x=小臂指向；自动继承镜像/旋转/前后层，残影不传则无武器。
   */
  drawWeapon?: (ctx: CanvasRenderingContext2D) => void
  /** 副手武器与主手共用层级和手心定位，朝向独立。 */
  drawSupportWeapon?: (ctx: CanvasRenderingContext2D) => void
  /** 腰前附件在衣身之上、双手之下绘制，回调仍使用世界坐标。 */
  drawAccessory?: (ctx: CanvasRenderingContext2D) => void
}

/**
 * 在世界坐标 (x,y) 绘制整个人。
 * @returns 持械手的世界锚点（武器绘制器由此挂载）
 */
export function getPlayerHandAnchor(x: number, y: number, pose: PlayerPose): HandAnchor {
  return playerHandAnchor(x, y, pose, false)
}
export function getPlayerSupportHandAnchor(x: number, y: number, pose: PlayerPose): HandAnchor {
  return playerHandAnchor(x, y, pose, true)
}
function playerHandAnchor(x: number, y: number, pose: PlayerPose, far: boolean): HandAnchor {
  const mirror = pose.dir === 'right'
  const dir = mirror ? 'left' : pose.dir
  const { x: sx, y: sy } = far ? armShoulders(dir).far : armShoulders(dir).near
  const b = pose.bone
  const upper = far ? b.armFarUpper : b.armNearUpper, lower = far ? b.armFarLower : b.armNearLower
  const hx = sx + Math.cos(upper) * L_UPPER + Math.cos(lower) * L_LOWER
  const hy = sy + Math.sin(upper) * L_UPPER + Math.sin(lower) * L_LOWER
  // 锚点必须完整复现根部缩放、旋转和镜像，翻滚时也与实际手心一致。
  const cos = Math.cos(pose.rootRot), sin = Math.sin(pose.rootRot)
  const rx = hx * pose.scaleX * cos - hy * pose.scaleY * sin
  const ry = hx * pose.scaleX * sin + hy * pose.scaleY * cos
  const axis = far ? pose.supportWeaponAngle ?? lower : pose.weaponAngle ?? lower
  const localAngle = Math.atan2(Math.sin(axis) * pose.scaleY, Math.cos(axis) * pose.scaleX) + pose.rootRot
  return { x: x + pose.rootX + (mirror ? -rx : rx), y: y + pose.rootY + ry,
    angle: mirror ? Math.PI - localAngle : localAngle, inFront: pose.weaponInFront }
}

export function drawPlayerRig(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pose: PlayerPose,
  opts: RigOptions = {}
): HandAnchor {
  return getPlayerRigAtlas()
    ? drawPlayerCelRig(ctx, x, y, pose, opts, getPlayerHandAnchor(x, y, pose))
    : drawLegacyPlayerRig(ctx, x, y, pose, opts)
}

/** 资源加载期间保留原绘制，保证角色与武器首帧可见。 */
function drawLegacyPlayerRig(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pose: PlayerPose,
  opts: RigOptions = {}
): HandAnchor {
  const mirror = pose.dir === 'right'
  const drawDir: Dir4 = mirror ? 'left' : pose.dir
  const ma = (a: number): number => (mirror ? Math.PI - a : a)
  const b = pose.bone
  const drawWeapon = opts.drawWeapon && pose.weaponAngle !== undefined ? (g: CanvasRenderingContext2D) => {
    g.save(); g.rotate(pose.weaponAngle! - b.armNearLower); opts.drawWeapon!(g); g.restore()
  } : opts.drawWeapon
  const drawSupportWeapon = opts.drawSupportWeapon && pose.supportWeaponAngle !== undefined ? (g: CanvasRenderingContext2D) => {
    g.save(); g.rotate(pose.supportWeaponAngle! - b.armFarLower); opts.drawSupportWeapon!(g); g.restore()
  } : opts.drawSupportWeapon

  const side = drawDir === 'left'
  const da = dirAngle(drawDir)
  const perpX = Math.cos(da + Math.PI / 2)
  const perpY = Math.sin(da + Math.PI / 2)
  const legGap = side ? 2.2 : 3.6

  // —— 双肩锚点（根局部系）——
  // 正/背面：沿 perp 左右排开；侧身：沿屏幕 x 前后错开（远肩在背侧 +x、近肩在胸前 -x），
  // 并沿 y 上下小错位模拟近大远小，这样两条袖子都不会被躯干整片吃掉。
  const shoulders = armShoulders(drawDir)
  const sxF = shoulders.far.x, syF = shoulders.far.y, sxN = shoulders.near.x, syN = shoulders.near.y
  const twoHanded = (pose.supportGripWeight ?? 0) > 0 && pose.gripInFront !== false
  const drawAccessory = () => {
    if (!opts.drawAccessory) return
    // 撤销人物根变换、保留相机变换，前后层共用同一个世界握点。
    ctx.save(); ctx.scale(1 / pose.scaleX, 1 / pose.scaleY); ctx.rotate(-pose.rootRot)
    if (mirror) ctx.scale(-1, 1)
    ctx.translate(-x - pose.rootX, -y - pose.rootY); opts.drawAccessory(ctx); ctx.restore()
  }

  // —— 持械手锚点：根局部系纯 FK 数学（严禁 getTransform：ctx 上叠着相机变换） ——
  // 骨角统一是"朝左基底局部角"（世界角姿态已在动画端转换），right 朝向位置翻 -x、
  // 角度取 π-a 还原成世界角返回给外部世界系消费者。
  const hand = getPlayerHandAnchor(x, y, pose)

  ctx.save()
  ctx.translate(x + pose.rootX, y + pose.rootY)
  if (mirror) ctx.scale(-1, 1)
  ctx.rotate(pose.rootRot)
  ctx.scale(pose.scaleX, pose.scaleY)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // —— 1. 远侧腿（永远在最底：身后腿可被衣摆遮挡＝正确透视） ——
  // 注意：腿/臂骨角是"朝左基底局部角"，right 朝向只靠根层 scale(-1,1) 单重镜像，
  // 绝不能再经 ma()——否则与 scale 双重翻转互相抵消，前迈会永远落在屏幕固定一侧。
  drawLeg(ctx, perpX * legGap + (side ? 1.2 : 0), PELVIS_Y + perpY * legGap - (side ? 0.3 : 0), b.thighFar, b.shinFar, true)
  // 近腿同样压在衣摆下方；侧面轻微前后错开，保留双鞋辨识。
  drawLeg(ctx, -perpX * legGap - (side ? 0.65 : 0), PELVIS_Y - perpY * legGap, b.thighNear, b.shinNear, false)
  if (pose.gripInFront === false) drawAccessory()

  // 背面袖子先于背片：肩缝由衣身覆盖，不再像从脊背伸出。
  if (drawDir === 'up' && !twoHanded) {
    drawSleeve(ctx, sxF, syF, b.armFarUpper, b.armFarLower, true, drawDir, drawSupportWeapon)
    drawSleeve(ctx, sxN, syN, b.armNearUpper, b.armNearLower, false, drawDir, drawWeapon)
  } else if (side && !twoHanded) {
    drawSleeve(ctx, sxF, syF, b.armFarUpper, b.armFarLower, true, drawDir, drawSupportWeapon, 1)
  }

  // —— 3. 躯干（脊柱局部系，+x 朝头顶） ——
  ctx.save()
  ctx.translate(0, PELVIS_Y)
  ctx.rotate(ma(b.spine))
  drawTorso(ctx, drawDir, pose.cape)
  ctx.restore()


  // —— 4. 头（aim 是世界角，仍需 ma 翻成基底局部角；head 骨角在 drawHead 内直接使用） ——
  drawHead(ctx, pose, drawDir, ma(pose.aim))

  if (pose.gripInFront !== false) drawAccessory()

  // —— 5. 双臂前层（羽织广袖是最外层部件；臂骨角同为局部角，不再 ma）——
  if (side) {
    if (twoHanded) drawSleeve(ctx, sxF, syF, b.armFarUpper, b.armFarLower, true, drawDir, drawSupportWeapon)
    // 侧身：远袖已在底层，这里只画胸前近袖
    drawSleeve(ctx, sxN, syN, b.armNearUpper, b.armNearLower, false, drawDir, drawWeapon)
  } else if (drawDir === 'down' || twoHanded) {
    // 正面：远袖先（另一侧），近袖后（持械，武器回调在其手心局部系）
    drawSleeve(ctx, sxF, syF, b.armFarUpper, b.armFarLower, true, drawDir, drawSupportWeapon)
    drawSleeve(ctx, sxN, syN, b.armNearUpper, b.armNearLower, false, drawDir, drawWeapon)
  }

  ctx.restore()
  return hand
}

// ───────────────────────── 圆润基元 ─────────────────────────

/** 填色 + 描边的闭合形状（路径由调用方在 beginPath 后描述） */
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

/** 圆角矩形 path（x,y 左上；rx 圆角） */
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rx: number): void {
  const r = Math.min(rx, w / 2, h / 2)
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * 两段圆管线（大腿→小腿 / 大臂→小臂）：
 * 粗 stroke 主色 + 偏右下半宽的暗面叠色，关节处自然圆头。
 * 原点在关节，沿骨角伸出；末端返回端点坐标（在调用方的 save 系内）。
 */
function tube(
  ctx: CanvasRenderingContext2D,
  a1: number,
  a2: number,
  l1: number,
  l2: number,
  w: number,
  main: string,
  dark: string,
  endDot?: { r: number; color: string }
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
  // 暗面：同路径偏移 0.9px、宽度减半叠暗一级色（右下光源反方向）
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
  // 裤管内部用冷灰窄亮面分出体积，不再叠宽墨线污染整条腿。
  ctx.save()
  ctx.translate(-0.6, -0.15)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(x1, y1)
  ctx.lineTo(x2 * 0.95, y2 * 0.95)
  ctx.strokeStyle = '#665c73'
  ctx.lineWidth = w * 0.18
  ctx.globalAlpha *= 0.5
  ctx.stroke()
  ctx.restore()
  // 末端（鞋/手）
  if (endDot) {
    ctx.beginPath()
    ctx.ellipse(x2 + Math.cos(a2) * 1.2, y2 + Math.sin(a2) * 1.2, endDot.r, endDot.r * 0.72, a2, 0, Math.PI * 2)
    ctx.fillStyle = endDot.color
    ctx.fill()
    ctx.strokeStyle = INK
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

/** 一条腿：裤管管线 + 白色运动鞋（鞋沿迈步角指向） */
function drawLeg(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  thighA: number,
  shinA: number,
  far: boolean
): void {
  ctx.save()
  ctx.translate(hx, hy)
  // 裤管（末端不画圆点，鞋单独画）
  tube(
    ctx,
    thighA,
    shinA,
    L_THIGH,
    L_SHIN,
    W_LEG,
    far ? MAT.pantsDark : MAT.pants,
    far ? '#1d1a24' : MAT.pantsDark
  )
  // 脚踝位置
  const kx = Math.cos(thighA) * L_THIGH
  const ky = Math.sin(thighA) * L_THIGH
  const ax = kx + Math.cos(shinA) * L_SHIN
  const ay = ky + Math.sin(shinA) * L_SHIN
  // 鞋独立一层：鞋角取大腿/小腿的中分角＝勾脚修正——
  // 屈膝时鞋不沿小腿指向天/后，鞋底始终大致朝下（后蹬点地、前踩落地都自然）
  ctx.save()
  ctx.translate(ax, ay)
  ctx.rotate((thighA + shinA) / 2)
  // 白鞋主体（圆角卵形，够大够白）
  ctx.beginPath()
  ctx.ellipse(1.7, 0, far ? 2.55 : 2.75, far ? 1.65 : 1.85, 0, 0, Math.PI * 2)
  ctx.fillStyle = far ? MAT.shoeDark : MAT.shoe
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 1
  ctx.stroke()
  // 黑鞋底（下沿粗线）
  ctx.beginPath()
  ctx.moveTo(-0.4, 1.1)
  ctx.quadraticCurveTo(1.8, 2.1, 4.0, 1.0)
  ctx.strokeStyle = '#514a60'
  ctx.lineWidth = 0.65
  ctx.stroke()
  // 鞋舌小蓝灰条
  ctx.beginPath()
  ctx.moveTo(0.3, -0.9)
  ctx.lineTo(1.9, -0.6)
  ctx.lineTo(1.5, 0.5)
  ctx.lineTo(0, 0.2)
  ctx.closePath()
  ctx.fillStyle = MAT.haoriEdge
  ctx.fill()
  ctx.restore() // 鞋层
  ctx.restore() // 髋层
}

/**
 * 一条宽袖：羽织袖管整条沿臂骨（宽大臂+小臂一体），袖口露小手。
 * 末端在手心局部系回调绘制武器。
 * hideLevel：0=完整袖口+手；1=只露一小截白袖护（侧身远臂）；2=全藏（背面，袖口朝下不可见）
 */
function drawSleeve(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  upperA: number,
  lowerA: number,
  far: boolean,
  dir: Dir4,
  onHand?: (ctx: CanvasRenderingContext2D) => void,
  hideLevel = 0
): void {
  ctx.save()
  ctx.translate(sx, sy)
  const sideView = dir === 'left'
  // 侧身透视：袖筒侧影收窄三成
  const wSleeve = sideView ? W_SLEEVE * 0.7 : W_SLEEVE
  const x1 = Math.cos(upperA) * L_UPPER
  const y1 = Math.sin(upperA) * L_UPPER
  const ex = x1 + Math.cos(lowerA) * L_LOWER
  const ey = y1 + Math.sin(lowerA) * L_LOWER
  // 广袖用布片外轮廓代替胶囊管线；肘部折面随骨架折转。
  const ux = Math.cos(upperA + Math.PI / 2)
  const uy = Math.sin(upperA + Math.PI / 2)
  const nx = Math.cos(lowerA + Math.PI / 2)
  const ny = Math.sin(lowerA + Math.PI / 2)
  const h = wSleeve * 0.5
  const cuff = h + (sideView ? 0.5 : 1.1)
  ctx.beginPath()
  ctx.moveTo(ux * h, uy * h)
  ctx.quadraticCurveTo(x1 + ux * (h + 0.5), y1 + uy * (h + 0.5), ex + nx * cuff, ey + ny * cuff)
  ctx.quadraticCurveTo(ex + Math.cos(lowerA) * 0.5, ey + Math.sin(lowerA) * 0.5, ex - nx * cuff, ey - ny * cuff)
  ctx.quadraticCurveTo(x1 - ux * (h + 1.2), y1 - uy * (h + 1.2), -ux * h, -uy * h)
  ctx.quadraticCurveTo(-Math.cos(upperA), -Math.sin(upperA), ux * h, uy * h)
  ctx.closePath()
  shape(ctx, MAT.haori, INK, 0.65)
  ctx.save()
  ctx.clip()
  ctx.beginPath()
  ctx.moveTo(-ux * h, -uy * h)
  ctx.lineTo(x1 - ux * (h + 1.2), y1 - uy * (h + 1.2))
  ctx.lineTo(ex - nx * cuff, ey - ny * cuff)
  ctx.lineTo(ex - nx * (cuff - 1), ey - ny * (cuff - 1))
  ctx.quadraticCurveTo(x1, y1, -ux * h, -uy * h)
  ctx.fillStyle = MAT.haoriDark
  ctx.fill()
  ctx.restore()
  // 袖口白色回护：末端小弧片 + 小手
  ctx.save()
  ctx.translate(ex, ey)
  ctx.rotate(lowerA)
  if (hideLevel === 1) {
    // 侧身远臂：只一闪窄白衬里
    ctx.beginPath()
    ctx.ellipse(0.4, 0, 1.15, wSleeve / 2 + 0.1, 0, 0, Math.PI * 2)
    ctx.fillStyle = MAT.haoriEdge
    ctx.globalAlpha *= 0.9
    ctx.fill()
    ctx.globalAlpha /= 0.9
  } else if (hideLevel === 0) {
    ctx.beginPath()
    ctx.ellipse(0.1, 0, 0.65, cuff, 0, 0, Math.PI * 2)
    ctx.fillStyle = far ? MAT.haoriEdge : MAT.wave
    ctx.fill()
    ctx.strokeStyle = INK
    ctx.lineWidth = 0.8
    ctx.stroke()
    // 小手（袖口外只露一点点）
    ctx.beginPath()
    ctx.ellipse(1.9, 0, 1.35, 1.6, 0, 0, Math.PI * 2)
    shape(ctx, MAT.skin, INK, 0.9)
  }
  // 武器在手心局部系（+x=小臂指向）
  if (onHand) onHand(ctx)
  ctx.restore()
  // 袖面青海波纹：正面三道排波；侧身透视只露中线两小拱；背面两袖对称都画
  if (!far || dir !== 'left') {
    const mx = Math.cos(upperA) * L_UPPER * 0.55
    const my = Math.sin(upperA) * L_UPPER * 0.55
    ctx.save()
    ctx.translate(mx, my)
    ctx.rotate(upperA - Math.PI / 2)
    ctx.strokeStyle = MAT.wave
    ctx.lineWidth = 0.45
    ctx.beginPath()
    if (sideView) {
      ctx.moveTo(-1.55, 0.5)
      ctx.arc(-0.9, 0.5, 0.65, Math.PI, Math.PI * 2)
      ctx.moveTo(0.25, 0.5)
      ctx.arc(0.9, 0.5, 0.65, Math.PI, Math.PI * 2)
    } else {
      // 三道小拱＝青海波经典排波（避免两拱连成像数字 3）
      for (const px of [-2, 0, 2]) {
        ctx.moveTo(px - 0.75, 1.7)
        ctx.arc(px, 1.7, 0.75, Math.PI, Math.PI * 2)
      }
    }
    ctx.stroke()
    ctx.restore()
  }
  ctx.restore()
}

// ───────────────────────── 躯干 ─────────────────────────

/**
 * 躯干（脊柱局部系：原点骨盆，+x 朝头顶＝身高轴，+y 角色右＝横向）。
 * 白 T 恤打底 → 羽织两片开襟长前片（衣摆到大腿根）→ 白滚边青海波。
 */
function drawTorso(ctx: CanvasRenderingContext2D, dir: Dir4, sway: number): void {
  const alpha = ctx.globalAlpha
  if (dir === 'left') {
    drawTorsoSide(ctx, sway)
    return
  }
  const fl = sway * 3 // 步态衣摆轻翻飞

  // —— T 恤打底（整内衣；之后被长羽织盖住，只露中缝一条与圆领；下摆延长到大腿根防中缝透空） ——
  ctx.beginPath()
  ctx.moveTo(X_HIP - 0.4, -4.2)
  ctx.lineTo(0, -5.4)
  ctx.lineTo(X_ARM, -6)
  ctx.lineTo(X_SHOULDER, -5.2)
  ctx.lineTo(X_SHOULDER + 0.5, -2)
  ctx.lineTo(X_SHOULDER + 0.5, 2)
  ctx.lineTo(X_SHOULDER, 5.2)
  ctx.lineTo(X_ARM, 6)
  ctx.lineTo(0, 5.4)
  ctx.lineTo(X_HIP - 0.4, 4.2)
  ctx.quadraticCurveTo(X_HIP - 1, 0, X_HIP - 0.4, -4.2)
  ctx.closePath()
  shape(ctx, MAT.tee, INK, 1.1)

  if (dir === 'up') {
    // —— 背面：羽织整片长摆，从后领圆弧直垂到大腿根 ——
    // 后领立到 16.0（插进后发底缘），领座外斜接肩：杜绝头/背片之间露背景
    ctx.beginPath()
    ctx.moveTo(X_SHOULDER + 3, -2.4)
    ctx.quadraticCurveTo(X_SHOULDER + 1.4, -4.7, X_SHOULDER - 0.6, -7.3)
    ctx.bezierCurveTo(8, -7.4, 5, -6.3, 1.6, -6.7)
    ctx.quadraticCurveTo(-0.6, -7.2, X_HIP - 0.8 - fl, -7.7)
    ctx.quadraticCurveTo(X_HIP - 1.7, -3.8, X_HIP - 1.2, 0)
    ctx.quadraticCurveTo(X_HIP - 2.0, 4, X_HIP - 0.7 + fl, 7.7)
    ctx.bezierCurveTo(3, 6.2, 8, 7.2, X_SHOULDER - 0.6, 7.3)
    ctx.quadraticCurveTo(X_SHOULDER + 1.4, 4.7, X_SHOULDER + 3, 2.4)
    ctx.quadraticCurveTo(X_SHOULDER + 3.6, 0, X_SHOULDER + 3, -2.4)
    ctx.closePath()
    shape(ctx, MAT.haori, INK, 0.85)
    ctx.save()
    ctx.clip()
    ctx.beginPath()
    ctx.moveTo(12.2, -5.5)
    ctx.quadraticCurveTo(6, -5, -1, -7)
    ctx.quadraticCurveTo(4, -2.6, 11.5, -3.3)
    ctx.closePath()
    ctx.fillStyle = '#6983bb'
    ctx.fill()
    // 右侧暗面软条
    ctx.beginPath()
    ctx.moveTo(X_SHOULDER, 9.6)
    ctx.quadraticCurveTo(5.6, 6, X_HIP - 1 + fl, HEM_HALF)
    ctx.lineTo(X_HIP - 3.2 + fl, HEM_HALF - 1.4)
    ctx.quadraticCurveTo(3, 4, X_SHOULDER - 1.6, 7.8)
    ctx.closePath()
    ctx.fillStyle = MAT.haoriDark
    ctx.globalAlpha = alpha * 0.7
    ctx.fill()
    ctx.globalAlpha = alpha
    // 后摆白滚边（横跨中缝的圆摆弧）+ 四小弧青海波
    ctx.beginPath()
    ctx.moveTo(X_HIP - 0.8 - fl, -7.7)
    ctx.quadraticCurveTo(X_HIP - 1.7, -3.8, X_HIP - 1.2, 0)
    ctx.quadraticCurveTo(X_HIP - 2.0, 4, X_HIP - 0.7 + fl, 7.7)
    ctx.strokeStyle = MAT.wave
    ctx.lineWidth = 0.5
    ctx.stroke()
    ctx.restore()
    return
  }

  // —— 正面两片开襟长前片 ——
  frontPanel(ctx, 1, fl)
  frontPanel(ctx, -1, fl)
  // 右片（-y＝观众右）暗面窄条
  ctx.beginPath()
  ctx.moveTo(X_SHOULDER - 1, -8.2)
  ctx.quadraticCurveTo(6, -7.6, X_HIP - 0.5 - fl, -8.4)
  ctx.lineTo(X_HIP - 0.4 - fl, -7.4)
  ctx.quadraticCurveTo(4.4, -6.5, X_SHOULDER - 1.8, -7.3)
  ctx.closePath()
  ctx.fillStyle = MAT.haoriDark
  ctx.globalAlpha = alpha * 0.65
  ctx.fill()
  ctx.globalAlpha = alpha
  // 两侧衣摆白滚边
  ctx.strokeStyle = MAT.haoriEdge
  ctx.lineWidth = 0.45
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(X_HIP - 0.2, s * GAP_HALF)
    ctx.quadraticCurveTo(X_HIP - 1.3, s * 5.6, X_HIP - 0.5 + fl * s, s * 8.4)
    ctx.stroke()
  }
  // 下摆仅保留细滚边，纹样集中在袖面，避免零碎弧线越过衣缘。
  // —— T 恤胸前黑色抽象图案（中缝白区内） ——
  ctx.fillStyle = MAT.inkPrint
  ctx.beginPath()
  rr(ctx, 4.6, -1.4, 1.9, 1.5, 0.4)
  ctx.fill()
  ctx.fillRect(4.2, 0.7, 2.5, 1.2)
  ctx.fillRect(5, 2.2, 1, 1.6)
  // —— 肩颈连接：羽织肩领座两片（领座立进后发底缘，杜绝头/衣之间露背景） ——
  // 外下接 T 恤肩外缘(12.2,±5.4)→外弧立到 15.5→内顶 15.8(±1.7 中缝开口)→内下接前片中缝边
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(12.2, s * 5.4)
    ctx.quadraticCurveTo(14.8, s * 5.6, 15.5, s * 2.6)
    ctx.lineTo(15.8, s * 1.7)
    ctx.quadraticCurveTo(15.1, s * 1.2, 13.6, s * 1.5)
    ctx.lineTo(12.6, s * 1.8)
    ctx.closePath()
    shape(ctx, MAT.haori, INK, 1.3)
  }
  // T 恤圆领白条（填中缝开口，顶插入后发，被头发/脸盖住上半）
  ctx.beginPath()
  ctx.ellipse(14.3, 0, 2.7, 1.75, 0, 0, Math.PI * 2)
  shape(ctx, MAT.tee, INK, 0.6)
  // —— 脖子（加高：颈顶插进下巴，被脸盖住，两侧不再露背景楔形缝） ——
  ctx.beginPath()
  ctx.ellipse(14.6, 0, 2.2, 1.4, 0, 0, Math.PI * 2)
  shape(ctx, MAT.skin, INK, 0.9)
  // 领口阴影弧
  ctx.beginPath()
  ctx.moveTo(X_SHOULDER + 0.2, -2.1)
  ctx.quadraticCurveTo(X_SHOULDER - 0.5, 0, X_SHOULDER + 0.2, 2.1)
  ctx.strokeStyle = MAT.teeShade
  ctx.lineWidth = 1.1
  ctx.stroke()
}

/** 羽织正面一片（sgn=+1 画 +y 片；-1 画 -y 镜像） */
function frontPanel(ctx: CanvasRenderingContext2D, sgn: number, fl: number): void {
  const P = (x: number, y: number): [number, number] => [x, sgn * y]
  const mv = (x: number, y: number): void => {
    const p = P(x, y)
    ctx.moveTo(p[0], p[1])
  }
  const qd = (cx: number, cy: number, x: number, y: number): void => {
    const c = P(cx, cy)
    const p = P(x, y)
    ctx.quadraticCurveTo(c[0], c[1], p[0], p[1])
  }
  const ln = (x: number, y: number): void => {
    const p = P(x, y)
    ctx.lineTo(p[0], p[1])
  }
  const fly = sgn * fl // 两片步态轻翻方向相反
  ctx.beginPath()
  mv(X_SHOULDER, GAP_HALF - 1.2)
  qd(X_SHOULDER + 0.1, 5.8, X_SHOULDER - 1, 8.2)
  qd(7.4, 8.3, 3.5, 7.6)
  qd(0.4, 7.8, X_HIP - 0.5 + fly, 8.4)
  qd(X_HIP - 1.3, 5.6, X_HIP - 0.2, GAP_HALF)
  ln(X_ARM - 0.6, GAP_HALF - 0.5)
  qd(X_ARM + 1.6, GAP_HALF - 1.1, X_SHOULDER, GAP_HALF - 1.2)
  ctx.closePath()
  shape(ctx, MAT.haori, INK, 0.75)
  // 前襟窄亮面顺肩落向衣摆，表现布料厚度而不是黑色接缝。
  ctx.beginPath()
  mv(X_SHOULDER - 0.2, GAP_HALF - 1)
  qd(8, GAP_HALF - 0.8, X_HIP - 0.2, GAP_HALF)
  ln(X_HIP, GAP_HALF + 0.8)
  qd(7, GAP_HALF + 0.6, X_SHOULDER - 0.2, GAP_HALF - 1)
  ctx.closePath()
  ctx.fillStyle = MAT.haoriEdge
  ctx.fill()
  ctx.beginPath()
  mv(10.8, 5.3)
  qd(7, 5.1, 1, 7.1)
  qd(7, 6.6, 10.8, 5.3)
  ctx.fillStyle = '#6983bb'
  ctx.fill()
}

/** 侧视躯干（基底朝左，身前＝-y，身后＝+y）：侧身透视压扁到正面的六成厚 */
function drawTorsoSide(ctx: CanvasRenderingContext2D, sway: number): void {
  const alpha = ctx.globalAlpha
  const fl = sway * 2.2 // 后摆步态飘量
  // T 恤：身前（-y）窄胸块
  ctx.beginPath()
  ctx.moveTo(1, -3.6)
  ctx.lineTo(X_ARM + 0.6, -4.2)
  ctx.lineTo(X_SHOULDER, -3.6)
  ctx.lineTo(11.2, -1.4)
  ctx.lineTo(0.6, -1.2)
  ctx.quadraticCurveTo(0, -2.4, 1, -3.6)
  ctx.closePath()
  shape(ctx, MAT.tee, INK, 1)
  // 羽织侧身：前襟（身前 -y）长垂、后摆（+y）步态微飘；整体 y 向厚度压扁
  ctx.beginPath()
  ctx.moveTo(X_SHOULDER + 0.4, -3.6) // 前肩/领
  ctx.quadraticCurveTo(X_SHOULDER + 0.6, -0.6, X_SHOULDER - 0.6, 4.2) // 肩过到后背
  ctx.lineTo(7.4, 5.4) // 后背收腰
  ctx.quadraticCurveTo(2.4, 6.6 + fl, X_HIP - 1.2 + fl, 4.8) // 后摆外飘
  ctx.quadraticCurveTo(X_HIP - 2, 0.5, X_HIP - 0.4, -3.8) // 圆摆过底→前摆
  ctx.quadraticCurveTo(5, -4.4, X_ARM + 1, -4) // 前襟线上来
  ctx.closePath()
  shape(ctx, MAT.haori, INK, 0.85)
  ctx.beginPath()
  ctx.moveTo(11.7, -3.2)
  ctx.quadraticCurveTo(5, -3.6, -1.8, -3)
  ctx.lineTo(-1.8, -2.1)
  ctx.quadraticCurveTo(5, -2.7, 11.7, -3.2)
  ctx.closePath()
  ctx.fillStyle = MAT.haoriEdge
  ctx.fill()
  // 后缘暗面
  ctx.beginPath()
  ctx.moveTo(X_SHOULDER - 0.6, 4.2)
  ctx.lineTo(7.4, 5.4)
  ctx.quadraticCurveTo(2.4, 6.6 + fl, X_HIP - 1.2 + fl, 4.8)
  ctx.lineTo(X_HIP - 2.4 + fl, 4.2)
  ctx.quadraticCurveTo(3.4, 5, 8.2, 4)
  ctx.closePath()
  ctx.fillStyle = MAT.haoriDark
  ctx.globalAlpha = alpha * 0.7
  ctx.fill()
  ctx.globalAlpha = alpha
  // 圆摆白滚边（后摆→前摆）
  ctx.beginPath()
  ctx.moveTo(X_HIP - 1.2 + fl, 4.8)
  ctx.quadraticCurveTo(X_HIP - 2.2, 0.4, X_HIP - 0.4, -3.8)
  ctx.strokeStyle = MAT.haoriEdge
  ctx.lineWidth = 0.45
  ctx.stroke()

  // 胸前黑图案两小笔
  ctx.fillStyle = MAT.inkPrint
  ctx.fillRect(3.4, -2.8, 2.4, 1.2)
  ctx.fillRect(3.9, -1.6, 1.6, 1.1)
  // 侧颈＋立领（头与衣之间不能露背景楔形空隙）：
  // 后立领（羽织暗蓝，顶部藏进后发）→ 前 T 领白弧 → 肤色颈柱压在两领交界
  ctx.beginPath()
  ctx.ellipse(14.7, 1.15, 2.5, 1.35, 0.12, 0, Math.PI * 2)
  shape(ctx, MAT.haoriDark, INK, 1)
  ctx.beginPath()
  ctx.ellipse(13.9, -1.55, 1.7, 0.95, -0.12, 0, Math.PI * 2)
  shape(ctx, MAT.tee, INK, 0.8)
  ctx.beginPath()
  ctx.ellipse(14.5, 0.4, 2.5, 1.2, 0, 0, Math.PI * 2)
  shape(ctx, MAT.skin, INK, 0.9)
}

// ───────────────────────── 头 ─────────────────────────

/**
 * 头（head 世界角 + π/2 得屏幕系，+y 朝下）。
 * 后发大蓬团 → 圆颌脸 → 多瓣蓬松刘海 → 弯呆毛 → 半垂慵懒眼。
 */
function drawHead(ctx: CanvasRenderingContext2D, pose: PlayerPose, dir: Dir4, aim: number): void {
  ctx.save()
  ctx.translate(0, HEAD_Y)
  ctx.rotate(pose.bone.head + Math.PI / 2)

  const blink = pose.time % 3.6 < 0.12
  const hairSway = pose.hair

  if (dir === 'up') {
    drawHeadBack(ctx, hairSway)
  } else if (dir === 'left') {
    ctx.translate(-0.6, 1.7)
    drawHeadSide(ctx, blink, aim, hairSway)
  } else {
    drawHeadFront(ctx, blink, aim, hairSway)
  }

  ctx.restore()
}

/** 头部预览采用确认的默认、开心、生气与害羞差分；加载期间显示原候选。 */
export function drawPlayerFaceCandidate(ctx: CanvasRenderingContext2D, variant: 'A' | 'B' | 'C' | 'D', blink = false, aim = Math.PI / 2, sway = 0): void {
  if (getPlayerRigAtlas()) {
    const expressions = { A: 'neutral', B: 'happy', C: 'angry', D: 'shy' } as const
    drawPlayerCelHead(ctx, 'down', blink ? 'blink' : expressions[variant])
    return
  }
  const alpha = ctx.globalAlpha
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  // 后发外轮廓：少量外翘大束维持蓬松感，避免等距锯齿。
  ctx.beginPath()
  ctx.moveTo(-9.0, 1.0)
  ctx.lineTo(-10.5, -0.8)
  ctx.lineTo(-9.1, -1.5)
  ctx.quadraticCurveTo(-10.5, -5.0, -8.0, -7.5)
  ctx.lineTo(-10.2, -7.8)
  ctx.quadraticCurveTo(-6.7, -11.1, -3.0, -10.6)
  ctx.quadraticCurveTo(1.0, -12.3, 5.3, -10.5)
  ctx.lineTo(7.1, -11.1)
  ctx.lineTo(6.8, -9.5)
  ctx.quadraticCurveTo(10.2, -7.5, 9.3, -4.2)
  ctx.lineTo(10.6, -3.4)
  ctx.lineTo(9.2, -2.4)
  ctx.lineTo(10.1, 0.2)
  ctx.lineTo(8.6, 0.0)
  ctx.quadraticCurveTo(8.8, 4.4, 6.1, 6.6)
  ctx.lineTo(5.5, 5.0)
  ctx.lineTo(-5.4, 5.0)
  ctx.lineTo(-7.1, 6.4)
  ctx.closePath()
  shape(ctx, '#343044', INK, 0.9)
  // 脸形统一，四案只比较眉眼，不通过换脸壳制造差异。
  ctx.beginPath()
  ctx.moveTo(-6.9, -2.7)
  ctx.quadraticCurveTo(-6.9, -7.8, 0, -8.2)
  ctx.quadraticCurveTo(6.9, -7.8, 6.9, -2.7)
  ctx.quadraticCurveTo(6.7, 3.5, 4.2, 5.4)
  ctx.quadraticCurveTo(0, 7.0, -4.2, 5.4)
  ctx.quadraticCurveTo(-6.7, 3.5, -6.9, -2.7)
  ctx.closePath()
  shape(ctx, MAT.skin, INK, 0.7)
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(s * 6.8, -0.1, 1.0, 1.45, s * 0.1, 0, Math.PI * 2)
    shape(ctx, MAT.skin, INK, 0.6)
  }
  // 刘海从偏侧发旋落下，中央长束落在两眼之间。
  ctx.beginPath()
  ctx.moveTo(-8.0, 0.6)
  ctx.bezierCurveTo(-8.7, -5.6, -7.0, -9.8, -2.0, -10.7)
  ctx.quadraticCurveTo(3.3, -11.5, 7.7, -7.5)
  ctx.quadraticCurveTo(9.2, -3.9, 7.4, 1.3)
  ctx.quadraticCurveTo(6.1, 0.4, 5.7, -1.9)
  ctx.quadraticCurveTo(4.9, -1.0, 4.2, -0.5)
  ctx.quadraticCurveTo(4.8, -3.9, 3.2, -5.4)
  ctx.quadraticCurveTo(3.3, -0.9, 0.5, 0.3)
  ctx.quadraticCurveTo(1.0, -2.1, -0.8, -3.8)
  ctx.quadraticCurveTo(-1.6, -1.2, -4.6, -0.8)
  ctx.quadraticCurveTo(-3.7, -3.0, -4.5, -4.4)
  ctx.quadraticCurveTo(-6.0, -0.8, -8.0, 0.6)
  ctx.closePath()
  shape(ctx, '#343044', '#252032', 0.55)
  ctx.save()
  ctx.clip()
  ctx.beginPath()
  ctx.moveTo(-0.8, -10.5)
  ctx.bezierCurveTo(-5.1, -9.3, -6.0, -6.0, -6.7, -2.0)
  ctx.quadraticCurveTo(-3.7, -4.0, -3.2, -6.8)
  ctx.quadraticCurveTo(-2.4, -9.0, -0.8, -10.5)
  ctx.moveTo(0.1, -9.8)
  ctx.bezierCurveTo(3.5, -8.3, 3.1, -4.0, 1.4, -1.1)
  ctx.quadraticCurveTo(4.7, -3.8, 4.1, -6.9)
  ctx.quadraticCurveTo(2.7, -9.3, 0.1, -9.8)
  ctx.fillStyle = '#70647f'
  ctx.globalAlpha = alpha * 0.55
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(3.0, -8.5)
  ctx.quadraticCurveTo(6.1, -5.5, 5.6, -0.4)
  ctx.lineTo(7.5, 1.5)
  ctx.quadraticCurveTo(8.5, -5.0, 3.0, -8.5)
  ctx.fillStyle = '#211c2c'
  ctx.globalAlpha = alpha * 0.6
  ctx.fill()
  ctx.restore()
  // 扁片呆毛替代粗线末端圆点。
  ctx.beginPath()
  ctx.moveTo(sway * 0.3, -10.3)
  ctx.quadraticCurveTo(1.4 + sway, -13.4, -2.7 + sway, -14.1)
  ctx.quadraticCurveTo(2.9 + sway, -15.0, 1.9 + sway * 0.3, -10.2)
  ctx.closePath()
  shape(ctx, '#343044', INK, 0.5)
  const spec = {
    A: { w: 2.15, top: -1.35, bottom: 1.65, tilt: 0.0, iris: 1.25 },
    B: { w: 2.3, top: -0.65, bottom: 1.55, tilt: -0.12, iris: 1.2 },
    C: { w: 2.1, top: -1.7, bottom: 1.85, tilt: 0.12, iris: 1.3 },
    D: { w: 2.35, top: -0.95, bottom: 1.5, tilt: -0.45, iris: 1.15 }
  }[variant]
  for (const s of [-1, 1]) {
    ctx.save()
    ctx.translate(s * 3.25, 1.0)
    ctx.scale(s, 1)
    if (blink) {
      ctx.beginPath()
      ctx.moveTo(-spec.w, 0)
      ctx.quadraticCurveTo(0, 0.55, spec.w, 0)
      ctx.strokeStyle = INK
      ctx.lineWidth = 0.6
      ctx.stroke()
      ctx.restore()
      continue
    }
    ctx.beginPath()
    ctx.moveTo(-spec.w, 0)
    ctx.bezierCurveTo(-1.2, spec.top, 1.1, spec.top, spec.w, spec.tilt)
    ctx.bezierCurveTo(1.4, spec.bottom, -1.4, spec.bottom, -spec.w, 0)
    ctx.closePath()
    ctx.fillStyle = '#fffaf4'
    ctx.fill()
    ctx.save()
    ctx.clip()
    const grad = ctx.createLinearGradient(0, -1.0, 0, 1.9)
    grad.addColorStop(0, '#302338')
    grad.addColorStop(0.55, '#655064')
    grad.addColorStop(1, '#b28987')
    ctx.beginPath()
    ctx.ellipse(Math.cos(aim) * s * 0.24, 0.5 + Math.sin(aim) * 0.08, spec.iris, 1.75, 0, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(0, 0.3, 0.42, 0.8, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#2c2032'
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(-s * 0.4, -0.05, 0.33, 0.4, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#fffefa'
    ctx.fill()
    ctx.restore()
    ctx.beginPath()
    ctx.moveTo(-spec.w, 0)
    ctx.bezierCurveTo(-1.2, spec.top, 1.1, spec.top, spec.w, spec.tilt)
    ctx.lineTo(spec.w + 0.4, spec.tilt - 0.26)
    ctx.quadraticCurveTo(0.7, spec.top - 0.4, -1.3, spec.top - 0.15)
    ctx.quadraticCurveTo(-1.9, -0.3, -spec.w, 0)
    ctx.fillStyle = INK
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(-1.1, -1.9)
    ctx.quadraticCurveTo(0.0, -2.15, 1.4, -1.95 + spec.tilt)
    ctx.strokeStyle = '#544454'
    ctx.lineWidth = 0.4
    ctx.stroke()
    ctx.restore()
  }
  ctx.beginPath()
  ctx.ellipse(-4.8, 3.6, 1.3, 0.65, 0, 0, Math.PI * 2)
  ctx.ellipse(4.8, 3.6, 1.3, 0.65, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(246,153,165,0.22)'
  ctx.fill()
  ctx.restore()
}

/** 蓬团后发（三面共用底形：宽于脸的不规则圆，两侧垂到颈） */
function hairBackShape(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath()
  ctx.moveTo(-9.0, 1)
  ctx.lineTo(-10.5, -0.8)
  ctx.lineTo(-9.1, -1.5)
  ctx.quadraticCurveTo(-10.5, -5, -8, -7.5)
  ctx.lineTo(-10.2, -7.8)
  ctx.quadraticCurveTo(-6.7, -11.1, -3, -10.6)
  ctx.quadraticCurveTo(1, -12.3, 5.3, -10.5)
  ctx.lineTo(7.1, -11.1)
  ctx.lineTo(6.8, -9.5)
  ctx.quadraticCurveTo(10.2, -7.5, 9.3, -4.2)
  ctx.lineTo(10.6, -3.4)
  ctx.lineTo(9.2, -2.4)
  ctx.lineTo(10.1, 0.2)
  ctx.lineTo(8.6, 0)
  ctx.quadraticCurveTo(8.8, 4.4, 6.1, 6.6)
  ctx.lineTo(5.5, 5)
  ctx.quadraticCurveTo(2.8, 7.2, 1.2, 5.9)
  ctx.lineTo(-0.7, 7)
  ctx.lineTo(-2, 5.9)
  ctx.lineTo(-4.6, 6.6)
  ctx.lineTo(-5.4, 5)
  ctx.lineTo(-7.1, 6.4)
  ctx.closePath()
  shape(ctx, MAT.hair, INK, 0.85)
}

/** 头顶弯呆毛（从头顶耸起再弯向尖；随 hairSway 轻摆） */
function ahoge(ctx: CanvasRenderingContext2D, sway: number): void {
  ctx.beginPath()
  ctx.moveTo(sway * 0.3, -10.3)
  ctx.quadraticCurveTo(1.4 + sway, -13.4, -2.7 + sway, -14.1)
  ctx.quadraticCurveTo(2.9 + sway, -15, 1.9 + sway * 0.3, -10.2)
  ctx.closePath()
  shape(ctx, MAT.hair, INK, 0.5)
}

/** 背面头：整团后发 + 几束冷紫高光 + 发底参差 + 呆毛 */
function drawHeadBack(ctx: CanvasRenderingContext2D, sway: number): void {
  hairBackShape(ctx)
  // 发旋向两侧散开，亮面随发束收窄，不画贯穿竖线。
  ctx.beginPath()
  ctx.moveTo(-0.6, -10.2)
  ctx.bezierCurveTo(-5.8, -8.8, -7.4, -4.1, -6.2, 1.8)
  ctx.quadraticCurveTo(-4.3, -1.2, -4.8, -4.8)
  ctx.quadraticCurveTo(-3.3, -8.3, -0.6, -10.2)
  ctx.moveTo(0.2, -9.9)
  ctx.bezierCurveTo(4.5, -8.8, 6.7, -4.2, 5.8, 2.2)
  ctx.quadraticCurveTo(8.3, -1.7, 6.7, -5.6)
  ctx.quadraticCurveTo(4.5, -9.3, 0.2, -9.9)
  ctx.fillStyle = MAT.hairHi
  ctx.globalAlpha *= 0.5
  ctx.fill()
  ctx.globalAlpha /= 0.5
  ahoge(ctx, sway)
}

/**
 * 正面头：后发 → 圆脸 → 鬓发两缕 → 蓬松刘海（多瓣圆弧齿）→
 * 呆毛 → 半垂眼（粗上眼睑+棕虹膜+高光）→ 腮红 → 小嘴。
 */
function drawHeadFront(
  ctx: CanvasRenderingContext2D,
  blink: boolean,
  aim: number,
  sway: number
): void {
  drawPlayerFaceCandidate(ctx, 'A', blink, aim, sway)
}

/**
 * 半垂慵懒眼：平直粗上眼睑轻压虹膜上部，棕色虹膜 + 白色小高光仍然清晰可见。
 * 眨眼时只剩一条上挑线。
 */
function drawPlayerSideEye(ctx: CanvasRenderingContext2D, cx: number, cy: number, blink: boolean): void {
  ctx.save()
  ctx.translate(cx, cy)
  if (blink) {
    ctx.beginPath()
    ctx.moveTo(-1.35, 0)
    ctx.quadraticCurveTo(0, 0.5, 1.35, 0)
    ctx.strokeStyle = INK
    ctx.lineWidth = 0.55
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.moveTo(-1.35, 0)
    ctx.bezierCurveTo(-0.8, -1.05, 0.8, -1.2, 1.5, -0.05)
    ctx.bezierCurveTo(0.7, 1.35, -0.8, 1.2, -1.35, 0)
    ctx.closePath()
    ctx.fillStyle = '#fffaf4'
    ctx.fill()
    ctx.save()
    ctx.clip()
    const grad = ctx.createLinearGradient(0, -1, 0, 1.3)
    grad.addColorStop(0, '#302338')
    grad.addColorStop(0.6, '#655064')
    grad.addColorStop(1, '#b28987')
    ctx.beginPath()
    ctx.ellipse(-0.2, 0.3, 0.85, 1.35, 0, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(-0.2, 0.2, 0.3, 0.6, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#2c2032'
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(-0.45, -0.1, 0.24, 0.3, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#fffefa'
    ctx.fill()
    ctx.restore()
    ctx.beginPath()
    ctx.moveTo(-1.35, 0)
    ctx.bezierCurveTo(-0.8, -1.05, 0.8, -1.2, 1.5, -0.05)
    ctx.lineTo(1.8, -0.25)
    ctx.bezierCurveTo(0.7, -1.55, -0.8, -1.25, -1.35, 0)
    ctx.fillStyle = INK
    ctx.fill()
  }
  ctx.restore()
}

/**
 * 侧面头（基底朝左，脸＝-y；右向由外层镜像）。
 * 真侧颜：后发蓬团 → 耳（头心水平面）→ 额/鼻梁/鼻尖/嘴/下巴一条连续侧颜线
 * → 额前斜刘海 → 单只半垂眼。
 */
function drawHeadSide(
  ctx: CanvasRenderingContext2D,
  blink: boolean,
  aim: number,
  sway: number
): void {
  const f = -1 // 面朝 -y

  // —— 后发蓬团（+y 身后：蓬厚后脑勺＋两缕外翘发梢，发量要足，忌贴脑寸头） ——
  ctx.beginPath()
  ctx.moveTo(f * 3.6, -7.4)
  ctx.quadraticCurveTo(0.4, -11.4, 5.6, -9.8)
  ctx.quadraticCurveTo(8.8, -8.8, 9.2, -4.6) // 脑后最蓬点
  ctx.quadraticCurveTo(9.6, -0.4, 8.4, 2.6) // 后翘发梢上缘
  ctx.quadraticCurveTo(8.8, 4.4, 6.4, 4.2) // 发梢尖
  ctx.quadraticCurveTo(5.8, 5.6, 3.6, 5.2) // 第二缕
  ctx.quadraticCurveTo(2, 4.6, 1.4, 3.4)
  ctx.quadraticCurveTo(2.6, -1.2, f * 3.6, -7.4)
  ctx.closePath()
  shape(ctx, MAT.hair, INK, 1.3)

  // —— 脸：奶膨膨 Q 圆侧脸（凸额头＋圆钝小鼻子只做一点凸起；圆下巴；忌钩鼻/精明相） ——
  ctx.beginPath()
  ctx.moveTo(2.1, 2.8)
  ctx.quadraticCurveTo(0.6, 5.0, -2.2, 5.1)
  ctx.quadraticCurveTo(-4.2, 5.0, -4.7, 3.5)
  ctx.quadraticCurveTo(-5.1, 2.4, -4.8, 1.5)
  // 鼻尖只比面颊外突少许，不形成长鼻梁和成人嘴周凹陷。
  ctx.quadraticCurveTo(-5.5, 0.9, -5.1, 0.4)
  ctx.quadraticCurveTo(-4.7, 0.0, -4.8, -1.1)
  ctx.quadraticCurveTo(-5.0, -4.0, -4.3, -5.6)
  ctx.quadraticCurveTo(-3.0, -7.8, -1.0, -7.0)
  ctx.quadraticCurveTo(1.2, -5.3, 2.1, 2.8)
  ctx.closePath()
  shape(ctx, MAT.skin, INK, 0.65)

  // —— 耳朵（侧脸唯一一只，头心水平面偏后） ——
  ctx.beginPath()
  ctx.ellipse(2.2, -0.4, 1.4, 2.1, 0, 0, Math.PI * 2)
  shape(ctx, MAT.skin, INK, 1)
  ctx.beginPath()
  ctx.arc(2.3, -0.2, 0.75, -0.4, 2.6)
  ctx.strokeStyle = MAT.skinDark
  ctx.lineWidth = 0.7
  ctx.stroke()

  // 侧刘海分成三个顺向发束，耳前留短鬓角，避免平直头盔边。
  ctx.beginPath()
  ctx.moveTo(-6.1, -1.4)
  ctx.quadraticCurveTo(-7.3, -5.6, -4.5, -8.9)
  ctx.lineTo(-5.7, -9.1)
  ctx.quadraticCurveTo(-1.6, -12, 3.3, -10.1)
  ctx.quadraticCurveTo(6.3, -8.2, 5.3, -4.6)
  ctx.quadraticCurveTo(4.7, -3.8, 3.1, -3.7)
  ctx.quadraticCurveTo(2.4, -1.7, 1.2, 0.3)
  ctx.quadraticCurveTo(0.2, -1.3, 0.7, -3.1)
  ctx.quadraticCurveTo(-0.2, -2.1, -1.9, -1.6)
  ctx.quadraticCurveTo(-0.9, -4, -1.9, -5.1)
  ctx.quadraticCurveTo(-3.4, -1.8, -4.5, -1)
  ctx.quadraticCurveTo(-4.2, -3.3, -4.5, -4.2)
  ctx.quadraticCurveTo(-5.1, -2.2, -6.1, -1.4)
  ctx.closePath()
  shape(ctx, MAT.hair, INK, 0.65)
  // 侧面亮束沿额前弧度下落，与正面偏侧发旋一致。
  ctx.beginPath()
  ctx.moveTo(0.5, -9.7)
  ctx.bezierCurveTo(-3.8, -9.1, -4.8, -6.7, -4.8, -3.8)
  ctx.quadraticCurveTo(-2.9, -5.2, -2.8, -6.8)
  ctx.quadraticCurveTo(-1.8, -8.7, 0.5, -9.7)
  ctx.moveTo(2.6, -9.1)
  ctx.quadraticCurveTo(7.5, -7.8, 7.5, -2.2)
  ctx.quadraticCurveTo(8.8, -5.7, 6.1, -8.1)
  ctx.quadraticCurveTo(4.7, -9.1, 2.6, -9.1)
  ctx.fillStyle = MAT.hairHi
  ctx.globalAlpha *= 0.5
  ctx.fill()
  ctx.globalAlpha /= 0.5
  ahoge(ctx, sway)

  // —— 单只半垂眼（与正脸同款慵懒小眼：扁窄、上眼睑压虹膜，忌圆瞪娃娃眼） ——
  const ox = Math.max(0, -Math.cos(aim)) * 0.3
  const oy = Math.sin(aim) * 0.22
  const ex = -2.65 - ox * 0.5
  const ey = -0.05 + oy
  drawPlayerSideEye(ctx, ex, ey, blink)
  // 眉（短而平，去掉斜挑凶相）
  ctx.strokeStyle = MAT.hairDark
  ctx.lineWidth = 0.35
  ctx.beginPath()
  ctx.moveTo(ex - 0.7, ey - 2.05)
  ctx.quadraticCurveTo(ex, ey - 2.25, ex + 0.65, ey - 2.05)
  ctx.stroke()
  // 腮红（大片椭圆：奶气）+ 内嵌小嘴（一个小倒心/圆点＋下弧，不画在轮廓上）
  ctx.fillStyle = MAT.blush
  ctx.beginPath()
  ctx.ellipse(f * 2.7, 1.7, 1.25, 0.85, 0, 0, Math.PI * 2)
  ctx.fill()

}
