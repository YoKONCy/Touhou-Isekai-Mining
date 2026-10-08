/** 营地修缮叠层沿用石砌炉体、旧木板与麻布材质，地面设施仍由原实体排序。 */
export type FurnaceBurnState='idle'|'heating'|'ready'
let furnaceSmoke:HTMLCanvasElement|undefined
/** 烟团仅烘焙一次；逐帧改变位置、大小与透明度，不维护粒子队列。 */
function smokeSprite():HTMLCanvasElement{
  if(furnaceSmoke)return furnaceSmoke
  const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96
  const g=canvas.getContext('2d')!,shade=g.createRadialGradient(43,46,4,48,48,44)
  shade.addColorStop(0,'rgba(173,167,157,.65)');shade.addColorStop(.35,'rgba(149,145,138,.48)')
  shade.addColorStop(.7,'rgba(134,132,128,.16)');shade.addColorStop(1,'rgba(134,132,128,0)')
  g.fillStyle=shade;g.fillRect(0,0,96,96);furnaceSmoke=canvas;return canvas
}

function drawFurnaceSmoke(g:CanvasRenderingContext2D,time:number,state:FurnaceBurnState):void{
  const active=state==='heating',count=active?9:state==='ready'?6:3
  const speed=active?.24:state==='ready'?.18:.13,opacity=active?.64:state==='ready'?.4:.2
  const stamp=smokeSprite(),drift=Math.sin(time*.43)*5+7
  g.save()
  for(let i=0;i<count;i++){
    const p=(time*speed+i/count)%1,envelope=Math.sin(p*Math.PI)
    const x=-8+drift*p+Math.sin(time*.67+i*1.9+p*4)*p*6,y=-115-p*(active?88:62)
    const w=13+p*(active?35:23),h=10+p*24
    g.globalAlpha=opacity*envelope
    g.drawImage(stamp,x-w/2,y-h/2,w,h)
    // 错开两团的轮廓，烟柱在上升时自然展开，避免一串等大的圆球。
    g.globalAlpha=opacity*envelope*.5
    g.drawImage(stamp,x-w*.1,y-h*.75,w*.8,h*.9)
  }
  g.restore()
}

function drawFurnaceFire(g:CanvasRenderingContext2D,time:number,state:FurnaceBurnState):void{
  const active=state==='heating',heat=active?1:state==='ready'?.62:.3
  const pulse=.9+.07*Math.sin(time*7.3)+.04*Math.sin(time*12.1)
  g.save()
  const spill=g.createRadialGradient(0,-14,3,0,-14,65)
  spill.addColorStop(0,`rgba(228,137,61,${heat*.2*pulse})`);spill.addColorStop(.5,`rgba(213,123,55,${heat*.09*pulse})`);spill.addColorStop(1,'rgba(213,123,55,0)')
  g.fillStyle=spill;g.fillRect(-65,-79,130,110)
  // 火与煤始终收在厚石拱内，热光只映到门框和附近地面。
  g.save();g.beginPath();g.roundRect(-18,-40,36,29,[16,16,1,1]);g.clip()
  g.fillStyle='#231b1b';g.fillRect(-20,-42,40,34)
  const glow=g.createRadialGradient(0,-18,2,0,-18,29)
  glow.addColorStop(0,`rgba(234,107,35,${heat*.8*pulse})`);glow.addColorStop(1,'rgba(132,47,27,0)')
  g.fillStyle=glow;g.fillRect(-24,-44,48,36)
  for(let i=0;i<7;i++){
    const cx=-15+i*5,cy=-13-(i%2)*2,ember=(.65+.18*Math.sin(time*3+i*2.1))*heat
    g.fillStyle='#40302a';g.beginPath();g.moveTo(cx-3,cy);g.lineTo(cx-2,cy-4);g.lineTo(cx+2,cy-5);g.lineTo(cx+4,cy-1);g.lineTo(cx+1,cy+2);g.closePath();g.fill()
    g.globalAlpha=ember;g.strokeStyle='#f29b50';g.lineWidth=1.2;g.beginPath();g.moveTo(cx-2,cy-3);g.lineTo(cx,cy-1);g.lineTo(cx+2,cy-2);g.stroke()
  }
  g.globalAlpha=1
  const flames=active?5:3
  for(let i=0;i<flames;i++){
    const cx=(i-(flames-1)/2)*(active?6:8),base=-15+(i%2)
    const sway=Math.sin(time*(3.7+i*.37)+i*2.3)*2.2
    const height=(active?19:state==='ready'?10:5)+(Math.sin(time*(5.4+i*.41)+i*1.7)+Math.sin(time*8.1+i))*(active?3:1)
    const width=active?4.5:3
    g.fillStyle='#c76832';g.beginPath();g.moveTo(cx-width,base);g.quadraticCurveTo(cx-width*1.2,base-height*.44,cx+sway,base-height);g.quadraticCurveTo(cx+width*.2,base-height*.45,cx+width,base);g.closePath();g.fill()
    g.fillStyle=active?'#f2b660':'#d99049';g.beginPath();g.moveTo(cx-width*.6,base);g.quadraticCurveTo(cx-width*.45,base-height*.28,cx+sway*.65,base-height*.75);g.quadraticCurveTo(cx+width*.3,base-height*.26,cx+width*.6,base);g.closePath();g.fill()
    if(active){g.fillStyle='#f5d997';g.beginPath();g.moveTo(cx-1.5,base);g.quadraticCurveTo(cx-2,base-4,cx+sway*.35,base-height*.36);g.quadraticCurveTo(cx+2,base-4,cx+1.5,base);g.closePath();g.fill()}
  }
  if(active)for(let i=0;i<3;i++){
    const p=(time*.52+i*.34)%1
    g.globalAlpha=Math.sin(p*Math.PI)*.75;g.fillStyle='#eac184';g.fillRect(-10+i*9+Math.sin(time*2+i)*2,-18-p*24,.8,1.3)
  }
  g.restore()
  g.strokeStyle='#4d4947';g.lineWidth=3;g.strokeRect(-21,-42,42,32)
  for(let i=0;i<5;i++){
    const x=-15+i*7;g.beginPath();g.moveTo(x,-36);g.lineTo(x,-13);g.stroke()
    g.strokeStyle=`rgba(227,157,78,${heat*.22*pulse})`;g.lineWidth=.8;g.beginPath();g.moveTo(x-1,-29);g.lineTo(x-1,-15);g.stroke();g.strokeStyle='#4d4947';g.lineWidth=3
  }
  g.fillStyle='#ac9471';g.fillRect(20,-30,4,10)
  g.restore()
}

export function drawFurnaceState(g:CanvasRenderingContext2D,x:number,y:number,stage:number,time:number,state:FurnaceBurnState='idle'):void{
  if(!stage)return
  g.save();g.translate(x,y)
  g.strokeStyle='#a8977a';g.lineWidth=3;g.lineCap='round';g.beginPath();g.moveTo(-27,-59);g.lineTo(-23,-50);g.lineTo(-28,-44);g.moveTo(24,-31);g.lineTo(29,-25);g.lineTo(26,-18);g.stroke()
  g.fillStyle='#95836b';g.fillRect(-31,-58,10,5);g.fillRect(22,-28,12,5)
  if(stage>=2){
    g.fillStyle='#b8a075';g.beginPath();g.moveTo(45,-25);g.lineTo(67,-29);g.lineTo(68,-10);g.lineTo(45,-6);g.closePath();g.fill()
    g.strokeStyle='#ded0a4';g.lineWidth=1;for(let i=0;i<4;i++){g.beginPath();g.moveTo(47+i*5,-23);g.lineTo(49+i*5,-9);g.stroke()}
    g.strokeStyle='#5e4a32';g.beginPath();g.moveTo(46,-17);g.lineTo(67,-21);g.stroke()
  }
  if(stage>=3){
    // 耐热风嘴连接修好的风箱与炉壁，卡箍与厚壁口沿保持旧设备质感。
    g.fillStyle='#a7977b';g.strokeStyle='#5a5146';g.lineWidth=1;g.beginPath();g.moveTo(33,-24);g.lineTo(45,-27);g.lineTo(48,-18);g.lineTo(35,-15);g.closePath();g.fill();g.stroke()
    g.strokeStyle='#d0bd98';g.lineWidth=2;g.beginPath();g.moveTo(39,-25);g.lineTo(41,-17);g.moveTo(43,-26);g.lineTo(45,-18);g.stroke()
    drawFurnaceFire(g,time,state)
    drawFurnaceSmoke(g,time,state)
  }
  g.restore()
}
export function drawWorktableTools(g:CanvasRenderingContext2D,x:number,y:number):void{
  g.save();g.translate(x,y);g.strokeStyle='#b89866';g.lineWidth=3;g.beginPath();g.moveTo(-21,-28);g.lineTo(16,-32);g.stroke();g.strokeStyle='#7b8481';g.lineWidth=5;g.beginPath();g.moveTo(9,-36);g.lineTo(18,-40);g.stroke()
  g.fillStyle='#b49a6e';g.beginPath();g.ellipse(-10,-34,7,4,0,0,Math.PI*2);g.fill();g.strokeStyle='#dfc694';g.lineWidth=1;for(let i=0;i<3;i++){g.beginPath();g.ellipse(-10,-34,3+i*1.3,1.7+i*.7,0,0,Math.PI*2);g.stroke()}
  g.restore()
}
export function drawCraftMarker(g:CanvasRenderingContext2D,x:number,y:number,time:number):void{
  g.save();g.translate(x,y-78+Math.sin(time*2.8)*2.4);g.globalAlpha=.85+.1*Math.sin(time*2.8)
  g.fillStyle='#d4af6b';g.strokeStyle='#635039';g.lineWidth=1.5;g.beginPath();g.roundRect(-9,-12,18,26,3);g.fill();g.stroke();g.fillStyle='#59412b';g.fillRect(-1.5,-7,3,12);g.fillRect(-1.5,8,3,3)
  g.strokeStyle='#edcc8c';g.globalAlpha=.22;g.beginPath();g.roundRect(-12,-15,24,32,5);g.stroke();g.restore()
}
