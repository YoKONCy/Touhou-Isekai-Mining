import { VORPAL_ID } from '../../ids'
import { stats } from './stats'
import type { ItemDef } from '../../../types'

import { drawVorpal } from './vorpalAppearance'

import { vorpalArmAim } from './vorpalArm'

import { vorpalSwing } from './vorpalAudio'
import { drawVorpalSlash } from './vorpalSlash'
import { sfx } from '../../../../../game/audio/Sfx'

const def: ItemDef = {
  weapon: {
    legacyHeld: true,
    trail: {
      duration: .28,
      render: (ctx, v) => drawVorpalSlash(ctx, v.x, v.y, v.angle, v.segment, v.age / .28)
    },
    sound: (phase, segment) => {
      if (phase === 'active') vorpalSwing(sfx, segment)
    },
    armAim: vorpalArmAim,
    drawHeld: drawVorpal,
    autoRepeat: true,
    combo: true,
    customSwingFx: true
  },
  ...stats,
  id: VORPAL_ID,
  kind: 'weapon',
  color: '#681f28',
  hi: '#d7c2a2',
  text: '#e8b94a',
  tags: ['weapon', 'sword', 'developer', 'vorpal'],
  // 与魔王剑同用斜向大器型、分面金属与细刃棱，不复用其粉紫配色。
  icon: { type: 'svg', svg:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 84 84">' +
    '<defs><linearGradient id="vorpal-metal" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#24232b"/><stop offset=".24" stop-color="#817966"/><stop offset=".4" stop-color="#303039"/><stop offset=".7" stop-color="#a49b80"/><stop offset="1" stop-color="#29242d"/></linearGradient><linearGradient id="vorpal-guard" x2="1" y2="1"><stop stop-color="#aa8852"/><stop offset=".5" stop-color="#3c2b29"/><stop offset="1" stop-color="#766043"/></linearGradient><radialGradient id="vorpal-haze"><stop stop-color="#180b20" stop-opacity=".75"/><stop offset="1" stop-color="#180b20" stop-opacity="0"/></radialGradient></defs>' +
    '<g transform="translate(15 66) rotate(-45) scale(.88)">' +
    '<ellipse cx="44" cy="5" rx="40" ry="19" fill="url(#vorpal-haze)"/>' +
    '<path d="M7 -5 24 -6 27 -4 30 -6 48 -7 51 -5 55 -8 61 -6 65 -10 70 -8 76 -3 80 3Q83 19 70 29L66 28 63 33Q50 39 40 38Q55 31 59 20L57 14 53 9 45 8 42 6 38 8 24 6 21 4 18 6 7 5Z" fill="url(#vorpal-metal)" stroke="#130e1b" stroke-width="1.5"/>' +
    '<path d="M8 -1 27 -2 30 -1 52 -2 65 0 54 2 29 1 8 2Z" fill="#c0b394"/>' +
    '<path d="M8 3 37 4 55 5 66 13 62 24 48 35 56 22 52 12 36 7 8 6Z" fill="#1a1822"/>' +
    '<path d="M78 6Q79 14 74 21M71 25 68 27M62 33Q51 37 44 37M15 -4 19 -2M37 3 41 0" fill="none" stroke="#e2cba0" stroke-width="1.1"/>' +
    '<path d="M29 -6 32 -2 29 1 34 5M49 -6 47 -3 52 1M68 15 73 19 68 23 69 28" fill="none" stroke="#180f20" stroke-width="1.6"/>' +
    '<path d="m19 -4 5 1-2 3-4-1m21 1 5-1-1 3-5 1m16-6 4 2-2 2m9 25 4-2-1 4-4 1" fill="#8d654655"/>' +
    '<path d="M64 -7 73 -5 79 3 76 15 70 19 68 9 61 2Z" fill="#302532" stroke="#705741"/>' +
    '<circle cx="72" cy="5" r="2.7" fill="#b0935e"/><circle cx="72" cy="5" r="1.4" fill="#211526"/>' +
    '<path d="M-11 -2 5 -3 5 3-11 2Z" fill="#2c1b29" stroke="#140e1b"/><path d="m-8-2 1 4m2-4 1 4m2-4 1 4" stroke="#80634c"/>' +
    '<path d="M3 -3Q-1 -9 6 -15L9 -14 8 -10 6 -10 9 -5 10 5 7 9 9 12 6 15Q-1 10 3 3Z" fill="url(#vorpal-guard)" stroke="#180e20" stroke-width="1.2"/>' +
    '<circle cx="-12" cy="0" r="3" fill="#8b704d" stroke="#211523"/>' +
    '<path d="M29 -5 32 -2 29 1M69 16 73 19 69 23" fill="none" stroke="#9d3955" stroke-width=".85"/>' +
    '</g></svg>' }
}
export default def
