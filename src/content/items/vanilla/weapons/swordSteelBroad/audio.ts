import type { AudioEngine } from '../../../../../game/audio/Sfx'
import type { HitMaterial } from '../../../../enemies/types'

/** 宽刃压风以低频气流为主体，金属只留下短尾；反手稍降音高。 */
export function broadswordSound(audio: AudioEngine, phase: 'windup' | 'active' | 'recover', segment: number, empowered: boolean): void {
  audio.ensure()
  const tone = (segment % 2 === 0 ? 1 : .92) * (.98 + Math.random() * .04), pan = segment % 2 === 0 ? -.12 : .12
  if (phase === 'windup') {
    audio.noise({ dur: .12, buf: audio.brownNoise, type: 'bandpass', curve: [140, 380, 190], q: .5, vol: .05, env: 'swell', pan, rev: .025 })
  } else if (phase === 'active') {
    const weight = empowered ? 1.12 : 1
    audio.noise({ dur: .27, buf: audio.brownNoise, type: 'lowpass', curve: [130, 190, 580 * tone, 950 * tone, 420, 95], q: .5, vol: .34 * weight, env: 'swell', pan, rev: .07 })
    audio.noise({ dur: .18, type: 'bandpass', curve: [350, 750, 1350 * tone, 580, 180], q: .6, vol: .13 * weight, at: .055, env: 'swell', pan: -pan, rev: .05 })
    audio.osc({ wave: 'sine', f0: 118 * tone, f1: 48, dur: .17, vol: .09 * weight, at: .07, attack: .03, lp: 250, rev: .035 })
    audio.osc({ wave: 'triangle', f0: 490 * tone, f1: 160, dur: .09, vol: .025, at: .16, attack: .008, lp: 1100, rev: .06 })
  } else {
    audio.noise({ dur: .08, buf: audio.brownNoise, type: 'lowpass', curve: [430, 210, 95], q: .4, vol: .055, env: 'swell', pan: -pan, rev: .03 })
  }
}
/** 真正砍中才播放刃口冲击与闷重体感，避免空挥也像砸地。 */
export function broadswordHit(audio: AudioEngine, material: HitMaterial): void {
  audio.ensure()
  if (!audio.gate('broadsword:impact', .05)) return
  audio.noise({ dur: .065, buf: audio.brownNoise, type: 'lowpass', curve: [1100, 520, 150], q: .5, vol: .28, env: 'hit', rev: .07 })
  audio.osc({ wave: 'sine', f0: 138, f1: 52, dur: .12, vol: .2, attack: .003, lp: 380, rev: .065 })
  audio.modal(420, [1, 2.07, 3.31], [.3, .085, .025], [.095, .055, .025], { vol: .17, rev: .05 })
  audio.noise({ dur: material === 'venom' ? .07 : .035, type: 'bandpass', curve: [1600, 800, 320], q: .6, vol: material === 'venom' ? .1 : .075, env: 'hit', rev: .025 })
}
