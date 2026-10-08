import type { AudioEngine } from '../../../../../game/audio/Sfx'

/** 麻绳摩擦先起，突刺用短促的定向破风；命中音仍按敌人材质结算。 */
export function stoneSpearSound(audio: AudioEngine, phase: 'windup' | 'active' | 'recover'): void {
  audio.ensure()
  if (phase === 'windup') {
    audio.noise({ dur: .055, buf: audio.brownNoise, type: 'bandpass', curve: [300, 650, 260], q: .5, vol: .045, env: 'swell', rev: .025 })
  } else if (phase === 'active') {
    audio.noise({ dur: .095, type: 'bandpass', curve: [520, 2200, 750, 260], q: .45, vol: .17, env: 'swell', rev: .06 })
    audio.osc({ wave: 'sine', f0: 175, f1: 65, dur: .075, vol: .055, attack: .009, lp: 460, rev: .035 })
  } else {
    audio.noise({ dur: .045, buf: audio.brownNoise, type: 'lowpass', curve: [430, 160], q: .4, vol: .025, env: 'swell', rev: .02 })
  }
}
