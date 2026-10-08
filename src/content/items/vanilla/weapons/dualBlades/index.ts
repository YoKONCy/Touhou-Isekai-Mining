import { DUAL_BLADES_ID } from '../../ids'
import type { ItemDef } from '../../../types'
import { sfx } from '../../../../../game/audio/Sfx'
import { stats, DUAL_STAB } from './stats'
import { DUAL_BLADES_ICON, drawDualBlade, drawGroundDualBlades } from './appearance'
import { dualArmAim, dualGrip, dualBodyMotion } from './motion'
import { drawDualTrail, drawDualCharge, DUAL_TRAIL_DURATION } from './effects'
import { dualSound, dualReady } from './audio'

export default {
  ...stats, id: DUAL_BLADES_ID, kind: 'weapon', color: '#8faeb4', hi: '#e4ead8', text: '#cbdcd3',
  icon: DUAL_BLADES_ICON, ground: drawGroundDualBlades,
  weapon: {
    combo: true, autoRepeat: true, comboLength: 3, comboWindow: .8, buffer: true, lockAim: true, preserveOvershoot: true,
    legacyHeld: true, customSwingFx: true, drawHeld: drawDualBlade, drawOffhand: drawDualBlade,
    armAim: dualArmAim, idleAim: dualArmAim, supportGrip: dualGrip, bodyMotion: dualBodyMotion, thrust: () => 0,
    chargeAttack: { trigger: 'special', duration: .5, minimumMoveMultiplier: 1, tiers: [],
      burst: { count: 10, duration: 1, cooldown: 3.5, segments: [0, 1], move: DUAL_STAB },
      nameKey: 'skill.dual_flurry.name', conditionKey: 'skill.dual_flurry.condition', readySound: () => dualReady(sfx), draw: drawDualCharge },
    trail: { duration: DUAL_TRAIL_DURATION, render: drawDualTrail }, sound: (phase, segment) => dualSound(sfx, phase, segment)
  }, tags: ['weapon', 'dual_blades', 'steel']
} satisfies ItemDef
