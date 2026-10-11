import type { AudioEngine } from '../../../../../game/audio/Sfx'
import { randomAudio } from '../../../../../core/simulation/random'

/** 蓄满的短促吸气与收束锐响，仅在满蓄力边沿播放一次。 */
export function hundredReadySound(audio:AudioEngine):void {
  audio.ensure()
  audio.noise({dur:.15,type:'bandpass',curve:[380,900,2600,4800],q:.6,vol:.19,env:'swell',rev:.035})
  audio.noise({dur:.04,type:'highpass',f0:3300,vol:.12,env:'whip',at:.10,rev:.025})
  audio.osc({wave:'sine',f0:220,f1:680,dur:.13,vol:.07,attack:.012,rev:.035})
}

/** 每轮双刀交错破空，宽带利刃扫频与极短高频刃尖分层，保留清楚的连斩颗粒。 */
export function hundredSlashSound(audio:AudioEngine,index:number):void {
  audio.ensure()
  const tone=.94+randomAudio()*.12
  for(let blade=0;blade<2;blade++){
    const at=blade*.013,pan=((index+blade)%2?1:-1)*.13
    audio.noise({dur:.034,type:'bandpass',curve:[1100*tone,6900*tone,2600*tone,1400],q:.58,
      vol:blade===0 ? .29 : .24,env:'whip',at,pan,rev:.025})
    audio.noise({dur:.016,type:'highpass',f0:4200*tone,q:.45,vol:.075,env:'hit',at:at+.003,pan,rev:.015})
  }
  audio.noise({dur:.043,buf:audio.brownNoise,type:'bandpass',curve:[350,1600,480],q:.45,vol:.11,env:'whip',rev:.025})
}
