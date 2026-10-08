import type { AudioEngine } from '../../../../../game/audio/Sfx'
import type { HitMaterial } from '../../../../enemies/types'

/** 借鉴双截棍的宽带压风和重武器分层经验：低中频为主体，短尾、低共振。 */
export function woodStaffSound(audio: AudioEngine, phase: 'windup' | 'active' | 'recover', segment: number): void {
  audio.ensure()
  const tone = (segment === 0 ? .95 : 1.08) * (.98 + Math.random() * .04)
  const pan = segment === 0 ? -.08 : .08
  if (phase === 'windup') {
    // 起手只保留握带摩擦，不用撞击瞬态伪装力量。
    audio.noise({ dur: .075, buf: audio.brownNoise, type: 'bandpass', curve: [180, 430, 260], q: .45, vol: .055, env: 'swell', pan, rev: .025 })
  } else if (phase === 'active') {
    // 厚风、可听见的中频气流与收束风尾三层叠合；峰值落在快速扫出的中段。
    audio.noise({ dur: .145, buf: audio.brownNoise, type: 'lowpass',
      curve: [170, 260, 920 * tone, 560, 240, 110], q: .4, vol: .27, env: 'swell', pan, rev: .055 })
    audio.noise({ dur: .11, type: 'bandpass', curve: [420, 800, 1550 * tone, 840, 320],
      q: .45, vol: .115, at: .012, env: 'swell', pan: -pan * .5, rev: .045 })
    audio.noise({ dur: .055, buf: audio.brownNoise, type: 'lowpass', curve: [700, 340, 130],
      q: .4, vol: .075, at: .055, env: 'whip', pan, rev: .04 })
  } else {
    audio.noise({ dur: .055, buf: audio.brownNoise, type: 'lowpass', curve: [440, 190, 100],
      q: .4, vol: .045, env: 'swell', pan: -pan, rev: .025 })
  }
}

/** 只有实际命中才有闷砸：短宽带冲击、低中频实体重量及极短木杆震动。 */
export function woodStaffHit(audio: AudioEngine, material: HitMaterial): void {
  audio.ensure()
  if (!audio.gate('staff:impact', .045)) return
  const tone = .97 + Math.random() * .06
  audio.noise({ dur: .04, buf: audio.brownNoise, type: 'lowpass', curve: [900, 420, 150],
    q: .4, vol: .22, env: 'hit', rev: .045 })
  audio.noise({ dur: .022, type: 'bandpass', curve: [1300, 650, 280], q: .55,
    vol: .09, env: 'hit', rev: .025 })
  audio.osc({ wave: 'sine', f0: 155 * tone, f1: 62, dur: .085, vol: .17, attack: .006, lp: 380, rev: .055 })
  // 自由木杆的非整数模态快速衰减，避免金属钟鸣和持续音高。
  audio.modal(380 * tone, [1, 2.31, 3.87], [.32, .09, .025], [.043, .027, .018], { vol: .18, rev: .035 })
  // 被击对象的材质只提供短促回馈，取代刃切入软组织的长拉丝音。
  const wet = material === 'venom'
  audio.noise({ dur: wet ? .065 : .05, type: 'bandpass', curve: wet ? [1000, 650, 300] : [650, 420, 210],
    q: .75, vol: wet ? .11 : .085, at: .006, env: 'hit', rev: .04 })
}
