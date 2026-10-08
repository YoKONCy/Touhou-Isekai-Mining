import type { MeleeMove } from '../../../types'
import { WHIP_VISUAL_SCALE } from './stats'

export function drawWhip(ctx: CanvasRenderingContext2D, v: { x: number; y: number; facing: number; phase: string; timer: number; move: MeleeMove; points: Array<{ x: number; y: number }>; hand?: { x: number; y: number; angle: number } }): void {
  const m = v.move, hand = v.hand
  const visualScale = m.reach / 160
    if (v.phase === 'none') {
      // 待机用独立的松折皮鞭轮廓，不把攻击长鞭压缩成直垂带子。
      const angle = hand?.angle ?? v.facing
      ctx.save(); ctx.translate(hand?.x ?? v.x, hand?.y ?? v.y); ctx.rotate(angle)
      ctx.scale(visualScale, visualScale)
      ctx.lineJoin = 'round'; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(7, 0)
      ctx.bezierCurveTo(13, 1, 16, 6, 13, 11)
      ctx.bezierCurveTo(9, 17, 18, 21, 21, 15)
      ctx.bezierCurveTo(25, 8, 19, 3, 22, -3)
      ctx.bezierCurveTo(24, -7, 28, -6, 28, -2)
      ctx.strokeStyle = '#2b2629'; ctx.lineWidth = 3.1; ctx.stroke()
      ctx.strokeStyle = '#7d6955'; ctx.lineWidth = 1.8; ctx.stroke()
      ctx.strokeStyle = '#c2af8f'; ctx.lineWidth = .65; ctx.stroke()
      ctx.restore()
      return
    }
    const active = v.phase === 'active', returning = v.phase === 'recover'
    const progress = active ? Math.max(0, Math.min(1, 1 - v.timer / m.active)) : returning ? Math.max(0, Math.min(1, 1 - v.timer / m.recover)) : 0
    const points = v.points
    const segments = points.length - 1
    ctx.save()

    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], u = i / segments
      const segmentAngle = Math.atan2(b.y - a.y, b.x - a.x)
      const segmentLength = Math.hypot(b.x - a.x, b.y - a.y)
      // 像素皮革节片：暗轮廓、灰褐面、断续米灰磨亮边，避免光滑绳线。
      ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(segmentAngle)
      const width = (u < .7 ? 3.6 - u * 1.6 : 2.5 - (u - .7) * 4) * visualScale
      ctx.fillStyle = '#2b282b'; ctx.fillRect(-.4 * visualScale, -width / 2 - .5 * visualScale, segmentLength + .8 * visualScale, width + visualScale)
      ctx.fillStyle = i % 3 === 0 ? '#8d8482' : '#6e5c4d'; ctx.fillRect(0, -width / 2, segmentLength, width)
      ctx.fillStyle = '#c1b194'; ctx.fillRect(.4 * visualScale, -width / 2, Math.max(.5 * visualScale, segmentLength * .65), .8 * visualScale)
      if (i % 3 === 0) { ctx.fillStyle = '#433630'; ctx.fillRect(0, -width / 2, .8 * visualScale, width) }
      ctx.restore()
    }
    if ((active && progress > .85) || (returning && progress < .12)) {
      // 残影沿真实回勾末段，不再绘制轴线上的直线箭头。
      ctx.strokeStyle = '#ddc49859'; ctx.lineWidth = .8 * visualScale
      ctx.beginPath()
      for (let i = segments - 9; i <= segments; i++) {
        const point = points[i]
        if (i === segments - 9) ctx.moveTo(point.x, point.y - 2 * visualScale)
        else ctx.lineTo(point.x, point.y - 2 * visualScale)
      }
      ctx.stroke()
    }
    ctx.restore()
}

export function drawWhipGrip(ctx: CanvasRenderingContext2D): void {
  ctx.save(); ctx.scale(WHIP_VISUAL_SCALE, WHIP_VISUAL_SCALE)
  ctx.fillStyle = '#332426'; ctx.fillRect(-2, -1.6, 9, 3.2)
  ctx.fillStyle = '#834a3f'; ctx.fillRect(-1, -.9, 7, 1.8)
  ctx.fillStyle = '#ab7e5a'; ctx.fillRect(1, -.9, 4, .5)
  ctx.fillStyle = '#4d312e'; ctx.fillRect(5, -.9, .7, 1.8)
  ctx.restore()
}
