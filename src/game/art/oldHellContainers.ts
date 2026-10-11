import { SpriteCache,bakeSprite,drawSprite } from '../../core/rendering/SpriteCache'
import { radialStamp } from '../../core/rendering/RadialStamp'
import { hash2 } from './artPalette'
import { drawMineSprite,mineAssetsReady } from './mineAssets'
import type { Prop } from './props'

export type OldHellContainerStyle='toolbox'|'jar'|'satchel'|'drawer'|'wardrobe'|'shelf'|'sealed'
const cache=new SpriteCache(96,3*1024*1024)
type Point={x:number;y:number}
function polygon(g:CanvasRenderingContext2D,points:readonly Point[],color:string):void {
  g.fillStyle=color;g.beginPath();points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.fill()
}
function wood(g:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,vertical=false):void {
  g.fillStyle='#62462e';g.fillRect(x,y,w,h)
  g.save();g.beginPath();g.rect(x,y,w,h);g.clip()
  if(vertical){g.translate(x,y+h);g.rotate(-Math.PI/2);drawMineSprite(g,'wood-remnant-2',0,0,h,w,'#765431',.35)}
  else drawMineSprite(g,'wood-remnant-0',x,y,w,h,'#765431',.35)
  g.restore();g.fillStyle='#b18a5240';g.fillRect(x,y,w,1);g.fillStyle='#251d164d';g.fillRect(x+w-2,y,2,h)
}
function iron(g:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,bronze=false):void {
  g.fillStyle=bronze?'#655033':'#383a34';g.fillRect(x,y,w,h)
  g.fillStyle=bronze?'#b494584f':'#b0a38a3b';g.fillRect(x,y,w,1)
  g.fillStyle='#171812';g.fillRect(x+2,y+2,2,2)
}
function box(g:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,d=8):void {
  polygon(g,[{x,y},{x:x+d,y:y-d},{x:x+w+d,y:y-d},{x:x+w,y}],'#80613e')
  polygon(g,[{x:x+w,y},{x:x+w+d,y:y-d},{x:x+w+d,y:y+h-d},{x:x+w,y:y+h}],'#3f3121')
  wood(g,x,y,w,h)
}
function ceramic(g:CanvasRenderingContext2D,small=false):void {
  g.save();if(small)g.scale(.42,.42)
  const body=new Path2D();body.moveTo(-15,-52);body.bezierCurveTo(-13,-45,-28,-37,-23,-14);body.bezierCurveTo(-22,-2,-12,1,0,1);body.bezierCurveTo(16,1,24,-5,24,-20);body.bezierCurveTo(24,-39,14,-43,15,-52);body.closePath()
  const glaze=g.createLinearGradient(-22,0,24,0)
  glaze.addColorStop(0,'#424b40');glaze.addColorStop(.25,'#8d9279');glaze.addColorStop(.55,'#697661');glaze.addColorStop(1,'#394238')
  g.fillStyle=glaze;g.fill(body)
  polygon(g,[{x:-18,y:-32},{x:-10,y:-39},{x:-9,y:-14},{x:-14,y:-9}],'#c1b8922e')
  g.fillStyle='#222c24';g.beginPath();g.ellipse(0,-51,16,4.5,0,0,Math.PI*2);g.fill()
  g.strokeStyle='#afab8570';g.lineWidth=1.4;g.beginPath();g.ellipse(0,-50,17,4.5,0,0,Math.PI);g.stroke()
  g.save();g.clip(body)
  g.strokeStyle='#c2bd9136';g.lineWidth=2.3;g.beginPath();g.ellipse(0,-34,23,4.5,0,0,Math.PI);g.stroke()
  g.strokeStyle='#26352a70';g.lineWidth=1;g.beginPath();g.ellipse(0,-31,24,4.5,0,0,Math.PI);g.stroke()
  g.fillStyle='#cfbf8a18';for(let i=0;i<33;i++)g.fillRect(-24+hash2(73,i)*48,-48+hash2(29,i)*46,1.3,.7)
  g.restore()
  for(const [x,y] of [[14,-35],[-17,-16],[6,-4]] as const)polygon(g,[{x,y},{x:x+4,y:y-1},{x:x+3,y:y+3}], '#c9ba8b91')
  g.restore()
}

/** 木、铁、陶与布保留各自材质；所有形状在局部坐标烘焙，逐帧只移动开合部件。 */
function paintBody(g:CanvasRenderingContext2D,style:OldHellContainerStyle,seed:number):void {
  g.fillStyle='#17140f35';g.beginPath();g.ellipse(2,2,style==='shelf'?45:style==='drawer'?39:31,6,0,0,Math.PI*2);g.fill()
  if(style==='toolbox'){
    box(g,-31,-23,59,23,7)
    polygon(g,[{x:-28,y:-24},{x:-22,y:-31},{x:32,y:-31},{x:26,y:-24}],'#1e1d15')
    for(const x of [-24,19])iron(g,x,-22,6,21)
    iron(g,-5,-21,9,9);g.fillStyle='#a38b595e';g.fillRect(-18,-13,20,1)
  }else if(style==='jar')ceramic(g)
  else if(style==='satchel'){
    const bag=new Path2D();bag.moveTo(-22,-26);bag.bezierCurveTo(-30,-17,-32,-1,-12,1);bag.bezierCurveTo(1,5,30,1,28,-16);bag.lineTo(21,-32);bag.bezierCurveTo(4,-40,-14,-35,-22,-26)
    g.fillStyle='#8b7855';g.fill(bag)
    g.save();g.clip(bag)
    for(let i=0;i<70;i++){g.fillStyle=i%2?'#d7c59a24':'#342d2529';g.fillRect(-30+hash2(seed,i+401)*60,-35+hash2(seed,i+501)*38,1.5,.6)}
    g.restore()
    polygon(g,[{x:-23,y:-25},{x:-14,y:-28},{x:-12,y:-4},{x:-26,y:-6}],'#514a352e')
    polygon(g,[{x:17,y:-31},{x:25,y:-18},{x:26,y:-4},{x:15,y:-1},{x:12,y:-17}],'#413d2b55')
    polygon(g,[{x:-12,y:-15},{x:1,y:-17},{x:5,y:-6},{x:-10,y:-4}],'#b9a27a')
    g.strokeStyle='#514c37';g.lineWidth=1;g.beginPath();for(let i=0;i<4;i++){g.moveTo(-11+i*4,-14);g.lineTo(-10+i*4,-11)}g.stroke()
    g.strokeStyle='#4e4a34';g.lineWidth=3;g.beginPath();g.moveTo(-25,-23);g.bezierCurveTo(-19,-43,20,-47,25,-24);g.stroke()
    g.fillStyle='#272b20';g.beginPath();g.ellipse(0,-29,18,5,0,0,Math.PI*2);g.fill()
  }else if(style==='drawer'){
    wood(g,-32,-19,8,23,true);wood(g,25,-19,8,23,true)
    box(g,-33,-37,63,18,7);box(g,-38,-43,73,5,7)
    g.fillStyle='#1d1b12';g.fillRect(-26,-32,51,11)
    polygon(g,[{x:-17,y:-30},{x:6,y:-32},{x:13,y:-23},{x:-14,y:-22}],'#bba782')
    wood(g,-26,-10,52,4)
  }else if(style==='wardrobe'){
    box(g,-28,-97,56,94,8);wood(g,-33,-103,68,6);wood(g,-31,-8,65,7)
    wood(g,-25,-3,7,7,true);wood(g,20,-3,7,7,true)
    g.fillStyle='#171b16';g.fillRect(-24,-91,48,81)
    wood(g,-23,-82,45,3)
    polygon(g,[{x:-15,y:-79},{x:-20,y:-67},{x:-16,y:-59},{x:-11,y:-61},{x:-13,y:-23},{x:11,y:-23},{x:8,y:-61},{x:15,y:-59},{x:18,y:-67},{x:10,y:-79},{x:1,y:-73}],'#756d78')
    polygon(g,[{x:3,y:-72},{x:8,y:-65},{x:11,y:-25},{x:3,y:-25}],'#3e43423d')
  }else if(style==='shelf'){
    g.save();g.transform(1,.025,-.065,1,0,0)
    wood(g,-37,-86,8,88,true);wood(g,31,-69,8,71,true)
    wood(g,-38,-81,65,7);wood(g,-37,-51,77,7);wood(g,-37,-22,77,7);wood(g,-40,-4,82,7)
    g.save();g.translate(-17,-23);ceramic(g,true);g.restore()
    box(g,-29,-75,24,22,4);iron(g,-22,-74,3,20)
    box(g,3,-42,25,20,4)
    polygon(g,[{x:-9,y:-80},{x:27,y:-88},{x:29,y:-83},{x:-9,y:-76}],'#6b4c31')
    g.restore()
  }else{
    polygon(g,[{x:-32,y:-99},{x:-23,y:-109},{x:36,y:-107},{x:29,y:-98}],'#626053')
    polygon(g,[{x:29,y:-98},{x:36,y:-107},{x:37,y:-6},{x:29,y:2}],'#232923')
    const metal=g.createLinearGradient(-32,0,32,0);metal.addColorStop(0,'#41453b');metal.addColorStop(.3,'#2c332d');metal.addColorStop(1,'#171e1a')
    g.fillStyle=metal;g.fillRect(-32,-99,63,99)
    g.fillStyle='#101611';g.fillRect(-26,-92,51,82)
    polygon(g,[{x:-20,y:-24},{x:-10,y:-34},{x:12,y:-33},{x:19,y:-20},{x:12,y:-14},{x:-14,y:-15}],'#5c5040')
    for(const y of [-100,-7])iron(g,-34,y,69,7,true)
    iron(g,-34,-96,7,91,true);iron(g,27,-96,7,91,true)
    g.fillStyle='#95744955';g.fillRect(-25,-91,1,79)
    for(let i=0;i<6;i++){const x=-29+hash2(seed,i)*58,y=-96+hash2(seed,i+17)*87;g.fillStyle='#975b323d';g.fillRect(x,y,3,2)}
  }
}

/** 开合件独立缓存：箱盖、瓮盖、布盖、抽屉和柜门使用不同的移动方式。 */
function paintPanel(g:CanvasRenderingContext2D,style:OldHellContainerStyle):void {
  if(style==='toolbox'){
    box(g,-31,-3,59,6,7);iron(g,-24,-3,6,6);iron(g,19,-3,6,6)
    g.strokeStyle='#242b23';g.lineWidth=3;g.beginPath();g.moveTo(-9,-3);g.lineTo(-9,-10);g.lineTo(8,-10);g.lineTo(8,-3);g.stroke()
  }else if(style==='jar'){
    g.fillStyle='#5d452c';g.beginPath();g.ellipse(0,0,20,5,0,0,Math.PI*2);g.fill()
    g.fillStyle='#a3834d';g.beginPath();g.ellipse(0,-2,20,5,0,0,Math.PI*2);g.fill()
    g.strokeStyle='#49392770';g.lineWidth=.8;g.beginPath();g.moveTo(-12,-5);g.lineTo(-12,1);g.moveTo(1,-6);g.lineTo(1,2);g.moveTo(12,-5);g.lineTo(12,1);g.stroke()
    g.fillStyle='#443629';g.fillRect(-3,-6,7,4)
  }else if(style==='satchel'){
    polygon(g,[{x:-23,y:-4},{x:-13,y:-10},{x:19,y:-9},{x:25,y:-2},{x:17,y:17},{x:-15,y:19}],'#697b70')
    polygon(g,[{x:17,y:-8},{x:25,y:-2},{x:17,y:17},{x:10,y:16}],'#3f5145')
    g.strokeStyle='#b7ba915e';g.lineWidth=1;g.beginPath();g.moveTo(-20,-2);g.lineTo(-13,15);g.lineTo(14,14);g.stroke()
    iron(g,-4,11,9,8,true)
  }else if(style==='drawer'){
    wood(g,-27,-1,54,13);iron(g,-7,3,14,3)
  }else if(style==='wardrobe'){
    wood(g,0,-91,48,81,true)
    wood(g,3,-87,42,4);wood(g,3,-14,42,4)
    iron(g,0,-72,7,5);iron(g,0,-27,7,5);iron(g,35,-51,5,11,true)
  }else if(style==='shelf')box(g,1,-3,26,4,5)
  else{
    const face=g.createLinearGradient(0,-90,49,-10);face.addColorStop(0,'#464c40');face.addColorStop(.55,'#303930');face.addColorStop(1,'#202a23')
    g.fillStyle=face;g.fillRect(0,-91,49,81)
    iron(g,2,-85,45,6,true);iron(g,2,-24,45,6,true)
    iron(g,2,-85,5,66,true);iron(g,42,-85,5,66,true)
    g.strokeStyle='#b08c4a';g.lineWidth=2;g.beginPath();g.ellipse(37,-53,3,6,0,0,Math.PI*2);g.stroke()
    polygon(g,[{x:9,y:-83},{x:16,y:-86},{x:40,y:-24},{x:32,y:-22}],'#986046')
    polygon(g,[{x:34,y:-81},{x:41,y:-77},{x:15,y:-20},{x:8,y:-24}],'#b39c69')
    g.fillStyle='#6c4735';g.fillRect(21,-57,8,11)
    g.strokeStyle='#513b2c';g.lineWidth=.8;g.beginPath();g.moveTo(24,-54);g.lineTo(27,-51);g.lineTo(23,-49);g.stroke()
  }
}

export function drawOldHellContainer(style:OldHellContainerStyle,g:CanvasRenderingContext2D,p:Prop,time:number):void {
  const variant=Math.floor(hash2(p.seed,21)*3),ready=mineAssetsReady()?1:0
  const sprite=(part:'body'|'panel')=>cache.get(`${style}:${variant}:${ready}:${part}`,()=>bakeSprite(-59,-121,118,138,c=>part==='body'?paintBody(c,style,variant*11+3):paintPanel(c,style),1.5))
  const age=p.searchOpenedAt===undefined?0:Math.max(0,time-p.searchOpenedAt)/.42,t=Math.min(1,age),open=t*t*(3-2*t)
  g.save();g.translate(p.x,p.y);g.scale(p.s,p.s);g.imageSmoothingEnabled=true
  drawSprite(g,sprite('body'));g.save()
  if(style==='toolbox'){g.translate(0,-26-open*21);g.transform(1,0,-open*.18,1-open*.65,0,0)}
  else if(style==='jar'){g.translate(open*16,-55-open*7);g.rotate(open*.2)}
  else if(style==='satchel'){g.translate(0,-27-open*10);g.transform(1,0,open*.15,1-open*.75,0,0)}
  else if(style==='drawer')g.translate(open*2,-30+open*12)
  else if(style==='shelf'){g.translate(2,-44-open*13);g.rotate(-open*.17)}
  else {g.translate(style==='sealed'?-25:-24,0);g.transform(1-open*.72,-open*.12,0,1,0,0)}
  drawSprite(g,sprite('panel'));g.restore()
  if(style==='sealed'){
    const leak=radialStamp('old-hell-sealed-cabinet-leak',0,[[0,'#f4bf654d'],[.4,'#d1933d22'],[1,'#ba752600']])
    g.save();g.translate(18,-47);g.scale(.3,.48);g.globalAlpha*=(.19+Math.sin(time*.85+p.seed)*.07)*(1-open*.5);drawSprite(g,leak);g.restore()
  }
  g.restore()
}
