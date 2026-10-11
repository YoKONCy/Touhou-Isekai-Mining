import { svgIcon, type ItemDef } from '../../../types'
import { RANGER_BOW_ID, IRON_ARROW_ID } from '../../ids'
import woodBow from '../bowWood'
import { drawWoodBow } from '../bowWood/appearance'

/** 复用木弓的握点、拉弦、蓄力与收势，只替换弓臂材质和连续满蓄力能力。 */
const rangerBow:ItemDef={
  ...woodBow,id:RANGER_BOW_ID,grade:2,
  color:'#8a7958',hi:'#c9d4a5',text:'#becb9d',
  combat:{...woodBow.combat,critChance:.08},
  ranged:{...woodBow.ranged,damage:9,attackInterval:.2,accuracyPenalty:0,
    bowTiming:{drawDuration:.18,recoverDuration:.12,intervalIncludesCharge:true},
    charge:{...woodBow.ranged.charge,duration:.28,autoRelease:true,nameKey:'skill.ranger_bow.charge.name',descriptionKey:'skill.ranger_bow.charge.desc'},
    chargedFinisher:{count:3,damageMultiplier:3,speedMultiplier:3,damageKind:'magic',pierceObstacles:true,pierceEnemies:true,nameKey:'skill.ranger_bow.finisher.name',descriptionKey:'skill.ranger_bow.finisher.desc'}},
  weapon:{...woodBow.weapon,autoRepeat:true,drawHeld:(g,v)=>drawWoodBow(g,v.drawProgress??0,v.ammoNocked??false,v.ammunitionId===IRON_ARROW_ID,v.bowPull,v.bowReleaseProgress,v.bowCharged,true)},
  icon:svgIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g stroke-linejoin="round" stroke-linecap="round"><path d="M17 6L22 10L25 16L31 21L33 28L34 33L32 39L29 45L24 49L22 54L17 58" fill="none" stroke="#302d34" stroke-width="6"/><path d="M17 6L22 10L25 16L31 21L33 28L34 33L32 39L29 45L24 49L22 54L17 58" fill="none" stroke="#8a7856" stroke-width="4"/><path d="M18 7L22 12L26 18M32 24L33 28M29 44L24 48L20 55" fill="none" stroke="#d0bb8c" stroke-width="1"/><path d="M17 6V58" stroke="#ded2ad" stroke-width="1.2"/><path d="M33 29V36" stroke="#55483b" stroke-width="5"/><path d="M31 30L35 31M31 33L35 34" stroke="#b6a17b"/><path d="M24 15Q14 15 13 6Q24 5 24 15ZM29 21Q39 20 40 14Q30 13 29 21ZM28 46Q38 44 39 51Q30 54 28 46ZM21 54Q14 50 12 55Q15 61 21 54Z" fill="#879c63" stroke="#374536" stroke-width="1"/><path d="M23 14L16 8M30 20L37 16M30 47L36 50M20 54L15 55" stroke="#bdcd96" stroke-width=".7"/><ellipse cx="26" cy="18" rx="1.2" ry="2" fill="#574a38"/><ellipse cx="25" cy="49" rx="1" ry="1.5" fill="#574a38"/></g></svg>'),
  ground:({ctx,x,y})=>{ctx.save();ctx.translate(x,y);ctx.rotate(-.4);ctx.scale(.6,.6);drawWoodBow(ctx,0,false,false,undefined,undefined,false,true);ctx.restore()},
  tags:['weapon','ranged','bow','wood']
}
export default rangerBow
