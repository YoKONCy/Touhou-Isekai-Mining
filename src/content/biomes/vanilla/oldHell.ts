import type { BiomeDef } from '../types'
import { BIOME_OLD_HELL_ID } from './ids'
import { MINERAL_IRON_ID,MINERAL_GOLD_ID,MINERAL_SILVER_ID,MINERAL_RUBY_ID,MINERAL_BLACKSTONE_ID,MINERAL_OBSIDIAN_ID,MINERAL_SOUL_ROCK_ID,MINERAL_SOLIDIFIED_MAGMA_ID } from '../../minerals/vanilla/ids'
import { BONE_FRAGMENT_ID,TURMERIC_ID,SULFUR_ID,FIRE_FLOWER_ID } from '../../items/vanilla/ids'
import { MINERAL_SLIME_ID,MAGMA_CREATURE_ID,FIRE_WISP_ID,BURNING_BOAR_ID } from '../../enemies/vanilla/oldHell'
import { PROP_SEALED_CABINET_ID } from '../../props/vanilla/ids'

/** 旧地狱的敌怪与自然资源独立投放，不继承旧矿洞生物。 */
export const biomeOldHell:BiomeDef={
  id:BIOME_OLD_HELL_ID,environment:'old_hell',
  floorStyle:{base:'#39281f',dark:'#181310',light:'#72543a',dust:'#aa7c49',detailDensity:.9},
  sceneStyle:{wallTint:'#49301e',tintStrength:.36,dampness:0,vegetation:0,fungi:0,boneFragments:5,fogStrength:1,deepHollow:false},
  enemyBudget:{start:[3,5],reward:[0,0],exit:[16,20],normalAverage:13,depthMultipliers:[.85,1,1.15,1.3]},
  enemyIds:[MINERAL_SLIME_ID,MAGMA_CREATURE_ID],
  survivalEncounter:{roomChance:.3,duration:30,interval:3,initialCount:[18,22],reinforcementCount:[2,2],noResources:true,
    guaranteedContainer:PROP_SEALED_CABINET_ID,openMessageKey:'game.survival.old_hell_open'},
  lavaEncounter:{enemyId:FIRE_WISP_ID,interval:[10,15]},
  eliteEncounter:{enemyId:BURNING_BOAR_ID,guaranteedRoom:'exit',roomChance:.1,maxPerFloor:2},
  // 大房间不按面积等比例填矿，单位面积资源密度低于前四层。
  oreRange:{start:[6,10],normal:[12,18],reward:[16,22],exit:[8,12]},
  mineralIds:[MINERAL_IRON_ID,MINERAL_GOLD_ID,MINERAL_SILVER_ID,MINERAL_RUBY_ID,MINERAL_BLACKSTONE_ID,MINERAL_OBSIDIAN_ID,MINERAL_SOUL_ROCK_ID,MINERAL_SOLIDIFIED_MAGMA_ID],
  lavaBankMinerals:{roomChance:.12,count:[1,2]},
  gatherSpawns:[
    {item:BONE_FRAGMENT_ID,chance:.8,count:[1,3]},
    {item:TURMERIC_ID,chance:.65,count:[1,2]},
    {item:SULFUR_ID,chance:.55,count:[1,2],placement:'lava_bank'},
    {item:FIRE_FLOWER_ID,chance:.22,count:[1,1],placement:'lava_bank'}
  ],
  tags:['vanilla','underground','old_hell','geothermal']
}
