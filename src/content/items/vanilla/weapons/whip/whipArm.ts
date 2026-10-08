import type { WeaponMotionView } from '../../../types'

export function whipArmAim(v: WeaponMotionView): number {
  const { move: m, phase, timer, aim: base } = v

      if (phase === 'windup') return base - .3 - .55 * (1 - timer / m.windup)
      if (phase === 'active') return base - .85 * Math.pow(Math.max(0, timer / m.active), 2)
      return base + .15 * Math.sin(Math.PI * Math.max(0, timer / m.recover))
    
}
