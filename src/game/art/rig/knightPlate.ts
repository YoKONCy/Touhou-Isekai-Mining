import type { PlayerAppearance } from '../../../shared/playerAppearance'

type Facing = 'front' | 'side' | 'back'
type Bounds = readonly [number, number, number, number]
const steel = {
  ink: '#30333c', deep: '#444b58', shadow: '#6a7480', mid: '#a3acb4',
  light: '#d9dee0', shine: '#f5f3e9', mail: '#41444a', lining: '#25282e',
  strap: '#753b40', brass: '#b9a072',
} as const
const atlases = new WeakMap<HTMLImageElement, HTMLCanvasElement>()

function shape(g: CanvasRenderingContext2D, path: string, fill: string | CanvasGradient, width = .28): void {
  const outline = new Path2D(path)
  g.fillStyle = fill; g.fill(outline)
  if (width) { g.strokeStyle = steel.ink; g.lineWidth = width; g.stroke(outline) }
}
function line(g: CanvasRenderingContext2D, path: string, color: string = steel.light, width = .2): void {
  g.strokeStyle = color; g.lineWidth = width; g.stroke(new Path2D(path))
}

/** 高光沿钢板的弧面展开，明暗大面负责体积，接缝只保留必要的细边。 */
function metal(g: CanvasRenderingContext2D, path: string, bounds: Bounds, dark = false): void {
  const fill = g.createLinearGradient(...bounds)
  fill.addColorStop(0, dark ? steel.deep : steel.shadow)
  fill.addColorStop(.24, dark ? steel.shadow : steel.light)
  fill.addColorStop(.4, dark ? steel.mid : steel.shine)
  fill.addColorStop(.56, dark ? steel.shadow : steel.mid)
  fill.addColorStop(1, dark ? steel.deep : steel.shadow)
  shape(g, path, fill)
}
function rivet(g: CanvasRenderingContext2D, x: number, y: number): void {
  g.fillStyle = steel.deep; g.beginPath(); g.arc(x, y, .28, 0, Math.PI * 2); g.fill()
  g.fillStyle = steel.shine; g.fillRect(x - .13, y - .18, .22, .18)
}
function strap(g: CanvasRenderingContext2D, path: string, width = .65): void {
  line(g, path, steel.ink, width + .3)
  line(g, path, steel.strap, width)
}

/** 封闭式尖顶头盔：眉部窄视缝、带铰链的面甲与包住下颌的护颈。 */
function helmet(g: CanvasRenderingContext2D, facing: Facing): void {
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round'
  shape(g, 'M-5.3-5.1L5.3-5.1 4.3 1.3Q0 3-4.3 1.3Z', steel.lining)
  if (facing === 'side') {
    metal(g, 'M-7.6-20.7Q-3.9-23.5.8-25.1L3.2-22.9Q9.7-21 10.3-13.7L9-5.7 5.8-.7-2.8.7-7.5-3.8-10.1-12.8Z', [-10, -20, 11, -9])
    metal(g, 'M-7.6-20.7Q-3.9-23.5.8-25.1L1.3-16.2-8.9-14.6Z', [-9, -21, 4, -14])
    line(g, 'M.8-24L1.3-17.1', steel.light, .4)
    shape(g, 'M-9.2-15L1.8-16.1 3-14.8-9.8-13.4Z', steel.lining, .16)
    metal(g, 'M-10-13.4L2.9-14.7 5.4-10.4 1.8-5.7-7.6-3.2-10.9-8.2-12.2-10.1Z', [-12, -12, 6, -6])
    line(g, 'M-11.3-10.2L-6.4-10.7-2.5-12.2', steel.light, .32)
    metal(g, 'M-7.6-3.2L1.8-5.7 5.4-10.4 7-6.6 4.7-1.4-1.8.2Z', [-8, -6, 8, 0], true)
    shape(g, 'M5.2-13.2Q7.5-15.2 9.2-12.9L8.9-9.5Q6.8-8 5.1-10.3Z', steel.shadow, .22)
    rivet(g, 7, -11.7)
    for (let i = 0; i < 3; i++) line(g, `M${-8.7 + i * 1.65} -8.6L${-8.3 + i * 1.65} -7.5`, steel.deep, .3)
    strap(g, 'M-1.6-.3L4.5-1.7', .5)
  } else if (facing === 'back') {
    metal(g, 'M0-25.5L3-23.4Q10.3-21.6 10.8-13L9.3-5.4 5.4-.4Q0 2-5.4-.4L-9.3-5.4-10.8-13Q-10.3-21.6-3-23.4Z', [-11, -20, 11, -5])
    metal(g, 'M-.7-24.6L1.1-24.6 1.5-6.1-.8-6.1Z', [-1, -20, 2, -6])
    line(g, 'M-5-20.7Q-7.7-14.9-5.7-7.2M5-20.7Q7.7-14.9 5.7-7.2', steel.shadow, .35)
    metal(g, 'M-9-6.1Q0-2.9 9-6.1L5.9-.3Q0 1.4-5.9-.3Z', [-9, -5, 9, 1], true)
    shape(g, 'M-1.9-2L1.9-2 1.8 1.2-1.8 1.2Z', steel.strap, .18)
    rivet(g, -8.3, -9.6); rivet(g, 8.3, -9.6)
  } else {
    metal(g, 'M0-25.5L3.1-23.5Q9.3-22.1 10.6-15.1L9.8-6.6 5.7-.6Q0 1.6-5.7-.6L-9.8-6.6-10.6-15.1Q-9.3-22.1-3.1-23.5Z', [-11, -21, 11, -8])
    metal(g, 'M0-25.5L1.3-23 1.4-15.4-.2-14.6-1.3-15.4-1.3-23Z', [-1.5, -24, 2, -14])
    line(g, 'M-.1-24.5L-.2-15.5', steel.shine, .4)
    metal(g, 'M-10.4-15.4Q0-13.2 10.4-15.4L9.9-12.9Q0-10.6-9.9-12.9Z', [-10, -15, 10, -11])
    shape(g, 'M-9.3-12.9Q0-11.7 9.3-12.9L8.8-11.9Q0-10.8-8.8-11.9Z', steel.lining, .12)
    metal(g, 'M-9.8-11.6Q0-10.3 9.8-11.6L8.2-5.1 3.9-1.3 0-.1-3.9-1.3-8.2-5.1Z', [-10, -9, 10, -3])
    line(g, 'M0-10.4L-.1-1.2', steel.light, .38)
    line(g, 'M.5-10.3L.4-1.5', steel.shadow, .2)
    metal(g, 'M-8-5.2L-3.8-1.5 0-.3 3.8-1.5 8-5.2 6.1-.4Q0 3.1-6.1-.4Z', [-8, -4, 8, 2], true)
    for (const side of [-1, 1]) {
      rivet(g, side * 9.5, -12)
      for (let i = 0; i < 3; i++) line(g, `M${side * (3.1 + i * 1.6)} -7.5L${side * (3.5 + i * 1.5)} -6.6`, steel.deep, .28)
    }
  }
  g.restore()
}

/** 胸背甲收腰后接腰裙，红棕皮带与铜扣取自参考；关节黑底只在钢板之间露出。 */
function torso(g: CanvasRenderingContext2D, facing: Facing, appearance: PlayerAppearance): void {
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round'
  const sister = appearance === 'sister'
  g.scale(sister ? .84 : 1, sister ? .97 : 1)
  shape(g, 'M-4-8L4-8 7.5-5.4 5.2 3.6 5.4 7.8Q0 9.1-5.4 7.8L-5.2 3.6-7.5-5.4Z', steel.lining)
  if (facing === 'side') {
    metal(g, 'M-3.5-7.3Q.2-8.9 3.2-6.8L4.9-2.5Q5.6.5 2.6 3.8L-2.6 3.9Q-5.2-.2-3.5-7.3Z', [-5, -3, 5, 0])
    line(g, 'M-2.9-6.1Q-4.2-1.2-2.3 2.8', steel.shine, .32)
    metal(g, 'M-3.4-8.4Q0-9.9 3.6-8.2L3.2-6.4Q0-5-3.5-6.5Z', [-4, -8, 4, -6])
    for (let i = 0; i < 3; i++) {
      const y = 2.9 + i * 1.25
      metal(g, `M-3.1 ${y}Q0 ${y + .6} 2.8 ${y - .2}L3.3 ${y + 1.1}Q0 ${y + 2}-3.5 ${y + 1.3}Z`, [-4, y, 4, y + 1.3], i === 1)
    }
    metal(g, 'M-3.3 5.7Q-.9 5.4 1.2 6L.8 9.9-3.9 9.1Z', [-4, 6, 2, 9])
    line(g, 'M-3.2 7L.9 7.6M-3.5 8.1L.9 8.7', steel.shadow, .22)
    strap(g, 'M-3 3.8Q.4 4.7 3.1 3.8', .65)
    strap(g, 'M2.1 4.3L-2.3 7.9', .5)
    rivet(g, -2.5, -5.5); rivet(g, -.2, 6.2)
  } else {
    metal(g, 'M-6.1-6.6Q-3.1-8.2 0-7.3Q3.1-8.2 6.1-6.6L6.7-2.3Q5.9.8 4.1 3.8Q0 5-4.1 3.8Q-5.9.8-6.7-2.3Z', [-7, -5, 7, 1])
    if (facing === 'front') {
      // 肋部弧面逐渐汇向胸骨脊，避免把躯干画成几个平直方片。
      line(g, 'M-.1-6.4Q-.6-1.5 0 3.5', steel.shine, .4)
      line(g, 'M.5-6.3Q.1-1.1.6 3.4', steel.shadow, .24)
      for (const side of [-1, 1]) {
        line(g, `M${side * 4.7} -3.2Q${side * 4.7} .3 ${side * 1.1} 2.8`, steel.shadow, .28)
        line(g, `M${side * 3.4} -3.8Q${side * 3.5} -.2 ${side * .9} 2`, steel.light, .2)
      }
      shape(g, 'M-.9-7.3L.8-7.3.7-4.6-.8-4.6Z', steel.strap, .18)
      shape(g, 'M-.7-6.7L.6-6.7.6-5.8-.7-5.8Z', steel.brass, .16)
    } else {
      line(g, 'M0-6.2L0 3.4', steel.shadow, .28)
      line(g, 'M-5.1-3.9Q-3.2-.2-1.1 2.6M5.1-3.9Q3.2-.2 1.1 2.6', steel.shadow, .25)
      shape(g, 'M-.8-7.6L.8-7.6 1 1.8-.9 1.8Z', steel.strap, .2)
      shape(g, 'M-.6-6.6L.6-6.6.6-5.6-.6-5.6Z', steel.brass, .15)
    }
    metal(g, 'M-3.8-9.3Q0-8.4 3.8-9.3L4.1-7.4Q0-5.5-4.1-7.4Z', [-4, -9, 4, -6])
    line(g, 'M-3.4-8.8Q0-7.8 3.4-8.8', steel.shine, .3)
    for (let i = 0; i < 3; i++) {
      const y = 3.2 + i * 1.22, w = 4.1 + i * .45
      metal(g, `M${-w} ${y}Q0 ${y + .9} ${w} ${y}L${w + .4} ${y + 1.25}Q0 ${y + 2.2} ${-w - .4} ${y + 1.25}Z`, [-w, y, w, y + 1.2], i === 1)
    }
    shape(g, 'M-3.8 6.2L3.8 6.2 4.2 10.2Q0 11-4.2 10.2Z', steel.mail, .18)
    for (let y = 7.3; y < 10.3; y += .7) line(g, `M-3.8 ${y}L3.8 ${y}`, '#73777a', .12)
    for (const side of [-1, 1]) {
      g.save(); g.scale(side, 1)
      metal(g, 'M.8 6.3Q3.2 5.9 5.1 6.2L6.1 9.8Q3.5 11 1 10Z', [.6, 7, 6.2, 9])
      line(g, 'M1 7.4Q3.5 7.6 5.4 7.2M1.1 8.6Q3.5 8.9 5.7 8.4', steel.shadow, .23)
      rivet(g, 2.2, 6.6)
      g.restore()
    }
    strap(g, 'M-4.7 3.8Q0 4.8 4.7 3.8', .72)
    if (facing === 'front') {
      strap(g, 'M-4.5 4.1L3.9 7.2', .6)
      shape(g, 'M3.2 3.7L4.6 3.6 4.8 4.8 3.3 5Z', steel.brass, .18)
      shape(g, 'M3.6 4L4.3 3.95 4.4 4.5 3.7 4.6Z', steel.deep, 0)
    }
    rivet(g, -5.1, -5.6); rivet(g, 5.1, -5.6)
  }
  g.restore()
}

/** 圆肩壳接活动叠片，护肘外翼与锥形护腕保持中世纪板甲轮廓。 */
function arm(g: CanvasRenderingContext2D, lower: boolean, sister: boolean): void {
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round'; g.scale(sister ? .94 : 1, 1)
  shape(g, 'M-1.8-.6L1.8-.6 1.6 6.2-1.7 6.2Z', steel.lining)
  if (!lower) {
    metal(g, 'M-3.6.8Q-3.4-2.2-.6-2.5Q2.6-2.3 3.5.6L2.7 2Q-.1 2.9-3.6.8Z', [-4, -1, 3.5, 1.8])
    line(g, 'M-3-.1Q-2-1.9.1-1.8', steel.shine, .3)
    metal(g, 'M-3.3 1Q-.2 2.9 2.9 1.3L2.6 2.6Q-.1 3.8-3.1 2.4Z', [-3, 1, 3, 3])
    metal(g, 'M-2.6 2.6Q0 3.8 2.4 2.7L2.1 3.7Q0 4.9-2.4 3.9Z', [-3, 2.5, 3, 4], true)
    metal(g, 'M-1.8 3.2Q0 3.9 1.8 3.2L1.9 5.5Q0 6.2-1.9 5.5Z', [-2.2, 3.6, 2.2, 5.6])
    metal(g, 'M-2 4.9L-.3 4.5 2.3 5.1 2.7 6.3.5 5.9-1.3 6.1-2.2 5.6Z', [-2.2, 5, 2.7, 6])
    rivet(g, -2.8, .9); rivet(g, 2.1, 1.1)
  } else {
    metal(g, 'M-2-.7Q0 .1 2-.7L1.6 3.9Q0 4.8-1.6 3.9Z', [-2, 1, 2.3, 3.1])
    line(g, 'M-1.3.2L-1 3.5', steel.shine, .26)
    metal(g, 'M-1.9 3.4Q0 4.1 1.9 3.4L2.2 4.8Q0 5.5-2.2 4.8Z', [-2.3, 3.8, 2.3, 5])
    metal(g, 'M-1.7 4.8Q0 4.2 1.6 4.8L1.8 5.9 1.1 6.7-1.2 6.6-1.9 5.8Z', [-2, 5, 2, 6.3])
    for (let i = 0; i < 3; i++) line(g, `M${-.95 + i * .68} 5.2L${-.9 + i * .65} 6.1`, steel.shadow, .15)
    metal(g, 'M-1.7 5L-2.4 5.3-2.2 6.2-1.3 6.1Z', [-2.4, 5.2, -1.2, 6.1], true)
  }
  g.restore()
}

function leg(g: CanvasRenderingContext2D, shin: boolean, sister: boolean): void {
  g.save(); g.lineJoin = 'round'; g.scale(sister ? .94 : 1, 1)
  shape(g, 'M-1.7-.6L1.7-.6 1.7 4.8-1.7 4.8Z', steel.lining)
  if (shin) {
    metal(g, 'M-2.1-.6Q0 .5 2.1-.6L1.65 4.1Q0 4.7-1.65 4.1Z', [-2.2, 1, 2.2, 3.5])
    line(g, 'M-.4.1Q-.8 2.1-.3 3.8', steel.shine, .24)
    strap(g, 'M-1.9.4Q0 .9 1.9.4', .34)
    line(g, 'M-1.5 3.8Q0 4.1 1.5 3.8', steel.shadow, .23)
  } else {
    metal(g, 'M-2.4-.5Q0-1 2.4-.5L2 3.7Q0 4.5-2 3.7Z', [-2.4, 1, 2.5, 3.2])
    line(g, 'M-.8-.1Q-1.3 1.6-.8 3', steel.shine, .26)
    metal(g, 'M-2.2 3Q0 2.3 2.1 3L2.7 3.6 3.1 4.8 1.5 4.4Q0 5.6-1.8 4.7L-2.5 3.9Z', [-2.5, 3, 2.8, 4.6])
    line(g, 'M-1.6 3.6Q-.4 3 1 3.6', steel.light, .24)
    rivet(g, 1.8, 3.8)
  }
  g.restore()
}

/** 尖头铁靴由活动足背片连向护胫，鞋底保持薄而清楚。 */
function boot(g: CanvasRenderingContext2D, facing: Facing, sister: boolean): void {
  g.save(); g.lineJoin = 'round'; g.scale(sister ? .94 : 1, 1)
  if (facing === 'back') {
    metal(g, 'M-1.7-.8L1.7-.8 2 1.3 1.9 3.1Q0 3.7-1.9 3.1L-2 1.3Z', [-2.1, .3, 2.1, 3.1], true)
    metal(g, 'M-1.8 1.2Q0 1.8 1.8 1.2L1.8 2.8Q0 3.4-1.8 2.8Z', [-2, 1.5, 2, 2.9])
    line(g, 'M-1.7 3Q0 3.6 1.7 3', steel.deep, .36)
    rivet(g, 0, .4)
    g.restore(); return
  }
  const side = facing === 'side'
  metal(g, side ? 'M-1.7-.8L1.5-.8 1.9 1.2 3.8 2.7 2.6 3.3-3.6 3.3-3.9 2.3-2.1 1Z' : 'M-1.8-.8L1.8-.8 2.3 1.4 1.4 3.7Q0 4.4-1.4 3.7L-2.3 1.4Z', [-2.5, .3, 2.6, 3.3])
  line(g, side ? 'M-2 1L1.7 1M-2.9 1.9L2.6 1.9M-3.5 2.7L3.3 2.7' : 'M-1.9 1Q0 1.5 1.9 1M-1.9 1.9Q0 2.4 1.9 1.9M-1.5 2.8Q0 3.3 1.5 2.8', steel.shadow, .22)
  line(g, side ? 'M-3.6 3.1L2.8 3.1' : 'M-1.4 3.6Q0 4.1 1.4 3.6', steel.deep, .34)
  g.restore()
}

/** 所有头格与衣身格重新绘制，封闭头盔不会残留帽檐、头发、脸和表情像素。 */
export function knightPlateAtlas(source: HTMLImageElement, appearance: PlayerAppearance): HTMLCanvasElement {
  const existing = atlases.get(source); if (existing) return existing
  const image = document.createElement('canvas')
  image.width = source.naturalWidth; image.height = source.naturalHeight
  const g = image.getContext('2d')!, sister = appearance === 'sister'
  for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) {
    g.save(); g.translate(col * 160, row * 176)
    g.beginPath(); g.rect(0, 0, 160, 176); g.clip()
    g.translate(80, 128); g.scale(4 * (sister ? .92 : 1), 4 * (sister ? .92 : 1))
    helmet(g, row === 0 ? 'front' : row === 1 ? 'side' : 'back')
    g.restore()
  }
  const piece = (id: number, paint: () => void) => {
    g.save(); g.translate(id % 6 * 128, 528 + Math.floor(id / 6) * 160)
    g.beginPath(); g.rect(0, 0, 128, 160); g.clip()
    g.translate(64, 64); g.scale(4, 4); paint(); g.restore()
  }
  piece(0, () => torso(g, 'front', appearance)); piece(1, () => torso(g, 'side', appearance)); piece(2, () => torso(g, 'back', appearance))
  piece(3, () => arm(g, false, sister)); piece(4, () => arm(g, true, sister))
  piece(5, () => leg(g, false, sister)); piece(6, () => leg(g, true, sister))
  piece(7, () => boot(g, 'front', sister)); piece(8, () => boot(g, 'side', sister)); piece(9, () => boot(g, 'back', sister))
  piece(10, () => shape(g, 'M-3.4 4L3.4 4 3.8 9.5-3.8 9.5Z', steel.lining, 0))
  atlases.set(source, image)
  return image
}
