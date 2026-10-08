import { SPEAR_RED_TASSEL_ID } from '../../ids'
import type { ItemDef } from '../../../types'
import { STUNNED } from '../../../../statuses/stunned'
import { redSpearBlade } from './parry'
import { sfx } from '../../../../../game/audio/Sfx'
import { stats, RED_SPEAR_SLAM } from './stats'
import { RED_SPEAR_ICON, drawRedSpear, drawGroundRedSpear } from './appearance'
import { redArmAim, redThrust, redGrip, redBodyMotion } from './motion'
import { drawRedSpearTrail, drawRedSpearCharge, drawRedSpearCrater, RED_TRAIL_DURATION } from './effects'
import { RED_DRAGON, RED_SURGE_GUARD } from './status'
import { redSpearSound, redSpearReady, redSpearImpact } from './audio'

export default {
  ...stats, id: SPEAR_RED_TASSEL_ID, kind: 'weapon', color: '#ac5456', hi: '#e7d9c3', text: '#ddb1a3',
  icon: RED_SPEAR_ICON, ground: drawGroundRedSpear,
  weapon: {
    autoRepeat: true, combo: true, comboLength: 4, comboWindow: .75, buffer: true, lockAim: true, preserveOvershoot: true,
    legacyHeld: true, customSwingFx: true, drawHeld: drawRedSpear, eraseProjectiles: { radius: 5, blade: redSpearBlade, descriptionKey: 'item.touhou:spear_red_tassel.parry' },
    armAim: redArmAim, idleAim: redArmAim, thrust: redThrust, supportGrip: redGrip, bodyMotion: redBodyMotion,
    chargeAttack: { trigger: 'special', duration: 1, cooldown: 6, minimumMoveMultiplier: 1, tiers: [], fullHitEffects: [{ ...STUNNED, duration: .5 }],
      readyEffects: { definitions: [RED_DRAGON], releaseDuration: 4 }, releaseEffects: [RED_SURGE_GUARD],
      nameKey: 'skill.red_spear_slam.name', conditionKey: 'skill.red_spear_slam.condition',
      readySound: () => redSpearReady(sfx), draw: drawRedSpearCharge, move: (move, progress) => progress >= 1 - 1e-8 ? { ...RED_SPEAR_SLAM } : move },
    impactFx: { duration: 2, contactProgress: .58, skillOnly: true, shake: .18, sound: () => redSpearImpact(sfx), render: drawRedSpearCrater },
    trail: { duration: RED_TRAIL_DURATION, render: drawRedSpearTrail },
    sound: (phase, segment, charged) => redSpearSound(sfx, phase, segment, charged),
    hitSound: material => sfx.meleeHit(material)
  }, tags: ['weapon', 'spear', 'red_tassel']
} satisfies ItemDef
