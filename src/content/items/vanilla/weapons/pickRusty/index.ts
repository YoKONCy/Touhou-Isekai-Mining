/**
 * 官方物品：生锈铁镐（复杂内容 = 文件夹：index 数据 / melee 招式 / icon 图标）
 * 未来镐子类特效（蓄力、矿脉亲和）在本文件夹加 hooks.ts 即可。
 */
import { PICK_RUSTY_ID } from '../../ids'
import type { ItemDef } from '../../../types'
import { stats } from './stats'
import { PICK_RUSTY_ICON } from './icon'

import { drawPick } from './appearance'

const def: ItemDef = {
  weapon: { drawHeld: drawPick, autoRepeat: true },
  id: PICK_RUSTY_ID,
  kind: 'pick',
  ...stats,
  color: '#8a5a36',
  hi: '#a89a86',
  text: '#c76b3a',
  icon: PICK_RUSTY_ICON,
  tags: ['tool', 'pick']
}

export default def
