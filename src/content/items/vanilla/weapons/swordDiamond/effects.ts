import type { WeaponTrailView } from '../../../types'
import steelSword from '../swordSteel'
import { drawDiamondSwordBody } from './appearance'

export const DIAMOND_SWORD_TRAIL_DURATION=.22
const clamp=(p:number)=>Math.max(0,Math.min(1,p))

/** 与钢剑的左右横扫、第三段重劈使用相同角度曲线，拖影按历史时刻采样。 */
function bladeAngle(segment:number,p:number,arc:number):number {
  return segment===0?-arc+arc*2*p:segment===1?arc-arc*2*p:-arc*1.2+arc*2.4*p*p
}
export function drawDiamondSwordTrail(g:CanvasRenderingContext2D,v:WeaponTrailView):void {
  const active=Math.max(.001,v.activeDuration??steelSword.melee!.active),arc=steelSword.melee!.arc??1.25
  const p=clamp(v.age/active),direction=v.segment===1?-1:1
  const fade=Math.min(1,v.age/.009)*Math.pow(Math.max(0,1-v.age/DIAMOND_SWORD_TRAIL_DURATION),1.25)
  if(fade<=0)return
  g.save();g.translate(v.x,v.y-5);g.rotate(v.angle)
  for(let i=3;i>=0;i--){
    const sampled=v.age-(i+1)*.014
    if(sampled<0||sampled>active)continue
    g.save();g.rotate(bladeAngle(v.segment,clamp(sampled/active),arc));g.translate(11,0)
    g.globalAlpha*=fade*(.20-i*.04);drawDiamondSwordBody(g);g.restore()
  }
  const tip=bladeAngle(v.segment,p,arc),previous=bladeAngle(v.segment,clamp((v.age-.026)/active),arc)
  if(Math.abs(tip-previous)>.01){
    g.save();g.globalCompositeOperation='lighter';g.globalAlpha*=fade*.38;g.lineCap='round'
    g.strokeStyle='#d1effb';g.lineWidth=1.1;g.beginPath();g.arc(0,0,57,previous,tip,direction<0);g.stroke()
    g.globalAlpha*=.55;g.strokeStyle='#a2d6ef';g.lineWidth=.65;g.beginPath();g.arc(0,0,48,previous,tip,direction<0);g.stroke();g.restore()
  }
  for(let i=0;i<3;i++){
    const phase=v.age-i*.025;if(phase<0||phase>.13)continue
    const angle=bladeAngle(v.segment,clamp(i*.025/active),arc),r=54+phase*22
    const x=Math.cos(angle)*r,y=Math.sin(angle)*r,shine=Math.sin(phase/.13*Math.PI)
    g.save();g.globalAlpha*=fade*shine*.6;g.fillStyle='#e5f9ff'
    g.beginPath();g.moveTo(x,y-1.8);g.lineTo(x+.7,y);g.lineTo(x,y+1.8);g.lineTo(x-.7,y);g.closePath();g.fill();g.restore()
  }
  g.restore()
}
