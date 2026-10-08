import { DOOMSDAY_ID } from '../../ids'
import type { ItemDef } from '../../../types'
import { stats } from './stats'
import { DOOMSDAY_ICON } from './icon'

import { drawDoomsday } from './appearance'

import { doomsdayArmAim } from './motion'

import { doomsdaySwing } from './audio'
import { sfx } from '../../../../../game/audio/Sfx'

const def: ItemDef = {
  weapon: {
    empoweredMove: (move) => ({ ...move, damage: stats.empowered.damage, reach: move.reach * stats.empowered.reachMultiplier, aoe: stats.empowered.aoe }),
    preserveOvershoot: true,
    legacyHeld: true,
    lockAim: true,
    sound: (phase, segment, empowered) => {
      if (phase === 'windup') doomsdaySwing(sfx, empowered)
    },
    armAim: doomsdayArmAim,
    drawHeld: drawDoomsday,
    autoRepeat: true,
    buffer: false,
    combo: true,
    customSwingFx: true
  },
  id: DOOMSDAY_ID,
  kind: 'weapon',
  ...stats,
  color: '#b53bd1',
  hi: '#fff0ff',
  text: '#f4b6ff',
  icon: DOOMSDAY_ICON,
  tags: ['weapon', 'sword', 'developer', 'doomsday']
}

export default def
