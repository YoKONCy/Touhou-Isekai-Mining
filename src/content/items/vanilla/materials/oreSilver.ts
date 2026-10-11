import { ORE_SILVER_ID } from '../ids'
import { MINERAL_SILVER_ID } from '../../../minerals/vanilla/ids'
import type { ItemDef } from '../../types'
import { SILVER_ORE_ICON,drawSilverOreItem } from '../../../../game/art/silverOreArt'

const def:ItemDef={
  id:ORE_SILVER_ID,kind:'material',rarity:3,searchFootprint:[1,1],maxStack:999,
  color:'#a2b2c0',hi:'#e1e8df',text:'#d6e2e7',icon:SILVER_ORE_ICON,mineral:MINERAL_SILVER_ID,
  ground:({ctx,x,y})=>drawSilverOreItem(ctx,x,y),tags:['material','metal','ore']
}
export default def
