import { DAGGER_ASSAULT_ID } from '../../ids'
import type { ItemDef } from '../../../types'
import { sfx } from '../../../../../game/audio/Sfx'
import { stats } from './stats'
import { ASSAULT_DAGGER_ICON, drawAssaultDagger, drawGroundAssaultDagger } from './appearance'
import { daggerArmAim, daggerIdleAim, daggerGrip, daggerBodyMotion } from './motion'
import { drawDaggerTrail, DAGGER_TRAIL_DURATION } from './effects'
import { daggerSound } from './audio'
import { ASSAULT_WIND, WIND_ASSAULT } from './statuses'

const def:ItemDef={
  ...stats,id:DAGGER_ASSAULT_ID,kind:'weapon',color:'#596771',hi:'#c3cdc5',text:'#cdd7cc',
  icon:ASSAULT_DAGGER_ICON,ground:drawGroundAssaultDagger,
  weapon:{autoRepeat:true,combo:true,comboLength:3,lockAim:true,buffer:true,preserveOvershoot:true,legacyHeld:true,customSwingFx:true,
    drawHeld:drawAssaultDagger,idleAim:daggerIdleAim,armAim:daggerArmAim,supportGrip:daggerGrip,bodyMotion:daggerBodyMotion,
    heldEffects:[ASSAULT_WIND],afterDodgeEffects:[WIND_ASSAULT],
    trail:{duration:DAGGER_TRAIL_DURATION,render:drawDaggerTrail},sound:(phase,segment)=>daggerSound(sfx,phase,segment)},
  tags:['weapon','dagger','assault']
}
export default def
