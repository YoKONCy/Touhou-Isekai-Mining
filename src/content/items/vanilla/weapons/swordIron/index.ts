/**
 * 官方物品：铁剑（复杂内容 = 文件夹：index 数据 / melee 招式 / icon 图标）
 */
import { SWORD_IRON_ID } from '../../ids'
import type { ItemDef } from '../../../types'
import { stats } from './stats'
import { SWORD_IRON_ICON } from './icon'

import { drawSword } from './appearance'

const def: ItemDef = {
  weapon: { drawHeld: drawSword, combo: true, legacyHeld: true },
  id: SWORD_IRON_ID,
  kind: 'weapon',
  ...stats,
  color: '#9aa7b8',
  hi: '#e2eaf4',
  text: '#dfe7f2',
  icon: SWORD_IRON_ICON,
  tags: ['weapon', 'sword']
}

export default def
