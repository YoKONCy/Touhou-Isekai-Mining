const TAU = Math.PI * 2
export interface BossTrail { x:number; y:number; age:number; lean:number; time:number }

/** 两侧手掌吸入亮点，光束与收缩符环和抬手同步。 */
export function drawKedamaCharge(g:CanvasRenderingContext2D,x:number,y:number,power:number,time:number):void {
  if (power<=0) return
  g.save(); g.translate(x,y)
  for (const sign of [-1,1]) {
    const arm=(1-power)*Math.PI/2-power*.12
    const hx=sign*(5.15+Math.cos(arm)*8.3)*1.3,hy=(-4.8+Math.sin(arm)*8.3)*1.3
    const glow=g.createRadialGradient(hx,hy,0,hx,hy,12+power*16)
    glow.addColorStop(0,`rgba(255,239,214,${power*.95})`);glow.addColorStop(.35,`rgba(206,153,233,${power*.55})`);glow.addColorStop(1,'#be92e500')
    g.fillStyle=glow;g.fillRect(hx-30,hy-30,60,60)
    g.fillStyle='#fff1d9';g.beginPath();g.arc(hx,hy,2+power*3,0,TAU);g.fill()
    g.strokeStyle='#d799f5';g.lineWidth=1.4;g.beginPath();g.arc(hx,hy,7+power*6,0,TAU);g.stroke()
    g.strokeStyle=`rgba(230,190,247,${power*.85})`;g.lineWidth=1.1;g.beginPath();g.arc(hx,hy,5+power*5,time*3,time*3+TAU*.8);g.stroke()
    for(let i=0;i<8;i++) {const progress=(time*1.8+i/8)%1,a=i*2.399+sign*time,rad=7+(1-progress)*38;g.globalAlpha=power*progress;g.fillStyle=i%2?'#ffe9c9':'#d1b1f3';g.beginPath();g.ellipse(hx+Math.cos(a)*rad,hy+Math.sin(a)*rad*.7,1+progress,1+progress,0,0,TAU);g.fill()}
    g.globalAlpha=1;g.strokeStyle=`rgba(255,247,223,${power})`;g.beginPath();g.moveTo(hx-4,hy);g.lineTo(hx+4,hy);g.moveTo(hx,hy-4);g.lineTo(hx,hy+4);g.stroke()
  }
  g.restore()
}
/** 弧形翼风与淡紫缎带跟随真实位移历史，人物拖影由实体另行绘制。 */
export function drawKedamaDashWake(g:CanvasRenderingContext2D,trail:readonly BossTrail[],x:number,y:number,angle:number,power:number):void {
  if(!trail.length)return
  g.save()
  for(const sign of [-1,1]) {
    const nx=-Math.sin(angle)*sign,ny=Math.cos(angle)*sign
    g.strokeStyle=sign<0?'#ecd6f26b':'#afd4e65c';g.lineWidth=sign<0?4:2;g.beginPath()
    trail.forEach((point,i)=>{const wave=Math.sin(i*.8)*4+12;if(i===0)g.moveTo(point.x+nx*wave,point.y+ny*wave-10);else g.lineTo(point.x+nx*wave,point.y+ny*wave-10)})
    g.lineTo(x+nx*12,y+ny*12-10);g.stroke()
  }
  if(power>0) {
    g.translate(x,y-12);g.rotate(angle);g.strokeStyle='#fbe8f3';g.lineWidth=1.4;g.globalAlpha=power
    for(let i=0;i<3;i++){g.beginPath();g.ellipse(-i*8,0,7+i*2,18+i*4,0,-1.1,1.1);g.stroke()}
    for(let i=0;i<7;i++){const yy=(i-3)*7;g.strokeStyle=i%2?'#c6a8e7':'#f6e3ec';g.beginPath();g.moveTo(-28-i%3*7,yy);g.lineTo(-54-i%3*9,yy);g.stroke()}
  }
  g.restore()
}
export function drawKedamaMoveWarning(g:CanvasRenderingContext2D,x:number,y:number,tx:number,ty:number,progress:number):void {
  g.save();g.globalAlpha=.35+progress*.45;g.strokeStyle='#d5b9e8';g.lineWidth=1.2;g.setLineDash([7,7]);g.beginPath();g.moveTo(x,y+14);g.lineTo(tx,ty+14);g.stroke();g.setLineDash([])
  const a=Math.atan2(ty-y,tx-x);g.translate(tx,ty+14);g.rotate(a);g.beginPath();g.moveTo(-8,-7);g.lineTo(0,0);g.lineTo(-8,7);g.stroke();g.restore()
}
export function drawKedamaTeleport(g:CanvasRenderingContext2D,x:number,y:number,age:number,arriving:boolean):void {
  if(age<0||age>.55)return
  const k=age/.55;g.save();g.translate(x,y);g.globalAlpha=1-k;g.strokeStyle='#dfc0f1';g.lineWidth=2
  g.beginPath();g.ellipse(0,12,12+k*36,5+k*12,0,0,TAU);g.stroke()
  for(let i=0;i<10;i++) {const a=i*TAU/10+age*2,rad=(arriving?1-k:k)*43;g.strokeStyle=i%2?'#ffe8d2':'#bd9dda';g.beginPath();g.moveTo(Math.cos(a)*rad,Math.sin(a)*rad-12);g.lineTo(Math.cos(a)*(rad+7),Math.sin(a)*(rad+7)-12);g.stroke()}
  const light=g.createRadialGradient(0,-12,0,0,-12,32);light.addColorStop(0,'#ffecf288');light.addColorStop(1,'#cb9fe700');g.fillStyle=light;g.fillRect(-32,-44,64,64);g.restore()
}
