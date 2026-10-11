import type { AudioEngine } from '../../../../../game/audio/Sfx'
import type { HitMaterial } from '../../../../enemies/types'
import { woodStaffSound, woodStaffHit } from '../staffWood/audio'

/** 花棍的六次短破风由命中窗口逐次触发，不提前排队，打断与暂停不会残留连播。 */
export function scepterSound(audio: AudioEngine, phase: 'windup' | 'active' | 'recover', segment: number): void {
  if (segment < 2) { woodStaffSound(audio, phase, segment); return }
  audio.ensure()
  if (phase === 'windup') {
    audio.noise({ dur: .07, buf: audio.brownNoise, type: 'bandpass', curve: [180, 460, 230], q: .5, vol: .065, env: 'swell', rev: .025 })
    if (segment === 3) audio.noise({ dur: .075, buf: audio.brownNoise, type: 'lowpass',
      curve: [200, 1100, 520, 160], q: .45, vol: .16, env: 'whip', rev: .035 })
  } else if (phase === 'active') {
    audio.noise({ dur: segment === 2 ? .085 : .115, buf: audio.brownNoise, type: 'lowpass',
      curve: segment === 2 ? [250, 1050, 320, 120] : [220, 1350, 500, 100], q: .5,
      vol: segment === 2 ? .2 : .28, env: 'swell', rev: .045 })
    audio.noise({ dur: .045, type: 'bandpass', curve: [650, 1800, 700], q: .5, vol: .075, at: .015, env: 'whip', rev: .025 })
  } else {
    audio.noise({ dur: .05, buf: audio.brownNoise, type: 'lowpass', curve: [400, 160, 90], q: .4, vol: .045, env: 'swell', rev: .025 })
  }
}

export function scepterHit(audio: AudioEngine, material: HitMaterial): void {
  woodStaffHit(audio, material)
  if (!audio.gate('scepter:metal', .045)) return
  audio.modal(245, [1, 2.13, 3.7], [.3, .12, .035], [.06, .035, .02], { vol: .12, rev: .04 })
}

/** 硬木重量、暗金属短震与砂石迸散三层叠合，落地才发声。 */
export function scepterImpactSound(audio: AudioEngine): void {
  audio.ensure()
  audio.noise({ dur: .065, buf: audio.brownNoise, type: 'lowpass', curve: [1100, 470, 120], q: .4, vol: .32, env: 'hit', rev: .09 })
  audio.osc({ wave: 'sine', f0: 125, f1: 42, dur: .15, vol: .24, attack: .003, lp: 350, rev: .1 })
  audio.modal(210, [1, 2.1, 3.6], [.5, .12, .035], [.085, .045, .025], { vol: .2, rev: .08 })
  audio.noise({ dur: .16, type: 'bandpass', curve: [1700, 800, 350], q: .5, vol: .12, at: .025, env: 'hit', rev: .07 })
}
