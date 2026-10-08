import { SPEAR_STONE_ID } from '../../ids'
import type { ItemDef } from '../../../types'
import { sfx } from '../../../../../game/audio/Sfx'
import { stats } from './stats'
import { STONE_SPEAR_ICON } from './icon'
import { drawStoneSpear, drawGroundStoneSpear } from './appearance'
import { spearArmAim, spearArmBend, spearThrust, spearIdleAim, spearSupportGrip, spearBodyMotion } from './motion'
import { drawSpearTrail, SPEAR_TRAIL_DURATION } from './effects'
import { stoneSpearSound } from './audio'

const def: ItemDef = {
  ...stats,
  id: SPEAR_STONE_ID,
  kind: 'weapon',
  color: '#8c8e7d', hi: '#d0cfb6', text: '#d0c6a4',
  icon: STONE_SPEAR_ICON,
  ground: drawGroundStoneSpear,
  weapon: {
    combo: false, comboLength: 1, lockAim: true, legacyHeld: true,
    customSwingFx: true, drawHeld: drawStoneSpear,
    armAim: spearArmAim, armBend: spearArmBend, thrust: spearThrust,
    idleAim: spearIdleAim, supportGrip: spearSupportGrip, bodyMotion: spearBodyMotion,
    trail: { duration: SPEAR_TRAIL_DURATION, render: drawSpearTrail },
    sound: phase => stoneSpearSound(sfx, phase)
  },
  tags: ['weapon', 'spear', 'stone']
}
export default def
