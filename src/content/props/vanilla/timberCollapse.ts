/** 官方大件：坍塌坑木支架（约 4 格宽；斜梁与压顶岩堆两段碰撞，挡弹幕掩体） */
import type { PropDef } from '../types'
import { PROP_TIMBER_COLLAPSE_ID } from './ids'
import { drawTimberCollapse } from '../../../game/art/props'

export const propTimberCollapse: PropDef = {
  id: PROP_TIMBER_COLLAPSE_ID,
  halfWidth: 60,
  halfThick: 7,
  segments: [
    // 斜倒横梁
    { ox: -2, oy: -2, hw: 60, hb: 7 },
    // 右端垮落岩块
    { ox: 48, oy: 1, hw: 33, hb: 11 }
  ],
  blockBullets: true,
  layout: {
    count: [1, 1],
    radius: 80,
    large: true
  },
  render: drawTimberCollapse,
  tags: ['timber', 'wreck', 'cover', 'large']
}
