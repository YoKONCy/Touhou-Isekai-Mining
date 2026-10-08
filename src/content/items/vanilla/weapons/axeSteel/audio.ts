import type { AudioEngine } from '../../../../../game/audio/Sfx'
import type { HitMaterial } from '../../../../enemies/types'

/** 斧头的重量来自低频压风和骤然落下的厚闷尾音，金属铃声只留一小截。 */
export function axeSound(audio: AudioEngine, phase: 'windup' | 'active' | 'recover', segment: number, empowered: boolean): void {
  audio.ensure()
  const tone = segment % 2 === 0 ? 1 : .92, pan = segment % 2 === 0 ? -.16 : .16
  if (phase === 'windup') audio.noise({ dur: .17, buf: audio.brownNoise, type: 'bandpass', curve: [95, 330, 160], q: .6, vol: .065, env: 'swell', pan, rev: .03 })
  else if (phase === 'active') {
    const weight = empowered ? 1.22 : 1
    audio.noise({ dur: .29, buf: audio.brownNoise, type: 'lowpass', curve: [95, 155, 650 * tone, 820 * tone, 210, 65], q: .6, vol: .36 * weight, env: 'swell', pan, rev: .08 })
    audio.noise({ dur: .14, type: 'bandpass', curve: [250, 1000 * tone, 470, 130], q: .7, vol: .15 * weight, env: 'whip', at: .065, pan: -pan, rev: .05 })
    audio.osc({ wave: 'sine', f0: 102 * tone, f1: 36, dur: .21, vol: .13 * weight, attack: .025, at: .075, lp: 260, rev: .06 })
    audio.modal(260 * tone, [1, 2.19, 3.45], [.07, .025, .008], [.12, .065, .04], { at: .18, vol: .48, rev: .08 })
  } else audio.noise({ dur: .1, buf: audio.brownNoise, type: 'lowpass', curve: [320, 140, 60], vol: .06, env: 'swell', pan: -pan, rev: .025 })
}
export function axeHit(audio: AudioEngine, material: HitMaterial): void {
  audio.ensure()
  if (!audio.gate('axe:impact', .06)) return
  audio.osc({ wave: 'sine', f0: 123, f1: 38, dur: .16, vol: .23, attack: .004, lp: 360, rev: .08 })
  audio.noise({ dur: .085, buf: audio.brownNoise, type: 'lowpass', curve: [1200, 480, 105], vol: .31, env: 'hit', rev: .075 })
  audio.modal(305, [1, 2.31, 3.75], [.11, .035, .009], [.12, .06, .03], { vol: .4, rev: .07 })
  audio.noise({ dur: material === 'venom' ? .075 : .04, type: 'bandpass', curve: [1650, 700, 280], vol: .075, env: 'hit', rev: .03 })
}
export function axeReady(audio: AudioEngine): void {
  audio.ensure()
  audio.modal(390, [1, 2.04], [.055, .018], [.15, .09], { vol: .45, rev: .05 })
  audio.noise({ dur: .08, buf: audio.brownNoise, type: 'bandpass', curve: [170, 410, 230], vol: .035, env: 'swell' })
}
