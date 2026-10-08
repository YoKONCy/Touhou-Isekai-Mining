import type { AudioEngine } from '../../../../../game/audio/Sfx'

/** 拔刀轻响、薄刃破风、旋斩双层风尾，音色仍沿用现有材质总线。 */
export function katanaSound(audio: AudioEngine, phase: 'windup' | 'active' | 'recover', segment: number): void {
  audio.ensure()
  if (phase === 'windup' && segment === 0) {
    audio.noise({ dur: .045, type: 'highpass', curve: [1300, 3400, 1800], vol: .075, env: 'whip', rev: .035 })
    audio.modal(1400, [1, 2.4, 3.7], [.22, .06, .02], [.06, .025, .015], { vol: .12, rev: .045 })
  } else if (phase === 'active') {
    const spin = segment === 3, heavy = segment === 2
    audio.noise({ dur: spin ? .18 : .12, type: 'bandpass', curve: [700, heavy ? 2300 : 3400, 1800, 650], q: .5, vol: spin ? .17 : .14, env: 'whip', pan: segment === 1 ? .09 : -.09, rev: .055 })
    if (heavy || spin) audio.noise({ dur: .13, buf: audio.brownNoise, type: 'lowpass', curve: [300, 900, 240], vol: .09, env: 'swell', at: spin ? .055 : .015, rev: .04 })
  }
}
