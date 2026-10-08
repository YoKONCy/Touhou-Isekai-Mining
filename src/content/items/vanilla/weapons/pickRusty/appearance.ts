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

/** 生锈铁镐：旧木柄（下侧暗条）+ 锈铁端头箍 + 上下双尖回勾镐头（锈斑+磨亮刃口） */
export function drawPick(ctx: CanvasRenderingContext2D): void {
  // 柄尾小环
  block(ctx, () => ctx.rect(-3.6, -1.4, 2.2, 2.8), MAT.woodDark)
  // 木柄
  block(ctx, () => ctx.rect(-1.8, -1.5, 17.4, 3), MAT.wood)
  ctx.fillStyle = MAT.woodDark
  ctx.fillRect(-1.2, 0.4, 16.2, 1.1)
  // 端头锈铁箍（中央块）
  block(ctx, () => ctx.rect(13.4, -4.6, 3.6, 9.2), MAT.ironWorn)
  ctx.fillStyle = MAT.ironDark
  ctx.fillRect(13.4, 3, 3.6, 1.6)
  // 箍上一块锈痕
  ctx.fillStyle = MAT.rust
  ctx.fillRect(13.8, -3.6, 1.6, 2.4)
  // 双尖镐齿（朝柄方向回勾的弯弧，积木多边形）
  for (const sgn of [-1, 1]) {
    block(
      ctx,
      () => {
        ctx.moveTo(8.2, sgn * 7.2)
        ctx.lineTo(13.6, sgn * 5.6)
        ctx.lineTo(16.6, sgn * 3.5)
        ctx.lineTo(15.6, sgn * 2.3)
        ctx.lineTo(10.6, sgn * 3.9)
      },
      MAT.ironWorn
    )
    // 齿尖暗影（尖端最旧最锈）
    ctx.fillStyle = MAT.rustDark
    ctx.beginPath()
    ctx.moveTo(8.2, sgn * 7.2)
    ctx.lineTo(10.6, sgn * 3.9)
    ctx.lineTo(12.2, sgn * 4.4)
    ctx.lineTo(10.8, sgn * 6.6)
    ctx.closePath()
    ctx.fill()
    // 齿面锈斑（齿根处一小块）
    ctx.fillStyle = MAT.rust
    ctx.beginPath()
    ctx.moveTo(13.2, sgn * 5.2)
    ctx.lineTo(15.2, sgn * 3.9)
    ctx.lineTo(14.7, sgn * 3.1)
    ctx.lineTo(12.8, sgn * 4.2)
    ctx.closePath()
    ctx.fill()
    // 磨亮的上沿刃口（细一线，提示仍能挖矿）
    ctx.strokeStyle = MAT.ironEdge
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(9.4, sgn * 6.4)
    ctx.lineTo(15.4, sgn * 3.3)
    ctx.stroke()
  }
}