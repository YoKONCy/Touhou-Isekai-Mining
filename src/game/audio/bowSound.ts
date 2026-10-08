/** 短促的弦绳拍击、木材振动与箭身擦风；不保留乐器式持续音高。 */
export function createBowReleaseSample(sampleRate:number,charged:boolean,rng:()=>number=Math.random):Float32Array {
  const duration=charged?.18:.15,length=Math.ceil(sampleRate*duration),samples=new Float32Array(length)
  const fiberMix=1-Math.exp(-Math.PI*2*2200/sampleRate),woodMix=1-Math.exp(-Math.PI*2*700/sampleRate)
  const airMix=1-Math.exp(-Math.PI*2*3600/sampleRate),bodyMix=1-Math.exp(-Math.PI*2*180/sampleRate)
  let wood=0,air=0,body=0,fiber=0
  for(let i=0;i<length;i++){
    const t=i/sampleRate
    const noise=rng()*2-1
    fiber+=(noise-fiber)*fiberMix;wood+=(noise-wood)*woodMix
    air+=(noise-air)*airMix;body+=(noise-body)*bodyMix
    const attack=Math.min(1,t/.0008),tail=Math.min(1,(duration-t)/.02)
    const stringSnap=(fiber-wood)*Math.exp(-t/(charged?.014:.01))*1.4
    const woodSnap=(wood-body)*Math.exp(-t/.02)*1.1
    const passingAir=(air-fiber)*Math.exp(-Math.max(0,t-.006)/.025)*Math.min(1,t/.006)*.42
    samples[i]=(stringSnap+woodSnap+passingAir)*attack*tail
  }
  return samples
}
