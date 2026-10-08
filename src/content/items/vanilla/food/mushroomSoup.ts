import type { ItemDef } from '../../types'
import { SOUP_ID } from '../ids'
import { soupIcon, soupGround } from './soupAppearance'

const def: ItemDef = {
  id: SOUP_ID, kind: 'consumable', tier: 1, color: '#b99a60', hi: '#d5c6a4', text: '#d3c6ae', maxStack: 999,
  icon: soupIcon(), ground: soupGround(),
  consume: { heal: 30 }, material: true, tags: ['camp_supply']
}
export default def
