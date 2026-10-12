import { oldMinerAtlas } from './playerCostume'
import { knightPlateAtlas } from './knightPlate'
import { ARM_RIG, armShoulders } from './handGrip'
import type { Dir4, PlayerPose } from './skeleton'
import type { HandAnchor, RigOptions } from './playerRig'
import { simulationAppearance, simulationCostume, type PlayerAppearance } from '../../../shared/playerAppearance'
import { profiler } from '../../../core/performance/Profiler'

export type PlayerCelExpression = 'neutral' | 'happy' | 'angry' | 'shy' | 'blink'
export const playerCelExpressions: readonly PlayerCelExpression[] = ['neutral', 'happy', 'angry', 'shy', 'blink']
export const playerHeadAtlas = { width: 160, height: 176, columns: 5, rows: 3, scale: 4 } as const
export const playerBodyAtlas = { top: 528, width: 128, height: 160, columns: 6, rows: 2, scale: 4 } as const
export const playerBodyParts = { front: 0, side: 1, back: 2, upperArm: 3, lowerArm: 4, thigh: 5, shin: 6, shoe: 7, sideShoe: 8, backShoe: 9, waist: 10 } as const
const atlases = new Map<PlayerAppearance, HTMLImageElement>()
const pending = new Map<PlayerAppearance, Promise<boolean>>()

type PlayerAtlas = HTMLImageElement | HTMLCanvasElement

interface CelLayer {
  key: string
  image: HTMLCanvasElement
  context: CanvasRenderingContext2D
}
const poseLayers = new WeakMap<PlayerPose, { atlas: PlayerAtlas; layers: Map<string, CelLayer> }>()
const LAYER_DENSITY = 4
// 根位移、镜像与翻滚在缓存外执行；图层保持原图集的四倍像素密度。
const LAYER_X = -48, LAYER_Y = -56, LAYER_W = 96, LAYER_H = 104

/** 缓存腿、躯干与两臂，武器继续在原来的手心与遮挡层内实时绘制。 */
function drawPoseLayer(g: CanvasRenderingContext2D, pose: PlayerPose, atlas: PlayerAtlas, enabled: boolean | undefined, slot: string, key: string, paint: (context: CanvasRenderingContext2D) => void): void {
  // 受伤闪烁沿用逐部件透明叠加，避免缓存合并后改变颈部与袖口的透明度。
  if (!enabled || g.globalAlpha !== 1) { paint(g); return }
  let cached = poseLayers.get(pose)
  if (!cached || cached.atlas !== atlas) {
    cached = { atlas, layers: new Map() }
    poseLayers.set(pose, cached)
  }
  let layer = cached.layers.get(slot)
  if (!layer) {
    const image = document.createElement('canvas')
    image.width = LAYER_W * LAYER_DENSITY; image.height = LAYER_H * LAYER_DENSITY
    layer = { key: '', image, context: image.getContext('2d')! }
    cached.layers.set(slot, layer)
  }
  if (layer.key !== key) {
    const c = layer.context
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.clearRect(0, 0, layer.image.width, layer.image.height)
    c.setTransform(LAYER_DENSITY, 0, 0, LAYER_DENSITY, -LAYER_X * LAYER_DENSITY, -LAYER_Y * LAYER_DENSITY)
    c.save(); paint(c); c.restore()
    layer.key = key
    profiler.increment('rigLayerBakes')
  } else profiler.increment('rigLayerReuses')
  g.imageSmoothingEnabled = false
  g.drawImage(layer.image, LAYER_X, LAYER_Y, LAYER_W, LAYER_H)
}

/** 头部与衣身共用一张常驻图集；无效或尚未加载的资源交由旧入口过渡。 */
export function loadPlayerRigAssets(appearance: PlayerAppearance = simulationAppearance()): Promise<boolean> {
  const existing = pending.get(appearance)
  if (existing) return existing
  if (typeof Image === 'undefined') return Promise.resolve(false)
  const image = new Image()
  image.decoding = 'async'
  atlases.set(appearance, image)
  const loading = new Promise<boolean>(resolve => {
    image.onload = () => resolve(hasCompleteAtlas(image))
    image.onerror = () => resolve(false)
    image.src = `${import.meta.env.BASE_URL}characters/${appearance === 'sister' ? 'sister' : 'player'}/character-parts.png`
    if (hasCompleteAtlas(image)) resolve(true)
  })
  const checked = loading.then(ok => {
    if (!ok) { pending.delete(appearance); atlases.delete(appearance) }
    return ok
  })
  pending.set(appearance, checked)
  return checked
}

function hasCompleteAtlas(image: HTMLImageElement): boolean {
  return image.complete && image.naturalWidth >= playerHeadAtlas.width * playerHeadAtlas.columns
    && image.naturalHeight >= playerBodyAtlas.top + playerBodyAtlas.height * playerBodyAtlas.rows
}

export function getPlayerRigAtlas(): PlayerAtlas | undefined {
  const appearance = simulationAppearance()
  void loadPlayerRigAssets(appearance)
  const atlas = atlases.get(appearance)
  if (!atlas || !hasCompleteAtlas(atlas)) return undefined
  const costume = simulationCostume()
  if (costume === 'old_miner') return oldMinerAtlas(atlas, appearance)
  if (costume === 'knight_plate') return knightPlateAtlas(atlas, appearance)
  return atlas
}
// 入场按所选角色显式加载，避免选择妹妹时也提前下载哥哥的图集。

function part(g: CanvasRenderingContext2D, image: PlayerAtlas, id: number): void {
  const { width, height, columns, top, scale } = playerBodyAtlas
  g.imageSmoothingEnabled = false
  g.drawImage(image, id % columns * width, top + Math.floor(id / columns) * height, width, height, -16, -16, width / scale, height / scale)
}

/** 默认头图保留角色五官；全盔装束使用同位置的独立头盔图格。 */
export function drawPlayerCelHead(g: CanvasRenderingContext2D, dir: Dir4, expression: PlayerCelExpression, tilt = 0): void {
  const image = getPlayerRigAtlas()
  if (!image) return
  const { width, height, scale } = playerHeadAtlas
  const row = dir === 'up' ? 2 : dir === 'left' || dir === 'right' ? 1 : 0
  g.save()
  if (dir === 'right') g.scale(-1, 1)
  g.rotate(tilt)
  g.imageSmoothingEnabled = true
  g.drawImage(image, playerCelExpressions.indexOf(expression) * width, row * height, width, height, -20, -32, width / scale, height / scale)
  g.restore()
}

function leg(g: CanvasRenderingContext2D, image: PlayerAtlas, x: number, y: number, thigh: number, shin: number, dir: Dir4, lengthScale = 1): void {
  const kneeX = Math.cos(thigh) * 3.8 * lengthScale, kneeY = Math.sin(thigh) * 3.8 * lengthScale
  g.save(); g.translate(x, y)
  g.save(); g.rotate(thigh - Math.PI / 2); g.scale(1, lengthScale); part(g, image, playerBodyParts.thigh); g.restore()
  g.translate(kneeX, kneeY)
  g.save(); g.rotate(shin - Math.PI / 2); g.scale(1, lengthScale); part(g, image, playerBodyParts.shin); g.restore()
  g.translate(Math.cos(shin) * 3.6 * lengthScale, Math.sin(shin) * 3.6 * lengthScale)
  // 鞋底保持朝地面；迈步时只随小腿轻微倾斜，翻滚由人物根旋转整体驱动。
  g.rotate((shin - Math.PI / 2) * .25)
  part(g, image, dir === 'left' ? playerBodyParts.sideShoe : dir === 'up' ? playerBodyParts.backShoe : playerBodyParts.shoe)
  g.restore()
}

function arm(g: CanvasRenderingContext2D, image: PlayerAtlas, shoulder: { x: number; y: number }, upper: number, lower: number): void {
  g.save(); g.translate(shoulder.x, shoulder.y)
  const mirrorCloth = shoulder.x > 0
  // 小臂先画，上臂袖缘随后覆盖肘部交界；妹妹的裸露小臂不会压住宽袖白边。
  g.save(); g.translate(Math.cos(upper) * ARM_RIG.upper, Math.sin(upper) * ARM_RIG.upper)
  g.rotate(lower - Math.PI / 2)
  if (mirrorCloth) g.scale(-1, 1)
  part(g, image, playerBodyParts.lowerArm); g.restore()
  g.save(); g.rotate(upper - Math.PI / 2)
  if (mirrorCloth) g.scale(-1, 1)
  part(g, image, playerBodyParts.upperArm); g.restore()
  g.restore()
}

/** 和原手臂绘制共用正向骨骼定位，分层缓存不改变握把朝向或手掌距离。 */
function armWeapon(g: CanvasRenderingContext2D, shoulder: { x: number; y: number }, upper: number, lower: number, axis: number | undefined, weapon: RigOptions['drawWeapon'], palmOffset: number): void {
  if (!weapon) return
  g.save()
  g.translate(shoulder.x + Math.cos(upper) * ARM_RIG.upper + Math.cos(lower) * (ARM_RIG.lower + palmOffset), shoulder.y + Math.sin(upper) * ARM_RIG.upper + Math.sin(lower) * (ARM_RIG.lower + palmOffset))
  g.rotate(axis ?? lower)
  weapon(g)
  g.restore()
}

/** 仅复绘图集原有手部，让握把位于掌内；不重画皮肤，也不重复覆盖整条衣袖。 */
function gripPalm(g: CanvasRenderingContext2D, image: PlayerAtlas, shoulder: { x: number; y: number }, upper: number, lower: number, palmOffset: number): void {
  g.save(); g.translate(shoulder.x + Math.cos(upper) * ARM_RIG.upper, shoulder.y + Math.sin(upper) * ARM_RIG.upper)
  g.rotate(lower - Math.PI / 2)
  if (shoulder.x > 0) g.scale(-1, 1)
  g.beginPath(); g.rect(-2.2, ARM_RIG.lower + palmOffset - 1.4, 4.4, 3); g.clip()
  part(g, image, playerBodyParts.lowerArm); g.restore()
}

/** 换用参考部件，保留动作姿态、主副手回调和世界坐标附件协议。 */
export function drawPlayerCelRig(g: CanvasRenderingContext2D, x: number, y: number, pose: PlayerPose, opts: RigOptions, hand: HandAnchor): HandAnchor {
  const image = getPlayerRigAtlas()
  if (!image) return hand
  const mirror = pose.dir === 'right', dir: Dir4 = mirror ? 'left' : pose.dir
  const side = dir === 'left', back = dir === 'up', bone = pose.bone, shoulders = armShoulders(dir)
  const twoHanded = (pose.supportGripWeight ?? 0) > 0 && pose.gripInFront !== false
  const palmOffset = pose.palmOffset ?? 0
  const farArm = () => {
    drawPoseLayer(g, pose, image, opts.cacheBody, 'farArm', `${dir}:${bone.armFarUpper}:${bone.armFarLower}`, c => arm(c, image, shoulders.far, bone.armFarUpper, bone.armFarLower))
    armWeapon(g, shoulders.far, bone.armFarUpper, bone.armFarLower, pose.supportWeaponAngle, pose.weaponHand === 'far' ? opts.drawWeapon : opts.drawSupportWeapon, palmOffset)
  }
  const nearArm = () => {
    drawPoseLayer(g, pose, image, opts.cacheBody, 'nearArm', `${dir}:${bone.armNearUpper}:${bone.armNearLower}`, c => arm(c, image, shoulders.near, bone.armNearUpper, bone.armNearLower))
    armWeapon(g, shoulders.near, bone.armNearUpper, bone.armNearLower, pose.weaponAngle, pose.weaponHand === 'far' ? opts.drawSupportWeapon : opts.drawWeapon, palmOffset)
  }
  const frontFar = opts.supportInFront && pose.weaponHand !== 'far'
  const behindGrip = opts.gripHandsOverWeapon && pose.gripInFront === false
  const splitGrip = pose.supportInFront !== undefined
  const accessoryFront = pose.accessoryInFront ?? pose.gripInFront
  const palms = () => drawPoseLayer(g, pose, image, opts.cacheBody, 'palms', `${dir}:${bone.armFarUpper}:${bone.armFarLower}:${bone.armNearUpper}:${bone.armNearLower}:${palmOffset}`, c => {
    gripPalm(c, image, shoulders.far, bone.armFarUpper, bone.armFarLower, palmOffset)
    gripPalm(c, image, shoulders.near, bone.armNearUpper, bone.armNearLower, palmOffset)
  })
  const singlePalm = (far: boolean) => {
    if (!opts.gripHandsOverWeapon) return
    const upper = far ? bone.armFarUpper : bone.armNearUpper, lower = far ? bone.armFarLower : bone.armNearLower
    drawPoseLayer(g, pose, image, opts.cacheBody, far ? 'farPalm' : 'nearPalm', `${dir}:${upper}:${lower}:${palmOffset}`,
      c => gripPalm(c, image, far ? shoulders.far : shoulders.near, upper, lower, palmOffset))
  }
  const accessory = () => {
    if (!opts.drawAccessory) return
    g.save(); g.scale(1 / pose.scaleX, 1 / pose.scaleY); g.rotate(-pose.rootRot)
    if (mirror) g.scale(-1, 1)
    g.translate(-x - pose.rootX, -y - pose.rootY)
    opts.drawAccessory(g)
    g.restore()
  }
  g.save(); g.translate(x + pose.rootX, y + pose.rootY)
  if (mirror) g.scale(-1, 1)
  g.rotate(pose.rootRot); g.scale(pose.scaleX, pose.scaleY)
  const farHip = side ? 1.7 : back ? 2.7 : -2.7, nearHip = side ? -.9 : back ? -2.7 : 2.7
  const torsoAngle = (bone.spine + Math.PI / 2) * .55 + pose.cape * .025
  // 哥哥的开襟露出腰胯，需要完整裤腰连接衣身与两条活动裤腿；妹妹由裙身覆盖腿根。
  drawPoseLayer(g, pose, image, opts.cacheBody, 'legs', `${dir}:${bone.thighFar}:${bone.shinFar}:${bone.thighNear}:${bone.shinNear}:${pose.farLegScale ?? 1}:${pose.nearLegScale ?? 1}:${simulationAppearance() === 'brother' ? torsoAngle : 0}`, c => {
    leg(c, image, farHip, 7.5, bone.thighFar, bone.shinFar, dir, pose.farLegScale)
    leg(c, image, nearHip, 7.5, bone.thighNear, bone.shinNear, dir, pose.nearLegScale)
    if (simulationAppearance() === 'brother') {
      c.save(); c.rotate(torsoAngle); part(c, image, playerBodyParts.waist); c.restore()
    }
  })
  if (accessoryFront === false) accessory()
  if (splitGrip) {
    // 前后手分层：越肩蓄势的手臂和棍先画，由衣身、头发自然遮挡。
    if (pose.supportInFront === false) { farArm(); singlePalm(true) }
    if (pose.gripInFront === false) { nearArm(); singlePalm(false) }
  } else {
    if (!twoHanded) farArm()
    if ((back || behindGrip) && !twoHanded) nearArm()
    if (behindGrip) palms()
  }
  const closedHelmet = simulationCostume() === 'knight_plate'
  // 全盔没有眨眼或发丝摆动，避免相同头盔因表情变化反复重烘焙。
  const expression = closedHelmet ? 'neutral' : opts.expression ?? (opts.hurt ? 'angry' : pose.time % 3.6 < .12 ? 'blink' : 'neutral')
  const headTilt = (bone.head + Math.PI / 2) + (closedHelmet ? 0 : pose.hair * .08)
  drawPoseLayer(g, pose, image, opts.cacheBody, 'torso', `${dir}:${torsoAngle}:${headTilt}:${expression}`, c => {
    c.save(); c.rotate(torsoAngle)
    part(c, image, back ? playerBodyParts.back : side ? playerBodyParts.side : playerBodyParts.front)
    c.restore()
    c.save()
    if (closedHelmet) c.translate(8.2 * Math.sin(torsoAngle), -8.2 * Math.cos(torsoAngle))
    else if (simulationAppearance() === 'sister') {
      // 头颈随领口绕衣身原点移动，头自身仍保留原动画倾角；侧身缩短颈部空隙。
      const neckX = side ? .45 : 0, neckY = side ? -6.4 : back ? -6.9 : -7.1
      c.translate(neckX * Math.cos(torsoAngle) - neckY * Math.sin(torsoAngle), neckX * Math.sin(torsoAngle) + neckY * Math.cos(torsoAngle))
    } else c.translate(0, -8.2)
    drawPlayerCelHead(c, dir, expression, headTilt)
    c.restore()
  })
  if (accessoryFront !== false) accessory()
  if (splitGrip) {
    if (pose.supportInFront && !frontFar) farArm()
    if (pose.gripInFront !== false) nearArm()
    if (pose.supportInFront && frontFar) farArm()
    if (pose.gripInFront !== false) singlePalm(false)
    if (pose.supportInFront) singlePalm(true)
  } else {
    if (twoHanded && !frontFar) farArm()
    if (!behindGrip && (!back || twoHanded)) nearArm()
    if (twoHanded && frontFar) farArm()
    if (opts.gripHandsOverWeapon && !behindGrip) palms()
  }
  g.restore()
  return hand
}
