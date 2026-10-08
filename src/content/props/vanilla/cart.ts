/** 官方摆件：旧矿车残骸（15%，稀有） */
import type { PropDef } from '../types'
import { PROP_CART_ID } from './ids'
import { drawCart } from '../../../game/art/props'

export const propCart: PropDef = {
  id: PROP_CART_ID,
  halfWidth: 19,
  halfThick: 6,
  layout: {
    count: [1, 1],
    chance: 0.15,
    radius: 28
  },
  render: drawCart,
  tags: ['metal', 'cover']
}
