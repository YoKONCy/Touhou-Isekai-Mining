import { bakeSprite, drawSprite } from '../../core/rendering/SpriteCache'
import type { RasterSprite } from '../../core/rendering/SpriteCache'
import { canvasViewport, visible } from '../../core/rendering/Viewport'
import type { SearchContainer } from './SearchSystem'

let star: RasterSprite | null = null
let rareStar:RasterSprite|null=null
function starSprite(advanced=false): RasterSprite {
  const cached=advanced?rareStar:star
  if(cached)return cached
  const sprite=bakeSprite(-8, -8, 16, 16, ctx => {
    ctx.fillStyle = advanced?'#fff8df':'#ffefd0'; ctx.beginPath()
    for (let p = 0; p < 8; p++) { const angle = p * Math.PI / 4, r = p % 2 ? 1.6 : 7; if (p) ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r); else ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r) }
    ctx.closePath(); ctx.fill()
    if(advanced){ctx.strokeStyle='#e7bc70';ctx.lineWidth=.65;ctx.stroke()}
  })
  if(advanced)rareStar=sprite;else star=sprite
  return sprite
}
/** 共用小星芒贴图，错峰低频闪烁；没有逐帧模糊或大范围发光。 */
export function drawSearchMarkers(g: CanvasRenderingContext2D, containers: readonly SearchContainer[], time: number): void {
  const view = canvasViewport(g)
  for (let i = 0; i < containers.length; i++) {
    const c = containers[i]!
    const advanced=c.fields?.advanced===true,height=typeof c.fields?.markerHeight==='number'?c.fields.markerHeight:26
    if (c.complete || !visible(view, c.x, c.y - height, 42)) continue
    const phase = (time + i * 1.37) % (advanced?5.4:4.2),duration=advanced?.85:.75
    if (phase > duration) continue
    const sprite = starSprite(advanced)
    const pulse = Math.sin(phase / duration * Math.PI)
    for (let k = 0; k < (advanced?3:2); k++) {
      const scale = pulse * (k===2?.32:k?.48:advanced?1.1:.85)
      g.save(); g.translate(c.x + (k===2?5:k?14:-8), c.y - height - (k===2?3:k?11:0)); g.rotate(phase * .5)
      g.scale(scale, scale); g.globalAlpha *= pulse; drawSprite(g, sprite); g.restore()
    }
  }
}

/** 采集点只闪一颗更小、更淡的星，采完立即消失；复用搜索星芒缓存。 */
export function drawGatherMarkers(g: CanvasRenderingContext2D, points: readonly { x: number; y: number; done: boolean }[], time: number): void {
  const view = canvasViewport(g)
  for (let i = 0; i < points.length; i++) {
    const point = points[i]!
    if (point.done || !visible(view, point.x, point.y - 16, 36)) continue
    const phase = (time + i * 1.73 + .9) % 5.8
    if (phase > .65) continue
    const pulse = Math.sin(phase / .65 * Math.PI), scale = pulse * .38
    g.save(); g.translate(point.x + 7, point.y - 16); g.rotate(phase * .35)
    g.scale(scale, scale); g.globalAlpha *= pulse * .36; drawSprite(g, starSprite()); g.restore()
  }
}
