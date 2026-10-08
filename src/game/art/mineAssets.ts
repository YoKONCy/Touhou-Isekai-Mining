import atlasLayout from '../../../public/scenes/mine/atlas.json'

export type MineSprite = keyof typeof atlasLayout.parts
let atlas: HTMLImageElement | undefined
let floor: HTMLImageElement | undefined
let loading: Promise<boolean> | undefined
const tinted = new Map<string, HTMLCanvasElement>()

/** 引导阶段先加载共用素材，房间创建时再一次性烘焙；不逐层下载重复底板。 */
export function loadMineAssets(): Promise<boolean> {
  if (atlas && floor) return Promise.resolve(true)
  if (loading) return loading
  if (typeof Image === 'undefined') return Promise.resolve(false)
  const load = (name: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => image.naturalWidth ? resolve(image) : reject(new Error('矿洞素材为空。'))
    image.onerror = () => reject(new Error(`矿洞素材加载失败：${name}`))
    image.src = `${import.meta.env.BASE_URL}scenes/mine/${name}.png`
    if (image.complete && image.naturalWidth) resolve(image)
  })
  loading = Promise.all([load('atlas'), load('floor')]).then(([a, f]) => { atlas = a; floor = f; return true })
    .catch(error => { loading = undefined; console.warn('矿洞共用素材未就绪，使用共用程序绘制。', error); return false })
  return loading
}

export function mineFloorTexture(): HTMLImageElement | undefined { return floor }
export function mineAssetsReady(): boolean { return !!atlas && !!floor }

/** 群系着色只烘焙一次；所有实例仍从同一图集取材。 */
export function drawMineSprite(g: CanvasRenderingContext2D, name: MineSprite, x: number, y: number, width: number, height: number, tint?: string, strength = 0): boolean {
  if (!atlas) return false
  const p = atlasLayout.parts[name]
  // 切片仍用原始坐标；图片降低分辨率或恢复原件时按实际尺寸自动换算。
  const sourceSize = (atlasLayout as typeof atlasLayout & { sourceSize?: { width: number; height: number } }).sourceSize
  const scaleX = sourceSize ? atlas.naturalWidth / sourceSize.width : 1
  const scaleY = sourceSize ? atlas.naturalHeight / sourceSize.height : 1
  const sx = p.x * scaleX, sy = p.y * scaleY, sw = p.w * scaleX, sh = p.h * scaleY
  g.save(); g.imageSmoothingEnabled = true
  if (tint && strength > 0) {
    const key = `${name}:${tint}:${strength.toFixed(3)}`
    let stamp = tinted.get(key)
    if (!stamp) {
      stamp = document.createElement('canvas'); stamp.width = p.w; stamp.height = p.h
      const c = stamp.getContext('2d')!; c.drawImage(atlas, sx, sy, sw, sh, 0, 0, p.w, p.h)
      c.globalCompositeOperation = 'source-atop'; c.globalAlpha = strength; c.fillStyle = tint; c.fillRect(0, 0, p.w, p.h)
      tinted.set(key, stamp)
    }
    g.drawImage(stamp, x, y, width, height)
  } else g.drawImage(atlas, sx, sy, sw, sh, x, y, width, height)
  g.restore(); return true
}

/** 天然岩体用于摆件、墙脚装饰与可挖矿块，尺寸和碰撞分别由各自契约决定。 */
export function drawMineStone(g: CanvasRenderingContext2D, variant: 0 | 1 | 2, x: number, y: number, scale = 1): boolean {
  const name = (['stone-granite','stone-sandstone','stone-slate'] as const)[variant]
  return drawMineSprite(g, name, x - 22 * scale, y - 20 * scale, 44 * scale, 38 * scale)
}
