import type { AudioEngine } from '../../../../../game/audio/Sfx'

export function whipUnfurl(audio: AudioEngine): void {
    audio.ensure()
    audio.noise({ dur: .25, buf: audio.brownNoise, type: 'lowpass', curve: audio.sweep(180, 820), q: .65, vol: .13, env: 'swell', rev: .3 })
    audio.noise({ dur: .23, curve: audio.sweep(350, 2100), q: .8, vol: .09, env: 'swell', pan: -.12, rev: .35 })
  }

export function whipCrack(audio: AudioEngine): void {
    audio.ensure()
    // 闷响有低频体积与中低频粗粝感，不让高频瞬态独占声音。
    audio.osc({ wave: 'sine', f0: 155, f1: 42, dur: .3, vol: .19, attack: .009, lp: 340, rev: .36 })
    audio.osc({ wave: 'triangle', f0: 255, f1: 88, dur: .22, vol: .075, attack: .006, lp: 650, rev: .32 })
    audio.noise({ dur: .34, buf: audio.brownNoise, type: 'lowpass', curve: audio.sweepArch(190, 960, 120, .18), q: .65, vol: .23, env: 'whip', rev: .48 })
    audio.noise({ dur: .27, curve: audio.sweepArch(520, 2200, 230, .12), q: .8, vol: .14, env: 'whip', pan: .08, rev: .42 })
    audio.noise({ dur: .07, type: 'highpass', f0: 2400, q: .5, vol: .055, env: 'hit', rev: .32 })
    // 两次滤暗、减弱的声部回声；不创建无限反馈回路。
    for (let i = 0; i < 2; i++) {
      const at = .072 + i * .065, gain = i === 0 ? .065 : .032
      audio.noise({ dur: .19, curve: audio.sweep(1100 - i * 220, 180), q: .55, vol: gain, at, pan: i ? .18 : -.16, env: 'whip', rev: .48 })
      audio.osc({ wave: 'sine', f0: 112, f1: 48, dur: .2, vol: gain * .65, at, attack: .014, lp: 230, rev: .34 })
    }
  }

