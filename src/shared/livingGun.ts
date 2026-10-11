export interface LivingGunSave { ammo: number; untilRegen: number; recovering?: boolean }

/** 活体枪的档案级备弹：切换场景、手持或背包格不会重新装满。 */
export class LivingGunReserve {
  readonly capacity = 60
  ammo = 60
  untilRegen = 5
  clock = 0
  lastSpokeAt = -Infinity
  wasHeld = false
  lowHealth = false
  private recovering = false
  get recoveryInterval(): number { return this.recovering ? 2 : 5 }
  consume(): boolean {
    if (this.ammo <= 0) return false
    this.ammo--; this.untilRegen = 5; this.recovering = false
    return true
  }
  /** 停火第五秒首次补三发，之后每两秒补三发；返回本轮是否开始长牙。 */
  tick(dt: number): boolean {
    if (!Number.isFinite(dt) || dt <= 0) return false
    this.clock += dt
    if (this.ammo >= this.capacity) return false
    this.untilRegen -= dt
    let started = false
    while (this.untilRegen <= 0 && this.ammo < this.capacity) {
      if (!this.recovering) { started = true; this.recovering = true }
      this.ammo = Math.min(this.capacity, this.ammo + 3)
      this.untilRegen += 2
    }
    return started
  }
  toJSON(): LivingGunSave { return { ammo: this.ammo, untilRegen: this.untilRegen, recovering: this.recovering } }
  fromJSON(data?: Partial<LivingGunSave>): void {
    this.ammo = typeof data?.ammo === 'number' && Number.isFinite(data.ammo) ? Math.max(0, Math.min(60, Math.floor(data.ammo))) : 60
    this.untilRegen = typeof data?.untilRegen === 'number' && Number.isFinite(data.untilRegen) ? Math.max(0, Math.min(5, data.untilRegen)) : 5
    this.recovering = data?.recovering === true
    this.clock = 0; this.lastSpokeAt = -Infinity; this.wasHeld = false; this.lowHealth = false
  }
}
