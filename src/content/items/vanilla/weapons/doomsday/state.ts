import type { DoomTrail } from './effects'

/** 每名持有者独立保存模式、冷却与攻击表现，不进入存档。 */
export class DoomsdayState {
  mode = false
  strikes = 0
  cooldown = 0
  duration = 0
  modeFx = 0
  swingHit = false
  hitIndex = 0
  swingSerial = 0
  swingEmpowered = false
  alternation = 0
  liftStart = 0
  cdPulseAt = -10
  crescents: DoomTrail[] = []

  reduceCooldown(seconds: number): boolean {
    if (this.cooldown <= 0) return false
    this.cooldown = Math.max(0, this.cooldown - seconds)
    this.cdPulseAt = performance.now()
    return true
  }
  start(strikes: number): void {
    this.mode = true; this.duration = 8; this.modeFx = 1
    this.strikes = Math.min(8, strikes); this.hitIndex = 0; this.swingHit = false
  }
  finish(): void {
    this.mode = false; this.duration = 0; this.modeFx = -1
    this.strikes = 0; this.cooldown = 15
  }
  update(dt: number): boolean {
    this.cooldown = Math.max(0, this.cooldown - dt)
    if (this.mode) this.duration = Math.max(0, this.duration - dt)
    return this.mode && this.duration === 0
  }
  updateTransition(dt: number): void {
    this.modeFx += this.modeFx > 0 ? -dt * 3.2 : dt * 2.4
    this.modeFx = Math.max(-1, Math.min(1, this.modeFx))
  }
}
