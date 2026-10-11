import type { ItemDef,MeleeMove } from '../../../types'
import { SOULSLAYER_SWORD_ID } from '../../ids'
import katana from '../katanaForged'
import { SOULSLAYER_ICON,drawSoulSlayer,drawSoulGround,drawSoulSheath } from './appearance'
import { drawSoulTrail,drawSoulInward,SOUL_TRAIL_DURATION } from './effects'
import { soulBodyMotion,drawHundredSlashes,drawHundredCharge } from './skill'
import { hundredReadySound,hundredSlashSound } from './audio'
import { sfx } from '../../../../../game/audio/Sfx'

const move=(base:MeleeMove):MeleeMove=>({...base,damage:19,windup:.03,active:.16,recover:.17})
const soulSlayer:ItemDef={
  ...katana,id:SOULSLAYER_SWORD_ID,grade:3,color:'#8e2b3c',hi:'#f1d6cf',text:'#e8b8bc',
  combat:{...katana.combat,critChance:.2,penetration:2,magicPenetration:3},
  melee:move(katana.melee!),meleePattern:{mode:'mixed',moves:katana.meleePattern!.moves.map(move)},
  icon:SOULSLAYER_ICON,ground:drawSoulGround,tags:['weapon','katana','soul'],
  weapon:{...katana.weapon,drawHeld:drawSoulSlayer,drawAccessory:drawSoulSheath,bodyMotion:soulBodyMotion,
    trail:{duration:SOUL_TRAIL_DURATION,render:drawSoulTrail},hitFx:{duration:.34,render:drawSoulInward},
    echoAttack:{damage:19,offset:14,fadeDuration:.18,delay:.13,speedMultiplier:.8},
    chargeAttack:{trigger:'special',duration:.6,minimumMoveMultiplier:0,moveMultiplier:0,immobilize:true,cooldown:6,tiers:[],
      nameKey:'weapon.soul_slayer.hundred.name',conditionKey:'weapon.soul_slayer.hundred.effect',draw:drawHundredCharge,readySound:()=>hundredReadySound(sfx),
      cooldownBar:{fill:'#b52d4d',background:'#100e17',glow:'#ff426a'},
      // 朝着玩家的近侧边长二百，向前纵深一百二十；判定与刀影共用尺寸。
      areaBurst:{count:13,duration:.4,range:120,width:200,physicalDamage:5,magicDamage:5,sound:index=>hundredSlashSound(sfx,index),render:drawHundredSlashes}},
    skillDescriptions:{summaryKey:'weapon.soul_slayer.echo.name',effects:[{nameKey:'weapon.soul_slayer.echo.name',descriptionKey:'weapon.soul_slayer.echo.effect'}]}}
}
export default soulSlayer
