import type { EnemyAppearanceView, EnemyBodyPath } from '../types'

/** 异化胶质兽：双隆起背脊、宽肩毒囊与四枚贴地伪足，使用独立轮廓。 */
export const tricolorBodyPath:EnemyBodyPath=(g,x,y,rx,ry)=>{
  g.beginPath();g.moveTo(x-rx*1.17,y+ry*.28)
  g.bezierCurveTo(x-rx*1.39,y-ry*.07,x-rx*1.08,y-ry*.69,x-rx*.68,y-ry*.62)
  g.bezierCurveTo(x-rx*.83,y-ry*1.3,x-rx*.38,y-ry*1.57,x-rx*.09,y-ry*1.15)
  g.bezierCurveTo(x+rx*.26,y-ry*1.52,x+rx*.81,y-ry*1.16,x+rx*.71,y-ry*.65)
  g.bezierCurveTo(x+rx*1.18,y-ry*.74,x+rx*1.48,y-ry*.08,x+rx*1.19,y+ry*.35)
  g.bezierCurveTo(x+rx*1.36,y+ry*.67,x+rx*.94,y+ry*.96,x+rx*.64,y+ry*.66)
  g.bezierCurveTo(x+rx*.67,y+ry*1.13,x+rx*.19,y+ry*1.22,x+rx*.02,y+ry*.78)
  g.bezierCurveTo(x-rx*.12,y+ry*1.19,x-rx*.64,y+ry*1.08,x-rx*.61,y+ry*.68)
  g.bezierCurveTo(x-rx*.95,y+ry*1.01,x-rx*1.39,y+ry*.64,x-rx*1.17,y+ry*.28);g.closePath()
}

/** 三种组织彼此嵌合：蓝胶质承重，红肌膜牵引，绿色毒囊随吐弹鼓胀。 */
export function drawTricolor(v:EnemyAppearanceView):void{
  const {ctx:g,x,y,rx,ry,phase,flash,pounceProgress:charge,windupProgress:spit}=v
  const path=()=>tricolorBodyPath(g,x,y,rx,ry)
  g.save();g.lineJoin='round';g.lineCap='round';path();g.lineWidth=3;g.strokeStyle='#222631';g.stroke()
  if(flash>0){g.fillStyle='#f3ece3';g.fill();g.restore();return}
  const skin=g.createLinearGradient(x-rx*.8,y-ry,x+rx*.6,y+ry)
  skin.addColorStop(0,'#a1b3b0');skin.addColorStop(.35,'#7495a1');skin.addColorStop(1,'#435f71')
  g.fillStyle=skin;g.fill()
  g.save();path();g.clip()
  // 背光与贴地厚胶层塑造重量，伪足仍留有各自的受光切面。
  g.fillStyle='#1f344647';g.beginPath();g.ellipse(x+rx*.15,y+ry*.61,rx*1.28,ry*.48,0,0,Math.PI*2);g.fill()
  for(const offset of [-.91,-.32,.31,.94]){
    g.fillStyle='#a8c0be47';g.beginPath();g.ellipse(x+rx*offset,y+ry*.74,rx*.2,ry*.1,offset*.15,0,Math.PI*2);g.fill()
  }
  // 红色肌膜是一张围绕胸腹的连续软鞍，蓄力时向内收缩。
  const muscle=g.createLinearGradient(x-rx,y,x+rx,y+ry*.7)
  muscle.addColorStop(0,'#a76372');muscle.addColorStop(.45,'#765267');muscle.addColorStop(1,'#aa7276')
  g.beginPath();g.moveTo(x-rx*.96,y+ry*.05)
  g.bezierCurveTo(x-rx*.65,y-ry*.38,x-rx*.4,y+ry*(.1-charge*.16),x-rx*.03,y+ry*.17)
  g.bezierCurveTo(x+rx*.35,y+ry*.22,x+rx*.68,y-ry*.45,x+rx*.99,y-ry*.02)
  g.bezierCurveTo(x+rx*.72,y+ry*.26,x+rx*.68,y+ry*.69,x+rx*.18,y+ry*.63)
  g.bezierCurveTo(x-rx*.35,y+ry*.82,x-rx*.71,y+ry*.52,x-rx*.96,y+ry*.05);g.closePath()
  g.fillStyle=muscle;g.fill();g.strokeStyle='#633f546b';g.lineWidth=.8;g.stroke()
  for(let i=0;i<7;i++){
    const dx=(i-3)*rx*.2,bend=Math.sin(phase*.8+i)*.7
    g.strokeStyle=i%2?'#dbb0ac44':'#462d4644';g.lineWidth=.7
    g.beginPath();g.moveTo(x+dx,y+ry*.28);g.quadraticCurveTo(x+dx*.92+charge*2,y+ry*.5+bend,x+dx*.85,y+ry*.62);g.stroke()
  }
  // 两侧毒腺和背脊以凝胶膜相连，不画普通绿史莱姆的触角。
  for(const side of [-1,1]){
    const cx=x+side*rx*.83,cy=y-ry*(side<0?.37:.24),pulse=1+spit*.17+Math.sin(phase*.8+side)*.025
    const gland=g.createLinearGradient(cx-6,cy-7,cx+5,cy+8)
    gland.addColorStop(0,'#a6b77b');gland.addColorStop(.43,'#6e8a5c');gland.addColorStop(1,'#3e5d52')
    g.fillStyle=gland;g.beginPath();g.ellipse(cx,cy,rx*.27*pulse,ry*.41*pulse,side*-.27,0,Math.PI*2);g.fill()
    g.strokeStyle='#3e575688';g.lineWidth=.8;g.stroke()
    g.strokeStyle='#d0d8a368';g.beginPath();g.ellipse(cx-side*rx*.055,cy-ry*.065,rx*.16,ry*.27,side*-.27,Math.PI*.9,Math.PI*1.7);g.stroke()
    for(let i=0;i<3;i++){
      const px=cx+Math.sin(i*2.1+side)*rx*.11,py=cy+(i-1)*ry*.17
      g.fillStyle='#2b4c4480';g.beginPath();g.ellipse(px,py,1.1+spit*.5,1.7,side*.2,0,Math.PI*2);g.fill()
    }
    g.strokeStyle='#d0d5ba2d';g.lineWidth=.8;g.beginPath();g.moveTo(cx-side*rx*.15,cy);g.quadraticCurveTo(x+side*rx*.42,y-ry*.2,x+side*rx*.2,y+ry*.15);g.stroke()
  }
  // 双隆起背脊有乳浊浅层和红色褶皱，替代普通史莱姆的圆顶头。
  g.fillStyle='#b8c9c453';g.beginPath();g.ellipse(x-rx*.29,y-ry*.97,rx*.23,ry*.22,-.45,0,Math.PI*2);g.fill()
  g.fillStyle='#738b8947';g.beginPath();g.ellipse(x+rx*.27,y-ry*.95,rx*.27,ry*.23,.3,0,Math.PI*2);g.fill()
  g.strokeStyle=`rgba(186,132,139,${.45+charge*.3})`;g.lineWidth=1.7
  g.beginPath();g.moveTo(x-rx*.37,y-ry*1.12);g.quadraticCurveTo(x-rx*.12,y-ry*.8,x+rx*.11,y-ry*1.01);g.quadraticCurveTo(x+rx*.32,y-ry*.92,x+rx*.48,y-ry*1.1);g.stroke()
  // 胸腹里的小白晶体只留微弱折光，颜色来自周围组织透映。
  g.fillStyle='#ece9db80';g.strokeStyle='#e0e2cf77';g.lineWidth=.6
  g.beginPath();g.moveTo(x,y+1);g.lineTo(x+3.6,y+5);g.lineTo(x+1,y+10);g.lineTo(x-3,y+7);g.lineTo(x-3.2,y+3);g.closePath();g.fill();g.stroke()
  g.strokeStyle='#f4f1de66';g.beginPath();g.moveTo(x,y+2);g.lineTo(x+.5,y+6);g.lineTo(x+1,y+9);g.stroke()
  // 少量曲面反光遵循体积，不用整圈亮边把组织分割成贴纸。
  g.strokeStyle='#d8e2d560';g.lineWidth=1.1;g.beginPath();g.moveTo(x-rx*.55,y-ry*.58);g.quadraticCurveTo(x-rx*.39,y-ry*.72,x-rx*.15,y-ry*.66);g.stroke()
  g.restore();path();g.strokeStyle='#3a5059';g.lineWidth=1.4;g.stroke()
  if(v.alive){
    // 厚眼褶、窄瞳和下垂口缝形成更凝重的精英面相。
    for(const side of [-1,1]){
      const ex=x+side*rx*.23,ey=y-ry*.34
      g.fillStyle='#1c303b';g.beginPath();g.ellipse(ex,ey,3.8,2.7,side*-.14,0,Math.PI*2);g.fill()
      g.fillStyle='#c9d2a4';g.beginPath();g.ellipse(ex+side*.4,ey+.3,1.4,1.6,0,0,Math.PI*2);g.fill()
      g.fillStyle='#344854';g.fillRect(ex+side*.4-.35,ey-.8,.7,2.1)
      g.strokeStyle='#7f9ba3';g.lineWidth=1;g.beginPath();g.moveTo(ex-3.8,ey-1.4);g.quadraticCurveTo(ex,ey-3,ex+3.5,ey-1.2);g.stroke()
    }
    g.strokeStyle='#28424b';g.lineWidth=1.8;g.beginPath();g.moveTo(x-rx*.17,y-ry*.08);g.quadraticCurveTo(x,y-ry*.16,x+rx*.2,y-ry*.08);g.stroke()
  }
  g.restore()
}
