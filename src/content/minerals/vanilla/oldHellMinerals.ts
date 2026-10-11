import type { MineralDef } from '../types'
import { BLACKSTONE_ID,BASALT_ID,CINNABAR_ID,ANCIENT_DEBRIS_ID,OBSIDIAN_ID,SOUL_ROCK_ID,SOLIDIFIED_MAGMA_ID } from '../../items/vanilla/ids'
import { MINERAL_BLACKSTONE_ID,MINERAL_OBSIDIAN_ID,MINERAL_SOUL_ROCK_ID,MINERAL_SOLIDIFIED_MAGMA_ID } from './ids'

export const oldHellMinerals:MineralDef[]=[
  {id:MINERAL_BLACKSTONE_ID,dropItemId:BLACKSTONE_ID,hp:[100,130],requiredMiningPower:1,
    palette:{base:'#403a35',baseDark:'#211f20',crystal:'#544b40',crystalDark:'#2c2928',hi:'#958474',light:'#a18b6a'},
    text:'#b6a898',spawn:{weight:0,minFloor:5,maxFloor:5,rockReplacementChance:.6},visual:{form:'blackstone',glowPower:0},tags:['stone','old_hell'],
    drops:[{item:BLACKSTONE_ID,chance:1,quantity:1},{item:BASALT_ID,chance:.14,quantity:1},{item:CINNABAR_ID,chance:.09,quantity:1},{item:ANCIENT_DEBRIS_ID,chance:.005,quantity:1}]},
  {id:MINERAL_OBSIDIAN_ID,dropItemId:OBSIDIAN_ID,hp:[150,180],requiredMiningPower:2,
    palette:{base:'#34303c',baseDark:'#17171e',crystal:'#66556e',crystalDark:'#2c2637',hi:'#b4a4c4',light:'#a093bd'},
    text:'#c5b4d8',spawn:{weight:3,minFloor:5,maxFloor:5,placement:'lava_bank'},visual:{form:'obsidian',glowPower:.035},tags:['stone','rare','old_hell']},
  {id:MINERAL_SOUL_ROCK_ID,dropItemId:SOUL_ROCK_ID,hp:[150,180],requiredMiningPower:2,
    palette:{base:'#64726b',baseDark:'#303d39',crystal:'#81a99e',crystalDark:'#3e665e',hi:'#c2ddd0',light:'#94cfbf'},
    text:'#b9d6ca',spawn:{weight:2,minFloor:5,maxFloor:5,placement:'lava_bank'},visual:{form:'soul_rock',glowPower:.12},tags:['stone','rare','old_hell']},
  {id:MINERAL_SOLIDIFIED_MAGMA_ID,dropItemId:SOLIDIFIED_MAGMA_ID,hp:[110,140],requiredMiningPower:1,
    palette:{base:'#4c3931',baseDark:'#231f1e',crystal:'#a25637',crystalDark:'#582f28',hi:'#e0a65d',light:'#d7924c'},
    text:'#d6a16b',spawn:{weight:5,minFloor:5,maxFloor:5,placement:'lava_bank'},visual:{form:'solidified_magma',glowPower:.07},tags:['stone','rare','old_hell']}
]
