import type { AudioEngine } from '../../../game/audio/Sfx'

export function grimmSound(audio: AudioEngine, kind: 'charge'|'vanish'|'slash'|'burst'|'impact'|'laser'|'armor'|'death'): void {
    audio.ensure()
    if (!audio.gate('grimm:'+kind, kind==='armor'?.07:kind==='impact'?.055:.035)) return
    const charge=kind==='charge',small=kind==='armor',laser=kind==='laser'
    const dur=kind==='death'?1.5:charge?.5:small?.16:laser?.32:.65
    const volume=small?.15:laser?.2:charge?.18:.32
    audio.noise({dur,buf:audio.brownNoise,type:'lowpass',curve:audio.sweepArch(65,charge?280:180,42,.2),q:.55,vol:volume,env:charge?'swell':'hit',rev:.8})
    audio.noise({dur:dur*.75,curve:audio.sweepArch(180,kind==='slash'?1900:laser?2900:850,130,.25),q:.65,vol:volume*.8,env:charge?'swell':'whip',rev:.72})
    audio.noise({dur:small?.07:.18,curve:audio.sweep(2300,560),q:.8,vol:volume*.25,at:.015,rev:.65})
  }

export function grimmSpellVolley(audio: AudioEngine, act: number, seed: boolean, petals: boolean): void {
    audio.ensure()
    if (!audio.gate('grimmSpellVolley', .24)) return
    const weight = 1 + Math.min(2, act) * .1
    audio.noise({dur:.42,buf:audio.brownNoise,type:'lowpass',curve:audio.sweepArch(85,260,65,.18),q:.5,vol:.14*weight,env:'whip',rev:.38})
    audio.noise({dur:.34,curve:audio.sweepArch(240,1050+act*130,180,.2),q:.55,vol:.11*weight,env:'whip',rev:.46,pan:-.22})
    // 对侧弹幕晚出0.13秒：只补轻薄气流，不再叠一遍低频主体。
    audio.noise({dur:.28,curve:audio.sweep(820,190),q:.5,vol:.075,at:.13,pan:.22,env:'whip',rev:.42})
    if(seed)audio.noise({dur:.3,buf:audio.brownNoise,curve:audio.sweep(620,125),q:.65,vol:.09,env:'hit',rev:.5})
    if(petals)audio.noise({dur:.38,curve:audio.sweepArch(360,1400,240,.25),q:.5,vol:.065,env:'whip',rev:.48})
  }

export function grimmSpellSplit(audio: AudioEngine, pan: number): void {
    audio.ensure()
    if (!audio.gate('grimmSpellSplit', .1)) return
    audio.noise({dur:.32,buf:audio.brownNoise,type:'lowpass',curve:audio.sweep(280,65),q:.5,vol:.19,pan,env:'hit',rev:.42})
    audio.noise({dur:.22,curve:audio.sweep(1500,340),q:.65,vol:.12,pan,env:'hit',rev:.48})
    audio.noise({dur:.3,curve:audio.sweep(680,160),q:.5,vol:.08,pan,at:.02,env:'whip',rev:.5})
  }

