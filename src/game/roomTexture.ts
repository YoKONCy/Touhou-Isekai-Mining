import { CONFIG } from './config'
import type { DoorSlot } from './tilemap'

/**
 * 房间离屏纹理预渲染
 * 整块地图（地面+墙体+门拱）只在房间创建时绘制一次到离屏 Canvas，
 * 运行时每帧仅一次 drawImage —— 这是 Canvas2D 大量瓦片的核心优化手段。
 * 门的封印红光/解封旋涡是状态相关的动态层，由 RoomRuntime 每帧叠加。
 */
export function createRoomTexture(doors: readonly DoorSlot[] = []): HTMLCanvasElement {
  const { tile, roomCols, roomRows, wallThickness } = CONFIG
  const w = roomCols * tile
  const h = roomRows * tile
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d')!

  // —— 地面：每格随机明度的岩洞石板 + 噪点 ——
  for (let col = 0; col < roomCols; col++) {
    for (let row = 0; row < roomRows; row++) {
      const x = col * tile
      const y = row * tile
      const shade = 34 + ((Math.random() * 8) | 0)
      ctx.fillStyle = `rgb(${shade},${shade + 3},${shade + 8})`
      ctx.fillRect(x, y, tile, tile)

      // 细噪点
      const dots = 2 + ((Math.random() * 3) | 0)
      for (let i = 0; i < dots; i++) {
        const v = shade + 8 + ((Math.random() * 10) | 0)
        ctx.fillStyle = `rgba(${v},${v + 4},${v + 10},0.5)`
        ctx.fillRect(x + ((Math.random() * tile) | 0), y + ((Math.random() * tile) | 0), 2, 2)
      }

      // 偶尔一块碎石 / 裂纹
      if (Math.random() < 0.18) {
        ctx.strokeStyle = 'rgba(0,0,0,0.28)'
        ctx.lineWidth = 1
        ctx.beginPath()
        const sx = x + 8 + Math.random() * (tile - 16)
        const sy = y + 8 + Math.random() * (tile - 16)
        ctx.moveTo(sx, sy)
        ctx.lineTo(sx + 6 * (Math.random() - 0.5), sy + 5)
        ctx.lineTo(sx + 10 * (Math.random() - 0.5), sy + 9)
        ctx.stroke()
      }
    }
  }

  // 石板网格线（极淡）
  ctx.strokeStyle = 'rgba(255,255,255,0.045)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let col = 1; col < roomCols; col++) {
    ctx.moveTo(col * tile + 0.5, wallThickness * tile)
    ctx.lineTo(col * tile + 0.5, h - wallThickness * tile)
  }
  for (let row = 1; row < roomRows; row++) {
    ctx.moveTo(wallThickness * tile, row * tile + 0.5)
    ctx.lineTo(w - wallThickness * tile, row * tile + 0.5)
  }
  ctx.stroke()

  // —— 四周墙体：交错砖纹，内缘压高光模拟凸起围边 ——
  const wall = wallThickness * tile
  drawWallBand(ctx, 0, 0, w, wall, 'bottom')
  drawWallBand(ctx, 0, h - wall, w, wall, 'top')
  drawWallBand(ctx, 0, 0, wall, h, 'right')
  drawWallBand(ctx, w - wall, 0, wall, h, 'left')

  // —— 门格：在砖墙上凿出石拱门 + 暗色通道 ——
  for (const d of doors) drawDoorway(ctx, d.col * tile, d.row * tile, tile)

  return cv
}

/** 画单格门洞：地面底色 → 暗通道 → 石拱门框（两侧立柱+顶楣） */
function drawDoorway(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  // 地面底（与大厅石板同色系，略亮，提示"这是通路"）
  ctx.fillStyle = '#2b2e36'
  ctx.fillRect(x, y, t, t)
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  ctx.fillRect(x + 2, y + 2, t - 4, 3)

  // 暗色通道（门后未知房间）
  const grad = ctx.createLinearGradient(0, y + 6, 0, y + t)
  grad.addColorStop(0, '#19131f')
  grad.addColorStop(1, '#08060c')
  ctx.fillStyle = grad
  ctx.fillRect(x + 8, y + 5, t - 16, t - 5)

  // 石拱门框
  ctx.fillStyle = '#4a3e32'
  ctx.fillRect(x + 3, y + 5, 6, t - 5) // 左立柱
  ctx.fillRect(x + t - 9, y + 5, 6, t - 5) // 右立柱
  ctx.fillRect(x + 3, y + 3, t - 6, 6) // 顶楣
  // 砖缝
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x + 3, y + 14)
  ctx.lineTo(x + 9, y + 14)
  ctx.moveTo(x + t - 9, y + 22)
  ctx.lineTo(x + t - 3, y + 22)
  ctx.stroke()
  // 门框内缘受光
  ctx.fillStyle = 'rgba(255,230,180,0.16)'
  ctx.fillRect(x + 9, y + 5, 2, t - 7)
  ctx.fillRect(x + t - 11, y + 5, 2, t - 7)
}

/** 画一段砖墙；innerEdge 指定朝活动区的那一边（用于内缘高光） */
function drawWallBand(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  innerEdge: 'top' | 'bottom' | 'left' | 'right'
): void {
  const { tile } = CONFIG
  ctx.fillStyle = '#3b3128'
  ctx.fillRect(x, y, w, h)

  // 所有墙带统一按"每行半砖高、错缝排列"绘制，对横带/竖带都成立
  const brickH = tile / 2
  const brickW = tile
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'
  ctx.lineWidth = 1.5

  const rows = Math.ceil(h / brickH)
  for (let row = 0; row < rows; row++) {
    const offset = row % 2 === 0 ? 0 : brickW / 2
    ctx.beginPath()
    ctx.moveTo(x, y + row * brickH + 0.5)
    ctx.lineTo(x + w, y + row * brickH + 0.5)
    ctx.stroke()
    for (let bx = x - brickW; bx <= x + w; bx += brickW) {
      ctx.beginPath()
      ctx.moveTo(bx + offset + 0.5, y + row * brickH)
      ctx.lineTo(bx + offset + 0.5, y + (row + 1) * brickH)
      ctx.stroke()
    }
  }

  // 内缘高光（模拟墙体凸起的受光边）
  ctx.fillStyle = 'rgba(255,230,180,0.14)'
  if (innerEdge === 'bottom') ctx.fillRect(x, y + h - 3, w, 3)
  if (innerEdge === 'top') ctx.fillRect(x, y, w, 3)
  if (innerEdge === 'right') ctx.fillRect(x + w - 3, y, 3, h)
  if (innerEdge === 'left') ctx.fillRect(x, y, 3, h)
}
