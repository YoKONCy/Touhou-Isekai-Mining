/** 官方摆件：不可采集的岩缝蕨丛；保留旧内容 id 兼容已有引用。 */
import type { PropDef } from '../types'
import { PROP_MUSHROOM_ID } from './ids'
import { drawMushrooms } from '../../../game/art/props'

export const propMushroom: PropDef = {
  id: PROP_MUSHROOM_ID,
  halfWidth: 8,
  halfThick: 4,
  layout: {
    count: [2, 4],
    radius: 12
  },
  render: drawMushrooms,
  tags: ['plant', 'fern', 'decoration']
}
