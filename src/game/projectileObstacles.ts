import type { TileMap } from './tilemap'

/** 弹幕掩体段，与摆件碰撞段兼容。 */
export interface BulletBlocker { x0: number; x1: number; y0: number; y1: number }

/** 沿飞行段扫掠墙体、矿石与掩体，慢弹和低帧率高速弹使用同一套检测。 */
export function sweepProjectileObstacles(map: TileMap, blockers: readonly BulletBlocker[], x0: number, y0: number, x1: number, y1: number, r: number, ignoreOre=false): { x: number; y: number; prop: boolean } | null {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4))
  for (let i = 1; i <= steps; i++) {
    const x = x0 + (x1 - x0) * i / steps, y = y0 + (y1 - y0) * i / steps
    if (map.solidAtWorld(x, y,ignoreOre) || map.solidAtWorld(x - r, y,ignoreOre) || map.solidAtWorld(x + r, y,ignoreOre) || map.solidAtWorld(x, y - r,ignoreOre) || map.solidAtWorld(x, y + r,ignoreOre)) return { x, y, prop: false }
    for (const b of blockers) {
      const dx = x - Math.max(b.x0, Math.min(x, b.x1)), dy = y - Math.max(b.y0, Math.min(y, b.y1))
      if (dx * dx + dy * dy <= r * r) return { x, y, prop: true }
    }
  }
  return null
}
