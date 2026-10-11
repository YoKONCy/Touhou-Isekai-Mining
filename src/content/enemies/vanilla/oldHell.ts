import type { EnemyDef } from '../types'
import { MAGMA_BALL_ID, WISP_FLAME_ID } from '../../projectiles/vanilla/oldHell'
import { drawMineralSlime, drawMagmaCreature, drawFireWisp } from './oldHellAppearance'
import { drawGuardianWarning } from './fourthFloorAppearance'
import { drawBurningBoar,drawBoarWarning } from './burningBoarAppearance'
import { LEATHER_ID,STRANGE_PORK_ID,RED_LOTUS_ORB_ID } from '../../items/vanilla/ids'
import { ORE_COPPER_ID,ORE_IRON_ID,ORE_GOLD_ID,ORE_SILVER_ID,OBSIDIAN_ID,SOUL_ROCK_ID,ANCIENT_DEBRIS_ID,BASALT_ID,CINNABAR_ID,MAGMA_CREAM_ID,SULFUR_ID,FIRE_CORE_ID } from '../../items/vanilla/ids'

export const MINERAL_SLIME_ID = 'touhou:mineral_slime'
export const MAGMA_CREATURE_ID = 'touhou:magma_creature'
export const FIRE_WISP_ID = 'touhou:fire_wisp'
export const BURNING_BOAR_ID = 'touhou:burning_boar'

export const mineralSlime:EnemyDef = {
  id:MINERAL_SLIME_ID, ai:'guardian', hp:110, radius:18, exp:12,
  combat:{physicalResist:3,magicResist:0,contactDamage:11,attackCd:1,contactPad:3,knockback:200,recoil:0,knockbackResist:180,stunResist:.2},
  palette:{body:'#81735a',edge:'#383439',death:'#c1ac7d',hpBar:'#c6b783'},hitMaterial:'slime',
  guardian:{speed:115,sight:480,guardDistance:60,interval:2.3,windup:.45,lungeSpeed:640,lungeDuration:.14,returnSpeed:140,bodyContactDamage:11},
  stoneGuard:{chance:.4,duration:3,cooldown:3},
  // 必掉恰好一种：四种金属矿合计92.2%，两种特殊矿合计7%，远古遗骸0.8%。
  dropPool:[
    {item:ORE_COPPER_ID,weight:520,qty:1},
    {item:ORE_IRON_ID,weight:360,qty:1},
    {item:ORE_GOLD_ID,weight:32,qty:1},
    {item:ORE_SILVER_ID,weight:10,qty:1},
    {item:OBSIDIAN_ID,weight:40,qty:1},
    {item:SOUL_ROCK_ID,weight:30,qty:1},
    {item:ANCIENT_DEBRIS_ID,weight:8,qty:1}
  ],
  drops:[{item:BASALT_ID,chance:.17,qty:1},{item:CINNABAR_ID,chance:.11,qty:1}],
  spawn:{weight:1,minFloor:5,maxFloor:5,rooms:['start','normal','exit']},
  visual:{render:drawMineralSlime,warning:drawGuardianWarning,fastHop:false,antennae:false},
  tags:['slime','guardian','melee','old_hell']
}

export const magmaCreature:EnemyDef = {
  id:MAGMA_CREATURE_ID,ai:'kite_shooter',hp:80,radius:18,exp:11,
  combat:{physicalResist:1,magicResist:1,contactDamage:11,attackCd:1,contactPad:3,knockback:210,recoil:80,knockbackResist:60,stunResist:0},
  palette:{body:'#633e35',edge:'#29252c',death:'#e59b54',hpBar:'#eab17a'},hitMaterial:'slime',
  kite:{wanderSpeed:65,kiteSpeed:90,accel:8,sight:470,loseSight:600,kiteMin:170,kiteMax:290,straightInterval:2.5,
    straightVolley:{count:2,spread:.18},ringInterval:2.5,ringCount:0,straightWindup:.38,ringWindup:0,firstFireJitter:1.4,
    straightProjectileId:MAGMA_BALL_ID,ringProjectileId:MAGMA_BALL_ID},
  drops:[{item:MAGMA_CREAM_ID,chance:.17,qty:1},{item:SULFUR_ID,chance:.21,qty:1}],
  spawn:{weight:1,minFloor:5,maxFloor:5,rooms:['start','normal','exit']},
  visual:{render:drawMagmaCreature,fastHop:true,antennae:false,light:{radius:60,power:.24,color:'#ed8b38',tint:.12}},tags:['ranged','magma','old_hell']
}

export const fireWisp:EnemyDef = {
  id:FIRE_WISP_ID,ai:'chaser',movement:'flying',hp:70,radius:13,exp:7,
  combat:{physicalResist:0,magicResist:0,contactDamage:12,attackCd:1,contactPad:3,knockback:200,recoil:140,knockbackResist:20,stunResist:0},
  palette:{body:'#eee7cd',edge:'#784837',death:'#ffcc82',hpBar:'#f3cc90'},hitMaterial:'slime',
  chaser:{wanderSpeed:65,chaseSpeed:160,accel:9,sight:480,loseSight:600},
  deathBurst:{delay:1,count:20,projectileId:WISP_FLAME_ID},
  // 焰灵由熔岩湖定时生成，不占用两种常规敌人的等权怪池。
  drops:[{item:FIRE_CORE_ID,chance:.005,qty:1}],
  visual:{render:drawFireWisp,fastHop:false,antennae:false,light:{radius:88,power:.42,color:'#ffb85d',tint:.2,priority:1}},tags:['flying','fire','old_hell']
}

export const burningBoar:EnemyDef={
  id:BURNING_BOAR_ID,ai:'charge_cycle',hp:240,radius:32,hurtbox:{offsetY:-10,radius:46},exp:32,
  combat:{physicalResist:2,magicResist:0,contactDamage:11,attackCd:1,contactPad:4,knockback:220,recoil:0,knockbackResist:100,stunResist:1},
  palette:{body:'#c98f7f',edge:'#483338',death:'#dca18b',hpBar:'#e6a76d'},hitMaterial:'bat',
  chargeCycle:{chaseSpeed:105,retreatSpeed:55,sight:1000,triggerRange:720,windup:.7,dashSpeed:374,dashDistance:780,dashDamage:14,retreatDuration:[.4,.6],requireClearPath:true,
    fireTrail:{radius:20,duration:.5,damage:2,interval:1,spacing:14}},
  drops:[{item:LEATHER_ID,chance:.5,qty:1},{item:STRANGE_PORK_ID,chance:1,qty:1},{item:RED_LOTUS_ORB_ID,chance:.09,qty:1}],
  visual:{render:drawBurningBoar,warning:drawBoarWarning,gait:'walk',healthBarOffsetY:-55,fastHop:false,antennae:false,light:{radius:135,power:.56,color:'#ffad59',tint:.23,priority:2}},
  tags:['elite','beast','fire','old_hell']
}

export const oldHellEnemies = [mineralSlime,magmaCreature,fireWisp,burningBoar]
