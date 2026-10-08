import { STAFF_WOOD_ID } from '../../ids'
import type { ItemDef } from '../../../types'
import { sfx } from '../../../../../game/audio/Sfx'
import { stats } from './stats'
import { WOOD_STAFF_ICON } from './icon'
import { drawWoodStaff, drawGroundWoodStaff } from './appearance'
import { staffArmAim, staffArmBend, staffGripSlide, staffIdleAim, staffSupportGrip, staffBodyMotion } from './motion'
import { drawStaffTrail, STAFF_TRAIL_DURATION } from './effects'
import { woodStaffSound, woodStaffHit } from './audio'

const def: ItemDef = {
  ...stats,
  id: STAFF_WOOD_ID,
  kind: 'weapon',
  color: '#9c7245', hi: '#d6b684', text: '#d3b68b',
  icon: WOOD_STAFF_ICON,
  ground: drawGroundWoodStaff,
  weapon: {
    combo: true, comboLength: 2, autoRepeat: true, lockAim: true, legacyHeld: true,
    customSwingFx: true, drawHeld: drawWoodStaff,
    armAim: staffArmAim, armBend: staffArmBend, thrust: staffGripSlide,
    idleAim: staffIdleAim, supportGrip: staffSupportGrip, bodyMotion: staffBodyMotion,
    trail: { duration: STAFF_TRAIL_DURATION, render: drawStaffTrail },
    sound: (phase, segment) => woodStaffSound(sfx, phase, segment),
    hitSound: material => woodStaffHit(sfx, material)
  },
  tags: ['weapon', 'staff', 'wood']
}
export default def
