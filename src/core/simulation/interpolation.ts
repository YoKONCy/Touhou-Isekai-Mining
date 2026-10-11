let alpha = 1
export function withInterpolation<T>(value: number, render: () => T): T {
  const previous = alpha; alpha = Math.max(0, Math.min(1, value))
  try { return render() } finally { alpha = previous }
}
/** 不改实体真实坐标；瞬移、读档和切房时主动清空历史。 */
export class MotionHistory {
  private x: number | null = null
  private y = 0
  capture(x: number, y: number): void { this.x = x; this.y = y }
  reset(): void { this.x = null }
  offset(x: number, y: number): { x: number; y: number } {
    if (this.x === null || Math.hypot(x - this.x, y - this.y) > 96) return { x: 0, y: 0 }
    return { x: (this.x - x) * (1 - alpha), y: (this.y - y) * (1 - alpha) }
  }
}
const positions=new WeakMap<object,MotionHistory>()
export function captureMotion(entity:{x:number;y:number}):void{
  let history=positions.get(entity)
  if(!history){history=new MotionHistory();positions.set(entity,history)}
  history.capture(entity.x,entity.y)
}
export function interpolatedPosition(entity:{x:number;y:number}):{x:number;y:number}{
  const offset=positions.get(entity)?.offset(entity.x,entity.y)
  return{x:entity.x+(offset?.x??0),y:entity.y+(offset?.y??0)}
}
