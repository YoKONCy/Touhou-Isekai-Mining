import { KATANA_FORGED_ID } from '../../ids'
import type { ItemDef } from '../../../types'
import { sfx } from '../../../../../game/audio/Sfx'
import { stats } from './stats'
import { KATANA_FORGED_ICON, drawForgedKatana, drawGroundKatana, drawKatanaSheath } from './appearance'
import { katanaArmAim, katanaIdleAim, katanaArmBend, katanaThrust, katanaSupportGrip, katanaBodyMotion } from './motion'
import { drawKatanaTrail, KATANA_TRAIL_DURATION } from './effects'
import { katanaSound } from './audio'

const def: ItemDef = {
  ...stats, id: KATANA_FORGED_ID, kind: 'weapon',
  color: '#91a6b0', hi: '#ecebdc', text: '#d2dedb',
  icon: KATANA_FORGED_ICON, ground: drawGroundKatana,
  weapon: {
    combo: true, comboLength: 4, comboWindow: 0, autoRepeat: true, lockAim: true, buffer: true, preserveOvershoot: true,
    legacyHeld: true, customSwingFx: true, drawHeld: drawForgedKatana,
    armAim: katanaArmAim, idleAim: katanaIdleAim, armBend: katanaArmBend, thrust: katanaThrust,
    supportGrip: katanaSupportGrip, bodyMotion: katanaBodyMotion, drawAccessory: drawKatanaSheath,
    trail: { duration: KATANA_TRAIL_DURATION, render: drawKatanaTrail },
    sound: (phase, segment) => katanaSound(sfx, phase, segment)
  },
  tags: ['weapon', 'katana', 'forged']
}
export default def
