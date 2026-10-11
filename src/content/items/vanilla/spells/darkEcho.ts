import { svgIcon,type ItemDef } from '../../types'
import { DARK_ECHO_ID } from '../ids'
import { DARK_ECHO_SLOW } from '../../../statuses/mineBlessings'
import { TAROT_FOOL_SEAL } from '../weapons/tarot/statuses'
import { sfx } from '../../../../game/audio/Sfx'

/** 共用愚者的封印能力，独立计时，避免覆盖已存在的两秒封印。 */
const seal={...TAROT_FOOL_SEAL,id:'touhou:dark_echo_seal',duration:1,nameKey:'status.dark_echo_seal.name',descriptionKey:'status.dark_echo_seal.desc'}

const paper='<path d="M12 5L18 7L22 3L29 6L36 4L34 13L38 18L35 26L38 32L33 36L34 44L26 42L21 46L16 42L10 43L12 34L8 30L11 23L9 17Z" fill="#ddd9cb" stroke="#655f69" stroke-width="1.3"/><path d="M13 8L18 10L22 6L28 9L34 7L31 13L33 18L30 29L33 34L29 36L30 40L25 38L21 42L18 38L14 40L16 32L12 29L15 22L12 17Z" fill="#eeeadb"/><path d="M14 14L19 12L20 18L16 21L22 23M25 12L30 15L27 19L30 23M17 27L21 25L24 29L19 33L23 37M28 26L31 30L27 33L29 37M13 24L15 26M23 10L24 12M15 35L16 37" fill="none" stroke="#5b4f67" stroke-width="1.3"/><path d="M14 11L16 12M31 38L29 40M12 31L14 32M32 10L30 12" stroke="#b5aea5" stroke-width=".8"/>'

/** 雾从敌人体内喷散；几何层叠代替逐帧模糊滤镜。 */
function burst(g:CanvasRenderingContext2D,v:{x:number;y:number;age:number;duration:number;seed:number}):void {
  const k=Math.min(1,v.age/v.duration),ease=1-Math.pow(1-k,3),fade=Math.min(1,k*9)*Math.pow(1-k,1.3)
  g.save();g.translate(v.x,v.y)
  for(let i=0;i<7;i++){
    const a=v.seed+i*2.399,reach=(10+i%3*9)*ease,r=(9+i%3*4)*( .35+ease)
    g.globalAlpha=fade*(.48-i*.035);g.fillStyle=i%2?'#282031':'#100e1b'
    g.beginPath();g.ellipse(Math.cos(a)*reach,Math.sin(a)*reach*.75-k*13,r,r*.8,a,0,Math.PI*2);g.fill()
  }
  g.globalCompositeOperation='lighter';g.lineWidth=1.6
  for(let i=0;i<3;i++){
    const u=Math.max(0,k-i*.09),r=8+u*65
    g.globalAlpha=fade*(1-i*.2);g.strokeStyle=i===0?'#c2accd':'#8b709f'
    g.beginPath();g.ellipse(0,-k*7,r,r*.5,-.15,0,Math.PI*2);g.stroke()
  }
  g.restore()
}

function channel(g:CanvasRenderingContext2D,v:{x:number;y:number;progress:number;time:number}):void {
  const k=v.progress
  g.save();g.translate(v.x,v.y-18)
  g.strokeStyle='#a390bd';g.globalAlpha=.35+.5*k;g.lineWidth=1.4
  g.beginPath();g.ellipse(0,16,32-14*k,12-5*k,0,0,Math.PI*2);g.stroke()
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3+v.time*3,r=27-16*k
    g.beginPath();g.moveTo(Math.cos(a)*r,Math.sin(a)*r*.7);g.lineTo(Math.cos(a)*(r+7),Math.sin(a)*(r+7)*.7);g.stroke()
  }
  g.translate(0,-8-10*k);g.rotate(-.12+.2*k);g.scale(.48,.48);g.translate(-24,-24)
  g.globalAlpha=.65+.35*k
  // 引导中的书页与物品图标共用纸张、符文造型。
  g.fillStyle='#e0dccc';g.strokeStyle='#6d5a7b';g.lineWidth=2
  g.beginPath();g.moveTo(12,5);g.lineTo(23,8);g.lineTo(36,4);g.lineTo(34,23);g.lineTo(38,32);g.lineTo(30,44);g.lineTo(21,41);g.lineTo(10,44);g.lineTo(13,25);g.closePath();g.fill();g.stroke()
  for(let i=0;i<3;i++){const y=14+i*8;g.beginPath();g.moveTo(17,y);g.lineTo(23,y-3);g.lineTo(21,y+4);g.lineTo(30,y+1);g.stroke()}
  g.restore()
}

const def:ItemDef={
  id:DARK_ECHO_ID,kind:'spellcard',equipSlot:'spellA',grade:2,maxStack:1,tags:['spellcard'],
  color:'#b6a6c6',hi:'#e7dfec',text:'#cfbfdf',icon:svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${paper}</svg>`),
  spell:{manaCost:60,cooldown:20,channelTime:.4,scope:'room',radius:0,damage:0,knockback:0,stun:0,clearBullets:false,color:'#9a80b0',
    control:{duration:1,bulletSpeedMultiplier:.2,enemyEffects:[DARK_ECHO_SLOW,seal]},
    channelDraw:channel,targetFx:{duration:.7,render:burst},sound:()=>sfx.darkEcho()}
}
export default def
