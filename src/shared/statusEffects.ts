/** 状态系统不依赖渲染或场景；所有计时均由游戏逻辑时间推进。 */
export type StatusKind = 'buff' | 'debuff'
export type RemovalReason = 'expired' | 'source' | 'death' | 'scene' | 'manual'
export type StatusStat = 'physicalDamageTaken' | 'moveSpeed' | 'attackSpeed' | 'damageTaken' | 'damageDealt' | 'dodgeCooldown' | 'spellCooldown' | 'manaCost' | 'healing'
export interface StatusOwner {
  hp: number
  alive: boolean
  heal(amount: number): number
}
export interface StatusEvents {
  beforeDamage: { amount: number; kind: string; cancelled: boolean }
  damaged: { amount: number; kind: string }
  beforeHeal: { amount: number }
  healed: { amount: number }
  dodge: { kind: 'short' | 'long'; cooldown: number }
  spell: { manaCost: number; cooldown: number }
  death: Record<string, never>
}
export interface StatusContext { owner: StatusOwner; effects: StatusEffects; instance: StatusInstance }
export interface StatusModifier { stat: StatusStat; add?: number; percent?: number; multiply?: number }
/** 移动残影的视觉参数，时间以秒、间距以像素计；不参与属性结算。 */
export interface StatusAfterimage { interval: number; duration: number; opacity: number; minDistance: number }
export interface StatusDefinition {
  id: string
  kind: StatusKind
  nameKey: string
  descriptionKey: string
  effectKey?: string
  conditionKey?: string
  /** 程序化矢量图案，定义内容来自本地可信代码。 */
  icon: string
  duration?: number
  /** 手持来源解除后继续保留的秒数；重新握持恢复常驻，不叠加。 */
  heldReleaseDuration?: number
  stacking?: 'refresh' | 'stack' | 'independent'
  maxStacks?: number
  priority?: number
  persistOnDeath?: boolean
  modifiers?: readonly StatusModifier[]
  /** 晕眩等状态冻结主动行动；不等同于武器的弹幕僵直抗性。 */
  incapacitated?: boolean
  /** 技能封印只禁止主动技能，不冻结普通走位，也不受弹幕僵直抗性削减。 */
  skillsDisabled?: boolean
  /** 暂时不能被攻击锁定或命中，计时独立于受伤和闪避无敌帧。 */
  untargetable?: boolean
  afterimage?: StatusAfterimage
  interval?: number
  onApply?: (context: StatusContext) => void
  onRefresh?: (context: StatusContext) => void
  onRemove?: (context: StatusContext, reason: RemovalReason) => void
  onTick?: (context: StatusContext) => void
  hooks?: { [K in keyof StatusEvents]?: (context: StatusContext, event: StatusEvents[K]) => void }
}
export interface StatusInstance {
  readonly key: number
  readonly definition: StatusDefinition
  readonly source: string
  remaining: number | null
  stacks: number
  intervalElapsed: number
}
export interface StatusSnapshot {
  key: number
  id: string
  kind: StatusKind
  nameKey: string
  descriptionKey: string
  effectKey?: string
  conditionKey?: string
  icon: string
  source: string
  remaining: number | null
  stacks: number
}
export class StatusEffects {
  private instances: StatusInstance[] = []
  private sequence = 0
  constructor(private readonly owner: StatusOwner) {}
  get untargetable(): boolean { return this.instances.some(s => s.definition.untargetable) }
  get incapacitated(): boolean { return this.instances.some(s => s.definition.incapacitated) }
  get skillsDisabled(): boolean { return this.instances.some(s => s.definition.skillsDisabled) }
  private context(instance: StatusInstance): StatusContext { return { owner: this.owner, effects: this, instance } }
  add(definition: StatusDefinition, source: string, duration: number | null | undefined = definition.duration): number {
    const existing = this.instances.find(s => s.definition.id === definition.id && s.source === source)
    if (existing && definition.stacking !== 'independent') {
      existing.remaining = duration ?? null
      if (definition.stacking === 'stack') existing.stacks = Math.min(definition.maxStacks ?? 1, existing.stacks + 1)
      definition.onRefresh?.(this.context(existing))
      return existing.key
    }
    const instance: StatusInstance = { key: ++this.sequence, definition, source, remaining: duration ?? null, stacks: 1, intervalElapsed: 0 }
    this.instances.push(instance)
    this.instances.sort((a, b) => (a.definition.priority ?? 0) - (b.definition.priority ?? 0) || a.key - b.key)
    definition.onApply?.(this.context(instance))
    return instance.key
  }
  remove(key: number, reason: RemovalReason = 'manual'): void {
    const instance = this.instances.find(s => s.key === key)
    if (!instance) return
    this.instances = this.instances.filter(s => s !== instance)
    instance.definition.onRemove?.(this.context(instance), reason)
  }
  removeSource(source: string, reason: RemovalReason = 'source'): void {
    for (const s of [...this.instances]) if (s.source === source) this.remove(s.key, reason)
  }
  /** 持握状态常驻；离手只启动一次残留倒计时，重新握持沿用同一实例。 */
  syncHeld(definitions: readonly StatusDefinition[], source: string): void {
    for (const s of [...this.instances]) {
      if (s.source !== source) continue
      const held = definitions.find(definition => definition.id === s.definition.id)
      if (held) {
        if (s.remaining !== null) {
          s.remaining = null
          held.onRefresh?.(this.context(s))
        }
      } else {
        const duration = s.definition.heldReleaseDuration ?? 0
        if (duration > 0) {
          if (s.remaining === null) s.remaining = duration
        } else this.remove(s.key, 'source')
      }
    }
    for (const definition of definitions) {
      if (!this.instances.some(s => s.source === source && s.definition.id === definition.id)) this.add(definition, source, null)
    }
  }
  clear(reason: RemovalReason): void {
    for (const s of [...this.instances]) if (reason !== 'death' || !s.definition.persistOnDeath) this.remove(s.key, reason)
  }
  /** 固定加值、百分比加值、独立倍率依次结算，不修改基础属性。 */
  modify(stat: StatusStat, base: number): number {
    let add = 0, percent = 0, multiplier = 1
    for (const s of this.instances) for (const m of s.definition.modifiers ?? []) if (m.stat === stat) {
      add += (m.add ?? 0) * s.stacks
      percent += (m.percent ?? 0) * s.stacks
      multiplier *= (m.multiply ?? 1) ** s.stacks
    }
    return Math.max(0, (base + add) * (1 + percent) * multiplier)
  }
  dispatch<K extends keyof StatusEvents>(name: K, event: StatusEvents[K]): void {
    for (const s of [...this.instances]) if (this.instances.includes(s)) s.definition.hooks?.[name]?.(this.context(s), event)
  }
  update(dt: number): void {
    for (const s of [...this.instances]) {
      if (!this.instances.includes(s)) continue
      const activeDt = s.remaining === null ? dt : Math.min(dt, s.remaining)
      if (s.definition.interval && s.definition.interval > 0) {
        s.intervalElapsed += activeDt
        while (s.intervalElapsed >= s.definition.interval && this.instances.includes(s)) {
          s.intervalElapsed -= s.definition.interval
          s.definition.onTick?.(this.context(s))
        }
      }
      if (s.remaining !== null) {
        s.remaining = Math.max(0, s.remaining - dt)
        if (s.remaining === 0) this.remove(s.key, 'expired')
      }
    }
  }
  snapshot(): StatusSnapshot[] {
    return this.instances.map(s => ({ key: s.key, id: s.definition.id, kind: s.definition.kind, nameKey: s.definition.nameKey, descriptionKey: s.definition.descriptionKey, effectKey: s.definition.effectKey, conditionKey: s.definition.conditionKey, icon: s.definition.icon, source: s.source, remaining: s.remaining, stacks: s.stacks }))
  }
  /** 渲染只查询所需状态，不为每帧生成整份 HUD 快照。 */
  remaining(id: string): number | null | undefined {
    return this.instances.find(s => s.definition.id === id)?.remaining
  }
  /** 多个状态只选最明显的一组残影，避免叠加渲染与逐帧创建快照。 */
  afterimage(): StatusAfterimage | undefined {
    let result: StatusAfterimage | undefined
    for (const s of this.instances) {
      const visual = s.definition.afterimage
      if (visual && (!result || visual.opacity > result.opacity)) result = visual
    }
    return result
  }
}

export const SLAUGHTER_STANCE: StatusDefinition = {
  id: 'touhou:slaughter_stance', kind: 'buff', nameKey: 'status.slaughter.name', descriptionKey: 'status.slaughter.desc', effectKey: 'status.slaughter.effect', conditionKey: 'status.slaughter.condition',
  icon: '<svg viewBox="0 0 32 32" fill="none"><path d="M8 6A12 12 0 1 0 25 10" stroke="#b77963" stroke-width="2"/><path d="m20 3 5 2-9 17-4-3Z" fill="#e6d4b1"/><path d="m9 17 10 6M13 21l-4 7" stroke="#c98468" stroke-width="2"/><path d="m25 2-2 8 5-2" stroke="#d29b7a"/></svg>',
  modifiers: [{ stat: 'damageTaken', multiply: .2 }]
}
export const CRIMSON_BLESSING: StatusDefinition = {
  id: 'touhou:crimson_blessing', kind: 'buff', nameKey: 'status.crimson.name', descriptionKey: 'status.crimson.desc', effectKey: 'status.crimson.effect', conditionKey: 'status.crimson.condition', persistOnDeath: true,
  icon: '<svg viewBox="0 0 32 32" fill="none"><path d="M17 4c2 8 10 8 9 17-1 5-5 8-10 7 5-4 5-7 2-10-1 5-4 7-8 8C2 19 9 13 12 7c0 5 2 6 3 7Z" fill="#c58468"/><path d="m4 12 7-2M2 17h7M4 22h5" stroke="#dfc29a" stroke-width="1.5"/></svg>',
  modifiers: [{ stat: 'moveSpeed', percent: .5 }, { stat: 'dodgeCooldown', multiply: .1 }]
}
