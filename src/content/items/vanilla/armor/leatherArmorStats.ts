import type { ItemDef } from '../../types'

export const stats = {
  rarity: 1,
  tier: 2,
  maxStack: 1,
  equipSlot: 'outfit',
  combat: {
    physicalResist: 15,
    magicResist: 0
  }
} satisfies Partial<ItemDef>
