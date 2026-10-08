import type { TileMap, DoorSlot } from '../tilemap'
import { drawMineSprite, type MineSprite } from './mineAssets'

interface Plant { x: number; y: number; size: number; seed: number; kind: 'fern' | 'grass' | 'root' | 'climber' | 'vine' | 'ceiling' }
/** 每房独立生态装饰；脚底排序与高空遮挡分离，无碰撞、无采集。 */
export class CavePlants {
  readonly ground: Plant[] = []
  private hanging: Plant[] = []
  private sprites = new Map<Plant, HTMLCanvasElement>()

  /** 细叶、渐变和纹理一次烘焙，逐帧只提交小画布并作轻微整体摆动。 */
  private sprite(p: Plant): HTMLCanvasElement {
    let image = this.sprites.get(p)
    if (image) return image
    image = document.createElement('canvas')
    const hanging = p.kind === 'vine' || p.kind === 'climber' || p.kind === 'ceiling'
    image.width = 160; image.height = Math.ceil(p.size + 80) * 2
    const g = image.getContext('2d')!
    g.scale(2, 2); g.translate(40 - p.x, 40 - p.y)
    const name:MineSprite=hanging?(p.kind==='climber'?'plant-vine-1':'plant-vine-0'):p.kind==='root'?'plant-root':p.kind==='fern'?'plant-fern':'plant-grass'
    const width=hanging?(p.kind==='climber'?36:27):p.size*1.7,height=hanging?p.size: p.kind==='root'?width*.5:width
    if(drawMineSprite(g,name,p.x-width/2,hanging?p.y-2:p.y-height*(p.kind==='root'?.7:.8),width,height)){
      this.sprites.set(p,image);return image
    }
    if (hanging) this.paintVine(g, p, 0, { x: -10000, y: -10000 })
    else this.paintGround(g, p, 0)
    this.sprites.set(p, image)
    return image
  }

  renderGround(ctx: CanvasRenderingContext2D, p: Plant, time: number): void {
    const image = this.sprite(p)
    ctx.save(); ctx.translate(p.x, p.y)
    if (p.kind !== 'root') ctx.rotate(Math.sin(time * .65 + p.seed) * .012)
    ctx.drawImage(image, -40, -40, image.width / 2, image.height / 2); ctx.restore()
  }
  constructor(map: TileMap, doors: readonly DoorSlot[], seed: number, banks: readonly { x: number; y: number; rx: number; ry: number }[]) {
    let state = (Math.imul(seed + 41, 1664525) ^ 0x724139ab) >>> 0
    const rand = (): number => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296 }
    const b = map.bounds
    for (let i = 0; i < 24; i++) {
      let x = b.left + 25 + rand() * (b.right - b.left - 50), y = b.top + 20 + rand() * (b.bottom - b.top - 40)
      const kind = i % 3 === 0 ? 'root' : i % 3 === 1 ? 'fern' : 'grass'
      if (kind === 'grass') {
        if (!banks.length) continue
        const bank = banks[i % banks.length], a = rand() * Math.PI * 2
        x = bank.x + Math.cos(a) * (bank.rx + 9); y = bank.y + Math.sin(a) * (bank.ry + 7)
      } else {
        const side = i % 4
        if (side === 0) y = b.top + 12 + rand() * 28
        else if (side === 1) y = b.bottom - 12 - rand() * 28
        else x = side === 2 ? b.left + 14 + rand() * 25 : b.right - 14 - rand() * 25
      }
      if (doors.some(d => Math.hypot(x - (d.col + .5) * map.tile, y - (d.row + .5) * map.tile) < 90) || map.solidAtWorld(x, y) || map.solidAtWorld(x + 10, y)) continue
      this.ground.push({ x, y, seed: rand() * 9, size: 15 + rand() * 17, kind: i % 3 === 0 ? 'root' : i % 3 === 1 ? 'fern' : 'grass' })
    }
    for (let i = 0; i < 10; i++) {
      const x = b.left + 35 + rand() * (b.right - b.left - 70)
      if (doors.some(d => Math.abs(x - (d.col + .5) * map.tile) < 70)) continue
      this.hanging.push({ x, y: b.top - 40, size: 42 + rand() * 55, seed: rand() * 9, kind: i % 3 === 0 ? 'climber' : 'vine' })
    }
    for (let i = 0; i < 3; i++) this.hanging.push({ x: b.left + 50 + rand() * (b.right - b.left - 100), y: b.top + 15 + rand() * (b.bottom - b.top) * .45, size: 38 + rand() * 35, seed: rand() * 9, kind: 'ceiling' })
  }
  private leaf(ctx: CanvasRenderingContext2D, x: number, y: number, length: number, angle: number): void {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle)
    // 不对称叶缘与双面折色，亮面不沿外圈描边，避免塑料叶片感。
    const path = new Path2D()
    path.moveTo(0, 0); path.bezierCurveTo(length * .18, -length * .24, length * .5, -length * .3, length, -.12 * length)
    path.lineTo(length * .72, length * .12); path.quadraticCurveTo(length * .28, length * .3, 0, 0)
    const shade = ctx.createLinearGradient(0, -length * .3, 0, length * .3)
    shade.addColorStop(0, '#77815a'); shade.addColorStop(.42, '#4d6243'); shade.addColorStop(.55, '#3b5039'); shade.addColorStop(1, '#263d31')
    ctx.fillStyle = shade; ctx.fill(path)
    ctx.strokeStyle = '#21362caa'; ctx.lineWidth = .45; ctx.stroke(path)
    ctx.strokeStyle = '#b1aa7355'; ctx.lineWidth = .4
    ctx.beginPath(); ctx.moveTo(.5, 0); ctx.quadraticCurveTo(length * .4, -.03 * length, length * .88, -.1 * length); ctx.stroke()
    if (length > 5) {
      ctx.strokeStyle = '#9a9c6b30'; ctx.lineWidth = .35
      for (let i = 2; i < 5; i++) { const x = length * i / 6; ctx.beginPath(); ctx.moveTo(x, -.02 * length); ctx.lineTo(x - length * .12, -length * .16); ctx.moveTo(x, 0); ctx.lineTo(x - length * .1, length * .15); ctx.stroke() }
    }
    ctx.restore()
  }
  private paintGround(ctx: CanvasRenderingContext2D, p: Plant, time: number): void {
    ctx.save(); ctx.translate(p.x, p.y)
    ctx.fillStyle = '#141d1b44'; ctx.beginPath(); ctx.ellipse(0, 2, p.size * .6, 3, 0, 0, Math.PI * 2); ctx.fill()
    const sway = Math.sin(time * .65 + p.seed) * .6
    if (p.kind === 'root') {
      // 根从单个岩缝分叉，分段收细，并有嵌土暗面与断续树皮亮脊。
      for (let i = 0; i < 5; i++) {
        const a = p.seed + i * 1.7, ex = Math.cos(a) * p.size * .7, ey = Math.sin(a) * p.size * .2
        const path = new Path2D(); path.moveTo(-4, -2); path.bezierCurveTo(ex * .25, -7 + Math.sin(a) * 4, ex * .55, ey + 4, ex, ey)
        ctx.save(); ctx.translate(0, 1.3); ctx.strokeStyle = '#171e1b80'; ctx.lineWidth = 3; ctx.stroke(path); ctx.restore()
        ctx.strokeStyle = '#534936'; ctx.lineWidth = 2.1 - i * .2; ctx.stroke(path)
        ctx.save(); ctx.translate(-.4, -.5); ctx.strokeStyle = '#aa91604a'; ctx.lineWidth = .55; ctx.stroke(path); ctx.restore()
        ctx.strokeStyle = '#655a405e'; ctx.lineWidth = .5
        for (let k = 1; k < 4; k++) { const t = k / 4; ctx.beginPath(); ctx.moveTo(ex * t, ey * t); ctx.quadraticCurveTo(ex * t + 2, ey * t + 2, ex * t + Math.sin(a + k) * 5, ey * t + 5); ctx.stroke() }
      }
    } else if (p.kind === 'grass') {
      // 细叶有宽度、折面和不齐的尖端，部分枯叶向外倒伏。
      for (let i = 0; i < 11; i++) {
        const h = .5 + .5 * Math.sin(p.seed * 7 + i * 2.39), ex = (i - 5) * (1.1 + h) + sway * h, ey = -p.size * (.35 + h * .65), base = Math.sin(i * 3 + p.seed) * 3
        const leaf = new Path2D(); leaf.moveTo(base, 1); leaf.quadraticCurveTo(ex * .25 - 1, ey * .6, ex, ey); leaf.quadraticCurveTo(ex * .2 + 1.1, ey * .45, base + 1.2, 1); leaf.closePath()
        ctx.fillStyle = i % 5 ? (h > .5 ? '#67794d' : '#3b523d') : '#88744f'; ctx.fill(leaf)
        ctx.strokeStyle = '#b1ae7450'; ctx.lineWidth = .35; ctx.beginPath(); ctx.moveTo(base + .3, 0); ctx.quadraticCurveTo(ex * .25, ey * .6, ex, ey); ctx.stroke()
      }
    } else {
      // 弧形羽轴和错位小叶，避免五根等高对称鱼骨。
      for (let i = 0; i < 6; i++) {
        const h = .5 + .5 * Math.sin(p.seed * 3 + i * 2.1), ex = (i - 2.5) * (5 + h * 2) + sway, ey = -p.size * (.48 + h * .5), cx = ex * .25, cy = ey * .83
        ctx.strokeStyle = '#374a32'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(cx, cy, ex, ey); ctx.stroke()
        ctx.strokeStyle = '#92936370'; ctx.lineWidth = .45; ctx.stroke()
        for (let k = 1; k < 9; k++) {
          const t = k / 10, x = 2 * (1 - t) * t * cx + t * t * ex, y = 2 * (1 - t) * t * cy + t * t * ey
          const direction = Math.atan2(2 * (1 - t) * cy + 2 * t * (ey - cy), 2 * (1 - t) * cx + 2 * t * (ex - cx))
          const length = (3 + h * 4) * Math.sin(t * Math.PI) + .7
          this.leaf(ctx, x, y, length, direction + 1.1); this.leaf(ctx, x + .4, y - .6, length * .85, direction - 1.05)
        }
      }
    }
    ctx.restore()
  }
  renderWall(ctx: CanvasRenderingContext2D, time: number, player: { x: number; y: number }): void {
    for (const p of this.hanging) if (p.kind !== 'ceiling') this.drawVine(ctx, p, time, player)
  }
  renderCeiling(ctx: CanvasRenderingContext2D, time: number, player: { x: number; y: number }): void {
    for (const p of this.hanging) if (p.kind === 'ceiling') this.drawVine(ctx, p, time, player)
  }
  private drawVine(ctx: CanvasRenderingContext2D, p: Plant, time: number, player: { x: number; y: number }): void {
    const image = this.sprite(p)
    ctx.save(); ctx.translate(p.x, p.y)
    // 到悬垂轮廓的距离连续衰减，角色头身范围也计入，避免踏进矩形就骤然变透明。
    const dx = Math.max(0, Math.abs(player.x - p.x) - 12)
    const dy = Math.max(0, p.y - player.y, player.y - 26 - (p.y + p.size))
    const distance = Math.hypot(dx, dy)
    const proximity = Math.max(0, Math.min(1, (60 - distance) / 48))
    const fade = proximity * proximity * (3 - 2 * proximity)
    ctx.globalAlpha *= 1 - fade * .82
    if (p.kind !== 'climber') ctx.transform(1, 0, Math.sin(time * .6 + p.seed) * .018, 1, 0, 0)
    ctx.drawImage(image, -40, -40, image.width / 2, image.height / 2); ctx.restore()
  }

  private paintVine(ctx: CanvasRenderingContext2D, p: Plant, time: number, player: { x: number; y: number }): void {
    ctx.save()
    const near = Math.abs(player.x - p.x) < 32 && player.y > p.y - 10 && player.y < p.y + p.size + 28
    ctx.globalAlpha *= near ? .3 : p.kind === 'ceiling' ? .72 : .9
    if (p.kind === 'ceiling') { ctx.fillStyle = '#101a1620'; ctx.beginPath(); ctx.ellipse(p.x + 12, p.y + p.size + 26, 15, 5, -.2, 0, Math.PI * 2); ctx.fill() }
    const points = Array.from({ length: 13 }, (_, i) => { const t = i / 12; return { x: p.x + Math.sin(t * 3 + p.seed) * t * 7 + Math.sin(time * .6 + p.seed + t) * t * t * 2, y: p.y + p.size * t } })
    const line = (dx: number, dy: number, color: string, width: number): void => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); points.forEach((q, i) => { if (i) ctx.lineTo(q.x + dx, q.y + dy); else ctx.moveTo(q.x + dx, q.y + dy) }); ctx.stroke() }
    line(2, 1, '#101d1960', 2.6)
    // 主藤分段收细，粗段保留木质棕色，细段露出灰绿新皮。
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], t = i / 12
      ctx.strokeStyle = i < 5 ? '#625640' : '#46523b'; ctx.lineWidth = 2.3 - t * 1.6
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      ctx.strokeStyle = '#b0a07348'; ctx.lineWidth = .45; ctx.beginPath(); ctx.moveTo(a.x - .4, a.y); ctx.lineTo(b.x - .4, b.y - .3); ctx.stroke()
      if (i % 3 === 0) { ctx.strokeStyle = '#282f255e'; ctx.lineWidth = .65; ctx.beginPath(); ctx.moveTo(b.x - 1, b.y - 1); ctx.lineTo(b.x + 1, b.y); ctx.stroke() }
    }
    for (let i = 2; i < 12; i++) {
      const h = .5 + .5 * Math.sin(p.seed * 5 + i * 2.7)
      if (h < .24) continue
      const q = points[i], side = i % 2 ? 1 : -1, branch = (p.kind === 'climber' ? 7 : 3) + h * 5
      const bx = q.x + side * branch, by = q.y - 2 + Math.sin(p.seed + i) * 2
      ctx.strokeStyle = '#63704b'; ctx.lineWidth = .65; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.quadraticCurveTo(q.x + side * branch * .5, q.y - 3, bx, by); ctx.stroke()
      this.leaf(ctx, bx, by, (p.kind === 'climber' ? 6 : 3) + h * 4, side > 0 ? .5 + h * .4 : Math.PI - .7)
      if (p.kind === 'climber' && h > .5) this.leaf(ctx, bx - side * 2, by - 1, 4 + h * 3, -1.1 - side * .4)
      if (i % 4 === 0) { ctx.strokeStyle = '#7a78524f'; ctx.lineWidth = .45; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.bezierCurveTo(q.x + side * 4, q.y + 4, q.x + side * 8, q.y, q.x + side * 5, q.y - 1); ctx.stroke() }
    }
    ctx.fillStyle = '#252e26'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 4, 2, -.2, 0, Math.PI * 2); ctx.fill(); ctx.restore()
  }
}
