import type { AudioEngine } from '../../../../../game/audio/Sfx'

/** 低中频空气冲击为主体，链节只作起落点；三段音色随横抽、回抽、重砸变化。 */
export function nunchakuSound(audio: AudioEngine, phase: 'windup' | 'active' | 'recover', segment: number): void {
  audio.ensure()
  const heavy = segment === 2
  const tone = (segment === 1 ? 1.14 : heavy ? .78 : 1) * (.97 + Math.random() * .06)
  if (phase === 'windup') {
    audio.noise({ dur: .065, buf: audio.brownNoise, type: 'bandpass', curve: [180, 480, 800], q: .45, vol: .10, env: 'swell', rev: .04 })
    audio.modal(2450 * tone, [1, 2.37, 3.81], [.5, .16, .06], [.018, .012, .008], { vol: .012, rev: .02 })
  } else if (phase === 'active') {
    // 胸腔般的压风、宽带棍身抽风、收束瞬态三层，不再突出嘎吱般窄频噪声。
    audio.osc({ wave: 'sine', f0: 145 * tone, f1: 48 * tone, dur: heavy ? .17 : .12, vol: heavy ? .17 : .13, attack: .013, lp: 420, rev: .08 })
    audio.noise({ dur: heavy ? .16 : .12, buf: audio.brownNoise, type: 'lowpass', curve: [340, 1400, 420, 160], q: .45, vol: .24, env: 'swell', rev: .075 })
    audio.noise({ dur: .09, type: 'bandpass', curve: [600 * tone, 2200 * tone, 650], q: .4, vol: .15, at: .012, env: 'swell', rev: .05 })
    audio.noise({ dur: .035, buf: audio.brownNoise, type: 'lowpass', f0: 700, q: .45, vol: heavy ? .17 : .11, at: .043, env: 'hit', rev: .06 })
    audio.noise({ dur: .035, type: 'bandpass', curve: [2800, 1000], q: .4, vol: .04, at: .03, env: 'swell', rev: .025 })
    audio.noise({ dur: .065, buf: audio.brownNoise, type: 'lowpass', curve: [750, 220], q: .4, vol: .045, at: .075, env: 'swell', rev: .09 })
  } else {
    audio.noise({ dur: .045, buf: audio.brownNoise, type: 'lowpass', curve: [650, 180], q: .45, vol: .06, env: 'swell', rev: .025 })
    audio.modal(1900 * tone, [1, 2.31, 3.73], [.4, .12, .04], [.018, .011, .007], { at: .015, vol: .01, rev: .015 })
  }
}
