import { addItemCelStop } from '../../../itemArt'
import { svgIcon, type GroundDropView } from '../../../types'

/** 同一组轮廓同时供手持贴图和物品图标使用，刀尖、锯齿与握柄的位置保持一致。 */
const BLADE_OUTLINE='M-6-2.6L-10-3L-13-3.2L-19.6-3.4L-24-1.8L-27 .1L-23.1 2.25L-16 3.5L-12.3 3.35L-11.7 2.55L-10.9 3.25L-10.3 2.45L-9.5 3.13L-8.9 2.35L-8.1 3L-7.5 2.2L-6 2.45Z'
const BLADE_HOLE='M-19.1-.25a1.7 .65 0 1 0 3.4 0a1.7 .65 0 1 0-3.4 0Z'
const EDGE='M-6 1.55L-8.2 1.45L-12.3 2L-16 2.3L-23.1 1.55L-26.4 .1L-23.1 2.25L-16 3.5L-12.3 3.35L-11.7 2.55L-10.9 3.25L-10.3 2.45L-9.5 3.13L-8.9 2.35L-8.1 3L-7.5 2.2L-6 2.45Z'
const GUARD='M-6-3.9L-4.4-4.2L-3.2-2.8L-3.4 2.6L-4.5 4.1L-6 3.6L-5.3 1.6L-5.7-2Z'
const GRIP='M-3.4-2.15L3.2-2.4L5.8-1.8L6.4-1.2L6.4 1.7L3.3 2.4L-.6 2.2Q-2.2 3.05-3.4 2.15Z'
const INLAY='M-2-1.3L3.8-1.3L4.6-.65L4.4 1.1L-1.4 1.35Z'
const POMMEL='M5.4-2.3L7.5-2.2L8.1-1L8.1 1.6L6.3 2.6L5.4 2.3Z'
let sprite:HTMLCanvasElement|null=null
/** 反手握点及原有外形尺寸保持一致；涂层刀身只在磨开的刃沿反光。 */
function daggerSprite():HTMLCanvasElement{
  if(sprite)return sprite
  const canvas=document.createElement('canvas');canvas.width=160;canvas.height=64
  const g=canvas.getContext('2d')!;g.scale(4,4);g.translate(30,8);g.lineJoin='round'
  const blade=new Path2D(BLADE_OUTLINE+' '+BLADE_HOLE),steel=g.createLinearGradient(0,-3.5,0,3.5)
  addItemCelStop(steel, 0,'#6a7783');addItemCelStop(steel, .3,'#3e4857');addItemCelStop(steel, .68,'#323b49');addItemCelStop(steel, 1,'#5c6975')
  g.fillStyle=steel;g.fill(blade,'evenodd');g.strokeStyle='#2c3642';g.lineWidth=.75;g.stroke(blade)
  g.save();g.clip(blade,'evenodd')
  g.fillStyle='#bac5c3';g.fill(new Path2D(EDGE))
  g.strokeStyle='#e1e5d1';g.lineWidth=.45;g.beginPath();g.moveTo(-12.7,3.12);g.lineTo(-16,3.15);g.lineTo(-23,1.95);g.lineTo(-26.3,.2);g.stroke()
  // 浅槽、短刃背的擦痕与冲压小记号，保持哑光而非整片银亮。
  g.fillStyle='#2f3a47';g.beginPath();g.roundRect(-14.5,-1.35,6.2,.95,.32);g.fill()
  g.strokeStyle='#8d9d9f';g.lineWidth=.4;g.beginPath();g.moveTo(-14,-1.3);g.lineTo(-8.7,-1.3);g.stroke()
  g.strokeStyle='#b4c0bb77';g.lineWidth=.4;g.beginPath();g.moveTo(-19.5,-3);g.lineTo(-14.1,-2.75);g.moveTo(-23,-1.35);g.lineTo(-21.8,-1.7);g.stroke()
  g.strokeStyle='#939fa166';g.lineWidth=.35;g.beginPath();g.moveTo(-7.5,-.8);g.lineTo(-7.5,-.05);g.moveTo(-8.3,-.65);g.lineTo(-8.3,-.05);g.stroke()
  g.restore()
  g.fillStyle='#5b6972';g.strokeStyle='#2c3742';g.lineWidth=.7;g.fill(new Path2D(GUARD));g.stroke(new Path2D(GUARD))
  g.strokeStyle='#c0c4c0';g.lineWidth=.45;g.beginPath();g.moveTo(-5.7,-3.55);g.lineTo(-4.6,-3.7);g.moveTo(-5.6,3.35);g.lineTo(-4.6,3.5);g.stroke()
  g.fillStyle='#53654f';g.fill(new Path2D(GRIP));g.strokeStyle='#313e35';g.lineWidth=.7;g.stroke(new Path2D(GRIP))
  g.fillStyle='#324038';g.fill(new Path2D(INLAY));g.strokeStyle='#687268';g.lineWidth=.45;g.stroke(new Path2D(INLAY))
  // 注塑防滑筋和嵌入式紧固件代替旧式缠布纹理。
  g.strokeStyle='#838982';g.lineWidth=.55
  for(const x of [-1.1,.6,2.3,4]){g.beginPath();g.moveTo(x,-1.9);g.lineTo(x,-1.25);g.moveTo(x,1.25);g.lineTo(x+.15,1.9);g.stroke()}
  g.fillStyle='#6a706b';for(let i=0;i<9;i++)g.fillRect(-.55+(i%3)*1.15,-.65+Math.floor(i/3)*.52,.25,.22)
  for(const x of [-2.35,4.8]){g.fillStyle='#adb0ab';g.beginPath();g.arc(x,.05,.42,0,Math.PI*2);g.fill();g.strokeStyle='#39483e';g.lineWidth=.3;g.beginPath();g.moveTo(x-.2,-.12);g.lineTo(x+.2,.2);g.stroke()}
  g.fillStyle='#849292';g.fill(new Path2D(POMMEL));g.strokeStyle='#314345';g.lineWidth=.65;g.stroke(new Path2D(POMMEL))
  g.fillStyle='#314443';g.beginPath();g.ellipse(6.9,.15,.66,.78,0,0,Math.PI*2);g.fill();g.strokeStyle='#b7bbb5';g.lineWidth=.35;g.stroke()
  sprite=canvas;return canvas
}
export function drawAssaultDagger(g:CanvasRenderingContext2D):void{g.drawImage(daggerSprite(),-30,-8,40,16)}
export function drawGroundAssaultDagger({ctx:g,x,y}:GroundDropView):void{
  g.save();g.translate(x,y);g.rotate(-.7);g.translate(9,0);drawAssaultDagger(g);g.restore()
}
const gripRibs=[-1.1,.6,2.3,4].map(x=>'<path d="M'+x+'-1.9V-1.25M'+x+' 1.25l.15 .65"/>').join('')
const fasteners=[-2.35,4.8].map(x=>'<circle cx="'+x+'" cy=".05" r=".42" fill="#99a395"/><path d="M'+(x-.2)+'-.12 '+(x+.2)+' .2" stroke="#324339" stroke-width=".3"/>').join('')
export const ASSAULT_DAGGER_ICON=svgIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'+
  '<defs><linearGradient id="assault-dagger-tactical" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#657178"/><stop offset=".3" stop-color="#3b4852"/><stop offset=".68" stop-color="#29343c"/><stop offset="1" stop-color="#4f5b62"/></linearGradient></defs>'+
  '<g transform="translate(42 41) rotate(45) scale(1.4)" stroke-linejoin="round">'+
  '<path d="'+BLADE_OUTLINE+' '+BLADE_HOLE+'" fill="url(#assault-dagger-tactical)" fill-rule="evenodd" stroke="#202b32" stroke-width=".75"/>'+
  '<path d="'+EDGE+'" fill="#b1bdb9"/><path d="M-12.7 3.12-16 3.15-23 1.95-26.3 .2" fill="none" stroke="#e0e3d6" stroke-width=".45"/>'+
  '<rect x="-14.5" y="-1.35" width="6.2" height=".95" rx=".32" fill="#24323a"/><path d="M-14-1.3H-8.7M-19.5-3-14.1-2.75M-23-1.35-21.8-1.7" fill="none" stroke="#82928f" stroke-width=".4"/>'+
  '<path d="'+GUARD+'" fill="#4d5b5e" stroke="#202d32" stroke-width=".7"/><path d="M-5.7-3.55-4.6-3.7M-5.6 3.35-4.6 3.5" fill="none" stroke="#b7c1b5" stroke-width=".45"/>'+
  '<path d="'+GRIP+'" fill="#4a5b47" stroke="#25332b" stroke-width=".7"/><path d="'+INLAY+'" fill="#273730" stroke="#63755c" stroke-width=".45"/>'+
  '<g fill="none" stroke="#71806a" stroke-width=".55">'+gripRibs+'</g>'+fasteners+
  '<path d="'+POMMEL+'" fill="#74817b" stroke="#293b39" stroke-width=".65"/><ellipse cx="6.9" cy=".15" rx=".66" ry=".78" fill="#293c36" stroke="#a9b3a3" stroke-width=".35"/>'+
  '</g></svg>')
