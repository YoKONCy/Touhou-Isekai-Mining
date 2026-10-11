import type { drawWhip } from '../whip/whipAppearance'
import { WHIP_VISUAL_SCALE } from '../whip/stats'

type ChainPoint = { x: number; y: number }

/** 沿真实曲线按弧长排列铁环，正面与侧面的环交替相扣，不改变攻击判定。 */
function drawLinks(g: CanvasRenderingContext2D, points: readonly ChainPoint[], scale: number): void {
  const spacing = 4.9 * scale
  let next = 2.5 * scale, travelled = 0, index = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!
    const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy)
    if (length <= 0) continue
    while (next <= travelled + length) {
      const t = (next - travelled) / length
      g.save(); g.translate(a.x + dx * t, a.y + dy * t); g.rotate(Math.atan2(dy, dx))
      const width = (index % 2 === 0 ? 1.6 : .7) * scale
      g.beginPath(); g.ellipse(0, 0, 3.25 * scale, width, 0, 0, Math.PI * 2)
      g.strokeStyle = '#282b36'; g.lineWidth = 2.1 * scale; g.stroke()
      g.strokeStyle = index % 2 === 0 ? '#a8b6c1' : '#6e8296'; g.lineWidth = 1.1 * scale; g.stroke()
      g.beginPath(); g.ellipse(0, 0, 3.25 * scale, width, 0, Math.PI, Math.PI * 1.8)
      g.strokeStyle = '#e0e5dc'; g.lineWidth = .5 * scale; g.stroke()
      g.restore()
      next += spacing; index++
    }
    travelled += length
  }
}

export function drawChainWhip(g: CanvasRenderingContext2D, view: Parameters<typeof drawWhip>[1]): void {
  const scale = view.move.reach / 160
  if (view.phase !== 'none') { drawLinks(g, view.points, scale); return }
  // 收拢的铁链在掌边形成窄垂环；重力保持向下，不随柄轴旋转成向前鼓起的大弯钩。
  const hand = view.hand
  const angle = hand?.angle ?? view.facing, side = Math.cos(angle) >= 0 ? 1 : -1
  const x = (hand?.x ?? view.x) + Math.cos(angle) * 7 * scale
  const y = (hand?.y ?? view.y) + Math.sin(angle) * 7 * scale
  const points: ChainPoint[] = []
  for (let i = 0; i <= 32; i++) {
    const t = i / 32
    points.push({ x: x + side * (.65 * Math.sin(t * Math.PI) - 5 * t) * scale, y: y + 13 * Math.sin(t * Math.PI) * scale })
  }
  drawLinks(g, points, scale)
}

export function drawChainGrip(g: CanvasRenderingContext2D): void {
  g.save(); g.scale(WHIP_VISUAL_SCALE, WHIP_VISUAL_SCALE)
  g.fillStyle = '#29252e'; g.fillRect(-3, -2.2, 10.5, 4.4)
  g.fillStyle = '#72503e'; g.fillRect(-2, -1.3, 8.5, 2.6)
  g.fillStyle = '#b8c5cc'; g.fillRect(-3, -2.2, 1.5, 4.4); g.fillRect(6, -2.2, 1.5, 4.4)
  g.fillStyle = '#bb9d73'; g.fillRect(0, -1.3, .7, 2.6); g.fillRect(3, -1.3, .7, 2.6)
  g.restore()
}
