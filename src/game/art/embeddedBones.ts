import { drawMineSprite } from './mineAssets'

/** 三种骨质材质在地面层烘焙，断续泥土遮盖让骨骸嵌在地里。 */
export function drawEmbeddedBones(g:CanvasRenderingContext2D,variant:number,seed:number):void{
  if(drawMineSprite(g,'ground-bones',-35,-15,64,38,variant===1?'#595361':variant===2?'#78948a':undefined,variant ? .15 : 0))return
  const colors=[['#b4a386','#d7c4a0','#70614c'],['#514b44','#7d7160','#2f2d29'],['#94998e','#bec3b2','#5f695f']][variant%3]!
  g.save();g.scale(1,.65);g.strokeStyle='#1f211e55';g.lineWidth=5;g.lineCap='round'
  g.beginPath();g.moveTo(-19,2);g.quadraticCurveTo(0,-4,23,3);g.stroke()
  g.strokeStyle=colors[2]!;g.lineWidth=3.4;g.stroke();g.strokeStyle=colors[0]!;g.lineWidth=2.2;g.stroke()
  for(let i=0;i<7;i++){
    const x=-13+i*4.8,y=Math.sin(i*.7)*1.8
    g.fillStyle=colors[0]!;g.beginPath();g.ellipse(x,y,2.3,2.8,.2,0,Math.PI*2);g.fill()
    if(i<5){for(const sign of [-1,1]){g.strokeStyle=colors[2]!;g.lineWidth=2.8;g.beginPath();g.moveTo(x,y);g.bezierCurveTo(x-3,y+sign*7,x+5,y+sign*15,x+9,y+sign*9);g.stroke();g.strokeStyle=colors[0]!;g.lineWidth=1.5;g.stroke()}}
  }
  g.fillStyle=colors[0]!;g.strokeStyle=colors[2]!;g.lineWidth=.8;g.beginPath();g.moveTo(-23,-2);g.lineTo(-30,-8);g.lineTo(-38,-5);g.lineTo(-37,4);g.lineTo(-27,7);g.lineTo(-23,2);g.closePath();g.fill();g.stroke()
  g.fillStyle=colors[2]!;g.beginPath();g.ellipse(-32,-1,2.9,2,.3,0,Math.PI*2);g.fill();g.fillRect(-27,2,3,2)
  g.strokeStyle=colors[1]!;g.lineWidth=.7;g.beginPath();g.moveTo(-36,-4);g.lineTo(-30,-6);g.moveTo(-18,-1);g.lineTo(17,0);g.stroke()
  for(let i=0;i<10;i++){const x=-35+i*6,y=Math.sin(seed+i*2.7)*11;g.fillStyle=i%3?'#514b405c':colors[2]+'55';g.beginPath();g.ellipse(x,y,2.5+i%3,1.5,.3,0,Math.PI*2);g.fill()}
  g.restore()
}
