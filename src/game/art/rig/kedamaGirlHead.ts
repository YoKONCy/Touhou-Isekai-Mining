import type { Dir4 } from './skeleton'
import type { FourthCharacterExpression } from './fourthFloorCharacters'
import { kedamaHeadAtlas, kedamaHeadExpressions } from './kedamaGirlParts'

let image: HTMLImageElement | undefined
let attempted = false
let movingHead: HTMLImageElement | undefined
export function getKedamaGirlParts(): HTMLImageElement | undefined {
  if (!attempted && typeof Image !== 'undefined') {
    attempted = true; image = new Image()
    image.src = `${import.meta.env.BASE_URL}characters/kedama-girl/character-parts.png`
    movingHead = new Image(); movingHead.src = `${import.meta.env.BASE_URL}characters/kedama-girl/moving-head.png`
  }
  return image?.complete && image.naturalWidth >= kedamaHeadAtlas.width * kedamaHeadAtlas.columns ? image : undefined
}

// 内容模块加载时预取，头部和身体使用同一次图片解码。
getKedamaGirlParts()

/** 保留参考图完整头脸；只施加四向翻转、细微倾斜和表情切换。 */
export function drawKedamaGirlHead(g: CanvasRenderingContext2D, dir: Dir4, time: number, expression: FourthCharacterExpression, tilt = 0): void {
  const sprite = getKedamaGirlParts(), row = dir === 'up' ? 2 : dir === 'left' ? 1 : 0
  if (!sprite) return
  const expr = (expression === 'neutral' || expression === 'hungry') && (time + 1.5) % 4.9 < .12 ? 'sleeping' : expression
  g.save(); g.translate(dir === 'left' ? -.25 : 0, -8.2); g.rotate(Math.max(-.025, Math.min(.025, tilt)))
  const col = Math.max(0, kedamaHeadExpressions.indexOf(expr)), { width, height, scale } = kedamaHeadAtlas
  // 原图保留更多眼睑与虹膜采样，缩到屏幕尺寸时只做一次缩小。
  g.imageSmoothingEnabled = true
  if (expression === 'playful' && dir === 'down' && movingHead?.complete && movingHead.naturalWidth > 0) g.drawImage(movingHead, 0, 0, width, height, -20, -32, width / scale, height / scale)
  else g.drawImage(sprite, col * width, row * height, width, height, -20, -32, width / scale, height / scale)
  g.restore()
}
