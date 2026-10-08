import { addItemCelStop } from '../../../itemArt'
import { svgIcon, type GroundDropView } from '../../../types'
import { drawStoneSpear, SPEAR_LENGTH_SCALE } from '../spearStone/appearance'

let tipSprite:HTMLCanvasElement|null=null
/** 铁尖单独烘焙，与石矛共用原有木杆和握带缓存。 */
function ironTip():HTMLCanvasElement{
  if(tipSprite)return tipSprite
  const canvas=document.createElement('canvas');canvas.width=72;canvas.height=36
  const g=canvas.getContext('2d')!;g.scale(2,2);g.translate(-51,9);g.lineJoin='round'
  const socket=g.createLinearGradient(0,-3,0,3)
  addItemCelStop(socket, 0,'#c7c6c4');addItemCelStop(socket, .3,'#939fa6');addItemCelStop(socket, .65,'#576678');addItemCelStop(socket, 1,'#37404d')
  g.fillStyle=socket;g.strokeStyle='#323945';g.lineWidth=.8;g.beginPath();g.moveTo(53,-2.9);g.lineTo(66,-3.2);g.lineTo(67,3.1);g.lineTo(53,2.8);g.closePath();g.fill();g.stroke()
  g.strokeStyle='#cec7ab';g.lineWidth=.7;g.beginPath();g.moveTo(55,-2.8);g.lineTo(55,2.6);g.moveTo(59,-3);g.lineTo(59,2.8);g.stroke()
  g.fillStyle='#39414d';g.beginPath();g.ellipse(61,-.4,1,.8,0,0,Math.PI*2);g.fill()
  // 对称叶形锻铁尖，以中脊与窄亮刃代替石片的缺口断面。
  g.beginPath();g.moveTo(63,0);g.lineTo(69,-5.9);g.quadraticCurveTo(78,-4.3,84,0);g.quadraticCurveTo(78,4.3,69,5.9);g.closePath()
  g.fillStyle='#83939e';g.fill();g.strokeStyle='#333b48';g.lineWidth=1;g.stroke()
  g.beginPath();g.moveTo(64,0);g.lineTo(69,-5.2);g.quadraticCurveTo(77,-3.7,83,0);g.closePath();g.fillStyle='#c5cfce';g.fill()
  g.beginPath();g.moveTo(65,.4);g.lineTo(83,0);g.quadraticCurveTo(77,3.7,69,5.1);g.closePath();g.fillStyle='#506276';g.fill()
  g.strokeStyle='#e2e5d1';g.lineWidth=.65;g.beginPath();g.moveTo(69,-5.1);g.quadraticCurveTo(77,-3.7,82.5,-.3);g.moveTo(65,0);g.lineTo(82.5,0);g.stroke()
  g.strokeStyle='#859caa';g.lineWidth=.6;g.beginPath();g.moveTo(69,4.7);g.quadraticCurveTo(77,3.5,82,.5);g.stroke()
  g.strokeStyle='#89969b';g.lineWidth=.4;g.beginPath();g.moveTo(71,-3.7);g.lineTo(73,-2.2);g.moveTo(75,-2.7);g.lineTo(77,-1.6);g.stroke()
  tipSprite=canvas;return canvas
}

export function drawIronSpear(g:CanvasRenderingContext2D):void{
  // 裁去原石尖，只复用杆身；铁套覆盖接缝，不留下石片或断杆。
  g.save();g.beginPath();g.rect(-32*SPEAR_LENGTH_SCALE,-10,88*SPEAR_LENGTH_SCALE,20);g.clip();drawStoneSpear(g);g.restore()
  g.drawImage(ironTip(),51*SPEAR_LENGTH_SCALE,-9,36*SPEAR_LENGTH_SCALE,18)
}
export function drawGroundIronSpear({ctx:g,x,y}:GroundDropView):void{
  g.save();g.translate(x,y);g.rotate(-.45);g.scale(.55,.55);g.translate(-28*SPEAR_LENGTH_SCALE,0);drawIronSpear(g);g.restore()
}

export const IRON_SPEAR_ICON=svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><linearGradient id="iron-spear-wood" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#c0a17a"/><stop offset=".4" stop-color="#8d6746"/><stop offset="1" stop-color="#50392c"/></linearGradient></defs>
  <g transform="translate(15 49) rotate(-45) scale(${SPEAR_LENGTH_SCALE} 1)" stroke-linejoin="round">
    <path d="M-3-2 45-2.4 46 2.4-3 2Z" fill="url(#iron-spear-wood)" stroke="#29221e" stroke-width="1.4"/>
    <path d="M0-1 16-1M28-1 39-1" stroke="#dbc399" stroke-width=".7"/>
    <path d="M17-2.6H29V2.6H17Z" fill="#554031"/><path d="m18-2 1.5 4m2-4 1.5 4m2-4 1.5 4m2-4 1.5 4" stroke="#b29b76" stroke-width="1"/>
    <path d="M40-3H49V3H40Z" fill="#71838b" stroke="#293137" stroke-width="1.2"/>
    <path d="M40-2.7H49M42-2.7V2.6M46-2.7V2.6" stroke="#c9cbbb" stroke-width=".8"/><circle cx="47" cy=".2" r=".8" fill="#2c3940"/>
    <path d="M47 0L52-6.8Q59-4.9 65 0Q59 4.9 52 6.8Z" fill="#7c8d97" stroke="#29343b" stroke-width="1.3"/>
    <path d="M48 0L52-5.9Q59-4.2 64 0Z" fill="#c6cfcb"/><path d="M48 .4 64 0Q59 4.2 52 5.9Z" fill="#475b68"/>
    <path d="M52-5.9Q59-4.2 64-.3M48 0H63" fill="none" stroke="#e1e5da" stroke-width=".8"/>
    <path d="M52 5.8Q59 4.2 63 .6" fill="none" stroke="#9aadb0" stroke-width=".6"/>
    <path d="m-1-2 1 4m1-4 1 4" stroke="#b8a17b" stroke-width="1"/>
  </g>
</svg>`)
