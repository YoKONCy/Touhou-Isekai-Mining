import { addItemCelStop } from '../../../itemArt'
import type { HeldWeaponView } from '../../../types'

const INK = '#2a201f'

/** 器材质色（与旧管线 renderPick 同源，保证换管线不换装束） */
const MAT = {
  grip: '#66432b',
  gripDark: '#503424',
  brass: '#be944d',
  brassDark: '#8b6834',
  blade: '#e1e7ef',
  bladeDark: '#b0bece',
  bladeHi: '#fffbf6d9',
  wood: '#885c37',
  woodDark: '#5c3f29',
  // 生锈铁镐专用材：旧铁灰褐 / 锈红 / 磨亮刃口
  ironWorn: '#937d65',
  ironDark: '#6a5747',
  rust: '#905739',
  rustDark: '#653d2c',
  ironEdge: '#c1b39c'
} as const

function block(
  ctx: CanvasRenderingContext2D,
  path: () => void,
  fill: string,
  edge: string = INK
): void {
  ctx.beginPath()
  path()
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = edge
  ctx.lineWidth = 1.1
  ctx.stroke()
}

/** 粉金锯齿刃与紫黑护手；杀戮光柱保留白热核心和动态裂纹。 */
export function drawDoomsday(ctx: CanvasRenderingContext2D, opts: HeldWeaponView): void {
  const time = opts.time ?? 0
  // 参考原图的非对称倒钩、狭长焰刃和镂空暗护手，避免等距锯齿纸片。
  const outline = new Path2D('M8 -3 L14 -5 L12 -9 L21 -5 L25 -7 L24 -11 L32 -6 L39 -8 L38 -12 L46 -7 L52 -6 L59 -3 L66 -1 L70 0 L60 2 L55 5 L51 4 L48 8 L43 5 L38 6 L34 10 L32 5 L27 7 L24 5 L19 9 L18 4 L12 5 Z')
  ctx.save()
  ctx.shadowColor = '#df53b4'; ctx.shadowBlur = 5
  const metal = ctx.createLinearGradient(0, -10, 0, 9)
  addItemCelStop(metal, 0, '#e9b794'); addItemCelStop(metal, 0.25, '#e984ad')
  addItemCelStop(metal, 0.48, '#7e3b90'); addItemCelStop(metal, 0.62, '#d558a2'); addItemCelStop(metal, 1, '#452755')
  ctx.fillStyle = metal; ctx.fill(outline)
  ctx.shadowBlur = 0; ctx.strokeStyle = '#341a38'; ctx.lineWidth = 1.4; ctx.stroke(outline)
  // 刃面切割纹理与明暗棱面，金粉高光沿不规则外沿走。
  ctx.save(); ctx.clip(outline)
  ctx.fillStyle = '#fbbed5'; ctx.beginPath(); ctx.moveTo(9, -2); ctx.lineTo(29, -4); ctx.lineTo(47, -3); ctx.lineTo(69, 0); ctx.lineTo(40, 1); ctx.lineTo(20, 4); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = '#f9daae'; ctx.lineWidth = 1.2
  ctx.beginPath(); ctx.moveTo(13, -7); ctx.lineTo(22, -4); ctx.lineTo(25, -8); ctx.moveTo(26, -8); ctx.lineTo(33, -4); ctx.lineTo(40, -8); ctx.moveTo(40, -9); ctx.lineTo(47, -5); ctx.lineTo(67, -0.5); ctx.stroke()
  ctx.strokeStyle = '#783b7a'; ctx.lineWidth = 1.1
  for (const [x, y] of [[19, 3], [29, 2], [39, 1], [49, 0]]) {
    ctx.beginPath(); ctx.moveTo(x - 4, y + 4); ctx.lineTo(x, y); ctx.lineTo(x + 5, y - 2); ctx.stroke()
  }
  // 沿剑脊移动的狭窄反光带，而非整把发白。
  const glintX = 10 + ((time * 21) % 62)
  const glint = ctx.createLinearGradient(glintX - 5, 0, glintX + 5, 0)
  glint.addColorStop(0, '#fffbf600'); glint.addColorStop(0.5, '#fdeaf3b0'); glint.addColorStop(1, '#fffbf600')
  ctx.fillStyle = glint; ctx.fillRect(9, -12, 62, 23); ctx.restore()
  // 黑紫护手的钩爪与凹槽，根部嵌玫红晶核。
  block(ctx, () => ctx.rect(-10, -1.8, 16, 3.6), '#271c33', '#1c1626')
  ctx.strokeStyle = '#89526b'; ctx.lineWidth = 0.8
  for (let x = -8; x < 2; x += 3) { ctx.beginPath(); ctx.moveTo(x, -1.5); ctx.lineTo(x + 1, 1.5); ctx.stroke() }
  const guard = new Path2D('M-3 -3 L0 -8 L-2 -14 L4 -10 L7 -4 L11 -7 L9 0 L11 6 L7 4 L4 10 L-2 13 L0 7 L-4 4 L-9 6 L-6 0 L-10 -5 Z')
  const guardMetal = ctx.createLinearGradient(-5, -12, 6, 12)
  addItemCelStop(guardMetal, 0, '#844a97'); addItemCelStop(guardMetal, 0.38, '#412d4d'); addItemCelStop(guardMetal, 0.7, '#201a2c'); addItemCelStop(guardMetal, 1, '#6a417e')
  ctx.fillStyle = guardMetal; ctx.fill(guard); ctx.strokeStyle = '#1c1629'; ctx.lineWidth = 1.2; ctx.stroke(guard)
  ctx.strokeStyle = '#aa6cb7'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-2, -11); ctx.lineTo(3, -7); ctx.lineTo(5, -2); ctx.moveTo(-5, 3); ctx.lineTo(1, 7); ctx.lineTo(3, 9); ctx.stroke()
  ctx.fillStyle = '#e582c3'; ctx.shadowColor = '#f27dcf'; ctx.shadowBlur = 5
  ctx.beginPath(); ctx.moveTo(0, -2.6); ctx.lineTo(3, 0); ctx.lineTo(0, 2.6); ctx.lineTo(-2, 0); ctx.closePath(); ctx.fill()
  ctx.shadowBlur = 0; ctx.restore()
  // 稀疏星芒强调金属光泽，不用密集粒子遮住刃形。
  if (!opts.empowered) {
    const sparkle = Math.pow(Math.max(0, Math.sin(time * 3.1)), 12)
    ctx.save(); ctx.globalAlpha *= sparkle; ctx.strokeStyle = '#faeac4'; ctx.lineWidth = 0.8; ctx.shadowColor = '#f18ccb'; ctx.shadowBlur = 5
    ctx.beginPath(); ctx.moveTo(53, -6); ctx.lineTo(53, 2); ctx.moveTo(49, -2); ctx.lineTo(57, -2); ctx.stroke(); ctx.restore()
    return
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'
  const length = 198
  // 根部留出真实剑体；不等宽的焰状包络收成锐尖，不画圆头灯管。
  for (let layer = 0; layer < 3; layer++) {
    ctx.beginPath()
    for (const side of [-1, 1]) {
      for (let j = 0; j <= 28; j++) {
        const i = side < 0 ? j : 28 - j
        const t = i / 28, x = 35 + t * (length - 35)
        const envelope = Math.sin(Math.PI * t) * (layer === 0 ? 15 : layer === 1 ? 8 : 3.4)
        const flame = Math.sin(i * 2.3 - time * 21 + layer) * Math.sin(Math.PI * t) * (3 - layer)
        const y = side * (envelope + flame + (1 - t) * 2)
        if (side < 0 && j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
    }
    ctx.closePath()
    const energy = ctx.createLinearGradient(35, 0, length, 0)
    energy.addColorStop(0, ['#b44ec440', '#ee71bf60', '#fdeee990'][layer])
    energy.addColorStop(0.3, ['#ad4aba80', '#f68bc7d0', '#fdf4e8'][layer])
    energy.addColorStop(0.85, ['#d04ea260', '#fbc0dcc0', '#f9e9ce'][layer])
    energy.addColorStop(1, '#f9e5c300')
    ctx.fillStyle = energy; ctx.shadowColor = '#eb70c8'; ctx.shadowBlur = layer === 0 ? 12 : 4; ctx.fill()
  }
  ctx.shadowBlur = 0
  // 非对称离刃火舌与沿轴流动的金粉碎光。
  for (let i = 0; i < 10; i++) {
    const t = ((time * 0.55 + i * 0.137) % 1), x = 50 + t * 139
    const side = i % 2 ? -1 : 1, y = side * (7 + Math.sin(t * Math.PI) * 9)
    ctx.globalAlpha = Math.sin(t * Math.PI) * 0.8
    ctx.fillStyle = i % 3 ? '#ee89d2' : '#f9d7a9'
    ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 3, y - side * 3); ctx.lineTo(x + 10, y + side * 7); ctx.lineTo(x, y + side * 3); ctx.closePath(); ctx.fill()
  }
  ctx.globalAlpha = 0.8; ctx.strokeStyle = '#fde8f6'; ctx.lineWidth = 0.9
  ctx.beginPath()
  for (let i = 0; i < 15; i++) {
    const x = 44 + i * 10, y = Math.sin(i * 2.4 + time * 28) * 2.8
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.restore()
}

