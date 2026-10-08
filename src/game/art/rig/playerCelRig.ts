import { ARM_RIG, armShoulders } from './handGrip'
import type { Dir4, PlayerPose } from './skeleton'
import type { HandAnchor, RigOptions } from './playerRig'
import { playerAppearance, type PlayerAppearance } from '../../../shared/playerAppearance'

export type PlayerCelExpression = 'neutral' | 'happy' | 'angry' | 'shy' | 'blink'
export const playerCelExpressions: readonly PlayerCelExpression[] = ['neutral', 'happy', 'angry', 'shy', 'blink']
export const playerHeadAtlas = { width: 160, height: 176, columns: 5, rows: 3, scale: 4 } as const
export const playerBodyAtlas = { top: 528, width: 128, height: 160, columns: 6, rows: 2, scale: 4 } as const
export const playerBodyParts = { front: 0, side: 1, back: 2, upperArm: 3, lowerArm: 4, thigh: 5, shin: 6, shoe: 7, sideShoe: 8, backShoe: 9, waist: 10 } as const
const atlases = new Map<PlayerAppearance, HTMLImageElement>()
const pending = new Map<PlayerAppearance, Promise<boolean>>()

/** 头部与衣身共用一张常驻图集；无效或尚未加载的资源交由旧入口过渡。 */
export function loadPlayerRigAssets(appearance: PlayerAppearance = playerAppearance.value): Promise<boolean> {
  const existing = pending.get(appearance)
  if (existing) return existing
  if (typeof Image === 'undefined') return Promise.resolve(false)
  const image = new Image()
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

export function getPlayerRigAtlas(): HTMLImageElement | undefined {
  const appearance = playerAppearance.value
  void loadPlayerRigAssets(appearance)
  const atlas = atlases.get(appearance)
  return atlas && hasCompleteAtlas(atlas) ? atlas : undefined
}
void loadPlayerRigAssets()

function part(g: CanvasRenderingContext2D, image: HTMLImageElement, id: number): void {
  const { width, height, columns, top, scale } = playerBodyAtlas
  g.imageSmoothingEnabled = false
  g.drawImage(image, id % columns * width, top + Math.floor(id / columns) * height, width, height, -16, -16, width / scale, height / scale)
}

/** 头图沿用确认参考的完整五官；侧面单眼，背面完全遮住五官。 */
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

function leg(g: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, thigh: number, shin: number, dir: Dir4): void {
  const kneeX = Math.cos(thigh) * 3.8, kneeY = Math.sin(thigh) * 3.8
  g.save(); g.translate(x, y)
  g.save(); g.rotate(thigh - Math.PI / 2); part(g, image, playerBodyParts.thigh); g.restore()
  g.translate(kneeX, kneeY)
  g.save(); g.rotate(shin - Math.PI / 2); part(g, image, playerBodyParts.shin); g.restore()
  g.translate(Math.cos(shin) * 3.6, Math.sin(shin) * 3.6)
  // 鞋底保持朝地面；迈步时只随小腿轻微倾斜，翻滚由人物根旋转整体驱动。
  g.rotate((shin - Math.PI / 2) * .25)
  part(g, image, dir === 'left' ? playerBodyParts.sideShoe : dir === 'up' ? playerBodyParts.backShoe : playerBodyParts.shoe)
  g.restore()
}

function arm(g: CanvasRenderingContext2D, image: HTMLImageElement, shoulder: { x: number; y: number }, upper: number, lower: number, axis: number | undefined, weapon: RigOptions['drawWeapon']): void {
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
  g.translate(Math.cos(upper) * ARM_RIG.upper, Math.sin(upper) * ARM_RIG.upper)
  if (weapon) {
    g.translate(Math.cos(lower) * ARM_RIG.lower, Math.sin(lower) * ARM_RIG.lower)
    g.rotate(axis ?? lower)
    // 镜像沿用整个角色的局部坐标；双手回调与原绘制器使用同一手心协议。
    weapon(g)
  }
  g.restore()
}

/** 换用参考部件，保留动作姿态、主副手回调和世界坐标附件协议。 */
export function drawPlayerCelRig(g: CanvasRenderingContext2D, x: number, y: number, pose: PlayerPose, opts: RigOptions, hand: HandAnchor): HandAnchor {
  const image = getPlayerRigAtlas()
  if (!image) return hand
  const mirror = pose.dir === 'right', dir: Dir4 = mirror ? 'left' : pose.dir
  const side = dir === 'left', back = dir === 'up', bone = pose.bone, shoulders = armShoulders(dir)
  const twoHanded = (pose.supportGripWeight ?? 0) > 0 && pose.gripInFront !== false
  const farArm = () => arm(g, image, shoulders.far, bone.armFarUpper, bone.armFarLower, pose.supportWeaponAngle, opts.drawSupportWeapon)
  const nearArm = () => arm(g, image, shoulders.near, bone.armNearUpper, bone.armNearLower, pose.weaponAngle, opts.drawWeapon)
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
  leg(g, image, farHip, 7.5, bone.thighFar, bone.shinFar, dir)
  leg(g, image, nearHip, 7.5, bone.thighNear, bone.shinNear, dir)
  const torsoAngle = (bone.spine + Math.PI / 2) * .55 + pose.cape * .025
  // 哥哥的开襟露出腰胯，需要完整裤腰连接衣身与两条活动裤腿；妹妹由裙身覆盖腿根。
  if (playerAppearance.value === 'brother') {
    g.save(); g.rotate(torsoAngle); part(g, image, playerBodyParts.waist); g.restore()
  }
  if (pose.gripInFront === false) accessory()
  if (!twoHanded) farArm()
  if (back && !twoHanded) nearArm()
  g.save(); g.rotate(torsoAngle)
  part(g, image, back ? playerBodyParts.back : side ? playerBodyParts.side : playerBodyParts.front)
  g.restore()
  g.save()
  if (playerAppearance.value === 'sister') {
    // 头颈随领口绕衣身原点移动，头自身仍保留原动画倾角；侧身缩短颈部空隙。
    const neckX = side ? .45 : 0, neckY = side ? -6.4 : back ? -6.9 : -7.1
    g.translate(neckX * Math.cos(torsoAngle) - neckY * Math.sin(torsoAngle), neckX * Math.sin(torsoAngle) + neckY * Math.cos(torsoAngle))
  } else g.translate(0, -8.2)
  drawPlayerCelHead(g, dir, opts.expression ?? (opts.hurt ? 'angry' : pose.time % 3.6 < .12 ? 'blink' : 'neutral'), (bone.head + Math.PI / 2) + pose.hair * .08)
  g.restore()
  if (pose.gripInFront !== false) accessory()
  if (twoHanded) farArm()
  if (!back || twoHanded) nearArm()
  g.restore()
  return hand
}
