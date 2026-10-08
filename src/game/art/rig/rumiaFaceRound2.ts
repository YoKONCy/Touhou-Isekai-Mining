import type { RumiaStudyExpression } from './rumiaStyleStudy'

export type RumiaFaceRound2Variant = 'C5' | 'C6' | 'C7' | 'C8'
export type RumiaMouthStyle = 'closed' | 'parted' | 'smile'
interface FaceLayout {
  face: string; eye: string; lid: string; spacing: number; y: number
  irisX: number; irisY: number; irisW: number; irisH: number; lash: number; mouthY: number
}
const layouts: Record<RumiaFaceRound2Variant, FaceLayout> = {
  C5: { face: 'M-8.6-5Q0-9.3 8.6-5L8.4 2.5Q7.4 7.3 1.2 9Q0 9.5-1.2 9Q-7.4 7.3-8.4 2.5Z',
    eye: 'M-2.75.15C-1.8-1.8 1.4-1.9 2.75-.15C2.5 2.9-1.8 3.3-2.75.15Z',
    lid: 'M-2.75.15C-1.8-1.8 1.4-1.9 2.75-.15', spacing: 3.75, y: 1.3,
    irisX: .1, irisY: .82, irisW: 1.53, irisH: 2.08, lash: .48, mouthY: 6.9 },
  C6: { face: 'M-8.7-5Q0-9.2 8.7-5L8.6 2.6Q7.5 7.8 1.1 9.2Q0 9.7-1.1 9.2Q-7.5 7.8-8.6 2.6Z',
    eye: 'M-2.6.35C-2.3-2 1.15-2.35 2.6-.05C2.9 3.75-2.05 4-2.6.35Z',
    lid: 'M-2.6.35C-2.3-2 1.15-2.35 2.6-.05', spacing: 3.55, y: 1.35,
    irisX: .05, irisY: 1.01, irisW: 1.78, irisH: 2.56, lash: .5, mouthY: 7.05 },
  C7: { face: 'M-8.55-5Q0-9.1 8.55-5L8.35 2.7Q7.2 7.5 1.2 9Q0 9.4-1.2 9Q-7.2 7.5-8.35 2.7Z',
    eye: 'M-2.95-.05C-1.15-2.25 1.8-1.8 2.95.4C2.15 3.35-1.95 3.2-2.95-.05Z',
    lid: 'M-2.95-.05C-1.15-2.25 1.8-1.8 2.95.4', spacing: 3.7, y: 1.4,
    irisX: -.05, irisY: 1, irisW: 1.66, irisH: 2.13, lash: .47, mouthY: 6.9 },
  C8: { face: 'M-8.45-5Q0-9 8.45-5L8.2 2.2Q7.05 6.95 1.1 8.35Q0 8.8-1.1 8.35Q-7.05 6.95-8.2 2.2Z',
    eye: 'M-2.9.2C-1.9-1.65 1.75-1.75 2.9-.1C2.35 3.2-2.05 3.15-2.9.2Z',
    lid: 'M-2.9.2C-1.9-1.65 1.75-1.75 2.9-.1', spacing: 3.75, y: .95,
    irisX: .06, irisY: .97, irisW: 1.82, irisH: 2.01, lash: .45, mouthY: 6.35 }
}
const paths = new Map<string, Path2D>(), TAU = Math.PI * 2
function p(d: string): Path2D { let v = paths.get(d); if (!v) { v = new Path2D(d); paths.set(d, v) } return v }
function fill(g: CanvasRenderingContext2D, d: string, color: string, ink?: string, w = .35): void { const path = p(d); g.fillStyle = color; g.fill(path); if (ink) { g.strokeStyle = ink; g.lineWidth = w; g.stroke(path) } }
function line(g: CanvasRenderingContext2D, d: string, color: string, w = .35): void { g.strokeStyle = color; g.lineWidth = w; g.stroke(p(d)) }
function oval(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string): void { g.fillStyle = color; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill() }

/** 嘴部独立于眼睛，便于以同一张脸比较闭嘴、轻微张嘴与小幅轻笑。 */
export function drawRumiaStudyMouth(g: CanvasRenderingContext2D, x: number, y: number, style: RumiaMouthStyle, side = false): void {
  g.save(); g.translate(x, y); if (side) g.scale(.6, .85)
  if (style === 'closed') line(g, 'M-.88-.1Q0 .62.88-.1', '#a96773', .46)
  else if (style === 'parted') {
    fill(g, 'M-.78-.35Q0-.82.78-.35L.7.45Q0 1-.7.45Z', '#b77580', '#a0606d', .23)
    fill(g, 'M-.5.3Q0 .13.5.3Q.3.7 0 .65Q-.3.7-.5.3Z', '#f0b4ae')
  } else {
    fill(g, 'M-1.12-.25Q0 .15 1.12-.25Q.8 1.35 0 1.25Q-.8 1.35-1.12-.25Z', '#b16d7b', '#a0606d', .23)
    fill(g, 'M-.58.65Q0 .31.58.65Q.38 1.03 0 1.02Q-.38 1.03-.58.65Z', '#f0b4ae')
  }
  g.restore()
}

/** 重新绘制睁开的眼裂；睫毛只沿上睑，眼白不被横向黑色填充盖掉。 */
function eye(g: CanvasRenderingContext2D, s: FaceLayout, side: boolean, sign: number, expression: RumiaStudyExpression): void {
  g.save(); g.scale(side ? .63 : sign, side ? .97 : 1)
  if (expression === 'happy') { line(g, 'M-2.6.4Q0-1.4 2.6.4', '#4c293e', s.lash); g.restore(); return }
  const eye = p(s.eye); g.fillStyle = '#fff7ef'; g.fill(eye)
  g.save(); g.clip(eye)
  const x = side ? -.38 : s.irisX
  oval(g, x, s.irisY, s.irisW, s.irisH, '#bd3b56')
  // 仅在虹膜自身内部做暗上缘，不再压暗整片眼白。
  g.save(); g.beginPath(); g.ellipse(x, s.irisY, s.irisW, s.irisH, 0, 0, TAU); g.clip()
  g.fillStyle = '#66283f'; g.fillRect(-4, -5, 8, 5.42)
  g.fillStyle = '#eb797e'; g.fillRect(-4, 1.7, 8, 4); g.restore()
  oval(g, x - .04, s.irisY - .26, .45, s.irisH * .7, '#522539')
  oval(g, x - .54, .38, .49, .39, '#fff8ef')
  oval(g, x + .6, 1.81, .22, .27, '#ffd0bc')
  g.restore()
  g.strokeStyle = '#4c293e'; g.lineWidth = s.lash; g.stroke(p(s.lid))
  // 睫毛延长方向贴着上睑切线，不加过大的黑色三角眼尾。
  line(g, 'M2.35-.63L3.02-1.08', '#4c293e', s.lash * .72)
  line(g, 'M-1.3 2.32Q.1 2.95 1.45 2.1', '#cc9598', .2)
  g.restore()
}

export function drawRumiaFaceRound2(g: CanvasRenderingContext2D, side: boolean, variant: RumiaFaceRound2Variant, expression: RumiaStudyExpression, mouthStyle: RumiaMouthStyle = 'closed'): void {
  const s = layouts[variant]
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round'
  if (side) {
    fill(g, 'M-6.2-5Q-9.3-2.7-8.6.5L-10.18 2.4Q-10.55 2.8-9.42 3.03L-9.08 4.7Q-9.65 5.1-9.16 5.53Q-8.5 8.5-5.62 9.2Q-2.85 9.5-.85 6.8L-.48-2Q-2.1-5.7-6.2-5Z', '#ffe3cf', '#a67980', .33)
    g.save(); g.translate(-5.6, s.y - .1); eye(g, s, true, -1, expression); g.restore()
    line(g, 'M-7.5-1.5Q-5.8-2.2-4.45-1.55', '#bf9394', .24)
    drawRumiaStudyMouth(g, -8.65, 5.35, mouthStyle, true)
    fill(g, 'M-.8 1.2Q1.8.2 1.1 3.7Q-.3 5.1-1.2 3.1Z', '#ffe3cf', '#bd8e91', .25)
  } else {
    fill(g, s.face, '#ffe3cf', '#a67980', .33)
    for (const sign of [-1, 1]) {
      g.save(); g.translate(sign * s.spacing, s.y); eye(g, s, false, sign, expression); g.restore()
    }
    g.save(); g.globalAlpha *= .16; oval(g, -6.3, 5.15, 1.35, .4, '#e7a3ac'); oval(g, 6.3, 5.15, 1.35, .4, '#e7a3ac'); g.restore()
    line(g, 'M-6-1.65Q-4.25-2.5-2.7-2.15M2.7-2.15Q4.25-2.5 6-1.65', '#bf9394', .25)
    drawRumiaStudyMouth(g, 0, s.mouthY, mouthStyle)
  }
  g.restore()
}
