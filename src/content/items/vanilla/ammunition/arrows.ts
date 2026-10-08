import type { ItemDef } from '../../types'
import { WOOD_ARROW_ID,IRON_ARROW_ID } from '../ids'
import { arrowIcon,drawArrow } from '../weapons/bowWood/appearance'

const arrow=(iron:boolean):ItemDef=>({
  id:iron?IRON_ARROW_ID:WOOD_ARROW_ID,kind:'ammunition',tier:1,maxStack:9999,
  color:iron?'#8fabb8':'#ae946e',hi:'#dfd2ac',text:'#d6c3a1',icon:arrowIcon(iron),
  ammunition:{family:'arrow',damage:iron?3:1,critChance:0,penetration:iron?5:0,accuracyCorrection:0,attackSpeed:0,projectileSpeed:0,knockback:0,stun:0},
  ground:({ctx,x,y})=>{ctx.save();ctx.translate(x,y);ctx.rotate(-.6);ctx.scale(.55,.55);drawArrow(ctx,iron);ctx.restore()},
  tags:['ammunition','arrow']
})
export const arrows=[arrow(false),arrow(true)]
