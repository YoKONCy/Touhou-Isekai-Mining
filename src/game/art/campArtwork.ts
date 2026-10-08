import layout from '../../../public/scenes/base/layout.json'
import type { CampEntity } from './campScene'

/** 已确认的手绘赛璐璐基地：背景与设施拆层，接地点继续服从原场景定义。 */
let ground: HTMLImageElement | undefined
let facilities: HTMLImageElement | undefined
let pending: Promise<boolean> | undefined
let revision = 0

export function campArtworkRevision(): number { return revision }

/** 两张资源全部就绪再切换场景，避免半张新背景配旧家具。 */
export function loadCampArtwork(): Promise<boolean> {
  if (ground && facilities) return Promise.resolve(true)
  if (pending) return pending
  if (typeof Image === 'undefined') return Promise.resolve(false)
  const load = (name: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => image.naturalWidth > 0 ? resolve(image) : reject(new Error('基地贴图尺寸无效。'))
    image.onerror = () => reject(new Error(`基地贴图加载失败：${name}`))
    image.src = `${import.meta.env.BASE_URL}scenes/base/${name}.png`
    if (image.complete && image.naturalWidth > 0) resolve(image)
  })
  pending = Promise.all([load('ground'), load('facilities')]).then(([base, objects]) => {
    ground = base; facilities = objects; revision++
    return true
  }).catch(error => { pending = undefined; console.warn('基地新美术暂未就绪，继续显示原场景。', error); return false })
  return pending
}

export function drawCampArtworkGround(g: CanvasRenderingContext2D): boolean {
  if (!ground || !facilities) return false
  g.save(); g.imageSmoothingEnabled = true
  g.drawImage(ground, 0, 0, layout.width, layout.height); g.restore()
  return true
}

/** 独立接触阴影与轻微侧投影；木桩只在支点投影，避免把悬绳当成地面墙。 */
export function drawCampArtworkShadow(g: CanvasRenderingContext2D, e: CampEntity): boolean {
  if (!ground || !facilities) return false
  if (!e.w) return true
  g.save(); g.translate(e.x, e.y)
  g.fillStyle = '#1c1e2d4d'
  if (e.kind === 'rope') {
    for (const x of [-e.w / 2 + 6, e.w / 2 - 6]) {
      g.beginPath(); g.ellipse(x + 3, 2, 10, 3, 0, 0, Math.PI * 2); g.fill()
    }
  } else {
    const w = e.w * .48, d = Math.max(9, e.d * .37)
    g.beginPath(); g.moveTo(-w, -d); g.lineTo(w, -d)
    g.lineTo(w + 16, 5); g.lineTo(w + 10, 11); g.lineTo(-w + 7, 8); g.closePath(); g.fill()
    g.fillStyle = '#1a1b2b55'; g.beginPath(); g.ellipse(0, 1, w, Math.max(3, d * .3), 0, 0, Math.PI * 2); g.fill()
  }
  g.restore(); return true
}

/** 火焰只改变自身曲线，石圈、锅身和设施接地点始终固定。 */
function flame(g: CanvasRenderingContext2D, x: number, y: number, size: number, time: number): void {
  g.save(); g.translate(x, y); g.scale(size, size)
  for (const [width, height, color] of [[16, 47, '#cc6947'], [10, 35, '#f8b25b'], [5, 23, '#ffedaf']] as const) {
    const sway = Math.sin(time * 5.3 + height) * 2.2, lift = Math.sin(time * 8.1 + width) * 2
    g.beginPath(); g.moveTo(-width * .6, 2)
    g.bezierCurveTo(-width * 1.1, -height * .27, -width * .3, -height * .5, sway - 3, -height + lift)
    g.quadraticCurveTo(sway + 4, -height * .66, width * .44, -height * .56)
    g.lineTo(width * .62, -height * .72)
    g.bezierCurveTo(width * .38, -height * .4, width * 1.1, -height * .24, width * .6, 2)
    g.quadraticCurveTo(0, 9, -width * .6, 2); g.fillStyle = color; g.fill()
  }
  g.restore()
}

function potSteam(g: CanvasRenderingContext2D, time: number): void {
  g.save(); g.lineCap = 'round'
  for (let i = 0; i < 4; i++) {
    const p = (time * .27 + i * .24) % 1, x = -12 + i * 7 + Math.sin(time + i) * 2, y = -39 - p * 34
    g.globalAlpha = Math.sin(p * Math.PI) * .25; g.lineWidth = 1.5 + p * 2; g.strokeStyle = '#dbd9cf'
    g.beginPath(); g.moveTo(x, y + 11); g.bezierCurveTo(x - 5, y + 4, x + 5, y - 3, x + 1, y - 10); g.stroke()
  }
  g.restore()
}

export function drawCampArtworkEntity(g: CanvasRenderingContext2D, e: CampEntity, time: number, potRepaired: boolean): boolean {
  if (!ground || !facilities) return false
  if (e.kind === 'exit') return true
  const part = layout.parts[e.id as keyof typeof layout.parts]
  if (!part) return false
  g.save(); g.translate(e.x, e.y); g.imageSmoothingEnabled = true
  if (e.kind === 'fire') {
    g.fillStyle = '#443335'; g.beginPath(); g.ellipse(0, -4, 17, 8, 0, 0, Math.PI * 2); g.fill()
  }
  if (e.kind === 'pot') {
    g.fillStyle = '#37323a'; g.beginPath(); g.roundRect(-13, -18, 26, 15, 3); g.fill()
    if (potRepaired) flame(g, 0, -9, .36, time)
  }
  g.drawImage(facilities, part.sx, part.sy, part.sw, part.sh, part.x, part.y, part.w, part.h)
  if (e.kind === 'rope') {
    // 细麻绳单独绘制，固定连接原图木桩；分割贴图时不把绳下地面一起带进图集。
    const left = -94, right = 94
    g.beginPath(); g.moveTo(left, -35); g.quadraticCurveTo(0, -17, right, -35)
    g.strokeStyle = '#796047'; g.lineWidth = 2.2; g.stroke()
    g.strokeStyle = '#d2b187'; g.lineWidth = 1.3; g.stroke()
  }
  if (e.kind === 'fire') {
    flame(g, 0, -12, 1, time)
    for (let i = 0; i < 6; i++) {
      const p = (time * .42 + i * .17) % 1
      g.globalAlpha = Math.sin(p * Math.PI) * .7; g.fillStyle = '#f5bd79'
      g.fillRect(Math.sin(i * 2.3 + time + p * 2) * (8 + p * 9), -39 - p * 46, .8, 1.5)
    }
  }
  if (e.kind === 'pot') {
    if (potRepaired) potSteam(g, time)
    else {
      g.strokeStyle = '#303646'; g.lineWidth = .8; g.beginPath(); g.moveTo(9, -39); g.lineTo(7, -33); g.lineTo(10, -29); g.stroke()
    }
  }
  if (e.kind === 'radio') {
    g.globalAlpha = 1; g.strokeStyle = '#a6a9ac'; g.lineWidth = 1
    g.beginPath(); g.moveTo(10, -37); g.lineTo(17, -58); g.stroke()
    g.fillStyle = `rgba(224,126,84,${.55 + Math.sin(time * 3) * .15})`; g.fillRect(12, -29, 1.5, 1.5)
  }
  g.restore(); return true
}

/** 底图已有基础照明，动态叠层仅补轻微呼吸与尘屑，不再大范围洗亮材质。 */
export function drawCampArtworkAtmosphere(g: CanvasRenderingContext2D, time: number): boolean {
  if (!ground || !facilities) return false
  g.save()
  const fire = layout.anchors.fire
  const glow = g.createRadialGradient(fire.x, fire.y - 10, 8, fire.x, fire.y - 10, 130)
  glow.addColorStop(0, `rgba(255,185,102,${.025 + Math.sin(time * 3) * .009})`); glow.addColorStop(1, '#ffc07800')
  g.fillStyle = glow; g.fillRect(fire.x - 130, fire.y - 140, 260, 260)
  g.fillStyle = '#dbc2a53d'
  for (let i = 0; i < 12; i++) {
    const x = 430 + (i * 97 % 640) + Math.sin(time * .3 + i) * 3, y = 320 + (i * 59 + time * 2) % 260
    g.fillRect(x, y, .6, .6)
  }
  g.restore(); return true
}
