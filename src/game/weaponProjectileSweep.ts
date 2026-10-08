import type { WeaponBladeSegment } from '../content/items/types'

const pointDistance = (x: number, y: number, ax: number, ay: number, bx: number, by: number): number => {
  const dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy
  const t = length ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length)) : 0
  return (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2
}
/** 同时扫掠枪刃和弹幕轨迹，低帧率或高速子弹也不能从两帧之间穿过去。 */
export function bladeErasesProjectile(sweep: readonly WeaponBladeSegment[], x: number, y: number, radius: number, prevX = x, prevY = y): boolean {
  for (const blade of sweep) {
    const a = blade.from, b = blade.to, pad = blade.radius + radius
    if (Math.max(x, prevX) + pad < Math.min(a.x, b.x) || Math.min(x, prevX) - pad > Math.max(a.x, b.x)
      || Math.max(y, prevY) + pad < Math.min(a.y, b.y) || Math.min(y, prevY) - pad > Math.max(a.y, b.y)) continue
    const cross = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) => (qx - px) * (ry - py) - (qy - py) * (rx - px)
    const ab0 = cross(a.x, a.y, b.x, b.y, prevX, prevY), ab1 = cross(a.x, a.y, b.x, b.y, x, y)
    const pq0 = cross(prevX, prevY, x, y, a.x, a.y), pq1 = cross(prevX, prevY, x, y, b.x, b.y)
    const crossing = ((ab0 > 0 && ab1 < 0) || (ab0 < 0 && ab1 > 0)) && ((pq0 > 0 && pq1 < 0) || (pq0 < 0 && pq1 > 0))
    if (crossing || Math.min(pointDistance(x, y, a.x, a.y, b.x, b.y), pointDistance(prevX, prevY, a.x, a.y, b.x, b.y),
      pointDistance(a.x, a.y, prevX, prevY, x, y), pointDistance(b.x, b.y, prevX, prevY, x, y)) <= pad * pad) return true
  }
  return false
}
