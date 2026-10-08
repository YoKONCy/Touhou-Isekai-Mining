import { NUNCHAKU_ID } from '../../ids'
import { stats, NUNCHAKU_VISUAL_SCALE } from './stats'
import { svgIcon, type ItemDef } from '../../../types'
import type { StatusDefinition } from '../../../../../shared/statusEffects'
import { sfx } from '../../../../../game/audio/Sfx'
import { nunchakuSound } from './audio'
import { drawNunchaku, drawNunchakuRod, nunchakuArm } from './motion'
import { ChainRodPhysics, RodSweep } from '../../../chainRodPhysics'

const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="nunWood"><stop stop-color="#3e2821"/><stop offset=".3" stop-color="#9b7351"/><stop offset=".55" stop-color="#624330"/><stop offset="1" stop-color="#2f2420"/></linearGradient><linearGradient id="nunSteel"><stop stop-color="#434849"/><stop offset=".45" stop-color="#bec0ae"/><stop offset="1" stop-color="#666a63"/></linearGradient></defs><g fill="none" stroke="#272725" stroke-width="3"><ellipse cx="23" cy="11" rx="3" ry="4" transform="rotate(-30 23 11)"/><ellipse cx="28" cy="8" rx="4" ry="2.8"/><ellipse cx="34" cy="9" rx="3" ry="4" transform="rotate(35 34 9)"/><ellipse cx="38" cy="14" rx="3" ry="4" transform="rotate(-20 38 14)"/></g><path d="m23 8 3-2m3 0 3 1m3 2 2 3" stroke="#b9b9a6" fill="none"/><g stroke="#241d19" stroke-width="1.6"><g transform="translate(19 15) rotate(14)"><rect x="-5" y="0" width="10" height="42" rx="2.5" fill="url(#nunWood)"/><path d="M-5 1H5V7H-5ZM-5 36H5V41H-5Z" fill="url(#nunSteel)"/><path d="M-5 14 5 17M-5 20 5 23M-5 26 5 29" stroke="#b09068" stroke-width="2"/><path d="M-3 10V34" stroke="#bb9a70" stroke-width=".6"/></g><g transform="translate(39 19) rotate(-20)"><rect x="-5" y="0" width="10" height="37" rx="2.5" fill="url(#nunWood)"/><path d="M-5 1H5V7H-5ZM-5 31H5V36H-5Z" fill="url(#nunSteel)"/><path d="M-5 12 5 15M-5 18 5 21M-5 24 5 27" stroke="#b09068" stroke-width="2"/><path d="M-3 9V29" stroke="#bb9a70" stroke-width=".6"/></g></g></svg>`
const ahDa: StatusDefinition = {
  id: 'touhou:ah_da', kind: 'buff', nameKey: 'status.ahDa.name', effectKey: 'status.ahDa.effect', descriptionKey: 'status.ahDa.desc', conditionKey: 'status.ahDa.condition', icon,
  modifiers: [{ stat: 'physicalDamageTaken', multiply: .9 }]
}
const def: ItemDef = {
  ...stats,
  id: NUNCHAKU_ID,
  kind: 'weapon',
  color: '#9b6636',
  hi: '#dac083',
  text: '#dac083',
  icon: svgIcon(icon),
  weapon: { autoRepeat: true, combo: true, lockAim: true, legacyHeld: true, heldEffects: [ahDa],
    customSwingFx: true, armAim: nunchakuArm, drawHeld: drawNunchaku,
    createPhysics: () => new ChainRodPhysics(drawNunchakuRod,
      10 * NUNCHAKU_VISUAL_SCALE, 9 * NUNCHAKU_VISUAL_SCALE, 19 * NUNCHAKU_VISUAL_SCALE, NUNCHAKU_VISUAL_SCALE),
    createSweep: () => new RodSweep(2.1 * NUNCHAKU_VISUAL_SCALE),
    sound(phase, segment) { nunchakuSound(sfx, phase, segment) }
  }, tags: ['weapon', 'chain']
}
export default def
