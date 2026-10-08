/** 三种独立几何构图的18帧缓存；填色留白，外围黑暗弧光不参与伤害判定。 */
const SIZE = 448
const FRAMES = 18
const cache: HTMLCanvasElement[][] = []
export function vorpalSweep(segment: number, t: number): number {
  const wait = segment === 2 ? .25 : .13
  if (t < wait) return .04 * (t / wait) ** 2
  if (t < .72) return .04 + .94 * (1 - (1 - (t - wait) / (.72 - wait)) ** 3)
  return .98 + .02 * (t - .72) / .28
}
type Point = [number, number]
function build(segment: number): HTMLCanvasElement[] {
  return Array.from({ length: FRAMES }, (_, frame) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE
    const g = canvas.getContext('2d')!
    g.translate(SIZE / 2, SIZE / 2)
    const t = frame / (FRAMES - 1), direction = segment === 1 ? -1 : 1
    const width = segment === 2 ? 1.55 : 1.25
    const sweep = vorpalSweep(segment, Math.min(1, t / .375))
    const tip = direction * (-width + sweep * width * 2)
    const fade = t < .4 ? 1 : Math.max(0, (1 - t) / .6)
    const burst = Math.max(0, 1 - Math.abs(t - .28) / .26)
    const span = Math.min(2.25, .22 + sweep * 2.03)
    const squash = segment === 2 ? .76 : segment === 1 ? .87 : 1
    const point = (a: number, r: number): Point => [Math.cos(a) * r, Math.sin(a) * r * squash]
    function path(points: Point[]): void {
      g.beginPath(); points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y))
    }
    /** 赤色细边包裹黑色芯线，亮度只集中于转折点。 */
    function darkArc(points: Point[], strength = 1): void {
      path(points); g.globalAlpha = fade * strength
      g.strokeStyle = '#63182c'; g.lineWidth = 5; g.shadowColor = '#9b2543'; g.shadowBlur = 8; g.stroke()
      g.shadowBlur = 0; g.strokeStyle = '#cf667b'; g.lineWidth = 2.2; g.stroke()
      g.strokeStyle = '#0b0710'; g.lineWidth = 1.25; g.stroke()
    }
    // 黑雾只做稀疏外沿气息，避免整片遮黑与厚重脏色。
    for (let i = 0; i < 7; i++) {
      const [x, y] = point(tip - direction * i * .26, 117 + t * 24)
      const r = 12 + t * 15
      const fog = g.createRadialGradient(x, y, 0, x, y, r)
      fog.addColorStop(0, `rgba(5,3,9,${fade * .23})`); fog.addColorStop(1, 'rgba(5,3,9,0)')
      g.fillStyle = fog; g.fillRect(x - r, y - r, r * 2, r * 2)
    }
    // 第一段放射折扇，第二段交错逆卷，第三段断层重劈；不共用厚月牙轮廓。
    const tracks = segment === 0 ? 5 : segment === 1 ? 4 : 3
    for (let track = 0; track < tracks; track++) {
      const radius = 128 - track * (segment === 2 ? 18 : 11)
      const start = tip - direction * span + track * .08
      const points: Point[] = []
      for (let i = 0; i <= 16; i++) {
        const u = i / 16, a = start + direction * span * u
        const bend = segment === 0 ? (i % 5 === 0 ? 6 : 0) : segment === 1 ? Math.sin(u * Math.PI * 2) * (8 + track * 2) : (i % 4 === 0 ? 13 : -2)
        points.push(point(a, radius + bend))
      }
      path(points)
      for (let i = 16; i >= 0; i--) {
        const u = i / 16, a = start + direction * span * u
        const thickness = (segment === 2 ? 13 : 7) * Math.sin(Math.PI * u) * (i % 5 === 0 ? .25 : 1)
        g.lineTo(...point(a, radius - thickness))
      }
      g.closePath(); g.globalAlpha = fade * (track === 0 ? .55 : .32)
      g.fillStyle = track % 2 ? '#3a1023' : '#8c2843'; g.fill()
      // 分段刃光，留下长缺口与细长速度纹。
      g.globalAlpha = fade * .82; g.strokeStyle = track === 0 ? '#da7186' : '#9d405c'; g.lineWidth = track === 0 ? 1.6 : .8
      for (let i = 1; i < points.length; i++) if ((i + track) % 5 !== 0) { path([points[i - 1], points[i]]); g.stroke() }
    }
    if (segment === 0) {
      // 折扇外框及向外分叉的长折线。
      for (let branch = 0; branch < 3; branch++) {
        const a = tip - .2 - branch * .58
        const points = [point(a, 121), point(a - .07, 151), point(a + .15, 163), point(a + .23, 185)]
        darkArc(points, burst * .95)
        darkArc([points[1], point(a - .28, 167), point(a - .34, 191)], burst * .6)
      }
      darkArc([point(tip - span, 128), point(tip - span + .23, 159), point(tip - span + .68, 148)], burst)
    } else if (segment === 1) {
      // 逆卷菱形破框与两道交叉裂电，构图和首段放射状完全不同。
      const a = tip + .32
      darkArc([point(a, 120), point(a + .19, 181), point(a + .61, 152), point(a + .82, 189), point(a + 1.12, 116)], burst)
      darkArc([point(a + .16, 158), point(a - .13, 176), point(a + .48, 193), point(a + .67, 132)], burst * .85)
      darkArc([point(tip + span * .65, 95), point(tip + span * .4, 136), point(tip + span * .2, 102)], burst * .6)
    } else {
      // 重劈形成大尺度断裂弧框、锐角断层和向前贯出的长刺。
      const points: Point[] = []
      for (let i = 0; i < 11; i++) points.push(point(-1.48 + i * .285, [152, 184, 166, 195, 151, 178, 145, 188, 165, 184, 144][i]))
      darkArc(points, burst)
      darkArc([point(-.12, 123), [172, -18], [157, 9], [202, 14]], burst)
      darkArc([point(.62, 145), [135, 131], [163, 118], [184, 154]], burst * .7)
    }
    // 爆发节点的短十字与菱形碎芒，消散帧收成稀疏线屑。
    g.globalAlpha = burst * .85; g.strokeStyle = '#e5a0ad'; g.lineWidth = 1
    for (let i = 0; i < 3; i++) {
      const [x, y] = point(tip - direction * i * .55, 132 + i * 9)
      path([[x - 10, y], [x + 13, y]]); g.stroke(); path([[x, y - 15], [x, y + 7]]); g.stroke()
    }
    g.globalAlpha = fade * .65; g.strokeStyle = '#9e4560'
    for (let i = 0; i < 8; i++) {
      const a = tip - direction * i * .21, r = 128 + t * (14 + i * 3)
      path([point(a, r), point(a - direction * .09, r + 6)]); g.stroke()
    }
    return canvas
  })
}
export function drawVorpalSlash(g: CanvasRenderingContext2D, x: number, y: number, angle: number, segment: number, progress: number): void {
  cache[segment] ??= build(segment)
  const frame = Math.min(FRAMES - 1, Math.max(0, Math.floor(progress * FRAMES)))
  g.save(); g.translate(x, y); g.rotate(angle); g.drawImage(cache[segment][frame], -SIZE / 2, -SIZE / 2); g.restore()
}
