import type { Dir4, PlayerPose } from './skeleton'
import { drawKedamaCharacter, drawKedamaBossWings } from './kedamaGirlAppearance'
import { drawRumiaRuntime } from './rumiaRuntime'

export type FourthCharacterExpression = 'neutral' | 'happy' | 'hungry' | 'scared' | 'hurt' | 'sleeping' | 'playful'
export interface FourthCharacterOptions { expression?: FourthCharacterExpression; bound?: boolean; overload?: number; cast?: number; wingDroop?: number; lean?: number; sideCast?: number }
type CharacterKind = 'rumia'
const INK = '#30283d', TAU = Math.PI * 2
const shapePaths = new Map<string, Path2D>()
const palettes = {
  rumia: { hair: '#e9c974', hairShade: '#b89651', hairHi: '#ffe6a0', dress: '#3b3849', dressShade: '#262636', dressHi: '#565062', trim: '#f2e9d6', ribbon: '#bd4050', iris: '#ac4452', shoes: '#3d323b' },
}

function shape(g: CanvasRenderingContext2D, path: string, fill: string, width = .85): void {
  let p = shapePaths.get(path)
  if (!p) { p = new Path2D(path); shapePaths.set(path, p) }
  g.fillStyle = fill; g.strokeStyle = INK; g.lineWidth = width; g.fill(p); g.stroke(p)
}
function oval(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string): void {
  g.fillStyle = fill; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill()
}
function bow(g: CanvasRenderingContext2D, color: string, flutter: number): void {
  g.save(); g.rotate(flutter)
  shape(g, 'M0 0Q-5-6-9-4L-8 3Q-4 5 0 1Q4 5 8 3L9-4Q5-6 0 0Z', color, .7)
  shape(g, 'M-1-1L-4 7L0 6L2 1L5 6L8 7L4-1Z', color, .65)
  g.strokeStyle = '#f9c8bb60'; g.lineWidth = .5; g.beginPath(); g.moveTo(-7, -2); g.lineTo(-2, 0); g.moveTo(2, 0); g.lineTo(7, -2); g.stroke()
  shape(g, 'M-2-2Q0-3 2-2L2 2Q0 3-2 2Z', color, .6); g.restore()
}
function fluff(g: CanvasRenderingContext2D, x: number, y: number, scale = 1): void {
  g.save(); g.translate(x, y); g.scale(scale, scale)
  shape(g, 'M-6 2Q-9-1-5-3Q-6-7-2-6Q1-9 3-5Q7-6 7-2Q10 1 6 4Q2 7-2 5Q-6 7-6 2Z', '#e7dfce', .65)
  g.strokeStyle = '#aaa2b877'; g.lineWidth = .55; g.beginPath(); g.moveTo(-4, -2); g.quadraticCurveTo(-2, -4, 0, -2); g.moveTo(3, 1); g.lineTo(5, 0); g.stroke(); g.restore()
}

function leg(g: CanvasRenderingContext2D, x: number, angle: number, lower: number, kind: CharacterKind, far: boolean): void {
  const m = palettes[kind]
  g.save(); g.translate(x, 7)
  const kneeX = Math.cos(angle) * 5.4, kneeY = Math.sin(angle) * 5.4, fx = kneeX + Math.cos(lower) * 5.4, fy = kneeY + Math.sin(lower) * 5.4
  g.strokeStyle = INK; g.lineWidth = 4.4; g.beginPath(); g.moveTo(0, 0); g.lineTo(kneeX, kneeY); g.lineTo(fx, fy); g.stroke()
  g.strokeStyle = far ? '#dec4aa' : '#ffdbbc'; g.lineWidth = 2.9; g.stroke()
  g.strokeStyle = far ? '#c8c7c4' : '#eee9df'; g.lineWidth = 3.1; g.beginPath(); g.moveTo(kneeX * .92 + (fx - kneeX) * .3, kneeY + (fy - kneeY) * .3); g.lineTo(fx, fy); g.stroke()
  g.save(); g.translate(fx, fy); shape(g, 'M-2.1-1L1.8-1Q4 0 3.5 2.3L-2.2 2.4Q-3 1-2.1-1Z', m.shoes, .7)
  g.strokeStyle = '#bab0a388'; g.lineWidth = .5; g.beginPath(); g.moveTo(-1.8, 1.5); g.lineTo(2.8, 1.4); g.stroke(); g.restore(); g.restore()
}

function sleeve(g: CanvasRenderingContext2D, x: number, upper: number, lower: number, kind: CharacterKind, far: boolean, cast: number): void {
  const m = palettes[kind], u = upper * (1 - cast) + (x < 0 ? 2.85 : .3) * cast
  const ex = x + Math.cos(u) * 4.3, ey = -5 + Math.sin(u) * 4.3, hx = ex + Math.cos(lower) * 4.1, hy = ey + Math.sin(lower) * 4.1
  g.save(); g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.moveTo(x, -5); g.lineTo(ex, ey); g.lineTo(hx, hy); g.stroke()
  g.strokeStyle = far ? '#c5c0be' : '#eee7dc'; g.lineWidth = 4.7; g.stroke()
  g.strokeStyle = far ? '#96929d' : '#b8b4ba'; g.lineWidth = .6; g.beginPath(); g.moveTo(ex - 1, ey); g.lineTo(hx - 1, hy - .7); g.stroke()
  g.save(); g.translate(hx, hy); g.rotate(lower - Math.PI / 2)
  shape(g, 'M-2.7-1.8L2.7-1.8L2.2.5L-2.2.5Z', m.trim, .65)
  oval(g, 0, 1.5, 1.9, 2.2, '#ffd9ba'); g.strokeStyle = '#c89d8c'; g.lineWidth = .5; g.beginPath(); g.moveTo(-.8, 1.6); g.lineTo(.7, 2.4); g.stroke(); g.restore(); g.restore()
}

function torso(g: CanvasRenderingContext2D, kind: CharacterKind, dir: Dir4, time: number, phase: number): void {
  const m = palettes[kind], side = dir === 'left', back = dir === 'up', sway = Math.sin(phase) * .5
  g.save(); g.translate(sway, 0)
  // 高腰裙身和分离的裙褶，黑裙与灰紫裙保持不同的轮廓辨识。
  shape(g, side ? 'M-4-9L5-8L5 0Q7 5 8 9Q1 12-8 9L-5 0Z' : 'M-5-9L5-9L6-1Q8 4 10 9Q0 14-10 9L-6-1Z', m.dress, 1)
  shape(g, side ? 'M1-7L5-7L5 0L7 8L2 9Z' : 'M4-7L5-1L9 8L5 10L1 1Z', m.dressShade, .4)
  g.fillStyle = m.dressHi; g.globalAlpha *= .5; g.beginPath(); g.moveTo(-4, -6); g.lineTo(-2, 0); g.lineTo(-5, 9); g.lineTo(-7, 8); g.closePath(); g.fill(); g.globalAlpha /= .5
  g.strokeStyle = m.dressShade; g.lineWidth = .65
  for (const x of [-5, 0, 5]) { g.beginPath(); g.moveTo(x * .45, 0); g.quadraticCurveTo(x * .7, 4, x, 9); g.stroke() }
  g.strokeStyle = m.trim; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-8, 9.5); g.quadraticCurveTo(0, 13, 8, 9.5); g.stroke()
  if (!back) {
    shape(g, side ? 'M-4-9L4-9L2-5L-1-6Z' : 'M-5-9L0-7L5-9L3-4L0-6L-3-4Z', m.trim, .6)
    g.save(); g.translate(side ? -1 : 0, -5.6); g.scale(.42, .42); bow(g, m.ribbon, Math.sin(time * 2) * .035); g.restore()
  } else {
    g.strokeStyle = m.dressHi; g.lineWidth = .7; g.beginPath(); g.moveTo(0, -6); g.lineTo(0, 3); g.stroke()
  }
  g.restore()
}

function eye(g: CanvasRenderingContext2D, x: number, y: number, color: string, expression: FourthCharacterExpression, blink: boolean, look: number): void {
  if (blink || expression === 'sleeping' || expression === 'happy') { g.strokeStyle = '#5c4154'; g.lineWidth = .8; g.beginPath(); g.moveTo(x - 2, y); g.quadraticCurveTo(x, y + (expression === 'happy' ? -1.6 : 1.3), x + 2, y); g.stroke(); return }
  if (expression === 'scared') { g.strokeStyle = '#513d55'; g.lineWidth = .9; g.beginPath(); g.moveTo(x - 2, y - 1.4); g.lineTo(x + 1, y); g.lineTo(x - 2, y + 1.5); g.stroke(); return }
  oval(g, x, y + .1, 2.1, 2.45, '#fff5e3'); oval(g, x + look, y + .25, 1.45, 2.1, color); oval(g, x + look, y + .55, .65, 1.5, '#493040')
  oval(g, x + look - .55, y - .7, .65, .8, '#fffdf1'); oval(g, x + look + .5, y + 1.1, .38, .4, '#e5c1ae')
  g.strokeStyle = '#50394d'; g.lineWidth = .8; g.beginPath(); g.moveTo(x - 2.2, y - 1.8); g.quadraticCurveTo(x, y - 2.3, x + 1.8, y - 1.8); g.stroke()
}

function head(g: CanvasRenderingContext2D, kind: CharacterKind, dir: Dir4, pose: PlayerPose, expression: FourthCharacterExpression, overload: number): void {
  const m = palettes[kind], back = dir === 'up', side = dir === 'left', t = pose.time
  g.save(); g.translate(0, -16); g.rotate((pose.bone.head + Math.PI / 2) * .2)
  // 刘海前后分层；背向完全遮住脸，侧向保留鼻尖和单眼。
  shape(g, 'M-10 0Q-12-10-4-12Q5-15 10-7Q12-1 9 6L5 8L-8 7Z', m.hairShade, 1)
  if (!back) {
    shape(g, side ? 'M-7-5Q3-8 6-1L4 3Q3 7-3 7Q-8 5-8 1L-10 0L-8-1Z' : 'M-8-5Q0-10 8-5L8 2Q6 9 0 9Q-7 8-8 2Z', '#ffdcbd', .75)
    oval(g, side ? -5 : -5.2, 3.5, 2, .85, '#edab9b66'); if (!side) oval(g, 5.2, 3.5, 2, .85, '#edab9b66')
    const blink = (t + .8) % 4.9 < .13, look = Math.cos(pose.aim) * .45
    if (side) eye(g, -4.7, .4, m.iris, expression, blink, -.2); else { eye(g, -3.7, .4, m.iris, expression, blink, look); eye(g, 3.7, .4, m.iris, expression, blink, look) }
    if (expression === 'hungry' || expression === 'scared' || expression === 'hurt') { oval(g, side ? -4.2 : 0, 5.4, expression === 'hungry' ? 1.25 : 2, expression === 'hungry' ? 1.3 : 2.2, '#884d57'); oval(g, side ? -4.2 : 0, 6.2, .9, .65, '#e1a097') }
    else { g.strokeStyle = '#aa6d64'; g.lineWidth = .65; g.beginPath(); g.moveTo(side ? -5.4 : -1.3, 5.6); g.quadraticCurveTo(side ? -4.1 : 0, expression === 'happy' ? 7 : 6.6, side ? -3 : 1.3, 5.6); g.stroke() }
  }
  if (back) {
    shape(g, 'M-10-4Q-9-14 0-13Q11-12 11-2L8 8L5 6L2 9L-2 6L-5 9L-10 6Z', m.hair, .85)
    g.strokeStyle = m.hairShade; g.lineWidth = .8; g.beginPath(); g.moveTo(-4, -10); g.quadraticCurveTo(-7, -1, -5, 7); g.moveTo(3, -11); g.quadraticCurveTo(6, -1, 5, 5); g.stroke()
  } else {
    shape(g, side ? 'M-10-5Q-8-14 1-13Q11-10 10 1L8 7L4 6L4-3L1 0L-1-4L-4-1L-5-4L-8-2Z' : 'M-10-4Q-9-14 0-13Q10-13 11-3L9 7L6 6L7-3L4 0L1-4L-1 0L-4-3L-7 0L-8 6L-10 5Z', m.hair, .8)
  }
  g.strokeStyle = m.hairHi; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-6, -9); g.quadraticCurveTo(-2, -12, 3, -10); g.stroke()
  g.strokeStyle = m.hairShade; g.lineWidth = .55; g.beginPath(); g.moveTo(-2, -10); g.lineTo(-3, -5); g.moveTo(4, -9); g.lineTo(5, -4); g.stroke()
  g.save(); g.translate(side ? 7 : 8, -8); g.scale(.63, .63); bow(g, m.ribbon, Math.sin(pose.phase) * .04 + pose.hair * .08); g.restore()
  g.restore()
}

function drawCharacter(g: CanvasRenderingContext2D, x: number, y: number, pose: PlayerPose, kind: CharacterKind, opts: FourthCharacterOptions): void {
  const dir = pose.dir === 'right' ? 'left' : pose.dir, side = dir === 'left', b = pose.bone, cast = Math.max(0, Math.min(1, opts.cast ?? 0)), power = Math.max(0, Math.min(1, opts.overload ?? 0))
  g.save(); g.translate(x + pose.rootX, y + pose.rootY); if (pose.dir === 'right') g.scale(-1, 1)
  g.rotate(pose.rootRot); g.scale(pose.scaleX, pose.scaleY); g.lineCap = 'round'; g.lineJoin = 'round'
  leg(g, side ? 1.4 : -2.5, b.thighFar, b.shinFar, kind, true); leg(g, side ? -1.2 : 2.5, b.thighNear, b.shinNear, kind, false)
  sleeve(g, side ? 2.5 : -5, b.armFarUpper, b.armFarLower, kind, true, cast)
  torso(g, kind, dir, pose.time, pose.phase)
  if (dir === 'up') sleeve(g, side ? -3 : 5, b.armNearUpper, b.armNearLower, kind, false, cast)
  head(g, kind, dir, pose, opts.expression ?? 'neutral', power)
  if (dir !== 'up') sleeve(g, side ? -3 : 5, b.armNearUpper, b.armNearLower, kind, false, cast)
  if (opts.bound) {
    g.strokeStyle = '#6e7d66'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-7, -4); g.lineTo(7, -1); g.moveTo(-7, -1); g.lineTo(7, -4); g.moveTo(-6, 1); g.lineTo(6, 1); g.stroke()
    oval(g, side ? -4 : 0, -10.5, 4, 2, '#7ea98a'); g.strokeStyle = '#335c4e'; g.lineWidth = .65; g.beginPath(); g.ellipse(side ? -4 : 0, -10.5, 4, 2, 0, 0, TAU); g.stroke()
  }
  g.restore()
}

/** 露米娅与其他营地角色共用骨骼姿态，四向行走、呼吸和眨眼连续变化。 */
export function drawRumiaRig(g: CanvasRenderingContext2D, x: number, y: number, pose: PlayerPose, opts: FourthCharacterOptions = {}): void { if (!drawRumiaRuntime(g, x, y, pose, opts)) drawCharacter(g, x, y, pose, 'rumia', opts) }
/** 普通人形单独保留入口，后续营地阶段使用，不提前加入基地。 */
export function drawKedamaGirlRig(g: CanvasRenderingContext2D, x: number, y: number, pose: PlayerPose, opts: FourthCharacterOptions = {}): void { drawKedamaCharacter(g, x, y, pose, opts) }
/** BOSS 固定正面；移动与瞄准不切朝向，骨骼只负责正面呼吸和聚气。 */
export function drawOverloadedKedamaRig(g: CanvasRenderingContext2D, x: number, y: number, pose: PlayerPose, opts: FourthCharacterOptions = {}): void {
  const power = opts.overload ?? 1, time = pose.time
  const alpha = g.globalAlpha
  g.save(); g.translate(x, y); g.rotate(opts.lean ?? 0)
  for (let i = 0; power > 0 && i < 11; i++) {
    const a = time * .45 + i / 11 * TAU, radius = 30 + Math.sin(time * 1.5 + i) * 4, px = Math.cos(a) * radius, py = Math.sin(a) * radius * .65 - 16
    g.globalAlpha = alpha * power * (.18 + (1 + Math.sin(time * 2 + i)) * .13); g.strokeStyle = i % 2 ? '#cba4d8' : '#a5d4cc'; g.lineWidth = .8
    g.beginPath(); g.moveTo(px - 2, py + 4); g.lineTo(px + 1, py); g.lineTo(px - 1, py - 2); g.lineTo(px + 3, py - 5); g.stroke()
    if (i % 3 === 0) { g.save(); g.translate(px, py); g.scale(.19, .19); fluff(g, 0, 0); g.restore() }
  }
  const frontPose: PlayerPose = {
    ...pose, dir: (opts.sideCast ?? 0) > .45 ? 'left' : 'down', aim: Math.PI / 2, rootX: 0, rootRot: 0,
    bone: { thighFar: Math.PI / 2, shinFar: Math.PI / 2, thighNear: Math.PI / 2, shinNear: Math.PI / 2,
      spine: -Math.PI / 2, head: -Math.PI / 2,
      armFarUpper: Math.PI / 2 + Math.sin(time * 1.8) * .035, armFarLower: Math.PI / 2,
      armNearUpper: Math.PI / 2 - Math.sin(time * 1.8) * .035, armNearLower: Math.PI / 2 }
  }
  g.globalAlpha = alpha; g.scale(1.3, 1.3)
  const bob = Math.sin(time * 2.2) * 1.1 - 3
  drawKedamaBossWings(g, 0, bob, frontPose, opts.cast ?? 0, opts.wingDroop ?? 0)
  drawKedamaCharacter(g, 0, bob, frontPose, { ...opts, overload: power }); g.restore()
}
