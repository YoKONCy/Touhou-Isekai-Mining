import type { RumiaStudyExpression } from './rumiaStyleStudy'
import { drawRumiaFaceRound2, drawRumiaStudyMouth, type RumiaFaceRound2Variant, type RumiaMouthStyle } from './rumiaFaceRound2'
export type { RumiaMouthStyle } from './rumiaFaceRound2'

export type RumiaFaceVariant = 'C1' | 'C2' | 'C3' | 'C4' | RumiaFaceRound2Variant
interface FaceSpec {
  shape: string; eyeShape: 'arched' | 'relaxed' | 'round' | 'slender'
  gap: number; eyeY: number; width: number; top: number; bottom: number; tail: number
  iris: number; mouthY: number; blush: number; sideEyeY: number
}
const specs: Record<Exclude<RumiaFaceVariant, RumiaFaceRound2Variant>, FaceSpec> = {
  C1: { shape: 'M-8.7-4.8Q0-9.2 8.7-4.8L8.5 2.7Q7.1 7.2 1.3 9.5Q0 9.9-1.3 9.5Q-7.1 7.2-8.5 2.7Z',
    eyeShape: 'arched', gap: 3.75, eyeY: 1.35, width: 2.85, top: -1.7, bottom: 3.85, tail: -.15, iris: 1.93, mouthY: 7.65, blush: .3, sideEyeY: 1.1 },
  C2: { shape: 'M-8.6-4.8Q0-9 8.6-4.8L8.4 3Q7.2 7.6 1.2 9.3Q0 9.7-1.2 9.3Q-7.2 7.6-8.4 3Z',
    eyeShape: 'relaxed', gap: 3.8, eyeY: 1.55, width: 3.0, top: -.95, bottom: 3.2, tail: .4, iris: 1.9, mouthY: 7.4, blush: .22, sideEyeY: 1.35 },
  C3: { shape: 'M-8.8-5Q0-9.2 8.8-5L8.6 3.1Q8 7.4 3.1 8.7Q0 10.3-3.1 8.7Q-8 7.4-8.6 3.1Z',
    eyeShape: 'round', gap: 3.55, eyeY: 1.75, width: 2.7, top: -1.5, bottom: 3.65, tail: .15, iris: 2.02, mouthY: 7.8, blush: .38, sideEyeY: 1.5 },
  C4: { shape: 'M-8.1-5Q0-9.2 8.1-5L8.1 2.4Q6.5 7.7 1 9.5Q0 10-1 9.5Q-6.5 7.7-8.1 2.4Z',
    eyeShape: 'slender', gap: 3.7, eyeY: 1.6, width: 3.05, top: -1.35, bottom: 2.65, tail: -.25, iris: 1.72, mouthY: 7.4, blush: .17, sideEyeY: 1.3 }
}
const paths = new Map<string, Path2D>(), TAU = Math.PI * 2
function path(d: string): Path2D { let p = paths.get(d); if (!p) { p = new Path2D(d); paths.set(d, p) } return p }
function fill(g: CanvasRenderingContext2D, d: string, color: string, ink?: string, width = .4): void {
  const p = path(d); g.fillStyle = color; g.fill(p)
  if (ink) { g.strokeStyle = ink; g.lineWidth = width; g.stroke(p) }
}
function line(g: CanvasRenderingContext2D, d: string, color: string, width: number): void { g.strokeStyle = color; g.lineWidth = width; g.stroke(path(d)) }
function oval(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string): void { g.fillStyle = color; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill() }

function eyePaths(s: FaceSpec): { outline: Path2D; lid: Path2D } {
  const w = s.width, t = s.top, b = s.bottom, tail = s.tail
  let upper: string
  switch (s.eyeShape) {
    case 'relaxed': upper = 'M'+(-w)+' 0Q'+(-w*.15)+' '+t+' '+w+' '+tail; break
    case 'round': upper = 'M'+(-w)+' .1C'+(-w*.85)+' '+t+' '+(w*.6)+' '+t+' '+w+' '+tail; break
    case 'slender': upper = 'M'+(-w)+' .05Q'+(w*.1)+' '+(t*.95)+' '+w+' '+tail; break
    default: upper = 'M'+(-w)+' .1C'+(-w*.45)+' '+t+' '+(w*.58)+' '+t+' '+w+' '+tail
  }
  const lower = 'Q'+(w*.65)+' '+b+' '+(-w*.55)+' '+(b*.91)+'Q'+(-w*.98)+' '+(b*.65)+' '+(-w)+' .1Z'
  return { outline: path(upper + lower), lid: path(upper) }
}

/** 每种差分改变眼裂本身与五官比例；红瞳始终裁在眼裂中，上睑强调、下缘收轻。 */
function drawEye(g: CanvasRenderingContext2D, s: FaceSpec, side: boolean, sign: number, expression: RumiaStudyExpression): void {
  g.save(); g.scale(side ? .62 : sign, side ? .96 : 1)
  const w = s.width
  if (expression === 'happy') {
    line(g, 'M'+(-w)+' .4Q0-1.7 '+w+' .4', '#47253c', .6); g.restore(); return
  }
  const p = eyePaths(s)
  g.fillStyle = '#fff8ef'; g.fill(p.outline)
  g.save(); g.clip(p.outline)
  // 红瞳仅四层分色，去掉整圈眼眶、鼻部高光与多颗圆形反光的玩偶感。
  const px = side ? -.48 : .04, py = s.bottom * .38, ry = (s.bottom - s.top) * .58
  oval(g, px, py, s.iris, ry, '#a43752')
  g.save(); g.beginPath(); g.rect(-5, 1.5, 10, 5); g.clip(); oval(g, px, py, s.iris, ry, '#e16670'); g.restore()
  oval(g, px - .06, py - .25, .54, ry * .65, '#522338')
  g.fillStyle = '#4b2136'; g.fillRect(-5, -5, 10, 4.48)
  g.fillStyle = '#fff8ef'; g.fillRect(px - .82, .68, .72, .73)
  g.fillStyle = '#f6b3a2'; g.fillRect(px + .63, Math.min(s.bottom - .45, 2.7), .39, .35)
  g.restore()
  g.strokeStyle = '#47253c'; g.lineWidth = .55; g.stroke(p.lid)
  g.fillStyle = '#47253c'; g.beginPath(); g.moveTo(w - .6, s.tail - .1); g.lineTo(w + .66, s.tail - .9); g.lineTo(w + .25, s.tail + .18); g.closePath(); g.fill()
  // 下缘只有小段浅线，眼白和虹膜主导眼形，不再完整包一圈深色。
  line(g, 'M'+(-w*.45)+' '+(s.bottom*.89)+'Q0 '+s.bottom+' '+(w*.48)+' '+(s.bottom*.79), '#bd8082', .22)
  g.restore()
}
function mouth(g: CanvasRenderingContext2D, x: number, y: number, expression: RumiaStudyExpression): void {
  g.save(); g.translate(x, y)
  if (expression === 'curious') { oval(g, 0, 0, .5, .62, '#ac6974') }
  else line(g, expression === 'happy' ? 'M-.9-.1Q0 1.1.9-.1' : 'M-.72-.05Q0 .57.72-.05', '#b7767d', .34)
  g.restore()
}
function front(g: CanvasRenderingContext2D, s: FaceSpec, expression: RumiaStudyExpression, mouthStyle?: RumiaMouthStyle): void {
  fill(g, s.shape, '#ffe5d0', '#8f6570', .34)
  g.save(); g.globalAlpha *= s.blush
  oval(g, -6.4, 5.45, 1.6, .5, '#edaaa7'); oval(g, 6.4, 5.45, 1.6, .5, '#edaaa7'); g.restore()
  for (const sign of [-1, 1]) {
    g.save(); g.translate(sign * s.gap, s.eyeY); drawEye(g, s, false, sign, expression); g.restore()
  }
  line(g, 'M-6-1.5Q-4.1-2.5-2.6-2.1M2.6-2.1Q4.1-2.5 6-1.5', '#bf9390', .28)
  // 正脸省略独立鼻子，嘴与下颌留出小块呼吸空间。
  if (mouthStyle) drawRumiaStudyMouth(g, 0, s.mouthY, mouthStyle)
  else mouth(g, 0, s.mouthY, expression)
}
function side(g: CanvasRenderingContext2D, s: FaceSpec, expression: RumiaStudyExpression, mouthStyle?: RumiaMouthStyle): void {
  fill(g, 'M-6.2-4.9Q-9.5-2.8-8.6.6L-10.25 2.35Q-10.65 2.85-9.45 3.05L-9.1 4.6Q-9.65 5.05-9.15 5.5Q-8.5 8.6-5.6 9.35Q-2.9 9.65-.85 6.85L-.5-2.05Q-2.1-5.8-6.2-4.9Z', '#ffe5d0', '#8f6570', .33)
  g.save(); g.globalAlpha *= s.blush; oval(g, -7.15, 5.35, 1.2, .45, '#edaaa7'); g.restore()
  g.save(); g.translate(-5.7, s.sideEyeY); drawEye(g, s, true, -1, expression); g.restore()
  line(g, 'M-7.7-1.6Q-5.9-2.5-4.15-1.65', '#bf9390', .26)
  if (mouthStyle) drawRumiaStudyMouth(g, -8.6, 5.4, mouthStyle, true)
  else line(g, 'M-9 5.35L-8.18 5.45', '#b7767d', .28)
  fill(g, 'M-.8 1.2Q1.8.2 1.1 3.7Q-.3 5.1-1.2 3.1Z', '#ffe5d0', '#bd8b85', .27)
}

/** 仅供 C 版脸部选型，保持原 C 的头发、服装与头身比例。 */
export function drawRumiaFaceStudy(g: CanvasRenderingContext2D, sideView: boolean, variant: RumiaFaceVariant, expression: RumiaStudyExpression = 'neutral', mouthStyle?: RumiaMouthStyle): void {
  if (variant === 'C5' || variant === 'C6' || variant === 'C7' || variant === 'C8') {
    drawRumiaFaceRound2(g, sideView, variant, expression, mouthStyle); return
  }
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round'
  if (sideView) side(g, specs[variant], expression, mouthStyle); else front(g, specs[variant], expression, mouthStyle)
  g.restore()
}
