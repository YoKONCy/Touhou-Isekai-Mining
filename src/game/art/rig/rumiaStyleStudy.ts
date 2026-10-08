import type { Dir4, PlayerPose } from './skeleton'
import { drawRumiaFaceStudy, type RumiaFaceVariant } from './rumiaFaceStudy'
import { drawRumiaStudyMouth, type RumiaMouthStyle } from './rumiaFaceRound2'

export type RumiaStudyStyle = 'A' | 'B' | 'C' | 'D'
export type RumiaStudyExpression = 'neutral' | 'happy' | 'curious'
interface Style {
  ink: string; hair: string; shade: string; highlight: string; skin: string; cloth: string; clothHi: string; white: string; sleeveShade: string
  headScale: number; headY: number; bodyScale: number; outline: number; eyeWidth: number; eyeTop: number; eyeBottom: number; eyeTilt: number; iris: number; fluff: number
}
const styles: Record<RumiaStudyStyle, Style> = {
  A: { ink: '#46303f', hair: '#f3d38e', shade: '#c99669', highlight: '#fff0bf', skin: '#ffe1c5', cloth: '#342d40', clothHi: '#574356', white: '#f8f1ee', sleeveShade: '#d8c7d7',
    headScale: 1.03, headY: -19.9, bodyScale: 1, outline: .6, eyeWidth: 2.8, eyeTop: -2.15, eyeBottom: 3.2, eyeTilt: -.12, iris: 1.72, fluff: 1 },
  B: { ink: '#55374b', hair: '#f5d9ac', shade: '#cc9b87', highlight: '#fff3d8', skin: '#ffe6d2', cloth: '#352b3a', clothHi: '#5c4252', white: '#f9f1f0', sleeveShade: '#d8c6d7',
    headScale: .91, headY: -22.3, bodyScale: 1.23, outline: .44, eyeWidth: 2.7, eyeTop: -1.45, eyeBottom: 2.25, eyeTilt: -.48, iris: 1.48, fluff: 1.08 },
  C: { ink: '#443043', hair: '#eed09b', shade: '#bd8b75', highlight: '#fff0cd', skin: '#ffe1c5', cloth: '#352b42', clothHi: '#60445a', white: '#fff2ec', sleeveShade: '#d3bfd7',
    headScale: .98, headY: -20.6, bodyScale: 1.07, outline: .66, eyeWidth: 2.6, eyeTop: -1.8, eyeBottom: 2.8, eyeTilt: -.25, iris: 1.6, fluff: .94 },
  D: { ink: '#76505a', hair: '#f5dca3', shade: '#d9b28b', highlight: '#fff6de', skin: '#ffe9ce', cloth: '#574652', clothHi: '#786071', white: '#fff7ed', sleeveShade: '#ddcedc',
    headScale: 1, headY: -20.8, bodyScale: 1.07, outline: .38, eyeWidth: 2.85, eyeTop: -1.95, eyeBottom: 2.95, eyeTilt: -.05, iris: 1.66, fluff: 1.13 }
}
const paths = new Map<string, Path2D>()
const TAU = Math.PI * 2
function p(d: string): Path2D { let v = paths.get(d); if (!v) { v = new Path2D(d); paths.set(d, v) } return v }
function shape(g: CanvasRenderingContext2D, d: string, fill: string, s: Style, width = s.outline): void { const v = p(d); g.fillStyle = fill; g.fill(v); if (width > 0) { g.strokeStyle = s.ink; g.lineWidth = width; g.stroke(v) } }
function line(g: CanvasRenderingContext2D, d: string, color: string, width = .4): void { g.strokeStyle = color; g.lineWidth = width; g.stroke(p(d)) }
function oval(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string): void { g.fillStyle = color; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill() }

function ribbon(g: CanvasRenderingContext2D, s: Style, side: boolean, back: boolean): void {
  g.save(); g.translate(side ? 7 : 8.1, -9.5); g.rotate(side ? .14 : .1)
  shape(g, 'M0 0Q-3-7-8-6L-7.2 2Q-4 4 0 1Q4 5 8 3L8-5Q4-7 0 0Z', '#bb354b', s, .6)
  shape(g, 'M-2 1Q-3 5-6 9L-1 8L1 3Q3 8 6 11L9 10Q5 6 4 0Z', '#b93349', s, .5)
  shape(g, 'M-6.8-5.2L-5.6-5.1L-4.9 2L-6.2 1.9ZM6.4-4.3L7.5-4.4L7.5 2.4L6.2 2.8Z', '#fce9dc', s, 0)
  line(g, 'M-6-3.5L-1.2.3M1.3.4L6-2.6M.5 2L-1.5 6M3 2L6.5 8', '#8f233b', .7)
  shape(g, 'M-1.4-1.6Q0-2.8 1.8-1.6L2 1.4Q0 2.5-1.5 1.4Z', '#d84754', s, .45)
  if (!back) line(g, 'M-6-4L-3.5-3.6M2.5-2.2L5.5-3.3', '#ef7074', .65)
  g.restore()
}

/** 日系眼裂由上睑和下缘围出，虹膜裁在眼裂里，避免眼珠像独立贴在脸上的圆球。 */
function eye(g: CanvasRenderingContext2D, s: Style, expression: RumiaStudyExpression, side: boolean, sign: number): void {
  const w = s.eyeWidth, top = s.eyeTop, bottom = s.eyeBottom
  g.save(); g.scale(side ? .65 : sign, side ? .98 : 1)
  if (expression === 'happy') {
    g.strokeStyle = '#5b273d'; g.lineWidth = .8
    g.beginPath(); g.moveTo(-w, .3); g.bezierCurveTo(-1, -1.5, 1.2, -1.5, w, -.1); g.stroke(); g.restore(); return
  }
  const d = 'M-2.8 0C-1.2-1.8 1.2-1.8 2.8-.2C1.8 2.8-1.8 2.8-2.8 0Z'
  const v = side ? p('M-2.8-.1Q.2-1.8 2.8-.3Q1.5 2.7-2.8 1.8Z') : p(d)
  g.save(); g.scale(w / 2.8, (bottom - top) / 4.3)
  g.fillStyle = '#fff9f3'; g.fill(v); g.save(); g.clip(v)
  const iris = g.createLinearGradient(0, -.9, 0, 2.5)
  iris.addColorStop(0, '#612139'); iris.addColorStop(.45, '#a3324b'); iris.addColorStop(1, '#ed766c')
  g.fillStyle = iris; g.beginPath(); g.ellipse(side ? -.5 : .1, .65, s.iris, 2.45, 0, 0, TAU); g.fill()
  oval(g, side ? -.65 : -.05, .1, .6, 1.8, '#391c30')
  oval(g, -.65, -.15, .63, .55, '#fff7ec'); oval(g, .78, 1.56, .29, .31, '#f6c4a5')
  g.fillStyle = '#4d233733'; g.fillRect(-4, -3, 8, 2.9)
  g.restore(); g.restore()
  g.strokeStyle = '#482235'; g.lineWidth = .75
  g.beginPath(); g.moveTo(-w, 0); g.bezierCurveTo(-w * .4, top, w * .55, top, w + .15, s.eyeTilt); g.stroke()
  line(g, 'M2.2-.9L3.3-1.8', '#482235', .6)
  g.strokeStyle = '#a46e72'; g.lineWidth = .28; g.beginPath(); g.moveTo(-w * .65, bottom * .56); g.quadraticCurveTo(0, bottom, w * .62, bottom * .62); g.stroke()
  g.restore()
}
function frontFace(g: CanvasRenderingContext2D, s: Style, expression: RumiaStudyExpression, style: RumiaStudyStyle, mouthStyle?: RumiaMouthStyle): void {
  const face = style === 'B' ? 'M-8-5Q0-9 8-5L8.2 1.8Q7 7.1 1 9.6Q0 10-1 9.6Q-7 7.1-8.2 1.8Z' : 'M-8.7-5Q0-9.3 8.7-5L8.4 2Q7.2 8.2 1 9.5Q0 9.8-1 9.5Q-7.2 8.2-8.4 2Z'
  shape(g, face, s.skin, s, .48)
  shape(g, 'M-8-4Q-2-7 7-4L7-2Q0-4-7-1Z', '#d8977c20', s, 0)
  oval(g, -6.4, 5, 1.9, .65, '#e7949342'); oval(g, 6.4, 5, 1.9, .65, '#e7949342')
  line(g, 'M-6.8 4.5L-6.5 5.4M-5.7 4.7L-5.4 5.4M5.4 4.7L5.7 5.4M6.5 4.5L6.8 5.4', '#dd999570', .24)
  g.save(); g.translate(-3.65, 1.15); eye(g, s, expression, false, -1); g.restore()
  g.save(); g.translate(3.65, 1.15); eye(g, s, expression, false, 1); g.restore()
  line(g, expression === 'curious' ? 'M-6.1-2.9Q-4.2-4-2.2-3.2M2.2-3.3Q4.1-3.9 6.1-2.9' : 'M-6-2.2Q-4.1-3-2.5-2.7M2.5-2.7Q4.1-3 6-2.2', '#a57b76', .42)
  line(g, 'M.1 4.1L.45 4.3', '#ca9d89', .3)
  if (mouthStyle) drawRumiaStudyMouth(g, 0, 7.1, mouthStyle)
  else if (expression === 'curious') { oval(g, 0, 7.1, .52, .7, '#9f6264') }
  else line(g, expression === 'happy' ? 'M-1.1 6.9Q0 8.4 1.1 6.9' : 'M-1 6.95Q0 7.65 1 6.95', '#a86268', .45)
}

/** 真正侧脸：仅一只近侧眼，鼻尖、嘴唇和下颌落在同一个向左的轮廓上。 */
function sideFace(g: CanvasRenderingContext2D, s: Style, expression: RumiaStudyExpression, mouthStyle?: RumiaMouthStyle): void {
  shape(g, 'M-6.2-5Q-9.5-3-8.7.4L-10.6 2.4Q-11 2.9-9.5 3.1L-9.1 4.7Q-9.9 5.1-9.3 5.6Q-8.6 8.7-5.8 9.3Q-2.8 9.5-.8 6.9L-.4-2Q-2.2-6-6.2-5Z', s.skin, s, .47)
  oval(g, -6.9, 4.9, 1.35, .6, '#e7949340')
  g.save(); g.translate(-5.65, .9); eye(g, s, expression, true, -1); g.restore()
  line(g, 'M-7.4-2.2Q-5.7-3.2-4.1-2.3', '#a57b76', .4)
  if (mouthStyle) drawRumiaStudyMouth(g, -8.65, 5.45, mouthStyle, true)
  else line(g, expression === 'happy' ? 'M-9 5.4Q-8.2 6-7.8 5.5' : 'M-9.05 5.4L-8.15 5.5', '#a86268', .4)
  shape(g, 'M-.8 1.2Q1.8.2 1.1 3.7Q-.3 5.1-1.2 3.1Z', s.skin, s, .35)
}
function hair(g: CanvasRenderingContext2D, s: Style, side: boolean, back: boolean, style: RumiaStudyStyle): void {
  if (back) {
    shape(g, 'M-10-4Q-12-11-4-13Q4-16 10-9Q14-4 11 2L12 6L9.3 5.7L8.5 9L6.2 7.5L3.7 10L1.6 8.1L-.8 10L-2.2 8L-6.2 9.9L-6.3 6.9L-10 8.1L-9.3 4.8L-12 5.1L-10.4 1Z', s.hair, s, .58)
    shape(g, 'M4-11Q12-8 9.8 3L8.5 7L6.8 5.9L4.1 8L4.5 2Q5.6-6 4-11Z', s.shade, s, 0)
    line(g, 'M-5-10Q-9-3-7 3L-8 6M-.5-11Q-3-4-1 2L-2 7M4-9Q6-2 3.5 6M8-5Q10 1 7.8 4', '#a5746980', .45)
    shape(g, 'M-7.6-7.7Q-3.1-12 2-10.6Q-3-9.5-5.8-5.6ZM3.2-10Q6.8-9.2 8.3-5L6.5-5.9Q5.8-8 3.2-10Z', s.highlight, s, 0)
    return
  }
  // 侧面大部分后脑由头发占据，脸只保留朝左的一条窄面，杜绝侧身正脸。
  if (side) {
    shape(g, 'M-1.5-10Q9.7-10 10.8-3Q13 1 9.4 4.5L10.5 7L7.8 6.6L6.9 9.1L4.8 7.4L1.8 9.3L.9 6.1L-1.5 7.6L-1.3 3.3Q.2-3-1.5-10Z', s.hair, s, .5)
    shape(g, 'M4-8Q11-3 7.4 4.3L8.3 6.8L5.5 5.8L3.6 7.2L3.8 1.2Z', s.shade, s, 0)
    line(g, 'M5-8Q8.7-2 5.8 4M1-5Q3-1 .8 4', '#a7786d80', .4)
  } else {
    for (const sign of [-1, 1]) {
      g.save(); g.scale(sign, 1)
      shape(g, 'M7.2-7Q12-3 10.5 1.4L12 3.9L9.2 3.6L9.7 7.2L7 6L5.7 8.2L5.9 4.9Q7.4 2 6.9-2Z', s.hair, s, .47)
      shape(g, 'M8.9-4Q11 1 8.2 4.7L7.2 3.4Q8.9.2 7.9-3Z', s.shade, s, 0)
      line(g, 'M9.2.4L10.7 3.2M7.2 3.7L8.8 6', '#a6776980', .4)
      g.restore()
    }
  }
  shape(g, side ? 'M-10-4Q-11.3-11.6-4-13Q3-15.8 8.2-10Q11.5-6.3 9.4-1.3Q6.6-2.5 5-5Q3.3-1.7.2-2.3Q-2.6-.6-4.2-3.2Q-7.2-1.2-8.4-2.7Z' : 'M-10-4Q-11.3-11.6-4-13Q3-15.8 8.2-10Q11.5-6.3 9.4-1.3Q6.9-2 5.6-5Q3.8-2.4 1.7-3.9Q-.3-1.2-2.5-3.8Q-5.7-.6-7.1-3.3Q-9.2-1.7-10-4Z', s.hair, s, style === 'D' ? .35 : .55)
  // 刘海按大、中、小发束叠放，发梢长度不齐，高光是随发束延伸的面。
  shape(g, side ? 'M-6.2-11.2Q-10-7.4-9.2-2.1L-11 .4Q-7.8.5-6.8-3.1Q-6.2-7-3.2-11.7Z' : 'M-6.2-11.2Q-10-7.4-9.2-2.1L-11 .4Q-7.8.5-5.9-3.1Q-5.4-7-3.2-11.7Z', s.hair, s, .42)
  shape(g, style === 'D' ? 'M-3.6-12.2C-6.6-7.4-2.7-1.5 2.9-.9C.8-3.7-.1-7.9 2-11.6Z' : 'M-3.6-12.2Q-5.3-7.6-2.6-4Q-.2-.7 2.9-.9Q.1-4.4.2-8.1L2-11.6Z', s.hair, s, style === 'D' ? .25 : .4)
  shape(g, style === 'D' ? 'M2.1-12C8.2-10.3 10.2-4.5 9.2.2C7-2 5.5-3 5.6-5Q4.6-7.8 2.1-12Z' : 'M2.1-12Q7.3-10 8.8-3L9.2.2Q6.4-1.2 5.6-5Q4.6-7.8 2.1-12Z', s.hair, s, style === 'D' ? .25 : .4)
  shape(g, 'M-6.4-9.4Q-8.7-6.4-8.7-3.2L-7.2-4.5Q-7.1-7.3-5.2-9.5ZM-2.1-10.7Q-2.9-7.1-.4-4.1L.8-3.6Q-1.1-6.8-.5-9.7ZM3.6-9.9Q5.2-8 6.1-5.3L7.2-4.6Q6.7-8 3.6-9.9Z', s.highlight, s, 0)
  shape(g, 'M-1.8-8.2Q-2.1-5.4 2.2-1.5L.2-2.2Q-2.8-4.3-3.1-6.9Z', s.shade, s, 0)
  if (style === 'B' || style === 'D') line(g, 'M-4.5-10.8Q-6.2-5.1-4.1-3M1.3-10.1Q2.7-7.2 4.4-5M8.2-5.4L8.8-2.3', '#b68a7a80', .28)
  if (style === 'B') line(g, 'M-8-8Q-9-4.5-7.5-2M-1.7-9.4Q-2.4-5-.2-2.8M5.3-8.7L7.4-3.8', '#926f6770', .24)
}
function head(g: CanvasRenderingContext2D, style: RumiaStudyStyle, direction: Dir4, expression: RumiaStudyExpression, faceVariant?: RumiaFaceVariant, mouthStyle?: RumiaMouthStyle): void {
  const s = styles[style], side = direction === 'left', back = direction === 'up'
  g.save(); g.scale(s.fluff, 1)
  shape(g, 'M-10-4Q-12-11-4-13Q4-16 10-9Q14-4 11 2L12 6L9.3 5.7L8.5 9L6.2 7.5L3.7 10L1.6 8.1L-.8 10L-2.2 8L-6.2 9.9L-6.3 6.9L-10 8.1L-9.3 4.8L-12 5.1L-10.4 1Z', s.shade, s, .58)
  g.restore()
  if (!back) {
    if (faceVariant) drawRumiaFaceStudy(g, side, faceVariant, expression, mouthStyle)
    else if (side) sideFace(g, s, expression, mouthStyle)
    else frontFace(g, s, expression, style, mouthStyle)
  }
  hair(g, s, side, back, style)
  ribbon(g, s, side, back)
}
function sleeve(g: CanvasRenderingContext2D, s: Style, x: number, far: boolean, side: boolean): void {
  g.save(); g.translate(x, -9.8); g.rotate(x < 0 ? .13 : -.13)
  shape(g, far ? 'M-2.3 0Q0-2 2.3 0L2.4 3.1L3.2 8.2Q0 10.3-3.2 8.2L-2.4 3.1Z' : 'M-2.8 0Q0-2.2 2.8 0L2.7 3.4L3.8 8.2Q0 10.8-3.8 8.2L-2.7 3.4Z', far ? s.sleeveShade : s.white, s, .48)
  shape(g, 'M.6 2L2.5 4L2.6 7.6L.7 8.4Q1.8 5.7.6 2Z', s.sleeveShade, s, 0)
  line(g, 'M-1.8 2.3Q-2.6 5.1-1.5 7.1', '#ffffffbb', .55)
  shape(g, 'M-3.2 8.1L3.2 8.1L3.1 9.7L1.7 9.1L.5 9.9L-.8 9.3L-2 9.8L-3.1 9.2Z', s.white, s, .3)
  shape(g, 'M-1.5 9.2L1.4 9.2L1.6 12Q.7 13.1-.6 12.6L-1.6 11Z', s.skin, s, .4)
  g.restore()
}
/** 样板行走同样消费正式动画器的骨角，肩、肘和腕依次相连。 */
function walkingSleeve(g: CanvasRenderingContext2D, s: Style, x: number, far: boolean, upper: number, lower: number): void {
  g.save(); g.translate(x, -9.8); g.rotate(upper - Math.PI / 2)
  shape(g, 'M-2.7 0Q0-2 2.7 0L2.5 3.9L-2.5 3.9Z', far ? s.sleeveShade : s.white, s, .45)
  shape(g, 'M.7.6L2.4 1.2L2.2 3.8L1 3.8Z', s.sleeveShade, s, 0)
  g.translate(0, 4.1); g.rotate(lower - upper)
  shape(g, 'M-2.2-.7L2.2-.7L3.3 4.6Q0 6.1-3.3 4.6Z', far ? s.sleeveShade : s.white, s, .45)
  shape(g, 'M.8 0L2.7 4.2L1 4.8Z', s.sleeveShade, s, 0)
  line(g, 'M-1.7.7L-2.1 3.8', '#ffffffaa', .5)
  shape(g, 'M-3.2 4.6L3.2 4.6L3.1 5.8L1.5 5.4L.1 6.1L-1.3 5.6L-2.7 6L-3.1 5.5Z', s.white, s, .28)
  shape(g, 'M-1.5 5.4L1.4 5.4L1.6 7.6Q.6 8.8-.6 8.2L-1.6 6.9Z', s.skin, s, .38)
  g.restore()
}
function walkingLeg(g: CanvasRenderingContext2D, s: Style, x: number, far: boolean, side: boolean, thigh: number, shin: number): void {
  const kx = Math.cos(thigh) * 5.5, ky = Math.sin(thigh) * 5.5
  const ax = kx + Math.cos(shin) * 6.5, ay = ky + Math.sin(shin) * 6.5
  g.save(); g.translate(x, 6)
  g.strokeStyle = s.ink; g.lineWidth = 2.9; g.beginPath(); g.moveTo(0, 0); g.lineTo(kx, ky); g.lineTo(ax, ay); g.stroke()
  g.strokeStyle = far ? '#d6bac0' : '#f7d5be'; g.lineWidth = 2.1; g.stroke()
  g.strokeStyle = s.ink; g.lineWidth = 3.3; g.beginPath(); g.moveTo(kx + (ax-kx)*.12, ky + (ay-ky)*.12); g.lineTo(ax, ay); g.stroke()
  g.strokeStyle = far ? '#d4c1d0' : '#eee7e7'; g.lineWidth = 2.5; g.stroke()
  g.translate(ax, ay)
  shape(g, side ? 'M-1.6-1L1.4-1L1.8 1.8L-3.5 2Q-4.1 1.2-2.6.2Z' : 'M-1.6-1L1.6-1L2.1 1.7Q0 2.7-2.1 1.7Z', s.cloth, s, .42)
  g.restore()
}
function body(g: CanvasRenderingContext2D, s: Style, side: boolean, back: boolean, pose?: PlayerPose): void {
  g.save(); g.scale(s.bodyScale, s.bodyScale)
  for (const [x, far] of (side ? [[1.1, true], [-1.4, false]] : [[-2.3, true], [2.3, false]]) as Array<[number, boolean]>) {
    if (pose) {
      walkingLeg(g, s, x, far, side, far ? pose.bone.thighFar : pose.bone.thighNear, far ? pose.bone.shinFar : pose.bone.shinNear)
      continue
    }
    shape(g, 'M'+(x-1.2)+' 6L'+(x+1.2)+' 6L'+(x+1.4)+' 15L'+(x-1.4)+' 15Z', far ? '#d6bac0' : '#f7d5be', s, .35)
    shape(g, 'M'+(x-1.5)+' 12L'+(x+1.5)+' 12L'+(x+1.5)+' 18L'+(x-1.5)+' 18Z', far ? '#d4c1d0' : '#eee7e7', s, .35)
    g.save(); g.translate(x, 18)
    shape(g, side ? 'M-1.6-1L1.4-1L1.8 1.8L-3.5 2Q-4.1 1.2-2.6.2Z' : 'M-1.6-1L1.6-1L2.1 1.7Q0 2.7-2.1 1.7Z', s.cloth, s, .42); g.restore()
  }
  if (pose) walkingSleeve(g, s, side ? 2.7 : -5.4, true, pose.bone.armFarUpper, pose.bone.armFarLower)
  else sleeve(g, s, side ? 2.7 : -5.4, true, side)
  g.save()
  if (pose) { g.translate(0, -.5); g.rotate((pose.bone.spine + Math.PI/2)*.55 + Math.sin(pose.phase)*.008) }
  shape(g, side ? 'M-3.9-10.3Q.2-12 4-10.3L4.3-1.5Q5.2 3.5 7.6 8.6Q.2 12-8.2 9Q-5 3.5-4.3-1.5Z' : 'M-4.5-10.5Q0-12.6 4.5-10.5L4.9-1.8Q6.1 3 9.3 8.8Q0 13-9.3 8.8Q-6.1 3-4.9-1.8Z', s.cloth, s, .58)
  shape(g, side ? 'M1.5-8L3.4-8L3.6-1L7.1 8.2L3.5 9.2Q1.7 4.8.8-1Z' : 'M1.8-8L4-8L4.5-1L8.2 8.4L4.6 10Q3.2 4 1.7-.8Z', s.clothHi, s, 0)
  line(g, 'M-2.7-1Q-3.7 4.5-5.6 8M.8 3L2.3 8M-1.3 8L.7 6.1', '#93718670', .42)
  shape(g, 'M-8.3 8.7Q0 11.7 8.3 8.7L8.4 10Q0 13.3-8.4 10Z', s.white, s, .25)
  if (!back) {
    shape(g, side ? 'M-4-10.2L2.9-10.2L1.2-7.1L-1.3-8.6L-3.3-6.7Z' : 'M-4.6-10.3L0-8.2L4.6-10.3L3.4-6.5L0-7.8L-3.4-6.5Z', s.white, s, .38)
    g.save(); g.translate(side ? -1 : 0, -6.9)
    shape(g, 'M0-1Q-2.4-3-4-2L-3.5.7L-1.1 0L-2.6 4.8L-.2 4L.5 1L2 5L4 4.5L1.4 0L3.7.7L4-2Q2-3 0-1Z', '#ba354b', s, .4)
    shape(g, 'M-1-.9L1-.9L1 1L-1 1Z', '#d74d59', s, .25)
    line(g, 'M-3-1.5L-1.2-.3M1.2-.3L3-1.5M.8 1.6L2 3.6', '#f0777d', .3)
    g.restore()
  } else line(g, 'M0-8.8L0 2.8', '#7b5f7760', .38)
  g.restore()
  if (pose) walkingSleeve(g, s, side ? -3.3 : 5.4, false, pose.bone.armNearUpper, pose.bone.armNearLower)
  else sleeve(g, s, side ? -3.3 : 5.4, false, side)
  g.restore()
}
/** 风格样板不修改当前角色资源；统一脚底锚点，四种构图用于比较整体画风。 */
export function drawRumiaStyleStudy(g: CanvasRenderingContext2D, x: number, y: number, style: RumiaStudyStyle, direction: Dir4 = 'down', expression: RumiaStudyExpression = 'neutral', faceVariant?: RumiaFaceVariant, mouthStyle?: RumiaMouthStyle): void {
  const s = styles[style], dir: Dir4 = direction === 'right' ? 'left' : direction
  g.save(); g.translate(x, y); if (direction === 'right') g.scale(-1, 1)
  g.lineJoin = 'round'; g.lineCap = 'round'
  body(g, s, dir === 'left', dir === 'up')
  g.save(); g.translate(0, s.headY); g.scale(s.headScale, s.headScale); head(g, style, dir, expression, faceVariant, mouthStyle); g.restore()
  g.restore()
}
export function drawRumiaStyleStudyHead(g: CanvasRenderingContext2D, x: number, y: number, style: RumiaStudyStyle, direction: Dir4 = 'down', expression: RumiaStudyExpression = 'neutral', faceVariant?: RumiaFaceVariant, mouthStyle?: RumiaMouthStyle): void {
  const dir: Dir4 = direction === 'right' ? 'left' : direction
  g.save(); g.translate(x, y); if (direction === 'right') g.scale(-1, 1)
  g.lineJoin = 'round'; g.lineCap = 'round'; head(g, style, dir, expression, faceVariant, mouthStyle); g.restore()
}
export const rumiaStyleStudyIds: readonly RumiaStudyStyle[] = ['A', 'B', 'C', 'D']

/** 输出 C 版身体的真实骨骼姿态，头部由选定的新素材单独接到颈部锚点。 */
export function drawRumiaStudyBodyPose(g: CanvasRenderingContext2D, x: number, y: number, pose: PlayerPose): void {
  const dir = pose.dir === 'right' ? 'left' : pose.dir
  g.save(); g.translate(x, y); if (pose.dir === 'right') g.scale(-1, 1)
  g.lineJoin = 'round'; g.lineCap = 'round'
  body(g, styles.C, dir === 'left', dir === 'up', pose)
  g.restore()
}
