import type { ItemDef } from '../../../types'
import { TSUKINAGA_AI_TAROT_ID } from '../../ids'
import { tarotIcon, drawTarotBack } from './appearance'
import { ARCANA, arcanaNameKey, arcanaDescriptionKey } from './arcana'

const def: ItemDef = {
  id: TSUKINAGA_AI_TAROT_ID, kind: 'weapon', rarity: 3, tier: 3, maxStack: 1, equipSlot: 'weaponA',
  color: '#9674b1', hi: '#ead3a7', text: '#cf9aed', icon: tarotIcon,
  combat: { critChance: 0, penetration: 0 },
  ranged: { type: 'tarot', damage: 22, damageKind: 'physical', attackInterval: .5, speed: 640, accuracyPenalty: 0 },
  weapon: { hiddenHeld: true, autoRepeat: true, skillDescriptions: { summaryKey: 'tarot.summary', effects: ARCANA.map(card => ({ nameKey: arcanaNameKey(card), descriptionKey: arcanaDescriptionKey(card) })) } },
  ground: ({ ctx, x, y }) => { ctx.save(); ctx.translate(x, y); ctx.rotate(-.3); ctx.scale(.55, .55); drawTarotBack(ctx); ctx.restore() },
  tags: ['weapon', 'ranged', 'tarot', 'arcana']
}
export default def
