/** 官方大件：翻倒矿车＋洒落矿料（约 3 格宽；车斗与料堆两段碰撞，挡弹幕掩体） */
import type { PropDef } from '../types'
import { PROP_CART_WRECK_ID } from './ids'
import { drawCartWreck } from '../../../game/art/props'

export const propCartWreck: PropDef = {
  id: PROP_CART_WRECK_ID,
  halfWidth: 34,
  halfThick: 9,
  segments: [
    // 侧翻车斗
    { ox: -14, oy: 0, hw: 34, hb: 9 },
    // 右侧矿料堆
    { ox: 45, oy: 2, hw: 27, hb: 7 }
  ],
  blockBullets: true,
  layout: {
    count: [1, 1],
    radius: 72,
    large: true
  },
  render: drawCartWreck,
  tags: ['metal', 'wreck', 'cover', 'large']
}
