import { lerpAngle, type Dir4, type PlayerPose } from './skeleton'
import type { ReimuHandAnchor, ReimuRigOptions } from './reimuRig'

export type ReimuCelExpression = 'neutral' | 'happy' | 'hurt' | 'shy' | 'speaking' | 'blink'
export const reimuHeadAtlas = { width: 160, height: 176, columns: 6, rows: 3, scale: 4 } as const
export const reimuCelExpressions: readonly ReimuCelExpression[] = ['neutral', 'happy', 'hurt', 'shy', 'speaking', 'blink']
export const reimuBodyAtlas = { top: 528, width: 64, height: 96, columns: 6, scale: 2 } as const
export const reimuBodyParts = { front: 0, side: 1, back: 2, upperArm: 3, sleeve: 4, thigh: 5, shin: 6, shoe: 7, sideShoe: 8, hairFront: 9, hairSide: 10 } as const
let image: HTMLImageElement | undefined
let loading: Promise<boolean> | undefined
let prayerImage: HTMLImageElement | undefined
let prayerLoading: Promise<boolean> | undefined

/** 祈祷表情与合掌独立裁片按需加载，不改变场景角色的眨眼资源。 */
export function loadReimuPrayerAssets(): Promise<boolean> {
  if (prayerLoading) return prayerLoading
  if (typeof Image === 'undefined') return Promise.resolve(false)
  const details = new Promise<boolean>(resolve => {
    const target = new Image(); prayerImage = target
    const ready = () => target.naturalWidth === 160 && target.naturalHeight === 216
    target.onload = () => resolve(ready()); target.onerror = () => resolve(false)
    target.src = `${import.meta.env.BASE_URL}characters/reimu/prayer-parts.png`
    if (target.complete && ready()) resolve(true)
  })
  prayerLoading = Promise.all([loadReimuRigAssets(), details]).then(results => results.every(Boolean))
  return prayerLoading
}

/** 常驻资源只加载一次；祈祷过场开始绘制前需要显式等待资源完成。 */
export function loadReimuRigAssets(): Promise<boolean> {
  if (loading) return loading
  if (typeof Image === 'undefined') return Promise.resolve(false)
  image = new Image()
  const target = image
  loading = new Promise(resolve => {
    target.onload = () => resolve(true)
    target.onerror = () => resolve(false)
    target.src = `${import.meta.env.BASE_URL}characters/reimu/character-parts.png`
    if (target.complete && target.naturalWidth >= reimuHeadAtlas.width * reimuHeadAtlas.columns) resolve(true)
  })
  return loading
}
export function getReimuRigAtlas(): HTMLImageElement | undefined {
  void loadReimuRigAssets()
  return image?.complete && image.naturalWidth >= reimuHeadAtlas.width * reimuHeadAtlas.columns ? image : undefined
}
void loadReimuRigAssets()

function part(g: CanvasRenderingContext2D, image: HTMLImageElement, id: number): void {
  const { width, height, columns, top, scale } = reimuBodyAtlas
  g.imageSmoothingEnabled = false
  g.drawImage(image, id % columns * width, top + Math.floor(id / columns) * height, width, height, -16, -16, width / scale, height / scale)
}

/** 保留确认参考的完整五官，侧面只露近侧眼睛；长发与后脑同向。 */
export function drawReimuCelHead(g: CanvasRenderingContext2D, dir: Dir4, expression: ReimuCelExpression, tilt = 0): void {
  const image = getReimuRigAtlas()
  if (!image) return
  const { width, height, scale } = reimuHeadAtlas, row = dir === 'up' ? 2 : dir === 'left' ? 1 : 0
  g.save(); g.translate(0, -8.2); g.rotate(Math.max(-.025, Math.min(.025, tilt)))
  g.imageSmoothingEnabled = true
  g.drawImage(image, reimuCelExpressions.indexOf(expression) * width, row * height, width, height, -20, -32, width / scale, height / scale)
  g.restore()
}

const UPPER = 3.2, LOWER = 8.32
function armAngles(pose: PlayerPose, cast: number, far: boolean, sign: number, side: boolean): [number, number] {
  const b = pose.bone, upper = far ? b.armFarUpper : b.armNearUpper, lower = far ? b.armFarLower : b.armNearLower
  const target = sign < 0 ? -2.42 : -.72
  const u = upper - sign * (side ? .1 : .25), l = lower - sign * (side ? .35 : .7)
  return [lerpAngle(u, target, cast), lerpAngle(l, target + .06, cast)]
}
function arm(g: CanvasRenderingContext2D, image: HTMLImageElement, x: number, angles: [number, number], sign: number, layer: 'all' | 'upper' | 'sleeve'): void {
  const [u, l] = angles
  g.save(); g.translate(x, -5.96)
  if (layer !== 'sleeve') {
    g.save(); g.rotate(u - Math.PI / 2); if (sign > 0) g.scale(-1, 1); part(g, image, reimuBodyParts.upperArm); g.restore()
  }
  if (layer !== 'upper') {
    g.translate(Math.cos(u) * UPPER, Math.sin(u) * UPPER); g.rotate(l - Math.PI / 2)
    if (sign > 0) g.scale(-1, 1)
    part(g, image, reimuBodyParts.sleeve)
  }
  g.restore()
}
function leg(g: CanvasRenderingContext2D, image: HTMLImageElement, x: number, thigh: number, shin: number, side: boolean): void {
  const kx = Math.cos(thigh) * 3.36, ky = Math.sin(thigh) * 3.36, fx = kx + Math.cos(shin) * 2.8, fy = ky + Math.sin(shin) * 2.8
  g.save(); g.translate(x, 8.5)
  g.save(); g.rotate(thigh - Math.PI / 2); part(g, image, reimuBodyParts.thigh); g.restore()
  g.save(); g.translate(kx, ky); g.rotate(shin - Math.PI / 2); part(g, image, reimuBodyParts.shin); g.restore()
  g.translate(fx, fy); part(g, image, side ? reimuBodyParts.sideShoe : reimuBodyParts.shoe); g.restore()
}

/** 祈祷专用姿态：脚跟落定，双肘弯曲，闭眼低头，合掌保持贴合。 */
export function drawReimuPrayer(g: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const image = getReimuRigAtlas()
  const details = prayerImage
  if (!image || !details?.complete || details.naturalWidth !== 160) return
  const phase = time * Math.PI * 2 / 3.2
  const breath = (1 - Math.cos(phase)) / 2
  g.save(); g.translate(x, y)
  // 脚部不跟随呼吸抬升，避免旧过场整张角色上下漂浮。
  leg(g, image, -2.15, Math.PI / 2, Math.PI / 2, false)
  leg(g, image, 2.15, Math.PI / 2, Math.PI / 2, false)
  g.save(); g.translate(0, -breath * .16)
  g.save(); g.rotate(Math.sin(phase - .45) * .009); part(g, image, reimuBodyParts.hairFront); g.restore()
  part(g, image, reimuBodyParts.front)

  // 大臂朝下，宽袖折向胸前；手腕不会因两侧袖子的相位差而分离。
  for (const sign of [-1, 1]) {
    const shoulderX = sign * 3.64, elbowX = sign * (6.3 + breath * .08), elbowY = -.5
    g.save(); g.translate(shoulderX, -5.96)
    g.rotate(Math.atan2(elbowY + 5.96, elbowX - shoulderX) - Math.PI / 2)
    g.scale(1, 1.7); if (sign > 0) g.scale(-1, 1)
    part(g, image, reimuBodyParts.upperArm); g.restore()
    g.save(); g.translate(elbowX, elbowY)
    g.rotate(Math.atan2(-5.7 - elbowY, sign * .6 - elbowX) - Math.PI / 2)
    if (sign < 0) g.scale(-1, 1)
    g.scale(.9, .86)
    part(g, image, reimuBodyParts.sleeve); g.restore()
  }
  // 祈祷闭眼使用更短、更柔和的专用眼睑；发型和脸形仍逐像素沿用正式头部。
  g.save(); g.translate(0, 1 + breath * .12); g.scale(1, .97)
  g.imageSmoothingEnabled = true
  g.drawImage(details, 0, 0, 160, 176, -20, -40.2, 40, 44); g.restore()

  // 合掌使用与头部相同的四倍微像素裁片，短指尖、掌缝和拇指都有局部层次。
  g.imageSmoothingEnabled = true
  g.drawImage(details, 0, 176, 32, 40, -4, -9.8, 8, 10)
  g.restore(); g.restore()
}

/** 与旧入口保持同样的骨骼、施法参数和手部锚点协议。 */
export function drawReimuCelRig(g: CanvasRenderingContext2D, x: number, y: number, pose: PlayerPose, opts: ReimuRigOptions = {}): ReimuHandAnchor {
  const dir: Dir4 = pose.dir === 'right' ? 'left' : pose.dir, side = dir === 'left', back = dir === 'up', mirror = pose.dir === 'right'
  const cast = Math.max(0, Math.min(1, opts.cast ?? 0)), image = getReimuRigAtlas(), scaleX = pose.scaleX * .98, scaleY = pose.scaleY * .98
  const farX = side ? 1.5 : back ? 3.64 : -3.64, nearX = side ? -1.7 : back ? -3.64 : 3.64
  const farSign = farX < 0 ? -1 : 1, nearSign = nearX < 0 ? -1 : 1
  const farAngles = armAngles(pose, cast, true, farSign, side), nearAngles = armAngles(pose, cast, false, nearSign, side)
  const hx = (nearX + Math.cos(nearAngles[0]) * UPPER + Math.cos(nearAngles[1]) * LOWER) * scaleX
  const hy = (-5.96 + Math.sin(nearAngles[0]) * UPPER + Math.sin(nearAngles[1]) * LOWER) * scaleY
  const cr = Math.cos(pose.rootRot), sr = Math.sin(pose.rootRot), hand: ReimuHandAnchor = {
    x: x + pose.rootX + (mirror ? -1 : 1) * (hx * cr - hy * sr), y: y + pose.rootY + hx * sr + hy * cr,
    angle: mirror ? Math.PI - nearAngles[1] - pose.rootRot : nearAngles[1] + pose.rootRot, inFront: pose.weaponInFront
  }
  if (!image) return hand
  g.save(); g.translate(x + pose.rootX, y + pose.rootY); if (mirror) g.scale(-1, 1)
  g.rotate(pose.rootRot); g.scale(scaleX, scaleY)
  const farHip = side ? 1.1 : back ? 2.15 : -2.15, nearHip = side ? -1.1 : back ? -2.15 : 2.15
  leg(g, image, farHip, pose.bone.thighFar, pose.bone.shinFar, side)
  leg(g, image, nearHip, pose.bone.thighNear, pose.bone.shinNear, side)
  if (!back) { g.save(); g.rotate(Math.sin(pose.time * 2.1) * .015 + pose.hair * .06); part(g, image, side ? reimuBodyParts.hairSide : reimuBodyParts.hairFront); g.restore() }
  arm(g, image, farX, farAngles, farSign, back ? 'upper' : 'all')
  if (back) arm(g, image, nearX, nearAngles, nearSign, 'upper')
  g.save(); g.rotate((pose.bone.spine + Math.PI / 2) * .2); part(g, image, back ? reimuBodyParts.back : side ? reimuBodyParts.side : reimuBodyParts.front); g.restore()
  if (back) arm(g, image, farX, farAngles, farSign, 'sleeve')
  arm(g, image, nearX, nearAngles, nearSign, back ? 'sleeve' : 'all')
  const expression = cast > .4 ? 'speaking' : (pose.time + .8) % 4.9 < .12 ? 'blink' : 'neutral'
  drawReimuCelHead(g, dir, expression, (pose.bone.head + Math.PI / 2) * .18)
  g.restore(); return hand
}
