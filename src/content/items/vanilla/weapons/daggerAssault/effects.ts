import type { WeaponTrailView } from '../../../types'
import { DAGGER_ARC, DAGGER_REACH } from './stats'
import { daggerDirection, daggerSweep } from './motion'
import { drawAssaultDagger } from './appearance'

export const DAGGER_TRAIL_DURATION=.18
/** 三段均留细薄弧形剑影，前送段加短风痕，上挑段更贴近竖向走势。 */
export function drawDaggerTrail(g:CanvasRenderingContext2D,view:WeaponTrailView):void{
  const p=Math.max(0,Math.min(1,view.age/Math.max(.001,view.activeDuration??.1)))
  const fade=Math.min(1,view.age/.012)*Math.pow(Math.max(0,1-view.age/DAGGER_TRAIL_DURATION),1.2)
  if(fade<=0)return
  const direction=daggerDirection(view.segment),tip=direction*(-DAGGER_ARC+2*DAGGER_ARC*daggerSweep(p))
  const span=Math.min(DAGGER_ARC*2*daggerSweep(p),1.05),begin=tip-direction*span
  g.save();g.translate(view.x,view.y-4);g.rotate(view.angle)
  for(let layer=0;layer<2;layer++){
    const radius=DAGGER_REACH-2-layer*9,width=layer===0?5:2.5
    g.beginPath();g.arc(0,0,radius,begin,tip,direction<0);g.arc(0,0,radius-width,tip,begin,direction>0);g.closePath()
    g.globalAlpha=fade*(layer===0?.2:.09);g.fillStyle=layer===0?'#b5ccca':'#819d9d';g.fill()
    g.beginPath();g.arc(0,0,radius,begin,tip,direction<0);g.globalAlpha=fade*(layer===0?.72:.25);g.strokeStyle='#e6e8d6';g.lineWidth=layer===0?.85:.5;g.stroke()
  }
  if(view.segment%3===1){
    const length=28+29*Math.sin(Math.min(1,p/.9)*Math.PI*.5)
    g.globalAlpha=fade*.3;g.strokeStyle='#c9d9d0';g.lineWidth=1.2;g.beginPath();g.moveTo(22,3);g.quadraticCurveTo(length*.7,5,length,-1);g.stroke()
  }
  for(let i=0;i<3;i++){
    const lag=.055+i*.065,previous=Math.max(0,p-lag)
    if(p<=lag)continue
    const angle=direction*(-DAGGER_ARC+2*DAGGER_ARC*daggerSweep(previous))
    g.save();g.rotate(angle);g.translate(29,-2);g.rotate(Math.PI)
    g.globalAlpha=fade*(.19-i*.045);drawAssaultDagger(g);g.restore()
  }
  g.restore()
}
