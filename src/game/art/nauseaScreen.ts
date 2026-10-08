import { NAUSEA } from '../../content/statuses/nausea'
import type { Player } from '../Player'

/** 只在反胃时复用一张逻辑分辨率画布，不读取像素、不影响鼠标或世界坐标。 */
const buffers = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>()
export function renderNausea(ctx: CanvasRenderingContext2D, width: number, height: number, player: Player): void {
  const remaining = player.effects.remaining(NAUSEA.id)
  if (!remaining || !player.alive || width <= 0 || height <= 0) return
  const intensity = Math.max(0, Math.min(1, (8 - remaining) / .3, remaining / .8))
  if (intensity <= 0) return
  const source = ctx.canvas
  let buffer = buffers.get(source)
  if (!buffer) { buffer = document.createElement('canvas'); buffers.set(source, buffer) }
  const w = Math.ceil(width), h = Math.ceil(height)
  if (buffer.width !== w || buffer.height !== h) { buffer.width = w; buffer.height = h }
  const copy = buffer.getContext('2d')!
  copy.drawImage(source, 0, 0, source.width, source.height, 0, 0, w, h)
  const time = player.effectTime
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.translate(width / 2 + Math.sin(time * 5.3) * 7 * intensity, height / 2 + Math.sin(time * 4.1) * 6 * intensity)
  ctx.rotate((Math.sin(time * 2.8) * .021 + Math.sin(time * 6.7) * .006) * intensity)
  // 留出覆盖旋转与波纹的边界，不让屏幕边缘露出未扭曲的底图。
  const overscan = 1 + .09 * intensity
  ctx.scale(overscan, overscan)
  ctx.translate(-width / 2, -height / 2)
  const strips = Math.min(120, Math.ceil(height / 8))
  const warpY = (y: number): number => y + Math.sin(y / height * Math.PI * 4 + time * 3.3) * 4 * intensity
  for (let i = 0; i < strips; i++) {
    const sy = h * i / strips, ey = h * (i + 1) / strips
    const y = height * i / strips, endY = height * (i + 1) / strips
    const dx = (Math.sin(y / height * Math.PI * 5 + time * 4.4) * 10 + Math.sin(y / height * Math.PI * 2 - time * 2.7) * 7) * intensity
    ctx.drawImage(buffer, 0, sy, w, ey - sy, dx, warpY(y), width, warpY(endY) - warpY(y) + .5)
  }
  ctx.restore()
}
