import type { ItemDef } from '../../types'

export const stats = {
  grade: 1,
  maxStack: 1,
  equipSlot: 'outfit',
  combat: {
    physicalResist: 2,
    magicResist: 0
  }
} satisfies Partial<ItemDef>
