/** 官方大件：垮塌岩堆（约 3.5 格宽；单段宽胶囊，挡弹幕掩体） */
import type { PropDef } from '../types'
import { PROP_ROCK_COLLAPSE_ID } from './ids'
import { drawRockCollapse } from '../../../game/art/props'

export const propRockCollapse: PropDef = {
  id: PROP_ROCK_COLLAPSE_ID,
  halfWidth: 72,
  halfThick: 12,
  blockBullets: true,
  layout: {
    count: [1, 1],
    radius: 80,
    large: true
  },
  render: drawRockCollapse,
  tags: ['rock', 'wreck', 'cover', 'large']
}
