import type { EnemyAppearanceView } from '../types'

/** 基础史莱姆共用赛璐璐胶体材质，角、毒滴、表情与运动仍由资源特征和实际状态控制。 */
export function drawSlime(v: EnemyAppearanceView): void {
  const {ctx:g,x,y,rx,ry,palette:pal,visual,alive,windupProgress:wk,pounceProgress:pk}=v
  const venom=visual.antennae,pouncer=visual.horns,lit=v.flash>0
  g.save();g.lineCap='round';g.lineJoin='round'
  if(alive&&pouncer)for(const side of [-1,1]){
    g.beginPath();g.moveTo(x+side*rx*.12,y-ry*.75);g.lineTo(x+side*rx*.68,y-ry*1.43);g.lineTo(x+side*rx*.47,y-ry*.5);g.closePath()
    g.fillStyle=pk>.5?pal.death:pal.edge;g.strokeStyle='#342737';g.lineWidth=1.1;g.fill();g.stroke()
    g.strokeStyle=pk>.3?'#ffdddc':'#eeacb575';g.lineWidth=.65;g.beginPath();g.moveTo(x+side*rx*.2,y-ry*.8);g.lineTo(x+side*rx*.63,y-ry*1.32);g.stroke()
  }
  const body=()=>visual.bodyPath!(g,x,y,rx,ry)
  body();g.fillStyle=lit?'#f4f1e8':pal.body;g.strokeStyle='#2d293c';g.lineWidth=1.2;g.fill();g.stroke()
  if(!lit){
    g.save();body();g.clip()
    // 胶体的大阴影面顺着体积变化，避免平整的横向暗条或密集气泡。
    g.fillStyle=pal.edge;g.globalAlpha*=.43
    g.beginPath();g.moveTo(x-rx,y+ry*.2);g.quadraticCurveTo(x-rx*.15,y+ry*.65,x+rx*.28,y-ry*.55)
    g.quadraticCurveTo(x+rx*.9,y-ry*.15,x+rx,y+ry*.12);g.lineTo(x+rx,y+ry*1.1);g.lineTo(x-rx,y+ry*1.1);g.closePath();g.fill()
    g.restore();g.save();body();g.clip();g.fillStyle='#f3f2dd';g.globalAlpha*=.19
    g.beginPath();g.moveTo(x-rx*.88,y-ry*.18);g.quadraticCurveTo(x-rx*.58,y-ry*.9,x+rx*.24,y-ry*.75)
    g.quadraticCurveTo(x-rx*.1,y-ry*.47,x-rx*.7,y-ry*.17);g.closePath();g.fill();g.restore()
    if(venom){
      g.fillStyle='#47664070'
      for(const [dx,dy]of [[-.48,.1],[.35,.18],[.12,-.33]]){g.beginPath();g.ellipse(x+rx*dx,y+ry*dy,2.1+wk,1.7+wk,0,0,Math.PI*2);g.fill()}
    }
    g.fillStyle='#fff4dcaa';g.beginPath();g.ellipse(x-rx*.45,y-ry*.48,2.4,1.1,-.45,0,Math.PI*2);g.fill()
    g.fillStyle='#f4ecc26b';g.fillRect(x+rx*.48,y+ry*.22,1,1)
  }
  if(!alive){g.restore();return}
  if(venom)for(const side of [-1,1]){
    const lag=v.antennaLag,tipX=x+side*(8+lag*.25),tipY=y-v.r-10+lag*1.1
    g.strokeStyle='#405044';g.lineWidth=1.2;g.beginPath();g.moveTo(x+side*5,y-v.r+3);g.quadraticCurveTo(x+side*(9+lag*.2),y-v.r-6+lag*.9,tipX,tipY);g.stroke()
    g.beginPath();g.moveTo(tipX,tipY-3-wk*2);g.quadraticCurveTo(tipX+3+wk,tipY+2,tipX,tipY+3);g.quadraticCurveTo(tipX-3-wk,tipY+2,tipX,tipY-3-wk*2)
    g.fillStyle=wk>.4?'#d8edb4':'#a1c775';g.strokeStyle='#405044';g.lineWidth=.7;g.fill();g.stroke()
    g.fillStyle='#f2efcc';g.fillRect(tipX-1,tipY,1,1.5)
  }
  const look=v.engaged?Math.atan2(v.vy,v.vx):Math.PI/2,ex=Math.cos(look)*1.7,ey=Math.sin(look)*1.2-.8
  for(const side of [-1,1]){
    const cx=x+side*4.7+ex,cy=y-.8+ey
    g.fillStyle='#283047';g.beginPath();g.ellipse(cx,cy,2.25,2.8,0,0,Math.PI*2);g.fill()
    g.fillStyle=venom?'#9db379':pouncer?'#d1939c':'#88aac3';g.beginPath();g.ellipse(cx,cy+.8,1.5,1.4,0,0,Math.PI*2);g.fill()
    g.fillStyle='#fff1d7';g.fillRect(cx-.9,cy-1.5,1.1,1.1)
    if(v.engaged){g.strokeStyle='#303046';g.lineWidth=1.1;g.beginPath();g.moveTo(cx-side*2.2,cy-3);g.lineTo(cx+side*1.5,cy-4);g.stroke()}
  }
  g.strokeStyle='#453248';g.lineWidth=.7;g.beginPath()
  if(venom&&wk>0){g.ellipse(x+ex*.3,y+4,1.2+wk*1.2,1+wk*1.4,0,0,Math.PI*2);g.fillStyle='#394b3e';g.fill()}
  else{g.moveTo(x-1.4,y+3.8);g.quadraticCurveTo(x,y+5,x+1.4,y+3.8)}
  g.stroke();g.restore()
}
