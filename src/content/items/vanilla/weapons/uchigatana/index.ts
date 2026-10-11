import { svgIcon, type ItemDef } from '../../../types'
import { UCHIGATANA_ID } from '../../ids'
import { stats as ironSword } from '../swordIron/stats'
import { drawUchigatana } from './appearance'
import { uchigatanaArmAim, uchigatanaArmBend, uchigatanaBodyMotion } from './motion'
import { drawUchigatanaTrail } from './effects'

/** 数值沿用铁剑底板，左右斩分别声明扫向，连击恢复由通用状态机负责。 */
const move = { ...ironSword.melee, damage: 23, reach: 85, windup: .04, active: .15, recover: .11 }
const uchigatana: ItemDef = {
  ...ironSword,
  id: UCHIGATANA_ID, kind: 'weapon', grade: 1,
  color: '#818d9d', hi: '#e5e4d7', text: '#ced7dc',
  tags: ['weapon', 'sword', 'uchigatana'],
  melee: { ...move, sweepDirection: 1 },
  meleePattern: { mode: 'sequence', moves: [{ ...move, sweepDirection: 1 }, { ...move, sweepDirection: -1 }] },
  icon: svgIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><g stroke="#2e2937" stroke-width="1.2" stroke-linejoin="round"><path d="M12 33Q27 20 38 6L40 3L39 10Q30 24 15 36Z" fill="#a5b3bd"/><path d="M14 34Q31 20 39 6L39 10Q30 24 15 36Z" fill="#e3e4db" stroke="none"/><path d="M14 32Q29 19 37 8" fill="none" stroke="#65778e" stroke-width=".8"/><path d="M10 31L18 37L16 39L8 33Z" fill="#bda26a"/><path d="M9 34L14 38L6 46L2 42Z" fill="#353748"/><path d="M8 36L10 40M6 38L8 42M4 40L6 44" stroke="#9c8172"/><path d="M2 42L6 46" stroke="#c8b481" stroke-width="2"/></g></svg>'),
  weapon: {
    combo: true, comboLength: 2, autoRepeat: true, preserveOvershoot: true,
    comboRecovery: { attacks: 2, duration: .6 },
    legacyHeld: true, drawHeld: drawUchigatana,
    armAim: uchigatanaArmAim, armBend: uchigatanaArmBend, bodyMotion: uchigatanaBodyMotion,
    customSwingFx: true, trail: { duration: .22, render: drawUchigatanaTrail },
    skillDescriptions: {
      summaryKey: 'skill.uchigatana.summary',
      effects: [{ nameKey: 'skill.uchigatana.name', descriptionKey: 'skill.uchigatana.desc' }]
    }
  }
}
export default uchigatana
