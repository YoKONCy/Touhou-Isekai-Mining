import type { AudioEngine } from '../../../../../game/audio/Sfx'

export function doomsdaySwing(audio: AudioEngine, empowered: boolean): void {
    audio.ensure()
    const scale = empowered ? 1.35 : 1
    audio.osc({ wave: 'sine', f0: empowered ? 72 : 92, f1: 34, dur: 0.86, vol: 0.26 * scale, attack: 0.018, lp: 300, rev: 0.45 })
    audio.noise({ dur: empowered ? 0.82 : 0.62, buf: audio.brownNoise, type: 'lowpass', f0: 180, q: 0.65, vol: 0.24 * scale, curve: audio.sweepArch(90, 520, 70, 0.32), env: 'whip', rev: 0.58 })
    audio.noise({ dur: empowered ? 0.68 : 0.52, curve: audio.sweepArch(210, 1900, 260, 0.3), q: 1.5, vol: 0.2 * scale, env: 'whip', rev: 0.62 })
    audio.noise({ dur: 0.5, curve: audio.sweep(4200, 740), q: 2.8, vol: 0.09 * scale, at: 0.045, env: 'swell', rev: 0.74 })
    audio.modal(empowered ? 190 : 230, [1, 1.98, 3.04], [0.16, 0.08, 0.03], [0.72, 0.48, 0.3], { vol: 0.2 * scale, rev: 0.72 })
  }

export function doomsdayBeamHit(audio: AudioEngine): void {
    audio.ensure()
    if (!audio.gate('doomsdayBeamHit', 0.035)) return
    // 取消正弦与模态音高：剑气刺入应是非音高化的“重物贯入”。
    audio.noise({ dur: 0.48, buf: audio.brownNoise, type: 'lowpass', f0: 170, q: 0.55, vol: 0.46, env: 'hit', rev: 0.72 })
    audio.noise({ dur: 0.36, curve: audio.sweepArch(90, 420, 70, 0.25), q: 0.7, vol: 0.34, env: 'hit', rev: 0.68 })
    audio.noise({ dur: 0.42, curve: audio.sweep(1200, 260), q: 0.9, vol: 0.27, at: 0.018, env: 'whip', rev: 0.8 })
    audio.noise({ dur: 0.24, curve: audio.sweep(2200, 900), q: 1.1, vol: 0.07, at: 0.025, env: 'hit', rev: 0.9 })
  }

export function doomsdayBurst(audio: AudioEngine): void {
    audio.ensure()
    audio.osc({ wave: 'sine', f0: 92, f1: 38, dur: 0.7, vol: 0.34, attack: 0.01, lp: 420 })
    audio.noise({ dur: 0.42, curve: audio.sweep(180, 2200), q: 1.2, vol: 0.2, env: 'swell' })
    audio.noise({ dur: 0.32, curve: audio.sweep(6200, 1600), q: 3.5, vol: 0.16, at: 0.025, env: 'whip' })
    audio.modal(310, [1, 2.1, 4.8], [0.24, 0.12, 0.04], [0.09, 0.05, 0.02], { vol: 0.28, rev: 0.42 })
  }

export function doomsdayHit(audio: AudioEngine, index: number): void {
    audio.ensure()
    if (!audio.gate('doomsdayHit', 0.07)) return
    const bass = 1 + Math.min(0.28, index * 0.035)
    // 完全去掉可辨识的音高骨架：主体由棕噪、失真冲击和宽带轰鸣组成。
    audio.noise({ dur: 1.08, buf: audio.brownNoise, type: 'lowpass', f0: 135, q: 0.5, vol: 0.58 * bass, env: 'hit', rev: 0.9 })
    audio.noise({ dur: 0.78, curve: audio.sweepArch(58, 300, 45, 0.16), q: 0.55, vol: 0.42 * bass, env: 'hit', rev: 0.84 })
    audio.noise({ dur: 0.64, curve: audio.sweepArch(110, 620, 80, 0.22), q: 0.75, vol: 0.35, at: 0.01, env: 'whip', rev: 0.82 })
    // 金属只是短暂的颗粒边缘，压在轰鸣里面。
    audio.noise({ dur: 0.42, curve: audio.sweep(2600, 680), q: 0.9, vol: 0.16, at: 0.018, env: 'hit', rev: 0.95 })
    audio.noise({ dur: 0.3, curve: audio.sweep(4800, 1100), q: 1.1, vol: 0.055, at: 0.025, env: 'hit', rev: 1 })
    // 六级上行放到可感知的中低频位置，仍由轰鸣包住，避免变成单独旋律。
    const scale = [0, 2, 4, 5, 7, 9]
    const step = scale[Math.min(5, Math.max(0, Math.floor(index)))]
    const f = 148 * Math.pow(2, step / 12)
    // 后三击逐步压低明亮层：保留上行方向，但不让高音域变成玻璃共鸣。
    const lateDamp = index >= 3 ? 0.72 - Math.min(0.12, (index - 3) * 0.04) : 1
    const presence = (0.14 + Math.min(0.06, index * 0.008)) * lateDamp
    audio.osc({ wave: 'triangle', f0: f, f1: f * 0.42, dur: 0.64, vol: presence * bass, attack: 0.018, lp: index >= 3 ? 920 : 1120, rev: 0.7 })
    // 二次谐波在后段大幅衰减，只留下音阶轮廓，不留下玻璃亮边。
    audio.osc({ wave: 'sine', f0: f * 1.97, f1: f * 0.7, dur: 0.3, vol: 0.022 * lateDamp * bass, attack: 0.009, lp: index >= 3 ? 1500 : 1850, rev: 0.86 })
    audio.noise({ dur: 0.72, curve: audio.sweep(f * 1.8, f * 0.54), q: 0.55, vol: 0.065 * lateDamp * bass, at: 0.018, env: 'whip', rev: 0.88 })
  }

