/** 所有玩法共享逻辑时间；暂停来源叠加，关闭一个面板不会误解除其他暂停。 */
export class SimulationClock {
  private readonly reasons = new Set<string>()
  private elapsed = 0
  get paused(): boolean { return this.reasons.size > 0 }
  get time(): number { return this.elapsed }
  restoreTime(time: number): void {
    if (!Number.isFinite(time) || time < 0) throw new Error('模拟时钟快照无效')
    this.elapsed = time
  }
  setPaused(reason: string, paused: boolean): void {
    if (paused) this.reasons.add(reason)
    else this.reasons.delete(reason)
  }
  advance(dt: number): number {
    if (this.paused || !Number.isFinite(dt) || dt <= 0) return 0
    this.elapsed += dt
    return dt
  }
}
