import type { ItemDef } from '../../types'
import { SLIME_BALL_ID } from '../ids'
import { supplyIcon, supplyGround } from './supplyAppearance'
const def: ItemDef = {
  id: SLIME_BALL_ID, kind: 'material', tier: 1, color: '#65984d', hi: '#d5c6a4', text: '#d3c6ae', maxStack: 999,
  icon: supplyIcon('<path d="M7 32Q8 9 24 9Q38 9 41 31Q41 40 24 40Q7 40 7 32Z" fill="#65984d"/><path d="M9 31Q25 38 39 29L40 34Q33 43 14 38Z" fill="#3e683e"/><path d="M14 22Q15 14 24 14" fill="none" stroke="#c1dda0" stroke-width="4"/>'),
  ground: supplyGround('#65984d', 'gel'), tags: ['camp_supply']
}
export default def
