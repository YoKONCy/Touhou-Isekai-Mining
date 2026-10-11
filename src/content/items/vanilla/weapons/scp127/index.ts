import type { ItemDef } from '../../../types'
import { SCP127_ID } from '../../ids'
import { drawLivingGun, livingGunIcon } from './appearance'

/** 活体枪概念源于 Arcibi 的 SCP-127：https://scp-wiki.wikidot.com/scp-127；拌嘴设定为本作改编。 */
export default {
  id: SCP127_ID, kind: 'weapon', grade: 3, maxStack: 1, equipSlot: 'weaponA',
  color: '#65677e', hi: '#c6c3a6', text: '#bda3d9', icon: livingGunIcon,
  combat: { critChance: .15, penetration: 2 },
  ranged: { type: 'livingGun', damage: 16, damageKind: 'physical', attackInterval: .09, speed: 900, accuracyPenalty: 7, knockback: 10, stun: 0 },
  weapon: { autoRepeat: true, combo: false, drawHeld: (g, view) => { g.save(); if(view?.flipVertical)g.scale(1,-1); drawLivingGun(g, view?.recoil ?? 0); g.restore() },
    skillDescriptions: { summaryKey: 'scp127.summary', effects: [{ nameKey: 'scp127.reserve.name', descriptionKey: 'scp127.reserve.desc' }, { nameKey: 'scp127.companion.name', descriptionKey: 'scp127.companion.desc' }] } },
  ground: ({ ctx, x, y }) => { ctx.save(); ctx.translate(x, y); ctx.rotate(-.35); ctx.scale(.7, .7); drawLivingGun(ctx, 0, false); ctx.restore() },
  tags: ['weapon', 'ranged', 'livingGun']
} satisfies ItemDef
