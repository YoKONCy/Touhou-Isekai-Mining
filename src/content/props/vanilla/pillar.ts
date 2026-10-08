/** 官方摆件：岩石柱（40% 房间出现 1 根） */
import type { PropDef } from '../types'
import { PROP_PILLAR_ID } from './ids'
import { drawPillar } from '../../../game/art/props'

export const propPillar: PropDef = {
  id: PROP_PILLAR_ID,
  halfWidth: 13,
  halfThick: 5,
  layout: {
    count: [1, 1],
    chance: 0.4,
    radius: 22
  },
  render: drawPillar,
  tags: ['rock', 'cover']
}
