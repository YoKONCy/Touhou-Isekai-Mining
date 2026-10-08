import type { ItemDef } from '../../types'
import { MUSHROOM_ID } from '../ids'
import { supplyIcon, supplyGround } from './supplyAppearance'
const def: ItemDef = {
  id: MUSHROOM_ID, kind: 'material', tier: 1, color: '#807080', hi: '#d5c6a4', text: '#d3c6ae', maxStack: 999,
  icon: supplyIcon('<path d="M20 25L18 39Q24 44 30 38L27 24" fill="#c6baa1"/><path d="M7 25Q8 7 24 7Q39 9 41 25Q25 32 7 25Z" fill="#807080"/><path d="M12 22Q16 11 27 12" fill="none" stroke="#b9a4af"/><path d="M29 20L34 22" stroke="#a4aa78"/>'),
  ground: supplyGround('#807080', 'mushroom'), tags: ['camp_supply']
}
export default def
