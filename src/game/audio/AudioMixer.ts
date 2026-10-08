/** 混音基础设施独立于声音配方，音乐绕过动态压缩，保持原有听感。 */
export interface AudioSettings { master:number; sfx:number; music:number }
const BASE={master:.5,sfx:1.35,env:.82,music:1}
export class AudioMixer {
  readonly master:GainNode
  readonly effects:GainNode
  readonly ambience:GainNode
  readonly music:GainNode
  readonly compressor:DynamicsCompressorNode
  readonly reverb:ConvolverNode
  constructor(readonly context:AudioContext,impulse:AudioBuffer,settings:AudioSettings,muted:boolean){
    const c=context
    this.master=c.createGain();this.effects=c.createGain();this.ambience=c.createGain();this.music=c.createGain()
    this.compressor=c.createDynamicsCompressor();this.reverb=c.createConvolver()
    this.compressor.threshold.value=-14;this.compressor.knee.value=22;this.compressor.ratio.value=5
    this.compressor.attack.value=.003;this.compressor.release.value=.18
    this.master.gain.value=muted?0:BASE.master*settings.master
    this.effects.gain.value=BASE.sfx*settings.sfx;this.ambience.gain.value=BASE.env*settings.sfx;this.music.gain.value=BASE.music*settings.music
    this.effects.connect(this.compressor);this.ambience.connect(this.compressor)
    this.compressor.connect(this.master);this.music.connect(this.master);this.master.connect(c.destination)
    this.reverb.buffer=impulse;this.reverb.connect(this.compressor)
  }
  apply(settings:AudioSettings,muted:boolean):void {
    const t=this.context.currentTime
    this.master.gain.setTargetAtTime(muted?0:BASE.master*settings.master,t,.02)
    this.effects.gain.setTargetAtTime(BASE.sfx*settings.sfx,t,.02)
    this.ambience.gain.setTargetAtTime(BASE.env*settings.sfx,t,.02)
    this.music.gain.setTargetAtTime(BASE.music*settings.music,t,.02)
  }
  dispose():void {for(const node of [this.master,this.effects,this.ambience,this.music,this.compressor,this.reverb])node.disconnect()}
}
