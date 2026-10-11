import type { ItemDef, GroundRenderer } from '../../types'
import { supplyIcon } from './supplyAppearance'
import { MISO_ID, KEDAMA_TOFU_ID, FORGET_ME_NOT_ID } from '../ids'
import { bakeSprite, type RasterSprite } from '../../../../core/rendering/SpriteCache'

/** 五瓣蓝花与黄色花心，采集态和掉落态复用同一绘制器。 */
export function drawForgetMeNot(g: CanvasRenderingContext2D, time = 0): void {
  g.lineJoin = 'round'; g.lineCap = 'round'
  const sway = Math.sin(time * 1.6) * .9
  g.strokeStyle = '#657e58'; g.lineWidth = 1.15
  g.beginPath(); g.moveTo(-2, 2); g.bezierCurveTo(-1, -7, 2 + sway, -12, 1 + sway, -24); g.moveTo(-1, -5); g.quadraticCurveTo(-9, -11, -9, -18); g.moveTo(0, -12); g.quadraticCurveTo(8, -14, 9, -20); g.stroke()
  for (const [x, y, a] of [[-4, -8, -1], [3, -13, .7], [-6, -14, -1.3]]) {
    g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = '#80946a'; g.strokeStyle = '#455c44'; g.lineWidth = .55
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(5, -6, 0, -9); g.quadraticCurveTo(-3, -3, 0, 0); g.fill(); g.stroke(); g.restore()
  }
  for (const [x, y, s] of [[1 + sway, -25, 1], [-9 + sway * .6, -18, .76], [9 + sway * .7, -20, .82]]) {
    g.save(); g.translate(x, y); g.scale(s, s)
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; g.fillStyle = i < 2 ? '#a6c3df' : '#749bbf'; g.strokeStyle = '#526987'; g.lineWidth = .55; g.beginPath(); g.ellipse(Math.cos(a) * 2.35, Math.sin(a) * 2.35, 2.6, 1.95, a, 0, Math.PI * 2); g.fill(); g.stroke() }
    g.fillStyle = '#e7cd7e'; g.beginPath(); g.arc(0, 0, 1.25, 0, Math.PI * 2); g.fill(); g.fillStyle = '#faf0be'; g.beginPath(); g.arc(-.3, -.4, .45, 0, Math.PI * 2); g.fill(); g.restore()
  }
}

const flowerSvg = '<path d="M18 44Q27 29 23 9M23 30L11 20M24 23L37 16" fill="none" stroke="#657e58" stroke-width="1.8"/><path d="M20 32Q9 32 9 24Q19 22 20 32M25 27Q38 29 38 21Q29 19 25 27" fill="#81996e" stroke="#455c44"/>'
  + [[23, 10, 1], [11, 20, .78], [37, 16, .86]].map(([x, y, s]) => `<g transform="translate(${x} ${y}) scale(${s})">${Array.from({ length: 5 }, (_, i) => `<ellipse cx="4" cy="0" rx="4.1" ry="3.1" transform="rotate(${i * 72})" fill="${i < 2 ? '#a6c3df' : '#749bbf'}" stroke="#526987" stroke-width=".8"/>`).join('')}<circle r="2" fill="#e7cd7e" stroke="#ab9862" stroke-width=".6"/><circle cx="-.5" cy="-.6" r=".65" fill="#faf0be" stroke="none"/></g>`).join('')
interface IngredientLayer { path: string; fill?: string; edge?: string; width?: number }
/** 图标与落地素材共用分层色块；地面版只烘焙一次，保留赛璐璐明暗与稀疏微像素纹理。 */
function ingredientArtwork(layers: IngredientLayer[]) {
  const shape = layers.map(layer => `<path d="${layer.path}" fill="${layer.fill ?? 'none'}" stroke="${layer.edge ?? 'none'}" stroke-width="${layer.width ?? 1}"/>`).join('')
  let sprite: RasterSprite | null = null
  const ground: GroundRenderer = ({ ctx, x, y }) => {
    sprite ??= bakeSprite(0, 0, 48, 48, g => {
      g.lineJoin = 'round'; g.lineCap = 'round'
      for (const layer of layers) {
        const path = new Path2D(layer.path)
        if (layer.fill) { g.fillStyle = layer.fill; g.fill(path) }
        if (layer.edge) { g.strokeStyle = layer.edge; g.lineWidth = layer.width ?? 1; g.stroke(path) }
      }
    })
    ctx.drawImage(sprite.image, x - 12, y - 14, 24, 24)
  }
  return { icon: supplyIcon(shape), ground }
}
const tofuArt = ingredientArtwork([
  { path: 'M7 16L29 10Q30 10 32 11L41 17Q42 18 42 20L41 34Q41 35 39 36L19 41Q17 41 16 40L8 33Q7 32 7 30Z', fill: '#dddccc', edge: '#57525b', width: 1.1 },
  { path: 'M18 25L41.5 18.5L41 34Q41 35 39 36L19 41L18 39Z', fill: '#bcc4b6' },
  { path: 'M19 26L40 20L39.5 29L36 31L36 34L19 38Z', fill: '#cdd2c2' },
  { path: 'M7.5 17L18 25L19 40L17 40L8 33Z', fill: '#e3e2ce' },
  { path: 'M8 20L12 23L12 30L17 34L17 38L9 32Z', fill: '#d2d4be' },
  { path: 'M7 16L29 10Q30 10 32 11L41 17Q42 18 40 19L19 25Q18 25 16 23Z', fill: '#f4eed9', edge: '#777869', width: .75 },
  { path: 'M10 16L28 11.5L32 12L35 14L22 17L18 20L15 20Z', fill: '#fff9e8' },
  { path: 'M19 22L27 20L29 18L37 16L40 18L19 24L16 22Z', fill: '#e6e4cc' },
  { path: 'M8.5 17L16 23L19 24L40 18.5', edge: '#fff8e4', width: .9 },
  { path: 'M18 26L18.5 39', edge: '#faf3dc', width: .8 },
  { path: 'M11 24h1v2h-1ZM14 30h1.2v1H14ZM13 34h1v1h-1ZM23 28h1.4v.8H23ZM34 27h1v1.2h-1ZM27 35h1.5v.7H27Z', fill: '#b6bda9' },
  { path: 'M23 16h1.5v.8H23ZM30 14h1v.8h-1ZM17 19h1v.7h-1Z', fill: '#dbddc4' },
  { path: 'M21 30h1.5v.7H21ZM32 32h1.5v.7H32ZM12 26h1v.7h-1Z', fill: '#edeeda' }
])
const misoArt = ingredientArtwork([
  { path: 'M7 22L9 36Q10 41 24 42Q37 41 39 36L41 22Z', fill: '#96704e', edge: '#49404a', width: 1.1 },
  { path: 'M27 26L40 23L38 37Q35 40 27 41Z', fill: '#72503e' },
  { path: 'M11 26L15 28L16 40L12 38ZM18 29L23 29L23 41L19 40Z', fill: '#af865b' },
  { path: 'M11 27L12 37M17 29L18 40M25 29L25 41M33 27L32 39M37 26L36 37', edge: '#5a4438', width: .7 },
  { path: 'M13 28L13.5 34M20 30L20 37M29 29L28.5 35', edge: '#c29a68', width: .65 },
  { path: 'M8.5 29Q24 36 39.5 29L39 32Q24 39 9 32Z', fill: '#565352', edge: '#3c3b43', width: .65 },
  { path: 'M10 36Q24 42 38 36L37.5 38Q24 44 10.5 38Z', fill: '#5b5754', edge: '#3c3b43', width: .65 },
  { path: 'M10 29.8Q20 34 30 32.5M11.5 36.8Q20 40 29 39', edge: '#989183', width: .65 },
  { path: 'M12 31h1.2v1H12ZM34 31h1v1h-1ZM13 37h1v1h-1ZM33 38h1v1h-1Z', fill: '#b4a28a' },
  { path: 'M7 22C7 11 41 11 41 22C41 33 7 33 7 22Z', fill: '#bd9866', edge: '#58473c', width: 1 },
  { path: 'M10 22C10 14 38 14 38 22C38 29.5 10 29.5 10 22Z', fill: '#6b4535', edge: '#e2bd84', width: .75 },
  { path: 'M11 22L13 18L18 16L22 17L27 13.5L32 14L36 18L37 22L34 26L25 28L17 26Z', fill: '#b58045', edge: '#765135', width: .7 },
  { path: 'M12 22L17 23L23 22L26 24L33 22L36 19L37 23L34 26L25 27L17 25Z', fill: '#956437' },
  { path: 'M14 19L18 17L22 18L24 20L20 20L18 22L14 21ZM25 17L28 15L31 15.5L33 18L30 18L29 20L26 19Z', fill: '#d2a464' },
  { path: 'M13 19h1.5v1H13ZM18 18h1v1h-1ZM27 16h1.5v.8H27ZM30 21h1.2v1H30ZM24 24h1v1h-1Z', fill: '#e3bb7a' },
  { path: 'M17 22h1v1.2h-1ZM23 19h1v1h-1ZM32 23h1.4v.8H32ZM21 25h1v.8h-1Z', fill: '#785137' },
  { path: 'M8.5 21Q8 16 16 15M10 25Q17 29 26 28.5', edge: '#e5c392', width: .85 }
])

const miso: ItemDef = { id: MISO_ID, kind: 'material', maxStack: 9999, color: '#b3844e', hi: '#ddbd84', text: '#d1b68a', ...misoArt, tags: ['food', 'ingredient'] }
const tofu: ItemDef = { id: KEDAMA_TOFU_ID, kind: 'material', maxStack: 9999, color: '#dbd5bd', hi: '#fff0d1', text: '#dfd8bf', ...tofuArt, tags: ['food', 'ingredient', 'kedama'] }
const flower: ItemDef = { id: FORGET_ME_NOT_ID, kind: 'material', maxStack: 9999, color: '#83aaca', hi: '#c0d9e9', text: '#b3cce0', icon: supplyIcon(flowerSvg), ground: ({ ctx, x, y }) => { ctx.save(); ctx.translate(x, y + 7); ctx.scale(.6, .6); drawForgetMeNot(ctx); ctx.restore() }, tags: ['plant', 'flower'] }
export const fourthFloorMaterials = [miso, tofu, flower]
