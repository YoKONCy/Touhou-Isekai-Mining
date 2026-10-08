import { addItemCelStop } from '../../../itemArt'
import { svgIcon, type GroundDropView } from '../../../types'

let sprite:HTMLCanvasElement|null=null
/** 与铁镐保持相同轮廓，冷银镐头、磨亮刃口和深色握带只烘焙一次。 */
function steelPickSprite():HTMLCanvasElement{
  if(sprite)return sprite
  const canvas=document.createElement('canvas');canvas.width=80;canvas.height=80
  const g=canvas.getContext('2d')!;g.scale(2,2);g.translate(8,20);g.lineJoin='round'
  const wood=g.createLinearGradient(0,-2,0,2)
  addItemCelStop(wood, 0,'#b3946f');addItemCelStop(wood, .4,'#836247');addItemCelStop(wood, 1,'#4e3b30')
  g.fillStyle=wood;g.strokeStyle='#2b282a';g.lineWidth=1
  g.beginPath();g.roundRect(-5,-2,27,4,1);g.fill();g.stroke()
  g.strokeStyle='#5b4537';g.lineWidth=.6;g.beginPath();g.moveTo(-3,.6);g.lineTo(19,.3);g.stroke()
  g.fillStyle='#404a56';g.fillRect(-3,-2.2,12,4.4)
  g.strokeStyle='#919da2';g.lineWidth=.6;for(let x=-2;x<9;x+=2){g.beginPath();g.moveTo(x,-2);g.lineTo(x+1,2);g.stroke()}
  const head=new Path2D('M17-15Q28-7 27 0Q27 9 16 15L21 5 22 0 20-6Z')
  const steel=g.createLinearGradient(17,-12,27,10)
  addItemCelStop(steel, 0,'#e2e8e3');addItemCelStop(steel, .25,'#aabac4');addItemCelStop(steel, .5,'#54687e');addItemCelStop(steel, .8,'#b1c2ca');addItemCelStop(steel, 1,'#4b5f75')
  g.fillStyle=steel;g.fill(head);g.strokeStyle='#303c4a';g.stroke(head)
  g.fillStyle='#758c9d';g.fillRect(18,-3.5,7,7);g.strokeRect(18,-3.5,7,7)
  g.fillStyle='#d8dfda';g.fillRect(19,-3.3,5,.8);g.fillStyle='#37414d';g.fillRect(21,-1.5,1.6,3)
  g.strokeStyle='#edece4';g.lineWidth=.65;g.beginPath();g.moveTo(18,-13);g.quadraticCurveTo(27,-2,24,5);g.moveTo(23,8);g.lineTo(18,13);g.stroke()
  g.strokeStyle='#7f97a9';g.lineWidth=.5;g.beginPath();g.moveTo(22,-8);g.lineTo(24,-6);g.moveTo(23,6);g.lineTo(21,8);g.stroke()
  sprite=canvas;return canvas
}
export function drawSteelPick(g:CanvasRenderingContext2D):void{g.drawImage(steelPickSprite(),-8,-20,40,40)}
export function drawGroundSteelPick({ctx:g,x,y}:GroundDropView):void{
  g.save();g.translate(x,y);g.rotate(-.55);g.scale(.75,.75);g.translate(-10,0);drawSteelPick(g);g.restore()
}

export const STEEL_PICK_ICON=svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><linearGradient id="steel-pick-handle"><stop stop-color="#b79d77"/><stop offset=".35" stop-color="#806044"/><stop offset=".7" stop-color="#a28a64"/><stop offset="1" stop-color="#483829"/></linearGradient><linearGradient id="steel-pick-head" x2=".3" y2="1"><stop stop-color="#e1e8e4"/><stop offset=".3" stop-color="#9facb6"/><stop offset=".55" stop-color="#4a606e"/><stop offset=".8" stop-color="#b4c1c6"/><stop offset="1" stop-color="#364b58"/></linearGradient></defs>
  <path d="m13 55 6 3 24-41-7-4Z" fill="url(#steel-pick-handle)" stroke="#292721" stroke-width="1.8"/>
  <path d="m16 54 21-36" stroke="#d1bd96" stroke-width=".9"/>
  <path d="m14 52 6 3 9-15-6-3Z" fill="#3e4b51" stroke="#29343b" stroke-width=".8"/>
  <path d="m16 49 5 3m-3-6 5 3m-3-6 5 3m-3-6 5 3" stroke="#8a999e" stroke-width=".8"/>
  <path d="M5 24Q19 7 36 9Q47 11 58 26L46 20 37 18 25 18Z" fill="url(#steel-pick-head)" stroke="#26353e" stroke-width="1.8"/>
  <path d="M8 22Q24 11 37 12Q47 15 54 23" fill="none" stroke="#edf0e6" stroke-width="1"/>
  <path d="m24 18 10-6 9 6-4 7-10-4Z" fill="#5a7280" stroke="#293940"/>
  <path d="m29 15 5-1 5 4-4 4-5-3Z" fill="#b2c2c7"/><circle cx="34" cy="18" r="1.6" fill="#303d43"/>
  <path d="m14 20 5-2m24-3 4 3m-7 3 3 2" stroke="#d7e1df" stroke-width=".7"/>
  <path d="m21 16 3 1m22 1 3 3" stroke="#607988" stroke-width=".7"/>
</svg>`)
