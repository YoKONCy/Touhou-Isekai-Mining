import { svgIcon } from '../../../types'
import { addItemCelStop } from '../../../itemArt'

/** 弓身和箭沿手心 +x 瞄准，弓弦中心后拉量与副手握点相同。 */
export function drawWoodBow(g:CanvasRenderingContext2D,progress=0,nocked=false,iron=false,pullDistance?:number,releaseProgress?:number,charged=false):void {
  g.save();g.lineJoin='round';g.lineCap='round'
  const p=Math.max(0,Math.min(1,progress)),pull=pullDistance??p*8.5,tip=-7.5-p*2,height=16-p*1.8
  const vibration=releaseProgress===undefined?0:Math.sin(releaseProgress*Math.PI*8)*Math.exp(-releaseProgress*5)*1.6
  const wood=g.createLinearGradient(0,-16,9,16);addItemCelStop(wood,0,'#d4ae75');addItemCelStop(wood,.4,'#a87b50');addItemCelStop(wood,1,'#75503b')
  // 单条连续弧线，中点恰好为手心原点；弓弦始终位于弓身后方。
  g.strokeStyle='#332538';g.lineWidth=3.2;g.beginPath();g.moveTo(tip,-height);g.quadraticCurveTo(-tip,0,tip,height);g.stroke()
  g.strokeStyle=wood;g.lineWidth=2;g.stroke();g.strokeStyle='#eed1a0';g.lineWidth=.5;g.beginPath();g.moveTo(tip-.35,-height+.5);g.quadraticCurveTo(-tip-.4,0,tip-.35,height-.5);g.stroke()
  g.strokeStyle=charged&&nocked?'#f0d9a7':'#d8c49c';g.lineWidth=.7;g.beginPath();g.moveTo(tip,-height);g.lineTo(-7.5-pull+vibration,0);g.lineTo(tip,height);g.stroke()
  g.strokeStyle='#6b5254';g.lineWidth=2.9;g.beginPath();g.moveTo(0,-2.3);g.lineTo(0,2.3);g.stroke()
  g.strokeStyle='#b19b7a';g.lineWidth=.5;for(let i=0;i<4;i++){g.beginPath();g.moveTo(-1,-2+i);g.lineTo(1,-1.7+i);g.stroke()}
  if(nocked){g.save();g.translate(6.5-pull,0);drawArrow(g,iron);g.restore()}
  if(charged&&nocked){g.strokeStyle='#f3deb0';g.lineWidth=.65;for(const sign of [-1,1]){g.beginPath();g.moveTo(-3,sign*4);g.lineTo(-4.5,sign*6);g.stroke()}}
  g.restore()
}
export function drawArrow(g:CanvasRenderingContext2D,iron:boolean):void {
  g.save();g.strokeStyle='#3b2b30';g.lineWidth=2.1;g.beginPath();g.moveTo(-14,0);g.lineTo(12,0);g.stroke()
  g.strokeStyle='#c19a68';g.lineWidth=1.05;g.stroke()
  g.fillStyle=iron?'#abbcc6':'#aaa39b';g.strokeStyle='#3e3b4b';g.lineWidth=.6
  g.beginPath();g.moveTo(17,0);g.lineTo(9,-2.8);g.lineTo(11,0);g.lineTo(9,2.8);g.closePath();g.fill();g.stroke()
  g.fillStyle=iron?'#deebdf':'#c9bdab';g.beginPath();g.moveTo(16,0);g.lineTo(10,-2);g.lineTo(12,0);g.closePath();g.fill()
  // 两片独立尾羽，后缘平直，前缘顺着箭头方向收拢，不画成反向的第二个箭头。
  for(const sign of [-1,1]){g.fillStyle='#d9c9ad';g.strokeStyle='#8e7760';g.lineWidth=.35;g.beginPath();g.moveTo(-12,sign*.35);g.lineTo(-12,sign*3);g.lineTo(-7,sign*3);g.lineTo(-3,sign*.35);g.closePath();g.fill();g.stroke();for(let i=0;i<3;i++){g.beginPath();g.moveTo(-11+i*2,sign*.5);g.lineTo(-12+i*2,sign*2.7);g.stroke()}}
  g.restore()
}
export const bowIcon=svgIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M18 7Q48 32 18 57" fill="none" stroke="#352934" stroke-width="6" stroke-linecap="round"/><path d="M18 7Q48 32 18 57" fill="none" stroke="#bc8d59" stroke-width="4"/><path d="M17 8Q46 32 17 56" fill="none" stroke="#e9c694" stroke-width="1"/><path d="M18 7V57" stroke="#dfcc9e" stroke-width="1.5"/><path d="M33 28V36" stroke="#65524d" stroke-width="6"/><path d="m30 29 6 .5m-6 1.5 6 .5m-6 1.5 6 .5m-6 1.5 6 .5" stroke="#baa581"/></svg>')
export const arrowIcon=(iron:boolean)=>svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g transform="translate(32 32) rotate(-45)"><path d="M-27 0H18" stroke="#362735" stroke-width="4"/><path d="M-27 0H18" stroke="#be996d" stroke-width="2"/><path d="m29 0-15-6 3 6-3 6Z" fill="${iron?'#a2b6c1':'#9b9489'}" stroke="#3b394b" stroke-width="1.4"/><path d="m28 0-12-4 3 4Z" fill="${iron?'#dfebee':'#c4bcb0'}"/><path d="M-24-1V-6H-15L-8-1ZM-24 1V6H-15L-8 1Z" fill="#e1d3b5" stroke="#8a7662" stroke-width="1"/><path d="m-22-1-2-4m6 4-2-4m6 4-2-4m-6 6-2 4m6-4-2 4m6-4-2 4" stroke="#b29a78"/></g></svg>`)
