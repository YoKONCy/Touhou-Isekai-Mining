import type { AudioEngine } from '../../../../../game/audio/Sfx'

/** 双刃的轻快破风分出左右音高，双刀同挥叠短促金属尾音。 */
export function dualSound(a: AudioEngine, phase: 'windup' | 'active' | 'recover', segment: number): void {
  if (phase !== 'active') return
  a.ensure()
  a.noise({ dur: .11, type: 'bandpass', curve: [530, segment % 2 ? 2300 : 1800, 730, 280], q: .5, vol: .105, env: 'swell', rev: .04 })
  if (segment % 4 >= 2) a.noise({ dur: .075, at: .02, type: 'highpass', curve: [1700, 620], vol: .05, env: 'swell' })
  a.osc({ wave: 'triangle', f0: 1200, f1: 470, dur: .04, vol: .014, attack: .003, rev: .025 })
}
export function dualReady(a: AudioEngine): void {
  a.ensure()
  a.noise({ dur: .2, type: 'bandpass', curve: [300, 1500, 800], vol: .05, env: 'swell' })
  a.osc({ wave: 'sine', f0: 700, f1: 1050, dur: .13, vol: .027, attack: .018, rev: .07 })
}
