import { SWORD_STEEL_BROAD_ID } from '../../ids'
import type { ItemDef } from '../../../types'
import { sfx } from '../../../../../game/audio/Sfx'
import { stats } from './stats'
import { STEEL_BROADSWORD_ICON, drawSteelBroadsword, drawGroundBroadsword } from './appearance'
import { broadswordArmAim, broadswordIdleAim, broadswordGrip, broadswordBodyMotion } from './motion'
import { drawBroadswordTrail, BROADSWORD_TRAIL_DURATION } from './effects'
import { broadswordSound, broadswordHit } from './audio'
import { HEAVY } from './statuses'

const def: ItemDef = {
  ...stats, id: SWORD_STEEL_BROAD_ID, kind: 'weapon',
  color: '#8b9da5', hi: '#e2e5d9', text: '#ccd8d3',
  icon: STEEL_BROADSWORD_ICON, ground: drawGroundBroadsword,
  weapon: {
    combo: true, comboLength: 2, lockAim: true, buffer: true, preserveOvershoot: true,
    legacyHeld: true, customSwingFx: true, drawHeld: drawSteelBroadsword,
    armAim: broadswordArmAim, idleAim: broadswordIdleAim,
    supportGrip: broadswordGrip, bodyMotion: broadswordBodyMotion,
    heldEffects: [HEAVY],
    windupRollBonus: { damageBonus: .3, nameKey: 'skill.broadsword_roll.name', conditionKey: 'skill.broadsword_roll.condition' },
    trail: { duration: BROADSWORD_TRAIL_DURATION, render: drawBroadswordTrail },
    sound: (phase, segment, empowered) => broadswordSound(sfx, phase, segment, empowered),
    hitSound: material => broadswordHit(sfx, material)
  },
  tags: ['weapon', 'broadsword', 'steel']
}
export default def
