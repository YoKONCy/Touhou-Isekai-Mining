import type { HeldWeaponView, WeaponMotionView, WeaponGrip, WeaponBodyMotion, WeaponResource } from '../../../types'
import { quantizeDir4 } from '../../../../../game/art/rig/skeleton'
import { rigPalmOffset } from '../../../../../game/art/rig/handGrip'
import { NUNCHAKU_VISUAL_SCALE } from './stats'

const clamp = (x: number): number => Math.max(0, Math.min(1, x))
const mix = (a: number, b: number, t: number): number => a + (b - a) * t
const smooth = (p: number): number => { const t = clamp(p); return t * t * (3 - 2 * t) }
const angleMix = (a: number, b: number, p: number): number => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * p
const pointMix = (a: { x: number; y: number }, b: { x: number; y: number }, p: number) => ({ x: mix(a.x, b.x, p), y: mix(a.y, b.y, p) })
export function nunchakuProgress(v: WeaponMotionView): number {
  const duration = v.phase === 'windup' ? v.move.windup : v.phase === 'active' ? v.move.active : v.move.recover
  return clamp(1 - v.timer / Math.max(.001, duration))
}

/** 两手分别控制一根棍：左击由近手领击，右击由远手领击，另一手始终握住另一端。 */
function nunchakuLayout(v: WeaponMotionView) {
  const idle = v.phase === 'none', dir = quantizeDir4(idle ? v.bodyFacing ?? v.facing : v.aim)
  const side = dir === 'left' || dir === 'right', p = nunchakuProgress(v)
  const world = (angle: number) => dir === 'right' ? Math.PI - angle : angle
  // 前手在腰前让棍下垂，后手越肩收在背后；侧面明确一前一后、一低一高。
  const readyMain = { x: side ? -7.6 : dir === 'up' ? -7.3 : 7.3, y: -3.6 }
  const readySupport = { x: side ? 6.5 : dir === 'up' ? 10.8 : -10.8, y: side ? -14 : -13.2 }
  const idleMain = world(Math.PI / 2 + (dir === 'up' ? -.12 : .12))
  const idleSupport = world(Math.PI / 2 + (side ? -.22 : dir === 'up' ? -.24 : .24))
  const gait = Math.sin(v.gaitPhase ?? 0) * .2 * (v.gaitWeight ?? 0)
  readyMain.y += gait; readySupport.y -= gait
  if (idle || v.segment === 2) {
    const guard = idle ? 0 : v.phase === 'windup' ? smooth(p) : v.phase === 'recover' ? 1 - smooth(p) : 1
    return { dir, rear: 1, main: { ...readyMain, y: readyMain.y - guard * .8 }, support: { ...readySupport, y: readySupport.y - guard * .5 },
      mainAngle: idleMain + guard * .1, supportAngle: idleSupport - guard * .1 }
  }
  const direction = v.segment === 0 ? 1 : -1, arc = v.move.arc ?? Math.PI / 3
  const stroke = v.phase === 'windup' ? v.aim - direction * arc
    : v.phase === 'active' ? v.aim - direction * arc + direction * arc * 2 * smooth(p)
    : v.aim + direction * arc
  const guard = stroke - direction * .22
  const amount = v.phase === 'windup' ? smooth(p) : v.phase === 'recover' ? 1 - smooth(p) : 1
  const mainAngle = angleMix(idleMain, v.segment === 0 ? stroke : guard, amount)
  const supportAngle = angleMix(idleSupport, v.segment === 1 ? stroke : guard, amount)
  const punch = v.phase === 'active' ? Math.sin(p * Math.PI) : 0
  const localAim = dir === 'right' ? Math.PI - v.aim : v.aim
  const mainTarget = { x: side ? -8.4 : readyMain.x * .85, y: -4.6 }
  const supportTarget = { x: side ? -4.8 : dir === 'up' ? 6.6 : -6.6, y: -7.4 }
  const striking = v.segment === 0 ? mainTarget : supportTarget
  striking.x += Math.cos(localAim) * punch * (v.segment === 0 ? 1.4 : .8)
  striking.y += Math.sin(localAim) * punch * 1.2
  return { dir, rear: 1 - amount, main: pointMix(readyMain, mainTarget, amount), support: pointMix(readySupport, supportTarget, amount), mainAngle, supportAngle }
}

export const nunchakuArm = (v: WeaponMotionView): number => nunchakuLayout(v).mainAngle
export function nunchakuGrip(v: WeaponMotionView): WeaponGrip {
  const layout = nunchakuLayout(v), nearBend: 1 | -1 = layout.dir === 'down' ? -1 : 1
  const rear = layout.rear > .5
  return { offset: 0, weight: 1, supportWeight: 1, main: layout.main, support: layout.support,
    weaponAngle: layout.mainAngle, supportWeaponAngle: layout.supportAngle,
    nearBend, farBend: -nearBend as 1 | -1, palmOffset: rigPalmOffset(),
    inFront: !rear || layout.dir !== 'up', supportInFront: !rear || layout.dir === 'up', accessoryInFront: !rear }
}

/** 第三段先抬膝，迅速伸腿并短暂停留，再收腿复位；只覆盖本段的腿骨。 */
export function nunchakuBodyMotion(v: WeaponMotionView): WeaponBodyMotion | undefined {
  if (v.phase === 'none') return undefined
  const p = nunchakuProgress(v), dir = quantizeDir4(v.aim), side = dir === 'left' || dir === 'right'
  if (v.segment !== 2) {
    const force = v.phase === 'active' ? Math.sin(p * Math.PI) : 0
    return { facing: v.aim, rootX: Math.cos(v.aim) * force * 1.8, rootY: Math.sin(v.aim) * force * 1.2,
      lean: (v.segment === 0 ? 1 : -1) * force * .09 }
  }
  const lift = v.phase === 'windup' ? smooth(p) : v.phase === 'recover' ? 1 - smooth(p) : 1
  const extension = v.phase === 'active' ? smooth(p / .24) * (1 - smooth((p - .7) / .3)) : 0
  const raised = side ? 4.55 : dir === 'up' ? 3.95 : -.95
  const kicked = side ? Math.PI + .3 : dir === 'up' ? -2.25 : .45
  // 折膝时小腿向后收，不让脚在蓄势时就已经前伸，保证踢出的行程清楚可见。
  const foldedShin = side ? .8 : dir === 'up' ? 1.1 : 2.4
  const thigh = angleMix(Math.PI / 2, angleMix(raised, kicked, extension), lift)
  const shin = angleMix(Math.PI / 2, angleMix(foldedShin, kicked - .22, extension), lift)
  const chamber = lift * (1 - extension), push = -3.2 * chamber + 5 * extension
  return { facing: v.aim, rootX: Math.cos(v.aim) * push, rootY: -1.6 * lift + Math.sin(v.aim) * extension * 2,
    lean: Math.cos(v.aim) * (.14 * chamber - .3 * extension), tilt: -Math.cos(v.aim) * extension * .065,
    legs: { near: { thigh, shin, scale: 1 + .05 * lift + .2 * extension },
      far: { thigh: Math.PI / 2 + .22 * lift - .14 * extension, shin: Math.PI / 2 - .3 * lift } } }
}

let rod: HTMLCanvasElement | null = null
/** 两根棍和动作残影共用一次烘焙的木纹，避免逐帧创建渐变。 */
function rodSprite(): HTMLCanvasElement {
  if (rod) return rod
  const canvas = document.createElement('canvas'); canvas.width = 48; canvas.height = 16
  const g = canvas.getContext('2d')!; g.scale(2, 2); g.translate(2, 4)
  g.fillStyle = '#624330'; g.strokeStyle = '#271e1f'; g.lineWidth = .7
  g.beginPath(); g.roundRect(0, -1.7, 19, 3.4, .7); g.fill(); g.stroke()
  g.fillStyle = '#a3815b'; g.fillRect(.3, -1.4, 18.4, .65)
  g.fillStyle = '#36292a'; g.fillRect(.3, .65, 18.4, .7)
  g.fillStyle = '#6c6f71'; g.fillRect(0, -1.7, 2, 3.4); g.fillRect(17, -1.7, 2, 3.4)
  g.fillStyle = '#c5ba95'; g.fillRect(.3, -1.6, 1.4, .6); g.fillRect(17.3, -1.6, 1.4, .6)
  g.strokeStyle = '#b0926b'; g.lineWidth = .5
  for (let i = 6; i <= 12; i += 2) { g.beginPath(); g.moveTo(i, -1.4); g.lineTo(i + .7, 1.4); g.stroke() }
  rod = canvas
  return canvas
}
export function drawNunchakuRod(g: CanvasRenderingContext2D): void {
  g.save(); g.scale(NUNCHAKU_VISUAL_SCALE, NUNCHAKU_VISUAL_SCALE)
  g.drawImage(rodSprite(), -2, -4, 24, 8); g.restore()
}
export function drawNunchaku(g: CanvasRenderingContext2D, _v: HeldWeaponView): void {
  // 手握靠近链环的一端，棍身从拳头向外伸出，避免棍尾贴回肩膀形成抱持感。
  g.save(); g.translate(-3 * NUNCHAKU_VISUAL_SCALE, 0); drawNunchakuRod(g); g.restore()
}

/** 链条连接两只手实际握住的棍端，两根棍都固定在各自手心。 */
export const drawNunchakuChain: NonNullable<WeaponResource['drawAccessory']> = (g, v) => {
  const layout = nunchakuLayout(v), length = -3 * NUNCHAKU_VISUAL_SCALE
  const supportAngle = v.supportHand.angle ?? layout.supportAngle
  const a = { x: v.hand.x + Math.cos(v.hand.angle) * length, y: v.hand.y + Math.sin(v.hand.angle) * length }
  const b = { x: v.supportHand.x + Math.cos(supportAngle) * length, y: v.supportHand.y + Math.sin(supportAngle) * length }
  const distance = Math.hypot(b.x - a.x, b.y - a.y)
  // 蓄势时链条越过肩部，画在躯干后层，不横穿面部；挥击后恢复自然下垂。
  const sag = mix(Math.max(1, Math.min(5, 9 - distance * .4)), -Math.min(6, Math.max(3, distance * .28)), layout.rear)
  const segments = Math.max(4, Math.ceil(distance / 2.7)), points: Array<{ x: number; y: number }> = []
  g.save(); g.lineCap = 'round'; g.beginPath()
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, point = { x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) + Math.sin(t * Math.PI) * sag }
    points.push(point); if (i === 0) g.moveTo(point.x, point.y); else g.lineTo(point.x, point.y)
  }
  g.strokeStyle = '#30313b'; g.lineWidth = 1.5; g.stroke()
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1]!, to = points[i]!
    g.beginPath(); g.ellipse((from.x + to.x) / 2, (from.y + to.y) / 2, 1.6, i % 2 ? .85 : .45, Math.atan2(to.y - from.y, to.x - from.x), 0, Math.PI * 2)
    g.strokeStyle = i % 2 ? '#c6baa3' : '#859093'; g.lineWidth = .65; g.stroke()
  }
  g.restore()
}
