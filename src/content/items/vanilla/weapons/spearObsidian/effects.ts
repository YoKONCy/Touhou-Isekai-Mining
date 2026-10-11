import type { WeaponTrailView } from '../../../types'
import { staffSweep } from '../staffWood/motion'
import { drawObsidianHead } from './appearance'
import { SPEAR_LENGTH_SCALE } from '../spearStone/appearance'
import ironSpear from '../spearIron'

export const OBSIDIAN_TRAIL_DURATION=.20
const clamp=(p:number)=>Math.max(0,Math.min(1,p))

/** 横扫留薄弧形气锋，突刺留纵向风痕；两段均用同一黑曜石矛头残影。 */
export function drawObsidianTrail(g:CanvasRenderingContext2D,v:WeaponTrailView,reinforced:boolean):void {
  const reach=ironSpear.melee!.reach,p=clamp(v.age/Math.max(.001,v.activeDuration??ironSpear.melee!.active))
  const fade=Math.min(1,v.age/.01)*Math.pow(Math.max(0,1-v.age/OBSIDIAN_TRAIL_DURATION),1.2)
  if(fade<=0)return
  g.save();g.translate(v.x,v.y-5);g.rotate(v.angle);g.lineCap='round'
  if(v.segment%2===1){
    const tip=reach*(.54+.46*(1-(1-p)**3))
    for(let i=0;i<3;i++){
      g.globalAlpha=fade*(.45-i*.1);g.strokeStyle=reinforced?'#d4b4e4':'#ab9dbb';g.lineWidth=i===0?1.2:.65
      const y=i===0?0:i===1?-4:4;g.beginPath();g.moveTo(18+i*9,y);g.lineTo(tip-i*5,y);g.stroke()
    }
    for(let i=0;i<2;i++){g.save();g.translate(tip-86*SPEAR_LENGTH_SCALE-i*8,0);g.globalAlpha=fade*(.27-i*.1);drawObsidianHead(g,reinforced);g.restore()}
  }else{
    const arc=Math.PI/3,sweep=staffSweep(0,p),tip=-arc+arc*2*sweep,span=Math.min(arc*2*sweep,.80)
    if(span>0){
      g.beginPath();g.arc(0,0,reach-2,tip-span,tip);g.globalAlpha=fade*.2;g.strokeStyle=reinforced?'#9c68b4':'#675273';g.lineWidth=5;g.stroke()
      g.globalAlpha=fade*.6;g.strokeStyle=reinforced?'#ddc6ee':'#c0b3cb';g.lineWidth=.8;g.stroke()
    }
    for(let i=0;i<3;i++){
      const earlier=p-.045-i*.08;if(earlier<=0)continue
      g.save();g.rotate(-arc+arc*2*staffSweep(0,earlier));g.translate(reach-86*SPEAR_LENGTH_SCALE,0)
      g.globalAlpha=fade*(.29-i*.075);drawObsidianHead(g,reinforced);g.restore()
    }
  }
  g.restore()
}
