import { bakeSprite, drawSprite, SpriteCache } from '../../core/rendering/SpriteCache'

const TAU = Math.PI * 2
const outlines = new Map<number, Path2D>()
const sprites = new SpriteCache()

/** 头饰与小怪共享白色毛团；轮廓只有短绒，内部毛流避开脸部。 */
function outline(r: number): Path2D {
  let p = outlines.get(r)
  if (p) return p
  p = new Path2D()
  for (let i = 0; i <= 36; i++) {
    const a = i / 36 * TAU, q = r * (1 + Math.sin(i * 2.31) * .028)
    const x = Math.cos(a) * q, y = Math.sin(a) * q * .94
    if (!i) p.moveTo(x, y)
    else p.quadraticCurveTo(Math.cos(a - .09) * (q + r * .055), Math.sin(a - .09) * (q + r * .055) * .94, x, y)
  }
  p.closePath()
  if (outlines.size >= 96) outlines.delete(outlines.keys().next().value!)
  outlines.set(r, p); return p
}

export interface KedamaFurOptions { flash?: boolean; face?: boolean; blink?: boolean; crying?: boolean; mouthOpen?: number; angle?: number }

export function drawKedamaFur(g: CanvasRenderingContext2D, r: number, opts: KedamaFurOptions = {}): void {
  if (r <= 0) return
  const radius = Math.max(.25, Math.round(r * 4) / 4)
  const mouth = Math.round(Math.max(0, Math.min(1, opts.mouthOpen ?? .6)) * 8) / 8
  const key = `${radius}:${!!opts.flash}:${opts.face !== false}:${!!opts.blink}:${!!opts.crying}:${mouth}`
  const sprite = sprites.get(key, () => {
    const pad = radius + 3
    return bakeSprite(-pad, -pad, pad * 2, pad * 2, ctx => paintFur(ctx, radius, { ...opts, angle: 0, mouthOpen: mouth }))
  })
  g.save(); g.rotate(opts.angle ?? 0); g.scale(r / radius, r / radius)
  drawSprite(g, sprite); g.restore()
}

/** 仅在缓存未命中时绘制毛流和表情，连续缩放由调用方的变换完成。 */
function paintFur(g: CanvasRenderingContext2D, r: number, opts: KedamaFurOptions): void {
  g.save(); g.rotate(opts.angle ?? 0); g.lineJoin = 'round'; g.lineCap = 'round'
  const path = outline(r), coat = g.createLinearGradient(-r, -r, r * .5, r)
  coat.addColorStop(0, '#fffdf4'); coat.addColorStop(.6, '#f0eee7'); coat.addColorStop(1, '#c9c8d0')
  g.fillStyle = opts.flash ? '#ffffff' : coat; g.fill(path); g.strokeStyle = '#534858'; g.lineWidth = Math.max(.65, r * .055); g.stroke(path)
  g.strokeStyle = '#b8b2bf77'; g.lineWidth = Math.max(.35, r * .03)
  for (let i = 0; i < 13; i++) {
    const a = i / 13 * TAU + .07, x = Math.cos(a) * r * .84, y = Math.sin(a) * r * .79
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - Math.cos(a) * r * .09 - Math.sin(a) * r * .035, y - Math.sin(a) * r * .09, x - Math.cos(a) * r * .14, y - Math.sin(a) * r * .12); g.stroke()
  }
  if (opts.face !== false) {
    // 空心圆眼与梯形张嘴组成囧脸，不使用普通小怪的实心萌眼和微笑。
    g.strokeStyle = '#4c3c49'; g.lineWidth = Math.max(.7, r * .055)
    for (const sign of [-1, 1]) {
      const x = sign * r * .34, y = -r * .29
      g.beginPath()
      if (opts.crying) { g.moveTo(x - r * .12, y + sign*r*.04); g.quadraticCurveTo(x, y-r*.07, x + r*.12, y-sign*r*.04) }
      else if (opts.blink) { g.moveTo(x - r * .085, y); g.quadraticCurveTo(x, y + r * .04, x + r * .085, y) }
      else { g.ellipse(x, y, r * .105, r * .13, sign * .13, 0, TAU); g.fillStyle = '#fffdf5'; g.fill() }
      g.stroke()
      if (opts.crying) {
        g.fillStyle = '#96d5ef'; g.strokeStyle = '#5b90b0'; g.lineWidth = Math.max(.4,r*.025)
        g.beginPath(); g.moveTo(x-r*.07,y+r*.02); g.quadraticCurveTo(x-r*.1,r*.25,x-r*.09,r*.42); g.quadraticCurveTo(x,r*.53,x+r*.07,r*.42); g.lineTo(x+r*.055,y+r*.03); g.closePath(); g.fill(); g.stroke()
        g.strokeStyle = '#4c3c49'; g.lineWidth = Math.max(.7,r*.055)
      }
    }
    const open = Math.max(0, Math.min(1, opts.mouthOpen ?? .6)), top = -r * .07, bottom = r * (.34 + open * .1)
    if (opts.crying) {
      g.fillStyle='#9e7183'; g.beginPath(); g.moveTo(-r*.17,r*.15); g.quadraticCurveTo(0,-r*.03,r*.17,r*.15); g.lineTo(r*.12,r*.28); g.quadraticCurveTo(0,r*.18,-r*.12,r*.28); g.closePath(); g.fill(); g.stroke()
    } else {
    g.fillStyle = '#edaa91'; g.beginPath(); g.moveTo(-r * .12, top); g.lineTo(r * .13, top - r * .025); g.lineTo(r * .245, bottom); g.lineTo(-r * .235, bottom + r * .02); g.closePath(); g.fill(); g.stroke()
    g.strokeStyle = '#f9ccb5'; g.lineWidth = Math.max(.35, r * .035); g.beginPath(); g.moveTo(-r * .13, bottom - r * .055); g.lineTo(r * .14, bottom - r * .055); g.stroke()
    }
  }
  g.restore()
}
