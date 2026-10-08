import type { WeaponBladeView } from '../../../types'
import { redThrust } from './motion'

/** 仅第四段后撤横扫的灰白枪刃擦弹，其他普攻、杆身和劈地技能都不提供擦弹。 */
export function redSpearBlade(v: WeaponBladeView): readonly [{ x: number; y: number }, { x: number; y: number }] | undefined {
  if (v.phase !== 'active' || v.motion.segment % 4 !== 3 || v.motion.chargeFull) return undefined
  const thrust = redThrust(v.motion), c = Math.cos(v.hand.angle), s = Math.sin(v.hand.angle)
  return [
    { x: v.hand.x + c * (56 + thrust), y: v.hand.y + s * (56 + thrust) },
    { x: v.hand.x + c * (88 + thrust), y: v.hand.y + s * (88 + thrust) }
  ]
}
