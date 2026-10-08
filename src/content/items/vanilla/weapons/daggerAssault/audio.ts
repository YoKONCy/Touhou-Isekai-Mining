import type { AudioEngine } from '../../../../../game/audio/Sfx'
/** 短刃破风干净利落，三段略变音高，金属尾音保持短促。 */
export function daggerSound(audio:AudioEngine,phase:'windup'|'active'|'recover',segment:number):void{
  audio.ensure()
  if(phase==='windup')audio.noise({dur:.025,type:'bandpass',curve:[450,900,300],q:.6,vol:.025,env:'swell'})
  else if(phase==='active'){
    const high=[1600,2200,1850][segment%3]!
    audio.noise({dur:.085,type:'bandpass',curve:[650,high,600,230],q:.5,vol:.1,env:'swell',rev:.035})
    audio.osc({wave:'triangle',f0:high*.45,f1:210,dur:.038,vol:.018,at:.012,attack:.003,lp:1800,rev:.02})
  }
}
