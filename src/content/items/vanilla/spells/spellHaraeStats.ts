import type { ItemDef } from '../../types'

/** 符卡时间统一为秒，半径为像素。 */
export const stats = {
  rarity: 2,
  tier: 2,
  maxStack: 1,
  equipSlot: 'spellA',
  spell: {
    damageKind: 'magic',
    manaCost: 30,
    cooldown: 15,
    radius: 165,
    damage: 20,
    knockback: 280,
    stun: .8,
    clearBullets: true,
    color: '#ffd968',
    waves: 2,
    waveInterval: .4,
    fxColors: {
      core: '#fffbe8',
      ring: '#ffd968',
      rim: '#ff9e3d'
    }
  }
} satisfies Partial<ItemDef>
