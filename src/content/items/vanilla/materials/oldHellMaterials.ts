import type { ItemDef } from '../../types'
import { BLACKSTONE_ID,BASALT_ID,CINNABAR_ID,ANCIENT_DEBRIS_ID,OBSIDIAN_ID,SOUL_ROCK_ID,SOLIDIFIED_MAGMA_ID,BONE_FRAGMENT_ID,TURMERIC_ID,SULFUR_ID,FIRE_FLOWER_ID,MAGMA_CREAM_ID,FIRE_CORE_ID,FIRE_CRYSTAL_ID,GUNPOWDER_ID,LEATHER_ID,STRANGE_PORK_ID,RED_LOTUS_ORB_ID } from '../ids'
import { MINERAL_BLACKSTONE_ID,MINERAL_OBSIDIAN_ID,MINERAL_SOUL_ROCK_ID,MINERAL_SOLIDIFIED_MAGMA_ID } from '../../../minerals/vanilla/ids'
import { oldHellResourceIcon,drawOldHellResource } from '../../../../game/art/oldHellResourceArt'

const material=(id:string,color:string,hi:string,rarity:NonNullable<ItemDef['rarity']>,tags:string[],mineral?:string):ItemDef=>({
  id,kind:'material',maxStack:9999,color,hi,text:hi,rarity,tags:['material','old_hell',...tags],mineral,
  icon:oldHellResourceIcon(id),ground:({ctx,x,y})=>drawOldHellResource(ctx,id,x,y)
})
export const oldHellMaterials:ItemDef[]=[
  material(BLACKSTONE_ID,'#443b35','#b6a898',1,['stone'],MINERAL_BLACKSTONE_ID),
  material(BASALT_ID,'#626869','#b5b8a6',1,['stone']),
  material(CINNABAR_ID,'#303037','#c3c5c5',2,['mineral']),
  material(ANCIENT_DEBRIS_ID,'#886248','#d9b486',5,['mineral','ancient']),
  material(OBSIDIAN_ID,'#4d3d5c','#c1aed1',3,['stone','mineral'],MINERAL_OBSIDIAN_ID),
  material(SOUL_ROCK_ID,'#647e73','#b9dbca',3,['stone','mineral'],MINERAL_SOUL_ROCK_ID),
  material(SOLIDIFIED_MAGMA_ID,'#8c5039','#dfad77',2,['stone','mineral'],MINERAL_SOLIDIFIED_MAGMA_ID),
  material(BONE_FRAGMENT_ID,'#aea794','#e4dac0',1,['bone']),
  material(TURMERIC_ID,'#bd8d42','#ecd08b',1,['plant','ingredient']),
  material(SULFUR_ID,'#b6a650','#eadb99',2,['mineral']),
  material(FIRE_FLOWER_ID,'#b65c43','#e7b76c',2,['plant','flower']),
  material(MAGMA_CREAM_ID,'#a65438','#edb978',2,['magma']),
  material(FIRE_CORE_ID,'#c75635','#ffdb8c',5,['core']),
  material(FIRE_CRYSTAL_ID,'#ac3d3e','#ffc58a',5,['crystal']),
  material(GUNPOWDER_ID,'#4c4642','#c1ad8e',2,['powder']),
  material(LEATHER_ID,'#8b6048','#d1ad7c',1,['hide']),
  material(STRANGE_PORK_ID,'#b66d67','#edb5a1',1,['ingredient','meat']),
  material(RED_LOTUS_ORB_ID,'#a4373c','#f3c28a',3,['gem'])
]
