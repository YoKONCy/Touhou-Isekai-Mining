import type { ItemDef } from '../../types'
import { HERB_ID } from '../ids'
import { supplyIcon, supplyGround } from './supplyAppearance'
const def: ItemDef = {
  id: HERB_ID, kind: 'material', tier: 1, color: '#728c64', hi: '#d5c6a4', text: '#d3c6ae', maxStack: 999,
  icon: supplyIcon('<path d="M24 40L24 16" fill="none" stroke="#81956b"/><path d="M23 29Q6 31 8 15Q22 15 23 29ZM25 23Q25 8 40 10Q40 25 25 23ZM25 36Q27 24 39 27Q38 40 25 36Z" fill="#728c64"/><path d="M12 20L20 26M28 19L35 14" stroke="#bac79a"/>'),
  ground: supplyGround('#728c64'), tags: ['camp_supply']
}
export default def
