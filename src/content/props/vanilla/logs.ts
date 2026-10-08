/** 官方摆件：废坑木堆（35%） */
import type { PropDef } from '../types'
import { PROP_LOGS_ID } from './ids'
import { drawLogs } from '../../../game/art/props'

export const propLogs: PropDef = {
  id: PROP_LOGS_ID,
  halfWidth: 20,
  halfThick: 7,
  layout: {
    count: [1, 1],
    chance: 0.35,
    radius: 26
  },
  render: drawLogs,
  tags: ['wood', 'cover']
}
