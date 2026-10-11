import { svgIcon,type ItemDef } from '../../types'
import { SWORD_SILVER_ID } from '../ids'
import steelSword from './swordSteel'

function drawSilverSword(g:CanvasRenderingContext2D):void {
  g.save();g.lineJoin='round';g.strokeStyle='#424552';g.lineWidth=1
  g.fillStyle='#b9bec8';g.fillRect(-7,-2,3,4);g.strokeRect(-7,-2,3,4)
  g.fillStyle='#464658';g.fillRect(-4,-1.8,7,3.6);g.strokeRect(-4,-1.8,7,3.6)
  g.strokeStyle='#adb0c2';g.beginPath();for(let x=-3;x<2;x+=2){g.moveTo(x,-1.4);g.lineTo(x+1,1.4)}g.stroke()
  g.fillStyle='#c2c7d2';g.strokeStyle='#424552';g.fillRect(2,-6,2.8,12);g.strokeRect(2,-6,2.8,12)
  g.beginPath();g.moveTo(5,-2.6);g.lineTo(32,-1.8);g.lineTo(40,0);g.lineTo(32,1.8);g.lineTo(5,2.6);g.closePath();g.fillStyle='#dbe1e7';g.fill();g.stroke()
  g.beginPath();g.moveTo(5,0);g.lineTo(40,0);g.lineTo(32,1.8);g.lineTo(5,2.6);g.closePath();g.fillStyle='#98a2b6';g.fill()
  g.strokeStyle='#fff4e5';g.lineWidth=.85;g.beginPath();g.moveTo(6,-2);g.lineTo(32,-1.3);g.lineTo(38,0);g.stroke()
  g.strokeStyle='#777b99';g.lineWidth=.6;g.beginPath();g.moveTo(8,0);g.lineTo(31,0);g.stroke();g.restore()
}

const silverSword:ItemDef={
  ...steelSword,id:SWORD_SILVER_ID,color:'#b9c2d1',hi:'#f3eee2',text:'#dce1ea',
  combat:{...steelSword.combat,critChance:.05,penetration:.5,magicPenetration:1},
  melee:{...steelSword.melee!,damage:23},tags:['weapon','sword','silver'],
  weapon:{...steelSword.weapon,drawHeld:drawSilverSword,physicalToMagic:.25,
    skillDescriptions:{summaryKey:'weapon.silver.conversion.name',effects:[{nameKey:'weapon.silver.conversion.name',descriptionKey:'weapon.silver.conversion.effect'}]}},
  ground:({ctx,x,y})=>{ctx.save();ctx.translate(x,y);ctx.rotate(-.7);ctx.scale(.55,.55);ctx.translate(-15,0);drawSilverSword(ctx);ctx.restore()},
  icon:svgIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><g transform="rotate(35 24 24)" stroke="#424552" stroke-width="1.2" stroke-linejoin="round"><path d="M24 1L28 8L27 33H21L20 8Z" fill="#dbe1e7"/><path d="M24 2L27 8L26 32H24Z" fill="#98a2b6" stroke="none"/><path d="M22 9V30" stroke="#fff4e5"/><path d="M24 9V31" stroke="#777b99" stroke-width=".7"/><path d="M15 32H33L34 36L27 35H21L14 36Z" fill="#c2c7d2"/><path d="M22 35H26V43H22Z" fill="#464658"/><path d="M22 36L26 37M22 39L26 40M22 42L26 43" stroke="#adb0c2"/><path d="M21 43H27V46H21Z" fill="#b9bec8"/></g></svg>')
}
export default silverSword
