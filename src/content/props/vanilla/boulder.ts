/** 官方摆件：大石头（2~4 个/房，40% 额外中置一个） */
import type { PropDef } from '../types'
import { PROP_BOULDER_ID } from './ids'
import { drawBoulder } from '../../../game/art/props'

export const propBoulder: PropDef = {
  id: PROP_BOULDER_ID,
  halfWidth: 18,
  halfThick: 7,
  layout: {
    count: [2, 4],
    midBonus: 0.4,
    radius: 24
  },
  render: drawBoulder,
  tags: ['rock', 'cover']
}
