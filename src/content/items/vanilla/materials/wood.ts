import type { ItemDef } from '../../types'
import { WOOD_ID } from '../ids'
import { supplyIcon, supplyGround } from './supplyAppearance'
const def: ItemDef = {
  id: WOOD_ID, kind: 'material', tier: 1, color: '#96704b', hi: '#d5c6a4', text: '#d3c6ae', maxStack: 999,
  icon: supplyIcon('<path d="M9 17L32 9L40 17L37 33L15 40L7 31Z" fill="#96704b"/><path d="M9 17L17 23L40 17M17 23L15 40" fill="none"/><path d="M21 26L33 22M20 32L31 28" fill="none" stroke="#d3ae77"/>'),
  ground: supplyGround('#96704b'), tags: ['camp_supply']
}
export default def
