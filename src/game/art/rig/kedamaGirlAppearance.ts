import type { Dir4, PlayerPose } from './skeleton'
import { drawKedamaGirlHead, getKedamaGirlParts } from './kedamaGirlHead'
import { kedamaBodyAtlas, kedamaBodyParts } from './kedamaGirlParts'
import type { FourthCharacterOptions } from './fourthFloorCharacters'

/** 部件使用与头部相同的两倍像素网格，关节仍由正式动画器连续驱动。 */
function part(g: CanvasRenderingContext2D, image: HTMLImageElement, id: number): void {
  const { width, height, columns, top, scale } = kedamaBodyAtlas
  g.imageSmoothingEnabled = false
  g.drawImage(image, id % columns * width, top + Math.floor(id / columns) * height, width, height, -16, -16, width / scale, height / scale)
}
function leg(g: CanvasRenderingContext2D, image: HTMLImageElement, x: number, thigh: number, shin: number, side: boolean): void {
  const kneeX = Math.cos(thigh) * 3.38, kneeY = Math.sin(thigh) * 3.38
  const footX = kneeX + Math.cos(shin) * 4.16, footY = kneeY + Math.sin(shin) * 4.16
  g.save(); g.translate(x, 8.4)
  g.save(); g.rotate(thigh - Math.PI / 2); part(g, image, kedamaBodyParts.thigh); g.restore()
  g.save(); g.translate(kneeX, kneeY); g.rotate(shin - Math.PI / 2); part(g, image, kedamaBodyParts.shin); g.restore()
  g.translate(footX, footY); part(g, image, side ? kedamaBodyParts.sideShoe : kedamaBodyParts.shoe)
  g.restore()
}
function arm(g: CanvasRenderingContext2D, image: HTMLImageElement, x: number, upper: number, lower: number, cast: number, sign = x < 0 ? -1 : 1, layer: 'all' | 'upper' | 'lower' = 'all'): void {
  const target = sign < 0 ? Math.PI + .12 : -.12
  const u = (upper - sign * .08) * (1 - cast) + target * cast
  const l = (lower - sign * .06) * (1 - cast) + target * cast
  g.save(); g.translate(x, -4.8)
  if (layer !== 'lower') {
    g.save(); g.rotate(u - Math.PI / 2); if (sign > 0) g.scale(-1, 1); part(g, image, kedamaBodyParts.upperArm); g.restore()
  }
  g.translate(Math.cos(u) * 4.1, Math.sin(u) * 4.1); g.rotate(l - Math.PI / 2)
  if (layer !== 'upper') { if (sign > 0) g.scale(-1, 1); part(g, image, kedamaBodyParts.lowerArm) }
  g.restore()
}
function torso(g: CanvasRenderingContext2D, image: HTMLImageElement, dir: Dir4, pose: PlayerPose): void {
  g.save(); g.translate(Math.sin(pose.phase) * .15, 0); g.rotate((pose.bone.spine + Math.PI / 2) * .25)
  part(g, image, dir === 'up' ? kedamaBodyParts.back : dir === 'left' ? kedamaBodyParts.side : kedamaBodyParts.front)
  g.restore()
}

/** 白绒边与淡紫羽片直接来自 BOSS 立绘，肩根被身体覆盖，成对翅膀轻微扇动。 */
export function drawKedamaBossWings(g: CanvasRenderingContext2D, x: number, y: number, pose: PlayerPose, cast = 0, droop = 0): void {
  const image = getKedamaGirlParts()
  if (!image) return
  const flutter = Math.sin(pose.time * 2.3) * .065 * (1 - droop) - Math.max(0, Math.min(1, cast)) * .09 - droop * .65
  g.save(); g.translate(x + pose.rootX, y + pose.rootY); g.scale(pose.scaleX * .98, pose.scaleY * .98)
  for (const sign of [-1, 1]) {
    g.save(); g.translate(sign * 5.2, -4.8)
    if (sign > 0) g.scale(-1, 1)
    g.rotate(flutter); part(g, image, kedamaBodyParts.wing); g.restore()
  }
  g.restore()
}

/** 普通形态采用完整四向构图；侧面为单眼侧脸，头图与身体采用同一像素赛璐璐画风。 */
export function drawKedamaCharacter(g: CanvasRenderingContext2D, x: number, y: number, pose: PlayerPose, opts: FourthCharacterOptions = {}): void {
  const image = getKedamaGirlParts()
  if (!image) return
  const dir: Dir4 = pose.dir === 'right' ? 'left' : pose.dir, side = dir === 'left', back = dir === 'up', b = pose.bone
  const cast = Math.max(0, Math.min(1, opts.cast ?? 0)), expression = opts.expression ?? 'neutral'
  g.save(); g.translate(x + pose.rootX, y + pose.rootY); if (pose.dir === 'right') g.scale(-1, 1)
  g.rotate(pose.rootRot); g.scale(pose.scaleX * .98, pose.scaleY * .98); g.lineCap = 'round'; g.lineJoin = 'round'
  leg(g, image, side ? 1.2 : -2.15, b.thighFar, b.shinFar, side)
  leg(g, image, side ? -1.1 : 2.15, b.thighNear, b.shinNear, side)
  const farShoulder = side ? .9 : -5.15, nearShoulder = side ? .6 : 5.15
  // 侧身双肩按纵深重叠；背身上臂在裙身后，袖口与手在外侧单独显示。
  arm(g, image, farShoulder, b.armFarUpper, b.armFarLower, cast, side ? 1 : -1, back ? 'upper' : 'all')
  if (back) arm(g, image, nearShoulder, b.armNearUpper, b.armNearLower, cast, 1, 'upper')
  torso(g, image, dir, pose)
  if (back) arm(g, image, farShoulder, b.armFarUpper, b.armFarLower, cast, -1, 'lower')
  arm(g, image, nearShoulder, b.armNearUpper, b.armNearLower, cast, side ? -1 : 1, back ? 'lower' : 'all')
  drawKedamaGirlHead(g, dir, pose.time, expression, (pose.bone.head + Math.PI / 2) * .2)
  if (opts.bound) {
    g.strokeStyle = '#75806c'; g.lineWidth = 1.3
    g.beginPath(); g.moveTo(-7,-3); g.lineTo(7,-.6); g.moveTo(-7,-.6); g.lineTo(7,-3); g.moveTo(-6,1); g.lineTo(6,1); g.stroke()
    g.fillStyle = '#7ea98a'; g.beginPath(); g.ellipse(side ? -3.3 : 0, -9.2, 3.6, 1.5, 0, 0, Math.PI * 2); g.fill()
  }
  g.restore()
}
