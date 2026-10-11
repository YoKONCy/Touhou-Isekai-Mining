import { randomAudio } from '../../../../../core/simulation/random'
import type { AudioEngine } from '../../../../../game/audio/Sfx'

/** 左右棍击保留短链声，第三段改为抬腿衣料、踢出破风和收脚声。 */
export function nunchakuSound(audio: AudioEngine, phase: 'windup' | 'active' | 'recover', segment: number): void {
  audio.ensure()
  if (segment === 2) {
    if (phase === 'windup') audio.noise({ dur: .055, buf: audio.brownNoise, type: 'bandpass', curve: [220, 640, 320], q: .5, vol: .07, env: 'swell', rev: .025 })
    else if (phase === 'active') {
      audio.noise({ dur: .11, buf: audio.brownNoise, type: 'lowpass', curve: [260, 1350, 380, 120], q: .45, vol: .24, env: 'whip', rev: .055 })
      audio.noise({ dur: .055, type: 'bandpass', curve: [700, 1900, 550], q: .5, vol: .09, at: .012, env: 'swell', rev: .03 })
    } else audio.noise({ dur: .045, buf: audio.brownNoise, type: 'lowpass', curve: [390, 150], q: .5, vol: .055, env: 'hit', rev: .025 })
    return
  }
  const tone = (segment === 1 ? 1.14 : 1) * (.97 + randomAudio() * .06)
  if (phase === 'windup') {
    audio.noise({ dur: .065, buf: audio.brownNoise, type: 'bandpass', curve: [180, 480, 800], q: .45, vol: .10, env: 'swell', rev: .04 })
    audio.modal(2450 * tone, [1, 2.37, 3.81], [.5, .16, .06], [.018, .012, .008], { vol: .012, rev: .02 })
  } else if (phase === 'active') {
    // 胸腔般的压风、宽带棍身抽风、收束瞬态三层，不再突出嘎吱般窄频噪声。
    audio.osc({ wave: 'sine', f0: 145 * tone, f1: 48 * tone, dur: .12, vol: .13, attack: .013, lp: 420, rev: .08 })
    audio.noise({ dur: .12, buf: audio.brownNoise, type: 'lowpass', curve: [340, 1400, 420, 160], q: .45, vol: .24, env: 'swell', rev: .075 })
    audio.noise({ dur: .09, type: 'bandpass', curve: [600 * tone, 2200 * tone, 650], q: .4, vol: .15, at: .012, env: 'swell', rev: .05 })
    audio.noise({ dur: .035, buf: audio.brownNoise, type: 'lowpass', f0: 700, q: .45, vol: .11, at: .043, env: 'hit', rev: .06 })
    audio.noise({ dur: .035, type: 'bandpass', curve: [2800, 1000], q: .4, vol: .04, at: .03, env: 'swell', rev: .025 })
    audio.noise({ dur: .065, buf: audio.brownNoise, type: 'lowpass', curve: [750, 220], q: .4, vol: .045, at: .075, env: 'swell', rev: .09 })
  } else {
    audio.noise({ dur: .045, buf: audio.brownNoise, type: 'lowpass', curve: [650, 180], q: .45, vol: .06, env: 'swell', rev: .025 })
    audio.modal(1900 * tone, [1, 2.31, 3.73], [.4, .12, .04], [.018, .011, .007], { at: .015, vol: .01, rev: .015 })
  }
}
