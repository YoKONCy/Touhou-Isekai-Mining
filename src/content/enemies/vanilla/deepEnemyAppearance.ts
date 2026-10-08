import type { EnemyAppearanceView } from '../types'

export { drawBatSprite as drawBat } from './batSprites'

/** 高速尾气由几条窄气流与两侧翼尖涡线组成，不生成逐帧粒子对象。 */
export function drawBatMotion(v:EnemyAppearanceView):void{
  if(!v.alive||v.pounceState!=='lunge')return
  const {ctx}=v,back=v.pounceAngle+Math.PI,side=v.pounceAngle+Math.PI/2
  ctx.save();ctx.strokeStyle='#c4c9d28c';ctx.lineCap='round'
  for(let i=0;i<5;i++){
    const offset=(i-2)*8,x=v.x+Math.cos(side)*offset,y=v.y-6+Math.sin(side)*offset,len=33+(2-Math.abs(i-2))*15
    ctx.lineWidth=i===2?2:1;ctx.beginPath();ctx.moveTo(x+Math.cos(back)*12,y+Math.sin(back)*12)
    ctx.quadraticCurveTo(x+Math.cos(back)*len*.6+Math.sin(v.phase*5+i)*2,y+Math.sin(back)*len*.6,x+Math.cos(back)*len,y+Math.sin(back)*len);ctx.stroke()
  }
  ctx.restore()
}

