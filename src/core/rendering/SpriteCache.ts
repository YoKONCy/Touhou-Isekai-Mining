export interface RasterSprite {
  image: HTMLCanvasElement
  x: number
  y: number
  width: number
  height: number
}

/** 将复杂矢量外观烘焙为透明贴图；默认两倍采样，保留小尺寸描边与光晕。 */
export function bakeSprite(x: number, y: number, width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void, density = 2): RasterSprite {
  const image = document.createElement('canvas')
  image.width = Math.ceil(width * density)
  image.height = Math.ceil(height * density)
  const ctx = image.getContext('2d')!
  ctx.scale(density, density)
  ctx.translate(-x, -y)
  paint(ctx)
  return { image, x, y, width: image.width / density, height: image.height / density }
}

export function drawSprite(ctx: CanvasRenderingContext2D, sprite: RasterSprite): void {
  ctx.drawImage(sprite.image, sprite.x, sprite.y, sprite.width, sprite.height)
}

/** 通用贴图缓存：同时限制数量与像素预算，动态外观不会无限占用内存。 */
export class SpriteCache {
  private readonly entries = new Map<string, RasterSprite>()
  private pixels = 0
  constructor(private readonly maxEntries = 96, private readonly maxPixels = 2 * 1024 * 1024) {}

  get(key: string, create: () => RasterSprite): RasterSprite {
    const existing = this.entries.get(key)
    if (existing) return existing
    const sprite = create(), pixels = sprite.image.width * sprite.image.height
    // 超出整个预算的大图只绘制一次，不挤掉所有常用的小贴图。
    if (pixels > this.maxPixels) return sprite
    while (this.entries.size && (this.entries.size >= this.maxEntries || this.pixels + pixels > this.maxPixels)) {
      const oldest = this.entries.keys().next().value!
      const removed = this.entries.get(oldest)!
      this.pixels -= removed.image.width * removed.image.height
      this.entries.delete(oldest)
    }
    this.entries.set(key, sprite)
    this.pixels += pixels
    return sprite
  }
}
