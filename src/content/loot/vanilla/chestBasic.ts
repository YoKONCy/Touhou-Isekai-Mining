import { BOOMERANG_ID, NUNCHAKU_ID, LEATHER_ARMOR_ID, WHIP_ID } from '../../items/vanilla/ids'
import { vanilla } from '../../core/ids'
import type { LootTable } from '../types'

export const CHEST_BASIC_TABLE = vanilla('chest_basic')
const def: LootTable = {
  id: CHEST_BASIC_TABLE,
  entries: [BOOMERANG_ID, NUNCHAKU_ID, LEATHER_ARMOR_ID, WHIP_ID].map(item => ({ item, weight: 1, min: 1, max: 1 }))
}
export default def
