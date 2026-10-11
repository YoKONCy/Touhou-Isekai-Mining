import { svgIcon, type ItemDef } from '../../types'
import { CLEAVER_ID } from '../ids'
import { stats as rustyKnife } from './swordRusty/stats'

/** 共用短刀数值底板，只覆盖伤害与暴击；击杀被动不继承破伤风效果。 */
const cleaver:ItemDef={
  ...rustyKnife,id:CLEAVER_ID,kind:'weapon',grade:1,
  combat:{...rustyKnife.combat,critChance:.04},
  melee:{...rustyKnife.melee,damage:23},
  color:'#777d87',hi:'#d0cbbb',text:'#d3c0a0',tags:['weapon','sword','cleaver'],
  icon:svgIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><g transform="rotate(38 24 24)" stroke="#302a32" stroke-width="1.5" stroke-linejoin="round"><path d="M12 6L32 7L32 29L27 30L12 28Z" fill="#90969c"/><path d="M12 6L16 7L16 26L27 28L27 30L12 28Z" fill="#d2cfc3" stroke="none"/><path d="M17 8L30 9L30 26L19 24Z" fill="#727b87" stroke="none"/><path d="M18 10L28 11M19 13L23 13" stroke="#b7b9b4" stroke-width=".8"/><circle cx="27" cy="12" r="2.1" fill="#33303c"/><path d="M27 29L32 29L33 42Q30 45 27 42Z" fill="#76543b"/><path d="M28 32L31 33M28 38L31 39" stroke="#b29265" stroke-width="1"/><circle cx="30" cy="34" r=".9" fill="#d6bd87" stroke="none"/><circle cx="30" cy="41" r=".9" fill="#d6bd87" stroke="none"/></g></svg>'),
  weapon:{
    combo:true,legacyHeld:true,
    killDropPassive:{chanceMultiplier:1.4,nameKey:'skill.cleaver.name',descriptionKey:'skill.cleaver.desc'},
    drawHeld(g){
      g.save();g.lineJoin='round';g.strokeStyle='#2c2630';g.lineWidth=1.1
      g.fillStyle='#76513a';g.beginPath();g.moveTo(-7,-1.9);g.lineTo(3,-1.6);g.lineTo(3,1.6);g.lineTo(-7,1.9);g.closePath();g.fill();g.stroke()
      g.fillStyle='#cab28b';g.fillRect(-4,-.7,1.2,1.2);g.fillRect(0,-.6,1,1)
      // 柄轴贴近钝厚刀背，宽刃向另一侧展开，握点仍在手心。
      g.translate(0,5)
      g.beginPath();g.moveTo(3,-6.5);g.lineTo(20,-6);g.lineTo(21,3.7);g.lineTo(17,6.5);g.lineTo(3,5.7);g.closePath();g.fillStyle='#9398a0';g.fill();g.stroke()
      g.fillStyle='#6b7482';g.beginPath();g.moveTo(6,-4.8);g.lineTo(18,-4.3);g.lineTo(19,3.3);g.lineTo(6,2.7);g.closePath();g.fill()
      g.strokeStyle='#d1cdbb';g.lineWidth=1.2;g.beginPath();g.moveTo(4,4.3);g.lineTo(17,5);g.lineTo(20,3);g.stroke()
      g.fillStyle='#302a36';g.beginPath();g.arc(17,-3,1.2,0,Math.PI*2);g.fill()
      g.strokeStyle='#b8bab4';g.lineWidth=.65;g.beginPath();g.moveTo(7,-4);g.lineTo(12,-3.8);g.stroke();g.restore()
    }
  }
}
export default cleaver
