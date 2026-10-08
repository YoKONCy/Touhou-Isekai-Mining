import { WHIP_ID } from '../../ids'
import type { ItemDef } from '../../../types'
import { stats, WHIP_VISUAL_SCALE } from './stats'

import { whipArmAim } from './whipArm'
import { whipCurve, WhipSweep } from './whipMotion'
import { drawWhip, drawWhipGrip } from './whipAppearance'
import { whipUnfurl, whipCrack } from './whipAudio'
import { sfx } from '../../../../../game/audio/Sfx'

const def: ItemDef = {
  weapon: {
    curve: whipCurve,
    createSweep: () => new WhipSweep(WHIP_VISUAL_SCALE),
    drawCurve: drawWhip,
    drawHeld: drawWhipGrip,
    armAim: whipArmAim,
    lockAim: true,
    buffer: false,
    combo: false,
    customSwingFx: true,
    sound: (phase) => {
      if (phase === 'active') whipUnfurl(sfx)
      else if (phase === 'recover') whipCrack(sfx)
    }
  },
  ...stats,
  id: WHIP_ID,
  kind: 'weapon',
  color: '#795238',
  hi: '#c39b69',
  text: '#cbb994',
  tags: ['weapon', 'whip'],
  icon: { type: 'svg', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 84 84"><g transform="translate(42 42) scale(${WHIP_VISUAL_SCALE}) translate(-42 -42)"><path d="m27 57 10-6 8-12-1-10-7-8 1-9 7-4 9 3 3 10-5 8-1 11 7 4 9-7 2-13-5-9" fill="none" stroke="#292620" stroke-width="7" stroke-linejoin="bevel"/><path d="m27 57 10-6 8-12-1-10-7-8 1-9 7-4 9 3 3 10-5 8-1 11 7 4 9-7 2-13-5-9" fill="none" stroke="#796e5c" stroke-width="4" stroke-linejoin="bevel"/><path d="m30 55 6-4m7-10 1-7m-5-14-1-5m8-5 6 2m2 8-3 5m3 16 4 2m7-8 1-8" fill="none" stroke="#c9c0a7" stroke-width="2"/><path d="m11 70 15-15 7 7-15 15z" fill="#33251d"/><path d="m13 69 12-12 5 5-12 12z" fill="#956448"/><path d="m15 67 4 4m0-8 4 4m0-8 4 4" stroke="#493127" stroke-width="2"/><path d="m25 55 3-3 7 7-3 3z" fill="#bab39c"/></g></svg>` }
}
export default def
