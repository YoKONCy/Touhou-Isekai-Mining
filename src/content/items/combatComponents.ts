import type { ItemDef, MeleeMove } from './types'

/** 资源使用完整角度（度），只有运行时使用半角弧度。 */
export function meleeMove(config: Omit<MeleeMove, 'arc'> & { angleDegrees: number }): MeleeMove {
  const { angleDegrees, ...values } = config
  return { ...values, arc: angleDegrees * Math.PI / 360 }
}

/** 连段武器按段选取具体判定；返回的招式在起手时保存，切换装备不改正在进行的攻击。 */
export function meleeForSegment(item: ItemDef, segment: number): MeleeMove | undefined {
  const moves = item.meleePattern?.moves
  return moves?.length ? moves[((segment % moves.length) + moves.length) % moves.length] : item.melee
}

/** 内外圈共用命中和衰减顺序，只替换本目标的基础伤害与武器穿透。 */
export function meleeImpact(move: MeleeMove, distance: number, penetration: number): { damage: number; penetration: number } {
  const inner = move.innerZone
  return inner && distance <= inner.reach ? { damage: inner.damage, penetration: inner.penetration } : { damage: move.damage, penetration }
}

export function chargeMultiplier(component: NonNullable<ItemDef['weapon']>['chargeAttack'], progress: number): number {
  let multiplier = 1, threshold = -1
  for (const tier of component?.tiers ?? []) if (progress + 1e-8 >= tier.progress && tier.progress > threshold) {
    threshold = tier.progress; multiplier = tier.multiplier
  }
  return multiplier
}

/** 单体模式只允许首个目标命中，不需要填写伤害保留比例。 */
export type AoeFalloff =
  | { mode: 'none' }
  | {
      mode: 'exponential' | 'secondary'
      /** 后续目标伤害保留比例，1 表示不衰减。 */
      retention: number
    }

export function aoeMultiplier(component: AoeFalloff | undefined, hitIndex: number): number {
  if (!component || hitIndex === 0) return 1
  if (component.mode === 'none') return 0
  return component.mode === 'secondary' ? component.retention : Math.pow(component.retention, hitIndex)
}
