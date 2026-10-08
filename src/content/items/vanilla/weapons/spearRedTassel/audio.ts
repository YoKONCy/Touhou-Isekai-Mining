import type { AudioEngine } from '../../../../../game/audio/Sfx'

/** 长枪破风保持低频气势与清亮刃鸣，退步扫枪多一条反向风尾。 */
export function redSpearSound(a: AudioEngine, phase: 'windup' | 'active' | 'recover', segment: number, charged: boolean): void {
  a.ensure()
  if (phase === 'windup') a.noise({ dur: .07, type: 'bandpass', curve: [240, 720, 480], vol: .045, env: 'swell' })
  if (phase !== 'active') return
  a.noise({ dur: segment === 2 ? .105 : .19, type: 'bandpass', curve: [240, 1800, 1000, 260], q: .6, vol: charged ? .2 : .14, env: 'swell', rev: .055 })
  a.osc({ wave: 'triangle', f0: charged ? 810 : 1100, f1: 320, dur: .08, vol: .023, attack: .007, rev: .045 })
  if (segment === 3) a.noise({ dur: .16, at: .035, type: 'lowpass', curve: [650, 1200, 220], vol: .08, env: 'swell', pan: -.15 })
}
export function redSpearReady(a: AudioEngine): void {
  a.ensure(); a.noise({ dur: .28, type: 'bandpass', curve: [170, 780, 320], vol: .08, env: 'swell', rev: .06 })
  a.osc({ wave: 'sine', f0: 360, f1: 680, dur: .2, vol: .042, attack: .025, rev: .09 })
}
/** 砸地以低频压力和可听见的中低频闷响为主，去掉清亮石面振铃，落屑只留短暗尾。 */
export function redSpearImpact(a: AudioEngine): void {
  a.ensure()
  // 深沉压力打底，另用低通三角波补足普通扬声器能表现的重量，不只依赖超低频。
  a.osc({ wave: 'sine', f0: 92, f1: 46, dur: .48, vol: .48, attack: .003, lp: 170, rev: .11 })
  a.osc({ wave: 'triangle', f0: 186, f1: 91, dur: .34, vol: .34, attack: .003, lp: 460, rev: .085 })
  a.osc({ wave: 'triangle', f0: 305, f1: 128, dur: .17, vol: .14, attack: .002, lp: 630, rev: .055 })
  a.noise({ dur: .42, buf: a.brownNoise, type: 'lowpass', curve: [640, 370, 205, 110], q: .35, vol: .5, env: 'hit', rev: .13 })
  a.noise({ dur: .22, type: 'bandpass', curve: [210, 310, 165, 95], q: .45, vol: .29, env: 'hit', rev: .09 })
  a.noise({ dur: .04, type: 'lowpass', curve: [850, 360], q: .35, vol: .12, env: 'hit', rev: .035 })
  for (let i = 0; i < 6; i++) {
    a.noise({ dur: .045+i*.008, at: .045+i*.045, type: 'bandpass', curve: [850-i*60,340,160], q: .55, vol: .047-i*.005, env: 'hit', rev: .065 })
  }
}
