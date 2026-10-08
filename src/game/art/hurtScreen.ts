import { CONFIG } from '../config'
import type { Player } from '../Player'

interface EdgeCache { width: number; height: number; pixelsW: number; pixelsH: number; gradient: CanvasGradient }
const edges = new WeakMap<CanvasRenderingContext2D, EdgeCache>()

/** 实际受伤后轻染一瞬暖红，低血量稍加强；不持续泛红，也不反复闪烁。 */
export function renderHurtScreen(ctx: CanvasRenderingContext2D, width: number, height: number, player: Player, now = performance.now()): void {
  const settings = CONFIG.hurt, age = (now - player.hurtFlashAt) / 1000
  if (age < 0 || age >= settings.flashDuration || width <= 0 || height <= 0) return
  const envelope = Math.pow(1 - age / settings.flashDuration, 2)
  const severity = Math.max(0, Math.min(1, player.hurtFlashSeverity))
  let cached = edges.get(ctx)
  if (!cached || cached.width !== width || cached.height !== height || cached.pixelsW !== ctx.canvas.width || cached.pixelsH !== ctx.canvas.height) {
    const gradient = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * .16, width / 2, height / 2, Math.hypot(width, height) * .54)
    gradient.addColorStop(0, 'rgba(158,70,76,0)')
    gradient.addColorStop(.45, 'rgba(158,70,76,0)')
    gradient.addColorStop(.78, 'rgba(158,70,76,.3)')
    gradient.addColorStop(1, 'rgba(158,70,76,1)')
    cached = { width, height, pixelsW: ctx.canvas.width, pixelsH: ctx.canvas.height, gradient }; edges.set(ctx, cached)
  }
  ctx.save()
  ctx.globalAlpha *= (settings.flashAlpha + settings.flashLowHpAlpha * severity) * envelope
  ctx.fillStyle = '#d2a29b'; ctx.fillRect(0, 0, width, height)
  ctx.restore(); ctx.save()
  ctx.globalAlpha *= (settings.flashEdgeAlpha + settings.flashEdgeLowHpAlpha * severity) * envelope
  ctx.fillStyle = cached.gradient; ctx.fillRect(0, 0, width, height)
  ctx.restore()
}
