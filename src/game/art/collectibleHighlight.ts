import { bakeSprite, drawSprite, SpriteCache } from '../../core/rendering/SpriteCache'

const overlays = new SpriteCache(80, 1024 * 1024)

/** 可采集贴图共享浅暖滤色与轮廓微光；遮罩只烘焙一次，不逐帧使用模糊滤镜。 */
export function drawCollectibleHighlight(g: CanvasRenderingContext2D, key: string, x: number, y: number, width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void): void {
  const identity = `${key}:${width}:${height}`
  const tint = overlays.get(`tint:${identity}`, () => bakeSprite(0, 0, width, height, ctx => {
    paint(ctx)
    ctx.globalCompositeOperation = 'source-in'
    ctx.fillStyle = '#f2edc8'
    ctx.fillRect(0, 0, width, height)
  }))
  const glow = overlays.get(`glow:${identity}`, () => bakeSprite(-7, -7, width + 14, height + 14, ctx => {
    ctx.shadowColor = '#efdda0'; ctx.shadowBlur = 9
    drawSprite(ctx, tint)
  }))
  g.save(); g.translate(x, y)
  const alpha = g.globalAlpha
  g.globalAlpha = alpha * .085; drawSprite(g, tint)
  g.globalAlpha = alpha * .075; drawSprite(g, glow)
  g.restore()
}
