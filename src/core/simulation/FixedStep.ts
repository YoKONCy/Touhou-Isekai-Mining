/** 固定逻辑步长与渲染解耦；积压有上限，后台恢复绝不补跑整段离线时间。 */
export class FixedStep {
  static readonly DT = 1 / 60
  static readonly MAX_STEPS = 8
  private accumulator = 0
  timeScale = 1
  droppedTime = 0
  get alpha(): number { return this.accumulator / FixedStep.DT }
  reset(): void { this.accumulator = 0 }
  advance(frameDt: number, step: (dt: number) => boolean): number {
    if (!Number.isFinite(frameDt) || frameDt <= 0) return 0
    const incoming = frameDt * Math.max(0, Math.min(4, this.timeScale))
    const maximum = FixedStep.DT * FixedStep.MAX_STEPS
    this.droppedTime += Math.max(0, this.accumulator + incoming - maximum)
    this.accumulator = Math.min(maximum, this.accumulator + incoming)
    let count = 0
    while (this.accumulator + 1e-10 >= FixedStep.DT && count < FixedStep.MAX_STEPS) {
      this.accumulator = Math.max(0, this.accumulator - FixedStep.DT)
      count++
      if (!step(FixedStep.DT)) { this.reset(); break }
    }
    return count
  }
}
