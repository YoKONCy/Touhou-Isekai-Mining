import type { OrePalette } from '../../content/minerals/types'
import type { OreTile } from '../tilemap'
import { ART, hash2 } from './artPalette'
import { CONFIG } from '../config'
import { drawMineStone, drawMineSprite, type MineSprite } from './mineAssets'
import { MINERAL_COPPER_ID, MINERAL_IRON_ID, MINERAL_GOLD_ID, MINERAL_RUBY_ID, MINERAL_SALT_ROCK_ID, MINERAL_COAL_ID } from '../../content/minerals/vanilla/ids'

const mineralSprites:Readonly<Record<string,MineSprite>>={
  [MINERAL_COPPER_ID]:'mineral-copper',[MINERAL_IRON_ID]:'mineral-iron',
  [MINERAL_GOLD_ID]:'mineral-gold',[MINERAL_RUBY_ID]:'mineral-ruby',
  [MINERAL_SALT_ROCK_ID]:'mineral-salt',[MINERAL_COAL_ID]:'mineral-coal'
}

/** 官方矿种统一母岩、嵌入矿斑和分面；内容包自定义外观继续沿原入口。 */
export function drawSharedMineral(g:CanvasRenderingContext2D,ore:OreTile,a:OrePalette):boolean{
  const name=mineralSprites[ore.kind]
  if(!name)return false
  const x=(ore.col+.5)*CONFIG.tile+ore.offsetX,y=(ore.row+.5)*CONFIG.tile+ore.offsetY
  if(!drawMineSprite(g,name,x-32,y-32,64,64))return false
  const wear=1-ore.hp/ore.maxHp
  g.save();g.translate(x,y)
  if(wear>.22){seam(g,[[-9,-5],[-3,-2],[-5,3],[0,7],[-1,13]],`rgba(40,33,46,${wear*.85})`,.8);if(wear>.6)seam(g,[[-4,1],[4,-3],[7,-7]],'#38303b99',.6)}
  g.restore()
  if(ore.flash>0){g.save();g.globalAlpha*=ore.flash/CONFIG.mine.hitFlash*.32;drawMineSprite(g,name,x-32,y-32,64,64,a.hi,1);g.restore()}
  return true
}

/** 金属矿使用共用母岩与独立矿斑，细节来自矿种而非楼层。 */
function paintSharedMetal(g:CanvasRenderingContext2D,form:MetalForm,a:OrePalette):Path2D|null{
  if(!drawMineStone(g,form==='iron'?2:0,0,0))return null
  const outline=new Path2D('M-20 2L-14-14L7-19L20-5L19 9L8 17L-14 15Z')
  const face=(points:readonly Point[],color:string)=>{const p=path(points);g.fillStyle=color;g.fill(p);g.strokeStyle='#34303e';g.lineWidth=.6;g.stroke(p)}
  if(form==='copper'){
    for(const [x,y,s] of [[-8,-9,1],[9,5,.8],[-11,7,.4]]){
      face([[x-6*s,y],[x-2*s,y-4*s],[x+6*s,y-2*s],[x+5*s,y+4*s],[x-s,y+6*s],[x-6*s,y+3*s]],a.crystalDark)
      face([[x-6*s,y],[x-2*s,y-4*s],[x+6*s,y-2*s],[x+s,y+s]],a.crystal)
      seam(g,[[x-3*s,y-2*s],[x,y-3*s],[x+3*s,y-s]],a.hi,.7)
    }
    face([[-14,2],[-11,0],[-8,3],[-11,5]],'#81927a')
  }else if(form==='iron'){
    for(const [x,y,h] of [[-9,-7,12],[1,-10,16],[11,-5,11]]){
      const front:Point[]=[[x-3,y],[x-2,y-h],[x+3,y-h+2],[x+4,y-1]]
      face(front,a.crystal);outline.addPath(path(front))
      face([[x+3,y-h+2],[x+5,y-h+3],[x+5,y],[x+4,y-1]],a.crystalDark)
      seam(g,[[x-1,y-h+2],[x-1,y-2]],a.hi,.6)
      face([[x-3,y],[x-2,y-4],[x+1,y-3],[x+1,y]],'#9b7258')
    }
  }else{
    seam(g,[[-5,-13],[-1,-7],[-3,0],[1,6],[-1,14]],'#302735',2.8)
    for(const [x,y] of [[-4,-9],[-2,-4],[-2,1],[0,6],[-1,11],[9,4]]){
      face([[x-2,y],[x,y-2],[x+2,y],[x+1,y+2]],a.crystal)
      seam(g,[[x-1,y],[x,y-1]],a.hi,.6)
    }
  }
  return outline
}

type Point=readonly [number,number]
export type MetalForm='copper'|'iron'|'gold'
interface Sprite {image:HTMLCanvasElement;outline:Path2D}
const sprites=new WeakMap<OreTile,Sprite>()

function path(points:readonly Point[]):Path2D{
  const p=new Path2D();points.forEach(([x,y],i)=>i?p.lineTo(x,y):p.moveTo(x,y));p.closePath();return p
}
function face(g:CanvasRenderingContext2D,points:readonly Point[],color:string,edge=false):void{
  const p=path(points);g.fillStyle=color;g.fill(p)
  if(edge){g.strokeStyle=ART.ink;g.lineWidth=1.2;g.stroke(p)}
}
function seam(g:CanvasRenderingContext2D,points:readonly Point[],color:string,width=1):void{
  g.strokeStyle=color;g.lineWidth=width;g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke()
}
function grain(g:CanvasRenderingContext2D,ore:OreTile,count:number,light:string,dark:string):void{
  for(let i=0;i<count;i++){
    const x=-18+hash2(ore.col*7+i*11,ore.row*3)*36,y=-18+hash2(ore.row*13+i*3,ore.col)*33
    g.fillStyle=i%3?dark:light;g.fillRect(x,y,.55+hash2(i,ore.col)*.65,.6)
  }
}

/** 铜：圆钝团块上的厚矿斑，橙红断面与少量铜绿有独立的体积。 */
function copper(g:CanvasRenderingContext2D,ore:OreTile,a:OrePalette):Path2D{
  const p=new Path2D();p.moveTo(-19,-2);p.quadraticCurveTo(-20,-13,-9,-17);p.lineTo(5,-19);p.quadraticCurveTo(16,-17,20,-7);p.lineTo(21,7);p.quadraticCurveTo(16,16,5,18);p.lineTo(-10,15);p.quadraticCurveTo(-20,11,-19,-2)
  g.fillStyle=a.base;g.fill(p);g.save();g.clip(p)
  face(g,[[-21,1],[-7,-6],[4,0],[7,18],[-12,18],[-22,8]],'#776252')
  face(g,[[5,-19],[20,-8],[22,8],[6,18],[4,0],[12,-9]],a.baseDark)
  face(g,[[-18,-7],[-9,-17],[5,-19],[12,-9],[-1,-6],[-9,-1]],'#a48a70')
  grain(g,ore,24,'#c1ac8655','#2f263640')
  face(g,[[-10,-12],[-2,-15],[6,-11],[5,-5],[-1,-3],[-11,-6]],a.crystalDark,true)
  face(g,[[-10,-12],[-2,-15],[6,-11],[-1,-8],[-8,-8]],a.crystal)
  face(g,[[-11,-6],[-1,-3],[5,-5],[3,1],[-6,1]],'#985735')
  seam(g,[[-8,-11],[-2,-13],[3,-11]],a.hi,.8)
  face(g,[[5,4],[11,1],[17,5],[15,12],[8,14],[3,10]],a.crystalDark,true)
  face(g,[[5,4],[11,1],[17,5],[10,7],[3,10]],a.crystal)
  seam(g,[[6,5],[11,3],[14,5]],a.hi,.75)
  face(g,[[-15,5],[-10,2],[-6,6],[-9,10],[-14,9]],'#71866a')
  face(g,[[-13,5],[-10,3],[-9,6],[-12,7]],'#a6b397')
  seam(g,[[-1,0],[-4,5],[-1,10],[-3,14]],'#3c302f',1)
  g.restore();g.strokeStyle='#30272c';g.lineWidth=1.4;g.stroke(p)
  seam(g,[[-17,-8],[-10,-15],[-6,-16]],'#ccaf8555',.8)
  return p
}

/** 铁：冷灰层岩顶部插着少量灰白铁片，锈边与错落高度形成辨识点。 */
function iron(g:CanvasRenderingContext2D,ore:OreTile,a:OrePalette):Path2D{
  const outline=path([[-23,5],[-20,-5],[-15,-16],[5,-23],[16,-18],[19,-9],[23,1],[21,12],[7,18],[-12,16],[-22,11]])
  face(g,[[-23,5],[-10,-5],[20,1],[21,12],[7,18],[-12,16],[-22,11]],a.baseDark,true)
  face(g,[[-23,5],[-10,-5],[20,1],[5,10],[-12,12]],'#79828a')
  face(g,[[-20,-5],[-6,-15],[19,-9],[23,1],[4,10],[-17,5]],'#505965',true)
  face(g,[[-20,-5],[-6,-15],[19,-9],[1,1],[-17,1]],'#8b9499')
  face(g,[[-15,-16],[5,-23],[16,-18],[19,-9],[2,1],[-17,0]],a.base,true)
  face(g,[[-15,-16],[5,-23],[16,-18],[1,-9],[-17,-6]],a.crystal)
  face(g,[[1,-9],[16,-18],[19,-9],[2,1],[-17,0],[-17,-6]],a.crystalDark)
  g.save();g.clip(outline);grain(g,ore,26,'#c7d0cd50','#24293555');g.restore()
  seam(g,[[-12,-15],[4,-21],[10,-18]],a.hi,.85)
  seam(g,[[-17,-4],[-4,-10],[6,-8]],'#bcc6cc',.7)
  seam(g,[[-16,5],[-7,1],[3,3]],'#89959c',.75)
  seam(g,[[-8,12],[6,14],[17,10]],'#b0b7b7',.65)
  seam(g,[[8,-14],[5,-9],[8,-7]],'#3b4452',.8)
  face(g,[[-18,10],[-12,7],[-7,10],[-10,14],[-16,14]],'#756656')
  // 铁片沿裂口插入岩体，薄侧面、缺口和不连续锈斑体现厚度与旧金属质感。
  const sheets=[{x:-10,y:-9,w:6,h:13,lean:-3},{x:1,y:-12,w:7,h:16,lean:1},{x:12,y:-8,w:5.5,h:13,lean:3}]
  for(let i=0;i<sheets.length;i++){
    const {x,y,w,lean}=sheets[i]!,h=sheets[i]!.h+hash2(ore.col+i*11,ore.row)*.8
    g.fillStyle='#303440';g.beginPath();g.ellipse(x,y+1,w*.85,2.2,-.15,0,Math.PI*2);g.fill()
    const front:Point[]=[[x-w/2,y],[x-w/2+lean,y-h+3],[x+lean-1,y-h],[x+lean+.7,y-h+1.6],[x+w/2+lean,y-h+.6],[x+w/2,y-1]]
    const side:Point[]=[[x+w/2+lean,y-h+.6],[x+w/2+lean+2,y-h+2.1],[x+w/2+2,y],[x+w/2,y-1]]
    face(g,side,'#737b7d',true);face(g,front,i===0?'#b7b9ad':'#d0d0c2',true)
    outline.addPath(path(front));outline.addPath(path(side))
    face(g,[[x-w/2,y],[x-w/2+lean*.35,y-h*.35],[x-w/2+2.1,y-h*.28],[x-w/2+2.8,y-2],[x+.6,y-1]],'#a36f50')
    face(g,[[x+w/2+lean-.8,y-h+1.2],[x+w/2+lean-.9,y-h+5],[x+w/2+lean-2.3,y-h+4.3]],'#ad7b57')
    seam(g,[[x-w/2+lean+.9,y-h+3],[x+lean-1,y-h+1]],'#ebe5cf',.75)
    seam(g,[[x+lean*.6,y-h*.7],[x+lean*.25,y-h*.25]],'#878f8b',.6)
  }
  return outline
}

/** 金：高低错开的深色裂岩，金粒聚在裂口内，保留大片暗色母岩。 */
function gold(g:CanvasRenderingContext2D,ore:OreTile,a:OrePalette):Path2D{
  const outline=path([[-21,-2],[-17,-17],[-7,-22],[-1,-13],[5,-23],[17,-19],[22,-3],[17,14],[4,18],[-12,14],[-20,8]])
  g.fillStyle=a.base;g.fill(outline);g.save();g.clip(outline)
  face(g,[[-21,-2],[-17,-17],[-7,-22],[-1,-13],[-5,-4],[-14,2]],'#898077')
  face(g,[[5,-23],[17,-19],[22,-3],[10,-6],[2,-13]],'#72686b')
  face(g,[[10,-6],[22,-3],[17,14],[4,18],[5,4]],a.baseDark)
  face(g,[[-21,-2],[-14,2],[-6,8],[-1,17],[-12,14],[-20,8]],'#5b5357')
  face(g,[[-1,-13],[2,-18],[3,-9],[0,-4],[5,1],[1,5],[5,12],[1,18],[-4,15],[-2,5],[-6,1],[-3,-5]],'#231d29')
  grain(g,ore,28,'#b3a48c44','#25222c55')
  const chips:Point[]=[[-1,-10],[1,-5],[-3,0],[2,4],[1,11],[10,6],[-12,-5]]
  chips.forEach(([x,y],i)=>{
    const size=i===4?2.6:1.3+hash2(ore.col+i*3,ore.row)*1.4
    face(g,[[x-size,y],[x-.3,y-size*.8],[x+size,y-.5],[x+size*.7,y+size],[x-size*.7,y+size*.8]],a.crystalDark)
    face(g,[[x-size,y],[x-.3,y-size*.8],[x+size,y-.5],[x,y+.7]],a.crystal)
    seam(g,[[x-size*.55,y-.2],[x-.1,y-size*.5],[x+size*.4,y-.4]],a.hi,.65)
  })
  g.restore();g.strokeStyle='#28232f';g.lineWidth=1.45;g.stroke(outline)
  seam(g,[[-15,-16],[-8,-19],[-5,-16]],'#baac9055',.8)
  seam(g,[[7,-20],[13,-17],[15,-11]],'#b0a58a4d',.7)
  return outline
}

/** 主体只烘焙一次；运行时保留脚底排序、裂纹和受击提亮。 */
export function drawSceneMetal(g:CanvasRenderingContext2D,ore:OreTile,form:MetalForm,a:OrePalette,time:number):void{
  let sprite=sprites.get(ore)
  if(!sprite){
    const image=document.createElement('canvas');image.width=image.height=128
    const ctx=image.getContext('2d')!;ctx.scale(2,2);ctx.translate(32,32);ctx.lineJoin='round';ctx.lineCap='round'
    const outline=paintSharedMetal(ctx,form,a)??(form==='copper'?copper(ctx,ore,a):form==='iron'?iron(ctx,ore,a):gold(ctx,ore,a))
    sprite={image,outline};sprites.set(ore,sprite)
  }
  const x=(ore.col+.5)*CONFIG.tile+ore.offsetX,y=(ore.row+.5)*CONFIG.tile+ore.offsetY
  g.drawImage(sprite.image,x-32,y-32,64,64)
  g.save();g.translate(x,y);g.clip(sprite.outline)
  const wear=1-ore.hp/ore.maxHp
  if(wear>.2){seam(g,[[-8,-6],[-3,-2],[-5,3],[0,7],[-1,13]],`rgba(29,23,28,${wear*.8})`,1)}
  if(ore.flash>0){g.globalAlpha=ore.flash/CONFIG.mine.hitFlash*.32;g.fillStyle=a.hi;g.fill(sprite.outline)}
  if(form==='gold'){const pulse=Math.sin(time*2.6+ore.col+ore.row*1.7);if(pulse>.87){g.globalAlpha=(pulse-.87)*4;g.fillStyle='#fff0ba';g.fillRect(.5,10,1.3,1.3)}}
  g.restore()
}

/** 岩石材质各自拥有轮廓：块状花岗岩、层理砂岩与片状板岩。 */
export function drawSceneStone(g:CanvasRenderingContext2D,ore:OreTile):void{
  const x=(ore.col+.5)*CONFIG.tile+ore.offsetX,y=(ore.row+.5)*CONFIG.tile+ore.offsetY,h=hash2(ore.col*3,ore.row*7)
  if(drawMineStone(g,ore.rockMat,x,y,.97+h*.06))return
  g.save();g.translate(x,y);g.scale(.94+hash2(ore.row*7,ore.col)*.09,.94+h*.07);g.lineJoin='round';g.lineCap='round'
  g.fillStyle='#211c2540';g.beginPath();g.ellipse(0,17,22,5,0,0,Math.PI*2);g.fill()
  if(ore.rockMat===0){
    const outline=path([[-19,-3],[-14,-15],[-3,-18],[11,-14],[19,-3],[20,8],[8,17],[-10,15],[-20,6]])
    g.fillStyle='#777780';g.fill(outline);g.save();g.clip(outline)
    face(g,[[-19,-3],[-14,-15],[-3,-18],[11,-14],[4,-5],[-8,-3]],'#aaa59b')
    face(g,[[4,-5],[11,-14],[19,-3],[20,8],[8,17],[1,5]],'#545462')
    face(g,[[-20,6],[-8,1],[1,5],[8,17],[-10,15]],'#676674')
    grain(g,ore,22,'#ddd3b74d','#39364455');seam(g,[[-2,-2],[-5,3],[-2,6],[-5,11]],'#46424e',1)
    g.restore();g.strokeStyle='#302b38';g.lineWidth=1.3;g.stroke(outline);seam(g,[[-12,-13],[-3,-15],[3,-13]],'#d5cbb755',.8)
  }else if(ore.rockMat===1){
    const outline=path([[-22,2],[-19,-7],[-8,-13],[9,-12],[20,-5],[22,7],[13,15],[-6,17],[-20,10]])
    g.fillStyle='#a08a6e';g.fill(outline);g.save();g.clip(outline)
    face(g,[[-23,3],[-7,1],[22,-1],[24,18],[-23,18]],'#806b55')
    face(g,[[-20,-7],[-8,-13],[9,-12],[20,-5],[6,-4],[-8,-5]],'#b6a084')
    for(let i=0;i<4;i++)seam(g,[[-21,1+i*3.1],[-8,-1+i*3.1],[4,i*3.1],[20,-2+i*3.1]],i%2?'#c6ac804d':'#5b483b80',i%2?.65:1.1)
    grain(g,ore,24,'#d8bf9844','#64514055');seam(g,[[4,-9],[0,-5],[3,-2],[1,2]],'#715841',.8)
    g.restore();g.strokeStyle='#433638';g.lineWidth=1.3;g.stroke(outline)
  }else{
    face(g,[[-21,6],[-9,-1],[20,5],[17,15],[-8,17],[-22,12]],'#404854',true)
    face(g,[[-21,6],[-9,-1],[20,5],[-4,11],[-18,10]],'#79838b')
    face(g,[[-17,-4],[-1,-14],[21,-7],[22,2],[-1,10],[-19,4]],'#505b69',true)
    face(g,[[-17,-4],[-1,-14],[21,-7],[2,2],[-19,1]],'#909ba0')
    face(g,[[-12,-13],[2,-19],[15,-13],[10,-4],[-10,0],[-17,-5]],'#626f7b',true)
    face(g,[[-12,-13],[2,-19],[15,-13],[-1,-7],[-17,-5]],'#a1abad')
    seam(g,[[-10,-12],[1,-16],[7,-14]],'#d0d5c455',.8)
    seam(g,[[-14,1],[1,5],[14,0]],'#b7c2c055',.7)
    seam(g,[[-14,11],[-6,13],[10,10]],'#949eac',.6)
  }
  const chipX=h>.5?18:-17
  face(g,[[chipX-3,15],[chipX,13],[chipX+4,16],[chipX+1,18]],ore.rockMat===1?'#9a8268':'#737881')
  g.restore()
}
