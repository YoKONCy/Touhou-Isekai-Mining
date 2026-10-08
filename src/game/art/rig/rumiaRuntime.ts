import type { PlayerPose } from './skeleton'
import { drawRumiaApprovedStudy, type RumiaApprovedHeads } from './rumiaApprovedStudy'
import type { FourthCharacterOptions } from './fourthFloorCharacters'

let heads: RumiaApprovedHeads | undefined
let pending: Promise<boolean> | undefined
/** 已确认头图常驻加载，身体沿用同一份 C 版正式骨骼素材。 */
export function loadRumiaAssets(): Promise<boolean> {
  if (pending) return pending
  if (typeof Image === 'undefined') return Promise.resolve(false)
  const anchors = { front: [195, 368], side: [152, 358], back: [195, 368] } as const
  pending = Promise.all((['front', 'side', 'back'] as const).map(direction => new Promise<[typeof direction, HTMLImageElement] | null>(resolve => {
    const image = new Image(); image.onload = () => resolve([direction, image]); image.onerror = () => resolve(null)
    image.src = `${import.meta.env.BASE_URL}characters/rumia/head-${direction}.png`
  }))).then(images => {
    if (images.some(image => !image)) { pending = undefined; return false }
    heads = Object.fromEntries(images.map(entry => { const [dir, image] = entry!; return [dir, { image, width: image.naturalWidth, height: image.naturalHeight, anchorX: anchors[dir][0], anchorY: anchors[dir][1] }] })) as unknown as RumiaApprovedHeads
    return true
  })
  return pending
}
/** 返回加载结果，未就绪时由原绘制器过渡；束缚附着于固定颈部与躯干锚点。 */
export function drawRumiaRuntime(g: CanvasRenderingContext2D, x: number, y: number, pose: PlayerPose, opts: FourthCharacterOptions): boolean {
  void loadRumiaAssets()
  if (!heads) return false
  drawRumiaApprovedStudy(g, x, y, pose, heads)
  if (opts.bound) {
    g.save(); g.translate(x, y); g.strokeStyle = '#927252'; g.lineWidth = 1.3
    g.beginPath(); g.moveTo(-7, -5); g.lineTo(7, -1); g.moveTo(-7, -1); g.lineTo(7, -5); g.moveTo(-6, 1); g.lineTo(6, 1); g.stroke()
    g.fillStyle = '#81aa86'; g.strokeStyle = '#395d4c'; g.lineWidth = .65; g.beginPath(); g.ellipse(0, -15.1, 3.5, 1.8, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore()
  }
  return true
}
