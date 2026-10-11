import { svgIcon, type ItemDef } from '../../../types'
import { BATTLE_SCEPTER_ID } from '../../ids'
import { sfx } from '../../../../../game/audio/Sfx'
import { stats } from './stats'
import { drawBattleScepter, drawGroundScepter, SCEPTER_ICON } from './appearance'
import { scepterArmAim, scepterIdleAim, scepterGrip, scepterBodyMotion } from './motion'
import { drawScepterTrail, drawScepterImpact } from './effects'
import { scepterSound, scepterHit, scepterImpactSound } from './audio'
import { SCEPTER_PARRY } from './statuses'

const def: ItemDef = {
  ...stats,
  id: BATTLE_SCEPTER_ID, kind: 'weapon',
  color: '#4e3d37', hi: '#a48b79', text: '#c6b8ab',
  icon: svgIcon(SCEPTER_ICON), ground: drawGroundScepter,
  weapon: {
    combo: true, comboLength: 4, autoRepeat: true, lockAim: true, legacyHeld: true,
    customSwingFx: true, drawHeld: drawBattleScepter,
    idleAim: scepterIdleAim, armAim: scepterArmAim,
    // 下劈只复用戳刺判定，不使用通用刺出的握柄位移。
    thrust: () => 0,
    supportGrip: scepterGrip, bodyMotion: scepterBodyMotion, gripHandsOverWeapon: true,
    heldEffects: [SCEPTER_PARRY],
    trail: { duration: .22, render: drawScepterTrail },
    impactFx: { duration: .7, segments: [3], contactProgress: .48, shake: .12,
      sound: () => scepterImpactSound(sfx), render: drawScepterImpact },
    sound: (phase, segment) => scepterSound(sfx, phase, segment),
    hitSound: material => scepterHit(sfx, material),
    skillDescriptions: {
      summaryKey: 'skill.battle_scepter.summary',
      effects: [
        { nameKey: 'skill.battle_scepter.flourish.name', descriptionKey: 'skill.battle_scepter.flourish.desc' },
        { nameKey: 'skill.battle_scepter.slam.name', descriptionKey: 'skill.battle_scepter.slam.desc' }
      ]
    }
  },
  tags: ['weapon', 'staff', 'wood', 'metal']
}

export default def
