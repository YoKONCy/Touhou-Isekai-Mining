/** 官方大件：断裂矿轨残段（约 3 格长，贴地不挡路；仅翘起端头一小段阻挡） */
import type { PropDef } from '../types'
import { PROP_BROKEN_RAILS_ID } from './ids'
import { drawBrokenRails } from '../../../game/art/props'

export const propBrokenRails: PropDef = {
  id: PROP_BROKEN_RAILS_ID,
  halfWidth: 70,
  halfThick: 6,
  segments: [
    // 只有左端翘起端头有实体；贴地轨身弹幕与人物都可压过
    { ox: -52, oy: -4, hw: 11, hb: 6 }
  ],
  // 贴地轨道：不挡弹幕
  blockBullets: false,
  layout: {
    count: [1, 1],
    radius: 74,
    large: true
  },
  render: drawBrokenRails,
  tags: ['metal', 'rails', 'large']
}
