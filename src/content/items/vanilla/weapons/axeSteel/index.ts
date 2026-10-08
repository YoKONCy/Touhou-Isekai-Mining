import { AXE_STEEL_ID } from '../../ids'
import type { ItemDef } from '../../../types'
import { sfx } from '../../../../../game/audio/Sfx'
import { STUNNED } from '../../../../statuses/stunned'
import { stats } from './stats'
import { STEEL_AXE_ICON, drawSteelAxe, drawGroundAxe } from './appearance'
import { axeArmAim, axeIdleAim, axeGrip, axeBodyMotion } from './motion'
import { drawAxeTrail, drawAxeCharge, AXE_TRAIL_DURATION } from './effects'
import { axeSound, axeHit, axeReady } from './audio'

export default {
  ...stats, id: AXE_STEEL_ID, kind: 'weapon', color: '#81999f', hi: '#e3e7d8', text: '#d1d8c7',
  icon: STEEL_AXE_ICON, ground: drawGroundAxe,
  weapon: {
    combo: true, comboLength: 2, comboWindow: .8, buffer: false, lockAim: true, preserveOvershoot: true,
    legacyHeld: true, customSwingFx: true, drawHeld: drawSteelAxe,
    armAim: axeArmAim, idleAim: axeIdleAim, supportGrip: axeGrip, bodyMotion: axeBodyMotion,
    chargeAttack: { duration: 1.5, minimumMoveMultiplier: .3, moveMultiplier: .3, cancelOnShortDodgeBeforeReady: true,
      tiers: [{ progress: .5, multiplier: 1.5 }, { progress: 1, multiplier: 2 }], fullHitEffects: [STUNNED],
      nameKey: 'skill.axe_charge.name', conditionKey: 'skill.axe_charge.condition', readySound: () => axeReady(sfx), draw: drawAxeCharge,
      move: (move, progress) => progress + 1e-8 >= .5 ? { ...move, arc: Math.PI, windup: 0,
        powerCoefficient: move.powerCoefficient ?? move.windup + move.active + move.recover } : move },
    trail: { duration: AXE_TRAIL_DURATION, render: drawAxeTrail },
    sound: (phase, segment, empowered) => axeSound(sfx, phase, segment, empowered), hitSound: material => axeHit(sfx, material)
  }, tags: ['weapon', 'axe', 'steel']
} satisfies ItemDef
