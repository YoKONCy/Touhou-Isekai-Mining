import type { ItemDef,MeleeMove } from '../../../types'
import { SPEAR_OBSIDIAN_ID,SPEAR_OBSIDIAN_REINFORCED_ID } from '../../ids'
import ironSpear from '../spearIron'
import { BLEEDING } from '../../../../statuses/bleeding'
import { sfx } from '../../../../../game/audio/Sfx'
import { stoneSpearSound } from '../spearStone/audio'
import { woodStaffSound } from '../staffWood/audio'
import { spearIdleAim } from '../spearStone/motion'
import { obsidianArmAim,obsidianArmBend,obsidianThrust,obsidianGrip,obsidianBodyMotion } from './motion'
import { drawObsidianSpear,drawGroundObsidianSpear,obsidianSpearIcon } from './appearance'
import { drawObsidianTrail,OBSIDIAN_TRAIL_DURATION } from './effects'

// 判定与前后摇均沿用矛家族；第一段只把形态改为一百二十度横扫。
const stab:MeleeMove={...ironSpear.melee!,damage:25}
const slash:MeleeMove={...stab,shape:'slash',arc:Math.PI/3,sweepDirection:1}
const obsidianSpear:ItemDef={
  ...ironSpear,id:SPEAR_OBSIDIAN_ID,grade:1,color:'#302539',hi:'#ab94ba',text:'#c8b6d4',
  combat:{...ironSpear.combat,critChance:.11,penetration:2.5},
  melee:slash,meleePattern:{mode:'mixed',moves:[slash,stab]},
  icon:obsidianSpearIcon(false),ground:v=>drawGroundObsidianSpear(v,false),
  weapon:{...ironSpear.weapon,combo:true,comboLength:2,autoRepeat:true,buffer:true,
    drawHeld:g=>drawObsidianSpear(g,false),idleAim:spearIdleAim,
    armAim:obsidianArmAim,armBend:obsidianArmBend,thrust:obsidianThrust,supportGrip:obsidianGrip,bodyMotion:obsidianBodyMotion,
    trail:{duration:OBSIDIAN_TRAIL_DURATION,render:(g,v)=>drawObsidianTrail(g,v,false)},
    sound:(phase,segment)=>segment%2===0?woodStaffSound(sfx,phase,0):stoneSpearSound(sfx,phase)},
  tags:['weapon','spear','obsidian']
}

export const reinforcedObsidianSpear:ItemDef={
  ...obsidianSpear,id:SPEAR_OBSIDIAN_REINFORCED_ID,grade:2,color:'#61367e',hi:'#e0c8f1',text:'#d4b5e5',
  combat:{...obsidianSpear.combat,critChance:.15,penetration:3,magicPenetration:10},
  melee:{...slash,damage:25},meleePattern:{mode:'mixed',moves:[{...slash,damage:25},{...stab,damage:25}]},
  icon:obsidianSpearIcon(true),ground:v=>drawGroundObsidianSpear(v,true),
  weapon:{...obsidianSpear.weapon,drawHeld:g=>drawObsidianSpear(g,true),fixedMagicDamage:2,
    trail:{duration:OBSIDIAN_TRAIL_DURATION,render:(g,v)=>drawObsidianTrail(g,v,true)},
    criticalPassive:{effects:[BLEEDING],source:'attacker',nameKey:'weapon.obsidian_spear.bleed.name',descriptionKey:'weapon.obsidian_spear.bleed.effect'}},
  tags:['weapon','spear','obsidian','diamond']
}
export default obsidianSpear
