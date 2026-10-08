import type { EnemyDef } from '../types'

/** 不注册进自然刷怪池；抗性是试炼首版标定值。 */
const def: EnemyDef={
  id:'touhou:grimm',ai:'chaser',hp:200000,radius:38,exp:0,
  combat:{physicalResist:35,magicResist:25,contactDamage:0,attackCd:1,contactPad:0,knockback:0,recoil:0,stunResist:999},
  palette:{body:'#31313e',edge:'#aaa697',death:'#8b779c',hpBar:'#8f648f'},
  hitMaterial:'slime',visual:{fastHop:false,antennae:false},tags:['boss','trial']
}

export default def
