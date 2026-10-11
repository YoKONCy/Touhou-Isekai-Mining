import { drawMineSprite } from './mineAssets'
import { hash2 } from './artPalette'
import { paintHellStoneGrain } from './oldHellStoneMaterial'
import { radialStamp } from '../../core/rendering/RadialStamp'
import { drawSprite } from '../../core/rendering/SpriteCache'
import type { Dir } from '../cave/dungeon/types'

type Point={x:number;y:number}
export interface OldHellDoor {doorId:number;col:number;row:number;dir:Dir;open:boolean}
function polygon(g:CanvasRenderingContext2D,points:readonly Point[],color:string|CanvasGradient):void {
  g.fillStyle=color;g.beginPath();points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.fill()
}

/** 岩壁为矿道留出带拱顶的真实开口，不再裁出一个悬空的黑色长方形。 */
export function addOldHellDoorCutout(path:Path2D,x:number,y:number):void {
  path.moveTo(x-69,y+36);path.lineTo(x-76,y-87)
  path.bezierCurveTo(x-73,y-127,x-33,y-164,x,y-167)
  path.bezierCurveTo(x+35,y-162,x+75,y-129,x+76,y-87)
  path.lineTo(x+69,y+36);path.closePath()
}

/** 旧矿道：厚岩壳、暗部内壁、熏黑木支护、铁箍、门槛和一盏小矿灯。 */
export function paintOldHellDoorway(g:CanvasRenderingContext2D,seed:number):void {
  g.save();g.lineJoin='round'
  const rim=new Path2D(),points=[[-72,28],[-81,3],[-73,-61],[-80,-101],[-61,-131],[-37,-157],[-6,-166],[29,-158],[61,-137],[80,-102],[73,-48],[79,18],[62,32]] as const
  points.forEach(([x,y],i)=>i?rim.lineTo(x,y):rim.moveTo(x,y));rim.closePath()
  const stone=g.createLinearGradient(-70,-160,70,25)
  stone.addColorStop(0,'#77543a');stone.addColorStop(.38,'#4b3223');stone.addColorStop(1,'#211a15')
  g.fillStyle=stone;g.fill(rim)
  g.save();g.clip(rim)
  polygon(g,[{x:-78,y:-90},{x:-46,y:-125},{x:-29,y:-151},{x:2,y:-165},{x:-38,y:-155},{x:-69,y:-125}],'#9b714329')
  polygon(g,[{x:19,y:-153},{x:63,y:-132},{x:76,y:-98},{x:67,y:-14},{x:48,y:-49},{x:55,y:-113}],'#16141365')
  paintHellStoneGrain(g,-86,-171,172,210,seed,.9);g.restore()
  // 小块崩落的断面接进周围岩壁，边缘亮色只出现在迎光一侧。
  for(let i=0;i<7;i++){
    const a=Math.PI+(i/6)*Math.PI,x=Math.cos(a)*62,y=-88+Math.sin(a)*61,h=hash2(seed,i+21)
    polygon(g,[{x:x-15,y:y-6},{x:x-5,y:y-17},{x:x+13,y:y-12},{x:x+17,y:y+5},{x:x+2,y:y+12},{x:x-14,y:y+6}],i%3===0?'#67503a':i%3===1?'#41352a':'#51463a')
    polygon(g,[{x:x-15,y:y-6},{x:x-5,y:y-17},{x:x+13,y:y-12},{x:x+4,y:y-6}],h<.5?'#b48a4d25':'#c6b29a17')
  }
  const opening=new Path2D();opening.moveTo(-36,19);opening.lineTo(-36,-76)
  opening.bezierCurveTo(-35,-108,-18,-125,0,-128);opening.bezierCurveTo(20,-124,36,-106,36,-75);opening.lineTo(36,19);opening.closePath()
  const dark=g.createLinearGradient(0,-120,0,23)
  dark.addColorStop(0,'#070605');dark.addColorStop(.75,'#0d0907');dark.addColorStop(1,'#2a1a10')
  g.fillStyle=dark;g.fill(opening)
  polygon(g,[{x:-36,y:18},{x:-36,y:-78},{x:-29,y:-101},{x:-23,y:-74},{x:-24,y:12}],'#17110d')
  polygon(g,[{x:26,y:14},{x:26,y:-79},{x:18,y:-110},{x:36,y:-81},{x:36,y:20}],'#080706')
  // 支护木保留正式素材木纹，用熏黑色压住旧木的明亮橙色。
  for(const side of [-1,1]){
    const x=side<0?-57:40
    polygon(g,[{x:x-2,y:25},{x:x-1,y:-116},{x:x+17,y:-120},{x:x+20,y:23}],'#352014')
    drawMineSprite(g,'timber-post',x,-119,19,145,'#40281a',.58)
    for(const y of [-99,-20]){
      polygon(g,[{x:x-2,y},{x:x+20,y:y-1},{x:x+20,y:y+9},{x:x-2,y:y+11}],'#242321')
      g.fillStyle='#8b80705e';g.fillRect(x+1,y+1,16,1);g.fillStyle='#110e0c';g.fillRect(x+4,y+4,2,2);g.fillRect(x+13,y+4,2,2)
    }
  }
  drawMineSprite(g,'timber-beam',-61,-125,123,23,'#49301e',.57)
  polygon(g,[{x:-59,y:-105},{x:-59,y:-112},{x:61,y:-111},{x:58,y:-104}],'#160f0b94')
  polygon(g,[{x:-43,y:14},{x:42,y:14},{x:56,y:31},{x:-55,y:32}],'#4d3827')
  polygon(g,[{x:-55,y:32},{x:56,y:31},{x:53,y:37},{x:-52,y:38}],'#201813')
  g.fillStyle='#ae855548';g.fillRect(-42,15,83,1)
  // 残存窄轨向洞内收束，让开口有可读的纵深。
  for(const side of [-1,1]){
    polygon(g,[{x:side*18-1,y:30},{x:side*5-1,y:-31},{x:side*5+1,y:-31},{x:side*18+2,y:30}],'#5f554440')
  }
  // 矿灯为入口提供固定暖色识别点。
  const lamp=radialStamp('old-hell-door-lamp',.02,[[0,'rgba(231,150,62,.32)'],[.4,'rgba(187,100,34,.12)'],[1,'rgba(187,100,34,0)']])
  g.save();g.translate(-66,-79);g.scale(.34,.4);drawSprite(g,lamp);g.restore()
  g.fillStyle='#18120e';g.fillRect(-72,-91,12,22);g.fillStyle='#a6672c';g.fillRect(-69,-87,6,13)
  g.fillStyle='#e6af5a';g.fillRect(-68,-85,3,9);g.fillStyle='#32251b';g.fillRect(-73,-92,14,3);g.fillRect(-73,-71,14,3)
  g.restore()
}

/** 通行状态融进入口：封锁栅栏与暖色路标，不叠加原有的矩形符印面板。 */
export function renderOldHellDoorState(g:CanvasRenderingContext2D,door:OldHellDoor,time:number):void {
  g.save()
  if(!door.open){
    g.save();g.beginPath();g.rect(-35,-102,70,122);g.clip()
    for(const x of [-23,-8,8,23]){
      g.fillStyle='#24201c';g.fillRect(x-2,-104,5,126);g.fillStyle='#8d79604d';g.fillRect(x-1,-104,1,125)
    }
    g.fillStyle='#493829';g.fillRect(-36,-68,72,6);g.fillRect(-36,-14,72,6);g.restore()
    g.globalAlpha=.65+Math.sin(time*2.4+door.doorId)*.16
    polygon(g,[{x:0,y:-57},{x:7,y:-48},{x:0,y:-39},{x:-7,y:-48}],'#ac5135')
  }else{
    const vector=door.dir==='N'?{x:0,y:-1}:door.dir==='S'?{x:0,y:1}:door.dir==='W'?{x:-1,y:0}:{x:1,y:0}
    g.globalAlpha=.65+Math.sin(time*1.7+door.doorId)*.15
    for(let i=0;i<2;i++){
      const x=vector.x*(i*8-4),y=19+vector.y*(i*8-4)
      polygon(g,[{x:x+vector.x*4,y:y+vector.y*4},{x:x-vector.x*2-vector.y*3,y:y-vector.y*2+vector.x*3},{x:x-vector.x*2+vector.y*3,y:y-vector.y*2-vector.x*3}],'#d3a35f')
    }
  }
  g.restore()
}
