import type { ItemDef } from '../../../types'
import { WOOD_BOW_ID,IRON_ARROW_ID } from '../../ids'
import { bowIcon,drawWoodBow } from './appearance'

export default {
  id:WOOD_BOW_ID,kind:'weapon',rarity:1,tier:1,maxStack:1,equipSlot:'weaponA',
  color:'#a47b50',hi:'#e2c18d',text:'#d6bc90',icon:bowIcon,
  combat:{critChance:.05,penetration:5},
  ranged:{type:'bow',damage:16,damageKind:'physical',attackInterval:.6,speed:720,accuracyPenalty:0,knockback:10,stun:0,ammoFamily:'arrow',
    charge:{duration:.75,damageMultiplier:1.5,speedMultiplier:1.5,accuracyCorrection:3,nameKey:'item.touhou:wood_bow.charge.name',descriptionKey:'item.touhou:wood_bow.charge.desc'}},
  weapon:{autoRepeat:false,combo:false,drawHeld:(g,v)=>drawWoodBow(g,v?.drawProgress??0,v?.ammoNocked??false,v?.ammunitionId===IRON_ARROW_ID,v?.bowPull,v?.bowReleaseProgress,v?.bowCharged)},
  ground:({ctx,x,y})=>{ctx.save();ctx.translate(x,y);ctx.rotate(-.4);ctx.scale(.6,.6);drawWoodBow(ctx);ctx.restore()},
  tags:['weapon','ranged','bow']
} satisfies ItemDef
