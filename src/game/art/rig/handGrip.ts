import type { WeaponGrip } from '../../../content/items/types'
import { clamp01, dirAngle, type Dir4, type PlayerPose } from './skeleton'
import { playerAppearance } from '../../../shared/playerAppearance'

/** 绘制与双手反解共用手臂长度、双肩位置，避免握柄与手心错位。 */
export const ARM_RIG = { upper: 5.2, lower: 4.8, shoulder: 7.5, shoulderY: -6, backShoulder: 7.6 } as const
export function armShoulders(direction: Dir4) {
  const dir = direction === 'right' ? 'left' : direction
  // 妹妹肩线贴合水手领衣身；绘制、双手反解与武器握点共用这组定位。
  if (playerAppearance.value === 'sister') {
    if (dir === 'left') return { near: { x: -.55, y: -6.8 }, far: { x: 1.4, y: -6.8 } }
    const width = dir === 'up' ? 5.2 : 5.1
    return { near: { x: dir === 'up' ? -width : width, y: -6.8 }, far: { x: dir === 'up' ? width : -width, y: -6.8 } }
  }
  if (dir === 'left') return { near: { x: -.8, y: ARM_RIG.shoulderY }, far: { x: 4.6, y: ARM_RIG.shoulderY } }
  const da = dirAngle(dir), px = Math.cos(da + Math.PI / 2), py = Math.sin(da + Math.PI / 2)
  const width = dir === 'up' ? ARM_RIG.backShoulder : ARM_RIG.shoulder
  return { near: { x: -px * width, y: ARM_RIG.shoulderY - py * ARM_RIG.shoulder }, far: { x: px * width, y: ARM_RIG.shoulderY + py * ARM_RIG.shoulder } }
}
function solveArm(shoulder: { x: number; y: number }, target: { x: number; y: number }, bend: number) {
  const dx = target.x - shoulder.x, dy = target.y - shoulder.y, a = ARM_RIG.upper, b = ARM_RIG.lower
  const distance = Math.max(Math.abs(a - b) + .001, Math.min(a + b - .001, Math.hypot(dx, dy)))
  const alpha = Math.acos(Math.max(-1, Math.min(1, (distance * distance + a * a - b * b) / (2 * a * distance))))
  const upper = Math.atan2(dy, dx) + alpha * bend
  const elbow = { x: shoulder.x + Math.cos(upper) * a, y: shoulder.y + Math.sin(upper) * a }
  // 超出可达范围时仍保持骨长，握点不会拉长袖子。
  const end = { x: shoulder.x + dx / (Math.hypot(dx, dy) || 1) * distance, y: shoulder.y + dy / (Math.hypot(dx, dy) || 1) * distance }
  return { upper, lower: Math.atan2(end.y - elbow.y, end.x - elbow.x) }
}
/** 主手收至胸前的可达区，副手沿柄轴接握；只调整姿态，世界判定不变。 */
export function applySupportGrip(pose: PlayerPose, worldAngle: number, grip: WeaponGrip): void {
  const weight = clamp01(grip.weight)
  pose.weaponAngle = undefined; pose.supportWeaponAngle = undefined; pose.supportGripWeight = undefined; pose.gripInFront = undefined
  if (weight <= 0) return
  const angle = pose.dir === 'right' ? Math.PI - worldAngle : worldAngle
  const shoulders = armShoulders(pose.dir), bone = pose.bone
  const end = (shoulder: { x: number; y: number }, upper: number, lower: number) => ({
    x: shoulder.x + Math.cos(upper) * ARM_RIG.upper + Math.cos(lower) * ARM_RIG.lower,
    y: shoulder.y + Math.sin(upper) * ARM_RIG.upper + Math.sin(lower) * ARM_RIG.lower
  })
  const originalNear = end(shoulders.near, bone.armNearUpper, bone.armNearLower)
  const originalFar = end(shoulders.far, bone.armFarUpper, bone.armFarLower)
  const near = grip.main ?? { x: Math.cos(angle) * 2.2, y: ARM_RIG.shoulderY + Math.sin(angle) * 2.2 }
  const far = grip.support ?? { x: near.x + Math.cos(angle) * grip.offset, y: near.y + Math.sin(angle) * grip.offset }
  const blend = (from: { x: number; y: number }, to: { x: number; y: number }, amount: number) => ({ x: from.x + (to.x - from.x) * amount, y: from.y + (to.y - from.y) * amount })
  if (!grip.onlySupport) {
    const n = solveArm(shoulders.near, blend(originalNear, near, clamp01(grip.mainWeight ?? weight)), grip.nearBend ?? -1)
    bone.armNearUpper = n.upper; bone.armNearLower = n.lower
  }
  const supportWeight=clamp01(grip.supportWeight??weight)
  if(supportWeight>0){
    const f = solveArm(shoulders.far, blend(originalFar, far, supportWeight), grip.farBend ?? 1)
    bone.armFarUpper = f.upper; bone.armFarLower = f.lower
  }
  if (!grip.onlySupport) pose.weaponAngle = grip.weaponAngle===undefined?angle:pose.dir==='right'?Math.PI-grip.weaponAngle:grip.weaponAngle
  pose.supportWeaponAngle = grip.supportWeaponAngle === undefined ? undefined : pose.dir === 'right' ? Math.PI - grip.supportWeaponAngle : grip.supportWeaponAngle
  pose.supportGripWeight = supportWeight
  pose.gripInFront = grip.inFront
  if (grip.inFront !== undefined) pose.weaponInFront = grip.inFront
}
