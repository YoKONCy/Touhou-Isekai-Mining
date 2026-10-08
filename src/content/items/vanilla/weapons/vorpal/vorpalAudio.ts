import type { AudioEngine } from '../../../../../game/audio/Sfx'

export function vorpalSwing(audio: AudioEngine, segment: number): void {
    audio.ensure()
    const heavy = segment === 2
    const pan = segment === 0 ? -.16 : segment === 1 ? .16 : 0
    audio.osc({ wave: 'sine', f0: heavy ? 68 : segment === 1 ? 115 : 92, f1: heavy ? 27 : 43, dur: heavy ? .48 : .32, vol: heavy ? .28 : .18, attack: .008, lp: 240, rev: .32 })
    audio.noise({ dur: heavy ? .4 : .28, buf: audio.brownNoise, type: 'lowpass', curve: audio.sweepArch(90, heavy ? 540 : 380, 55, .15), q: .6, vol: heavy ? .26 : .19, env: 'whip', pan, rev: .36 })
    audio.noise({ dur: .23, curve: segment === 1 ? audio.sweep(220, 780) : audio.sweep(900, 150), q: .65, vol: .07, env: 'whip', pan: -pan, rev: .28 })
    audio.noise({ dur: heavy ? .19 : .13, curve: audio.sweepArch(240, heavy ? 1350 : 1050, 120, .12), q: .75, vol: heavy ? .13 : .095, env: 'whip', rev: .24 })
    audio.osc({ wave: 'triangle', f0: heavy ? 90 : 110, f1: 38, dur: .23, vol: .055, attack: .012, lp: 290, rev: .2 })
    audio.modal(heavy ? 105 : segment === 1 ? 135 : 120, [1, 1.47, 2.83], [.1, .045, .018], [.32, .2, .12], { vol: .085, rev: .4 })
    if (heavy) audio.noise({ dur: .09, type: 'bandpass', f0: 780, q: .7, vol: .12, at: .015, env: 'hit', rev: .3 })

    // 呼气成为主体：先从胸腔压出，再张口持续排气，后半程逐渐收窄、滤暗。
    const breath = heavy ? 1.12 : .9
    audio.noise({ dur: heavy ? 1.4 : 1.06, buf: audio.brownNoise, type: 'lowpass', curve: audio.sweepArch(120, heavy ? 460 : 380, 85, .17), q: .55, vol: .25 * breath, at: .025, env: 'whip', pan, rev: .58 })
    // 180～700Hz 的喉口粗气在普通扬声器上也能听见，不只堆听不见的超低频。
    audio.noise({ dur: heavy ? 1.18 : .92, type: 'bandpass', curve: [180, 270, 390, 310, 240, 160, 110], q: .85, vol: .19 * breath, at: .045, env: 'whip', pan: -pan * .5, rev: .62 })
    audio.noise({ dur: heavy ? 1.05 : .8, type: 'lowpass', curve: [680, 760, 610, 480, 330, 190], q: .5, vol: .105 * breath, at: .13, env: 'swell', pan: pan * .5, rev: .7 })
    // 第二口压气与第一口交叠，形成不均匀排气，而不是一次敲击后的静态风尾。
    audio.noise({ dur: heavy ? .9 : .68, buf: audio.brownNoise, type: 'lowpass', curve: audio.sweepArch(160, 330, 75, .22), q: .6, vol: .12 * breath, at: .33, env: 'swell', pan: -pan, rev: .75 })

    // 声带只作气息里的死灵底声：低口型、弱音节，避免唱腔或嘟囔抢走吐气感。
    const throat = segment === 1 ? [155, 210, 170, 190, 135, 100] : [190, 155, 180, 140, 160, 95]
    const mouth = segment === 1 ? [430, 540, 390, 460, 330, 250] : [480, 380, 450, 330, 370, 230]
    const pitch = heavy ? 36 : segment === 1 ? 44 : 40
    audio.voice({ pitch, formants: [throat, mouth], dur: heavy ? 1.35 : 1.02, vol: heavy ? .22 : .17, at: .035, pan, rev: .6 })
    audio.voice({ pitch: pitch * .94, formants: [throat.map(f => f * .86), mouth.map(f => f * .85)], dur: heavy ? .98 : .76, vol: .045, at: .35, pan: -pan, rev: .82 })

    // 有界、滤暗的远处回声；连挥时压低尾声增益，保留刀锋瞬态的清晰度。
    for (let i = 0; i < 3; i++) {
      const at = .21 + i * .19
      const gain = .034 * breath * Math.pow(.52, i)
      audio.noise({ dur: .62 + i * .12, buf: audio.brownNoise, type: 'lowpass', curve: audio.sweep(420 - i * 65, 75), q: .6, vol: gain, at, env: 'whip', pan: i % 2 ? -.32 : .32, rev: .92 })
      audio.noise({ dur: .5 + i * .1, curve: audio.sweep(820 - i * 120, 180), q: .8, vol: gain * .55, at: at + .045, env: 'swell', pan: i % 2 ? .24 : -.24, rev: .9 })
    }
  }

