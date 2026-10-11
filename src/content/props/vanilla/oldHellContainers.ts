import type { PropDef } from '../types'
import { drawOldHellContainer } from '../../../game/art/oldHellContainers'
import { SEARCH_SUPPLIES_TABLE,SEARCH_SEALED_TABLE,SEARCH_SEALED_RARE_TABLE } from '../../loot/vanilla/searchSupplies'
import { PROP_MINER_TOOLBOX_ID,PROP_STORAGE_JAR_ID,PROP_WORN_SATCHEL_ID,PROP_DESK_DRAWER_ID,PROP_OLD_WARDROBE_ID,PROP_COLLAPSED_SHELF_ID,PROP_SEALED_CABINET_ID } from './ids'

const ordinary=(id:string,style:Parameters<typeof drawOldHellContainer>[0],width:number,thickness:number,large:boolean,height:number,tags:string[]):PropDef=>({
  id,halfWidth:width,halfThick:thickness,tags:['old_hell_container',...tags],
  render:(g,p,time)=>drawOldHellContainer(style,g,p,time??0),
  search:{cols:large?3:2,rows:large?4:3,table:SEARCH_SUPPLIES_TABLE,fields:{markerHeight:height}}
})
export const oldHellContainerDefs:PropDef[]=[
  ordinary(PROP_MINER_TOOLBOX_ID,'toolbox',23,8,false,43,['wood','metal']),
  ordinary(PROP_STORAGE_JAR_ID,'jar',20,10,false,66,['ceramic']),
  ordinary(PROP_WORN_SATCHEL_ID,'satchel',22,7,false,43,['cloth']),
  ordinary(PROP_DESK_DRAWER_ID,'drawer',25,8,false,59,['wood']),
  ordinary(PROP_OLD_WARDROBE_ID,'wardrobe',28,9,true,111,['wood','cloth']),
  ordinary(PROP_COLLAPSED_SHELF_ID,'shelf',36,10,true,96,['wood']),
  {id:PROP_SEALED_CABINET_ID,halfWidth:29,halfThick:10,tags:['old_hell_container','metal','advanced_container'],
    render:(g,p,time)=>drawOldHellContainer('sealed',g,p,time??0),
    search:{cols:4,rows:4,table:SEARCH_SEALED_TABLE,fields:{advanced:true,markerHeight:111},profile:{emptyChance:0,counts:[{count:2,weight:30},{count:3,weight:45},{count:4,weight:25}],guaranteedTable:SEARCH_SEALED_RARE_TABLE}}}
]
