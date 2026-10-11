import { svgIcon } from '../../../types'
import { bakeSprite, type RasterSprite } from '../../../../../core/rendering/SpriteCache'

/** 原画中的实际握把中心；手臂、持枪绘制与弹药出口共用，不把机匣原点当作手心。 */
export const LIVING_GUN_GEOMETRY = {
  scale: .54,
  rear: { x: -4, y: 7 },
  front: { x: 22, y: 4 },
  chamber: { x: 0, y: -8 },
  muzzle: { x: 31, y: -8 }
} as const

/** MP5K 的短机匣、弯弹匣、竖直前握把。 */
const layers: Array<{ path: string; fill: string; edge?: string }> = [
  { path: 'M-14-8L-5-11L24-11L26-9L26-2L13 0L5 2L-8 1L-14-2Z', fill: '#323b46', edge: '#1d202a' },
  { path: 'M-12-8L-4-10L24-10L24-7L-7-5Z', fill: '#58636d' },
  { path: 'M-13-3L-7-4L24-6L24-2L10 0L5 2L-9 0Z', fill: '#242b36' },
  { path: 'M-4 0L3 1L1 6L-2 14L-9 12L-6 5Z', fill: '#303641', edge: '#1c222c' },
  { path: 'M-4 2L-1 3L-3 10L-7 11Z', fill: '#46515a' },
  { path: 'M2 0L9-1L9 5L5 7L0 5L1 3L5 5L7 4L7 1L3 2Z', fill: '#1a202a', edge: '#151a23' },
  { path: 'M9-1L15-2L16 8L20 18L14 21L10 12Z', fill: '#303b45', edge: '#1c2430' },
  { path: 'M12 1L14 0L15 9L18 17L15 18L12 10Z', fill: '#535e66' },
  { path: 'M19-4L25-5L26 6L24 10L20 9L18 7Z', fill: '#242d38', edge: '#19202a' },
  { path: 'M20-1L22-2L23 7L21 7Z', fill: '#4d5961' },
  { path: 'M25-10L29-10L30-8L29-6L25-6Z', fill: '#434e58', edge: '#1c2430' },
  { path: 'M28-9L31-9L31-7L28-7Z', fill: '#242d38', edge: '#161c27' },
  { path: 'M21-12L22-15L25-15L26-12L25-10L23-10Z', fill: '#303943', edge: '#1b222e' },
  { path: 'M23-13L24-13L24-11L23-11Z', fill: '#121922' },
  { path: 'M-11-10L-10-13L-5-13L-3-10Z', fill: '#38424e', edge: '#1d2630' },
  { path: 'M-7-12L-5-12L-5-10L-7-10Z', fill: '#68757a' },
  { path: 'M-3-8L17-10L17-8L-3-6Z', fill: '#202b38' },
  { path: 'M-1-7L13-8L13-7L-1-6Z', fill: '#899292' },
  { path: 'M-10-5L-7-5L-7-3L-10-3ZM4-3L5-3L5-2L4-2ZM17-3L18-3L18-2L17-2Z', fill: '#69747c' },
  { path: 'M-7-2L-2-1L-3 0L-8-1Z', fill: '#925d57' },
  { path: 'M-6-1L-5-1L-5 0L-6 0ZM-3-1L-2-1L-2 0L-3 0Z', fill: '#bc8170' },
  { path: 'M11 8L15 7L15 8L11 9ZM12 11L16 10L16 11L12 12ZM14 15L18 14L18 15L14 16Z', fill: '#1f2b37' },
  { path: 'M20 3L24 2L24 3L20 4ZM20 5L24 4L24 5L20 6Z', fill: '#1b2330' }
]
let sprite: RasterSprite | null = null
export function drawLivingGun(g: CanvasRenderingContext2D, recoil = 0, gripOrigin = true): void {
  sprite ??= bakeSprite(-16, -17, 49, 40, ctx => {
    ctx.lineJoin = 'round'; ctx.lineWidth = .65
    for (const layer of layers) {
      const path = new Path2D(layer.path); ctx.fillStyle = layer.fill; ctx.fill(path)
      if (layer.edge) { ctx.strokeStyle = layer.edge; ctx.stroke(path) }
    }
  })
  const { scale, rear } = LIVING_GUN_GEOMETRY
  g.save(); g.scale(scale, scale)
  if (gripOrigin) g.translate(-rear.x, -rear.y)
  g.drawImage(sprite.image, sprite.x, sprite.y, sprite.width, sprite.height)
  g.fillStyle = '#1b2733'; g.fillRect(4 - recoil * 1.1, -8, 6.5, 1.3); g.restore()
}
export const livingGunIcon = svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g transform="translate(23 34) rotate(-26) scale(1.13)" stroke-width=".65" stroke-linejoin="round">${layers.map(layer => `<path d="${layer.path}" fill="${layer.fill}" stroke="${layer.edge ?? 'none'}"/>`).join('')}</g></svg>`)

/** 射出的牙齿以牙冠在前、牙根在后，短曳光强调高速而不盖住弹体。 */
export function drawTooth(g: CanvasRenderingContext2D): void {
  g.fillStyle = '#dfc59a55'; g.fillRect(-12, -1, 11, 2)
  g.beginPath(); g.moveTo(-4, -2); g.lineTo(1, -2.7); g.quadraticCurveTo(5, -1.8, 5, 0)
  g.quadraticCurveTo(4, 2.6, 1, 2.5); g.lineTo(-4, 1.5); g.lineTo(-7, 2); g.lineTo(-5, 0); g.lineTo(-7, -1); g.closePath()
  g.fillStyle = '#ede7c9'; g.fill(); g.strokeStyle = '#615b68'; g.lineWidth = .65; g.stroke()
  g.fillStyle = '#fff8e4'; g.fillRect(0, -1.8, 2.5, .8); g.fillStyle = '#b6bdae'; g.fillRect(-3, .5, 4, 1)
}
